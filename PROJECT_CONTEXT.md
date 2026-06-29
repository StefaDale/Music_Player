# PROJECT_CONTEXT.md

> Documento di contesto per permettere a qualsiasi IA o sviluppatore di riprendere il progetto senza ulteriori spiegazioni. Ultimo aggiornamento: giugno 2026.

---

## Panoramica del progetto

| Campo | Dettaglio |
|---|---|
| **Nome** | Open Music Player |
| **Tipo** | Applicazione web musicale con frontend statico e backend Node.js |
| **Scopo principale** | Offrire un'esperienza simile a Spotify usando fonti accessibili: YouTube per il catalogo mainstream, Audius come fallback gratuito e LRCLIB per i testi |
| **Frontend produzione** | `https://stefadale.github.io/Music_Player/` |
| **Backend produzione** | `https://music-player-2mhu.onrender.com` |
| **Hosting** | GitHub Pages per il frontend, Render per il backend |
| **Stato attuale** | Funzionante online. Il frontend GitHub Pages chiama il backend Render tramite `config.js`; Render espone le API, usa la chiave YouTube come variabile ambiente e abilita CORS per `https://stefadale.github.io`. |

---

## Tecnologie utilizzate

### Linguaggi

- **HTML5** per la struttura dell'interfaccia
- **CSS3** per layout responsive, player, pannelli e stati visuali
- **JavaScript vanilla** per interazione, ricerca, player, coda, preferiti e testi
- **Node.js** per il backend HTTP senza framework esterni

### API e servizi esterni

- **YouTube Data API v3** per cercare video musicali mainstream
- **YouTube IFrame Player API** per riprodurre i video nel frontend
- **Audius API** per ricerca e streaming fallback
- **LRCLIB API** per testi sincronizzati o plain lyrics
- **GitHub Pages** per pubblicare il frontend statico
- **Render** per eseguire il backend Node.js
- **ngrok** usato solo per simulazioni e test temporanei online

---

## Struttura dei file

```text
Deezer/
|-- index.html          # Interfaccia principale dell'app
|-- styles.css          # Stili responsive e layout del player
|-- app.js              # Logica frontend, player, ricerca, coda, preferiti e lyrics
|-- config.js           # URL del backend da usare quando il frontend e' su GitHub Pages
|-- server.js           # Backend Node.js con API search/config/lyrics/stream
|-- package.json        # Script npm e versione Node richiesta
|-- README.md           # Documentazione originale in italiano
|-- README_IT.txt       # Copia testuale del README italiano
|-- README.txt          # README tradotto in inglese
|-- PROJECT_CONTEXT.md  # Questo documento di contesto in italiano
|-- PROJECT_CONTEXT_EN.md # Documento di contesto in inglese
|-- .env.example        # Esempio variabili ambiente senza segreti
|-- .gitignore          # Esclude .env
```

---

## Configurazione importante

### Locale

Il file `.env` locale puo' contenere:

```text
PORT=4173
HOST=127.0.0.1
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=
```

Il file `.env` non deve essere caricato su GitHub.

### Produzione Render

Variabili ambiente previste su Render:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=...
CORS_ORIGIN=https://stefadale.github.io
```

`PORT` viene impostata automaticamente da Render.

### Frontend GitHub Pages

`config.js` deve puntare al backend Render:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

---

## Funzionalita implementate

- Ricerca brani tramite backend.
- YouTube come provider principale quando la chiave API e' configurata.
- Audius come fallback gratuito.
- Riproduzione tramite YouTube IFrame Player o stream Audius.
- Coda di riproduzione.
- Preferiti salvati in `localStorage`.
- Testi tramite LRCLIB.
- UI responsive per desktop e mobile.
- Pubblicazione reale con GitHub Pages + Render.
- Meta `robots` `noindex, nofollow` in `index.html` per evitare l'indicizzazione.

---

## Note operative

- Il sito pubblico da aprire e condividere e' quello GitHub Pages.
- Render serve il backend; puo' mostrare anche la pagina HTML, ma non e' il link principale per gli utenti.
- Se GitHub Pages non trova il backend, controllare `config.js`, l'ordine degli script in `index.html` e CORS su Render.
- Il valore CORS deve essere tutto minuscolo: `https://stefadale.github.io`.
- Se YouTube non restituisce risultati, controllare le restrizioni della chiave Google Cloud.

---

## Tracciamento IA

| Data | Modello IA | Attivita |
|---|---|---|
| 29 giugno 2026 | Codex | Creazione dell'app musicale, configurazione YouTube/Audius/LRCLIB, supporto backend Node.js, responsive UI, pubblicazione con GitHub Pages + Render e documentazione operativa. |
| 29 giugno 2026 | Codex | Aggiunta meta `noindex,nofollow`, copia del README italiano, traduzione inglese e generazione dei documenti di contesto IT/EN. |

---

## Prossimi passi consigliati

- Rimuovere eventuali campi di debug non necessari dalle risposte API.
- Migliorare ulteriormente il ranking dei risultati YouTube.
- Valutare un dominio personalizzato.
- Tenere la chiave YouTube protetta nelle variabili ambiente del backend.
