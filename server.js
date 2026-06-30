const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { promisify } = require("util");
const { Pool } = require("pg");

loadEnv();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const APP_NAME = process.env.AUDIUS_APP_NAME || "OpenMusicPlayer";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || "";
const APP_FRONTEND_URL = (process.env.APP_FRONTEND_URL || "").replace(/\/$/, "");
const BACKEND_PUBLIC_URL = (process.env.BACKEND_PUBLIC_URL || "").replace(/\/$/, "");
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";
const EMAILJS_VERIFY_TEMPLATE_ID = process.env.EMAILJS_VERIFY_TEMPLATE_ID || "";
const EMAILJS_RESET_TEMPLATE_ID = process.env.EMAILJS_RESET_TEMPLATE_ID || "";
const AUDIUS_API_ROOT = "https://api.audius.co/v1";
const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";
const EMAILJS_API_ROOT = "https://api.emailjs.com/api/v1.0/email/send";
const PASSWORD_MIN_LENGTH = 15;
const PASSWORD_MAX_LENGTH = 128;
const TOKEN_BYTES = 32;
const SESSION_DAYS = 30;
const VERIFY_HOURS = 24;
const RESET_MINUTES = 30;
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "iloveyou",
  "letmein",
  "adminadmin",
  "changeme",
  "openmusic",
]);
const scryptAsync = promisify(crypto.scrypt);
const STATIC_ROOT = __dirname;
const STATIC_FILES = new Set([
  "/index.html",
  "/styles.css",
  "/app.js",
  "/config.js",
  "/assets/open-music-icon.svg",
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    })
  : null;
let schemaReady = false;

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname.startsWith("/api/auth/")) {
      await handleAuth(req, res, url);
      return;
    }

    if (url.pathname === "/api/playlists" || url.pathname.startsWith("/api/playlists/")) {
      await handlePlaylists(req, res, url);
      return;
    }

    if (url.pathname === "/api/config") {
      sendJson(res, {
        provider: YOUTUBE_API_KEY ? "youtube+audius" : "audius",
        lyricsProvider: "lrclib",
        configured: true,
        accountsConfigured: Boolean(pool && PASSWORD_PEPPER),
        emailConfigured: isEmailConfigured(),
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

async function handleAuth(req, res, url) {
  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    await handleRegister(req, res);
    return;
  }

  if (url.pathname === "/api/auth/verify" && req.method === "GET") {
    await handleVerifyEmail(res, url);
    return;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    await handleLogin(req, res);
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    await handleLogout(req, res);
    return;
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const session = await requireSession(req, res);
    if (!session) {
      return;
    }
    sendJson(res, { user: publicUser(session.user) });
    return;
  }

  if (url.pathname === "/api/auth/password/forgot" && req.method === "POST") {
    await handleForgotPassword(req, res);
    return;
  }

  if (url.pathname === "/api/auth/password/reset" && req.method === "POST") {
    await handleResetPassword(req, res);
    return;
  }

  sendJson(res, { error: "Endpoint auth non trovato" }, 404);
}

async function handleRegister(req, res) {
  if (!ensureAuthConfigured(res)) {
    return;
  }

  if (!ensureEmailConfigured(res)) {
    return;
  }

  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const displayName = normalizeDisplayName(body.displayName);
  const password = String(body.password || "");

  if (!email || !displayName || !password) {
    sendJson(res, { error: "Email, nome e password sono obbligatori." }, 400);
    return;
  }

  const passwordError = await getPasswordPolicyError(password);
  if (passwordError) {
    sendJson(res, { error: passwordError }, 400);
    return;
  }

  await ensureSchema();
  const existing = await query("SELECT id, email_verified_at FROM users WHERE email = $1", [email]);
  if (existing.rowCount) {
    sendJson(res, {
      message: "Se i dati sono validi, riceverai una email per completare l'accesso.",
    });
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (id, email, display_name, password_hash)
     VALUES ($1, $2, $3, $4)`,
    [userId, email, displayName, passwordHash],
  );
  const token = await createAuthToken(userId, "verify_email", VERIFY_HOURS * 60);
  await sendActionEmail({
    templateId: EMAILJS_VERIFY_TEMPLATE_ID,
    toEmail: email,
    displayName,
    actionUrl: buildFrontendUrl({ verify: token }),
  });

  sendJson(res, {
    message: "Registrazione ricevuta. Controlla la tua email per confermare l'account.",
  }, 201);
}

async function handleVerifyEmail(res, url) {
  if (!ensureAuthConfigured(res)) {
    return;
  }

  const token = url.searchParams.get("token") || "";
  const tokenRow = await consumeAuthToken(token, "verify_email");
  if (!tokenRow) {
    sendJson(res, { error: "Link di conferma non valido o scaduto." }, 400);
    return;
  }

  await query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
     WHERE id = $1`,
    [tokenRow.user_id],
  );
  sendJson(res, { message: "Account confermato. Ora puoi accedere." });
}

async function handleLogin(req, res) {
  if (!ensureAuthConfigured(res)) {
    return;
  }

  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email || !password) {
    sendJson(res, { error: "Email e password sono obbligatorie." }, 400);
    return;
  }

  await ensureSchema();
  const result = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    sendJson(res, { error: "Email o password non validi." }, 401);
    return;
  }

  if (!user.email_verified_at) {
    sendJson(res, { error: "Conferma il tuo account dalla email prima di accedere." }, 403);
    return;
  }

  const session = await createSession(user.id, req);
  sendJson(res, {
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser(user),
  });
}

async function handleLogout(req, res) {
  if (!ensureAuthConfigured(res)) {
    return;
  }

  const token = getBearerToken(req);
  if (token) {
    await ensureSchema();
    await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  sendJson(res, { message: "Logout completato." });
}

async function handleForgotPassword(req, res) {
  if (!ensureAuthConfigured(res)) {
    return;
  }

  if (!ensureEmailConfigured(res)) {
    return;
  }

  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const generic = {
    message: "Se l'email e' registrata, riceverai un link per reimpostare la password.",
  };

  if (!email) {
    sendJson(res, generic);
    return;
  }

  await ensureSchema();
  const result = await query("SELECT id, email, display_name FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user) {
    sendJson(res, generic);
    return;
  }

  const token = await createAuthToken(user.id, "password_reset", RESET_MINUTES);
  await sendActionEmail({
    templateId: EMAILJS_RESET_TEMPLATE_ID,
    toEmail: user.email,
    displayName: user.display_name,
    actionUrl: buildFrontendUrl({ reset: token }),
  });
  sendJson(res, generic);
}

async function handleResetPassword(req, res) {
  if (!ensureAuthConfigured(res)) {
    return;
  }

  const body = await readJsonBody(req);
  const token = String(body.token || "");
  const password = String(body.password || "");
  const passwordError = await getPasswordPolicyError(password);

  if (!token || passwordError) {
    sendJson(res, { error: passwordError || "Token mancante." }, 400);
    return;
  }

  const tokenRow = await consumeAuthToken(token, "password_reset");
  if (!tokenRow) {
    sendJson(res, { error: "Link di reset non valido o scaduto." }, 400);
    return;
  }

  const passwordHash = await hashPassword(password);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, tokenRow.user_id],
  );
  await query("DELETE FROM sessions WHERE user_id = $1", [tokenRow.user_id]);
  sendJson(res, { message: "Password aggiornata. Accedi di nuovo." });
}

async function handlePlaylists(req, res, url) {
  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const playlistId = parts[2] || "";
  const nested = parts[3] || "";
  const trackEntryId = parts[4] || "";

  if (url.pathname === "/api/playlists" && req.method === "GET") {
    await sendPlaylists(res, session.user.id);
    return;
  }

  if (url.pathname === "/api/playlists" && req.method === "POST") {
    const body = await readJsonBody(req);
    const name = normalizePlaylistName(body.name);
    if (!name) {
      sendJson(res, { error: "Nome playlist obbligatorio." }, 400);
      return;
    }

    const playlist = await createPlaylist(session.user.id, name);
    sendJson(res, { playlist }, 201);
    return;
  }

  if (playlistId && !nested && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const name = normalizePlaylistName(body.name);
    if (!name) {
      sendJson(res, { error: "Nome playlist obbligatorio." }, 400);
      return;
    }

    const result = await query(
      `UPDATE playlists
       SET name = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, name, created_at, updated_at`,
      [name, playlistId, session.user.id],
    );
    if (!result.rowCount) {
      sendJson(res, { error: "Playlist non trovata." }, 404);
      return;
    }
    sendJson(res, { playlist: { ...result.rows[0], tracks: [] } });
    return;
  }

  if (playlistId && !nested && req.method === "DELETE") {
    await query("DELETE FROM playlists WHERE id = $1 AND user_id = $2", [playlistId, session.user.id]);
    sendJson(res, { message: "Playlist eliminata." });
    return;
  }

  if (playlistId && nested === "tracks" && req.method === "POST") {
    const body = await readJsonBody(req);
    const track = sanitizeTrack(body.track);
    if (!track) {
      sendJson(res, { error: "Brano non valido." }, 400);
      return;
    }

    const owns = await userOwnsPlaylist(session.user.id, playlistId);
    if (!owns) {
      sendJson(res, { error: "Playlist non trovata." }, 404);
      return;
    }

    const position = await nextPlaylistPosition(playlistId);
    const result = await query(
      `INSERT INTO playlist_tracks (id, playlist_id, track_id, track_data, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, track_id, track_data, position, created_at`,
      [crypto.randomUUID(), playlistId, track.id, JSON.stringify(track), position],
    );
    await query("UPDATE playlists SET updated_at = now() WHERE id = $1", [playlistId]);
    sendJson(res, { track: mapPlaylistTrack(result.rows[0]) }, 201);
    return;
  }

  if (playlistId && nested === "tracks" && trackEntryId && req.method === "DELETE") {
    const result = await query(
      `DELETE FROM playlist_tracks
       WHERE id = $1
         AND playlist_id IN (SELECT id FROM playlists WHERE id = $2 AND user_id = $3)`,
      [trackEntryId, playlistId, session.user.id],
    );
    if (!result.rowCount) {
      sendJson(res, { error: "Brano non trovato." }, 404);
      return;
    }
    await query("UPDATE playlists SET updated_at = now() WHERE id = $1", [playlistId]);
    sendJson(res, { message: "Brano rimosso." });
    return;
  }

  sendJson(res, { error: "Endpoint playlist non trovato" }, 404);
}

async function handleSearch(res, url) {
  const query = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") || 24), 50);

  if (!query) {
    sendJson(res, { resultCount: 0, results: [] });
    return;
  }

  let youtubeError = "";
  const youtubeResults = YOUTUBE_API_KEY
    ? await searchYouTube(query, limit).catch((error) => {
        youtubeError = error.message || "YouTube search failed";
        console.error("YouTube search failed:", error);
        return [];
      })
    : [];

  const audiusResults = await searchAudius(query, limit).catch((error) => {
    console.error("Audius search failed:", error);
    return [];
  });

  if (youtubeResults.length) {
    const results = mergeSearchResults(youtubeResults, audiusResults, limit);

    sendJson(res, {
      resultCount: results.length,
      youtubeError,
      results,
    });
    return;
  }

  const results = audiusResults.slice(0, limit);

  sendJson(res, {
    resultCount: results.length,
    youtubeError,
    results,
  });
}

function mergeSearchResults(youtubeResults, audiusResults, limit) {
  const youtubeLimit = Math.min(youtubeResults.length, limit, Math.max(8, Math.ceil(limit * 0.65)));
  const merged = [];
  const seen = new Set();

  addUniqueTracks(merged, seen, youtubeResults.slice(0, youtubeLimit), limit);
  addUniqueTracks(merged, seen, audiusResults, limit);
  addUniqueTracks(merged, seen, youtubeResults.slice(youtubeLimit), limit);

  return merged;
}

function addUniqueTracks(target, seen, tracks, limit) {
  for (const track of tracks) {
    if (target.length >= limit) {
      return;
    }

    const duplicateKey = getTrackDuplicateKey(track);

    if (duplicateKey && seen.has(duplicateKey)) {
      continue;
    }

    target.push(track);

    if (duplicateKey) {
      seen.add(duplicateKey);
    }
  }
}

function getTrackDuplicateKey(track) {
  const artist = normalizeText(track.artist);
  const title = normalizeText(track.title);

  if (!title) {
    return "";
  }

  return `${artist}|${title}`;
}

async function searchAudius(query, limit) {
  const searchUrl = new URL(`${AUDIUS_API_ROOT}/tracks/search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("app_name", APP_NAME);
  searchUrl.searchParams.set("limit", String(limit));

  const audiusPayload = await requestJson(searchUrl);
  return Array.isArray(audiusPayload.data)
    ? audiusPayload.data.filter((track) => track.is_streamable !== false).map(normalizeAudiusTrack)
    : [];
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
  const contentDetails = video.contentDetails || {};
  const regionRestriction = contentDetails.regionRestriction || {};
  const blockedRegions = Array.isArray(regionRestriction.blocked) ? regionRestriction.blocked : [];
  const allowedRegions = Array.isArray(regionRestriction.allowed) ? regionRestriction.allowed : [];
  const playableInItaly = !blockedRegions.includes("IT")
    && (!allowedRegions.length || allowedRegions.includes("IT"));
  const liveBroadcast = snippet.liveBroadcastContent && snippet.liveBroadcastContent !== "none";
  const ageRestricted = contentDetails.contentRating?.ytRating === "ytAgeRestricted";

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
    embeddable: video.status?.embeddable !== false
      && video.status?.privacyStatus === "public"
      && playableInItaly
      && !liveBroadcast
      && !ageRestricted,
  };
}

function scoreYouTubeResult(video, query) {
  const queryText = normalizeText(query);
  const queryTokens = queryText.split(/\s+/).filter(Boolean);
  const titleText = normalizeText(video.title);
  const artistText = normalizeText(video.artist);
  const cleanArtistText = cleanYouTubeArtistText(artistText);
  const combinedText = `${cleanArtistText} ${titleText}`.trim();
  const artistInQuery = tokenCoverage(cleanArtistText, queryText);
  const titleInQuery = tokenCoverage(titleText, queryText);
  const queryInResult = tokenCoverage(queryText, combinedText);
  const searchWantsLyrics = /\b(lyrics|lyric|testo|sub|traduzione)\b/i.test(query);
  const searchWantsLive = /\b(live|concerto|radio italia)\b/i.test(query);
  let score = 0;

  for (const token of queryTokens) {
    if (combinedText.includes(token)) {
      score += 8;
    }
  }

  if (cleanArtistText === queryText || cleanArtistText.startsWith(queryText)) {
    score += 35;
  }

  if (combinedText === queryText) {
    score += 70;
  }

  if (cleanArtistText && queryText.startsWith(`${cleanArtistText} `)) {
    const remainingQuery = queryText.slice(cleanArtistText.length).trim();
    score += 25 + Math.round(tokenCoverage(remainingQuery, titleText) * 35);
  }

  if (titleText === queryText) {
    score += 45;
  } else if (titleText.includes(queryText)) {
    score += 22;
  }

  if (titleText && queryText.endsWith(titleText)) {
    score += 30;
  }

  if (artistInQuery >= 0.8 && titleInQuery >= 0.75) {
    score += 45;
  } else if (artistInQuery >= 0.8 && titleInQuery >= 0.5) {
    score += 25;
  }

  if (queryInResult >= 0.85) {
    score += 30;
  }

  if (cleanArtistText && queryText.includes(cleanArtistText)) {
    score += 10;
  }

  if (queryTokens.length > 2 && artistInQuery >= 0.8 && titleInQuery < 0.4) {
    score -= 22;
  }

  if (/\b(official|ufficiale)\b/i.test(`${video.artist} ${video.title}`)) {
    score += 8;
  }

  if (/\b(mashup|reaction|karaoke|cover|tutorial|sped up|slowed)\b/i.test(video.title)) {
    score -= 20;
  }

  if (!searchWantsLyrics && /\b(lyrics?|testo|sub espa|sub ita|traduzione)\b/i.test(video.title)) {
    score -= 24;
  }

  if (!searchWantsLive && /\b(live|radio italia|rilive|concerto)\b/i.test(video.title)) {
    score -= 18;
  }

  if (/\btopic\b/i.test(video.artist)) {
    score -= 14;
  } else if (artistInQuery >= 0.8) {
    score += 10;
  }

  score += Math.min(Math.log10(video.playCount + 1) * 3, 24);

  return score;
}

function cleanYouTubeArtistText(value) {
  return normalizeText(value)
    .replace(/\btopic\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenCoverage(value, target) {
  const tokens = normalizeText(value).split(/\s+/).filter(Boolean);

  if (!tokens.length) {
    return 0;
  }

  const targetTokens = new Set(normalizeText(target).split(/\s+/).filter(Boolean));
  const matches = tokens.filter((token) => targetTokens.has(token)).length;

  return matches / tokens.length;
}

function parseYouTubeTitle(value) {
  const cleanTitle = String(value || "")
    .replace(/\[[^\]]*(official|video|audio|lyrics|visualizer|hd|4k)[^\]]*\]/gi, "")
    .replace(/\([^\)]*(official|video|audio|lyrics|visualizer|hd|4k)[^\)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const separators = [" - ", " \u2013 ", " \u2014 "];
  const separator = separators.find((candidate) => cleanTitle.includes(candidate));

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

async function ensureSchema() {
  if (!pool) {
    throw new Error("DATABASE_URL non configurato");
  }

  if (schemaReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      display_name text NOT NULL,
      password_hash text NOT NULL,
      email_verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS auth_tokens_lookup_idx
      ON auth_tokens (purpose, token_hash, expires_at)
      WHERE consumed_at IS NULL;

    CREATE TABLE IF NOT EXISTS sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      user_agent text,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS sessions_lookup_idx ON sessions (token_hash, expires_at);

    CREATE TABLE IF NOT EXISTS playlists (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS playlists_user_idx ON playlists (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id text PRIMARY KEY,
      playlist_id text NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id text NOT NULL,
      track_data jsonb NOT NULL,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS playlist_tracks_playlist_idx
      ON playlist_tracks (playlist_id, position, created_at);
  `);
  schemaReady = true;
}

async function query(text, params = []) {
  await ensureSchema();
  return pool.query(text, params);
}

function ensureAuthConfigured(res) {
  if (!pool || !PASSWORD_PEPPER) {
    sendJson(res, {
      error: "Account non configurati. Aggiungi DATABASE_URL e PASSWORD_PEPPER su Render.",
    }, 503);
    return false;
  }

  return true;
}

function ensureEmailConfigured(res) {
  if (!isEmailConfigured()) {
    sendJson(res, {
      error: "EmailJS non configurato. Aggiungi le variabili EmailJS su Render.",
    }, 503);
    return false;
  }

  return true;
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) {
      throw new Error("Payload troppo grande");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : "";
}

function normalizeDisplayName(value) {
  const displayName = String(value || "").trim().replace(/\s+/g, " ");
  return displayName.length >= 2 && displayName.length <= 60 ? displayName : "";
}

function normalizePlaylistName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 80 ? name : "";
}

async function getPasswordPolicyError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `La password non puo' superare ${PASSWORD_MAX_LENGTH} caratteri.`;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Questa password e' troppo comune.";
  }

  if (await isPwnedPassword(password)) {
    return "Questa password compare in violazioni note. Scegline una diversa.";
  }

  return "";
}

async function isPwnedPassword(password) {
  const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) {
      return false;
    }
    const text = await response.text();
    return text.split(/\r?\n/).some((line) => line.split(":")[0] === suffix);
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const hash = await scryptAsync(`${password}${PASSWORD_PEPPER}`, salt, 64, options);
  return `scrypt$${options.N}$${options.r}$${options.p}$${salt}$${hash.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, n, r, p, salt, hashValue] = parts;
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await scryptAsync(`${password}${PASSWORD_PEPPER}`, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("base64url");
}

async function createAuthToken(userId, purpose, expiresInMinutes) {
  const token = createToken();
  await query(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [crypto.randomUUID(), userId, purpose, hashToken(token), String(expiresInMinutes)],
  );
  return token;
}

async function consumeAuthToken(token, purpose) {
  if (!token) {
    return null;
  }

  await ensureSchema();
  const result = await pool.query(
    `UPDATE auth_tokens
     SET consumed_at = now()
     WHERE id = (
       SELECT id
       FROM auth_tokens
       WHERE token_hash = $1
         AND purpose = $2
         AND consumed_at IS NULL
         AND expires_at > now()
       LIMIT 1
     )
     RETURNING user_id`,
    [hashToken(token), purpose],
  );
  return result.rows[0] || null;
}

async function createSession(userId, req) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      crypto.randomUUID(),
      userId,
      hashToken(token),
      String(req.headers["user-agent"] || "").slice(0, 300),
      expiresAt.toISOString(),
    ],
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

async function requireSession(req, res) {
  if (!ensureAuthConfigured(res)) {
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, { error: "Accesso richiesto." }, 401);
    return null;
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT sessions.id AS session_id, users.*
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1
       AND sessions.expires_at > now()
     LIMIT 1`,
    [hashToken(token)],
  );

  const user = result.rows[0];
  if (!user) {
    sendJson(res, { error: "Sessione scaduta. Accedi di nuovo." }, 401);
    return null;
  }

  return { user, token };
}

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    emailVerified: Boolean(user.email_verified_at),
  };
}

async function createPlaylist(userId, name) {
  const result = await query(
    `INSERT INTO playlists (id, user_id, name)
     VALUES ($1, $2, $3)
     RETURNING id, name, created_at, updated_at`,
    [crypto.randomUUID(), userId, name],
  );
  return { ...result.rows[0], tracks: [] };
}

async function sendPlaylists(res, userId) {
  const playlistResult = await query(
    `SELECT id, name, created_at, updated_at
     FROM playlists
     WHERE user_id = $1
     ORDER BY updated_at DESC, created_at DESC`,
    [userId],
  );
  const playlists = playlistResult.rows.map((row) => ({ ...row, tracks: [] }));
  if (!playlists.length) {
    sendJson(res, { playlists: [] });
    return;
  }

  const trackResult = await query(
    `SELECT playlist_id, id, track_id, track_data, position, created_at
     FROM playlist_tracks
     WHERE playlist_id = ANY($1)
     ORDER BY position ASC, created_at ASC`,
    [playlists.map((playlist) => playlist.id)],
  );
  const byId = new Map(playlists.map((playlist) => [playlist.id, playlist]));
  trackResult.rows.forEach((row) => {
    byId.get(row.playlist_id)?.tracks.push(mapPlaylistTrack(row));
  });

  sendJson(res, { playlists });
}

async function userOwnsPlaylist(userId, playlistId) {
  const result = await query("SELECT 1 FROM playlists WHERE id = $1 AND user_id = $2", [playlistId, userId]);
  return result.rowCount > 0;
}

async function nextPlaylistPosition(playlistId) {
  const result = await query(
    "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM playlist_tracks WHERE playlist_id = $1",
    [playlistId],
  );
  return Number(result.rows[0]?.position || 0);
}

function mapPlaylistTrack(row) {
  return {
    id: row.id,
    trackId: row.track_id,
    track: row.track_data,
    position: row.position,
    createdAt: row.created_at,
  };
}

function sanitizeTrack(track) {
  if (!track || typeof track !== "object" || !track.id || !track.title) {
    return null;
  }

  return {
    id: String(track.id).slice(0, 180),
    source: String(track.source || "").slice(0, 32),
    youtubeId: track.youtubeId ? String(track.youtubeId).slice(0, 64) : "",
    title: String(track.title || "Senza titolo").slice(0, 220),
    artist: String(track.artist || "Artista sconosciuto").slice(0, 180),
    album: String(track.album || "").slice(0, 180),
    cover: String(track.cover || "").slice(0, 1000),
    coverBig: String(track.coverBig || "").slice(0, 1000),
    duration: Number(track.duration) || 0,
    stream: String(track.stream || "").slice(0, 1000),
    link: String(track.link || "").slice(0, 1000),
    playCount: Number(track.playCount) || 0,
    favoriteCount: Number(track.favoriteCount) || 0,
    genre: String(track.genre || "").slice(0, 120),
  };
}

function isEmailConfigured() {
  return Boolean(
    EMAILJS_SERVICE_ID
      && EMAILJS_PUBLIC_KEY
      && EMAILJS_PRIVATE_KEY
      && EMAILJS_VERIFY_TEMPLATE_ID
      && EMAILJS_RESET_TEMPLATE_ID,
  );
}

async function sendActionEmail({ templateId, toEmail, displayName, actionUrl }) {
  if (!isEmailConfigured()) {
    throw new Error("EmailJS non configurato");
  }

  const response = await fetch(EMAILJS_API_ROOT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: toEmail,
        display_name: displayName,
        app_name: "Open Music",
        action_url: actionUrl,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`EmailJS HTTP ${response.status}: ${await response.text()}`);
  }
}

function buildFrontendUrl(params) {
  const base = APP_FRONTEND_URL || BACKEND_PUBLIC_URL || `http://${HOST}:${PORT}`;
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
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

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  const configuredOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!configuredOrigins.length) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (configuredOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
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
