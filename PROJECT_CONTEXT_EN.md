# PROJECT_CONTEXT_EN.md

> Context document so any AI or developer can resume the project without extra explanation.
> Last update: July 2, 2026.

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
| **Current status** | Modern UI with scroll-collapsing compact navbar, full-width live search overlay with blurred backdrop, account/playlist dropdowns, email confirmation, password reset, private playlists, and playback-position restore are implemented in code. The registration flow tells users to check spam too and keeps the confirmation message inside the Account panel. Render/Neon/EmailJS variables must be configured to activate auth and playlists in production. |

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
|-- index.html             # UI: navbar, live search overlay, results, player, lyrics, queue, playlist/account dropdowns
|-- styles.css             # Dark music-app theme, responsive layout, themed scrollbars, purposeful animations, UI panels
|-- app.js                 # Frontend: live search, player, auth, sessionStorage, playlists, local queue, lyrics, playback position
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
| `/api/auth/login` | POST | Login with email or username + password |
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
In `users`, `display_name` is free/duplicable, while `username` is unique and can be used for login.

### Auth Security

- Passwords are hashed with `crypto.scrypt`.
- Unique salt per user.
- Server-side `PASSWORD_PEPPER` is required.
- Minimum password length: 8; maximum: 128.
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

The registration response tells users to check their spam folder too. In the frontend, the successful registration message stays in the Account panel and is not copied into the global message above the results.

---

## Frontend

### Layout

- Page title: `Open Music`.
- Larger brand with privacy-friendly system font.
- Search is closed by default and opens from an icon button with animation.
- Full-width live search overlay with blurred backdrop, scrollable row results, and debounced searching while typing.
- Navbar collapses into compact floating controls after scrolling down and restores when scrolling back up.
- Results pane.
- Sidebar with:
  - now playing;
  - lyrics;
  - queue;
  - playlists;
  - account.
- Fixed bottom player.
- Fixed player with themed icons, readable tooltips, and volume support for both native audio and YouTube.
- Themed subtle scrollbars on the page, dropdowns, lyrics, search overlay, and playlist overlay.
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
- `navCollapsed`
- `authMode`
- `sessionToken`
- `user`
- `resetToken`
- `lyrics`
- `youtubeReady`
- `restoredTrackNeedsRefresh`
- `restoredPlaybackTime`

Persistence:

- `localStorage.open-music-player-state`: `currentTrack`, `queue`, and `playbackTime`.
- `sessionStorage.open-music-session`: current session token.

Playlists and account data are not saved in `localStorage`; they come from the backend.

### Initialization Flow

1. Restore queue/player and playback position from `localStorage`.
2. Read optional `?verify=...` or `?reset=...`.
3. Bind event listeners.
4. Initial render.
5. Load YouTube IFrame API.
6. Call `/api/config`.
7. Restore session with `/api/auth/me` if a token exists.
8. For logged-in users with playlist history, run a personalized home search from saved artists/genres; otherwise search `top hits italia`.

### Playlist UI

- Track menu: `Play`, `Add to queue`, `Add to playlist`, `Open source`.
- If not logged in, `Add to playlist` moves the user to login.
- If not logged in, `Nuova` playlist and playlist creation submit are blocked/disabled.
- If logged in but no playlist exists, it opens the new playlist form.
- The playlist dropdown displays the 3 most relevant playlists; the overlay displays the full list and playlist detail.
- If the user is not logged in, the playlist/account prompt follows the active auth tab: `Accedi per salvare playlist private.` or `Registrati per salvare playlist private.`.

### Playback And Lyrics

- Tracks restored from `localStorage` are refreshed through a new search before first playback when possible.
- Playback position is saved during `timeupdate` and after manual seeks; it is restored on native audio after `loadedmetadata` and on YouTube when the player starts.
- Saved position is cleared when it is near the end of the track to avoid resuming at the end.
- Volume uses one shared helper that applies the slider value to both `audio.volume` and `youtubePlayer.setVolume()`.
- Clicking a synced lyric line seeks/resumes playback and immediately updates the active lyric from the clicked timestamp.
- Lyrics auto-scroll is contained inside `.lyrics-box` and no longer uses `scrollIntoView`, preventing whole-page scroll.
- During YouTube ads/intermediate states, pause handling covers `PLAYING`, `BUFFERING`, and `CUED`; if YouTube prevents ad pausing, the app shows a clear explanatory message.

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
- Test live search overlay, compact navbar on scroll, Audius/YouTube volume, playback-position restore after reload, and synced lyric clicks.
- After Neon/EmailJS configuration: registration, email confirmation, login, playlists, password reset.

---

## Latest Verification State

- `npm run check` passed on July 2, 2026 after resolving GitHub issues #7-#21.
- `npm run check` passed on July 2, 2026 after registration/account message refinements.
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
| July 2, 2026 | Codex | Refined auth UX: spam-folder notice on registration, dynamic Login/Register prompt, and confirmation message shown only in the Account panel. |
| July 2, 2026 | Codex | Resolved GitHub issues #7-#21: logged-out playlists, tooltips, personalized home, scrollbars, compact navbar, live search overlay, YouTube ads, lyrics, volume, restored track data, and playback position. |

---

## Next Steps

- Configure Neon, EmailJS, and Render variables.
- Restart local/Render/ngrok backend after deployment.
- Test registration end-to-end from GitHub Pages and Render URL.
- Regenerate `www/` with `npm run build:android-web` if Capacitor needs to be updated.
