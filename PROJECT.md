# Project: Portfolio & Chess Engine Web Application Upgrade

## Architecture
The application is a high-performance, zero-external-dependency interactive web application combining an authentic FIDE chess rules engine, asynchronous Minimax AI, procedural Web Audio synthesizer, and a rich editorial split-screen portfolio dashboard.

```
portfolio/
├── index.html              # Upgraded semantic layout, promotion modal, mobile view switcher, 5 portfolio tabs
├── style.css               # Editorial dark glassmorphism, copper/emerald design tokens, typography, responsive queries
├── script.js               # Main game coordinator, interaction engine, pointer events, portfolio sync
├── chess-engine.js         # Core FIDE chess rules engine (move gen, validation, FEN, checkmate, SAN, draws)
├── chess-ai.js             # Minimax search algorithm with alpha-beta pruning, PSTs, MVV-LVA, quiescence
├── chess-worker.js         # Web Worker for non-blocking asynchronous AI computation
├── chess-audio.js          # Procedural Web Audio API sound synthesizer (zero external audio file dependencies)
├── pieces/                 # Existing 12 Wikimedia vector SVG chess piece assets
└── tests/                  # Automated E2E and unit test suite
```

## Feature Inventory
Every requirement and discovered feature is enumerated below with its assigned milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Board Representation & Coordinates | 8x8 board representation with rank/file coordinate mapping (`a1` to `h8`) | M1 | survey |
| 2 | Pawn Move Generation & En Passant | 1-step, 2-step, diagonal captures, and 1-halfmove en passant capture | M1 | survey |
| 3 | Knight Move Generation | 8 possible L-shape leap moves jumping over pieces | M1 | survey |
| 4 | Sliding Piece Move Generation | Bishop diagonal rays, Rook orthogonal rays, Queen 8-directional rays | M1 | survey |
| 5 | King Move & Castling Generation | 1-square king moves, kingside (O-O) & queenside (O-O-O) with transit checks | M1 | survey |
| 6 | Legal Move Validation & King Safety | Strict filtering preventing King moving into or staying in check (pins, discovered check) | M1 | survey |
| 7 | Check & Checkmate Detection | Immediate check detection and checkmate verification when legal moves = 0 | M1 | survey |
| 8 | Stalemate Detection | Stalemate detection when not in check and legal moves = 0 (1/2 - 1/2) | M1 | survey |
| 9 | Draw by Insufficient Material | Detects K vs K, KB vs K, KN vs K, KB vs KB same-color bishops | M1 | survey |
| 10 | Draw by 50-Move Rule & Repetition | 100 halfmove counter and threefold position repetition tracking | M1 | survey |
| 11 | FEN Parser with 11-Rule Validation | Robust parser for all 6 FEN tokens with strict error handling | M1 | survey |
| 12 | FEN Serializer | Canonical 6-token FEN string generation from state | M1 | survey |
| 13 | SAN & UCI Move Notation | Standard Algebraic Notation with disambiguation (+, #, =, O-O) and LAN/UCI | M1 | survey |
| 14 | Minimax Search with Alpha-Beta | Zero-sum game tree search with alpha-beta cutoff optimization | M2 | survey |
| 15 | Positional Evaluation & PSTs | Material centipawn weights + Piece-Square Tables for midgame and endgame | M2 | survey |
| 16 | Move Ordering & Quiescence | MVV-LVA capture sorting and depth-2 quiescence search to avoid horizon blunders | M2 | survey |
| 17 | AI Difficulty Tiers | Easy (depth 1-2, 35% blunder/random), Medium (depth 3), Master (depth 4-5) | M2 | survey |
| 18 | Web Worker Asynchronous Execution | Offloads AI search to dedicated worker, keeping UI at 60fps (<1.5s latency SLA) | M2 | survey |
| 19 | Procedural Web Audio Synthesizer | Zero-dependency Web Audio API sound synthesis (move, capture, check, victory, defeat, illegal) | M3 | survey |
| 20 | Audio State & Mute Toggle | Persistent mute toggle via `localStorage` with UI icon button | M3 | survey |
| 21 | Editorial Dark Glassmorphism Design Tokens | Dark obsidian base (`#090a0f`), frosted glass acrylics, copper & emerald accents | M4 | survey |
| 22 | 3-Tier Typography System | `Outfit` display headings, `Plus Jakarta Sans` body copy, `JetBrains Mono` coordinates/code | M4 | survey |
| 23 | 5 Rich Portfolio Tabs | In-depth engineering narratives across Identity, Experience, Projects, Arsenal, Contact | M4 | survey |
| 24 | Mobile Segmented View Switcher | Ergonomic view switcher (`[ ♟️ Chess Console | 💼 Portfolio ]`) for screens < 768px | M4 | survey |
| 25 | Unified Pointer Events Interaction | Click-to-move AND drag-and-drop piece movement across desktop and mobile touchscreens | M5 | survey |
| 26 | Visual Board Highlights & Indicators | Legal move dots, capture rings, copper move trails, pulsing red king-in-check aura | M5 | survey |
| 27 | Interactive Pawn Promotion Modal | Popover offering Queen, Rook, Bishop, Knight upon 8th rank pawn move | M5 | survey |
| 28 | Free Play vs AI Mode | White/Black/Random color choice, board inversion for Black, AI move 1, undo & reset | M5 | survey |
| 29 | Curated Tactical Puzzles | 5 tactical puzzles (Scholar's, Back-Rank, Smothered, Fried Liver, Opera House) with hints | M5 | survey |
| 30 | Game-to-Portfolio Synchronization | Live game events trigger tactical commentary, tab auto-switching, and achievements | M5 | survey |
| 31 | Captured Pieces & Material Advantage | Trays displaying captured black & white pieces with relative material diff | M5 | survey |
| 32 | Opaque-Box E2E Test Suite (Tiers 1-4) | Comprehensive test harness verifying all 32 features, edge cases, zero console errors | Track B | survey |
| 33 | Tier 5 Adversarial Coverage Hardening | White-box stress-testing, adversarial fuzzing, and edge-case bug fixes | M6 | survey |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Chess Engine Core & Move Logic | `chess-engine.js`: FIDE rules, move generation, castling, en passant, promotion, check, checkmate, stalemate, draws, FEN parse/serialize, SAN notation | none | IN_PROGRESS |
| M2 | Chess AI Opponent & Web Worker | `chess-ai.js`, `chess-worker.js`: Minimax with alpha-beta, PSTs, MVV-LVA, 3 difficulty tiers (Easy, Medium, Master), Web Worker contract, <1.5s SLA | M1 | PLANNED |
| M3 | Procedural Web Audio SFX | `chess-audio.js`: Algorithmic Web Audio API sound synthesis (move, capture, check, victory, defeat, illegal) with mute toggle and persistence | none | IN_PROGRESS |
| M4 | Editorial UI/UX & Portfolio Content | `index.html`, `style.css`: Editorial dark glassmorphism, copper/emerald tokens, 3-tier typography, 5 rich portfolio tabs, mobile segmented switcher (<768px) | none | IN_PROGRESS |
| M5 | Game Controller & Portfolio Sync | `script.js`: Pointer events (drag/drop + click), board rendering, promotion modal, Free Play vs AI, 5 puzzles, game-to-portfolio synchronization | M1, M2, M3, M4 | PLANNED |
| M6 | Final Milestone: 100% E2E Pass & Hardening | Pass 100% of Track B E2E tests (Tiers 1-4), then Tier 5 Adversarial Coverage Hardening via Challenger loop | M5, Track B | PLANNED |
| Track B | E2E Testing Track | `tests/`, `TEST_INFRA.md`, `TEST_READY.md`: Automated opaque-box test suite across Tiers 1-4 derived from ORIGINAL_REQUEST | none | IN_PROGRESS |

## Interface Contracts

### `chess-engine.js` ↔ Other Modules
```typescript
export interface MoveResult {
  from: string;
  to: string;
  piece: string;
  color: 'w' | 'b';
  captured?: string;
  promotion?: string;
  flags: {
    isCapture: boolean;
    isEnPassant: boolean;
    isKingsideCastle: boolean;
    isQueensideCastle: boolean;
    isPromotion: boolean;
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
  };
  san: string;
  lan: string;
}

export class ChessEngine {
  constructor(fen?: string);
  loadFEN(fen: string): { valid: boolean; error?: string };
  getFEN(): string;
  getPiece(square: string): { type: string; color: 'w' | 'b' } | null;
  getLegalMoves(square?: string): MoveResult[];
  makeMove(move: { from: string; to: string; promotion?: string }): MoveResult | null;
  undoMove(): MoveResult | null;
  isCheck(color?: 'w' | 'b'): boolean;
  isCheckmate(): boolean;
  isStalemate(): boolean;
  isDraw(): boolean;
  getHistory(): MoveResult[];
  reset(): void;
}
```

### `chess-worker.js` ↔ Main Thread (`script.js`)
- Request to Worker:
  `{ type: 'SEARCH_BEST_MOVE', payload: { fen: string, difficulty: 'easy' | 'medium' | 'master', depth?: number, timeLimitMs?: number } }`
- Response from Worker:
  `{ type: 'SEARCH_SUCCESS', payload: { bestMove: { from: string, to: string, promotion?: string }, bestMoveSan: string, score: number, depthSearched: number, nodesEvaluated: number, timeElapsedMs: number } }`
- Abort Request:
  `{ type: 'ABORT_SEARCH' }`

### `chess-audio.js` ↔ UI Controller (`script.js`)
```typescript
export class ChessAudioEngine {
  constructor();
  init(): void;
  toggleMute(): boolean;
  isMuted(): boolean;
  playMove(): void;
  playCapture(): void;
  playCheck(): void;
  playVictory(): void;
  playDefeat(): void;
  playIllegal(): void;
}
```

## Code Layout
- `chess-engine.js`: Pure rules engine, zero DOM dependencies, fully testable in Node.js and browser.
- `chess-ai.js`: Minimax search, evaluation functions, piece-square tables.
- `chess-worker.js`: Web Worker message dispatcher loading `chess-engine.js` and `chess-ai.js`.
- `chess-audio.js`: Web Audio API synthesizer.
- `index.html`: Upgraded structure, semantic tags, mobile switcher, promotion dialog.
- `style.css`: CSS custom properties design tokens, glassmorphism, responsive media queries.
- `script.js`: UI event handling, Pointer Events drag-and-drop, state synchronization, audio hooks.
- `tests/`: Automated test suite and test runner script.
