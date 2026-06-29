# Open Music Player

Music player with a hybrid catalog: YouTube for mainstream artists, Audius as a free/open catalog, and lyrics from LRCLIB.

## What It Includes

- track search on YouTube when `YOUTUBE_API_KEY` is configured
- fallback to Audius without API keys
- playback through the YouTube IFrame Player or Audius streams
- player controls for play, pause, next, previous, seek, and volume
- playback queue
- local favorites saved in `localStorage`
- artwork, duration, play count, and source link
- lyrics through LRCLIB, with synchronization when available

## Important Limitation

It cannot legally provide Spotify's full commercial catalog for free. That requires licenses and official APIs with accounts, subscriptions, or commercial agreements. For artists such as Fabri Fibra, the most realistic free option is YouTube: the app searches official videos or available uploads and plays them through the official embedded player.

## YouTube For The Mainstream Catalog

To search Fabri Fibra and other commercial artists inside the app, you need a free YouTube Data API key:

1. Go to https://console.cloud.google.com/.
2. Create or select a project.
3. Enable `YouTube Data API v3`.
4. Create an API key.
5. Add it to `.env`:

```text
YOUTUBE_API_KEY=your_key
```

The key stays in the backend and is not exposed in the frontend.

## Local Start

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

## Simulate The App Online With ngrok

To test the app from a phone or temporarily share it as if it were online, keep two terminals open.

In the first terminal, start the Node server:

```powershell
cd C:\Code\Web\Deezer
npm start
```

Leave this window open.

In the second terminal, start ngrok on the same port:

```powershell
ngrok http 4173
```

Ngrok will show a line similar to:

```text
Forwarding  https://something.ngrok-free.dev -> http://localhost:4173
```

The `https://...ngrok-free.dev` link is the temporary public address that can also be opened from a phone.

Notes:

- if you close `npm start`, the app turns off;
- if you close `ngrok`, the public link stops working;
- with the free ngrok plan, the link can change every time you restart it;
- if an ngrok warning page appears, press the button to continue to the site.

## Publishing With GitHub Pages + Backend

GitHub Pages can only publish the static frontend. The Node backend (`server.js`) must run on a separate online service, such as Render, Railway, or Fly.io.

Recommended starting option: Render, because this app can run directly with `npm start` and use environment variables from the dashboard.

### 1. Publish The Code On GitHub

Make sure not to upload `.env`: it is already excluded by `.gitignore`.

### 2. Create The Backend On Render

On Render, create a new Web Service connected to the GitHub repository.

Settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Environment variables to add in the Render dashboard:

```text
HOST=0.0.0.0
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=your_youtube_key
CORS_ORIGIN=https://your-user.github.io
```

Render sets `PORT` automatically, so you do not need to add it.

At the end, Render will give you a URL such as:

```text
https://app-name.onrender.com
```

### 3. Connect GitHub Pages To The Backend

Open `config.js` and set the backend URL:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://app-name.onrender.com",
};
```

Then publish the frontend with GitHub Pages from the main branch.

### 4. Set Up GitHub Pages

In the GitHub repository, go to:

```text
Settings -> Pages
```

Choose:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

The site will be available at an address similar to:

```text
https://your-user.github.io/repository-name/
```

The `.env` file is optional:

```text
PORT=4173
HOST=127.0.0.1
AUDIUS_APP_NAME=OpenMusicPlayer
YOUTUBE_API_KEY=
```

## Providers

- YouTube Data API + IFrame Player: searches and plays music videos when the key is configured.
- Audius API: searches and streams tracks without keys.
- LRCLIB API: synchronized lyrics or plain lyrics when available.

Documentation:

- https://developers.google.com/youtube/v3
- https://developers.google.com/youtube/iframe_api_reference
- https://docs.audius.org/
- https://lrclib.net/docs
