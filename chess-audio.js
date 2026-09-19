/**
 * chess-audio.js — Zero-Dependency Procedural Web Audio SFX Synthesizer
 * 
 * High-performance, procedurally synthesized sound effects engine for chess.
 * Synthesizes tactile wood snap, weighted collision, check chimes, victory fanfare,
 * minor defeat cadence, and illegal warning buzz via Web Audio API.
 * 
 * Features:
 * - Zero external audio file dependencies (.mp3, .wav)
 * - W3C AudioParam safety (never ramps to 0, always anchors with setValueAtTime)
 * - Master DynamicsCompressorNode brickwall peak limiter
 * - Cached 1.0s mono white noise buffer
 * - Resilient autoplay handling & lazy AudioContext creation
 * - LocalStorage mute preference persistence ('chess_sfx_muted')
 * - Immediate early-return when muted (0 allocation, 0 audio thread overhead)
 * - Automated AudioNode disconnects on 'onended' for GC hygiene
 * - Universal export (CommonJS + ESM + window/globalThis)
 */

// Defensive environment helpers
function getAudioContextConstructor() {
  if (typeof window !== 'undefined') {
    return window.AudioContext || window.webkitAudioContext || null;
  }
  if (typeof globalThis !== 'undefined') {
    return globalThis.AudioContext || globalThis.webkitAudioContext || null;
  }
  return null;
}

function safeGetStorage(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (_) {}
  return null;
}

function safeSetStorage(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
}

class ChessAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this._masterVolume = 0.8;
    this._muted = safeGetStorage('chess_sfx_muted') === 'true';
    this._unlocked = false;

    // Attach passive unlock listeners for immediate autoplay privilege in browsers
    this._attachUnlockListeners();
  }

  /**
   * Proactive user interaction listeners to resume audio context seamlessly.
   */
  _attachUnlockListeners() {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this._unlocked = true;
      const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
      events.forEach((evt) => {
        try {
          document.removeEventListener(evt, unlock, true);
        } catch (_) {}
      });
    };

    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((evt) => {
      try {
        document.addEventListener(evt, unlock, { capture: true, once: true, passive: true });
      } catch (_) {}
    });
  }

  /**
   * Lazily initializes or returns the AudioContext and master bus.
   * @returns {AudioContext|null}
   */
  _ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    const AudioCtxClass = getAudioContextConstructor();
    if (!AudioCtxClass) return null;

    try {
      this.ctx = new AudioCtxClass();
    } catch (_) {
      this.ctx = null;
      return null;
    }

    // Setup Master Limiter / DynamicsCompressorNode (prevents polyphonic clipping)
    try {
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-4.0, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(25.0, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12.0, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.100, this.ctx.currentTime);
    } catch (_) {
      this.compressor = null;
    }

    // Setup Master GainNode
    try {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this._muted ? 0.0 : this._masterVolume,
        this.ctx.currentTime
      );
    } catch (_) {
      this.masterGain = null;
    }

    // Wire master bus: [Sources] -> compressor -> masterGain -> destination
    if (this.compressor && this.masterGain) {
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } else if (this.masterGain) {
      this.masterGain.connect(this.ctx.destination);
    }

    // Pre-generate 1-second white noise buffer for clicks and collisions
    this._initNoiseBuffer();

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Pre-allocates a 1-second mono white noise buffer, reused across transient sounds.
   */
  _initNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferSize = sampleRate * 1; // 1 second
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (_) {
      this.noiseBuffer = null;
    }
  }

  /**
   * Master entry point for sound routing to master compressor or gain.
   */
  _getMasterBus() {
    return this.compressor || this.masterGain;
  }

  /**
   * Explicit initialization contract (called on UI startup or user gesture).
   */
  init() {
    this._ensureContext();
  }

  /**
   * Toggles audio mute state, updates master volume, and persists to localStorage.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this._muted = !this._muted;
    safeSetStorage('chess_sfx_muted', String(this._muted));

    if (this.masterGain && this.ctx) {
      // Instantly silence decaying audio if muting, or restore volume if unmuting
      try {
        this.masterGain.gain.setValueAtTime(
          this._muted ? 0.0 : this._masterVolume,
          this.ctx.currentTime
        );
      } catch (_) {}
    }

    return this._muted;
  }

  /**
   * Checks whether sound effects are currently muted.
   * @returns {boolean}
   */
  isMuted() {
    return Boolean(this._muted);
  }

  // ==========================================
  // PROCEDURAL SOUND SYNTHESIS METHODS
  // (Early-exit optimization applied to all)
  // ==========================================

  /**
   * 1. Move SFX — Tactile Wood Snap (~65ms)
   * Tactile wood snap (triangle glide 190Hz->55Hz + bandpass noise click 1200Hz Q=2.0)
   */
  playMove() {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const targetBus = this._getMasterBus();
    if (!targetBus) return;

    // Sound Sub-Bus with automated disconnection cleanup
    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(0.70, t0);
    soundBus.connect(targetBus);

    // Voice A: Triangle pitch glide (resonant wood body)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.045);

    oscGain.gain.setValueAtTime(0.0001, t0);
    oscGain.gain.exponentialRampToValueAtTime(0.50, t0 + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.065);

    osc.connect(oscGain);
    oscGain.connect(soundBus);
    osc.start(t0);
    osc.stop(t0 + 0.070);

    // Voice B: Filtered noise transient (surface click)
    if (this.noiseBuffer) {
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t0);
      filter.Q.setValueAtTime(2.0, t0);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.001);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(soundBus);
      noiseSource.start(t0);
      noiseSource.stop(t0 + 0.030);

      noiseSource.onended = () => {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          noiseGain.disconnect();
        } catch (_) {}
      };
    }

    // Node cleanup on end of longest voice
    osc.onended = () => {
      try {
        osc.disconnect();
        oscGain.disconnect();
        soundBus.disconnect();
      } catch (_) {}
    };
  }

  /**
   * 2. Capture SFX — Weighted Impact Punch (~140ms)
   * Weighted impact punch (triangle dive 240Hz->38Hz + lowpass swept noise 1600Hz->350Hz Q=2.2)
   */
  playCapture() {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const targetBus = this._getMasterBus();
    if (!targetBus) return;

    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(0.75, t0);
    soundBus.connect(targetBus);

    // Voice A: Heavy low-mid punch
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.095);

    oscGain.gain.setValueAtTime(0.0001, t0);
    oscGain.gain.exponentialRampToValueAtTime(0.70, t0 + 0.003);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.135);

    osc.connect(oscGain);
    oscGain.connect(soundBus);
    osc.start(t0);
    osc.stop(t0 + 0.140);

    // Voice B: Lowpass collision crunch
    if (this.noiseBuffer) {
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, t0);
      filter.frequency.exponentialRampToValueAtTime(350, t0 + 0.050);
      filter.Q.setValueAtTime(2.2, t0);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.50, t0 + 0.002);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(soundBus);
      noiseSource.start(t0);
      noiseSource.stop(t0 + 0.080);

      noiseSource.onended = () => {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          noiseGain.disconnect();
        } catch (_) {}
      };
    }

    osc.onended = () => {
      try {
        osc.disconnect();
        oscGain.disconnect();
        soundBus.disconnect();
      } catch (_) {}
    };
  }

  /**
   * 3. Check SFX — Urgent Dual Chime Chord (~500ms)
   * Urgent dual chime chord (E5 659.25Hz + B5 987.77Hz + overtone 1975.53Hz)
   */
  playCheck() {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const targetBus = this._getMasterBus();
    if (!targetBus) return;

    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(0.65, t0);
    soundBus.connect(targetBus);

    // Voice 1: E5 (659.25 Hz) sine chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, t0);
    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.exponentialRampToValueAtTime(0.40, t0 + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.420);
    osc1.connect(gain1);
    gain1.connect(soundBus);
    osc1.start(t0);
    osc1.stop(t0 + 0.450);

    // Voice 2: B5 (987.77 Hz), staggered strike +15ms
    const t1 = t0 + 0.015;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, t1);
    gain2.gain.setValueAtTime(0.0001, t1);
    gain2.gain.exponentialRampToValueAtTime(0.35, t1 + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.465);
    osc2.connect(gain2);
    gain2.connect(soundBus);
    osc2.start(t1);
    osc2.stop(t1 + 0.485);

    // Voice 3: High overtone shimmer (1975.53 Hz, B6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1975.53, t1);
    gain3.gain.setValueAtTime(0.0001, t1);
    gain3.gain.exponentialRampToValueAtTime(0.08, t1 + 0.003);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.085);
    osc3.connect(gain3);
    gain3.connect(soundBus);
    osc3.start(t1);
    osc3.stop(t1 + 0.100);

    osc2.onended = () => {
      try {
        osc1.disconnect();
        gain1.disconnect();
        osc2.disconnect();
        gain2.disconnect();
        osc3.disconnect();
        gain3.disconnect();
        soundBus.disconnect();
      } catch (_) {}
    };
  }

  /**
   * 4. Victory SFX — Celestial Ascending Fanfare (~980ms)
   * Celestial ascending fanfare arpeggio (C5 523.25Hz, E5 659.25Hz, G5 783.99Hz, C6 1046.50Hz)
   */
  playVictory() {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const targetBus = this._getMasterBus();
    if (!targetBus) return;

    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(0.60, t0);
    soundBus.connect(targetBus);

    // Notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [
      { freq: 523.25, offset: 0.000, dur: 0.280, peak: 0.30 },
      { freq: 659.25, offset: 0.085, dur: 0.280, peak: 0.30 },
      { freq: 783.99, offset: 0.170, dur: 0.320, peak: 0.30 },
      { freq: 1046.50, offset: 0.255, dur: 0.720, peak: 0.38 }
    ];

    const oscs = [];
    const gains = [];

    notes.forEach((note, idx) => {
      const nStart = t0 + note.offset;
      const nStop = nStart + note.dur;

      // Fundamental sine voice
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, nStart);

      gain.gain.setValueAtTime(0.0001, nStart);
      gain.gain.exponentialRampToValueAtTime(note.peak, nStart + 0.010);
      gain.gain.exponentialRampToValueAtTime(0.0001, nStop);

      osc.connect(gain);
      gain.connect(soundBus);
      osc.start(nStart);
      osc.stop(nStop);

      oscs.push(osc);
      gains.push(gain);

      // Warm harmonic triangle on final crown note (C6)
      if (idx === 3) {
        const hOsc = ctx.createOscillator();
        const hGain = ctx.createGain();
        hOsc.type = 'triangle';
        hOsc.frequency.setValueAtTime(note.freq, nStart);

        hGain.gain.setValueAtTime(0.0001, nStart);
        hGain.gain.exponentialRampToValueAtTime(0.10, nStart + 0.012);
        hGain.gain.exponentialRampToValueAtTime(0.0001, nStop);

        hOsc.connect(hGain);
        hGain.connect(soundBus);
        hOsc.start(nStart);
        hOsc.stop(nStop);

        oscs.push(hOsc);
        gains.push(hGain);

        hOsc.onended = () => {
          try {
            oscs.forEach((o) => o.disconnect());
            gains.forEach((g) => g.disconnect());
            soundBus.disconnect();
          } catch (_) {}
        };
      }
    });
  }

  /**
   * 5. Defeat / Stalemate SFX — Subdued Minor Cadence (~780ms)
   * Subdued minor cadence (G4 392.00Hz -> Eb4 311.13Hz downward sigh)
   */
  playDefeat() {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const targetBus = this._getMasterBus();
    if (!targetBus) return;

    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(0.65, t0);
    soundBus.connect(targetBus);

    // Voice 1: G4 (392.00 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(392.00, t0);
    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.linearRampToValueAtTime(0.32, t0 + 0.020);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.260);
    osc1.connect(gain1);
    gain1.connect(soundBus);
    osc1.start(t0);
    osc1.stop(t0 + 0.280);

    // Voice 2: Eb4 (311.13 Hz) descending to 306 Hz
    const t1 = t0 + 0.180;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(311.13, t1);
    osc2.frequency.exponentialRampToValueAtTime(306.00, t1 + 0.550);

    gain2.gain.setValueAtTime(0.0001, t1);
    gain2.gain.linearRampToValueAtTime(0.30, t1 + 0.025);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.580);
    osc2.connect(gain2);
    gain2.connect(soundBus);
    osc2.start(t1);
    osc2.stop(t1 + 0.600);

    osc2.onended = () => {
      try {
        osc1.disconnect();
        gain1.disconnect();
        osc2.disconnect();
        gain2.disconnect();
        soundBus.disconnect();
      } catch (_) {}
    };
  }

  /**
   * 6. Illegal Move SFX — Gentle Warning Low-Pass Buzz (~135ms)
   * Gentle warning lowpass buzz (sawtooth pulses 130.81Hz and 104.65Hz through 280Hz lowpass filter)
   */
  playIllegal() {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const targetBus = this._getMasterBus();
    if (!targetBus) return;

    const soundBus = ctx.createGain();
    soundBus.gain.setValueAtTime(0.70, t0);
    soundBus.connect(targetBus);

    // Dedicated lowpass filter stripping harsh buzz harmonics
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, t0);
    filter.Q.setValueAtTime(2.0, t0);
    filter.connect(soundBus);

    // Pulse 1: Sawtooth at 130.81 Hz (C3)
    const p1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    p1.type = 'sawtooth';
    p1.frequency.setValueAtTime(130.81, t0);
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.linearRampToValueAtTime(0.28, t0 + 0.004);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.050);
    p1.connect(g1);
    g1.connect(filter);
    p1.start(t0);
    p1.stop(t0 + 0.055);

    // Pulse 2: Sawtooth at 104.65 Hz (Ab2) at t0 + 0.065
    const t1 = t0 + 0.065;
    const p2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    p2.type = 'sawtooth';
    p2.frequency.setValueAtTime(104.65, t1);
    g2.gain.setValueAtTime(0.0001, t1);
    g2.gain.linearRampToValueAtTime(0.24, t1 + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.060);
    p2.connect(g2);
    g2.connect(filter);
    p2.start(t1);
    p2.stop(t1 + 0.065);

    p2.onended = () => {
      try {
        p1.disconnect();
        g1.disconnect();
        p2.disconnect();
        g2.disconnect();
        filter.disconnect();
        soundBus.disconnect();
      } catch (_) {}
    };
  }
}

// ==========================================
// UNIVERSAL MODULE EXPORT (CJS + ESM + Window)
// ==========================================
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = { ChessAudioEngine };
  }
  exports.ChessAudioEngine = ChessAudioEngine;
}
if (typeof window !== 'undefined') {
  window.ChessAudioEngine = ChessAudioEngine;
} else if (typeof globalThis !== 'undefined') {
  globalThis.ChessAudioEngine = ChessAudioEngine;
}
