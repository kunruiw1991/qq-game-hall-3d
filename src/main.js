/**
 * Master Application Coordinator & Frozen `window.__QQ_HALL__` Diagnostic Seam
 * for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Pure ES2022 module using 100% relative imports.
 */

import {
  FIXED_DT,
  GAME_BY_ID,
  GAME_CATALOG,
  MAX_ACCUMULATOR_SEC,
  TEST_IDS,
  UI_MODES,
  resolveGameEntry,
} from './contracts/catalog.js';
import { PlazaSim } from './sim/plaza_sim.js';
import { PlazaRenderer3D } from './render/plaza_renderer.js';
import { HallAudioSynth } from './audio/hall_audio.js';
import { HallHud } from './ui/hall_hud.js';

function cloneDeep(val) {
  if (val === null || val === undefined) return val;
  return JSON.parse(JSON.stringify(val));
}

function getTrackedErrors() {
  const src =
    typeof window !== 'undefined' && window.__E2E_ERROR_TRACKER__
      ? window.__E2E_ERROR_TRACKER__
      : { jsErrors: [], unhandledRejections: [], resourceErrors: [] };
  return {
    jsErrors: Array.isArray(src.jsErrors) ? src.jsErrors.slice() : [],
    unhandledRejections: Array.isArray(src.unhandledRejections)
      ? src.unhandledRejections.slice()
      : [],
    resourceErrors: Array.isArray(src.resourceErrors) ? src.resourceErrors.slice() : [],
  };
}

function parseInitialGameFromLocation() {
  if (typeof window === 'undefined' || !window.location) return 'tang';
  const rawHash = (window.location.hash || '').replace(/^#+/, '').trim();
  if (rawHash) {
    const entry = resolveGameEntry(rawHash);
    if (entry) return entry.id;
  }
  try {
    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = params.get('game') || params.get('id');
    if (fromQuery) {
      const entry = resolveGameEntry(fromQuery);
      if (entry) return entry.id;
    }
  } catch (_) {}
  return 'tang';
}

function syncUrlHash(gameId) {
  if (typeof window === 'undefined' || !window.history) return;
  const entry = GAME_BY_ID[gameId];
  if (!entry) return;
  try {
    if (window.location.hash !== entry.hash) {
      window.history.replaceState(null, '', entry.hash);
    }
  } catch (_) {}
}

function bootstrapHallApp() {
  const canvas = document.querySelector(`[data-testid="${TEST_IDS.PLAZA_CANVAS}"]`);
  const uiRoot = document.getElementById('ui-root');
  if (!canvas || !uiRoot) {
    throw new Error('Missing #plaza-canvas or #ui-root in index.html');
  }

  const initialGameId = parseInitialGameFromLocation();
  const sim = new PlazaSim(initialGameId);
  const audio = new HallAudioSynth();
  const renderer = new PlazaRenderer3D(canvas);

  let uiMode = UI_MODES.HALL;
  let deterministicMode = false;
  let currentSnapshot = sim.getSnapshot();
  let lastViewportW = 0;
  let lastViewportH = 0;
  let lastRenderEndMs = 0;
  let lastRenderCostMs = 0;
  let disposed = false;
  let rafId = 0;

  const hud = new HallHud(uiRoot, {
    onPrevGame: () => {
      rotateCarousel(-1);
    },
    onNextGame: () => {
      rotateCarousel(1);
    },
    onPlayEmbedded: () => {
      openEmbedded(sim.selectedGameId);
    },
    onOpenStandalone: () => {
      openStandalone(sim.selectedGameId);
    },
    onToggleMute: () => {
      toggleMute();
    },
    onReturnHall: () => {
      closeEmbedded();
    },
  });

  function syncViewportSize(force = false) {
    const w = Math.max(1, Math.round(window.innerWidth || canvas.clientWidth || 1280));
    const h = Math.max(1, Math.round(window.innerHeight || canvas.clientHeight || 800));
    if (force || w !== lastViewportW || h !== lastViewportH) {
      lastViewportW = w;
      lastViewportH = h;
      renderer.resize(w, h);
    }
  }

  function renderFrame() {
    if (disposed) return;
    syncViewportSize(false);
    const t0 = performance.now();
    renderer.render(currentSnapshot);
    const t1 = performance.now();
    lastRenderEndMs = t1;
    lastRenderCostMs = t1 - t0;
  }

  function selectGame(id, opts = {}) {
    const entry = resolveGameEntry(id);
    if (!entry) {
      return getState();
    }
    const prevId = sim.selectedGameId;
    currentSnapshot = sim.selectGame(entry.id, {
      immediateNudge: opts.immediateNudge !== false,
      instantSnap: Boolean(opts.instantSnap),
      cheer: prevId !== entry.id,
    });
    hud.syncSelectedGame(currentSnapshot.selectedGame);
    syncUrlHash(entry.id);
    if (prevId !== entry.id && !opts.silent) {
      audio.playCarouselWhoosh(entry.index);
    }
    renderFrame();
    return getState();
  }

  function rotateCarousel(delta, opts = {}) {
    const prevId = sim.selectedGameId;
    currentSnapshot = sim.rotateCarousel(delta, opts);
    hud.syncSelectedGame(currentSnapshot.selectedGame);
    syncUrlHash(currentSnapshot.selectedGameId);
    if (prevId !== currentSnapshot.selectedGameId || (Number.isInteger(delta) && delta !== 0)) {
      audio.playCarouselWhoosh(currentSnapshot.selectedIndex);
    }
    renderFrame();
    return getState();
  }

  function openEmbedded(id, opts = {}) {
    const targetEntry = id !== undefined && id !== null
      ? resolveGameEntry(id) || GAME_BY_ID[sim.selectedGameId]
      : GAME_BY_ID[sim.selectedGameId] || GAME_CATALOG[0];

    if (targetEntry.id !== sim.selectedGameId) {
      currentSnapshot = sim.selectGame(targetEntry.id, { instantSnap: true });
    }
    syncUrlHash(targetEntry.id);

    uiMode = UI_MODES.EMBEDDED;
    // Automatically pause Hall lobby BGM while inside an embedded game
    audio.playLaunchFanfare();
    audio.setPausedForEmbedded(true);
    hud.openEmbeddedView(targetEntry, opts);
    renderFrame();
    return getState();
  }

  function closeEmbedded() {
    uiMode = UI_MODES.HALL;
    hud.closeEmbeddedView();
    // Cleanly resume Hall lobby BGM on return to the plaza
    audio.setPausedForEmbedded(false);
    audio.playReturnChime();
    sim.triggerPenguinCheer();
    currentSnapshot = sim.getSnapshot();
    renderFrame();
    return getState();
  }

  function openStandalone(id, opts = {}) {
    const entry =
      (id !== undefined && id !== null ? resolveGameEntry(id) : null) ||
      GAME_BY_ID[sim.selectedGameId] ||
      GAME_CATALOG[0];
    audio.playLaunchFanfare();
    hud.triggerStandaloneOpen(entry, opts);
    return getState();
  }

  function toggleMute() {
    const muted = audio.toggleMuted();
    hud.syncAudioMuted(muted);
    return getState();
  }

  function setMuted(muted) {
    const m = audio.setMuted(Boolean(muted));
    hud.syncAudioMuted(m);
    return getState();
  }

  function setDeterministicMode(enabled) {
    deterministicMode = Boolean(enabled);
    return deterministicMode;
  }

  function stepFrames(count = 1) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    syncViewportSize(false);
    if (n === 0) {
      currentSnapshot = sim.getSnapshot();
      renderFrame();
      return getState();
    }
    for (let i = 0; i < n; i += 1) {
      currentSnapshot = sim.step(FIXED_DT);
    }
    hud.syncSelectedGame(currentSnapshot.selectedGame);
    renderFrame();
    return getState();
  }

  function getState() {
    syncViewportSize(false);
    const projections = renderer.getScreenProjections(currentSnapshot);
    const enrichedGames = currentSnapshot.games.map((g) => ({
      ...g,
      screenPos: projections.islandScreens[g.id] || { x: 0, y: 0, visible: false },
    }));

    const stateObj = {
      version: '1.0.0',
      uiMode,
      uiScreen: uiMode,
      tick: currentSnapshot.tick,
      simTime: currentSnapshot.simTime,
      selectedGameId: currentSnapshot.selectedGameId,
      selectedIndex: currentSnapshot.selectedIndex,
      selectedGame: currentSnapshot.selectedGame,
      carousel: currentSnapshot.carousel,
      penguinHost: {
        ...currentSnapshot.penguinHost,
        screenPos: projections.penguinScreen,
      },
      games: enrichedGames,
      embedded: hud.getEmbeddedDiagnostics(currentSnapshot.selectedGame),
      audio: audio.getDiagnostics(),
      hudClickableCount: hud.getVisibleClickableCount(),
      render: renderer.getDiagnostics(),
      errors: getTrackedErrors(),
    };

    return cloneDeep(stateObj);
  }

  // --- Pointer / Touch 1:1 Drag & 3D Raycast Tap Interaction on Canvas ---
  let pointerActive = false;
  let startClientX = 0;
  let startClientY = 0;
  let lastClientX = 0;
  let totalTravelPx = 0;
  let dragStartGameId = sim.selectedGameId;

  function beginDrag(clientX, clientY) {
    if (uiMode !== UI_MODES.HALL) return;
    pointerActive = true;
    startClientX = clientX;
    startClientY = clientY;
    lastClientX = clientX;
    totalTravelPx = 0;
    dragStartGameId = sim.selectedGameId;
    sim.setDragging(true);
  }

  function moveDrag(clientX, clientY) {
    if (!pointerActive || uiMode !== UI_MODES.HALL) return;
    const dx = clientX - lastClientX;
    lastClientX = clientX;
    totalTravelPx = Math.hypot(clientX - startClientX, clientY - startClientY);

    if (totalTravelPx > 6 && Math.abs(dx) > 0) {
      const prevId = sim.selectedGameId;
      currentSnapshot = sim.rotateCarousel(dx * 0.0068, { mode: 'radians' });
      hud.syncSelectedGame(currentSnapshot.selectedGame);
      if (prevId !== currentSnapshot.selectedGameId) {
        syncUrlHash(currentSnapshot.selectedGameId);
        audio.playCarouselWhoosh(currentSnapshot.selectedIndex);
      }
      renderFrame();
    }
  }

  function endDrag(clientX, clientY) {
    if (!pointerActive) return;
    pointerActive = false;
    sim.setDragging(false);

    if (uiMode !== UI_MODES.HALL) return;

    const netDx = clientX - startClientX;
    if (totalTravelPx <= 10) {
      // Direct 3D Raycast Tap on Island or Central QQ Penguin Host!
      const hit = renderer.raycast(clientX, clientY);
      if (hit && hit.type === 'island') {
        const islandAngle = Math.abs(currentSnapshot.carousel.islandAngles[hit.gameId] ?? 99);
        if (hit.gameId === sim.selectedGameId && islandAngle < 0.42) {
          // Tapping the centered island launches it in the embedded player!
          openEmbedded(hit.gameId);
        } else {
          // Tapping an off-center island rotates the carousel to select it!
          selectGame(hit.gameId);
        }
        return;
      }
      if (hit && hit.type === 'penguin') {
        sim.triggerPenguinCheer();
        audio.playPenguinCheer();
        currentSnapshot = sim.getSnapshot();
        renderFrame();
        return;
      }
    } else if (Math.abs(netDx) >= 48 && sim.selectedGameId === dragStartGameId) {
      // Short horizontal flick gesture advances to the neighbor island in swipe direction
      rotateCarousel(netDx < 0 ? 1 : -1);
      return;
    }

    currentSnapshot = sim.getSnapshot();
    renderFrame();
  }

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    beginDrag(ev.clientX, ev.clientY);
  });
  window.addEventListener('mousemove', (ev) => {
    if (!pointerActive) return;
    moveDrag(ev.clientX, ev.clientY);
  });
  window.addEventListener('mouseup', (ev) => {
    if (!pointerActive) return;
    endDrag(ev.clientX, ev.clientY);
  });

  canvas.addEventListener(
    'touchstart',
    (ev) => {
      if (ev.touches && ev.touches.length > 0) {
        const t = ev.touches[0];
        beginDrag(t.clientX, t.clientY);
      }
    },
    { passive: true }
  );
  window.addEventListener(
    'touchmove',
    (ev) => {
      if (!pointerActive || !ev.touches || ev.touches.length === 0) return;
      const t = ev.touches[0];
      moveDrag(t.clientX, t.clientY);
    },
    { passive: true }
  );
  window.addEventListener(
    'touchend',
    (ev) => {
      if (!pointerActive) return;
      const t = (ev.changedTouches && ev.changedTouches[0]) || {
        clientX: lastClientX,
        clientY: startClientY,
      };
      endDrag(t.clientX, t.clientY);
    },
    { passive: true }
  );

  // --- Keyboard Controls (ArrowLeft/ArrowRight + Enter/Space + Escape + KeyM + 1..4) ---
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const code = ev.code || ev.key;

    if (code === 'KeyM') {
      ev.preventDefault();
      toggleMute();
      return;
    }

    if (uiMode === UI_MODES.EMBEDDED) {
      if (code === 'Escape') {
        ev.preventDefault();
        closeEmbedded();
      }
      return;
    }

    if (code === 'ArrowLeft' || code === 'KeyA') {
      ev.preventDefault();
      rotateCarousel(-1);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      ev.preventDefault();
      rotateCarousel(1);
    } else if (code === 'Enter' || code === 'Space') {
      ev.preventDefault();
      openEmbedded(sim.selectedGameId);
    } else if (code === 'Digit1') {
      selectGame(0);
    } else if (code === 'Digit2') {
      selectGame(1);
    } else if (code === 'Digit3') {
      selectGame(2);
    } else if (code === 'Digit4') {
      selectGame(3);
    }
  });

  // --- URL Hash Deep-Linking Listener ---
  window.addEventListener('hashchange', () => {
    const rawHash = (window.location.hash || '').replace(/^#+/, '').trim();
    if (!rawHash) return;
    const entry = resolveGameEntry(rawHash);
    if (entry && entry.id !== sim.selectedGameId) {
      selectGame(entry.id);
    }
  });

  window.addEventListener('resize', () => {
    if (disposed) return;
    syncViewportSize(true);
    renderFrame();
  });

  // Initial sync & render
  hud.syncSelectedGame(currentSnapshot.selectedGame);
  syncUrlHash(currentSnapshot.selectedGameId);
  syncViewportSize(true);
  renderFrame();

  // Fixed-timestep 60Hz animation loop
  let lastRafMs = performance.now();
  let accumulatorSec = 0;

  function onAnimationFrame(nowMs) {
    if (disposed) return;
    const rawDt = Math.max(0, (nowMs - lastRafMs) / 1000);
    lastRafMs = nowMs;

    if (!deterministicMode && uiMode === UI_MODES.HALL) {
      const shouldYieldSoftwareRender =
        lastRenderCostMs > 16 && nowMs - lastRenderEndMs < Math.min(320, lastRenderCostMs * 3.0);

      const clampedDt = Math.min(rawDt, MAX_ACCUMULATOR_SEC);
      accumulatorSec = Math.min(MAX_ACCUMULATOR_SEC, accumulatorSec + clampedDt);
      while (accumulatorSec >= FIXED_DT) {
        currentSnapshot = sim.step(FIXED_DT);
        accumulatorSec -= FIXED_DT;
      }
      if (!shouldYieldSoftwareRender) {
        renderFrame();
      }
    }

    if (!disposed) {
      rafId = requestAnimationFrame(onAnimationFrame);
    }
  }

  rafId = requestAnimationFrame(onAnimationFrame);

  function cleanup() {
    if (disposed) return;
    disposed = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    audio.setMuted(true);
    renderer.dispose();
  }

  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  const publicApi = Object.freeze({
    version: '1.0.0',
    selectGame,
    rotateCarousel,
    openEmbedded,
    closeEmbedded,
    openStandalone,
    stepFrames,
    getState,
    setDeterministicMode,
    setMuted,
    toggleMute,
  });

  Object.defineProperty(window, '__QQ_HALL__', {
    value: publicApi,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  window.__QQ_GAME_HALL__ = publicApi;
}

bootstrapHallApp();
