# PROJECT_CONTEXT_EN.md

> Context document so any AI or developer can resume the project without extra explanation.
> Last update: June 30, 2026.

---

## Overview

| Field | Detail |
|---|---|
| **Product name** | Open Music |
| **Workspace** | `C:\Code\Web\Deezer` |
| **Type** | Music web app with static frontend, native Node.js backend, Neon Postgres for accounts/playlists, and Capacitor Android shell |
| **Production frontend** | `https://stefadale.github.io/Music_Player/` |
| **Production backend** | `https://music-player-2mhu.onrender.com` |
| **Hosting** | GitHub Pages for static frontend; Render for Node backend; Neon for Postgres database |
| **Current status** | Modern UI, icon-expanded search, accounts, email confirmation, password reset, and private playlists are implemented in code. Render/Neon/EmailJS variables must be configured to activate auth and playlists in production. |

---

## Technologies

- **HTML/CSS/vanilla JavaScript**: no frontend framework or bundler.
- **Node.js >= 18**: native HTTP backend with global `fetch`.
- **Postgres through `pg`**: Neon connection through `DATABASE_URL`.
- **Capacitor**: Android shell, web assets generated into `www/`.
- **External services**:
  - YouTube Data API v3 and YouTube IFrame Player API.
  - Audius API.
  - LRCLIB API.
  - EmailJS REST API, used server-side only.
  - Have I Been Pwned password range API, best effort for breached-password blocking.

---

## File Structure

```text
Deezer/
|-- index.html             # UI: topbar, expandable search, results, player, lyrics, queue, playlists, account
|-- styles.css             # Dark music-app theme, responsive layout, purposeful animations, UI panels
|-- app.js                 # Frontend: search, player, auth, sessionStorage, playlists, local queue, lyrics
|-- config.js              # API_BASE_URL for non-localhost frontend environments
|-- server.js              # Backend: static files, search, stream, lyrics, auth, EmailJS, playlists
|-- package.json           # npm scripts and dependencies, including `pg`
|-- package-lock.json      # npm lockfile
|-- .env.example           # Environment variables without secrets
|-- README_IT.txt          # Italian operational setup
|-- README.txt             # English operational setup
|-- PROJECT_CONTEXT.md     # Italian context
|-- PROJECT_CONTEXT_EN.md  # This context
|-- scripts/prepare-capacitor.js
|-- assets/open-music-icon.svg
|-- android/
|-- www/                   # Generated, git-ignored
```

`.env` is git-ignored and must not be published.

---

## Configuration

### npm Scripts

```bash
npm start
npm run check
npm run build:android-web
npm run cap:sync:android
npm run cap:open:android
```

`npm run check` runs:

```text
node --check app.js && node --check server.js && node --check scripts/prepare-capacitor.js
```

### Environment Variables

`.env.example` contains:

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

Use these values on Render:

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

`config.js` points to the Render backend:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

The frontend uses relative URLs on `localhost`, `127.0.0.1`, and `::1`; outside local environments it uses `window.APP_CONFIG.API_BASE_URL`.

---

## Backend

### Static Files

`server.js` serves only whitelisted files:

- `/index.html`
- `/styles.css`
- `/app.js`
- `/config.js`
- `/assets/open-music-icon.svg`

### CORS

`setCorsHeaders(req, res)` supports comma-separated `CORS_ORIGINS`. If no origin is configured, it uses `*`. Allowed methods:

```text
GET,POST,PATCH,DELETE,OPTIONS
```

Allowed headers:

```text
Content-Type, Authorization
```

### Music Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/config` | GET | Provider, YouTube, account, and EmailJS state |
| `/api/search?q=...&limit=24` | GET | Searches YouTube when configured and Audius as backup |
| `/api/stream?id=...` | GET | Redirects to Audius stream |
| `/api/lyrics?track=...&artist=...&duration=...` | GET | Searches LRCLIB lyrics |

`/api/config` now also includes:

```json
{
  "accountsConfigured": true,
  "emailConfigured": true
}
```

### Auth Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Creates user and sends confirmation email |
| `/api/auth/verify?token=...` | GET | Confirms account |
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/logout` | POST | Deletes current session |
| `/api/auth/me` | GET | Current user |
| `/api/auth/password/forgot` | POST | Sends reset link with generic response |
| `/api/auth/password/reset` | POST | Updates password and invalidates sessions |

Sessions use opaque tokens sent by the frontend with:

```text
Authorization: Bearer <token>
```

### Playlist Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/playlists` | GET | Lists user's playlists |
| `/api/playlists` | POST | Creates playlist |
| `/api/playlists/:id` | PATCH | Renames playlist |
| `/api/playlists/:id` | DELETE | Deletes playlist |
| `/api/playlists/:id/tracks` | POST | Adds track |
| `/api/playlists/:id/tracks/:trackEntryId` | DELETE | Removes track |

### Database

With `DATABASE_URL` configured, the backend automatically creates:

- `users`
- `auth_tokens`
- `sessions`
- `playlists`
- `playlist_tracks`

Playlists are private and linked to `user_id`.

### Auth Security

- Passwords are hashed with `crypto.scrypt`.
- Unique salt per user.
- Server-side `PASSWORD_PEPPER` is required.
- Minimum password length: 15; maximum: 128.
- Local common-password blocklist.
- Best-effort Have I Been Pwned k-anonymity check.
- Verification, reset, and session tokens are stored only as SHA-256 hashes.
- Account verification token: one-time, 24-hour expiration.
- Password reset token: one-time, 30-minute expiration.
- Login is blocked while `email_verified_at` is null.

### EmailJS

EmailJS is used only by `server.js`, never in the browser. Required template params:

```text
to_email
display_name
app_name
action_url
```

If EmailJS is not configured, registration and password reset return `503` and do not create incomplete flows.

---

## Frontend

### Layout

- Page title: `Open Music`.
- Larger brand with privacy-friendly system font.
- Search is closed by default and opens from an icon button with animation.
- Results pane.
- Sidebar with:
  - now playing;
  - lyrics;
  - queue;
  - playlists;
  - account.
- Fixed bottom player.
- User-facing `YouTube / Audius` text and `Favorites` tab were removed.

### Frontend State

In memory:

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

Persistence:

- `localStorage.open-music-player-state`: only `currentTrack` and `queue`.
- `sessionStorage.open-music-session`: current session token.

Playlists and account data are not saved in `localStorage`; they come from the backend.

### Initialization Flow

1. Restore queue/player from `localStorage`.
2. Read optional `?verify=...` or `?reset=...`.
3. Bind event listeners.
4. Initial render.
5. Load YouTube IFrame API.
6. Call `/api/config`.
7. Restore session with `/api/auth/me` if a token exists.
8. Search `top hits italia`.

### Playlist UI

- Track menu: `Play`, `Add to queue`, `Add to playlist`, `Open source`.
- If not logged in, `Add to playlist` moves the user to login.
- If logged in but no playlist exists, it opens the new playlist form.
- The playlist panel displays up to 6 tracks per playlist.

---

## Verification

Commands:

```bash
npm run check
npm start
```

Manual checks:

- Open `http://127.0.0.1:4173`.
- Verify `http://127.0.0.1:4173/api/config`.
- Check that `/api/config` includes `accountsConfigured` and `emailConfigured` after restarting the server.
- Test search, playback, queue, lyrics.
- After Neon/EmailJS configuration: registration, email confirmation, login, playlists, password reset.

---

## Latest Verification State

- `npm run check` passed after auth/playlist/UI implementation.
- A temporary HTTP verification on an alternate port returned the new fields:

```json
{"accountsConfigured":false,"emailConfigured":false}
```

- At the time of checking, `localhost:4173` still answered without the new fields, so the active Node/ngrok process must be restarted or allowed to update through the watcher.

---

## AI Tracking

| Date | AI Model | Activity |
|---|---|---|
| June 29, 2026 | Codex | Created the music app, YouTube/Audius/LRCLIB, Node backend, responsive UI, GitHub Pages + Render, and documentation. |
| June 29, 2026 | Codex | Added `noindex,nofollow`, README IT/EN, and context documents IT/EN. |
| June 30, 2026 | Codex | Audited repository and realigned context files with actual structure. |
| June 30, 2026 | Codex | Fixed issues #1-#6: mobile player, YouTube parsing, lyric seeking, result count, CSS cleanup, deduplication. |
| June 30, 2026 | Codex | Modernized UI, animated search, accounts, hashed passwords, EmailJS, Neon Postgres, and private playlists. |

---

## Next Steps

- Configure Neon, EmailJS, and Render variables.
- Restart local/Render/ngrok backend after deployment.
- Test registration end-to-end from GitHub Pages and Render URL.
- Regenerate `www/` with `npm run build:android-web` if Capacitor needs to be updated.
