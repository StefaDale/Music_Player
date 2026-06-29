const STORAGE_KEY = "open-music-player-state";
const DEFAULT_QUERY = "top hits italia";
const REQUEST_TIMEOUT_MS = 70000;
const API_BASE_URL = getApiBaseUrl();

const ICONS = {
  play: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>',
  pause: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/></svg>',
  moreVertical: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',
  queue: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M4 7h9M4 12h9M4 17h7M17 10v8M13 14h8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>',
  favorite: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="m12 4 2.35 4.76 5.25.76-3.8 3.7.9 5.22L12 15.97l-4.7 2.47.9-5.22-3.8-3.7 5.25-.76L12 4Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"/></svg>',
  favoriteFilled: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="m12 3.8 2.5 5.08 5.6.81-4.05 3.95.96 5.57L12 16.58l-5.01 2.63.96-5.57L3.9 9.69l5.6-.81L12 3.8Z"/></svg>',
  external: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M9 7h8v8M17 7 7 17" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>',
  remove: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>',
};

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
  runSearch(DEFAULT_QUERY, { syncInput: false });
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(els.searchInput.value.trim());
  });

  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => runSearch(button.dataset.query));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".track-menu")) {
      closeTrackMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTrackMenus();
    }
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
    setMessage(getBackendUnavailableMessage(error));
  }
}

async function runSearch(query, options = {}) {
  if (!query) {
    return;
  }

  if (!state.serverAvailable) {
    setMessage(getBackendUnavailableMessage());
    return;
  }

  const searchId = ++activeSearchId;
  if (options.syncInput !== false) {
    els.searchInput.value = query;
  }
  state.results = [];
  renderResults();
  setMessage("Ricerca in corso...");
  setResultCount("Caricamento");

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
      setResultCount(`${state.results.length} brani`);
    } else {
      setMessage(state.youtubeConfigured
        ? "Nessun brano riproducibile trovato."
        : "Nessun risultato: per artisti mainstream configura YOUTUBE_API_KEY.");
      setResultCount("0 brani");
    }
  } catch (error) {
    if (searchId !== activeSearchId) {
      return;
    }

    console.error(error);
    setMessage(getBackendUnavailableMessage(error));
    setResultCount("Errore");
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(resolveApiUrl(url), {
    credentials: API_BASE_URL ? "omit" : "same-origin",
    signal: controller.signal,
    ...options,
  }).finally(() => window.clearTimeout(timeout));

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}

function getBackendUnavailableMessage(error) {
  if (error?.name === "AbortError") {
    return "Il backend online sta impiegando troppo tempo a rispondere. Ricarica tra qualche secondo.";
  }

  return API_BASE_URL
    ? "Backend online non raggiungibile in questo momento. Riprova tra poco."
    : "Avvia il server locale con npm start.";
}

function resolveApiUrl(url) {
  if (!API_BASE_URL || !url.startsWith("/api/")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

function getApiBaseUrl() {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (localHosts.has(window.location.hostname)) {
    return "";
  }

  return (window.APP_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
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
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Riproduci ${track.title}`);
  const sourceLabel = track.source === "youtube" ? "YouTube" : "Audius";
  const sourceActionLabel = `Apri su ${sourceLabel}`;
  const favoriteLabel = isFavorite(track.id) ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti";
  card.innerHTML = `
    <img src="${escapeAttribute(track.cover)}" alt="">
    <div class="track-info">
      <div>
        <p class="track-title">${escapeHtml(track.title)}</p>
        <p class="track-meta">${escapeHtml(track.artist)}${track.album ? ` - ${escapeHtml(track.album)}` : ""}</p>
      </div>
      <p class="track-stats">${formatTime(track.duration)}${track.playCount ? ` - ${formatCount(track.playCount)} ascolti` : ""}</p>
      <div class="track-actions">
        <button class="icon-button track-play" type="button" data-action="play" aria-label="Riproduci ${escapeAttribute(track.title)}" data-tooltip="Riproduci">
          <span aria-hidden="true">${iconSvg("play")}</span>
        </button>
        <div class="track-menu">
          <button class="icon-button track-menu-toggle" type="button" data-action="menu" aria-label="Altre azioni" aria-expanded="false" data-tooltip="Altre azioni">
            <span aria-hidden="true">${iconSvg("moreVertical")}</span>
          </button>
          <div class="track-menu-panel" role="menu">
            <button class="track-menu-item" type="button" data-action="queue" role="menuitem" aria-label="Aggiungi alla coda" title="Aggiungi alla coda">
              <span aria-hidden="true">${iconSvg("queue")}</span>
              <span>Aggiungi alla coda</span>
            </button>
            <button class="track-menu-item" type="button" data-action="favorite" role="menuitem" aria-label="${escapeAttribute(favoriteLabel)}" title="${escapeAttribute(favoriteLabel)}">
              <span aria-hidden="true">${iconSvg(isFavorite(track.id) ? "favoriteFilled" : "favorite")}</span>
              <span>${favoriteLabel}</span>
            </button>
            <a class="track-menu-item" href="${escapeAttribute(track.link)}" target="_blank" rel="noreferrer" role="menuitem" aria-label="${escapeAttribute(sourceActionLabel)}" title="${escapeAttribute(sourceActionLabel)}">
              <span aria-hidden="true">${iconSvg("external")}</span>
              <span>${sourceActionLabel}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const menu = card.querySelector(".track-menu");
  const menuToggle = card.querySelector('[data-action="menu"]');

  card.addEventListener("click", (event) => {
    if (event.target.closest("button, a, .track-menu")) {
      return;
    }
    playTrack(track);
  });

  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === card) {
      event.preventDefault();
      playTrack(track);
    }
  });

  card.querySelector('[data-action="play"]').addEventListener("click", () => playTrack(track));
  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = !menu.classList.contains("open");
    closeTrackMenus();
    menu.classList.toggle("open", shouldOpen);
    menuToggle.setAttribute("aria-expanded", String(shouldOpen));
  });
  card.querySelector('[data-action="queue"]').addEventListener("click", (event) => {
    event.stopPropagation();
    addToQueue(track);
    closeTrackMenus();
  });
  card.querySelector('[data-action="favorite"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(track);
    closeTrackMenus();
  });
  card.querySelector(".track-menu-item[href]").addEventListener("click", () => closeTrackMenus());

  return card;
}

function closeTrackMenus() {
  document.querySelectorAll(".track-menu.open").forEach((menu) => {
    menu.classList.remove("open");
    menu.querySelector(".track-menu-toggle")?.setAttribute("aria-expanded", "false");
  });
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
  const label = state.isPlaying ? "Metti in pausa" : "Riproduci";
  els.playIcon.innerHTML = state.isPlaying ? iconSvg("pause") : iconSvg("play");
  els.playButton.setAttribute("aria-label", label);
  els.playButton.dataset.tooltip = label;
}

function renderQueue() {
  els.queueList.innerHTML = "";
  state.queue.forEach((track, index) => {
    els.queueList.appendChild(createMiniTrack(track, {
      actionLabel: "Rimuovi dalla coda",
      actionIcon: iconSvg("remove"),
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
      actionIcon: iconSvg("favoriteFilled"),
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
    <button class="icon-button" type="button" aria-label="${escapeAttribute(options.actionLabel)}" data-tooltip="${escapeAttribute(options.actionLabel)}">
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

function setResultCount(value) {
  if (els.resultCount) {
    els.resultCount.textContent = value;
  }
}

function iconSvg(name) {
  return ICONS[name] || "";
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
