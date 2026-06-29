# PROJECT_CONTEXT_EN.md

> Context document to allow any AI or developer to resume the project without extra explanation. Last update: June 2026.

---

## Project Overview

| Field | Detail |
|---|---|
| **Name** | Open Music Player |
| **Type** | Music web application with a static frontend and a Node.js backend |
| **Main purpose** | Provide a Spotify-like experience using accessible sources: YouTube for mainstream music, Audius as a free fallback, and LRCLIB for lyrics |
| **Production frontend** | `https://stefadale.github.io/Music_Player/` |
| **Production backend** | `https://music-player-2mhu.onrender.com` |
| **Hosting** | GitHub Pages for the frontend, Render for the backend |
| **Current status** | Working online. The GitHub Pages frontend calls the Render backend through `config.js`; Render exposes the APIs, uses the YouTube key as an environment variable, and enables CORS for `https://stefadale.github.io`. |

---

## Technologies Used

### Languages

- **HTML5** for the application structure
- **CSS3** for responsive layout, player UI, panels, and visual states
- **Vanilla JavaScript** for interactions, search, player logic, queue, favorites, and lyrics
- **Node.js** for the HTTP backend without external frameworks

### APIs And External Services

- **YouTube Data API v3** to search mainstream music videos
- **YouTube IFrame Player API** to play videos in the frontend
- **Audius API** for fallback search and streaming
- **LRCLIB API** for synchronized or plain lyrics
- **GitHub Pages** to publish the static frontend
- **Render** to run the Node.js backend
- **ngrok** used only for temporary online simulation and testing

---

## File Structure

```text
Deezer/
|-- index.html          # Main app interface
|-- styles.css          # Responsive styles and player layout
|-- app.js              # Frontend logic, player, search, queue, favorites, and lyrics
|-- config.js           # Backend URL used when the frontend runs on GitHub Pages
|-- server.js           # Node.js backend with search/config/lyrics/stream APIs
|-- package.json        # npm scripts and required Node version
|-- README.md           # Original Italian documentation
|-- README_IT.txt       # Text copy of the Italian README
|-- README.txt          # English README
|-- PROJECT_CONTEXT.md  # Italian context document
|-- PROJECT_CONTEXT_EN.md # This English context document
|-- .env.example        # Example environment variables without secrets
|-- .gitignore          # Excludes .env
```

---

## Important Configuration

### Local

The local `.env` file may contain:

```text
PORT=4173
HOST=127.0.0.1
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=
```

The `.env` file must not be uploaded to GitHub.

### Render Production

Expected Render environment variables:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=...
CORS_ORIGIN=https://stefadale.github.io
```

`PORT` is set automatically by Render.

### GitHub Pages Frontend

`config.js` must point to the Render backend:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://music-player-2mhu.onrender.com",
};
```

---

## Implemented Features

- Track search through the backend.
- YouTube as the main provider when the API key is configured.
- Audius as a free fallback.
- Playback through the YouTube IFrame Player or Audius streams.
- Playback queue.
- Favorites saved in `localStorage`.
- Lyrics through LRCLIB.
- Responsive UI for desktop and mobile.
- Real deployment with GitHub Pages + Render.
- `robots` meta tag with `noindex, nofollow` in `index.html` to prevent indexing.

---

## Operational Notes

- The public site to open and share is the GitHub Pages URL.
- Render serves the backend; it may also show the HTML page, but it is not the main user-facing link.
- If GitHub Pages cannot reach the backend, check `config.js`, script order in `index.html`, and CORS on Render.
- The CORS value must be lowercase: `https://stefadale.github.io`.
- If YouTube does not return results, check the Google Cloud API key restrictions.

---

## AI Tracking

| Date | AI Model | Activity |
|---|---|---|
| June 29, 2026 | Codex | Created the music app, configured YouTube/Audius/LRCLIB, added the Node.js backend, responsive UI, GitHub Pages + Render deployment, and operational documentation. |
| June 29, 2026 | Codex | Added the `noindex,nofollow` meta tag, copied the Italian README, translated the README to English, and generated the IT/EN context documents. |

---

## Recommended Next Steps

- Remove any unnecessary debug fields from API responses.
- Further improve YouTube result ranking.
- Consider a custom domain.
- Keep the YouTube key protected in backend environment variables.
