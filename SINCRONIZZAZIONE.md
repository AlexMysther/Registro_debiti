# Sincronizzare due telefoni

Di serie il registro sta **solo** sul dispositivo dove lo usi. Per far vedere lo
stesso quaderno su due telefoni serve un posto online dove tenere i dati: qui si
usa **Firebase Firestore** di Google, che per questi volumi è gratuito (nessuna
carta di credito richiesta sul piano Spark).

Si fa una volta sola, in una decina di minuti.

---

## 1. Crea il progetto

1. Vai su <https://console.firebase.google.com> e accedi con un account Google.
2. **Crea un progetto** → nome a piacere (es. `registro-debiti`) → puoi
   disattivare Google Analytics, non serve.

## 2. Attiva l'accesso anonimo

Serve perché Firebase accetti le richieste senza far fare login ai tuoi.

1. Menu a sinistra → **Build → Authentication** → **Get started**
2. Scheda **Sign-in method** → **Anonymous** → **Enable** → **Save**

## 3. Crea il database

1. Menu → **Build → Firestore Database** → **Create database**
2. Scegli una zona europea (es. `eur3` o `europe-west`), modalità **production**.
3. Scheda **Rules**, cancella tutto e incolla questo, poi **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /registri/{registro} {
      allow get, create, update: if request.auth != null;
      allow list: if false;

      match /debitori/{debitore} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

`allow list: if false` è la parte importante: impedisce di farsi dare l'elenco
dei registri. Si può leggere un registro solo conoscendone il codice, che è
lungo e casuale.

## 4. Prendi la configurazione

1. Ingranaggio in alto a sinistra → **Project settings**
2. In fondo, **Your apps** → icona **`</>`** (Web) → dai un nome → **Register app**
3. Compare un blocco `const firebaseConfig = { ... }`: servono quattro valori.

Aprili nel progetto il file **`firebase-config.js`** e sostituisci i segnaposto:

```js
window.REGISTRO_FIREBASE = {
  apiKey: "AIza…",
  authDomain: "registro-debiti.firebaseapp.com",
  projectId: "registro-debiti",
  appId: "1:123…:web:abc…"
};
```

Poi salva e fai il commit (da GitHub si può modificare il file direttamente dal
sito, con la matita, e premere *Commit changes*). Dopo un minuto GitHub Pages
serve la versione aggiornata.

> Questi valori **non sono una password**: identificano il progetto e sono
> visibili a chiunque apra la pagina. A proteggere i dati sono le regole del
> punto 3 e il codice del registro.

## 5. Autorizza il dominio

Firebase accetta l'accesso solo dai domini che conosce.

**Authentication → Settings → Authorized domains → Add domain** →
`alexmysther.github.io`

---

## Come si usa, dopo

1. Sul **primo telefono** apri il sito → **☁** → **Crea il registro condiviso**.
   Quello che c'era già su quel telefono viene caricato online.
2. Sempre lì: **Copia il link per l'altro telefono** e mandalo (WhatsApp, SMS).
3. Sul **secondo telefono** apri quel link: si aggancia da solo e mostra lo
   stesso registro. Poi *Aggiungi a schermata Home*.

Da quel momento un caffè segnato su un telefono compare sull'altro in pochi
secondi. Il tasto **☁** è verde quando è collegato, grigio quando manca la rete.

## Cosa succede senza rete

Si continua a segnare normalmente: le modifiche restano in coda sul telefono e
partono da sole appena torna la linea. Non serve fare niente.

## Chi può vedere il registro

Chiunque abbia il link/codice. Il codice è casuale e non si può indovinare né
elencare, ma **è la chiave**: mandalo solo a chi deve. Se un giorno vuoi
cambiarlo, basta creare un nuovo registro condiviso e rimandare il link nuovo.

## Se due segnano insieme

Ogni persona del registro è un documento separato: due telefoni che segnano su
**persone diverse** non si disturbano mai. Se per caso segnate *la stessa
persona nello stesso istante*, vale l'ultima modifica arrivata — nella pratica
del bar non succede, ma è giusto saperlo.

## Quanto costa davvero

Piano gratuito Firebase: 50.000 letture e 20.000 scritture al giorno. Un bar che
segna qualche centinaio di consumazioni sta due ordini di grandezza sotto. Non
serve nessun pagamento.

## Se qualcosa non va

Apri **☁**: se c'è un problema viene scritto lì.

| Messaggio | Cosa fare |
| --- | --- |
| *Attiva l'accesso anonimo* | Punto 2 non fatto |
| *Le regole di Firestore bloccano* | Punto 3: regole non pubblicate |
| *Manca la configurazione* | Punto 4: `firebase-config.js` ancora con i segnaposto |
| *Firebase non si carica* | Stai aprendo il file scaricato invece del sito, oppure manca la rete |

La sincronizzazione funziona solo aprendo il **sito** (GitHub Pages): aprendo il
file `index.html` dal telefono il browser blocca il caricamento di Firebase.
