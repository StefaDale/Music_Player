const STORAGE_KEY = "open-music-player-state";
const DEFAULT_QUERY = "top hits italia";
const PERSONALIZED_PLAYLIST_LIMIT = 3;
const NAV_COLLAPSE_SCROLL_Y = 220;
const NAV_RESTORE_SCROLL_DELTA = 12;
const LIVE_SEARCH_DEBOUNCE_MS = 360;
const REQUEST_TIMEOUT_MS = 70000;
const API_BASE_URL = getApiBaseUrl();

const ICONS = {
  play: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>',
  pause: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/></svg>',
  moreVertical: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',
  queue: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M4 7h9M4 12h9M4 17h7M17 10v8M13 14h8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>',
  playlist: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M5 6h11M5 11h11M5 16h7M18 15v6M15 18h6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>',
  external: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M9 7h8v8M17 7 7 17" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>',
  remove: '<svg class="ui-icon" viewBox="0 0 24 24" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>',
};

const state = {
  currentTrack: null,
  queue: [],
  playlists: [],
  selectedTrackForPlaylist: null,
  results: [],
  isPlaying: false,
  serverAvailable: false,
  accountsConfigured: false,
  youtubeConfigured: false,
  searchOpen: false,
  navCollapsed: false,
  activeDropdown: "",
  playlistOverlayOpen: false,
  playlistOverlayId: "",
  creditOpen: false,
  authMode: "login",
  authMessage: "",
  authMessageTone: "neutral",
  sessionToken: sessionStorage.getItem("open-music-session") || "",
  user: null,
  resetToken: "",
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
let youtubePlayerReady = false;
let pendingYouTubeTrack = null;
let youtubeProgressTimer = null;
let lastScrollY = window.scrollY || 0;
let liveSearchTimer = 0;

const els = {
  audio: document.getElementById("audio"),
  topbar: document.querySelector(".topbar"),
  playlistNavButton: document.getElementById("playlistNavButton"),
  playlistDropdown: document.getElementById("playlistDropdown"),
  accountNavButton: document.getElementById("accountNavButton"),
  accountDropdown: document.getElementById("accountDropdown"),
  searchToggle: document.getElementById("searchToggle"),
  searchForm: document.getElementById("searchForm"),
  searchOverlay: document.getElementById("searchOverlay"),
  searchOverlayBackdrop: document.getElementById("searchOverlayBackdrop"),
  searchOverlayResults: document.getElementById("searchOverlayResults"),
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
  queueList: document.getElementById("queueList"),
  queueEmpty: document.getElementById("queueEmpty"),
  newPlaylistButton: document.getElementById("newPlaylistButton"),
  playlistForm: document.getElementById("playlistForm"),
  playlistNameInput: document.getElementById("playlistNameInput"),
  playlistTarget: document.getElementById("playlistTarget"),
  playlistSelect: document.getElementById("playlistSelect"),
  addToPlaylistButton: document.getElementById("addToPlaylistButton"),
  playlistList: document.getElementById("playlistList"),
  playlistEmpty: document.getElementById("playlistEmpty"),
  viewAllPlaylistsButton: document.getElementById("viewAllPlaylistsButton"),
  playlistOverlay: document.getElementById("playlistOverlay"),
  playlistOverlayBackdrop: document.getElementById("playlistOverlayBackdrop"),
  playlistOverlayTitle: document.getElementById("playlistOverlayTitle"),
  playlistOverlayMeta: document.getElementById("playlistOverlayMeta"),
  playlistOverlayBackButton: document.getElementById("playlistOverlayBackButton"),
  closePlaylistOverlayButton: document.getElementById("closePlaylistOverlayButton"),
  playlistOverlayList: document.getElementById("playlistOverlayList"),
  authStatus: document.getElementById("authStatus"),
  authForms: document.getElementById("authForms"),
  loginModeButton: document.getElementById("loginModeButton"),
  registerModeButton: document.getElementById("registerModeButton"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  forgotForm: document.getElementById("forgotForm"),
  resetForm: document.getElementById("resetForm"),
  forgotPasswordButton: document.getElementById("forgotPasswordButton"),
  backToLoginButton: document.getElementById("backToLoginButton"),
  logoutButton: document.getElementById("logoutButton"),
  creditToggle: document.getElementById("creditToggle"),
  creditPanel: document.getElementById("creditPanel"),
};

async function init() {
  restoreState();
  readAuthActionFromUrl();
  bindEvents();
  renderAll();
  loadYouTubeApi();
  await detectServer();
  const hasPersonalizedHome = await restoreSession();
  if (!hasPersonalizedHome) {
    runSearch(DEFAULT_QUERY, { syncInput: false });
  }
}

function bindEvents() {
  els.searchToggle.addEventListener("click", () => {
    setSearchOpen(!state.searchOpen, { focus: true });
  });

  els.playlistNavButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNavDropdown("playlist");
  });

  els.accountNavButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNavDropdown("account");
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(els.searchInput.value.trim());
  });

  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    runSearch(els.searchInput.value.trim());
  });
  els.searchInput.addEventListener("input", scheduleLiveSearch);
  els.searchOverlayBackdrop.addEventListener("click", () => setSearchOpen(false, { focusToggle: true }));

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".track-menu")) {
      closeTrackMenus();
    }
    if (!event.target.closest(".nav-item")) {
      closeNavDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTrackMenus();
      if (state.playlistOverlayOpen) {
        closePlaylistOverlay();
        return;
      }
      if (state.activeDropdown) {
        closeNavDropdowns();
        return;
      }
      if (state.searchOpen) {
        setSearchOpen(false, { focusToggle: true });
      }
    }
  });

  window.addEventListener("scroll", () => {
    closeTrackMenus();
    updateNavCollapse();
  }, { passive: true });
  window.addEventListener("resize", () => {
    closeTrackMenus();
    updateNavCollapse(true);
  });

  els.playButton.addEventListener("click", togglePlayback);
  els.prevButton.addEventListener("click", playPreviousTrack);
  els.nextButton.addEventListener("click", playNextTrack);

  els.seekRange.addEventListener("input", () => {
    updateRangeProgress(els.seekRange);
    seekToPlaybackTime(Number(els.seekRange.value));
  });

  els.volumeRange.addEventListener("input", () => {
    applyVolume();
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

  els.newPlaylistButton.addEventListener("click", () => {
    if (!state.user) {
      els.playlistForm.hidden = true;
      els.playlistEmpty.textContent = getAuthPromptMessage();
      els.playlistEmpty.hidden = false;
      setAuthMode("login");
      return;
    }

    els.playlistForm.hidden = !els.playlistForm.hidden;
    if (!els.playlistForm.hidden) {
      els.playlistNameInput.focus();
    }
  });

  els.playlistForm.addEventListener("submit", handleCreatePlaylist);
  els.addToPlaylistButton.addEventListener("click", handleAddSelectedTrackToPlaylist);
  els.viewAllPlaylistsButton.addEventListener("click", () => openPlaylistOverlay());
  els.closePlaylistOverlayButton.addEventListener("click", closePlaylistOverlay);
  els.playlistOverlayBackdrop.addEventListener("click", closePlaylistOverlay);
  els.playlistOverlayBackButton.addEventListener("click", showPlaylistOverlayList);
  els.loginModeButton.addEventListener("click", () => setAuthMode("login"));
  els.registerModeButton.addEventListener("click", () => setAuthMode("register"));
  els.forgotPasswordButton.addEventListener("click", () => setAuthMode("forgot"));
  els.backToLoginButton.addEventListener("click", () => setAuthMode("login"));
  els.loginForm.addEventListener("submit", handleLogin);
  els.registerForm.addEventListener("submit", handleRegister);
  els.forgotForm.addEventListener("submit", handleForgotPassword);
  els.resetForm.addEventListener("submit", handleResetPassword);
  els.logoutButton.addEventListener("click", handleLogout);
  els.creditToggle.addEventListener("click", () => {
    state.creditOpen = !state.creditOpen;
    renderCredit();
  });

  applyVolume();
  updateRangeProgress(els.seekRange);
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
    state.accountsConfigured = Boolean(config.accountsConfigured);
    state.youtubeConfigured = Boolean(config.youtubeConfigured);
    renderAccount();
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
  els.searchForm.classList.add("is-loading");
  els.searchForm.setAttribute("aria-busy", "true");
  els.searchInput.disabled = true;

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
      setMessage("Risultati pronti. Scegli un brano o aggiungilo a una playlist.");
      setResultCount(`${state.results.length} brani`);
    } else {
      setMessage(state.youtubeConfigured
        ? "Nessun brano riproducibile trovato."
        : "Nessun risultato disponibile in questo momento.");
      setResultCount("0 brani");
    }
  } catch (error) {
    if (searchId !== activeSearchId) {
      return;
    }

    console.error(error);
    setMessage(getBackendUnavailableMessage(error));
    setResultCount("Errore");
  } finally {
    if (searchId === activeSearchId) {
      els.searchForm.classList.remove("is-loading");
      els.searchForm.setAttribute("aria-busy", "false");
      els.searchInput.disabled = false;
    }
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(resolveApiUrl(url), {
    credentials: API_BASE_URL ? "omit" : "same-origin",
    signal: controller.signal,
    ...options,
    headers,
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
  const isNativeShell = window.Capacitor?.isNativePlatform?.()
    || window.location.protocol === "capacitor:";
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!isNativeShell && localHosts.has(window.location.hostname)) {
    return "";
  }

  return (window.APP_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
}

function renderAll() {
  renderCurrentTrack();
  renderPlaybackState();
  renderResults();
  renderQueue();
  renderPlaylists();
  renderAccount();
  renderLyrics();
  renderSearch();
  renderNavDropdowns();
  updateNavCollapse(true);
  renderCredit();
}

function renderResults() {
  els.resultsList.innerHTML = "";
  els.searchOverlayResults.innerHTML = "";

  state.results.forEach((track) => {
    els.resultsList.appendChild(createTrackCard(track));
    els.searchOverlayResults.appendChild(createSearchResultRow(track));
  });

  if (state.searchOpen && !state.results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note search-overlay-empty";
    empty.textContent = els.searchForm.classList.contains("is-loading")
      ? "Cerco brani..."
      : "Scrivi per cercare brani, artisti o playlist.";
    els.searchOverlayResults.appendChild(empty);
  }
}

function createSearchResultRow(track) {
  const row = document.createElement("article");
  row.className = "search-result-row";
  row.tabIndex = 0;
  row.setAttribute("aria-label", `Riproduci ${track.title}`);
  row.innerHTML = `
    <img src="${escapeAttribute(track.cover)}" alt="">
    <span>
      <strong>${escapeHtml(track.title)}</strong>
      <small>${escapeHtml(track.artist)}${track.album ? ` - ${escapeHtml(track.album)}` : ""}</small>
    </span>
    <small>${formatTime(track.duration)}</small>
  `;
  row.addEventListener("click", () => {
    playTrack(track);
    setSearchOpen(false);
  });
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      playTrack(track);
      setSearchOpen(false);
    }
  });
  return row;
}

function createTrackCard(track) {
  const card = document.createElement("article");
  card.className = "track-card";
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Riproduci ${track.title}`);
  const sourceLabel = track.source === "youtube" ? "YouTube" : "Audius";
  const sourceActionLabel = `Apri su ${sourceLabel}`;
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
            <button class="track-menu-item" type="button" data-action="playlist" role="menuitem" aria-label="Aggiungi a playlist" title="Aggiungi a playlist">
              <span aria-hidden="true">${iconSvg("playlist")}</span>
              <span>Aggiungi a playlist</span>
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
    card.classList.toggle("menu-open", shouldOpen);
    menuToggle.setAttribute("aria-expanded", String(shouldOpen));
    if (shouldOpen) {
      positionTrackMenu(menu, card);
    }
  });
  card.querySelector('[data-action="queue"]').addEventListener("click", (event) => {
    event.stopPropagation();
    addToQueue(track);
    closeTrackMenus();
  });
  card.querySelector('[data-action="playlist"]').addEventListener("click", (event) => {
    event.stopPropagation();
    selectTrackForPlaylist(track);
    closeTrackMenus();
  });
  card.querySelector(".track-menu-item[href]").addEventListener("click", () => closeTrackMenus());

  return card;
}

function closeTrackMenus() {
  document.querySelectorAll(".track-menu.open").forEach((menu) => {
    menu.closest(".track-card")?.classList.remove("menu-open");
    menu.classList.remove("open");
    menu.querySelector(".track-menu-toggle")?.setAttribute("aria-expanded", "false");
    menu.style.removeProperty("--menu-top");
    menu.style.removeProperty("--menu-left");
    menu.style.removeProperty("--menu-width");
  });
}

function positionTrackMenu(menu, card) {
  const rect = card.getBoundingClientRect();
  const edge = 12;
  const width = Math.min(rect.width, window.innerWidth - edge * 2);
  const left = Math.min(
    window.innerWidth - width - edge,
    Math.max(edge, rect.left),
  );
  const top = rect.bottom + 8;

  menu.style.setProperty("--menu-left", `${left}px`);
  menu.style.setProperty("--menu-top", `${top}px`);
  menu.style.setProperty("--menu-width", `${width}px`);
}

function renderCurrentTrack() {
  const track = state.currentTrack;

  if (!track) {
    document.querySelector(".player")?.classList.add("is-empty");
    els.youtubePlayerWrap.hidden = true;
    els.nowCover.hidden = false;
    els.coverPlaceholder.hidden = false;
    els.nowCover.src = "";
    els.nowTitle.textContent = "Nessun brano";
    els.nowArtist.textContent = "Scegli un brano dai risultati.";
    els.playerCover.src = "";
    els.playerTitle.textContent = "Nessun brano";
    els.playerArtist.textContent = "Scegli una traccia";
    els.seekRange.value = 0;
    els.currentTime.textContent = "0:00";
    els.durationTime.textContent = "0:00";
    updateRangeProgress(els.seekRange);
    els.storeLink.href = "https://audius.co/";
    els.storeLink.setAttribute("aria-disabled", "true");
    els.storeLink.textContent = "Apri sorgente";
    return;
  }

  document.querySelector(".player")?.classList.remove("is-empty");
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

function renderPlaylists() {
  els.playlistList.innerHTML = "";
  els.newPlaylistButton.disabled = !state.user;
  els.playlistTarget.hidden = !state.user || !state.selectedTrackForPlaylist;
  els.addToPlaylistButton.disabled = !state.playlists.length || !state.selectedTrackForPlaylist;
  els.playlistSelect.innerHTML = state.playlists
    .map((playlist) => `<option value="${escapeAttribute(playlist.id)}">${escapeHtml(playlist.name)}</option>`)
    .join("");
  els.viewAllPlaylistsButton.hidden = false;

  if (!state.user) {
    els.playlistForm.hidden = true;
    els.playlistEmpty.textContent = getAuthPromptMessage();
    els.playlistEmpty.hidden = false;
    renderPlaylistOverlay();
    return;
  }

  if (!state.playlists.length) {
    els.playlistEmpty.textContent = "Crea una playlist per iniziare.";
    els.playlistEmpty.hidden = false;
    renderPlaylistOverlay();
    return;
  }

  els.playlistEmpty.hidden = true;
  getRelevantPlaylists().forEach((playlist) => {
    const article = document.createElement("article");
    article.className = "playlist-card compact-playlist-card";
    article.innerHTML = `
      <div class="playlist-card-heading">
        <button class="playlist-open text-button" type="button">
          <h3>${escapeHtml(playlist.name)}</h3>
          <p>${playlist.tracks.length} brani</p>
        </button>
        <button class="icon-button" type="button" aria-label="Elimina ${escapeAttribute(playlist.name)}" data-tooltip="Elimina">
          <span aria-hidden="true">${iconSvg("remove")}</span>
        </button>
      </div>
      <div class="mini-list"></div>
    `;
    article.querySelector(".playlist-open").addEventListener("click", () => openPlaylistOverlay(playlist.id));
    article.querySelector(".icon-button").addEventListener("click", () => deletePlaylist(playlist.id));
    const list = article.querySelector(".mini-list");
    playlist.tracks.slice(0, 2).forEach((entry) => {
      list.appendChild(createMiniTrack(entry.track, {
        actionLabel: "Rimuovi dalla playlist",
        actionIcon: iconSvg("remove"),
        onPlay: () => playTrack(entry.track),
        onAction: () => removeTrackFromPlaylist(playlist.id, entry.id),
      }));
    });
    if (!playlist.tracks.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "Nessun brano salvato.";
      list.appendChild(empty);
    }
    els.playlistList.appendChild(article);
  });
  renderPlaylistOverlay();
}

function renderPlaylistOverlay() {
  els.playlistOverlay.hidden = !state.playlistOverlayOpen;
  if (!state.playlistOverlayOpen) {
    return;
  }

  const selectedPlaylist = state.playlists.find((playlist) => playlist.id === state.playlistOverlayId);
  els.playlistOverlayList.innerHTML = "";
  els.playlistOverlayBackButton.hidden = !selectedPlaylist;

  if (!state.user) {
    els.playlistOverlayTitle.textContent = "Playlist";
    els.playlistOverlayMeta.textContent = "Accedi per vedere le tue playlist private.";
    els.playlistOverlayList.innerHTML = '<p class="empty-note">Account richiesto.</p>';
    return;
  }

  if (selectedPlaylist) {
    renderPlaylistOverlayDetail(selectedPlaylist);
    return;
  }

  els.playlistOverlayTitle.textContent = "Tutte le playlist";
  els.playlistOverlayMeta.textContent = `${state.playlists.length} playlist private`;

  if (!state.playlists.length) {
    els.playlistOverlayList.innerHTML = '<p class="empty-note">Crea una playlist dal menu in alto.</p>';
    return;
  }

  state.playlists.forEach((playlist) => {
    const button = document.createElement("button");
    button.className = "overlay-playlist-card";
    button.type = "button";
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(playlist.name)}</strong>
        <small>${playlist.tracks.length} brani</small>
      </span>
      <span aria-hidden="true">Apri</span>
    `;
    button.addEventListener("click", () => showPlaylistDetail(playlist.id));
    els.playlistOverlayList.appendChild(button);
  });
}

function renderPlaylistOverlayDetail(playlist) {
  els.playlistOverlayTitle.textContent = playlist.name;
  els.playlistOverlayMeta.textContent = `${playlist.tracks.length} brani salvati`;

  const actions = document.createElement("div");
  actions.className = "overlay-detail-actions";
  actions.innerHTML = `
    <button class="small-button danger-action" type="button">Elimina playlist</button>
  `;
  actions.querySelector("button").addEventListener("click", () => deletePlaylist(playlist.id));
  els.playlistOverlayList.appendChild(actions);

  if (!playlist.tracks.length) {
    els.playlistOverlayList.insertAdjacentHTML("beforeend", '<p class="empty-note">Nessun brano salvato in questa playlist.</p>');
    return;
  }

  const list = document.createElement("div");
  list.className = "mini-list overlay-track-list";
  playlist.tracks.forEach((entry) => {
    list.appendChild(createMiniTrack(entry.track, {
      actionLabel: "Rimuovi dalla playlist",
      actionIcon: iconSvg("remove"),
      onPlay: () => playTrack(entry.track),
      onAction: () => removeTrackFromPlaylist(playlist.id, entry.id),
    }));
  });
  els.playlistOverlayList.appendChild(list);
}

function renderAccount() {
  els.logoutButton.hidden = !state.user;
  els.authForms.hidden = Boolean(state.user);

  els.authStatus.classList.remove("success", "error", "neutral");
  els.authStatus.classList.add(state.authMessageTone || "neutral");
  els.authStatus.hidden = false;

  if (state.authMessage) {
    els.authStatus.textContent = state.authMessage;
  } else if (!state.accountsConfigured) {
    els.authStatus.textContent = "Account non ancora configurati sul backend.";
  } else if (state.user) {
    const usernameLabel = state.user.username ? ` (@${state.user.username})` : "";
    els.authStatus.textContent = `Ciao ${state.user.displayName}${usernameLabel}. Playlist sincronizzate e private.`;
  } else {
    els.authStatus.textContent = "";
    els.authStatus.hidden = true;
  }

  const modes = ["login", "register", "forgot", "reset"];
  modes.forEach((mode) => {
    const form = els[`${mode}Form`];
    if (form) {
      form.classList.toggle("active", state.authMode === mode);
      form.hidden = state.authMode !== mode && mode === "reset";
    }
  });
  els.loginForm.classList.toggle("active", state.authMode === "login");
  els.registerForm.classList.toggle("active", state.authMode === "register");
  els.forgotForm.classList.toggle("active", state.authMode === "forgot");
  els.resetForm.classList.toggle("active", state.authMode === "reset");
  els.loginModeButton.classList.toggle("active", state.authMode === "login");
  els.registerModeButton.classList.toggle("active", state.authMode === "register");
}

function getAuthPromptMessage() {
  return state.authMode === "register"
    ? "Registrati per salvare playlist private."
    : "Accedi per salvare playlist private.";
}

function renderSearch() {
  document.body.classList.toggle("search-open", state.searchOpen);
  els.searchOverlay.hidden = !state.searchOpen;
  els.searchForm.setAttribute("aria-hidden", String(!state.searchOpen));
  els.searchToggle.setAttribute("aria-expanded", String(state.searchOpen));
  els.searchToggle.setAttribute("aria-label", state.searchOpen ? "Chiudi ricerca" : "Apri ricerca");
  els.searchToggle.dataset.tooltip = state.searchOpen ? "Chiudi ricerca" : "Cerca";
  renderResults();
}

function scheduleLiveSearch() {
  if (!state.searchOpen) {
    return;
  }

  window.clearTimeout(liveSearchTimer);
  const query = els.searchInput.value.trim();
  if (query.length < 2) {
    return;
  }

  liveSearchTimer = window.setTimeout(() => {
    runSearch(query, { syncInput: false });
  }, LIVE_SEARCH_DEBOUNCE_MS);
}

function updateNavCollapse(force = false) {
  const currentScrollY = window.scrollY || 0;
  const scrolledDown = currentScrollY > lastScrollY;
  const scrolledUpEnough = lastScrollY - currentScrollY >= NAV_RESTORE_SCROLL_DELTA;
  let shouldCollapse = state.navCollapsed;

  if (currentScrollY <= NAV_RESTORE_SCROLL_DELTA || scrolledUpEnough) {
    shouldCollapse = false;
  } else if (currentScrollY > NAV_COLLAPSE_SCROLL_Y && scrolledDown) {
    shouldCollapse = true;
  }

  if (force || shouldCollapse !== state.navCollapsed) {
    state.navCollapsed = shouldCollapse;
    document.body.classList.toggle("nav-collapsed", state.navCollapsed);
  }

  lastScrollY = currentScrollY;
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
        seekToPlaybackTime(line.time);
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
  els.audio.src = resolveApiUrl(track.stream);
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
    ensureYouTubePlayer();
    return;
  }

  const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  window.onYouTubeIframeAPIReady = () => {
    state.youtubeReady = true;
    ensureYouTubePlayer();
  };

  if (!existingScript) {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }
}

function ensureYouTubePlayer() {
  if (!state.youtubeReady || !window.YT?.Player) {
    return;
  }

  if (youtubePlayer) {
    return;
  }

  youtubePlayer = new YT.Player("youtubePlayer", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        youtubePlayerReady = true;
        applyVolume();
        if (pendingYouTubeTrack) {
          startYouTubePlayback(pendingYouTubeTrack);
        }
      },
      onStateChange: handleYouTubeStateChange,
      onError: handleYouTubeError,
    },
  });
}

function startYouTubePlayback(track) {
  if (!state.youtubeReady || !window.YT?.Player) {
    setMessage("Carico il player YouTube...");
    return;
  }

  ensureYouTubePlayer();
  els.youtubePlayerWrap.hidden = false;

  if (!youtubePlayerReady || !youtubePlayer?.loadVideoById) {
    setMessage("Preparo il player YouTube...");
    return;
  }

  youtubePlayer.loadVideoById(track.youtubeId);
  applyVolume();
  youtubePlayer.playVideo();
  startYouTubeTimer();
}

function applyVolume() {
  const volume = Math.min(1, Math.max(0, Number(els.volumeRange.value || 0)));
  els.audio.volume = volume;
  if (youtubePlayer?.setVolume) {
    youtubePlayer.setVolume(Math.round(volume * 100));
  }
  updateRangeProgress(els.volumeRange);
}

function handleYouTubeError(event) {
  const errorCode = event?.data;
  stopYouTubeTimer();
  pendingYouTubeTrack = null;
  state.isPlaying = false;
  renderPlaybackState();
  updateTimeline();
  setMessage(getYouTubeErrorMessage(errorCode));
}

function getYouTubeErrorMessage(errorCode) {
  if (errorCode === 101 || errorCode === 150) {
    return "Il proprietario del video non consente la riproduzione fuori da YouTube. Aprilo su YouTube o scegli un altro risultato.";
  }

  if (errorCode === 100) {
    return "Questo video non e' piu' disponibile o e' privato. Scegli un altro risultato.";
  }

  return "Questo video non si puo' riprodurre nell'app. Puoi aprirlo su YouTube o scegliere un altro risultato.";
}

function handleYouTubeStateChange(event) {
  const stateCode = event.data;

  if (stateCode === YT.PlayerState.PLAYING) {
    pendingYouTubeTrack = null;
    state.isPlaying = true;
    startYouTubeTimer();
  } else if (stateCode === YT.PlayerState.PAUSED) {
    state.isPlaying = false;
  } else if (stateCode === YT.PlayerState.BUFFERING) {
    state.isPlaying = true;
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
    scrollLyricLineIntoPanel(currentLine);
  }

  state.lyrics.activeIndex = index;
}

function scrollLyricLineIntoPanel(lineElement) {
  const targetTop = lineElement.offsetTop
    - (els.lyricsBox.clientHeight / 2)
    + (lineElement.offsetHeight / 2);

  els.lyricsBox.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
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
    toggleYouTubePlayback();
    return;
  }

  if (els.audio.paused) {
    await els.audio.play();
  } else {
    els.audio.pause();
  }
}

function toggleYouTubePlayback() {
  if (!youtubePlayer?.getPlayerState) {
    playYouTubeTrack(state.currentTrack);
    return;
  }

  const states = window.YT?.PlayerState || {};
  const playerState = youtubePlayer.getPlayerState();
  const shouldPause = state.isPlaying
    || playerState === states.PLAYING
    || playerState === states.BUFFERING
    || playerState === states.CUED;

  if (shouldPause) {
    youtubePlayer.pauseVideo?.();
    window.setTimeout(() => {
      const nextState = youtubePlayer?.getPlayerState?.();
      if (nextState === states.PLAYING || nextState === states.BUFFERING) {
        setMessage("YouTube non consente sempre di pausare gli annunci dal controllo dell'app. Usa il player video visibile per mettere in pausa.");
      }
    }, 350);
    return;
  }

  youtubePlayer.playVideo?.();
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

function selectTrackForPlaylist(track) {
  if (!state.user) {
    setMessage("Accedi per salvare brani nelle playlist.");
    setAuthMode("login");
    state.activeDropdown = "account";
    renderNavDropdowns();
    return;
  }

  state.selectedTrackForPlaylist = track;
  state.activeDropdown = "playlist";
  renderNavDropdowns();
  if (!state.playlists.length) {
    els.playlistForm.hidden = false;
    els.playlistNameInput.focus();
    setMessage("Crea una playlist, poi aggiungi il brano selezionato.");
  } else {
    setMessage(`${track.title} pronto per essere aggiunto a una playlist.`);
  }
  renderPlaylists();
}

async function handleCreatePlaylist(event) {
  event.preventDefault();
  if (!state.user) {
    els.playlistForm.hidden = true;
    els.playlistEmpty.textContent = getAuthPromptMessage();
    els.playlistEmpty.hidden = false;
    setAuthMode("login");
    return;
  }

  const submitButton = event.submitter || els.playlistForm.querySelector('button[type="submit"]');
  const name = els.playlistNameInput.value.trim();
  if (!name) {
    return;
  }

  await withButtonLoading(submitButton, "Creo...", async () => {
    const data = await fetchJson("/api/playlists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    state.playlists.unshift(data.playlist);
    els.playlistNameInput.value = "";
    els.playlistForm.hidden = true;
    renderPlaylists();
    setMessage("Playlist creata.");
  }).catch((error) => setMessage(error.message));
}

async function handleAddSelectedTrackToPlaylist() {
  const playlistId = els.playlistSelect.value;
  const track = state.selectedTrackForPlaylist;
  if (!playlistId || !track) {
    return;
  }

  await withButtonLoading(els.addToPlaylistButton, "Aggiungo...", async () => {
    const data = await fetchJson(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      body: JSON.stringify({ track }),
    });
    const playlist = state.playlists.find((item) => item.id === playlistId);
    if (playlist) {
      playlist.tracks.push(data.track);
    }
    state.selectedTrackForPlaylist = null;
    renderPlaylists();
    setMessage(`${track.title} aggiunto alla playlist.`);
  }).catch((error) => setMessage(error.message));
}

async function removeTrackFromPlaylist(playlistId, trackEntryId) {
  try {
    await fetchJson(`/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackEntryId)}`, {
      method: "DELETE",
    });
    const playlist = state.playlists.find((item) => item.id === playlistId);
    if (playlist) {
      playlist.tracks = playlist.tracks.filter((entry) => entry.id !== trackEntryId);
    }
    renderPlaylists();
  } catch (error) {
    setMessage(error.message);
  }
}

async function deletePlaylist(playlistId) {
  try {
    await fetchJson(`/api/playlists/${encodeURIComponent(playlistId)}`, { method: "DELETE" });
    state.playlists = state.playlists.filter((playlist) => playlist.id !== playlistId);
    if (state.playlistOverlayId === playlistId) {
      state.playlistOverlayId = "";
    }
    renderPlaylists();
  } catch (error) {
    setMessage(error.message);
  }
}

async function loadPlaylists() {
  if (!state.sessionToken) {
    state.playlists = [];
    renderPlaylists();
    return;
  }

  try {
    const data = await fetchJson("/api/playlists");
    state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
    renderPlaylists();
  } catch (error) {
    setMessage(error.message);
  }
}

async function loadPersonalizedHome() {
  const query = getPersonalizedHomeQuery();
  if (!query) {
    return false;
  }

  await runSearch(query, { syncInput: false });
  setMessage("Consigli personalizzati dalle tue playlist. Scegli un brano o aggiungilo a una playlist.");
  return true;
}

function getPersonalizedHomeQuery() {
  if (!state.user) {
    return "";
  }

  const playlistTracks = getRelevantPlaylists()
    .flatMap((playlist) => playlist.tracks.map((entry) => entry.track))
    .filter(Boolean);

  if (!playlistTracks.length) {
    return "";
  }

  const artists = getTopValues(playlistTracks.map((track) => track.artist), 2);
  const genres = getTopValues(
    playlistTracks
      .map((track) => track.genre)
      .filter((genre) => genre && genre.toLowerCase() !== "youtube"),
    1,
  );
  const terms = [...artists, ...genres, "hits"].filter(Boolean);
  return terms.length > 1 ? terms.join(" ") : "";
}

function getRelevantPlaylists() {
  return [...state.playlists]
    .sort((a, b) => b.tracks.length - a.tracks.length)
    .slice(0, PERSONALIZED_PLAYLIST_LIMIT);
}

function getTopValues(values, limit) {
  const counts = new Map();
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function toggleNavDropdown(name) {
  state.activeDropdown = state.activeDropdown === name ? "" : name;
  if (state.activeDropdown) {
    state.searchOpen = false;
  }
  renderSearch();
  renderNavDropdowns();
}

function closeNavDropdowns() {
  if (!state.activeDropdown) {
    return;
  }
  state.activeDropdown = "";
  renderNavDropdowns();
}

function renderNavDropdowns() {
  const playlistOpen = state.activeDropdown === "playlist";
  const accountOpen = state.activeDropdown === "account";
  els.playlistDropdown.hidden = !playlistOpen;
  els.accountDropdown.hidden = !accountOpen;
  els.playlistNavButton.setAttribute("aria-expanded", String(playlistOpen));
  els.accountNavButton.setAttribute("aria-expanded", String(accountOpen));
}

function openPlaylistOverlay(playlistId = "") {
  state.playlistOverlayOpen = true;
  state.playlistOverlayId = playlistId;
  closeNavDropdowns();
  renderPlaylistOverlay();
}

function closePlaylistOverlay() {
  state.playlistOverlayOpen = false;
  state.playlistOverlayId = "";
  renderPlaylistOverlay();
}

function showPlaylistOverlayList() {
  state.playlistOverlayId = "";
  renderPlaylistOverlay();
}

function showPlaylistDetail(playlistId) {
  state.playlistOverlayId = playlistId;
  renderPlaylistOverlay();
}

function renderCredit() {
  els.creditPanel.hidden = !state.creditOpen;
  els.creditToggle.setAttribute("aria-expanded", String(state.creditOpen));
}

function setSearchOpen(open, options = {}) {
  state.searchOpen = open;
  if (!open) {
    window.clearTimeout(liveSearchTimer);
  }
  if (open) {
    closeNavDropdowns();
  }
  renderSearch();
  if (open && options.focus) {
    window.setTimeout(() => els.searchInput.focus(), 180);
  } else if (!open && options.focusToggle) {
    els.searchToggle.focus();
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  state.authMessage = "";
  state.authMessageTone = "neutral";
  renderAccount();
  renderPlaylists();
}

function setAuthMessage(message, tone = "neutral") {
  state.authMessage = message;
  state.authMessageTone = tone;
  renderAccount();
}

async function withButtonLoading(button, loadingLabel, task) {
  if (!button) {
    return task();
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = loadingLabel;

  try {
    return await task();
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = originalText;
  }
}

function readAuthActionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get("verify");
  const resetToken = params.get("reset");

  if (verifyToken) {
    verifyAccount(verifyToken);
  }

  if (resetToken) {
    state.resetToken = resetToken;
    state.authMode = "reset";
  }
}

async function verifyAccount(token) {
  try {
    const data = await fetchJson(`/api/auth/verify?token=${encodeURIComponent(token)}`);
    setMessage(data.message || "Account confermato.");
    cleanAuthUrl();
  } catch (error) {
    setMessage(error.message);
  }
}

async function restoreSession() {
  if (!state.sessionToken || !state.accountsConfigured) {
    renderAccount();
    return false;
  }

  try {
    const data = await fetchJson("/api/auth/me");
    state.user = data.user;
    await loadPlaylists();
    return await loadPersonalizedHome();
  } catch (error) {
    state.sessionToken = "";
    sessionStorage.removeItem("open-music-session");
  }
  renderAccount();
  return false;
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(els.loginForm);
  const submitButton = event.submitter || els.loginForm.querySelector('button[type="submit"]');

  setAuthMessage("Accesso in corso...");
  await withButtonLoading(submitButton, "Accesso...", async () => {
    const data = await fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: form.get("identifier") || els.loginForm.querySelector("#loginIdentifier").value,
        password: form.get("password") || els.loginForm.querySelector("#loginPassword").value,
      }),
    });
    state.sessionToken = data.token;
    state.user = data.user;
    sessionStorage.setItem("open-music-session", data.token);
    els.loginForm.reset();
    await loadPlaylists();
    renderAccount();
    setAuthMessage(`Accesso effettuato. Ciao ${data.user.displayName}.`, "success");
    if (!(await loadPersonalizedHome())) {
      setMessage("Accesso effettuato.");
    }
  }).catch((error) => {
    setAuthMessage(error.message, "error");
    setMessage(error.message);
  });
}

async function handleRegister(event) {
  event.preventDefault();
  const form = new FormData(els.registerForm);
  const submitButton = event.submitter || els.registerForm.querySelector('button[type="submit"]');

  setAuthMessage("Creo l'account e preparo la mail di conferma...");
  await withButtonLoading(submitButton, "Creo...", async () => {
    const data = await fetchJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: form.get("displayName"),
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    els.registerForm.reset();
    setAuthMode("login");
    setAuthMessage(data.message || "Controlla la tua email per confermare l'account, anche nella cartella spam.", "success");
  }).catch((error) => {
    setAuthMessage(error.message, "error");
    setMessage(error.message);
  });
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const form = new FormData(els.forgotForm);
  const submitButton = event.submitter || els.forgotForm.querySelector('button[type="submit"]');

  setAuthMessage("Invio il link di reset...");
  await withButtonLoading(submitButton, "Invio...", async () => {
    const data = await fetchJson("/api/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email") }),
    });
    els.forgotForm.reset();
    setAuthMode("login");
    setAuthMessage(data.message, "success");
    setMessage(data.message);
  }).catch((error) => {
    setAuthMessage(error.message, "error");
    setMessage(error.message);
  });
}

async function handleResetPassword(event) {
  event.preventDefault();
  const form = new FormData(els.resetForm);
  const submitButton = event.submitter || els.resetForm.querySelector('button[type="submit"]');

  setAuthMessage("Aggiorno la password...");
  await withButtonLoading(submitButton, "Aggiorno...", async () => {
    const data = await fetchJson("/api/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({
        token: state.resetToken,
        password: form.get("password"),
      }),
    });
    state.resetToken = "";
    els.resetForm.reset();
    cleanAuthUrl();
    setAuthMode("login");
    setAuthMessage(data.message, "success");
    setMessage(data.message);
  }).catch((error) => {
    setAuthMessage(error.message, "error");
    setMessage(error.message);
  });
}

async function handleLogout() {
  await withButtonLoading(els.logoutButton, "Esco...", async () => {
    await fetchJson("/api/auth/logout", { method: "POST" });
  }).catch((error) => {
    // Local cleanup still happens if the server session has already expired.
  });
  state.sessionToken = "";
  state.user = null;
  state.playlists = [];
  state.selectedTrackForPlaylist = null;
  state.playlistOverlayOpen = false;
  state.playlistOverlayId = "";
  state.activeDropdown = "";
  sessionStorage.removeItem("open-music-session");
  state.authMessage = "";
  state.authMessageTone = "neutral";
  renderAccount();
  renderPlaylists();
  renderNavDropdowns();
  setMessage("Logout completato.");
}

function cleanAuthUrl() {
  if (window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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
  updateRangeProgress(els.seekRange);
}

function updateRangeProgress(range) {
  const min = Number(range.min || 0);
  const max = Number(range.max || 100);
  const value = Number(range.value || 0);
  const progress = max > min
    ? ((value - min) / (max - min)) * 100
    : 0;
  range.style.setProperty("--range-progress", `${Math.min(100, Math.max(0, progress))}%`);
}

function getPlaybackTime() {
  if (state.currentTrack?.source === "youtube" && youtubePlayer?.getCurrentTime) {
    return youtubePlayer.getCurrentTime() || 0;
  }

  return Number.isFinite(els.audio.currentTime) ? els.audio.currentTime : 0;
}

function seekToPlaybackTime(time) {
  const targetTime = Number(time);

  if (!Number.isFinite(targetTime)) {
    return;
  }

  if (state.currentTrack?.source === "youtube" && youtubePlayer?.seekTo) {
    youtubePlayer.seekTo(targetTime, true);
  } else if (Number.isFinite(els.audio.duration)) {
    els.audio.currentTime = targetTime;
  }

  updateTimeline();
  updateActiveLyric();
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
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.currentTrack = saved.currentTrack || null;
    state.queue = Array.isArray(saved.queue) ? saved.queue : [];

    if (state.currentTrack?.stream) {
      els.audio.src = resolveApiUrl(state.currentTrack.stream);
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
