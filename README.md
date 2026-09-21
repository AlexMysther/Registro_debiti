# Registro dei debiti

Il quaderno dei debiti del bar, su schermo. Il nome si scrive **a mano**, col dito o
con la penna, come sulla carta; a destra del nome restano in fila i singoli importi
(`1,20 + 1,20 + 1,30`), poi il totale della persona e, in fondo al foglio, il totale
di tutto il registro.

Tutto sta in un unico file, `index.html`: nessuna installazione, nessun account,
nessun server. Funziona anche senza connessione.

## Come si apre

**Sul computer**, per provarlo: doppio clic su `index.html`.

**Per usarlo davvero**, mettilo online con GitHub Pages — è gratis e serve il sito
vero, che sul telefono si installa come un'app:

1. Nel repository: **Settings → Pages**
2. *Source*: **Deploy from a branch** · *Branch*: `claude/peaceful-lovelace-tj3odc`, cartella `/ (root)` → **Save**
3. Dopo un minuto è su `https://<utente>.github.io/Registro_debiti/`
4. Sul telefono apri quel link → *Aggiungi a schermata Home* (iPhone: Condividi ⤴; Android: ⋮)

Da lì funziona a schermo intero e anche senza rete.

## Come si usa

| Cosa vuoi fare | Come |
| --- | --- |
| Aggiungere una persona | **+ Nuovo debitore** → scrivi il nome sul foglio → **Salva nome** |
| Segnare un caffè | tasto tondo **+** sulla riga → tocca **Caffè** (due caffè = due tocchi) |
| Importo diverso | **Altro importo** → tastierino → **+ Debito** |
| Segnare un acconto | **Altro importo** → tastierino → **− Pagamento** |
| Togliere una voce sbagliata | tocca l'importo nella riga → **Togli** |
| Ha pagato tutto | tocca il nome → **Ha pagato tutto — azzera il conto** |
| Cambiare i prezzi | **☰** → *Prezzi* |
| Stampare il registro | **⎙** in alto |

Il nome si può anche scrivere con la tastiera (**⌨ Usa la tastiera**), se serve.

## Dove finiscono i dati

Restano **solo su quel dispositivo**, nella memoria del browser (`localStorage`):
non vanno su internet e nessun altro li vede. Per questo ci sono **Backup** e
**Ripristino** in **☰**: il backup è un testo da copiare e tenere da parte (mail,
note). Se cancelli i dati del browser o cambi telefono, quel testo rimette tutto a posto.

## Due telefoni, stessi dati

Di serie no: ogni dispositivo tiene il suo registro. Se serve che marito e moglie
segnino sullo stesso quaderno, il progetto ha già dentro la sincronizzazione con
**Firebase Firestore** (gratuita per questi volumi): si attiva compilando
`firebase-config.js` seguendo **[SINCRONIZZAZIONE.md](SINCRONIZZAZIONE.md)**, poi
dal tasto **☁** si crea il registro condiviso e si manda il link all'altro telefono.

Una volta attiva: un caffè segnato su un telefono compare sull'altro in pochi
secondi, si può segnare anche senza rete (parte tutto quando torna la linea), e
ogni persona del registro è un documento separato, così due telefoni che segnano
su persone diverse non si pestano i piedi.

Senza configurazione il tasto ☁ spiega cosa manca e il registro continua a
funzionare in locale: niente si rompe.

## Dettagli tecnici

- Pagina singola, HTML + CSS + JavaScript, senza librerie né build.
- La firma non è un'immagine: i tratti sono salvati come coordinate normalizzate
  (`{aspect, strokes:[[x,y,spessore]…]}`), quindi occupano pochissimo spazio,
  restano nitidi su qualsiasi schermo e seguono il colore del tema chiaro/scuro.
- Gli importi sono salvati in **centesimi interi**, mai in virgola mobile: niente
  errori di arrotondamento sui totali.
- Ogni voce tiene data e descrizione; i saldi passati finiscono nello storico della persona.
- Tema chiaro e scuro, layout adatto al telefono, foglio di stile per la stampa.
- `sync.js` è un modulo ES separato e opzionale: se non si carica (file aperto in
  locale, rete assente, configurazione mancante) l'app resta identica, solo senza
  sincronizzazione. Le modifiche si inviano per differenza rispetto all'ultimo
  stato noto, quindi i dati che arrivano dagli altri telefoni non rimbalzano
  indietro.
