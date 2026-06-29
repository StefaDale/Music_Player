const fs = require("fs");
const http = require("http");
const path = require("path");

loadEnv();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const APP_NAME = process.env.AUDIUS_APP_NAME || "OpenMusicPlayer";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const AUDIUS_API_ROOT = "https://api.audius.co/v1";
const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";
const STATIC_ROOT = __dirname;
const STATIC_FILES = new Set(["/index.html", "/styles.css", "/app.js", "/config.js"]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === "/api/config") {
      sendJson(res, {
        provider: YOUTUBE_API_KEY ? "youtube+audius" : "audius",
        lyricsProvider: "lrclib",
        configured: true,
        youtubeConfigured: Boolean(YOUTUBE_API_KEY),
        youtubeNeedsApiKey: !YOUTUBE_API_KEY,
        needsApiKey: false,
      });
      return;
    }

    if (url.pathname === "/api/search") {
      await handleSearch(res, url);
      return;
    }

    if (url.pathname === "/api/stream") {
      handleStream(res, url);
      return;
    }

    if (url.pathname === "/api/lyrics") {
      await handleLyrics(res, url);
      return;
    }

    serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, { error: "Errore interno del server" }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Open Music Player: http://${HOST}:${PORT}`);
  console.log(YOUTUBE_API_KEY
    ? "Provider: YouTube + Audius + LRCLIB"
    : "Provider: Audius + LRCLIB. Aggiungi YOUTUBE_API_KEY per il catalogo mainstream.");
});

async function handleSearch(res, url) {
  const query = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") || 24), 50);

  if (!query) {
    sendJson(res, { resultCount: 0, results: [] });
    return;
  }

  const searchUrl = new URL(`${AUDIUS_API_ROOT}/tracks/search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("app_name", APP_NAME);
  searchUrl.searchParams.set("limit", String(limit));

  const youtubeResults = YOUTUBE_API_KEY
    ? await searchYouTube(query, limit).catch(() => [])
    : [];

  if (youtubeResults.length) {
    sendJson(res, {
      resultCount: youtubeResults.length,
      results: youtubeResults.slice(0, limit),
    });
    return;
  }

  const audiusPayload = await requestJson(searchUrl);
  const audiusResults = Array.isArray(audiusPayload.data)
    ? audiusPayload.data.filter((track) => track.is_streamable !== false).map(normalizeAudiusTrack)
    : [];
  const results = audiusResults.slice(0, limit);

  sendJson(res, {
    resultCount: results.length,
    results,
  });
}

async function searchYouTube(query, limit) {
  const searchUrl = new URL(`${YOUTUBE_API_ROOT}/search`);
  searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoCategoryId", "10");
  searchUrl.searchParams.set("maxResults", String(Math.min(Math.max(limit * 2, 12), 25)));
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("regionCode", "IT");
  searchUrl.searchParams.set("relevanceLanguage", "it");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("safeSearch", "none");

  const searchPayload = await requestJson(searchUrl);
  const ids = Array.isArray(searchPayload.items)
    ? searchPayload.items.map((item) => item.id?.videoId).filter(Boolean)
    : [];

  if (!ids.length) {
    return [];
  }

  const videosUrl = new URL(`${YOUTUBE_API_ROOT}/videos`);
  videosUrl.searchParams.set("key", YOUTUBE_API_KEY);
  videosUrl.searchParams.set("part", "snippet,contentDetails,statistics,status");
  videosUrl.searchParams.set("id", ids.join(","));

  const videosPayload = await requestJson(videosUrl);
  return Array.isArray(videosPayload.items)
    ? videosPayload.items
      .map(normalizeYouTubeVideo)
      .filter((video) => video.embeddable)
      .filter((video) => video.duration >= 45 && video.duration <= 900)
      .map((video) => ({
        video,
        score: scoreYouTubeResult(video, query),
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ video }) => video)
    : [];
}

function handleStream(res, url) {
  const trackId = url.searchParams.get("id");

  if (!trackId) {
    sendJson(res, { error: "Track id mancante" }, 400);
    return;
  }

  const streamUrl = new URL(`${AUDIUS_API_ROOT}/tracks/${encodeURIComponent(trackId)}/stream`);
  streamUrl.searchParams.set("app_name", APP_NAME);

  res.writeHead(302, {
    Location: streamUrl.toString(),
    "Cache-Control": "no-store",
  });
  res.end();
}

async function handleLyrics(res, url) {
  const trackName = url.searchParams.get("track");
  const artistName = url.searchParams.get("artist");
  const duration = Number(url.searchParams.get("duration") || 0);

  if (!trackName || !artistName) {
    sendJson(res, { found: false });
    return;
  }

  const searchUrl = new URL("https://lrclib.net/api/search");
  searchUrl.searchParams.set("track_name", trackName);
  searchUrl.searchParams.set("artist_name", artistName);

  const data = await requestJson(searchUrl, {
    "User-Agent": `${APP_NAME} (local development)`,
  });
  const entries = Array.isArray(data) ? data : [];
  const match = chooseLyricsMatch(entries, trackName, artistName, duration);

  if (!match) {
    sendJson(res, { found: false });
    return;
  }

  sendJson(res, {
    found: true,
    trackName: match.trackName,
    artistName: match.artistName,
    albumName: match.albumName,
    duration: match.duration,
    instrumental: Boolean(match.instrumental),
    plainLyrics: match.plainLyrics || "",
    syncedLyrics: match.syncedLyrics || "",
  });
}

function normalizeAudiusTrack(track) {
  const id = String(track.id || track.track_id || "");
  const title = track.title || "Senza titolo";
  const artist = track.user?.name || track.user?.handle || "Artista sconosciuto";
  const artwork = track.artwork || {};

  return {
    id,
    source: "audius",
    title,
    artist,
    album: track.genre || track.mood || "",
    cover: artwork["480x480"] || artwork["150x150"] || "",
    coverBig: artwork["1000x1000"] || artwork["480x480"] || artwork["150x150"] || "",
    duration: Number(track.duration) || 0,
    stream: `/api/stream?id=${encodeURIComponent(id)}`,
    link: track.permalink ? `https://audius.co${track.permalink}` : "https://audius.co/",
    playCount: Number(track.play_count) || 0,
    favoriteCount: Number(track.favorite_count) || 0,
    genre: track.genre || "",
  };
}

function normalizeYouTubeVideo(video) {
  const videoId = video.id;
  const snippet = video.snippet || {};
  const parsed = parseYouTubeTitle(snippet.title || "");
  const thumbnails = snippet.thumbnails || {};
  const cover = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "";

  return {
    id: `youtube:${videoId}`,
    source: "youtube",
    youtubeId: videoId,
    title: parsed.title || snippet.title || "Senza titolo",
    artist: parsed.artist || snippet.channelTitle || "YouTube",
    album: "YouTube",
    cover,
    coverBig: thumbnails.maxres?.url || thumbnails.standard?.url || cover,
    duration: parseIsoDuration(video.contentDetails?.duration || ""),
    stream: "",
    link: `https://www.youtube.com/watch?v=${videoId}`,
    playCount: Number(video.statistics?.viewCount) || 0,
    favoriteCount: Number(video.statistics?.likeCount) || 0,
    genre: "YouTube",
    embeddable: video.status?.embeddable !== false && video.status?.privacyStatus === "public",
  };
}

function scoreYouTubeResult(video, query) {
  const queryText = normalizeText(query);
  const queryTokens = queryText.split(/\s+/).filter(Boolean);
  const titleText = normalizeText(video.title);
  const artistText = normalizeText(video.artist);
  const combinedText = `${artistText} ${titleText}`;
  let score = 0;

  for (const token of queryTokens) {
    if (combinedText.includes(token)) {
      score += 8;
    }
  }

  if (artistText === queryText || artistText.startsWith(queryText)) {
    score += 35;
  }

  if (titleText.includes(queryText)) {
    score += 16;
  }

  if (/\b(official|ufficiale)\b/i.test(`${video.artist} ${video.title}`)) {
    score += 8;
  }

  if (/\b(mashup|reaction|karaoke|cover|tutorial|sped up|slowed)\b/i.test(video.title)) {
    score -= 20;
  }

  score += Math.min(Math.log10(video.playCount + 1) * 3, 24);

  return score;
}

function parseYouTubeTitle(value) {
  const cleanTitle = String(value || "")
    .replace(/\[[^\]]*(official|video|audio|lyrics|visualizer|hd|4k)[^\]]*\]/gi, "")
    .replace(/\([^\)]*(official|video|audio|lyrics|visualizer|hd|4k)[^\)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const separator = cleanTitle.includes(" - ") ? " - " : cleanTitle.includes(" – ") ? " – " : null;

  if (!separator) {
    return { artist: "", title: cleanTitle };
  }

  const [artist, ...titleParts] = cleanTitle.split(separator);
  return {
    artist: artist.trim(),
    title: titleParts.join(separator).trim(),
  };
}

function parseIsoDuration(value) {
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);

  if (!match) {
    return 0;
  }

  return (Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0);
}

function chooseLyricsMatch(entries, trackName, artistName, duration) {
  const normalizedTrack = normalizeText(trackName);
  const normalizedArtist = normalizeText(artistName);

  return entries
    .map((entry) => ({
      entry,
      score: scoreLyricsMatch(entry, normalizedTrack, normalizedArtist, duration),
    }))
    .sort((a, b) => b.score - a.score)
    .find(({ score }) => score > 0)?.entry || null;
}

function scoreLyricsMatch(entry, normalizedTrack, normalizedArtist, duration) {
  let score = 0;

  if (normalizeText(entry.trackName).includes(normalizedTrack)) {
    score += 4;
  }

  if (normalizeText(entry.artistName).includes(normalizedArtist)) {
    score += 4;
  }

  if (entry.syncedLyrics) {
    score += 2;
  }

  if (entry.plainLyrics) {
    score += 1;
  }

  if (duration && entry.duration) {
    const difference = Math.abs(Number(entry.duration) - duration);
    if (difference < 4) {
      score += 2;
    } else if (difference < 12) {
      score += 1;
    }
  }

  return score;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

async function requestJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

function serveStatic(res, rawPathname) {
  const pathname = rawPathname === "/" ? "/index.html" : decodeURIComponent(rawPathname);

  if (!STATIC_FILES.has(pathname)) {
    sendText(res, "Not found", 404);
    return;
  }

  const filePath = path.resolve(STATIC_ROOT, `.${pathname}`);
  const relativePath = path.relative(STATIC_ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendText(res, "Forbidden", 403);
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, "Not found", 404);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
