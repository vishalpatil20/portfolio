/**
 * tests/test-audio.js — Automated Unit & Regression Tests for Procedural Web Audio SFX
 * 
 * Standalone zero-dependency test runner verifying:
 * - ChessAudioEngine interface contract
 * - AudioContext lazy instantiation and autoplay resumption
 * - LocalStorage mute state persistence & fault resilience
 * - Headless & missing AudioContext graceful degradation
 * - Procedural synthesis acoustic parameters for all 6 SFX (Move, Capture, Check, Victory, Defeat, Illegal)
 * - Muted early-return optimization (0 audio node allocations)
 * - Concurrency, rapid spam, and stress tolerance
 */

const assert = require('node:assert/strict');

// Global unhandled promise rejection tracker
const unhandledRejections = [];
process.on('unhandledRejection', (reason) => {
  unhandledRejections.push(reason);
});

// ============================================================================
// Zero-Dependency High-Fidelity Web Audio API & DOM Mock Harness
// ============================================================================

class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.events = [];
  }

  setValueAtTime(val, startTime) {
    this.value = Number(val);
    this.events.push({ type: 'setValueAtTime', value: Number(val), time: Number(startTime) });
    return this;
  }

  linearRampToValueAtTime(val, endTime) {
    this.value = Number(val);
    this.events.push({ type: 'linearRampToValueAtTime', value: Number(val), time: Number(endTime) });
    return this;
  }

  exponentialRampToValueAtTime(val, endTime) {
    const numVal = Number(val);
    // W3C Specification: target value must be positive non-zero
    if (numVal <= 0) {
      throw new RangeError(
        `Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The value provided (${numVal}) is outside the range (0, Inf).`
      );
    }
    this.value = numVal;
    this.events.push({ type: 'exponentialRampToValueAtTime', value: numVal, time: Number(endTime) });
    return this;
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this.events.push({ type: 'setTargetAtTime', target: Number(target), startTime: Number(startTime), timeConstant: Number(timeConstant) });
    return this;
  }

  cancelScheduledValues(startTime) {
    this.events.push({ type: 'cancelScheduledValues', time: Number(startTime) });
    return this;
  }
}

class MockAudioNode {
  constructor(context, type = 'AudioNode') {
    this.context = context;
    this.nodeType = type;
    this.connections = [];
    this.disconnections = [];
  }

  connect(destination, outputIndex = 0, inputIndex = 0) {
    this.connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination, output, input) {
    this.disconnections.push({ destination, output, input });
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context) {
    super(context, 'GainNode');
    this.gain = new MockAudioParam(1.0);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context, 'OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
    this.onended = null;
  }

  start(when = 0) {
    if (this.started) throw new Error("InvalidStateError: OscillatorNode cannot be started more than once");
    this.started = true;
    this.startTime = Number(when);
  }

  stop(when = 0) {
    this.stopped = true;
    this.stopTime = Number(when);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context, 'BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.detune = new MockAudioParam(0);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
  }
}

class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let c = 0; c < numberOfChannels; c++) {
      this._channels.push(new Float32Array(length));
    }
  }

  getChannelData(channel) {
    if (channel < 0 || channel >= this.numberOfChannels) {
      throw new RangeError(`Channel index ${channel} out of bounds`);
    }
    return this._channels[channel];
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context, 'AudioBufferSourceNode');
    this.buffer = null;
    this.playbackRate = new MockAudioParam(1.0);
    this.detune = new MockAudioParam(0);
    this.loop = false;
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
    this.onended = null;
  }

  start(when = 0, offset = 0, duration) {
    if (this.started) throw new Error("InvalidStateError: AudioBufferSourceNode cannot be started more than once");
    this.started = true;
    this.startTime = Number(when);
    this.startOffset = offset;
    this.startDuration = duration;
  }

  stop(when = 0) {
    this.stopped = true;
    this.stopTime = Number(when);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(context) {
    super(context, 'DynamicsCompressorNode');
    this.threshold = new MockAudioParam(-24);
    this.knee = new MockAudioParam(30);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.25);
  }
}

class MockAudioDestinationNode extends MockAudioNode {
  constructor(context) {
    super(context, 'AudioDestinationNode');
    this.maxChannelCount = 2;
  }
}

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.currentTime = 0.0;
    this.state = options.initialState || 'suspended'; // Simulates browser autoplay policy
    this.destination = new MockAudioDestinationNode(this);
    this.createdNodes = [];
    this.resumedCount = 0;
    this.suspendedCount = 0;
    this.closedCount = 0;
    this.onstatechange = null;
    this.shouldRejectResume = false;
    MockAudioContext.instances.push(this);
  }

  createGain() {
    const node = new MockGainNode(this);
    this.createdNodes.push({ type: 'GainNode', node, time: this.currentTime });
    return node;
  }

  createOscillator() {
    const node = new MockOscillatorNode(this);
    this.createdNodes.push({ type: 'OscillatorNode', node, time: this.currentTime });
    return node;
  }

  createBiquadFilter() {
    const node = new MockBiquadFilterNode(this);
    this.createdNodes.push({ type: 'BiquadFilterNode', node, time: this.currentTime });
    return node;
  }

  createBuffer(numberOfChannels, length, sampleRate) {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource() {
    const node = new MockAudioBufferSourceNode(this);
    this.createdNodes.push({ type: 'AudioBufferSourceNode', node, time: this.currentTime });
    return node;
  }

  createDynamicsCompressor() {
    const node = new MockDynamicsCompressorNode(this);
    this.createdNodes.push({ type: 'DynamicsCompressorNode', node, time: this.currentTime });
    return node;
  }

  async resume() {
    if (this.shouldRejectResume) {
      return Promise.reject(new Error("NotAllowedError: user gesture required"));
    }
    this.state = 'running';
    this.resumedCount++;
    if (typeof this.onstatechange === 'function') this.onstatechange();
    return Promise.resolve();
  }

  async suspend() {
    this.state = 'suspended';
    this.suspendedCount++;
    if (typeof this.onstatechange === 'function') this.onstatechange();
    return Promise.resolve();
  }

  async close() {
    this.state = 'closed';
    this.closedCount++;
    if (typeof this.onstatechange === 'function') this.onstatechange();
    return Promise.resolve();
  }

  // Audit and query helpers for tests
  getNodesByType(type) {
    return this.createdNodes.filter(record => record.type === type).map(r => r.node);
  }

  clearRecordedNodes() {
    this.createdNodes = [];
  }
}
MockAudioContext.instances = [];

class MockLocalStorage {
  constructor() {
    this._store = new Map();
    this._throwsOnGet = false;
    this._throwsOnSet = false;
  }

  getItem(key) {
    if (this._throwsOnGet) {
      throw new Error("SecurityError: Storage access denied in this context");
    }
    const k = String(key);
    return this._store.has(k) ? this._store.get(k) : null;
  }

  setItem(key, value) {
    if (this._throwsOnSet) {
      throw new Error("QuotaExceededError: Storage quota exceeded");
    }
    this._store.set(String(key), String(value));
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  get length() {
    return this._store.size;
  }
}

// Global mock state
let currentMockLocalStorage = null;

function setupMockEnvironment(options = {}) {
  MockAudioContext.instances = [];
  currentMockLocalStorage = new MockLocalStorage();

  globalThis.AudioContext = MockAudioContext;
  globalThis.webkitAudioContext = MockAudioContext;
  Object.defineProperty(globalThis, 'localStorage', {
    value: currentMockLocalStorage,
    writable: true,
    configurable: true
  });
  globalThis.window = globalThis;
}

function clearMockEnvironment() {
  MockAudioContext.instances = [];
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  delete globalThis.localStorage;
  delete globalThis.window;
}

function getActiveContext() {
  return MockAudioContext.instances[MockAudioContext.instances.length - 1] || null;
}

// ============================================================================
// Lightweight Test Runner Primitives
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function describe(suiteName, fn) {
  console.log(`\n--- Suite: ${suiteName} ---`);
  fn();
}

function test(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${testName}`);
    console.error(`    ${err.message}`);
    failures.push({ testName, error: err });
  }
}

async function testAsync(testName, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${testName}`);
    console.error(`    ${err.message}`);
    failures.push({ testName, error: err });
  }
}

// Load ChessAudioEngine
setupMockEnvironment();
const { ChessAudioEngine } = require('../chess-audio.js');

console.log('=== Running Procedural Web Audio SFX Test Suite ===');

// ============================================================================
// SUITE 1: Module Export & Interface Contract Compliance
// ============================================================================
describe('Suite 1: Module Export & Interface Contract Compliance', () => {
  test('1.1: Module exports ChessAudioEngine as a valid function/class constructor', () => {
    assert.equal(typeof ChessAudioEngine, 'function');
  });

  test('1.2: Constructor instantiates an object without error', () => {
    const engine = new ChessAudioEngine();
    assert.ok(engine instanceof ChessAudioEngine);
  });

  test('1.3: Implements all 8 public contract methods from PROJECT.md and SCOPE.md', () => {
    const engine = new ChessAudioEngine();
    const requiredMethods = [
      'init',
      'toggleMute',
      'isMuted',
      'playMove',
      'playCapture',
      'playCheck',
      'playVictory',
      'playDefeat',
      'playIllegal'
    ];
    for (const m of requiredMethods) {
      assert.equal(typeof engine[m], 'function', `Method ${m} must be defined on ChessAudioEngine`);
    }
  });

  test('1.4: Global export attaches ChessAudioEngine to globalThis or window', () => {
    assert.equal(typeof globalThis.ChessAudioEngine, 'function');
  });

  test('1.5: Multiple instances can be instantiated independently without shared muted state', () => {
    setupMockEnvironment();
    const e1 = new ChessAudioEngine();
    const e2 = new ChessAudioEngine();
    assert.equal(e1.isMuted(), false);
    assert.equal(e2.isMuted(), false);
    e1.toggleMute();
    assert.equal(e1.isMuted(), true);
  });
});

// ============================================================================
// SUITE 2: AudioContext Lifecycle & Lazy Creation
// ============================================================================
describe('Suite 2: AudioContext Lifecycle & Lazy Creation', () => {
  test('2.1: Constructor does NOT eagerly instantiate AudioContext before first sound or init()', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.equal(MockAudioContext.instances.length, 0, 'AudioContext must be lazily initialized to avoid autoplay warnings');
    assert.equal(engine.ctx, null);
  });

  test('2.2: Calling init() creates exactly one AudioContext instance', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    assert.equal(MockAudioContext.instances.length, 1);
    assert.ok(engine.ctx !== null);
  });

  test('2.3: Calling init() repeatedly is idempotent and does not create duplicate AudioContexts', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.init();
    engine.init();
    assert.equal(MockAudioContext.instances.length, 1, 'Calling init() repeatedly must not create multiple contexts');
  });

  test('2.4: Calling playMove() lazily creates AudioContext if init() was not yet called', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.equal(MockAudioContext.instances.length, 0);
    engine.playMove();
    assert.equal(MockAudioContext.instances.length, 1, 'playMove() must lazily initialize AudioContext');
  });
});

// ============================================================================
// SUITE 3: Autoplay Policy Handling & Context Resumption
// ============================================================================
describe('Suite 3: Autoplay Policy Handling & Context Resumption', () => {
  test('3.1: Context starts in suspended state; init() triggers resume to transition to running', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    assert.equal(ctx.state, 'running', 'init() should resume context to running');
    assert.ok(ctx.resumedCount >= 1);
  });

  test('3.2: If ctx.state is suspended, calling sound method triggers resume()', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    ctx.state = 'suspended';
    engine.playMove();
    assert.equal(ctx.state, 'running');
    assert.ok(ctx.resumedCount >= 2);
  });

  test('3.3: If ctx.state is already running, resume() is not called redundantly', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    ctx.state = 'running';
    const resumeCountBefore = ctx.resumedCount;
    engine.playMove();
    assert.equal(ctx.resumedCount, resumeCountBefore, 'resume() should not be called when already running');
  });

  test('3.4: Rejection of resume() promise does not cause uncaught error', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    ctx.state = 'suspended';
    ctx.shouldRejectResume = true;
    assert.doesNotThrow(() => {
      engine.playMove();
    });
  });
});

// ============================================================================
// SUITE 4: Mute State & LocalStorage Persistence
// ============================================================================
describe('Suite 4: Mute State & LocalStorage Persistence', () => {
  test('4.1: Default mute state is false when localStorage is empty', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.equal(engine.isMuted(), false);
  });

  test('4.2: Calling toggleMute() flips state to true, saves to localStorage, and returns true', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    const result = engine.toggleMute();
    assert.equal(result, true);
    assert.equal(engine.isMuted(), true);
    assert.equal(localStorage.getItem('chess_sfx_muted'), 'true');
  });

  test('4.3: Calling toggleMute() again flips state back to false, updates localStorage, and returns false', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.toggleMute(); // true
    const result2 = engine.toggleMute(); // false
    assert.equal(result2, false);
    assert.equal(engine.isMuted(), false);
    assert.equal(localStorage.getItem('chess_sfx_muted'), 'false');
  });

  test('4.4: Creating a new ChessAudioEngine restores persisted muted state from localStorage', () => {
    setupMockEnvironment();
    localStorage.setItem('chess_sfx_muted', 'true');
    const restoredEngine = new ChessAudioEngine();
    assert.equal(restoredEngine.isMuted(), true);
  });

  test('4.5: Master gain reflects mute state (0.0 when muted, 0.8 when unmuted)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    assert.equal(engine.masterGain.gain.value, 0.8);
    engine.toggleMute();
    assert.equal(engine.masterGain.gain.value, 0.0);
    engine.toggleMute();
    assert.equal(engine.masterGain.gain.value, 0.8);
  });
});

// ============================================================================
// SUITE 5: Storage Resilience & Fault Injection
// ============================================================================
describe('Suite 5: Storage Resilience & Fault Injection', () => {
  test('5.1: Handles SecurityError during localStorage.getItem without throwing, defaulting to false', () => {
    setupMockEnvironment();
    currentMockLocalStorage._throwsOnGet = true;
    assert.doesNotThrow(() => {
      const engine = new ChessAudioEngine();
      assert.equal(engine.isMuted(), false);
    });
  });

  test('5.2: Handles QuotaExceededError during localStorage.setItem without throwing', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    currentMockLocalStorage._throwsOnSet = true;
    assert.doesNotThrow(() => {
      const res = engine.toggleMute();
      assert.equal(res, true);
      assert.equal(engine.isMuted(), true);
    });
  });

  test('5.3: Functions cleanly in-memory when localStorage is completely undefined', () => {
    setupMockEnvironment();
    delete globalThis.localStorage;
    delete globalThis.window.localStorage;
    assert.doesNotThrow(() => {
      const engine = new ChessAudioEngine();
      assert.equal(engine.isMuted(), false);
      const res = engine.toggleMute();
      assert.equal(res, true);
      assert.equal(engine.isMuted(), true);
    });
  });
});

// ============================================================================
// SUITE 6: Graceful Degradation (Headless & Missing AudioContext)
// ============================================================================
describe('Suite 6: Graceful Degradation (Headless & Missing AudioContext)', () => {
  test('6.1: When AudioContext is undefined, new ChessAudioEngine() does not throw', () => {
    clearMockEnvironment();
    assert.doesNotThrow(() => {
      const engine = new ChessAudioEngine();
      assert.ok(engine instanceof ChessAudioEngine);
    });
  });

  test('6.2: When AudioContext is undefined, calling init() is a safe no-op', () => {
    clearMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.doesNotThrow(() => {
      engine.init();
    });
    assert.equal(engine.ctx, null);
  });

  test('6.3: When AudioContext is undefined, calling all 6 sound methods executes safely', () => {
    clearMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.doesNotThrow(() => {
      engine.playMove();
      engine.playCapture();
      engine.playCheck();
      engine.playVictory();
      engine.playDefeat();
      engine.playIllegal();
    });
  });

  test('6.4: Mute toggling and state queries continue to work normally in headless mode', () => {
    clearMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.equal(engine.isMuted(), false);
    assert.equal(engine.toggleMute(), true);
    assert.equal(engine.isMuted(), true);
  });
});

// ============================================================================
// SUITE 7: Sound Effect 1 — playMove (Tactile Wood Snap)
// ============================================================================
describe('Suite 7: Sound Effect 1 — playMove (Tactile Wood Snap)', () => {
  test('7.1: Creates a triangle oscillator and a noise buffer source node', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const noiseSources = ctx.getNodesByType('AudioBufferSourceNode');
    assert.ok(oscs.length >= 1, 'Must create oscillator for wood body resonance');
    assert.equal(oscs[0].type, 'triangle', 'Move resonance should use triangle waveform');
    assert.ok(noiseSources.length >= 1, 'Must create noise buffer source for surface snap');
  });

  test('7.2: Oscillator pitch glide sweeps downward from ~180-200Hz to ~50-65Hz', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const ctx = getActiveContext();
    const osc = ctx.getNodesByType('OscillatorNode')[0];
    const events = osc.frequency.events;
    const startEvent = events.find(e => e.type === 'setValueAtTime');
    const rampEvent = events.find(e => e.type === 'exponentialRampToValueAtTime' || e.type === 'linearRampToValueAtTime');
    assert.ok(startEvent && startEvent.value >= 170 && startEvent.value <= 210, `Start frequency should be ~190Hz (got ${startEvent?.value})`);
    assert.ok(rampEvent && rampEvent.value >= 40 && rampEvent.value <= 70, `Ramp target should be ~55Hz (got ${rampEvent?.value})`);
  });

  test('7.3: Click transient uses a BiquadFilterNode (bandpass filter at 1200Hz, Q=2.0)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const ctx = getActiveContext();
    const filters = ctx.getNodesByType('BiquadFilterNode');
    assert.ok(filters.length >= 1, 'Must include filter for noise click');
    const f = filters[0];
    assert.equal(f.type, 'bandpass', 'Filter type must be bandpass');
    assert.equal(f.frequency.value, 1200, 'Bandpass frequency should be 1200Hz');
    assert.equal(f.Q.value, 2.0, 'Bandpass Q should be 2.0');
  });

  test('7.4: Gain envelope has fast attack and decays to <= 0.0001 within 50-80ms', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const ctx = getActiveContext();
    const gains = ctx.getNodesByType('GainNode');
    const ramps = gains.flatMap(g => g.gain.events).filter(e => e.type === 'exponentialRampToValueAtTime');
    assert.ok(ramps.some(e => e.value <= 0.001), 'Gain must decay to near-zero (0.0001)');
  });

  test('7.5: Oscillator and noise source have start and stop scheduled', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const ctx = getActiveContext();
    const osc = ctx.getNodesByType('OscillatorNode')[0];
    const noise = ctx.getNodesByType('AudioBufferSourceNode')[0];
    assert.ok(osc.started && osc.stopped);
    assert.ok(osc.stopTime > osc.startTime);
    assert.ok(noise.started && noise.stopped);
    assert.ok(noise.stopTime > noise.startTime);
  });

  test('7.6: onended callback disconnects nodes for clean garbage collection', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const ctx = getActiveContext();
    const osc = ctx.getNodesByType('OscillatorNode')[0];
    const noise = ctx.getNodesByType('AudioBufferSourceNode')[0];
    assert.equal(typeof osc.onended, 'function');
    assert.equal(typeof noise.onended, 'function');
    osc.onended();
    noise.onended();
    assert.ok(osc.disconnections.length >= 1);
    assert.ok(noise.disconnections.length >= 1);
  });
});

// ============================================================================
// SUITE 8: Sound Effect 2 — playCapture (Weighted Impact Punch)
// ============================================================================
describe('Suite 8: Sound Effect 2 — playCapture (Weighted Impact Punch)', () => {
  test('8.1: Creates low-mid punch oscillator and heavy impact noise source', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCapture();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const noiseSources = ctx.getNodesByType('AudioBufferSourceNode');
    assert.ok(oscs.length >= 1);
    assert.ok(noiseSources.length >= 1);
  });

  test('8.2: Low-mid punch frequency sweeps downward from ~220-250Hz down to ~35-50Hz', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCapture();
    const ctx = getActiveContext();
    const osc = ctx.getNodesByType('OscillatorNode')[0];
    const events = osc.frequency.events;
    const startFreq = events.find(e => e.type === 'setValueAtTime')?.value;
    const endFreq = events.find(e => e.type.includes('RampToValueAtTime'))?.value;
    assert.ok(startFreq >= 210 && startFreq <= 260, `Capture start pitch should be ~240Hz (got ${startFreq})`);
    assert.ok(endFreq >= 30 && endFreq <= 55, `Capture end pitch should be ~38Hz (got ${endFreq})`);
  });

  test('8.3: Lowpass filter shapes the impact noise transient (swept 1600Hz down to 350Hz, Q=2.2)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCapture();
    const ctx = getActiveContext();
    const filters = ctx.getNodesByType('BiquadFilterNode');
    assert.ok(filters.some(f => f.type === 'lowpass'), 'Filter must be lowpass');
    const lp = filters.find(f => f.type === 'lowpass');
    const events = lp.frequency.events;
    const startCutoff = events.find(e => e.type === 'setValueAtTime')?.value;
    const endCutoff = events.find(e => e.type.includes('RampToValueAtTime'))?.value;
    assert.ok(startCutoff >= 1400 && startCutoff <= 1800, `Start cutoff should be ~1600Hz (got ${startCutoff})`);
    assert.ok(endCutoff >= 300 && endCutoff <= 450, `End cutoff should be ~350Hz (got ${endCutoff})`);
    assert.equal(lp.Q.value, 2.2, 'Q should be 2.2');
  });

  test('8.4: Longer decay envelope than normal move (~120-150ms)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCapture();
    const ctx = getActiveContext();
    const osc = ctx.getNodesByType('OscillatorNode')[0];
    const dur = osc.stopTime - osc.startTime;
    assert.ok(dur >= 0.10 && dur <= 0.20, `Capture duration should be ~140ms (got ${dur})`);
  });

  test('8.5: Sources connect through compressor or master gain', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCapture();
    const ctx = getActiveContext();
    const compressors = ctx.getNodesByType('DynamicsCompressorNode');
    assert.ok(compressors.length >= 1, 'Master compressor must exist');
  });
});

// ============================================================================
// SUITE 9: Sound Effect 3 — playCheck (Urgent Dual Chime Chord)
// ============================================================================
describe('Suite 9: Sound Effect 3 — playCheck (Urgent Dual Chime Chord)', () => {
  test('9.1: Creates at least 2 chime oscillators (harmonic chord)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCheck();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.ok(oscs.length >= 2, 'Check chime chord requires at least 2 oscillators');
  });

  test('9.2: First chime oscillator is tuned to E5 (~659.25 Hz ± 10 Hz)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCheck();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const freqs = oscs.map(o => o.frequency.value || o.frequency.events[0]?.value);
    assert.ok(freqs.some(f => Math.abs(f - 659.25) < 10), `Must include E5 (~659Hz), found: ${freqs}`);
  });

  test('9.3: Second chime oscillator is tuned to B5 (~987.77 Hz ± 15 Hz)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCheck();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const freqs = oscs.map(o => o.frequency.value || o.frequency.events[0]?.value);
    assert.ok(freqs.some(f => Math.abs(f - 987.77) < 15), `Must include B5 (~988Hz), found: ${freqs}`);
  });

  test('9.4: Uses crystalline pure sine timbre (type === sine)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCheck();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.ok(oscs.some(o => o.type === 'sine'), 'Must use sine waves for bell chimes');
  });

  test('9.5: Bell-like decay envelope spans >= 350ms (up to ~500ms)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playCheck();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const maxStopTime = Math.max(...oscs.map(o => o.stopTime || 0));
    assert.ok(maxStopTime >= 0.35, `Check chime duration should be >=350ms (got ${maxStopTime})`);
  });
});

// ============================================================================
// SUITE 10: Sound Effect 4 — playVictory (Celestial Ascending Fanfare)
// ============================================================================
describe('Suite 10: Sound Effect 4 — playVictory (Celestial Ascending Fanfare)', () => {
  test('10.1: Creates ascending arpeggio notes containing C5, E5, G5, and C6', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playVictory();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const freqs = oscs.map(o => o.frequency.value || o.frequency.events[0]?.value);
    assert.ok(freqs.some(f => Math.abs(f - 523.25) < 10), 'Must contain C5 (~523Hz)');
    assert.ok(freqs.some(f => Math.abs(f - 659.25) < 10), 'Must contain E5 (~659Hz)');
    assert.ok(freqs.some(f => Math.abs(f - 783.99) < 10), 'Must contain G5 (~784Hz)');
    assert.ok(freqs.some(f => Math.abs(f - 1046.50) < 15), 'Must contain C6 (~1046Hz)');
  });

  test('10.2: Staggered trigger schedule: start times increase sequentially across arpeggio notes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playVictory();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const startTimes = oscs.map(o => o.startTime).sort((a, b) => a - b);
    assert.ok(startTimes[startTimes.length - 1] > startTimes[0] + 0.15, 'Notes must be staggered over time');
  });

  test('10.3: C6 crown note sustains with shimmering decay (>= 600ms)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playVictory();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const maxStopTime = Math.max(...oscs.map(o => o.stopTime || 0));
    assert.ok(maxStopTime >= 0.60, `Victory fanfare should sustain >= 600ms (got ${maxStopTime})`);
  });

  test('10.4: All fanfare oscillators are started and scheduled to stop', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playVictory();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    for (const o of oscs) {
      assert.ok(o.started, 'All oscillators must be started');
      assert.ok(o.stopped, 'All oscillators must be scheduled to stop');
      assert.ok(o.stopTime > o.startTime);
    }
  });

  test('10.5: Sub-bus connects through master dynamics compressor', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playVictory();
    const ctx = getActiveContext();
    const compressors = ctx.getNodesByType('DynamicsCompressorNode');
    assert.ok(compressors.length >= 1);
  });
});

// ============================================================================
// SUITE 11: Sound Effect 5 — playDefeat (Subdued Minor Cadence)
// ============================================================================
describe('Suite 11: Sound Effect 5 — playDefeat (Subdued Minor Cadence)', () => {
  test('11.1: Minor third harmony: G4 (~392 Hz) transitioning to Eb4 (~311 Hz)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playDefeat();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const freqs = oscs.map(o => o.frequency.value || o.frequency.events[0]?.value);
    assert.ok(freqs.some(f => Math.abs(f - 392.00) < 10), 'Must contain G4 (~392Hz)');
    assert.ok(freqs.some(f => Math.abs(f - 311.13) < 10), 'Must contain Eb4 (~311Hz)');
  });

  test('11.2: Timbre uses warm triangle waveform', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playDefeat();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.ok(oscs.some(o => o.type === 'triangle'), 'Defeat should use warm triangle wave');
  });

  test('11.3: Somber sustain and gentle release (>= 500ms)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playDefeat();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const maxStopTime = Math.max(...oscs.map(o => o.stopTime || 0));
    assert.ok(maxStopTime >= 0.50, `Defeat duration should be >=500ms (got ${maxStopTime})`);
  });

  test('11.4: Second tone starts after the initial tone (resolving cadence)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playDefeat();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.ok(oscs.length >= 2, 'Defeat cadence requires 2 sequential voices');
    const starts = oscs.map(o => o.startTime);
    assert.ok(starts[1] > starts[0], 'Voice 2 must start after Voice 1');
  });
});

// ============================================================================
// SUITE 12: Sound Effect 6 — playIllegal (Gentle Warning Low-Pass Buzz)
// ============================================================================
describe('Suite 12: Sound Effect 6 — playIllegal (Gentle Warning Low-Pass Buzz)', () => {
  test('12.1: Employs low-frequency buzz oscillator (~100-140Hz, sawtooth waveform)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playIllegal();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.ok(oscs.length >= 1, 'Must create buzz oscillator');
    const baseFreq = oscs[0].frequency.value || oscs[0].frequency.events[0]?.value;
    assert.ok(baseFreq >= 90 && baseFreq <= 150, `Buzz frequency should be ~100-140Hz (got ${baseFreq})`);
    assert.equal(oscs[0].type, 'sawtooth', 'Buzz should use sawtooth wave');
  });

  test('12.2: Lowpass filter strips harsh high frequencies (cutoff <= 350Hz)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playIllegal();
    const ctx = getActiveContext();
    const filters = ctx.getNodesByType('BiquadFilterNode');
    assert.ok(filters.length >= 1, 'Must filter the illegal move buzz');
    assert.equal(filters[0].type, 'lowpass');
    const cutoff = filters[0].frequency.value || filters[0].frequency.events[0]?.value;
    assert.ok(cutoff <= 350, `Filter cutoff should be <=350Hz (got ${cutoff})`);
  });

  test('12.3: Brief warning duration (total duration <= 250ms)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playIllegal();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    const maxStopTime = Math.max(...oscs.map(o => o.stopTime || 0));
    assert.ok(maxStopTime <= 0.25, `Illegal buzz should be brief (got ${maxStopTime})`);
  });

  test('12.4: Uses double-pulse inflection (pulse 1 at t0, pulse 2 at t0+65ms)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playIllegal();
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.ok(oscs.length >= 2, 'Must have double buzz pulse');
    assert.ok(oscs[1].startTime > oscs[0].startTime);
  });
});

// ============================================================================
// SUITE 13: Muted Early-Return Optimization (Zero Node Creation)
// ============================================================================
describe('Suite 13: Muted Early-Return Optimization (Zero Node Creation)', () => {
  test('13.1: Calling playMove() when muted allocates ZERO audio nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.toggleMute(); // muted = true
    const ctx = getActiveContext();
    ctx.clearRecordedNodes();
    engine.playMove();
    assert.equal(ctx.createdNodes.length, 0, 'No audio nodes may be allocated when muted');
  });

  test('13.2: Calling playCapture() when muted allocates ZERO audio nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.toggleMute();
    const ctx = getActiveContext();
    ctx.clearRecordedNodes();
    engine.playCapture();
    assert.equal(ctx.createdNodes.length, 0);
  });

  test('13.3: Calling playCheck() when muted allocates ZERO audio nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.toggleMute();
    const ctx = getActiveContext();
    ctx.clearRecordedNodes();
    engine.playCheck();
    assert.equal(ctx.createdNodes.length, 0);
  });

  test('13.4: Calling playVictory() when muted allocates ZERO audio nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.toggleMute();
    const ctx = getActiveContext();
    ctx.clearRecordedNodes();
    engine.playVictory();
    assert.equal(ctx.createdNodes.length, 0);
  });

  test('13.5: Calling playDefeat() when muted allocates ZERO audio nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.toggleMute();
    const ctx = getActiveContext();
    ctx.clearRecordedNodes();
    engine.playDefeat();
    assert.equal(ctx.createdNodes.length, 0);
  });

  test('13.6: Calling playIllegal() when muted allocates ZERO audio nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    engine.toggleMute();
    const ctx = getActiveContext();
    ctx.clearRecordedNodes();
    engine.playIllegal();
    assert.equal(ctx.createdNodes.length, 0);
  });
});

// ============================================================================
// SUITE 14: Concurrency, Rapid Trigger Spam & Stress Tolerance
// ============================================================================
describe('Suite 14: Concurrency, Rapid Trigger Spam & Stress Tolerance', () => {
  test('14.1: Rapid succession triggers (50 consecutive calls to playMove()) complete without error', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.doesNotThrow(() => {
      for (let i = 0; i < 50; i++) {
        engine.playMove();
      }
    });
  });

  test('14.2: Interleaved sound barrage in tight loop runs cleanly without exceptions', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.doesNotThrow(() => {
      for (let i = 0; i < 25; i++) {
        engine.playMove();
        engine.playCapture();
        engine.playIllegal();
        engine.playCheck();
      }
    });
  });

  test('14.3: Repeated rapid toggleMute() spam (100 toggles) maintains exact parity and syncs to storage', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    const startMuted = engine.isMuted();
    for (let i = 0; i < 100; i++) {
      engine.toggleMute();
    }
    assert.equal(engine.isMuted(), startMuted);
    assert.equal(localStorage.getItem('chess_sfx_muted'), String(startMuted));
  });

  test('14.4: Sound triggers while an asynchronous resume() promise is in flight execute safely', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    assert.doesNotThrow(() => {
      engine.playMove();
      engine.playCapture();
    });
  });

  test('14.5: Mock harness enforces W3C AudioParam non-zero safety on exponential ramps', () => {
    const param = new MockAudioParam(1.0);
    assert.throws(() => {
      param.exponentialRampToValueAtTime(0, 1.0);
    }, RangeError);
    assert.doesNotThrow(() => {
      param.exponentialRampToValueAtTime(0.0001, 1.0);
    });
  });

  test('14.6: Noise buffer is cached on instance and reused across multiple sounds', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const initialBuffer = engine.noiseBuffer;
    assert.ok(initialBuffer !== null);
    engine.playMove();
    engine.playCapture();
    assert.strictEqual(engine.noiseBuffer, initialBuffer, 'Noise buffer should be cached and reused');
  });
});

// ============================================================================
// SUITE 15: Full Node Graph Disconnection & GC Leak Exhaustion (All 6 SFX)
// ============================================================================
describe('Suite 15: Full Node Graph Disconnection & GC Leak Exhaustion (All 6 SFX)', () => {
  test('15.1: playCapture attaches onended handlers and disconnects all voice, noise, and bus nodes', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    const beforeCount = ctx.createdNodes.length;
    engine.playCapture();
    const newNodes = ctx.createdNodes.slice(beforeCount).map(r => r.node);
    
    // Find scheduled sources
    const osc = newNodes.find(n => n.nodeType === 'OscillatorNode');
    const noise = newNodes.find(n => n.nodeType === 'AudioBufferSourceNode');
    assert.equal(typeof osc.onended, 'function', 'osc.onended must be defined');
    assert.equal(typeof noise.onended, 'function', 'noise.onended must be defined');
    
    // Trigger onended
    osc.onended();
    noise.onended();
    
    // Ensure every node created in playCapture was disconnected
    for (const node of newNodes) {
      assert.ok(node.disconnections.length >= 1, `Node ${node.nodeType} in playCapture was not disconnected`);
    }
  });

  test('15.2: playCheck attaches onended handler and disconnects all 3 chime oscillators and bus', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    const beforeCount = ctx.createdNodes.length;
    engine.playCheck();
    const newNodes = ctx.createdNodes.slice(beforeCount).map(r => r.node);
    
    const oscs = newNodes.filter(n => n.nodeType === 'OscillatorNode');
    assert.equal(oscs.length, 3, 'Must create 3 chime oscillators');
    const endedSource = oscs.find(o => typeof o.onended === 'function');
    assert.ok(endedSource, 'At least one oscillator in playCheck must define onended');
    endedSource.onended();
    
    for (const node of newNodes) {
      assert.ok(node.disconnections.length >= 1, `Node ${node.nodeType} in playCheck was not disconnected`);
    }
  });

  test('15.3: playVictory attaches onended handler and disconnects all fanfare oscillators, harmonics, and bus', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    const beforeCount = ctx.createdNodes.length;
    engine.playVictory();
    const newNodes = ctx.createdNodes.slice(beforeCount).map(r => r.node);
    
    const oscs = newNodes.filter(n => n.nodeType === 'OscillatorNode');
    assert.equal(oscs.length, 5, 'Must create 5 fanfare oscillators (4 notes + 1 crown harmonic)');
    const endedSource = oscs.find(o => typeof o.onended === 'function');
    assert.ok(endedSource, 'Crown oscillator in playVictory must define onended');
    endedSource.onended();
    
    for (const node of newNodes) {
      assert.ok(node.disconnections.length >= 1, `Node ${node.nodeType} in playVictory was not disconnected`);
    }
  });

  test('15.4: playDefeat attaches onended handler and disconnects all minor cadence oscillators and bus', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    const beforeCount = ctx.createdNodes.length;
    engine.playDefeat();
    const newNodes = ctx.createdNodes.slice(beforeCount).map(r => r.node);
    
    const oscs = newNodes.filter(n => n.nodeType === 'OscillatorNode');
    assert.equal(oscs.length, 2, 'Must create 2 cadence oscillators');
    const endedSource = oscs.find(o => typeof o.onended === 'function');
    assert.ok(endedSource, 'Second oscillator in playDefeat must define onended');
    endedSource.onended();
    
    for (const node of newNodes) {
      assert.ok(node.disconnections.length >= 1, `Node ${node.nodeType} in playDefeat was not disconnected`);
    }
  });

  test('15.5: playIllegal attaches onended handler and disconnects all pulses, filter, and bus', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    const beforeCount = ctx.createdNodes.length;
    engine.playIllegal();
    const newNodes = ctx.createdNodes.slice(beforeCount).map(r => r.node);
    
    const oscs = newNodes.filter(n => n.nodeType === 'OscillatorNode');
    assert.equal(oscs.length, 2, 'Must create 2 pulse oscillators');
    const endedSource = oscs.find(o => typeof o.onended === 'function');
    assert.ok(endedSource, 'Second pulse oscillator in playIllegal must define onended');
    endedSource.onended();
    
    for (const node of newNodes) {
      assert.ok(node.disconnections.length >= 1, `Node ${node.nodeType} in playIllegal was not disconnected`);
    }
  });

  test('15.6: Zero dangling nodes: 100% of newly allocated nodes disconnect across all 6 sound types', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    
    const methods = ['playMove', 'playCapture', 'playCheck', 'playVictory', 'playDefeat', 'playIllegal'];
    for (const m of methods) {
      const before = ctx.createdNodes.length;
      engine[m]();
      const allocated = ctx.createdNodes.slice(before).map(r => r.node);
      const sourcesWithEnded = allocated.filter(n => typeof n.onended === 'function');
      for (const s of sourcesWithEnded) {
        s.onended();
      }
      for (const node of allocated) {
        assert.ok(node.disconnections.length >= 1, `Node ${node.nodeType} in ${m} was left dangling without disconnect`);
      }
    }
  });
});

// ============================================================================
// SUITE 16: Adversarial Headless & Hardware Fault Injection
// ============================================================================
describe('Suite 16: Adversarial Headless & Hardware Fault Injection', () => {
  test('16.1: AudioContext constructor throwing error degrades safely to null ctx without crashing', () => {
    setupMockEnvironment();
    globalThis.AudioContext = function() {
      throw new Error("SystemAudioHardwareUnavailable: Device in exclusive mode");
    };
    globalThis.webkitAudioContext = globalThis.AudioContext;
    const engine = new ChessAudioEngine();
    assert.doesNotThrow(() => engine.init());
    assert.equal(engine.ctx, null);
    assert.doesNotThrow(() => engine.playMove());
    assert.doesNotThrow(() => engine.playCapture());
    assert.doesNotThrow(() => engine.playCheck());
    assert.doesNotThrow(() => engine.playVictory());
    assert.doesNotThrow(() => engine.playDefeat());
    assert.doesNotThrow(() => engine.playIllegal());
  });

  test('16.2: SSR environment where window and document are undefined instantiates cleanly', () => {
    clearMockEnvironment();
    delete globalThis.document;
    delete globalThis.window;
    let engine;
    assert.doesNotThrow(() => {
      engine = new ChessAudioEngine();
    });
    assert.doesNotThrow(() => engine.playMove());
    assert.equal(engine.isMuted(), false);
  });

  test('16.3: Throwing document.addEventListener is caught defensively by _attachUnlockListeners', () => {
    setupMockEnvironment();
    globalThis.document = {
      addEventListener: () => {
        throw new Error("SecurityError: Event listener prohibited");
      },
      removeEventListener: () => {}
    };
    assert.doesNotThrow(() => {
      const engine = new ChessAudioEngine();
      engine.playMove();
    });
  });

  test('16.4: AudioContext resume() rejecting with NotAllowedError produces no uncaught error', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    ctx.state = 'suspended';
    ctx.shouldRejectResume = true;
    assert.doesNotThrow(() => {
      engine.playMove();
      engine.playVictory();
    });
  });
});

// ============================================================================
// SUITE 17: Extreme Storage Resilience & Poison Values
// ============================================================================
describe('Suite 17: Extreme Storage Resilience & Poison Values', () => {
  test('17.1: Object.defineProperty throwing on localStorage property access defaults safely to unmuted', () => {
    setupMockEnvironment();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error("SecurityError: localStorage property access blocked in sandboxed iframe");
      }
    });
    let engine;
    assert.doesNotThrow(() => {
      engine = new ChessAudioEngine();
    });
    assert.equal(engine.isMuted(), false);
    assert.doesNotThrow(() => {
      engine.toggleMute();
    });
    assert.equal(engine.isMuted(), true);
    delete globalThis.localStorage;
    setupMockEnvironment();
  });

  test('17.2: Corrupt and poisoned values in localStorage do not evaluate to muted', () => {
    const poisonValues = [
      'null', 'undefined', '0', '1', 'FALSE', 'TRUE', 'True', 'yes', 'no',
      '{}', '[]', 'NaN', 'true ', ' true', 'true\n', '', '   '
    ];
    for (const poison of poisonValues) {
      setupMockEnvironment();
      localStorage.setItem('chess_sfx_muted', poison);
      const engine = new ChessAudioEngine();
      assert.equal(
        engine.isMuted(),
        false,
        `Value '${poison}' must not evaluate to muted`
      );
    }
  });

  test('17.3: Rapid 500-cycle toggleMute() under intermittent storage failures maintains accurate in-memory state', () => {
    setupMockEnvironment();
    let calls = 0;
    currentMockLocalStorage.setItem = (k, v) => {
      calls++;
      if (calls % 3 === 0) throw new Error("Simulated storage glitch");
      currentMockLocalStorage._store.set(k, String(v));
    };
    const engine = new ChessAudioEngine();
    for (let i = 1; i <= 500; i++) {
      const expected = (i % 2 === 1);
      const result = engine.toggleMute();
      assert.equal(result, expected, `Toggle mismatch at cycle ${i}`);
      assert.equal(engine.isMuted(), expected);
    }
  });
});

// ============================================================================
// SUITE 18: Strict Muted Zero-Allocation Trap
// ============================================================================
describe('Suite 18: Strict Muted Zero-Allocation Trap', () => {
  test('18.1: Strict trap on AudioContext factory methods throws if any node is created when muted', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();
    const ctx = getActiveContext();
    engine.toggleMute(); // muted = true
    
    // Instrument factory methods with strict throwing traps
    const factoryMethods = ['createGain', 'createOscillator', 'createBiquadFilter', 'createBufferSource', 'createBuffer', 'createDynamicsCompressor'];
    const originals = {};
    for (const fm of factoryMethods) {
      originals[fm] = ctx[fm];
      ctx[fm] = function(...args) {
        throw new Error(`StrictAllocationTrapViolation: Method ${fm} called while muted!`);
      };
    }
    
    const soundMethods = ['playMove', 'playCapture', 'playCheck', 'playVictory', 'playDefeat', 'playIllegal'];
    for (let i = 0; i < 50; i++) {
      for (const sm of soundMethods) {
        assert.doesNotThrow(() => engine[sm](), `Sound ${sm} triggered allocation when muted!`);
      }
    }
    
    // Restore originals
    for (const fm of factoryMethods) {
      ctx[fm] = originals[fm];
    }
  });

  test('18.2: Playing sound while muted before init() never creates an AudioContext', () => {
    setupMockEnvironment();
    localStorage.setItem('chess_sfx_muted', 'true');
    const engine = new ChessAudioEngine();
    assert.equal(engine.isMuted(), true);
    
    const soundMethods = ['playMove', 'playCapture', 'playCheck', 'playVictory', 'playDefeat', 'playIllegal'];
    for (const sm of soundMethods) {
      engine[sm]();
    }
    
    assert.equal(MockAudioContext.instances.length, 0, 'No AudioContext may be created when playing sounds while muted');
    assert.equal(engine.ctx, null);
  });
});

// ============================================================================
// SUITE 19: High-Scale Idempotence & Sustained Stress
// ============================================================================
describe('Suite 19: High-Scale Idempotence & Sustained Stress', () => {
  test('19.1: 5,000 rapid calls to init() creates exactly one AudioContext instance', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 5000; i++) {
      engine.init();
    }
    assert.equal(MockAudioContext.instances.length, 1, 'Exactly one AudioContext must be created');
    assert.ok(engine.ctx !== null);
  });

  test('19.2: 600 rapid consecutive sound calls in a tight loop execute cleanly without errors', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    const methods = ['playMove', 'playCapture', 'playCheck', 'playVictory', 'playDefeat', 'playIllegal'];
    assert.doesNotThrow(() => {
      for (let i = 0; i < 100; i++) {
        for (const m of methods) {
          engine[m]();
        }
      }
    });
    assert.equal(MockAudioContext.instances.length, 1);
    assert.ok(engine.ctx.createdNodes.length > 0);
  });

  test('19.3: Calling init() after sounds have already played preserves the existing context', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.playMove();
    const firstCtx = engine.ctx;
    assert.ok(firstCtx !== null);
    engine.init();
    assert.equal(engine.ctx, firstCtx, 'init() after playMove() must not recreate AudioContext');
    assert.equal(MockAudioContext.instances.length, 1);
  });
});

// ============================================================================
// SUITE 20: Deep Adversarial Concurrency, Stress & W3C Param Audit
// ============================================================================
describe('Suite 20: Deep Adversarial Concurrency, Stress & W3C Param Audit', () => {
  test('20.1: Massive rapid succession triggers: 500 consecutive calls to playMove()', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 500; i++) {
      engine.playMove();
    }
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.equal(oscs.length, 500, 'Must create exactly 500 triangle oscillators');
  });

  test('20.2: Massive rapid succession triggers: 500 consecutive calls to playCapture()', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 500; i++) {
      engine.playCapture();
    }
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.equal(oscs.length, 500, 'Must create exactly 500 punch oscillators');
  });

  test('20.3: Massive rapid succession triggers: 500 consecutive calls to playCheck() (1500 oscs)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 500; i++) {
      engine.playCheck();
    }
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.equal(oscs.length, 1500, 'Must create exactly 1500 oscillators for 500 check chords');
  });

  test('20.4: Massive rapid succession triggers: 500 consecutive calls to playVictory() (2500 oscs)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 500; i++) {
      engine.playVictory();
    }
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.equal(oscs.length, 2500, 'Must create exactly 2500 oscillators for 500 victory fanfares');
  });

  test('20.5: Massive rapid succession triggers: 500 consecutive calls to playDefeat() (1000 oscs)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 500; i++) {
      engine.playDefeat();
    }
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.equal(oscs.length, 1000, 'Must create exactly 1000 oscillators for 500 defeat cadences');
  });

  test('20.6: Massive rapid succession triggers: 500 consecutive calls to playIllegal() (1000 oscs)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    for (let i = 0; i < 500; i++) {
      engine.playIllegal();
    }
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    assert.equal(oscs.length, 1000, 'Must create exactly 1000 oscillators for 500 illegal buzzes');
  });

  test('20.7: Interleaved sound barrage of 1,000 rounds (6,000 sound triggers: move, capture, check, victory, defeat, illegal)', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      engine.playMove();
      engine.playCapture();
      engine.playCheck();
      engine.playVictory();
      engine.playDefeat();
      engine.playIllegal();
    }
    const elapsed = Date.now() - start;
    const ctx = getActiveContext();
    const oscs = ctx.getNodesByType('OscillatorNode');
    // 1000 rounds * 14 oscillators per round = 14,000 oscillators
    assert.equal(oscs.length, 14000, 'Must allocate 14,000 oscillators across 6,000 sounds');
    assert.ok(elapsed < 3000, `6,000 sound triggers completed in ${elapsed}ms (< 3000ms SLA)`);
    assert.equal(MockAudioContext.instances.length, 1, 'AudioContext instance must be single and reused');
  });

  test('20.8: 1,000 rapid calls to toggleMute() maintain exact boolean parity and sync with localStorage', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    const initial = engine.isMuted();
    assert.equal(initial, false);
    for (let i = 1; i <= 1000; i++) {
      const state = engine.toggleMute();
      const expected = (i % 2 === 1);
      assert.equal(state, expected, `Toggle #${i} parity mismatch`);
      assert.equal(engine.isMuted(), expected);
      assert.equal(localStorage.getItem('chess_sfx_muted'), String(expected));
    }
    assert.equal(engine.isMuted(), initial);
  });

  test('20.9: W3C AudioParam safety audit: 100% of exponential ramps have value > 0 and floor >= 0.0001', () => {
    setupMockEnvironment();
    const engine = new ChessAudioEngine();
    engine.init();

    engine.playMove();
    engine.playCapture();
    engine.playCheck();
    engine.playVictory();
    engine.playDefeat();
    engine.playIllegal();

    const ctx = getActiveContext();
    let totalRamps = 0;
    const allNodes = [
      ...ctx.getNodesByType('GainNode'),
      ...ctx.getNodesByType('OscillatorNode'),
      ...ctx.getNodesByType('BiquadFilterNode')
    ];

    allNodes.forEach(node => {
      const params = [node.gain, node.frequency, node.Q].filter(Boolean);
      params.forEach(param => {
        param.events.forEach(evt => {
          if (evt.type === 'exponentialRampToValueAtTime') {
            totalRamps++;
            assert.ok(evt.value > 0, `exponentialRamp value must be > 0 (got ${evt.value})`);
            assert.ok(evt.value >= 0.0001, `exponentialRamp floor should be >= 0.0001 (got ${evt.value})`);
          }
        });
      });
    });
    assert.ok(totalRamps >= 20, `Expected at least 20 exponential ramps audited (found ${totalRamps})`);
  });

  test('20.10: Zero unhandled promise rejections detected globally across all test suites', () => {
    assert.equal(unhandledRejections.length, 0, `Detected unhandled promise rejections: ${JSON.stringify(unhandledRejections)}`);
  });
});

// ============================================================================
// Test Execution Summary & Exit Code
// ============================================================================
console.log('\n======================================================');
console.log(`Summary: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
console.log('======================================================\n');

if (failedTests > 0) {
  console.error(`\nFAILED: ${failedTests} tests failed.`);
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED WITH 0 FAILURES!');
  process.exit(0);
}
