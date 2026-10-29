/**
 * Nostalgic Procedural WebAudio Lobby Theme & SFX Synthesizer
 * for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Guarantees:
 * - Idempotent user-gesture unlock (ignores keydown `ev.repeat === true`).
 * - Automatic BGM pause while an embedded `<iframe allow="autoplay; fullscreen">`
 *   game is active (`setPausedForEmbedded(true)`), and clean resume on return (`false`).
 * - Automatic BGM pause when document tab is hidden (`visibilitychange`).
 * - Pure WebAudio synthesis (zero browser voice TTS API usage).
 */

function midiToFreq(midi) {
  if (!midi || midi <= 0) return 0;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Upbeat nostalgic Tencent QQ Game Hall lobby marimba + celesta melody (C-major / G-major)
const LOBBY_PATTERN = Object.freeze({
  bpm: 132,
  lead: [
    72, 76, 79, 84, 81, 79, 76, 72,
    74, 77, 81, 86, 84, 79, 76, 74,
    72, 76, 79, 84, 88, 86, 84, 79,
    81, 84, 83, 79, 76, 74, 72, 0,
  ],
  chime: [
    84, 0, 91, 0, 88, 0, 84, 0,
    86, 0, 89, 0, 88, 0, 86, 0,
    84, 0, 91, 0, 96, 0, 91, 0,
    93, 0, 91, 0, 88, 0, 84, 0,
  ],
  bass: [
    48, 0, 55, 0, 57, 0, 52, 0,
    50, 0, 55, 0, 48, 55, 60, 0,
    48, 0, 55, 0, 53, 0, 60, 0,
    55, 0, 59, 0, 48, 55, 60, 0,
  ],
});

export class HallAudioSynth {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._bgmGain = null;
    this._sfxGain = null;

    this._unlocked = false;
    this._unlockCallCount = 0;
    this._muted = false;
    this._pausedForEmbedded = false;
    this._pausedForVisibility = false;
    this._currentTrack = 'hall_lobby';

    this._stepIndex = 0;
    this._seqTimer = null;
    this._bgmStepCount = 0;
    this._sfxCount = 0;
    this._lastSfxType = '';

    this._boundGestureUnlock = (ev) => {
      if (ev && ev.repeat) return;
      if (
        this._unlocked &&
        this._ctx &&
        this._ctx.state === 'running' &&
        (this._muted || this._pausedForEmbedded || this._pausedForVisibility || this._seqTimer !== null)
      ) {
        return;
      }
      this.unlock();
    };

    this._boundVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      this._pausedForVisibility = Boolean(document.hidden);
      this._syncBgmState();
    };

    this._attachListeners();
  }

  _attachListeners() {
    if (typeof window === 'undefined') return;
    const opts = { capture: true, passive: true };
    window.addEventListener('pointerdown', this._boundGestureUnlock, opts);
    window.addEventListener('mousedown', this._boundGestureUnlock, opts);
    window.addEventListener('touchstart', this._boundGestureUnlock, opts);
    window.addEventListener('keydown', this._boundGestureUnlock, opts);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._boundVisibilityChange);
    }
  }

  _ensureContext() {
    if (this._ctx) return this._ctx;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = this._muted ? 0 : 0.34;
      master.connect(ctx.destination);

      const bgm = ctx.createGain();
      bgm.gain.value = this._pausedForEmbedded || this._pausedForVisibility ? 0 : 0.50;
      bgm.connect(master);

      const sfx = ctx.createGain();
      sfx.gain.value = 0.85;
      sfx.connect(master);

      this._ctx = ctx;
      this._masterGain = master;
      this._bgmGain = bgm;
      this._sfxGain = sfx;
      return ctx;
    } catch (_) {
      return null;
    }
  }

  unlock() {
    const firstUnlock = !this._unlocked;
    this._unlocked = true;
    this._unlockCallCount += 1;

    const ctx = this._ensureContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          const p = ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        if (firstUnlock || ctx.state !== 'running') {
          const silent = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = silent;
          src.connect(this._masterGain);
          src.start(0);
        }
      } catch (_) {}
    }

    this._syncBgmState();
  }

  isBgmPlaying() {
    return Boolean(
      this._unlocked &&
      !this._muted &&
      !this._pausedForEmbedded &&
      !this._pausedForVisibility &&
      this._currentTrack &&
      this._seqTimer !== null
    );
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this._ctx && this._masterGain) {
      try {
        const now = this._ctx.currentTime;
        this._masterGain.gain.cancelScheduledValues(now);
        this._masterGain.gain.setTargetAtTime(this._muted ? 0 : 0.34, now, 0.015);
      } catch (_) {}
    }
    this._syncBgmState();
    return this._muted;
  }

  toggleMuted() {
    return this.setMuted(!this._muted);
  }

  isMuted() {
    return this._muted;
  }

  /**
   * Pauses or resumes the QQ Game Hall lobby BGM when entering/leaving an embedded iframe game.
   * @param {boolean} paused
   */
  setPausedForEmbedded(paused) {
    this._pausedForEmbedded = Boolean(paused);
    if (this._ctx && this._bgmGain) {
      try {
        const now = this._ctx.currentTime;
        this._bgmGain.gain.cancelScheduledValues(now);
        const target = this._pausedForEmbedded || this._pausedForVisibility ? 0 : 0.50;
        this._bgmGain.gain.setTargetAtTime(target, now, 0.015);
      } catch (_) {}
    }
    this._syncBgmState();
    return this._pausedForEmbedded;
  }

  _syncBgmState() {
    const shouldPlay =
      this._unlocked &&
      !this._muted &&
      !this._pausedForEmbedded &&
      !this._pausedForVisibility &&
      Boolean(this._currentTrack);

    if (!shouldPlay) {
      if (this._seqTimer !== null) {
        clearInterval(this._seqTimer);
        this._seqTimer = null;
      }
      return;
    }

    if (this._seqTimer !== null) {
      return;
    }

    const stepMs = Math.max(95, Math.round((60 / LOBBY_PATTERN.bpm / 2) * 1000));
    this._seqTimer = setInterval(() => {
      this._tickBgmStep();
    }, stepMs);
  }

  _canSynthesize() {
    return Boolean(
      this._unlocked &&
      !this._muted &&
      this._ctx &&
      this._ctx.state === 'running' &&
      this._sfxGain
    );
  }

  _tickBgmStep() {
    if (this._muted || this._pausedForEmbedded || this._pausedForVisibility) return;
    this._bgmStepCount += 1;

    if (!this._canSynthesize() || !this._bgmGain) return;

    const len = LOBBY_PATTERN.lead.length;
    const idx = this._stepIndex % len;
    this._stepIndex = (this._stepIndex + 1) % len;

    const now = this._ctx.currentTime;
    const stepDur = 60 / LOBBY_PATTERN.bpm / 2;

    const leadMidi = LOBBY_PATTERN.lead[idx];
    if (leadMidi > 0) {
      this._playTone({
        freqStart: midiToFreq(leadMidi),
        freqEnd: midiToFreq(leadMidi),
        type: 'triangle',
        gain: 0.13,
        duration: stepDur * 0.78,
        dest: this._bgmGain,
        startTime: now,
      });
    }

    const chimeMidi = LOBBY_PATTERN.chime[idx];
    if (chimeMidi > 0) {
      this._playTone({
        freqStart: midiToFreq(chimeMidi),
        freqEnd: midiToFreq(chimeMidi),
        type: 'sine',
        gain: 0.08,
        duration: stepDur * 0.9,
        dest: this._bgmGain,
        startTime: now,
      });
    }

    const bassMidi = LOBBY_PATTERN.bass[idx];
    if (bassMidi > 0) {
      this._playTone({
        freqStart: midiToFreq(bassMidi),
        freqEnd: midiToFreq(bassMidi),
        type: 'sine',
        gain: 0.11,
        duration: stepDur * 0.88,
        dest: this._bgmGain,
        startTime: now,
      });
    }
  }

  _playTone({
    freqStart = 440,
    freqEnd = 440,
    type = 'triangle',
    gain = 0.15,
    duration = 0.1,
    dest = null,
    startTime = null,
  }) {
    if (!this._ctx) return;
    const targetNode = dest || this._sfxGain;
    if (!targetNode) return;

    try {
      const t0 = startTime !== null ? startTime : this._ctx.currentTime;
      const osc = this._ctx.createOscillator();
      const env = this._ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freqStart), t0);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
      }

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.014, duration * 0.25));
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(env);
      env.connect(targetNode);
      osc.start(t0);
      osc.stop(t0 + duration + 0.01);
    } catch (_) {}
  }

  playCarouselWhoosh(gameIndex = 0) {
    this._sfxCount += 1;
    this._lastSfxType = 'carousel_whoosh';
    if (!this._canSynthesize()) return;
    const baseFreq = 420 + (gameIndex % 4) * 65;
    const now = this._ctx.currentTime;
    this._playTone({
      freqStart: baseFreq * 0.72,
      freqEnd: baseFreq * 1.35,
      type: 'sine',
      gain: 0.16,
      duration: 0.11,
      startTime: now,
    });
    this._playTone({
      freqStart: baseFreq * 1.5,
      freqEnd: baseFreq * 2.0,
      type: 'triangle',
      gain: 0.12,
      duration: 0.12,
      startTime: now + 0.045,
    });
  }

  playPenguinCheer() {
    this._sfxCount += 1;
    this._lastSfxType = 'penguin_cheer';
    if (!this._canSynthesize()) return;
    const now = this._ctx.currentTime;
    const notes = [587.33, 783.99, 1046.5];
    for (let i = 0; i < notes.length; i += 1) {
      this._playTone({
        freqStart: notes[i],
        freqEnd: notes[i] * 1.06,
        type: 'triangle',
        gain: 0.14,
        duration: 0.085,
        startTime: now + i * 0.055,
      });
    }
  }

  playLaunchFanfare() {
    this._sfxCount += 1;
    this._lastSfxType = 'launch_fanfare';
    if (!this._canSynthesize()) return;
    const now = this._ctx.currentTime;
    const triad = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < triad.length; i += 1) {
      this._playTone({
        freqStart: triad[i],
        freqEnd: triad[i],
        type: 'triangle',
        gain: 0.15,
        duration: 0.11,
        startTime: now + i * 0.05,
      });
    }
  }

  playReturnChime() {
    this._sfxCount += 1;
    this._lastSfxType = 'return_chime';
    if (!this._canSynthesize()) return;
    const now = this._ctx.currentTime;
    this._playTone({
      freqStart: 659.25,
      freqEnd: 880.0,
      type: 'sine',
      gain: 0.14,
      duration: 0.12,
      startTime: now,
    });
  }

  getDiagnostics() {
    return {
      unlocked: this._unlocked,
      unlockCallCount: this._unlockCallCount,
      muted: this._muted,
      bgmPlaying: this.isBgmPlaying(),
      bgmPausedForEmbedded: this._pausedForEmbedded,
      bgmPausedForVisibility: this._pausedForVisibility,
      currentTrack: this._currentTrack,
      bgmStepCount: this._bgmStepCount,
      sfxCount: this._sfxCount,
      lastSfxType: this._lastSfxType,
    };
  }
}
