# Registro dei debiti

Il quaderno dei debiti del bar, su schermo. Il nome si scrive **a mano**, col dito o
con la penna, come sulla carta; a destra del nome restano in fila i singoli importi
(`1,20 + 1,20 + 1,30`), poi il totale della persona e, in fondo al foglio, il totale
di tutto il registro.

Tutto sta in un unico file, `index.html`: nessuna installazione, nessun account,
nessun server. Funziona anche senza connessione.

## Come si apre

- **Sul computer**: doppio clic su `index.html`.
- **Su telefono o tablet** (il modo comodo per scrivere a mano): apri la pagina nel
  browser e scegli *Aggiungi a schermata Home*. Da lì si apre come un'app.

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

## Dettagli tecnici

- Pagina singola, HTML + CSS + JavaScript, senza librerie né build.
- La firma non è un'immagine: i tratti sono salvati come coordinate normalizzate
  (`{aspect, strokes:[[x,y,spessore]…]}`), quindi occupano pochissimo spazio,
  restano nitidi su qualsiasi schermo e seguono il colore del tema chiaro/scuro.
- Gli importi sono salvati in **centesimi interi**, mai in virgola mobile: niente
  errori di arrotondamento sui totali.
- Ogni voce tiene data e descrizione; i saldi passati finiscono nello storico della persona.
- Tema chiaro e scuro, layout adatto al telefono, foglio di stile per la stampa.
