# PROJECT_CONTEXT.md

> Documento di contesto per permettere a qualsiasi IA o sviluppatore di riprendere il progetto senza ulteriori spiegazioni.
> Ultimo aggiornamento: 2 luglio 2026.

---

## Panoramica

| Campo | Dettaglio |
|---|---|
| **Nome prodotto** | Open Music |
| **Workspace** | `C:\Code\Web\Deezer` |
| **Tipo** | Applicazione web musicale con frontend statico, backend Node.js nativo, Neon Postgres per account/playlist e shell Android Capacitor |
| **Frontend produzione** | `https://stefadale.github.io/Music_Player/` |
| **Backend produzione** | `https://music-player-2mhu.onrender.com` |
| **Hosting** | GitHub Pages per frontend statico; Render per backend Node; Neon per database Postgres |
| **Stato attuale** | UI modernizzata con navbar, ricerca espandibile da icona, dropdown account/playlist, conferma email, reset password e playlist private implementati nel codice. Il flusso registrazione invita a controllare anche lo spam e mantiene il messaggio nel pannello Account. Serve configurare variabili Render/Neon/EmailJS per attivare auth e playlist in produzione. |

---

## Tecnologie

- **HTML/CSS/JavaScript vanilla**: nessun framework frontend o bundler.
- **Node.js >= 18**: backend HTTP nativo con `fetch` globale.
- **Postgres via `pg`**: connessione a Neon usando `DATABASE_URL`.
- **Capacitor**: shell Android, web assets generati in `www/`.
- **Servizi esterni**:
  - YouTube Data API v3 e YouTube IFrame Player API.
  - Audius API.
  - LRCLIB API.
  - EmailJS REST API, usata solo lato server.
  - Have I Been Pwned password range API, best effort per bloccare password compromesse.

---

## Struttura File

```text
Deezer/
|-- index.html             # UI: navbar, ricerca espandibile, risultati, player, testi, coda, dropdown playlist/account
|-- styles.css             # Tema music app dark, responsive, animazioni mirate e pannelli UI
|-- app.js                 # Frontend: ricerca, player, auth, sessionStorage, playlist, coda locale, lyrics
|-- config.js              # API_BASE_URL per frontend non-localhost
|-- server.js              # Backend: statici, ricerca, stream, lyrics, auth, EmailJS, playlist
|-- package.json           # Script npm e dipendenze, incluso `pg`
|-- package-lock.json      # Lockfile npm
|-- .env.example           # Variabili ambiente senza segreti
|-- README_IT.txt          # Setup operativo in italiano
|-- README.txt             # Setup operativo in inglese
|-- PROJECT_CONTEXT.md     # Questo contesto
|-- PROJECT_CONTEXT_EN.md  # Contesto equivalente inglese
|-- scripts/prepare-capacitor.js
|-- assets/open-music-icon.svg
|-- android/
|-- www/                   # Generata, ignorata da git
```

`.env` e' ignorato da git e non deve essere pubblicato.

---

## Configurazione

### Script npm

```bash
npm start
npm run check
npm run build:android-web
npm run cap:sync:android
npm run cap:open:android
```

`npm run check` esegue:

```text
node --check app.js && node --check server.js && node --check scripts/prepare-capacitor.js
```

### Variabili Ambiente

`.env.example` contiene:

```text
PORT=4173
HOST=127.0.0.1
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=
DATABASE_URL=
DATABASE_SSL=true
PASSWORD_PEPPER=
APP_FRONTEND_URL=http://127.0.0.1:4173
BACKEND_PUBLIC_URL=http://127.0.0.1:4173
CORS_ORIGINS=http://127.0.0.1:4173,http://localhost:4173
EMAILJS_SERVICE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
EMAILJS_VERIFY_TEMPLATE_ID=
EMAILJS_RESET_TEMPLATE_ID=
```

Su Render usare:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=...
DATABASE_URL=...
DATABASE_SSL=true
PASSWORD_PEPPER=...
APP_FRONTEND_URL=https://stefadale.github.io/Music_Player
BACKEND_PUBLIC_URL=https://music-player-2mhu.onrender.com
CORS_ORIGINS=https://stefadale.github.io,https://music-player-2mhu.onrender.com
EMAILJS_SERVICE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_VERIFY_TEMPLATE_ID=...
EMAILJS_RESET_TEMPLATE_ID=...
```

`config.js` punta al backend Render:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

Il frontend usa URL relativi su `localhost`, `127.0.0.1`, `::1`; fuori da locale usa `window.APP_CONFIG.API_BASE_URL`.

---

## Backend

### Statici

`server.js` serve solo file whitelistati:

- `/index.html`
- `/styles.css`
- `/app.js`
- `/config.js`
- `/assets/open-music-icon.svg`

### CORS

`setCorsHeaders(req, res)` supporta `CORS_ORIGINS` separato da virgole. Se nessuna origine e' configurata, usa `*`. Metodi consentiti:

```text
GET,POST,PATCH,DELETE,OPTIONS
```

Header consentiti:

```text
Content-Type, Authorization
```

### Endpoint Musica

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/config` | GET | Stato provider, YouTube, account ed EmailJS |
| `/api/search?q=...&limit=24` | GET | Cerca YouTube se configurato e Audius come backup |
| `/api/stream?id=...` | GET | Redirect allo stream Audius |
| `/api/lyrics?track=...&artist=...&duration=...` | GET | Cerca testi LRCLIB |

`/api/config` ora include anche:

```json
{
  "accountsConfigured": true,
  "emailConfigured": true
}
```

### Endpoint Auth

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/auth/register` | POST | Crea utente e invia email conferma |
| `/api/auth/verify?token=...` | GET | Conferma account |
| `/api/auth/login` | POST | Login con email o username + password |
| `/api/auth/logout` | POST | Elimina sessione corrente |
| `/api/auth/me` | GET | Utente corrente |
| `/api/auth/password/forgot` | POST | Invia link reset con risposta generica |
| `/api/auth/password/reset` | POST | Aggiorna password e invalida sessioni |

Le sessioni usano token opachi inviati dal frontend con:

```text
Authorization: Bearer <token>
```

### Endpoint Playlist

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/playlists` | GET | Lista playlist utente |
| `/api/playlists` | POST | Crea playlist |
| `/api/playlists/:id` | PATCH | Rinomina playlist |
| `/api/playlists/:id` | DELETE | Elimina playlist |
| `/api/playlists/:id/tracks` | POST | Aggiunge brano |
| `/api/playlists/:id/tracks/:trackEntryId` | DELETE | Rimuove brano |

### Database

Con `DATABASE_URL` configurato, il backend crea automaticamente:

- `users`
- `auth_tokens`
- `sessions`
- `playlists`
- `playlist_tracks`

Le playlist sono private e legate a `user_id`.
In `users`, `display_name` e' il nome libero/duplicabile, mentre `username` e' unico e usabile per il login.

### Sicurezza Auth

- Password hashate con `crypto.scrypt`.
- Salt unico per utente.
- `PASSWORD_PEPPER` obbligatorio lato server.
- Password minime: 8 caratteri; max 128.
- Blocco password comuni locale.
- Check Have I Been Pwned k-anonymity best effort.
- Token verifica/reset/sessione salvati solo come hash SHA-256.
- Verifica account: token monouso con scadenza 24 ore.
- Reset password: token monouso con scadenza 30 minuti.
- Login bloccato finche' `email_verified_at` e' nullo.

### EmailJS

EmailJS e' usato solo da `server.js`, mai dal browser. Template params richiesti:

```text
to_email
display_name
app_name
action_url
```

Se EmailJS non e' configurato, registrazione e reset password rispondono `503` e non creano flussi incompleti.

La risposta di registrazione dice all'utente di controllare anche la cartella spam. Nel frontend il messaggio di registrazione riuscita resta nel pannello Account e non viene copiato nel messaggio globale sopra i risultati.

---

## Frontend

### Layout

- Titolo pagina: `Open Music`.
- Brand piu' grande con font di sistema privacy-friendly.
- Ricerca chiusa di default, apertura da pulsante icona con animazione.
- Pannello risultati.
- Sidebar con:
  - now playing;
  - lyrics;
  - coda;
  - playlist;
  - account.
- Player fisso in basso.
- Rimossi testi utente `YouTube / Audius` e tab `Preferiti`.

### Stato Frontend

In memoria:

- `currentTrack`
- `queue`
- `playlists`
- `selectedTrackForPlaylist`
- `results`
- `isPlaying`
- `serverAvailable`
- `accountsConfigured`
- `youtubeConfigured`
- `searchOpen`
- `authMode`
- `sessionToken`
- `user`
- `resetToken`
- `lyrics`
- `youtubeReady`

Persistenza:

- `localStorage.open-music-player-state`: solo `currentTrack` e `queue`.
- `sessionStorage.open-music-session`: token sessione corrente.

Playlist e account non vengono salvati in `localStorage`; arrivano dal backend.

### Flusso Iniziale

1. Ripristina coda/player da `localStorage`.
2. Legge eventuali `?verify=...` o `?reset=...`.
3. Collega event listener.
4. Render iniziale.
5. Carica YouTube IFrame API.
6. Chiama `/api/config`.
7. Ripristina sessione con `/api/auth/me` se il token esiste.
8. Cerca `top hits italia`.

### Playlist UI

- Menu traccia: `Riproduci`, `Aggiungi alla coda`, `Aggiungi a playlist`, `Apri sorgente`.
- Se non loggato, `Aggiungi a playlist` porta al login.
- Se loggato ma senza playlist, apre il form nuova playlist.
- Il dropdown playlist mostra le 4 playlist piu' recenti; l'overlay mostra lista completa e dettaglio playlist.
- Se l'utente non e' loggato, il prompt playlist/account cambia in base alla tab auth: `Accedi per salvare playlist private.` oppure `Registrati per salvare playlist private.`.

---

## Verifica

Comandi:

```bash
npm run check
npm start
```

Controlli manuali:

- Aprire `http://127.0.0.1:4173`.
- Verificare `http://127.0.0.1:4173/api/config`.
- Controllare che `/api/config` includa `accountsConfigured` ed `emailConfigured` dopo restart del server.
- Provare ricerca, riproduzione, coda, lyrics.
- Dopo configurazione Neon/EmailJS: registrazione, conferma email, login, playlist, reset password.

---

## Stato Verifiche Ultime

- `npm run check` passato il 2 luglio 2026 dopo le rifiniture ai messaggi di registrazione/account.
- `npm run check` passato dopo implementazione auth/playlist/UI.
- Verifica HTTP temporanea su porta alternativa ha risposto con i nuovi campi:

```json
{"accountsConfigured":false,"emailConfigured":false}
```

- `localhost:4173` al momento del controllo rispondeva ancora senza i nuovi campi, quindi il processo Node/ngrok attivo va riavviato o lasciato aggiornare dal watcher.

---

## Tracciamento IA

| Data | Modello IA | Attivita |
|---|---|---|
| 29 giugno 2026 | Codex | Creazione app musicale, YouTube/Audius/LRCLIB, backend Node, responsive UI, GitHub Pages + Render e documentazione. |
| 29 giugno 2026 | Codex | Aggiunta meta `noindex,nofollow`, README IT/EN e documenti contesto IT/EN. |
| 30 giugno 2026 | Codex | Audit repository e riallineamento contesti con struttura reale. |
| 30 giugno 2026 | Codex | Fix issue #1-#6: mobile player, parsing YouTube, seek lyrics, conteggio risultati, pulizia CSS, deduplicazione. |
| 30 giugno 2026 | Codex | Modernizzazione UI, ricerca animata, account, password hashate, EmailJS, Neon Postgres e playlist private. |
| 2 luglio 2026 | Codex | Rifiniture UX auth: avviso cartella spam nella registrazione, prompt Accedi/Registrati dinamico e messaggio di conferma mostrato solo nel pannello Account. |

---

## Prossimi Passi

- Configurare Neon, EmailJS e variabili Render.
- Riavviare backend Render/local/ngrok dopo deploy.
- Testare registrazione end-to-end da GitHub Pages e dall'URL Render.
- Rigenerare `www/` con `npm run build:android-web` se serve aggiornare Capacitor.
