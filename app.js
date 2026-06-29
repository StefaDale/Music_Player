const STORAGE_KEY = "open-music-player-state";
const DEFAULT_QUERY = "electronic";
const API_BASE_URL = (window.APP_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");

const state = {
  currentTrack: null,
  queue: [],
  favorites: [],
  results: [],
  activeTab: "queue",
  isPlaying: false,
  serverAvailable: false,
  youtubeConfigured: false,
  lyrics: {
    status: "idle",
    lines: [],
    plain: "",
    activeIndex: -1,
  },
  youtubeReady: false,
};

let activeSearchId = 0;
let activeLyricsId = 0;
let youtubePlayer = null;
let pendingYouTubeTrack = null;
let youtubeProgressTimer = null;

const els = {
  audio: document.getElementById("audio"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  resultCount: document.getElementById("resultCount"),
  resultsList: document.getElementById("resultsList"),
  messageBox: document.getElementById("messageBox"),
  nowCover: document.getElementById("nowCover"),
  coverPlaceholder: document.getElementById("coverPlaceholder"),
  nowTitle: document.getElementById("nowPlayingTitle"),
  nowArtist: document.getElementById("nowArtist"),
  storeLink: document.getElementById("storeLink"),
  youtubePlayerWrap: document.getElementById("youtubePlayerWrap"),
  lyricsStatus: document.getElementById("lyricsStatus"),
  lyricsBox: document.getElementById("lyricsBox"),
  playerCover: document.getElementById("playerCover"),
  playerTitle: document.getElementById("playerTitle"),
  playerArtist: document.getElementById("playerArtist"),
  playButton: document.getElementById("playButton"),
  playIcon: document.getElementById("playIcon"),
  prevButton: document.getElementById("prevButton"),
  nextButton: document.getElementById("nextButton"),
  seekRange: document.getElementById("seekRange"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  volumeRange: document.getElementById("volumeRange"),
  queueTab: document.getElementById("queueTab"),
  favoritesTab: document.getElementById("favoritesTab"),
  queuePanel: document.getElementById("queuePanel"),
  favoritesPanel: document.getElementById("favoritesPanel"),
  queueList: document.getElementById("queueList"),
  favoritesList: document.getElementById("favoritesList"),
  queueEmpty: document.getElementById("queueEmpty"),
  favoritesEmpty: document.getElementById("favoritesEmpty"),
};

async function init() {
  restoreState();
  bindEvents();
  renderAll();
  loadYouTubeApi();
  await detectServer();
  runSearch(state.youtubeConfigured ? "Fabri Fibra" : DEFAULT_QUERY);
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(els.searchInput.value.trim());
  });

  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => runSearch(button.dataset.query));
  });

  els.playButton.addEventListener("click", togglePlayback);
  els.prevButton.addEventListener("click", playPreviousTrack);
  els.nextButton.addEventListener("click", playNextTrack);

  els.seekRange.addEventListener("input", () => {
    if (state.currentTrack?.source === "youtube" && youtubePlayer?.seekTo) {
      youtubePlayer.seekTo(Number(els.seekRange.value), true);
      updateActiveLyric();
    } else if (Number.isFinite(els.audio.duration)) {
      els.audio.currentTime = Number(els.seekRange.value);
      updateActiveLyric();
    }
  });

  els.volumeRange.addEventListener("input", () => {
    els.audio.volume = Number(els.volumeRange.value);
  });

  els.audio.addEventListener("play", () => {
    state.isPlaying = true;
    stopYouTube();
    renderPlaybackState();
  });

  els.audio.addEventListener("pause", () => {
    state.isPlaying = false;
    renderPlaybackState();
  });

  els.audio.addEventListener("loadedmetadata", updateTimeline);
  els.audio.addEventListener("timeupdate", () => {
    updateTimeline();
    updateActiveLyric();
  });
  els.audio.addEventListener("ended", playNextTrack);
  els.audio.addEventListener("error", () => {
    setMessage("Non riesco a riprodurre questo stream.");
    playNextTrack();
  });

  els.queueTab.addEventListener("click", () => setActiveTab("queue"));
  els.favoritesTab.addEventListener("click", () => setActiveTab("favorites"));

  els.audio.volume = Number(els.volumeRange.value);
}

async function detectServer() {
  if (window.location.protocol === "file:") {
    state.serverAvailable = false;
    setMessage("Avvia l'app con npm start per ascoltare brani completi e testi.");
    return;
  }

  try {
    const config = await fetchJson("/api/config");
    state.serverAvailable = config.provider === "audius" || config.provider === "youtube+audius";
    state.youtubeConfigured = Boolean(config.youtubeConfigured);
    if (state.youtubeConfigured) {
      setMessage("YouTube attivo per il catalogo mainstream, Audius come fallback.");
    }
  } catch (error) {
    state.serverAvailable = false;
    setMessage("Server locale non raggiungibile.");
  }
}

async function runSearch(query) {
  if (!query) {
    return;
  }

  if (!state.serverAvailable) {
    setMessage("Avvia il server locale con npm start.");
    return;
  }

  const searchId = ++activeSearchId;
  els.searchInput.value = query;
  state.results = [];
  renderResults();
  setMessage("Ricerca in corso...");
  els.resultCount.textContent = "Caricamento";

  try {
    const data = await fetchJson(`/api/search?q=${encodeURIComponent(query)}&limit=24`);
    if (searchId !== activeSearchId) {
      return;
    }

    state.results = Array.isArray(data.results)
      ? data.results.filter((track) => track.stream || (track.source === "youtube" && track.youtubeId))
      : [];
    renderResults();

    if (state.results.length) {
      setMessage("Risultati da YouTube/Audius. Testi cercati via LRCLIB.");
      els.resultCount.textContent = `${state.results.length} brani`;
    } else {
      setMessage(state.youtubeConfigured
        ? "Nessun brano riproducibile trovato."
        : "Nessun risultato: per artisti mainstream configura YOUTUBE_API_KEY.");
      els.resultCount.textContent = "0 brani";
    }
  } catch (error) {
    if (searchId !== activeSearchId) {
      return;
    }

    console.error(error);
    setMessage("Non riesco a contattare Audius in questo momento.");
    els.resultCount.textContent = "Errore";
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(resolveApiUrl(url), {
    credentials: API_BASE_URL ? "omit" : "same-origin",
    ...options,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}

function resolveApiUrl(url) {
  if (!API_BASE_URL || !url.startsWith("/api/")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

function renderAll() {
  renderCurrentTrack();
  renderPlaybackState();
  renderResults();
  renderQueue();
  renderFavorites();
  renderLyrics();
  renderTabs();
}

function renderResults() {
  els.resultsList.innerHTML = "";

  state.results.forEach((track) => {
    els.resultsList.appendChild(createTrackCard(track));
  });
}

function createTrackCard(track) {
  const card = document.createElement("article");
  card.className = "track-card";
  card.innerHTML = `
    <img src="${escapeAttribute(track.cover)}" alt="">
    <div class="track-info">
      <div>
        <p class="track-title">${escapeHtml(track.title)}</p>
        <p class="track-meta">${escapeHtml(track.artist)}${track.album ? ` - ${escapeHtml(track.album)}` : ""}</p>
      </div>
      <p class="track-stats">${formatTime(track.duration)}${track.playCount ? ` - ${formatCount(track.playCount)} ascolti` : ""}</p>
      <div class="track-actions">
        <button class="icon-button" type="button" data-action="play" aria-label="Riproduci ${escapeAttribute(track.title)}">
          <span aria-hidden="true">&#9658;</span>
        </button>
        <button class="icon-button" type="button" data-action="queue" aria-label="Aggiungi alla coda">
          <span aria-hidden="true">+</span>
        </button>
        <button class="icon-button" type="button" data-action="favorite" aria-label="Aggiungi ai preferiti">
          <span aria-hidden="true">${isFavorite(track.id) ? "&#9733;" : "&#9734;"}</span>
        </button>
        <a class="icon-button" href="${escapeAttribute(track.link)}" target="_blank" rel="noreferrer" aria-label="${track.source === "youtube" ? "Apri su YouTube" : "Apri su Audius"}">
          <span aria-hidden="true">&#8599;</span>
        </a>
      </div>
    </div>
  `;

  card.querySelector('[data-action="play"]').addEventListener("click", () => playTrack(track));
  card.querySelector('[data-action="queue"]').addEventListener("click", () => addToQueue(track));
  card.querySelector('[data-action="favorite"]').addEventListener("click", () => toggleFavorite(track));

  return card;
}

function renderCurrentTrack() {
  const track = state.currentTrack;

  if (!track) {
    els.youtubePlayerWrap.hidden = true;
    els.nowCover.hidden = false;
    els.coverPlaceholder.hidden = false;
    els.nowCover.src = "";
    els.nowTitle.textContent = "Nessun brano";
    els.nowArtist.textContent = "Scegli un brano dai risultati.";
    els.playerCover.src = "";
    els.playerTitle.textContent = "Nessun brano selezionato";
    els.playerArtist.textContent = "YouTube / Audius";
    els.storeLink.href = "https://audius.co/";
    els.storeLink.setAttribute("aria-disabled", "true");
    els.storeLink.textContent = "Apri sorgente";
    return;
  }

  const youtubeTrack = track.source === "youtube";
  els.youtubePlayerWrap.hidden = !youtubeTrack;
  els.nowCover.hidden = youtubeTrack;
  els.coverPlaceholder.hidden = youtubeTrack;
  els.nowCover.src = youtubeTrack ? "" : track.coverBig || track.cover;
  els.nowTitle.textContent = track.title;
  els.nowArtist.textContent = `${track.artist}${track.album ? ` - ${track.album}` : ""}`;
  els.playerCover.src = track.cover;
  els.playerTitle.textContent = track.title;
  els.playerArtist.textContent = track.artist;
  els.storeLink.href = track.link || "https://audius.co/";
  els.storeLink.setAttribute("aria-disabled", track.link ? "false" : "true");
  els.storeLink.textContent = track.source === "youtube" ? "Apri su YouTube" : "Apri su Audius";
}

function renderPlaybackState() {
  els.playIcon.innerHTML = state.isPlaying ? "&#10074;&#10074;" : "&#9658;";
  els.playButton.setAttribute("aria-label", state.isPlaying ? "Metti in pausa" : "Riproduci");
}

function renderQueue() {
  els.queueList.innerHTML = "";
  state.queue.forEach((track, index) => {
    els.queueList.appendChild(createMiniTrack(track, {
      actionLabel: "Rimuovi dalla coda",
      actionIcon: "&times;",
      onPlay: () => {
        state.queue.splice(index, 1);
        playTrack(track);
      },
      onAction: () => {
        state.queue.splice(index, 1);
        persistState();
        renderQueue();
      },
    }));
  });
  els.queueEmpty.hidden = state.queue.length > 0;
}

function renderFavorites() {
  els.favoritesList.innerHTML = "";
  state.favorites.forEach((track) => {
    els.favoritesList.appendChild(createMiniTrack(track, {
      actionLabel: "Rimuovi dai preferiti",
      actionIcon: "&#9733;",
      onPlay: () => playTrack(track),
      onAction: () => toggleFavorite(track),
    }));
  });
  els.favoritesEmpty.hidden = state.favorites.length > 0;
}

function createMiniTrack(track, options) {
  const item = document.createElement("div");
  item.className = "mini-track";
  item.innerHTML = `
    <img src="${escapeAttribute(track.cover)}" alt="">
    <button class="mini-copy text-button" type="button">
      <span class="mini-title">${escapeHtml(track.title)}</span>
      <span class="mini-meta">${escapeHtml(track.artist)}</span>
    </button>
    <button class="icon-button" type="button" aria-label="${escapeAttribute(options.actionLabel)}">
      <span aria-hidden="true">${options.actionIcon}</span>
    </button>
  `;
  item.querySelector(".mini-copy").addEventListener("click", options.onPlay);
  item.querySelector(".icon-button").addEventListener("click", options.onAction);
  return item;
}

function renderLyrics() {
  els.lyricsBox.innerHTML = "";
  els.lyricsStatus.textContent = getLyricsStatusLabel();

  if (state.lyrics.status === "loading") {
    els.lyricsBox.innerHTML = '<p class="lyrics-empty">Cerco il testo...</p>';
    return;
  }

  if (state.lyrics.status === "missing") {
    els.lyricsBox.innerHTML = '<p class="lyrics-empty">Testo non trovato per questo brano.</p>';
    return;
  }

  if (state.lyrics.lines.length) {
    const fragment = document.createDocumentFragment();
    state.lyrics.lines.forEach((line, index) => {
      const button = document.createElement("button");
      button.className = "lyric-line";
      button.type = "button";
      button.dataset.index = String(index);
      button.textContent = line.text || " ";
      button.addEventListener("click", () => {
        els.audio.currentTime = line.time;
        updateActiveLyric();
      });
      fragment.appendChild(button);
    });
    els.lyricsBox.appendChild(fragment);
    updateActiveLyric();
    return;
  }

  if (state.lyrics.plain) {
    state.lyrics.plain.split(/\r?\n/).forEach((line) => {
      const paragraph = document.createElement("p");
      paragraph.className = "plain-lyric-line";
      paragraph.textContent = line || " ";
      els.lyricsBox.appendChild(paragraph);
    });
    return;
  }

  els.lyricsBox.innerHTML = '<p class="lyrics-empty">Seleziona un brano per cercare il testo.</p>';
}

function getLyricsStatusLabel() {
  if (state.lyrics.status === "loading") {
    return "Cerco";
  }

  if (state.lyrics.status === "synced") {
    return "Sync";
  }

  if (state.lyrics.status === "plain") {
    return "Plain";
  }

  if (state.lyrics.status === "missing") {
    return "Assente";
  }

  return "In attesa";
}

function renderTabs() {
  const queueActive = state.activeTab === "queue";
  els.queueTab.classList.toggle("active", queueActive);
  els.favoritesTab.classList.toggle("active", !queueActive);
  els.queueTab.setAttribute("aria-selected", String(queueActive));
  els.favoritesTab.setAttribute("aria-selected", String(!queueActive));
  els.queuePanel.hidden = !queueActive;
  els.favoritesPanel.hidden = queueActive;
  els.queuePanel.classList.toggle("active", queueActive);
  els.favoritesPanel.classList.toggle("active", !queueActive);
}

async function playTrack(track) {
  if (track.source === "youtube") {
    playYouTubeTrack(track);
    return;
  }

  if (!track.stream) {
    setMessage("Stream non disponibile per questo brano.");
    return;
  }

  state.currentTrack = track;
  els.audio.src = track.stream;
  stopYouTube();
  resetLyrics("loading");
  renderCurrentTrack();
  renderLyrics();
  persistState();
  loadLyrics(track);

  try {
    await els.audio.play();
  } catch (error) {
    state.isPlaying = false;
    renderPlaybackState();
    setMessage("Il browser richiede un click per avviare l'audio.");
  }
}

function playYouTubeTrack(track) {
  if (!track.youtubeId) {
    setMessage("Video YouTube non disponibile.");
    return;
  }

  els.audio.pause();
  els.audio.removeAttribute("src");
  els.audio.load();
  state.currentTrack = track;
  pendingYouTubeTrack = track;
  resetLyrics("loading");
  renderCurrentTrack();
  renderLyrics();
  persistState();
  loadLyrics(track);
  startYouTubePlayback(track);
}

function loadYouTubeApi() {
  if (window.YT?.Player) {
    state.youtubeReady = true;
    return;
  }

  const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  window.onYouTubeIframeAPIReady = () => {
    state.youtubeReady = true;
    if (pendingYouTubeTrack) {
      startYouTubePlayback(pendingYouTubeTrack);
    }
  };

  if (!existingScript) {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }
}

function startYouTubePlayback(track) {
  if (!state.youtubeReady || !window.YT?.Player) {
    setMessage("Carico il player YouTube...");
    return;
  }

  els.youtubePlayerWrap.hidden = false;

  if (!youtubePlayer) {
    youtubePlayer = new YT.Player("youtubePlayer", {
      width: "100%",
      height: "100%",
      videoId: track.youtubeId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          event.target.playVideo();
          startYouTubeTimer();
        },
        onStateChange: handleYouTubeStateChange,
        onError: handleYouTubeError,
      },
    });
    return;
  }

  youtubePlayer.loadVideoById(track.youtubeId);
  youtubePlayer.playVideo();
  startYouTubeTimer();
}

function handleYouTubeError() {
  setMessage("Questo video non si puo' incorporare qui, passo al prossimo risultato.");
  playNextTrack();
}

function handleYouTubeStateChange(event) {
  const stateCode = event.data;

  if (stateCode === YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    startYouTubeTimer();
  } else if (stateCode === YT.PlayerState.PAUSED) {
    state.isPlaying = false;
  } else if (stateCode === YT.PlayerState.ENDED) {
    state.isPlaying = false;
    stopYouTubeTimer();
    playNextTrack();
  }

  renderPlaybackState();
  updateTimeline();
}

function startYouTubeTimer() {
  stopYouTubeTimer();
  youtubeProgressTimer = window.setInterval(() => {
    updateTimeline();
    updateActiveLyric();
  }, 500);
}

function stopYouTubeTimer() {
  if (youtubeProgressTimer) {
    window.clearInterval(youtubeProgressTimer);
    youtubeProgressTimer = null;
  }
}

function stopYouTube() {
  if (youtubePlayer?.stopVideo) {
    youtubePlayer.stopVideo();
  }
  stopYouTubeTimer();
}

async function loadLyrics(track) {
  const lyricsId = ++activeLyricsId;

  try {
    const params = new URLSearchParams({
      track: track.title,
      artist: track.artist,
      duration: String(track.duration || ""),
    });
    const data = await fetchJson(`/api/lyrics?${params.toString()}`);

    if (lyricsId !== activeLyricsId) {
      return;
    }

    if (!data.found || data.instrumental) {
      resetLyrics("missing");
      renderLyrics();
      return;
    }

    const lines = parseSyncedLyrics(data.syncedLyrics || "");
    state.lyrics = {
      status: lines.length ? "synced" : "plain",
      lines,
      plain: data.plainLyrics || "",
      activeIndex: -1,
    };
    renderLyrics();
  } catch (error) {
    if (lyricsId !== activeLyricsId) {
      return;
    }

    resetLyrics("missing");
    renderLyrics();
  }
}

function resetLyrics(status = "idle") {
  state.lyrics = {
    status,
    lines: [],
    plain: "",
    activeIndex: -1,
  };
}

function parseSyncedLyrics(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
      if (!match) {
        return null;
      }

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = Number(`0.${(match[3] || "0").padEnd(3, "0")}`);

      return {
        time: minutes * 60 + seconds + fraction,
        text: match[4],
      };
    })
    .filter(Boolean);
}

function updateActiveLyric() {
  if (!state.lyrics.lines.length) {
    return;
  }

  const current = getPlaybackTime();
  let index = state.lyrics.lines.findIndex((line, lineIndex) => {
    const next = state.lyrics.lines[lineIndex + 1];
    return current >= line.time && (!next || current < next.time);
  });

  if (index < 0) {
    index = 0;
  }

  if (index === state.lyrics.activeIndex) {
    return;
  }

  const previous = els.lyricsBox.querySelector(".lyric-line.active");
  if (previous) {
    previous.classList.remove("active");
  }

  const currentLine = els.lyricsBox.querySelector(`[data-index="${index}"]`);
  if (currentLine) {
    currentLine.classList.add("active");
    currentLine.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  state.lyrics.activeIndex = index;
}

async function togglePlayback() {
  if (!state.currentTrack && state.results.length) {
    await playTrack(state.results[0]);
    return;
  }

  if (!state.currentTrack) {
    setMessage("Seleziona un brano dai risultati.");
    return;
  }

  if (state.currentTrack.source === "youtube") {
    if (!youtubePlayer) {
      playYouTubeTrack(state.currentTrack);
      return;
    }

    const playerState = youtubePlayer?.getPlayerState?.();
    if (playerState === window.YT?.PlayerState?.PLAYING) {
      youtubePlayer.pauseVideo();
    } else {
      youtubePlayer?.playVideo();
    }
    return;
  }

  if (els.audio.paused) {
    await els.audio.play();
  } else {
    els.audio.pause();
  }
}

function playNextTrack() {
  if (state.queue.length) {
    const next = state.queue.shift();
    renderQueue();
    playTrack(next);
    persistState();
    return;
  }

  const next = getAdjacentResult(1);
  if (next) {
    playTrack(next);
  } else {
    els.audio.pause();
    els.audio.currentTime = 0;
  }
}

function playPreviousTrack() {
  const previous = getAdjacentResult(-1);
  if (previous) {
    playTrack(previous);
  } else if (state.currentTrack) {
    els.audio.currentTime = 0;
  }
}

function getAdjacentResult(direction) {
  if (!state.currentTrack || !state.results.length) {
    return null;
  }

  const index = state.results.findIndex((track) => track.id === state.currentTrack.id);
  if (index < 0) {
    return null;
  }

  const nextIndex = index + direction;
  return state.results[nextIndex] || null;
}

function addToQueue(track) {
  if (!state.queue.some((queued) => queued.id === track.id)) {
    state.queue.push(track);
    setMessage(`${track.title} aggiunto alla coda.`);
  } else {
    setMessage(`${track.title} e' gia' in coda.`);
  }
  persistState();
  renderQueue();
}

function toggleFavorite(track) {
  if (isFavorite(track.id)) {
    state.favorites = state.favorites.filter((favorite) => favorite.id !== track.id);
  } else {
    state.favorites.unshift(track);
  }
  persistState();
  renderFavorites();
  renderResults();
}

function isFavorite(trackId) {
  return state.favorites.some((track) => track.id === trackId);
}

function setActiveTab(tab) {
  state.activeTab = tab;
  persistState();
  renderTabs();
}

function updateTimeline() {
  const youtubeTrack = state.currentTrack?.source === "youtube";
  const duration = youtubeTrack && youtubePlayer?.getDuration
    ? youtubePlayer.getDuration() || Number(state.currentTrack?.duration || 0)
    : Number.isFinite(els.audio.duration)
      ? els.audio.duration
      : Number(state.currentTrack?.duration || 0);
  const current = youtubeTrack && youtubePlayer?.getCurrentTime
    ? youtubePlayer.getCurrentTime() || 0
    : Number.isFinite(els.audio.currentTime)
      ? els.audio.currentTime
      : 0;

  els.seekRange.max = duration || 100;
  els.seekRange.value = current;
  els.currentTime.textContent = formatTime(current);
  els.durationTime.textContent = formatTime(duration);
}

function getPlaybackTime() {
  if (state.currentTrack?.source === "youtube" && youtubePlayer?.getCurrentTime) {
    return youtubePlayer.getCurrentTime() || 0;
  }

  return Number.isFinite(els.audio.currentTime) ? els.audio.currentTime : 0;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("it-IT", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function persistState() {
  const payload = {
    currentTrack: state.currentTrack,
    queue: state.queue,
    favorites: state.favorites,
    activeTab: state.activeTab,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.currentTrack = saved.currentTrack || null;
    state.queue = Array.isArray(saved.queue) ? saved.queue : [];
    state.favorites = Array.isArray(saved.favorites) ? saved.favorites : [];
    state.activeTab = saved.activeTab || "queue";

    if (state.currentTrack?.stream) {
      els.audio.src = state.currentTrack.stream;
    }
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function setMessage(message) {
  els.messageBox.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

init();
