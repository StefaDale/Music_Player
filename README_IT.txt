# Open Music

Player musicale con catalogo ibrido, testi, coda locale, account privato e playlist persistenti.

## Cosa include

- ricerca brani tramite backend Node su Render
- riproduzione tramite YouTube IFrame Player o stream Audius
- testi via LRCLIB quando disponibili
- coda locale del dispositivo
- account con email confermata
- password hashate con `scrypt`, salt per utente e pepper lato server
- reset password con token monouso
- playlist private salvate su Neon Postgres
- frontend statico compatibile con GitHub Pages

## Avvio locale

```bash
npm install
npm start
```

Poi apri:

```text
http://127.0.0.1:4173
```

Senza `DATABASE_URL`, `PASSWORD_PEPPER` ed EmailJS configurati, ricerca e player funzionano comunque; account e playlist mostrano lo stato non configurato.

## Simulare l'app online con ngrok

Per provare l'app da telefono o condividerla temporaneamente, tieni aperti due terminali.

Nel primo terminale avvia il backend:

```powershell
cd C:\Code\Web\Deezer
npm start
```

Lascia questo terminale aperto.

Nel secondo terminale avvia ngrok sulla stessa porta:

```powershell
ngrok http 4173
```

Ngrok mostrera' una riga simile a:

```text
Forwarding  https://qualcosa.ngrok-free.dev -> http://localhost:4173
```

Apri il link `https://...ngrok-free.dev` dal telefono o condividilo per test temporanei.

Note:

- se chiudi `npm start`, l'app si spegne;
- se chiudi `ngrok`, il link pubblico smette di funzionare;
- con il piano gratuito di ngrok il link puo' cambiare a ogni riavvio;
- se compare una pagina di avviso ngrok, premi il pulsante per continuare verso il sito.

## Variabili ambiente locali

Copia `.env.example` in `.env` e compila i valori necessari:

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

## Setup Neon gratuito

1. Vai su https://neon.com/.
2. Crea un progetto gratuito.
3. Apri `Connection Details`.
4. Copia la pooled connection string.
5. Inseriscila come `DATABASE_URL` su Render.
6. Lascia `DATABASE_SSL=true`.

Il backend crea automaticamente le tabelle `users`, `auth_tokens`, `sessions`, `playlists` e `playlist_tracks` al primo uso.

## Setup EmailJS

1. Vai su https://www.emailjs.com/.
2. Crea o seleziona un servizio email.
3. Crea un template per conferma account.
4. Crea un template per reset password.
5. In entrambi i template usa queste variabili:

```text
{{to_email}}
{{display_name}}
{{app_name}}
{{action_url}}
```

6. Nel testo email metti il link usando `{{action_url}}`.
7. Copia in Render:

```text
EMAILJS_SERVICE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_VERIFY_TEMPLATE_ID=...
EMAILJS_RESET_TEMPLATE_ID=...
```

## Render + GitHub Pages

Su Render crea un Web Service collegato alla repository.

Impostazioni:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Variabili Render consigliate:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=la_tua_chiave_youtube
DATABASE_URL=la_connection_string_neon
DATABASE_SSL=true
PASSWORD_PEPPER=stringa_lunga_casuale
APP_FRONTEND_URL=https://stefadale.github.io/Music_Player
BACKEND_PUBLIC_URL=https://music-player-2mhu.onrender.com
CORS_ORIGINS=https://stefadale.github.io,https://music-player-2mhu.onrender.com
EMAILJS_SERVICE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_VERIFY_TEMPLATE_ID=...
EMAILJS_RESET_TEMPLATE_ID=...
```

Render imposta `PORT` automaticamente.

In `config.js`, il frontend GitHub Pages deve puntare al backend:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

## Sicurezza account

- Le password non vengono mai salvate in chiaro.
- La policy richiede almeno 15 caratteri e rifiuta password comuni o presenti in violazioni note quando Have I Been Pwned risponde.
- I token di sessione, verifica email e reset password sono salvati solo hashati nel database.
- Le sessioni frontend sono in `sessionStorage` e vengono inviate con `Authorization: Bearer`.
- I link email scadono: 24 ore per conferma account, 30 minuti per reset password.

## Check

```bash
npm run check
```

## Provider

- YouTube Data API + IFrame Player: ricerca e riproduzione dei video musicali quando la chiave e' configurata.
- Audius API: ricerca e streaming dei brani senza chiavi.
- LRCLIB API: testi sincronizzati o plain lyrics quando disponibili.
