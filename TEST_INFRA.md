# Test Infrastructure Specification: Portfolio & Chess Engine Upgrade

## 1. Overview & Objectives
This document establishes the architecture, test runner conventions, DOM/browser simulation harness, and verification standards for the interactive split-screen Portfolio & Chess Engine Web Application.

The test infrastructure is built strictly according to the **Zero-External-Dependency** directive. All test runners, assertions, headless DOM shims, Web Audio synthesizers, and Web Worker message queues are implemented natively in standard Node.js without requiring third-party testing frameworks.

### Quality Goals
- **Opaque-Box Verification:** Verify compliance strictly against `ORIGINAL_REQUEST.md` and public contracts in `PROJECT.md`.
- **4-Tier Depth:** 380+ deterministic test cases covering functional features, extreme boundaries, pairwise cross-module combinations, and complete real-world scenarios.
- **Zero Console Errors:** Mandatory trap auditing `console.error` and `console.warn` during all interactive and background operations.
- **Sub-1.5s AI Latency SLA:** Empirical latency verification for the asynchronous Web Worker Minimax engine.

---

## 2. Test File & Directory Organization

All test suites and infrastructure modules reside in the root `tests/` directory:

```
portfolio/
├── tests/
│   ├── harness.js                  # BDD test runner, expect assertion library, CLI reporter
│   ├── mock-dom.js                 # Headless DOM, Web Audio API, Web Worker, localStorage harness
│   ├── run-all.js                  # Master multi-tier CLI test runner
│   ├── tier1_features.test.js      # Tier 1: Feature Coverage (>=165 tests)
│   ├── tier2_boundary.test.js      # Tier 2: Boundary & Corner Cases (>=165 tests)
│   ├── tier3_combinations.test.js  # Tier 3: Cross-Feature Combinations (>=33 tests)
│   └── tier4_realworld.test.js     # Tier 4: Real-World Scenarios & Audit (>=17 tests)
```

---

## 3. Four-Tier Testing Hierarchy & Feature Mapping

The suite covers all 33 features across 4 distinct testing tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 4: Real-World Scenarios (17 tests)                               │
│  Complete games (Scholar's Mate, Opera House), touch loops, zero error │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Cross-Feature Combinations (33 tests)                         │
│  Pairwise interactions: Castling in check, promotion + mate, mute sync │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Boundary & Corner Cases (165 tests)                           │
│  Invalid FENs, pinned pieces, transit checks, en passant expiration    │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Feature Coverage (165 tests)                                  │
│  Isolated functional verification for all 33 features (5 tests each)   │
└────────────────────────────────────────────────────────────────────────┘
```

### Feature-to-Tier Mapping Table

| Feature ID | Feature Name | Tier 1 Tests | Tier 2 Boundary Tests | Tier 3 Pairwise Combinations | Tier 4 Scenarios |
|---|---|---|---|---|---|
| F1 | Board Representation & Coordinates | 5 | 5 | T3-01 | T4-01 |
| F2 | Pawn Move Generation & En Passant | 5 | 5 | T3-02 | T4-01 |
| F3 | Knight Move Generation | 5 | 5 | T3-03 | T4-01 |
| F4 | Sliding Piece Move Generation | 5 | 5 | T3-04 | T4-02 |
| F5 | King Move & Castling Generation | 5 | 5 | T3-05 | T4-01 |
| F6 | Legal Move Validation & King Safety | 5 | 5 | T3-06 | T4-01 |
| F7 | Check & Checkmate Detection | 5 | 5 | T3-07 | T4-01, T4-02 |
| F8 | Stalemate Detection | 5 | 5 | T3-08 | T4-03 |
| F9 | Draw by Insufficient Material | 5 | 5 | T3-09 | T4-04 |
| F10 | Draw by 50-Move Rule & Repetition | 5 | 5 | T3-10 | T4-05 |
| F11 | FEN Parser with 11-Rule Validation | 5 | 5 | T3-11 | T4-06 |
| F12 | FEN Serializer | 5 | 5 | T3-12 | T4-06 |
| F13 | SAN & UCI Move Notation | 5 | 5 | T3-13 | T4-01 |
| F14 | Minimax Search with Alpha-Beta | 5 | 5 | T3-14 | T4-07 |
| F15 | Positional Evaluation & PSTs | 5 | 5 | T3-15 | T4-07 |
| F16 | Move Ordering & Quiescence | 5 | 5 | T3-16 | T4-07 |
| F17 | AI Difficulty Tiers | 5 | 5 | T3-17 | T4-08 |
| F18 | Web Worker Asynchronous Execution | 5 | 5 | T3-18 | T4-08 |
| F19 | Procedural Web Audio Synthesizer | 5 | 5 | T3-19 | T4-09 |
| F20 | Audio State & Mute Toggle | 5 | 5 | T3-20 | T4-09 |
| F21 | Dark Glassmorphism Design Tokens | 5 | 5 | T3-21 | T4-10 |
| F22 | 3-Tier Typography System | 5 | 5 | T3-22 | T4-10 |
| F23 | 5 Rich Portfolio Tabs | 5 | 5 | T3-23 | T4-11 |
| F24 | Mobile Segmented View Switcher | 5 | 5 | T3-24 | T4-12 |
| F25 | Unified Pointer Events Interaction | 5 | 5 | T3-25 | T4-13 |
| F26 | Visual Board Highlights & Indicators | 5 | 5 | T3-26 | T4-13 |
| F27 | Interactive Pawn Promotion Modal | 5 | 5 | T3-27 | T4-14 |
| F28 | Free Play vs AI Mode | 5 | 5 | T3-28 | T4-15 |
| F29 | Curated Tactical Puzzles | 5 | 5 | T3-29 | T4-16 |
| F30 | Game-to-Portfolio Synchronization | 5 | 5 | T3-30 | T4-16 |
| F31 | Captured Pieces & Material Advantage | 5 | 5 | T3-31 | T4-15 |
| F32 | Opaque-Box E2E Test Suite | 5 | 5 | T3-32 | T4-17 |
| F33 | Tier 5 Adversarial Hardening | 5 | 5 | T3-33 | T4-17 |
| **Total** | **33 Features** | **165 Tests** | **165 Tests** | **33 Tests** | **17 Tests** |

**Grand Total: 380 Discrete Tests**

---

## 4. Test Runner CLI Usage (`tests/run-all.js`)

The master runner provides flexible filtering, tier isolation, and continuous integration reporting.

```bash
# Run all tiers (Tiers 1, 2, 3, 4)
node tests/run-all.js

# Run specific tier
node tests/run-all.js --tier=1
node tests/run-all.js --tier=2
node tests/run-all.js --tier=3
node tests/run-all.js --tier=4

# Run multiple tiers
node tests/run-all.js --tier=1,2

# Filter by feature ID or name
node tests/run-all.js --feature=11
node tests/run-all.js --filter="Castling"

# Stop on first failure
node tests/run-all.js --bail

# Output formats
node tests/run-all.js --verbose
node tests/run-all.js --compact
node tests/run-all.js --json
```

---

## 5. Authoring Guidelines & Example Tests

### 5.1 Writing Pure Engine / AI Unit Tests
```javascript
const { describe, it, expect } = require('./harness');
const { ChessEngine } = require('../chess-engine');

describe('Feature 11: FEN Parser 11-Rule Validation', () => {
  it('rejects FEN with invalid active color token', () => {
    const engine = new ChessEngine();
    const result = engine.loadFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/active color/i);
  });
});
```

### 5.2 Writing DOM & UI Interaction Tests
```javascript
const { describe, it, expect, beforeEach, afterEach } = require('./harness');
const { setupDOM, teardownDOM, getConsoleErrors } = require('./mock-dom');

describe('Feature 24: Mobile View Switcher', () => {
  beforeEach(() => {
    setupDOM({ width: 375, height: 667 });
    require('../script');
  });

  afterEach(() => {
    expect(getConsoleErrors()).toHaveLength(0);
    teardownDOM();
  });

  it('switches active panel when mobile segmented tab is clicked', () => {
    const portfolioBtn = document.querySelector('[data-view="portfolio"]');
    portfolioBtn.click();

    const portfolioPanel = document.getElementById('portfolio-panel');
    expect(portfolioPanel.classList.contains('active-view')).toBe(true);
  });
});
```

---

## 6. Verification & Quality Gates

1. **Pass Criteria:**
   - 100% test pass rate across all 380+ tests (`0` failures).
   - Zero console errors logged across all test suites.
   - Master AI search latency strictly `<= 1500ms`.
2. **Deterministic Execution:**
   - Tests must run independently with zero cross-test state leakage.
   - Tests must pass when run in isolation or collectively.
