/**
 * Kid-Friendly HUD & Dual-Play Embedded `<iframe allow="autoplay; fullscreen">` Manager
 * for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Enforces:
 * - Strictly <= 6 visible clickable controls at any time (5 in Hall mode, 1 in Embedded mode)
 * - Every visible clickable control >= 68x68px across 1280x800, 1024x768, 844x390, 390x844
 * - Dedicated non-overlapping 84px rail (landscape) / 84px top bar (portrait) in Embedded mode
 *   so the Return Pill never overlaps any embedded game's internal HUD
 * - Zero host sniffing in `resolveEmbeddedIframeSrc`: always `opts.src || gameEntry.liveUrl`
 */

import { GAME_CATALOG, TEST_IDS, UI_MODES } from '../contracts/catalog.js';

export class HallHud {
  /**
   * @param {HTMLElement} rootEl
   * @param {object} callbacks
   */
  constructor(rootEl, callbacks = {}) {
    if (!rootEl) {
      throw new Error('HallHud requires #ui-root container element.');
    }
    this.rootEl = rootEl;
    this.callbacks = callbacks;
    this.uiMode = UI_MODES.HALL;
    this.lastStandaloneOpenedUrl = '';
    this.standaloneOpenCount = 0;

    this._buildDom();
  }

  _buildDom() {
    this.rootEl.innerHTML = `
      <!-- 1. Hall Plaza HUD Overlay (5 clickable controls, all >= 68x68px) -->
      <section id="screen-hall" class="ui-screen screen-hall" data-testid="screen-hall">
        <header class="hall-top-bar">
          <div class="hall-brand-pill" aria-hidden="true">
            <span class="brand-penguin-badge" aria-hidden="true">
              <svg viewBox="0 0 64 64" focusable="false">
                <circle cx="32" cy="32" r="29" fill="#0284c7" stroke="#ffffff" stroke-width="4"/>
                <ellipse cx="32" cy="35" rx="18" ry="20" fill="#1e293b"/>
                <ellipse cx="32" cy="39" rx="13" ry="14" fill="#ffffff"/>
                <circle cx="25" cy="24" r="3.6" fill="#ffffff"/>
                <circle cx="39" cy="24" r="3.6" fill="#ffffff"/>
                <circle cx="25.5" cy="24" r="1.8" fill="#0f172a"/>
                <circle cx="38.5" cy="24" r="1.8" fill="#0f172a"/>
                <ellipse cx="32" cy="30" rx="6.5" ry="3.2" fill="#f59e0b"/>
                <path d="M16 34 Q32 41 48 34" stroke="#ef4444" stroke-width="6" stroke-linecap="round" fill="none"/>
                <rect x="36" y="35" width="6.5" height="12" rx="3" fill="#ef4444"/>
              </svg>
            </span>
            <div class="brand-text-col">
              <div class="brand-title-zh">QQ游戏大厅 3D</div>
              <div class="brand-subtitle-zh">童年四大经典合集 · 企鹅星光广场</div>
            </div>
          </div>

          <button
            type="button"
            class="candy-btn btn-icon-round btn-audio-mute"
            data-testid="${TEST_IDS.BTN_AUDIO_MUTE}"
            aria-label="切换背景音乐"
            title="切换背景音乐 (M)"
          >
            <span class="btn-svg" id="audio-mute-icon" aria-hidden="true"></span>
          </button>
        </header>

        <footer class="hall-bottom-area">
          <div class="selected-game-card" id="selected-game-card" aria-live="polite">
            <div class="selected-card-top">
              <span class="selected-index-pill" id="selected-index-pill">1 / 4</span>
              <span class="selected-category-pill" id="selected-category-pill">经典乱斗</span>
              <span class="selected-title-zh" id="selected-title-zh">QQ堂 3D</span>
            </div>
            <div class="selected-subtitle-zh" id="selected-subtitle-zh">
              糖果水泡大乱斗 · 抢包山 · 机械傀儡 Boss
            </div>
          </div>

          <div class="hall-action-dock">
            <button
              type="button"
              class="candy-btn btn-icon-round btn-carousel-nav"
              data-testid="${TEST_IDS.BTN_PREV_GAME}"
              aria-label="上一款游戏"
              title="上一款游戏 (←)"
            >
              <span class="btn-svg" aria-hidden="true">
                <svg viewBox="0 0 36 36" focusable="false">
                  <path d="M22 8 L12 18 L22 28" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
              </span>
            </button>

            <button
              type="button"
              class="candy-btn btn-play-primary"
              data-testid="${TEST_IDS.BTN_PLAY_EMBEDDED}"
              aria-label="开始游戏"
              title="在大厅内直接开始游戏 (Enter / Space)"
            >
              <span class="btn-svg" aria-hidden="true">
                <svg viewBox="0 0 36 36" focusable="false">
                  <polygon points="11,7 29,18 11,29" fill="#ffffff"/>
                </svg>
              </span>
              <span class="btn-label" id="btn-play-label">开始游戏</span>
            </button>

            <button
              type="button"
              class="candy-btn btn-icon-round btn-carousel-nav"
              data-testid="${TEST_IDS.BTN_NEXT_GAME}"
              aria-label="下一款游戏"
              title="下一款游戏 (→)"
            >
              <span class="btn-svg" aria-hidden="true">
                <svg viewBox="0 0 36 36" focusable="false">
                  <path d="M14 8 L24 18 L14 28" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
              </span>
            </button>

            <button
              type="button"
              class="candy-btn btn-icon-round btn-standalone-launch"
              data-testid="${TEST_IDS.BTN_OPEN_STANDALONE}"
              aria-label="独立窗口打开"
              title="在新标签页独立打开游戏"
            >
              <span class="btn-svg" aria-hidden="true">
                <svg viewBox="0 0 36 36" focusable="false">
                  <path d="M15 9 H27 V21" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <path d="M26 10 L13 23" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
                  <path d="M21 27 H10 V15" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
              </span>
            </button>
          </div>
        </footer>
      </section>

      <!-- 2. Embedded Seamless Player Screen (Dedicated 84px non-overlapping rail/strip + single Return Pill >= 68x68px) -->
      <section id="screen-embedded" class="ui-screen screen-embedded" data-testid="screen-embedded" hidden>
        <aside class="embedded-corner-dock" data-testid="embedded-dock">
          <button
            type="button"
            class="candy-btn btn-return-hall"
            data-testid="${TEST_IDS.BTN_RETURN_HALL}"
            aria-label="返回QQ游戏大厅"
            title="返回QQ游戏大厅 (Esc)"
          >
            <span class="return-pill-icon" aria-hidden="true">🏠</span>
            <span class="btn-label">大厅</span>
          </button>

          <div class="embedded-rail-badge" id="embedded-rail-badge" aria-hidden="true">
            <span class="embedded-rail-dot" id="embedded-rail-dot"></span>
            <span class="embedded-rail-title" id="embedded-rail-title">QQ堂 3D</span>
          </div>
        </aside>

        <iframe
          id="embedded-game-iframe"
          class="embedded-game-iframe"
          data-testid="${TEST_IDS.EMBEDDED_IFRAME}"
          title="QQ Game Hall 3D Embedded Game Player"
          allow="autoplay; fullscreen"
          src="about:blank"
        ></iframe>
      </section>
    `;

    this.hallScreenEl = this.rootEl.querySelector('#screen-hall');
    this.embeddedScreenEl = this.rootEl.querySelector('#screen-embedded');
    this.embeddedDockEl = this.rootEl.querySelector('[data-testid="embedded-dock"]');
    this.iframeEl = this.rootEl.querySelector('#embedded-game-iframe');

    this.indexPillEl = this.rootEl.querySelector('#selected-index-pill');
    this.categoryPillEl = this.rootEl.querySelector('#selected-category-pill');
    this.titleZhEl = this.rootEl.querySelector('#selected-title-zh');
    this.subtitleZhEl = this.rootEl.querySelector('#selected-subtitle-zh');
    this.selectedCardEl = this.rootEl.querySelector('#selected-game-card');
    this.audioMuteIconEl = this.rootEl.querySelector('#audio-mute-icon');
    this.embeddedRailDotEl = this.rootEl.querySelector('#embedded-rail-dot');
    this.embeddedRailTitleEl = this.rootEl.querySelector('#embedded-rail-title');

    this.btnPrevEl = this.rootEl.querySelector(`[data-testid="${TEST_IDS.BTN_PREV_GAME}"]`);
    this.btnPlayEl = this.rootEl.querySelector(`[data-testid="${TEST_IDS.BTN_PLAY_EMBEDDED}"]`);
    this.btnNextEl = this.rootEl.querySelector(`[data-testid="${TEST_IDS.BTN_NEXT_GAME}"]`);
    this.btnStandaloneEl = this.rootEl.querySelector(`[data-testid="${TEST_IDS.BTN_OPEN_STANDALONE}"]`);
    this.btnMuteEl = this.rootEl.querySelector(`[data-testid="${TEST_IDS.BTN_AUDIO_MUTE}"]`);
    this.btnReturnHallEl = this.rootEl.querySelector(`[data-testid="${TEST_IDS.BTN_RETURN_HALL}"]`);

    this.btnPrevEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.callbacks.onPrevGame) this.callbacks.onPrevGame();
    });
    this.btnNextEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.callbacks.onNextGame) this.callbacks.onNextGame();
    });
    this.btnPlayEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.callbacks.onPlayEmbedded) this.callbacks.onPlayEmbedded();
    });
    this.btnStandaloneEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.callbacks.onOpenStandalone) this.callbacks.onOpenStandalone();
    });
    this.btnMuteEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.callbacks.onToggleMute) this.callbacks.onToggleMute();
    });
    this.btnReturnHallEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.callbacks.onReturnHall) this.callbacks.onReturnHall();
    });

    this.syncAudioMuted(false);
  }

  syncSelectedGame(selectedGame) {
    if (!selectedGame) return;
    const total = GAME_CATALOG.length;
    this.indexPillEl.textContent = `${selectedGame.index + 1} / ${total}`;
    this.categoryPillEl.textContent = selectedGame.badgeZh;
    this.categoryPillEl.style.backgroundColor = selectedGame.themeColor;
    this.titleZhEl.textContent = selectedGame.titleZh;
    this.subtitleZhEl.textContent = selectedGame.subtitleZh;
    this.selectedCardEl.style.borderColor = selectedGame.themeColor;

    if (this.embeddedRailDotEl) {
      this.embeddedRailDotEl.style.backgroundColor = selectedGame.themeColor;
    }
    if (this.embeddedRailTitleEl) {
      this.embeddedRailTitleEl.textContent = selectedGame.titleZh;
    }

    this.btnStandaloneEl.setAttribute('data-live-url', selectedGame.liveUrl);
    this.btnStandaloneEl.setAttribute('data-repo-url', selectedGame.repoUrl);
  }

  syncAudioMuted(muted) {
    if (!this.audioMuteIconEl) return;
    if (muted) {
      this.audioMuteIconEl.innerHTML = `
        <svg viewBox="0 0 36 36" focusable="false">
          <path d="M7 14 H13 L21 8 V28 L13 22 H7 Z" fill="#ffffff"/>
          <path d="M25 13 L32 23 M32 13 L25 23" stroke="#fecdd3" stroke-width="3.6" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      this.audioMuteIconEl.innerHTML = `
        <svg viewBox="0 0 36 36" focusable="false">
          <path d="M7 14 H13 L21 8 V28 L13 22 H7 Z" fill="#ffffff"/>
          <path d="M25 13 Q29 18 25 23" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" fill="none"/>
          <path d="M28 9 Q34 18 28 27" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        </svg>
      `;
    }
    this.btnMuteEl.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  /**
   * Computes the effective iframe URL for `gameEntry`:
   * Always returns `opts.src || gameEntry.liveUrl` (zero host sniffing, zero placeholder stubs).
   */
  resolveEmbeddedIframeSrc(gameEntry, opts = {}) {
    if (opts && typeof opts.src === 'string' && opts.src.trim()) {
      return opts.src.trim();
    }
    return gameEntry.liveUrl;
  }

  openEmbeddedView(gameEntry, opts = {}) {
    if (!gameEntry) return null;
    this.uiMode = UI_MODES.EMBEDDED;
    this.syncSelectedGame(gameEntry);

    const targetSrc = this.resolveEmbeddedIframeSrc(gameEntry, opts);
    this.iframeEl.setAttribute('allow', 'autoplay; fullscreen');
    this.iframeEl.setAttribute('data-game-id', gameEntry.id);
    this.iframeEl.setAttribute('data-live-url', gameEntry.liveUrl);
    this.iframeEl.setAttribute('data-repo-url', gameEntry.repoUrl);
    this.iframeEl.setAttribute('src', targetSrc);

    this.hallScreenEl.hidden = true;
    this.embeddedScreenEl.hidden = false;

    return {
      active: true,
      gameId: gameEntry.id,
      titleZh: gameEntry.titleZh,
      liveUrl: gameEntry.liveUrl,
      repoUrl: gameEntry.repoUrl,
      iframeSrc: targetSrc,
      allow: this.iframeEl.getAttribute('allow') || 'autoplay; fullscreen',
      returnPillVisible: !this.embeddedScreenEl.hidden && !this.btnReturnHallEl.hidden,
    };
  }

  closeEmbeddedView() {
    this.uiMode = UI_MODES.HALL;
    this.iframeEl.setAttribute('src', 'about:blank');
    this.iframeEl.removeAttribute('data-game-id');
    this.embeddedScreenEl.hidden = true;
    this.hallScreenEl.hidden = false;
  }

  triggerStandaloneOpen(gameEntry, opts = {}) {
    if (!gameEntry) return '';
    this.lastStandaloneOpenedUrl = gameEntry.liveUrl;
    this.standaloneOpenCount += 1;
    if (opts && opts.suppressPopup) {
      return gameEntry.liveUrl;
    }
    try {
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(gameEntry.liveUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {}
    return gameEntry.liveUrl;
  }

  getVisibleClickableCount() {
    const isVisible = (el) => {
      let cur = el;
      while (cur && cur.nodeType === 1) {
        if (cur.hidden || cur.getAttribute('aria-hidden') === 'true') return false;
        const cs = window.getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
          return false;
        }
        cur = cur.parentElement;
      }
      const selfCs = window.getComputedStyle(el);
      if (selfCs.pointerEvents === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };

    const candidates = Array.from(
      this.rootEl.querySelectorAll('button, a[href], [role="button"]')
    ).filter(isVisible);
    return candidates.length;
  }

  getEmbeddedDiagnostics(selectedGame) {
    const active = this.uiMode === UI_MODES.EMBEDDED && !this.embeddedScreenEl.hidden;
    const rawAttrSrc = this.iframeEl.getAttribute('src') || 'about:blank';
    const dockRect = active && this.embeddedDockEl ? this.embeddedDockEl.getBoundingClientRect() : null;
    const iframeRect = active && this.iframeEl ? this.iframeEl.getBoundingClientRect() : null;
    const pillRect = active && this.btnReturnHallEl ? this.btnReturnHallEl.getBoundingClientRect() : null;

    let dockIframeOverlapArea = 0;
    if (pillRect && iframeRect) {
      const ix = Math.max(0, Math.min(pillRect.right, iframeRect.right) - Math.max(pillRect.left, iframeRect.left));
      const iy = Math.max(0, Math.min(pillRect.bottom, iframeRect.bottom) - Math.max(pillRect.top, iframeRect.top));
      dockIframeOverlapArea = Math.round(ix * iy * 100) / 100;
    }

    return {
      active,
      gameId: active ? (this.iframeEl.getAttribute('data-game-id') || selectedGame?.id || null) : null,
      titleZh: active ? (selectedGame?.titleZh || null) : null,
      liveUrl: active ? (this.iframeEl.getAttribute('data-live-url') || selectedGame?.liveUrl || null) : null,
      repoUrl: active ? (this.iframeEl.getAttribute('data-repo-url') || selectedGame?.repoUrl || null) : null,
      iframeSrc: rawAttrSrc,
      allow: this.iframeEl.getAttribute('allow') || '',
      returnPillVisible: active && !this.btnReturnHallEl.hidden,
      dockIframeOverlapArea,
      dockRect: dockRect
        ? { left: dockRect.left, top: dockRect.top, width: dockRect.width, height: dockRect.height }
        : null,
      iframeRect: iframeRect
        ? { left: iframeRect.left, top: iframeRect.top, width: iframeRect.width, height: iframeRect.height }
        : null,
      standaloneOpenCount: this.standaloneOpenCount,
      lastStandaloneOpenedUrl: this.lastStandaloneOpenedUrl,
    };
  }
}
