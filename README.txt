# Open Music

Music player with a hybrid catalog, lyrics, local queue, private accounts, and persistent playlists.

## Features

- track search through the Node backend on Render
- playback through the YouTube IFrame Player or Audius streams
- lyrics through LRCLIB when available
- local device queue
- accounts with email confirmation
- passwords hashed with `scrypt`, per-user salt, and a server-side pepper
- one-time password reset tokens
- private playlists stored in Neon Postgres
- static frontend compatible with GitHub Pages

## Local Start

```bash
npm install
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

Without `DATABASE_URL`, `PASSWORD_PEPPER`, and EmailJS configured, search and playback still work; account and playlist UI shows that accounts are not configured.

## Simulate The App Online With ngrok

To test the app from a phone or temporarily share it, keep two terminals open.

In the first terminal, start the backend:

```powershell
cd C:\Code\Web\Deezer
npm start
```

Leave this terminal open.

In the second terminal, start ngrok on the same port:

```powershell
ngrok http 4173
```

Ngrok will show a line similar to:

```text
Forwarding  https://something.ngrok-free.dev -> http://localhost:4173
```

Open the `https://...ngrok-free.dev` link from your phone or share it for temporary testing.

Notes:

- if you close `npm start`, the app turns off;
- if you close `ngrok`, the public link stops working;
- with the free ngrok plan, the link can change on every restart;
- if an ngrok warning page appears, press the button to continue to the site.

## Environment

Copy `.env.example` to `.env` and fill the needed values:

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

## Free Neon Setup

1. Go to https://neon.com/.
2. Create a free project.
3. Open `Connection Details`.
4. Copy the pooled connection string.
5. Add it to Render as `DATABASE_URL`.
6. Keep `DATABASE_SSL=true`.

The backend automatically creates `users`, `auth_tokens`, `sessions`, `playlists`, and `playlist_tracks` on first use.

## EmailJS Setup

1. Go to https://www.emailjs.com/.
2. Create or select an email service.
3. Create one account confirmation template.
4. Create one password reset template.
5. Use these variables in both templates:

```text
{{to_email}}
{{display_name}}
{{app_name}}
{{action_url}}
```

6. Put `{{action_url}}` in the email body as the action link.
7. Add these values to Render:

```text
EMAILJS_SERVICE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_VERIFY_TEMPLATE_ID=...
EMAILJS_RESET_TEMPLATE_ID=...
```

## Render + GitHub Pages

Create a Render Web Service connected to the repository.

Settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Recommended Render variables:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=your_youtube_key
DATABASE_URL=your_neon_connection_string
DATABASE_SSL=true
PASSWORD_PEPPER=long_random_string
APP_FRONTEND_URL=https://stefadale.github.io/Music_Player
BACKEND_PUBLIC_URL=https://music-player-2mhu.onrender.com
CORS_ORIGINS=https://stefadale.github.io,https://music-player-2mhu.onrender.com
EMAILJS_SERVICE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_VERIFY_TEMPLATE_ID=...
EMAILJS_RESET_TEMPLATE_ID=...
```

Render sets `PORT` automatically.

In `config.js`, GitHub Pages should point to the backend:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

## Account Security

- Passwords are never stored in plain text.
- The password policy requires at least 15 characters and rejects common or known-breached passwords when Have I Been Pwned responds.
- Session, email verification, and password reset tokens are stored only as hashes in the database.
- Frontend sessions live in `sessionStorage` and are sent with `Authorization: Bearer`.
- Email links expire: 24 hours for account confirmation, 30 minutes for password reset.

## Check

```bash
npm run check
```

## Providers

- YouTube Data API + IFrame Player: searches and plays music videos when the key is configured.
- Audius API: searches and streams tracks without keys.
- LRCLIB API: synchronized lyrics or plain lyrics when available.
