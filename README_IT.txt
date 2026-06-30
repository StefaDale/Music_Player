# Open Music Player

Player musicale con catalogo ibrido: YouTube per artisti mainstream, Audius come catalogo gratuito/open e testi da LRCLIB.

## Cosa include

- ricerca brani su YouTube quando `YOUTUBE_API_KEY` e' configurata
- fallback su Audius senza chiavi API
- riproduzione tramite YouTube IFrame Player o stream Audius
- player con play, pausa, avanti, indietro, seek e volume
- coda di riproduzione
- preferiti locali salvati in `localStorage`
- artwork, durata, contatore ascolti e link alla sorgente
- testi via LRCLIB, con sincronizzazione quando disponibile

## Limite importante

Non puo' avere il catalogo commerciale completo di Spotify gratis e legalmente: quello richiede licenze e API ufficiali con account, abbonamenti o accordi commerciali. Per artisti come Fabri Fibra, la strada gratuita piu' realistica e' YouTube: si cercano video ufficiali o caricamenti disponibili e si riproducono nel player incorporato ufficiale.

## YouTube per il catalogo mainstream

Per cercare artisti commerciali dentro l'app serve una chiave gratuita della YouTube Data API:

1. Vai su https://console.cloud.google.com/.
2. Crea o seleziona un progetto.
3. Abilita `YouTube Data API v3`.
4. Crea una API key.
5. Inseriscila in `.env`:

```text
YOUTUBE_API_KEY=la_tua_chiave
```

La chiave resta nel backend locale e non viene esposta nel frontend.

## Avvio

```bash
npm start
```

Poi apri:

```text
http://127.0.0.1:4173
```

## Simulare l'app online con ngrok

Per provare l'app da telefono o condividerla temporaneamente come se fosse online, devi tenere aperti due terminali.

Nel primo terminale avvia il server Node:

```powershell
cd C:\Code\Web\Deezer
npm start
```

Lascia questa finestra aperta.

Nel secondo terminale avvia ngrok sulla stessa porta:

```powershell
ngrok http 4173
```

Ngrok mostrera' una riga simile a questa:

```text
Forwarding  https://qualcosa.ngrok-free.dev -> http://localhost:4173
```

Il link `https://...ngrok-free.dev` e' l'indirizzo pubblico temporaneo da aprire anche dal telefono.

Note:

- se chiudi `npm start`, l'app si spegne;
- se chiudi `ngrok`, il link pubblico smette di funzionare;
- con il piano gratuito di ngrok il link puo' cambiare a ogni riavvio;
- se compare una pagina di avviso ngrok, premi il pulsante per continuare verso il sito.

## Pubblicazione con GitHub Pages + backend

GitHub Pages puo' pubblicare solo il frontend statico. Il backend Node (`server.js`) deve stare su un servizio online separato, per esempio Render, Railway o Fly.io.

Consiglio iniziale: Render, perche' questa app puo' partire direttamente con `npm start` e usare le variabili ambiente dal pannello.

### 1. Pubblica il codice su GitHub

Assicurati di non caricare `.env`: il file e' gia' escluso da `.gitignore`.

### 2. Crea il backend su Render

Su Render crea un nuovo Web Service collegato al repository GitHub.

Impostazioni:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Variabili ambiente da inserire nel pannello Render:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=la_tua_chiave_youtube
CORS_ORIGIN=https://tuo-utente.github.io
```

Render imposta `PORT` automaticamente, quindi non serve aggiungerla.

Alla fine Render ti dara' un URL tipo:

```text
https://nome-app.onrender.com
```

### 3. Collega GitHub Pages al backend

Apri `config.js` e imposta l'URL del backend:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://nome-app.onrender.com",
};
```

Poi pubblica il frontend con GitHub Pages dalla branch principale.

### 4. Imposta GitHub Pages

Nel repository GitHub vai in:

```text
Settings -> Pages
```

Scegli:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

Il sito sara' disponibile a un indirizzo simile:

```text
https://tuo-utente.github.io/nome-repository/
```

Il file `.env` e' opzionale:

```text
PORT=4173
HOST=127.0.0.1
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=
```

## Provider

- YouTube Data API + IFrame Player: ricerca e riproduzione dei video musicali quando la chiave e' configurata.
- Audius API: ricerca e streaming dei brani senza chiavi.
- LRCLIB API: testi sincronizzati o plain lyrics quando disponibili.

Documentazione:

- https://developers.google.com/youtube/v3
- https://developers.google.com/youtube/iframe_api_reference
- https://docs.audius.org/
- https://lrclib.net/docs
