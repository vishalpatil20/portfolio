/**
 * tests/mock-dom.js - Lightweight Headless DOM, Web Audio, Worker, & Storage Mock
 * Zero external dependencies - pure Node.js implementation.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

// --- 1. DOM CLASS HIERARCHY ---

class DOMNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.parentNode = null;
    this.childNodes = [];
  }

  get parentElement() {
    return this.parentNode instanceof DOMElement ? this.parentNode : null;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(newChild, refChild) {
    if (!refChild) return this.appendChild(newChild);
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);
    if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
    newChild.parentNode = this;
    this.childNodes.splice(idx, 0, newChild);
    return newChild;
  }

  replaceChild(newChild, oldChild) {
    this.insertBefore(newChild, oldChild);
    return this.removeChild(oldChild);
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  contains(otherNode) {
    let curr = otherNode;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
}

class DOMTextNode extends DOMNode {
  constructor(text) {
    super(3, '#text');
    this.data = String(text);
  }
  get textContent() { return this.data; }
  set textContent(val) { this.data = String(val); }

  cloneNode() {
    return new DOMTextNode(this.data);
  }
}

class DOMClassList {
  constructor(element) {
    this._el = element;
  }

  _getClasses() {
    const className = this._el.getAttribute('class') || '';
    return className.trim().split(/\s+/).filter(Boolean);
  }

  _setClasses(classes) {
    this._el.setAttribute('class', classes.join(' '));
  }

  add(...classes) {
    const current = new Set(this._getClasses());
    for (const c of classes) {
      if (c) current.add(c);
    }
    this._setClasses(Array.from(current));
  }

  remove(...classes) {
    const current = new Set(this._getClasses());
    for (const c of classes) {
      current.delete(c);
    }
    this._setClasses(Array.from(current));
  }

  toggle(className, force) {
    const current = new Set(this._getClasses());
    const has = current.has(className);
    const shouldAdd = force !== undefined ? Boolean(force) : !has;
    if (shouldAdd) current.add(className);
    else current.delete(className);
    this._setClasses(Array.from(current));
    return shouldAdd;
  }

  contains(className) {
    return this._getClasses().includes(className);
  }

  replace(oldClass, newClass) {
    const classes = this._getClasses();
    const idx = classes.indexOf(oldClass);
    if (idx !== -1) {
      classes[idx] = newClass;
      this._setClasses(classes);
      return true;
    }
    return false;
  }

  get length() {
    return this._getClasses().length;
  }

  toString() {
    return this._getClasses().join(' ');
  }

  [Symbol.iterator]() {
    return this._getClasses()[Symbol.iterator]();
  }
}

class DOMStyle {
  constructor() {
    this._styles = new Map();
  }

  setProperty(prop, val) {
    this._styles.set(prop, String(val));
  }

  getPropertyValue(prop) {
    return this._styles.get(prop) || '';
  }

  removeProperty(prop) {
    const val = this.getPropertyValue(prop);
    this._styles.delete(prop);
    return val;
  }

  get cssText() {
    return Array.from(this._styles.entries()).map(([k, v]) => `${k}: ${v};`).join(' ');
  }

  set cssText(val) {
    this._styles.clear();
    if (!val) return;
    val.split(';').forEach(rule => {
      const [k, v] = rule.split(':');
      if (k && v) this.setProperty(k.trim(), v.trim());
    });
  }
}

// Proxied style object allowing `el.style.width = '100px'` and camelCase mappings
function createStyleProxy(domStyle) {
  return new Proxy(domStyle, {
    get(target, prop) {
      if (typeof prop === 'string') {
        if (prop in target) {
          return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
        }
        const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        return target.getPropertyValue(kebab);
      }
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === 'string') {
        if (prop === 'cssText') {
          target.cssText = value;
          return true;
        }
        const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        target.setProperty(kebab, value);
        return true;
      }
      return false;
    }
  });
}

class DOMElement extends DOMNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new DOMClassList(this);
    this._styleObj = new DOMStyle();
    this.style = createStyleProxy(this._styleObj);
    this.eventListeners = new Map();
    this._disabled = false;
    this._value = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(val) { this.setAttribute('id', val); }

  get className() { return this.getAttribute('class') || ''; }
  set className(val) { this.setAttribute('class', val); }

  get disabled() { return this._disabled; }
  set disabled(val) { this._disabled = Boolean(val); }

  get value() { return this._value; }
  set value(val) { this._value = String(val); }

  get src() { return this.getAttribute('src') || ''; }
  set src(val) { this.setAttribute('src', val); }

  get alt() { return this.getAttribute('alt') || ''; }
  set alt(val) { this.setAttribute('alt', val); }

  get href() { return this.getAttribute('href') || ''; }
  set href(val) { this.setAttribute('href', val); }

  get target() { return this.getAttribute('target') || ''; }
  set target(val) { this.setAttribute('target', val); }

  get type() { return this.getAttribute('type') || ''; }
  set type(val) { this.setAttribute('type', val); }

  get children() {
    return this.childNodes.filter(n => n.nodeType === 1);
  }

  get dataset() {
    const self = this;
    const ds = {};
    for (const [attr, val] of this.attributes.entries()) {
      if (attr.startsWith('data-')) {
        const prop = attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        ds[prop] = val;
      }
    }
    return new Proxy(ds, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined;
        const kebab = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        return self.getAttribute(kebab) ?? undefined;
      },
      set(target, prop, value) {
        if (typeof prop !== 'string') return false;
        const kebab = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        self.setAttribute(kebab, String(value));
        target[prop] = String(value);
        return true;
      },
      deleteProperty(target, prop) {
        if (typeof prop !== 'string') return false;
        const kebab = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        self.removeAttribute(kebab);
        delete target[prop];
        return true;
      }
    });
  }

  getAttribute(name) {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }

  setAttribute(name, val) {
    const key = name.toLowerCase();
    this.attributes.set(key, String(val));
    if (key === 'style') {
      this._styleObj.cssText = String(val);
    }
  }

  removeAttribute(name) {
    this.attributes.delete(name.toLowerCase());
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  get textContent() {
    return this.childNodes.map(n => n.textContent).join('');
  }

  set textContent(text) {
    this.childNodes = [];
    if (text !== '') {
      this.appendChild(new DOMTextNode(text));
    }
  }

  get innerHTML() {
    return this.childNodes.map(serializeHTML).join('');
  }

  set innerHTML(htmlString) {
    this.childNodes = [];
    if (!htmlString) return;
    const fragment = parseHTML(htmlString);
    while (fragment.childNodes.length > 0) {
      this.appendChild(fragment.childNodes[0]);
    }
  }

  get outerHTML() {
    return serializeHTML(this);
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const list = this.eventListeners.get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    const list = this.eventListeners.get(event.type);
    if (list) {
      for (const listener of [...list]) {
        listener.call(this, event);
      }
    }
    // Simple bubbling to parent
    if (event.bubbles && this.parentElement && !event.propagationStopped) {
      this.parentElement.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new DOMEvent('click', { bubbles: true, cancelable: true }));
  }

  focus() {}
  blur() {}

  scrollTo(options = {}) {
    if (typeof options.top === 'number') this.scrollTop = options.top;
    if (typeof options.left === 'number') this.scrollLeft = options.left;
  }

  scrollIntoView() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, bottom: 400, right: 400, width: 400, height: 400 };
  }

  cloneNode(deep = false) {
    const clone = new DOMElement(this.tagName.toLowerCase());
    for (const [k, v] of this.attributes.entries()) {
      clone.setAttribute(k, v);
    }
    if (deep) {
      for (const child of this.childNodes) {
        clone.appendChild(child.cloneNode ? child.cloneNode(true) : new DOMTextNode(child.textContent));
      }
    }
    return clone;
  }

  // --- QUERY SELECTOR ENGINE ---
  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    return matchSelectorAll(this, selector);
  }

  closest(selector) {
    let curr = this;
    while (curr && curr instanceof DOMElement) {
      if (matchesCompoundSelector(curr, selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(selector) {
    return matchesCompoundSelector(this, selector);
  }
}

class DOMDocument extends DOMElement {
  constructor() {
    super('#document');
    this.head = new DOMElement('head');
    this.body = new DOMElement('body');
    this.documentElement = new DOMElement('html');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }

  createElement(tagName) {
    return new DOMElement(tagName);
  }

  createTextNode(text) {
    return new DOMTextNode(text);
  }

  createEvent(type) {
    return new DOMEvent(type);
  }

  getElementById(id) {
    function findId(node) {
      if (node instanceof DOMElement && node.id === id) return node;
      for (const child of node.children) {
        const found = findId(child);
        if (found) return found;
      }
      return null;
    }
    return findId(this);
  }

  getElementsByClassName(className) {
    return this.querySelectorAll(`.${className}`);
  }

  getElementsByTagName(tagName) {
    return this.querySelectorAll(tagName);
  }
}

class DOMEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? false;
    this.cancelable = options.cancelable ?? false;
    this.target = null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.propagationStopped = false;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

class DOMPointerEvent extends DOMEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.clientX = options.clientX ?? 0;
    this.clientY = options.clientY ?? 0;
    this.pageX = options.pageX ?? options.clientX ?? 0;
    this.pageY = options.pageY ?? options.clientY ?? 0;
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? 'mouse';
  }
}

class DOMCustomEvent extends DOMEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail ?? null;
  }
}

// --- 2. SELECTOR ENGINE & HTML PARSER ---

function matchesCompoundSelector(el, sel) {
  if (!sel || !(el instanceof DOMElement)) return false;
  sel = sel.trim();
  if (sel === '*') return true;

  // Extract and match attributes: [attr="val"], [attr='val'], [attr=val], [attr]
  const attrRegex = /\[([a-zA-Z0-9-_:]+)(?:=([^\s\]]+))?\]/g;
  let cleanSel = sel;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(sel)) !== null) {
    const attrName = attrMatch[1];
    const rawVal = attrMatch[2];
    if (rawVal !== undefined) {
      const cleanVal = rawVal.replace(/^['"]|['"]$/g, '');
      if (el.getAttribute(attrName) !== cleanVal) return false;
    } else {
      if (!el.hasAttribute(attrName)) return false;
    }
  }
  cleanSel = sel.replace(attrRegex, '');

  if (!cleanSel) return true;

  // Extract and match ID: #id
  const idMatch = cleanSel.match(/#([a-zA-Z0-9-_]+)/);
  if (idMatch) {
    if (el.id !== idMatch[1]) return false;
    cleanSel = cleanSel.replace(/#[a-zA-Z0-9-_]+/, '');
  }

  // Extract and match classes: .class
  const classMatches = cleanSel.match(/\.([a-zA-Z0-9-_]+)/g);
  if (classMatches) {
    for (const c of classMatches) {
      if (!el.classList.contains(c.slice(1))) return false;
    }
    cleanSel = cleanSel.replace(/\.[a-zA-Z0-9-_]+/g, '');
  }

  // Remainder must be tag name (if any)
  if (cleanSel && cleanSel !== '*') {
    if (el.tagName.toLowerCase() !== cleanSel.toLowerCase()) return false;
  }

  return true;
}

function getAllDescendants(node) {
  const list = [];
  for (const child of node.children) {
    list.push(child);
    const sub = getAllDescendants(child);
    for (let i = 0; i < sub.length; i++) {
      list.push(sub[i]);
    }
  }
  return list;
}

function matchSelectorAll(root, selector) {
  if (selector.includes(',')) {
    const parts = selector.split(',');
    const seen = new Set();
    const combined = [];
    for (const p of parts) {
      for (const el of matchSelectorAll(root, p.trim())) {
        if (!seen.has(el)) {
          seen.add(el);
          combined.push(el);
        }
      }
    }
    return combined;
  }

  const segments = selector.trim().split(/\s+/).filter(Boolean);
  if (segments.length === 0) return [];

  let currentCandidates = getAllDescendants(root).filter(el => matchesCompoundSelector(el, segments[0]));

  for (let i = 1; i < segments.length; i++) {
    const nextCandidates = [];
    const seen = new Set();
    for (const parent of currentCandidates) {
      for (const desc of getAllDescendants(parent)) {
        if (matchesCompoundSelector(desc, segments[i]) && !seen.has(desc)) {
          seen.add(desc);
          nextCandidates.push(desc);
        }
      }
    }
    currentCandidates = nextCandidates;
  }

  return currentCandidates;
}

function parseHTML(html) {
  const container = new DOMElement('div');
  if (!html) return container;

  // Strip DOCTYPE and comments to prevent parser artifacts
  const cleanHtml = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const tagRegex = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  const stack = [container];
  const voidTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
  let match;

  while ((match = tagRegex.exec(cleanHtml)) !== null) {
    const [_, isClosing, tagName, rawAttrs, textContent] = match;

    if (textContent) {
      const trimmed = textContent.trim();
      if (trimmed) {
        stack[stack.length - 1].appendChild(new DOMTextNode(trimmed));
      }
      continue;
    }

    if (isClosing) {
      const targetTag = tagName.toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName.toLowerCase() === targetTag) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }

    // Opening tag
    const el = new DOMElement(tagName);
    if (rawAttrs) {
      const attrRegex = /([a-zA-Z0-9-_:]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
        const attrName = attrMatch[1];
        const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
        el.setAttribute(attrName, val);
      }
    }

    stack[stack.length - 1].appendChild(el);

    // Self-closing void tags or explicit trailing slash
    const isSelfClosing = voidTags.has(tagName.toLowerCase()) || rawAttrs?.trim().endsWith('/');
    if (!isSelfClosing) {
      stack.push(el);
    }
  }

  return container;
}

function serializeHTML(node) {
  if (node instanceof DOMTextNode) return node.textContent;
  if (!(node instanceof DOMElement)) return '';
  const tag = node.tagName.toLowerCase();
  let attrs = '';
  for (const [k, v] of node.attributes.entries()) {
    attrs += ` ${k}="${v}"`;
  }
  const children = node.childNodes.map(serializeHTML).join('');
  const voidTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
  if (voidTags.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${children}</${tag}>`;
}

// --- 3. WEB STORAGE MOCK ---

class MockStorage {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    return this._store.has(String(key)) ? this._store.get(String(key)) : null;
  }

  setItem(key, value) {
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

  key(idx) {
    return Array.from(this._store.keys())[idx] ?? null;
  }
}

// --- 4. WEB AUDIO API MOCK WITH TELEMETRY ---

class MockAudioParam {
  constructor(initialVal = 0, name = '') {
    this.value = initialVal;
    this.name = name;
    this.events = [];
  }

  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', value: val, time });
    return this;
  }

  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'exponentialRampToValueAtTime', value: val, time });
    return this;
  }

  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', value: val, time });
    return this;
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this.value = target;
    this.events.push({ type: 'setTargetAtTime', target, startTime, timeConstant });
    return this;
  }

  cancelScheduledValues(startTime) {
    this.events.push({ type: 'cancelScheduledValues', startTime });
    return this;
  }
}

class MockAudioNode {
  constructor(context, type) {
    this.context = context;
    this.nodeType = type;
    this.connectedTo = [];
  }

  connect(destination) {
    this.connectedTo.push(destination);
    return destination;
  }

  disconnect() {
    this.connectedTo = [];
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context, 'OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440, 'frequency');
    this.detune = new MockAudioParam(0, 'detune');
    this.started = false;
    this.stopped = false;
    this.onended = null;
  }

  start(time = 0) {
    this.started = true;
    this.context._telemetry.oscillators.push({
      type: this.type,
      startFrequency: this.frequency.value,
      frequencyEvents: [...this.frequency.events],
      startTime: time
    });
    if (typeof this.onended === 'function') {
      setTimeout(() => {
        if (typeof this.onended === 'function') this.onended();
      }, 10);
    }
  }

  stop(time = 0) {
    this.stopped = true;
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context) {
    super(context, 'GainNode');
    this.gain = new MockAudioParam(1, 'gain');
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context, 'BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350, 'frequency');
    this.Q = new MockAudioParam(1, 'Q');
    this.gain = new MockAudioParam(0, 'gain');
    this.detune = new MockAudioParam(0, 'detune');
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(context) {
    super(context, 'DynamicsCompressorNode');
    this.threshold = new MockAudioParam(-24, 'threshold');
    this.knee = new MockAudioParam(30, 'knee');
    this.ratio = new MockAudioParam(12, 'ratio');
    this.attack = new MockAudioParam(0.003, 'attack');
    this.release = new MockAudioParam(0.25, 'release');
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context, 'AudioBufferSourceNode');
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new MockAudioParam(1, 'playbackRate');
    this.onended = null;
    this.started = false;
    this.stopped = false;
  }

  start(time = 0) {
    this.started = true;
    this.context._telemetry.bufferSources.push({
      startTime: time,
      buffer: this.buffer
    });
    if (typeof this.onended === 'function') {
      setTimeout(() => {
        if (typeof this.onended === 'function') this.onended();
      }, 10);
    }
  }

  stop(time = 0) {
    this.stopped = true;
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0.0;
    this.sampleRate = 44100;
    this.destination = new MockAudioNode(this, 'AudioDestinationNode');
    this._telemetry = {
      oscillators: [],
      bufferSources: [],
      resumed: false
    };
    activeAudioContext = this;
  }

  async resume() {
    this.state = 'running';
    this._telemetry.resumed = true;
  }

  async suspend() {
    this.state = 'suspended';
  }

  async close() {
    this.state = 'closed';
  }

  createOscillator() {
    return new MockOscillatorNode(this);
  }

  createGain() {
    return new MockGainNode(this);
  }

  createBiquadFilter() {
    return new MockBiquadFilterNode(this);
  }

  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode(this);
  }

  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length)
    };
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }
}

// --- 5. WEB WORKER MOCK ---

class MockWorker {
  constructor(scriptPath) {
    this.scriptPath = scriptPath;
    this.onmessage = null;
    this.onerror = null;
    this.terminated = false;
    this.listeners = new Map();

    const fullPath = path.resolve(process.cwd(), scriptPath);
    let workerCode = '';
    try {
      workerCode = fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
      throw new Error(`Worker failed to load script '${scriptPath}': ${err.message}`);
    }

    const workerSelf = {
      postMessage: (msg) => {
        if (this.terminated) return;
        setImmediate(() => {
          const event = { data: structuredClone(msg) };
          if (typeof this.onmessage === 'function') {
            this.onmessage(event);
          }
          const handlers = this.listeners.get('message') || [];
          for (const h of handlers) h(event);
        });
      },
      onmessage: null,
      importScripts: (...scripts) => {
        for (const s of scripts) {
          const sPath = path.resolve(path.dirname(fullPath), s);
          const code = fs.readFileSync(sPath, 'utf8');
          vm.runInContext(code, workerContext);
        }
      },
      addEventListener: (type, fn) => {
        if (!workerSelf._listeners) workerSelf._listeners = new Map();
        if (!workerSelf._listeners.has(type)) workerSelf._listeners.set(type, []);
        workerSelf._listeners.get(type).push(fn);
      },
      removeEventListener: (type, fn) => {
        if (!workerSelf._listeners) return;
        const list = workerSelf._listeners.get(type);
        if (list) {
          const idx = list.indexOf(fn);
          if (idx !== -1) list.splice(idx, 1);
        }
      }
    };
    workerSelf.self = workerSelf;

    const workerContext = vm.createContext({
      self: workerSelf,
      postMessage: workerSelf.postMessage,
      importScripts: workerSelf.importScripts,
      addEventListener: workerSelf.addEventListener,
      removeEventListener: workerSelf.removeEventListener,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      performance,
      structuredClone
    });

    this._workerSelf = workerSelf;
    this._workerContext = workerContext;

    try {
      vm.runInContext(workerCode, workerContext);
    } catch (err) {
      setImmediate(() => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
    }
  }

  postMessage(data) {
    if (this.terminated) return;
    setImmediate(() => {
      const event = { data: structuredClone(data) };
      if (typeof this._workerSelf.onmessage === 'function') {
        this._workerSelf.onmessage(event);
      }
      const handlers = this._workerSelf._listeners?.get('message') || [];
      for (const h of handlers) h(event);
    });
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  terminate() {
    this.terminated = true;
  }
}

// --- 6. CONSOLE ERROR AUDITOR & ENVIRONMENT HARNESS ---

class ConsoleMonitor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this._origError = console.error;
    this._origWarn = console.warn;
    this._active = false;
  }

  start() {
    if (this._active) return;
    this._active = true;
    this.errors = [];
    this.warnings = [];
    console.error = (...args) => {
      this.errors.push({
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        stack: new Error().stack
      });
      this._origError.apply(console, args);
    };
    console.warn = (...args) => {
      this.warnings.push({
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      });
      this._origWarn.apply(console, args);
    };
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    console.error = this._origError;
    console.warn = this._origWarn;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  getErrors() {
    return [...this.errors];
  }

  getWarnings() {
    return [...this.warnings];
  }

  clear() {
    this.errors = [];
    this.warnings = [];
  }
}

// Global active instances
let activeStorage = new MockStorage();
let activeAudioContext = null;
let activeConsoleMonitor = new ConsoleMonitor();

function setupDOM(options = {}) {
  const {
    htmlPath = path.resolve(process.cwd(), 'index.html'),
    width = 1280,
    height = 800
  } = options;

  const doc = new DOMDocument();
  let htmlContent = '';
  if (fs.existsSync(htmlPath)) {
    htmlContent = fs.readFileSync(htmlPath, 'utf8');
  }

  if (htmlContent) {
    const parsed = parseHTML(htmlContent);
    const parsedBody = parsed.querySelector('body');
    if (parsedBody) {
      // Transfer body attributes
      for (const [k, v] of parsedBody.attributes.entries()) {
        doc.body.setAttribute(k, v);
      }
      while (parsedBody.childNodes.length > 0) {
        doc.body.appendChild(parsedBody.childNodes[0]);
      }
      const parsedHead = parsed.querySelector('head');
      if (parsedHead) {
        for (const [k, v] of parsedHead.attributes.entries()) {
          doc.head.setAttribute(k, v);
        }
        while (parsedHead.childNodes.length > 0) {
          doc.head.appendChild(parsedHead.childNodes[0]);
        }
      }
    } else {
      while (parsed.childNodes.length > 0) {
        doc.body.appendChild(parsed.childNodes[0]);
      }
    }
  }

  const windowObj = {
    document: doc,
    localStorage: activeStorage,
    sessionStorage: new MockStorage(),
    innerWidth: width,
    innerHeight: height,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    Worker: MockWorker,
    Event: DOMEvent,
    CustomEvent: DOMCustomEvent,
    PointerEvent: DOMPointerEvent,
    MouseEvent: DOMEvent,
    TouchEvent: DOMEvent,
    addEventListener: (type, fn) => doc.addEventListener(type, fn),
    removeEventListener: (type, fn) => doc.removeEventListener(type, fn),
    dispatchEvent: (evt) => doc.dispatchEvent(evt),
    matchMedia: (query) => ({
      matches: query.includes('768') && width < 768,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
    scrollTo: (options) => doc.body.scrollTo(options),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  windowObj.globalThis = windowObj;

  // Bind to Node global object for transparent execution of browser scripts
  global.window = windowObj;
  global.document = doc;
  global.localStorage = activeStorage;
  global.sessionStorage = windowObj.sessionStorage;
  global.AudioContext = MockAudioContext;
  global.webkitAudioContext = MockAudioContext;
  global.Worker = MockWorker;
  global.PointerEvent = DOMPointerEvent;
  global.MouseEvent = DOMEvent;
  global.TouchEvent = DOMEvent;
  global.Event = DOMEvent;
  global.CustomEvent = DOMCustomEvent;
  global.requestAnimationFrame = windowObj.requestAnimationFrame;
  global.cancelAnimationFrame = windowObj.cancelAnimationFrame;

  activeAudioContext = new MockAudioContext();
  activeConsoleMonitor.start();

  return { window: windowObj, document: doc };
}

function teardownDOM() {
  activeConsoleMonitor.stop();
  delete global.window;
  delete global.document;
  delete global.localStorage;
  delete global.sessionStorage;
  delete global.AudioContext;
  delete global.webkitAudioContext;
  delete global.Worker;
  delete global.PointerEvent;
  delete global.MouseEvent;
  delete global.TouchEvent;
  delete global.Event;
  delete global.CustomEvent;
  delete global.requestAnimationFrame;
  delete global.cancelAnimationFrame;
}

function getConsoleErrors() {
  return activeConsoleMonitor.getErrors();
}

function getConsoleWarnings() {
  return activeConsoleMonitor.getWarnings();
}

function resetStorage() {
  activeStorage.clear();
}

function getMockAudioContext() {
  return activeAudioContext;
}

module.exports = {
  DOMNode,
  DOMTextNode,
  DOMElement,
  DOMDocument,
  DOMClassList,
  DOMStyle,
  DOMEvent,
  DOMPointerEvent,
  DOMCustomEvent,
  MockStorage,
  MockAudioParam,
  MockAudioNode,
  MockOscillatorNode,
  MockGainNode,
  MockBiquadFilterNode,
  MockDynamicsCompressorNode,
  MockAudioBufferSourceNode,
  MockAudioContext,
  MockWorker,
  ConsoleMonitor,
  setupDOM,
  teardownDOM,
  getConsoleErrors,
  getConsoleWarnings,
  resetStorage,
  getMockAudioContext,
  parseHTML
};
