# PROJECT_CONTEXT.md

> Documento di contesto per permettere a qualsiasi IA o sviluppatore di riprendere il progetto senza ulteriori spiegazioni.
> Ultimo aggiornamento: 30 giugno 2026.

---

## Panoramica del progetto

| Campo | Dettaglio |
|---|---|
| **Nome prodotto** | Open Music Player |
| **Repository/workspace** | `C:\Code\Web\Deezer` |
| **Tipo** | Applicazione web musicale con frontend statico, backend Node.js nativo e shell Android Capacitor |
| **Scopo principale** | Offrire un player musicale stile Spotify usando fonti accessibili: YouTube per il catalogo mainstream quando e' disponibile una chiave API, Audius come catalogo gratuito/fallback, LRCLIB per i testi |
| **Frontend produzione** | `https://stefadale.github.io/Music_Player/` |
| **Backend produzione** | `https://music-player-2mhu.onrender.com` |
| **Hosting previsto** | GitHub Pages per il frontend statico, Render per il backend Node.js |
| **Stato attuale** | Funzionante online secondo la configurazione del repository. `config.js` punta al backend Render; il backend espone API JSON, serve anche i file statici in locale/Render, usa `YOUTUBE_API_KEY` solo lato server e permette CORS tramite `CORS_ORIGIN` o `*` come default. |

---

## Tecnologie utilizzate

### Runtime e linguaggi

- **HTML5** per la struttura dell'interfaccia.
- **CSS3** per layout responsive, pannelli, player fisso, menu, tooltip e stati visuali.
- **JavaScript vanilla** nel frontend; non sono presenti framework o bundler.
- **Node.js >= 18** nel backend; serve `fetch` globale e non usa dipendenze npm esterne.
- **HTTP module nativo di Node** per routing API e static file serving.
- **Capacitor** per generare una app Android installabile dal frontend statico.

### API e servizi esterni

- **YouTube Data API v3**: ricerca video musicali quando `YOUTUBE_API_KEY` e' configurata.
- **YouTube IFrame Player API**: riproduzione incorporata dei risultati YouTube.
- **Audius API**: ricerca e redirect streaming dei brani senza chiavi API.
- **LRCLIB API**: ricerca testi sincronizzati o plain lyrics.
- **GitHub Pages**: pubblicazione frontend statico.
- **Render**: esecuzione backend Node.js.
- **ngrok**: citato nei README solo per test temporanei online.

---

## Struttura reale dei file

```text
Deezer/
|-- index.html             # Interfaccia principale: topbar, ricerca, risultati, player, testi, coda/preferiti
|-- styles.css             # Stili responsive e componenti UI; contiene anche CSS residuo non usato per account/profili/playlist
|-- app.js                 # Logica frontend: configurazione API, ricerca, player YouTube/audio, coda, preferiti, testi, localStorage
|-- config.js              # Config globale frontend con URL backend Render per ambienti non-localhost
|-- server.js              # Backend Node.js: API config/search/stream/lyrics + static file serving whitelist
|-- capacitor.config.json  # Config Capacitor per app Android
|-- package.json           # Metadati, script `start` e `check`, requisito Node >=18
|-- package-lock.json      # Lockfile npm generato con le dipendenze Capacitor
|-- scripts/
|   |-- prepare-capacitor.js # Copia gli asset web statici in www/ prima del sync Android
|-- android/               # Progetto Android nativo generato da Capacitor
|-- www/                   # Cartella generata per Capacitor, ignorata da git
|-- README_IT.txt          # Documentazione operativa in italiano
|-- README.txt             # Documentazione operativa in inglese
|-- PROJECT_CONTEXT.md     # Questo documento di contesto in italiano
|-- PROJECT_CONTEXT_EN.md  # Documento di contesto equivalente in inglese
|-- .env.example           # Esempio variabili ambiente senza segreti
|-- .env                   # Variabili locali reali, ignorato da git; non pubblicare
|-- .gitignore             # Esclude .env, node_modules, npm-debug.log*, *.local
|-- assets/
|   |-- open-music-icon.svg # Favicon/brand mark SVG
```

Nota: non esiste `README.md` nel repository attuale. I file README reali sono `README_IT.txt` e `README.txt`.

---

## Configurazione

### Script npm

```bash
npm start   # avvia server.js
npm run check   # node --check app.js && node --check server.js
npm run build:android-web   # rigenera www/ con gli asset web per Capacitor
npm run cap:sync:android   # rigenera www/ e sincronizza il progetto Android
npm run cap:open:android   # sincronizza e apre Android Studio
```

`package.json` ora include le dipendenze Capacitor (`@capacitor/core`, `@capacitor/android`) e la CLI in devDependencies.

### Variabili locali

`.env.example` contiene:

```text
PORT=4173
HOST=127.0.0.1
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=
```

`.env` locale contiene le stesse chiavi ed e' ignorato da git. Non inserire segreti in file tracciati.

### Variabili Render

Configurazione consigliata per Render:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=...
CORS_ORIGIN=https://stefadale.github.io
```

`PORT` viene impostata automaticamente da Render.

### Frontend GitHub Pages

`config.js` attuale:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

`index.html` carica `config.js` prima di `app.js`:

```html
<script src="config.js"></script>
<script src="app.js" defer></script>
```

Nel frontend, `getApiBaseUrl()` usa URL relativo vuoto su `localhost`, `127.0.0.1` e `::1`; negli altri host usa `window.APP_CONFIG.API_BASE_URL` senza slash finale.
In shell native Capacitor (`window.Capacitor` o protocollo `capacitor:`), usa sempre `window.APP_CONFIG.API_BASE_URL`, anche se la WebView espone hostname `localhost`.

### Android APK con Capacitor

- App id: `com.stefadale.openmusicplayer`.
- App name: `Open Music Player`.
- Web dir Capacitor: `www`.
- `www/` e' generata da `scripts/prepare-capacitor.js` copiando `index.html`, `styles.css`, `app.js`, `config.js` e `assets/open-music-icon.svg`.
- Il progetto Android nativo si trova in `android/`.
- Per compilare un APK debug serve JDK 11+ e Android SDK/Android Studio.
- Al momento dell'ultimo tentativo la build si e' fermata per Java 8: Android Gradle Plugin richiede almeno Java 11.

---

## Backend (`server.js`)

### Avvio e statici

- Porta default: `4173`.
- Host default: `127.0.0.1`.
- App Audius default: `OpenMusicPlayer`.
- Root statico: directory del repository.
- File statici serviti in whitelist:
  - `/index.html`
  - `/styles.css`
  - `/app.js`
  - `/config.js`
  - `/assets/open-music-icon.svg`
- `/` viene risolto come `/index.html`.
- Altri percorsi statici restituiscono `404`.
- I file statici e le risposte JSON usano `Cache-Control: no-store`.

### CORS

`setCorsHeaders()` imposta:

```text
Access-Control-Allow-Origin: process.env.CORS_ORIGIN || "*"
Access-Control-Allow-Methods: GET,OPTIONS
Access-Control-Allow-Headers: Content-Type
```

`OPTIONS` risponde con `204`.

### Endpoint API

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/config` | GET | Ritorna stato provider: `provider`, `lyricsProvider`, `configured`, `youtubeConfigured`, `youtubeNeedsApiKey`, `needsApiKey` |
| `/api/search?q=...&limit=24` | GET | Cerca su YouTube se configurato e su Audius; `limit` e' cappato a 50 |
| `/api/stream?id=...` | GET | Redirect `302` allo stream Audius per il track id richiesto |
| `/api/lyrics?track=...&artist=...&duration=...` | GET | Cerca testo su LRCLIB e ritorna plain/synced lyrics se trovate |

### Logica ricerca

- Se `q` e' mancante, ritorna `{ resultCount: 0, results: [] }`.
- YouTube viene usato solo se `YOUTUBE_API_KEY` e' valorizzata.
- YouTube Data API:
  - cerca `type=video`, `videoCategoryId=10`, `order=relevance`;
  - usa `regionCode=IT`, `relevanceLanguage=it`, `videoEmbeddable=true`, `safeSearch=none`;
  - chiede fino a 25 risultati dal search endpoint;
  - poi interroga `/videos` con `snippet,contentDetails,statistics,status`.
- I video YouTube vengono filtrati:
  - embeddable e pubblici;
  - riproducibili in Italia secondo `regionRestriction`;
  - non live;
  - non age restricted;
  - durata tra 45 e 900 secondi.
- I risultati YouTube sono ordinati con scoring locale basato su copertura token, artista/titolo, termini ufficiali, penalita' per lyrics/live non richiesti, cover/tutorial/reaction, Topic channel e play count.
- Se YouTube produce risultati, la risposta miscela fino a circa il 65% YouTube e il resto Audius come backup, entro il `limit`.
- Se YouTube non e' configurato o non produce risultati, la risposta usa Audius.
- La risposta include `youtubeError` quando la ricerca YouTube fallisce.

### Normalizzazione risultati

Risultati **Audius**:

- `id`, `source: "audius"`, `title`, `artist`, `album`, `cover`, `coverBig`, `duration`, `stream`, `link`, `playCount`, `favoriteCount`, `genre`.
- `stream` e' un percorso relativo `/api/stream?id=...`.

Risultati **YouTube**:

- `id: "youtube:<videoId>"`, `source: "youtube"`, `youtubeId`, `title`, `artist`, `album: "YouTube"`, `cover`, `coverBig`, `duration`, `stream: ""`, `link`, `playCount`, `favoriteCount`, `genre: "YouTube"`, `embeddable`.
- `parseYouTubeTitle()` separa artista e titolo usando `" - "` e contiene anche un separatore en dash che nel file appare come possibile artefatto di encoding/mojibake. Da verificare se si interviene sul parsing.

### Lyrics

- Endpoint LRCLIB usato: `https://lrclib.net/api/search`.
- Parametri inviati: `track_name`, `artist_name`.
- Header `User-Agent`: `${AUDIUS_APP_NAME} (local development)`.
- La scelta del match premia titolo, artista, presenza di `syncedLyrics`/`plainLyrics` e durata simile.
- Se non c'e' match, ritorna `{ found: false }`.

---

## Frontend (`index.html`, `app.js`, `styles.css`)

### Layout e UI

- Lingua pagina: `it`.
- Titolo pagina: `Open Music Player`.
- Meta description attuale: player gratuito con Audius, brani completi, testi, coda e preferiti locali.
- Meta robots: `noindex, nofollow`.
- Favicon/brand: `assets/open-music-icon.svg`.
- Sezioni principali:
  - topbar con brand e ricerca;
  - pannello risultati;
  - pannello laterale con now playing, testi, coda/preferiti;
  - player fisso in basso con controlli.
- Il markup non contiene un elemento `#resultCount`; `app.js` lo supporta in modo opzionale e non fallisce se manca.

### Stato frontend

`app.js` mantiene lo stato in memoria:

- `currentTrack`
- `queue`
- `favorites`
- `results`
- `activeTab`
- `isPlaying`
- `serverAvailable`
- `youtubeConfigured`
- `lyrics`
- `youtubeReady`

Persistenza in `localStorage`:

```text
open-music-player-state
```

Campi persistiti:

- `currentTrack`
- `queue`
- `favorites`
- `activeTab`

### Flusso di inizializzazione

1. Ripristina stato da `localStorage`.
2. Collega event listener.
3. Renderizza UI iniziale.
4. Carica la YouTube IFrame API.
5. Chiama `/api/config`.
6. Esegue una ricerca iniziale con query default:

```text
top hits italia
```

Il timeout fetch lato frontend e' `70000` ms.

### Riproduzione

- Audius usa `<audio id="audio">` con sorgente risolta verso `/api/stream`.
- YouTube usa la IFrame Player API caricata dinamicamente da `https://www.youtube.com/iframe_api`.
- I controlli comuni gestiscono play/pausa, precedente, successivo, seek e volume.
- Per YouTube viene mantenuto un timer ogni 500 ms per aggiornare timeline e lyrics attive.
- Errori YouTube 101/150 mostrano un messaggio sul divieto di embed; errore 100 indica video non disponibile/privato.

### Coda, preferiti e testi

- I risultati sono card cliccabili con menu azioni: riproduci, aggiungi alla coda, aggiungi/rimuovi preferito, apri sorgente.
- La coda evita duplicati per `id`.
- I preferiti sono salvati in `localStorage`.
- Le lyrics vengono cercate a ogni brano con `track`, `artist` e `duration`.
- Le lyrics sincronizzate vengono parsate dal formato `[mm:ss.xxx] testo`.
- Cliccare una riga lyrics sincronizzata imposta il tempo audio; al momento la callback scrive sempre su `els.audio.currentTime`, quindi per YouTube il seek da riga lyrics non usa `youtubePlayer.seekTo`.

### CSS e responsive

- Tema scuro con accenti rosso, verde e giallo.
- Layout desktop: risultati + sidebar.
- Breakpoint principali: `1040px`, `760px`, `420px`.
- Il player fisso nasconde volume sotto `1040px` e si compatta su mobile.
- Tooltip basati su `data-tooltip`.
- CSS residuo presente ma non collegato al markup attuale:
  - `.account`, `.account-button`, `.profile`
  - `.library-toolbar`
  - `.playlist-list`, `.playlist-item`, `.playlist-title`, `.playlist-meta`

---

## Funzionalita implementate

- Ricerca brani via backend.
- Catalogo YouTube quando `YOUTUBE_API_KEY` e' configurata.
- Fallback/backup Audius senza chiavi API.
- Riproduzione YouTube tramite IFrame Player API.
- Riproduzione Audius tramite redirect stream backend.
- Coda di riproduzione.
- Preferiti locali.
- Link alla sorgente del brano.
- Artwork, durata, conteggio ascolti/visualizzazioni quando disponibili.
- Testi LRCLIB plain o sincronizzati.
- Evidenziazione della riga lyrics attiva durante la riproduzione.
- UI responsive desktop/mobile.
- Deploy previsto GitHub Pages + Render.
- Meta `robots` `noindex, nofollow`.

---

## Limiti e note tecniche

- Non offre il catalogo commerciale completo di Spotify; usa YouTube/Audius entro i limiti legali e tecnici dei rispettivi servizi.
- La chiave YouTube deve restare solo nel backend.
- GitHub Pages ospita solo frontend statico; il backend Node deve stare su Render o servizio equivalente.
- Render puo' servire anche `index.html`, ma il link pubblico principale documentato resta GitHub Pages.
- `CORS_ORIGIN` in produzione deve essere impostato all'origine GitHub Pages, ad esempio `https://stefadale.github.io`.
- Se il backend non risponde, il frontend mostra messaggi diversi per file locale, localhost e backend remoto.
- `README.txt` e `README_IT.txt` sono documentazione operativa; questi due `PROJECT_CONTEXT*` sono il contesto completo per ripresa lavori.
- Il working tree al momento dell'audit aveva modifiche non nostre nei README: rimozione del riferimento specifico a "Fabri Fibra" nella sezione YouTube.

---

## Verifica e manutenzione

Comandi utili:

```bash
npm run check
npm start
```

Controlli manuali consigliati dopo modifiche funzionali:

- Aprire `http://127.0.0.1:4173`.
- Verificare `/api/config`.
- Cercare un artista mainstream con e senza `YOUTUBE_API_KEY`.
- Riprodurre un risultato YouTube e uno Audius.
- Verificare coda, preferiti, reload pagina e `localStorage`.
- Verificare lyrics plain/synced e stato "testo non trovato".
- Testare mobile stretto e desktop.

---

## Tracciamento IA

| Data | Modello IA | Attivita |
|---|---|---|
| 29 giugno 2026 | Codex | Creazione dell'app musicale, configurazione YouTube/Audius/LRCLIB, supporto backend Node.js, responsive UI, pubblicazione con GitHub Pages + Render e documentazione operativa. |
| 29 giugno 2026 | Codex | Aggiunta meta `noindex,nofollow`, copia del README italiano, traduzione inglese e generazione dei documenti di contesto IT/EN. |
| 30 giugno 2026 | Codex | Audit completo del repository e riallineamento dei documenti di contesto IT/EN con struttura reale, endpoint, configurazione, frontend, backend, limiti e debito tecnico osservato. |

---

## Prossimi passi consigliati

- Correggere o confermare l'artefatto di encoding/mojibake nel separatore en dash di `parseYouTubeTitle()`.
- Decidere se reinserire un elemento visibile `#resultCount` oppure rimuovere la logica opzionale da `app.js`.
- Rimuovere CSS residuo per account/profili/playlist se non previsto a breve.
- Far usare `youtubePlayer.seekTo()` quando si clicca una riga lyrics sincronizzata di un brano YouTube.
- Migliorare ranking e deduplicazione tra risultati YouTube e Audius.
- Valutare un dominio personalizzato.
