/* Sincronizzazione del registro fra piu' dispositivi, con Firebase Firestore.
 *
 * Questo file e' opzionale: se manca la configurazione (firebase-config.js) o se
 * l'SDK non si carica, il registro continua a funzionare in locale. Vedi
 * SINCRONIZZAZIONE.md per la procedura di attivazione.
 *
 * Struttura dei dati su Firestore:
 *   registri/<codice>                     { presets, updated }
 *   registri/<codice>/debitori/<id>       { name, entries, history, ord, updated }
 * Un documento per debitore: due telefoni che segnano su persone diverse non si
 * pestano i piedi. Sullo stesso debitore vince l'ultima scrittura.
 */

const VERSIONE_SDK = "10.14.1";

const FONTI = [
  function(modulo){ return "https://www.gstatic.com/firebasejs/" + VERSIONE_SDK + "/firebase-" + modulo + ".js"; },
  function(modulo){ return "https://cdn.jsdelivr.net/npm/firebase@" + VERSIONE_SDK + "/" + modulo + "/+esm"; }
];

async function carica(modulo){
  let ultimo = null;
  for(const fonte of FONTI){
    try{ return await import(/* @vite-ignore */ fonte(modulo)); }
    catch(err){ ultimo = err; }
  }
  throw ultimo || new Error("SDK non raggiungibile");
}

let F = null;            /* modulo firestore */
let db = null;
let avviato = null;      /* promessa di avvio, una sola volta */
let staccaDebitori = null;
let staccaMeta = null;
let codiceAttivo = null;
let eventi = {};

function config(){ return window.REGISTRO_FIREBASE || {}; }

function configurata(){
  const c = config();
  return !!(c && c.apiKey && c.projectId && String(c.apiKey).indexOf("INCOLLA") !== 0);
}

async function avvia(){
  if(!configurata()) throw new Error("non_configurato");
  const [App, Auth, Fs] = await Promise.all([carica("app"), carica("auth"), carica("firestore")]);
  const app = App.initializeApp(config());
  F = Fs;
  try{
    db = Fs.initializeFirestore(app, {
      localCache: Fs.persistentLocalCache({ tabManager: Fs.persistentMultipleTabManager() })
    });
  }catch(err){
    /* browser senza IndexedDB (es. navigazione privata): si lavora senza cache su disco */
    db = Fs.getFirestore(app);
  }
  const auth = Auth.getAuth(app);
  if(!auth.currentUser){
    try{ await Auth.signInAnonymously(auth); }
    catch(err){
      const e = new Error("accesso_anonimo");
      e.causa = err && err.code;
      throw e;
    }
  }
  return true;
}

function pronto(){
  if(!avviato) avviato = avvia();
  return avviato;
}

function docDebitore(id){ return F.doc(db, "registri", codiceAttivo, "debitori", id); }

const api = {
  /* true se c'e' una configurazione: l'interfaccia mostra i comandi solo in quel caso */
  configurata: configurata,

  /* codice nuovo, casuale: e' lui la chiave del registro, non indovinabile */
  nuovoCodice: function(){
    const alfabeto = "abcdefghijkmnopqrstuvwxyz23456789";
    let s = "";
    const casuali = new Uint8Array(14);
    (window.crypto || window.msCrypto).getRandomValues(casuali);
    for(let i=0;i<casuali.length;i++) s += alfabeto[casuali[i] % alfabeto.length];
    return "reg-" + s;
  },

  /* accetta il codice nudo oppure un link che lo contiene (#r=...) */
  pulisciCodice: function(testo){
    const t = String(testo || "").trim();
    const m = t.match(/#r=([A-Za-z0-9-]+)/);
    return (m ? m[1] : t).replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  },

  connetti: async function(codice, handlers){
    eventi = handlers || {};
    await pronto();
    api.disconnetti(true);
    codiceAttivo = codice;

    let primaVolta = true;
    staccaDebitori = F.onSnapshot(
      F.collection(db, "registri", codice, "debitori"),
      { includeMetadataChanges: true },
      function(snap){
        const debitori = snap.docs.map(function(doc){
          const d = doc.data() || {};
          return {
            id: doc.id,
            name: d.name || {type:"text", value:"?"},
            entries: Array.isArray(d.entries) ? d.entries : [],
            history: Array.isArray(d.history) ? d.history : [],
            ord: d.ord || 0
          };
        }).sort(function(a,b){ return (a.ord||0) - (b.ord||0); });

        if(eventi.onDati) eventi.onDati({
          debitori: debitori,
          vuoto: snap.empty,
          prima: primaVolta,
          daCache: snap.metadata.fromCache,
          inAttesa: snap.metadata.hasPendingWrites
        });
        primaVolta = false;
      },
      function(err){ if(eventi.onErrore) eventi.onErrore(err && err.code ? err.code : "errore"); }
    );

    staccaMeta = F.onSnapshot(
      F.doc(db, "registri", codice),
      function(snap){
        const d = snap.data();
        if(d && Array.isArray(d.presets) && d.presets.length && eventi.onPrezzi) eventi.onPrezzi(d.presets);
      },
      function(){ /* il documento di testa non e' indispensabile */ }
    );

    return codice;
  },

  disconnetti: function(silenzioso){
    if(staccaDebitori){ staccaDebitori(); staccaDebitori = null; }
    if(staccaMeta){ staccaMeta(); staccaMeta = null; }
    codiceAttivo = null;
    if(!silenzioso) eventi = {};
  },

  collegato: function(){ return !!codiceAttivo; },
  codice: function(){ return codiceAttivo; },

  /* le scritture non si attendono: Firestore le mette in coda e le manda
     appena c'e' rete, quindi il registro resta utilizzabile offline */
  salvaDebitore: function(id, dati){
    if(!codiceAttivo) return;
    dati.updated = Date.now();
    F.setDoc(docDebitore(id), dati).catch(function(err){
      if(eventi.onErrore) eventi.onErrore(err && err.code ? err.code : "scrittura");
    });
  },

  eliminaDebitore: function(id){
    if(!codiceAttivo) return;
    F.deleteDoc(docDebitore(id)).catch(function(){});
  },

  salvaPrezzi: function(presets){
    if(!codiceAttivo) return;
    F.setDoc(F.doc(db, "registri", codiceAttivo), {presets:presets, updated:Date.now()}, {merge:true}).catch(function(){});
  }
};

window.RegistroSync = api;
window.dispatchEvent(new Event("registro-sync-pronto"));
