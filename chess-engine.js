/**
 * Standalone FIDE Chess Rules Engine
 * Zero external npm dependencies. UMD/CommonJS/Browser/Worker compatible.
 */

(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (typeof define === 'function' && define.amd) {
    define([], () => exported);
  }
  if (typeof window !== 'undefined') {
    window.ChessEngine = exported.ChessEngine;
  }
  if (typeof self !== 'undefined') {
    self.ChessEngine = exported.ChessEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.ChessEngine = exported.ChessEngine;
  }
  if (root) {
    root.ChessEngine = exported.ChessEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

  const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Flyweight immutable piece objects (zero GC allocations for queries)
  const PIECES = Object.freeze({
    P: Object.freeze({ type: 'p', color: 'w' }),
    N: Object.freeze({ type: 'n', color: 'w' }),
    B: Object.freeze({ type: 'b', color: 'w' }),
    R: Object.freeze({ type: 'r', color: 'w' }),
    Q: Object.freeze({ type: 'q', color: 'w' }),
    K: Object.freeze({ type: 'k', color: 'w' }),
    p: Object.freeze({ type: 'p', color: 'b' }),
    n: Object.freeze({ type: 'n', color: 'b' }),
    b: Object.freeze({ type: 'b', color: 'b' }),
    r: Object.freeze({ type: 'r', color: 'b' }),
    q: Object.freeze({ type: 'q', color: 'b' }),
    k: Object.freeze({ type: 'k', color: 'b' }),
  });

  const KNIGHT_OFFSETS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  const BISHOP_DIRECTIONS = [
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  const ROOK_DIRECTIONS = [
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];

  const QUEEN_DIRECTIONS = [
    [1, 1], [1, -1], [-1, 1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];

  const KING_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  /**
   * Converts algebraic square name ('e4') to 0..63 mailbox index.
   * @param {string} sq
   * @returns {number} 0..63 or -1 if invalid
   */
  function squareToIndex(sq) {
    if (typeof sq !== 'string' || sq.length !== 2) return -1;
    const file = sq.charCodeAt(0) - 97; // 'a' = 0
    const rank = sq.charCodeAt(1) - 49; // '1' = 0
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
    return (rank << 3) | file;
  }

  /**
   * Converts 0..63 mailbox index to algebraic square name ('e4').
   * @param {number} idx
   * @returns {string}
   */
  function indexToSquare(idx) {
    if (idx < 0 || idx > 63) return '';
    return FILES[idx & 7] + RANKS[idx >> 3];
  }

  /**
   * Returns square color parity ('light' or 'dark').
   * @param {number} idx
   * @returns {'light'|'dark'}
   */
  function getSquareColor(idx) {
    const file = idx & 7;
    const rank = idx >> 3;
    return (rank + file) % 2 === 0 ? 'dark' : 'light';
  }

  /**
   * Reverse outward attack scanner.
   * Determines if targetIdx is attacked by any piece of attackerColor.
   * @param {number} targetIdx
   * @param {'w'|'b'} attackerColor
   * @param {Array} board
   * @returns {boolean}
   */
  function isSquareAttacked(targetIdx, attackerColor, board) {
    const f = targetIdx & 7;
    const r = targetIdx >> 3;

    // 1. Pawn attacks
    const pawnRank = attackerColor === 'w' ? r - 1 : r + 1;
    if (pawnRank >= 0 && pawnRank <= 7) {
      if (f > 0) {
        const p = board[(pawnRank << 3) | (f - 1)];
        if (p && p.color === attackerColor && p.type === 'p') return true;
      }
      if (f < 7) {
        const p = board[(pawnRank << 3) | (f + 1)];
        if (p && p.color === attackerColor && p.type === 'p') return true;
      }
    }

    // 2. Knight attacks
    for (let i = 0; i < 8; i++) {
      const kr = r + KNIGHT_OFFSETS[i][0];
      const kf = f + KNIGHT_OFFSETS[i][1];
      if (kr >= 0 && kr <= 7 && kf >= 0 && kf <= 7) {
        const p = board[(kr << 3) | kf];
        if (p && p.color === attackerColor && p.type === 'n') return true;
      }
    }

    // 3. Bishop & Queen attacks (diagonals)
    for (let i = 0; i < 4; i++) {
      const dr = BISHOP_DIRECTIONS[i][0];
      const df = BISHOP_DIRECTIONS[i][1];
      let cr = r + dr;
      let cf = f + df;
      while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
        const p = board[(cr << 3) | cf];
        if (p !== null) {
          if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        cr += dr;
        cf += df;
      }
    }

    // 4. Rook & Queen attacks (orthogonals)
    for (let i = 0; i < 4; i++) {
      const dr = ROOK_DIRECTIONS[i][0];
      const df = ROOK_DIRECTIONS[i][1];
      let cr = r + dr;
      let cf = f + df;
      while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
        const p = board[(cr << 3) | cf];
        if (p !== null) {
          if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        cr += dr;
        cf += df;
      }
    }

    // 5. King attacks (adjacent 1-square steps)
    for (let i = 0; i < 8; i++) {
      const kr = r + KING_OFFSETS[i][0];
      const kf = f + KING_OFFSETS[i][1];
      if (kr >= 0 && kr <= 7 && kf >= 0 && kf <= 7) {
        const p = board[(kr << 3) | kf];
        if (p && p.color === attackerColor && p.type === 'k') return true;
      }
    }

    return false;
  }

  /**
   * Validates a FEN string against the 11 strict FIDE rules.
   * Returns { valid: boolean, error?: string, data?: object }
   */
  function validateFEN(fen) {
    if (typeof fen !== 'string') {
      return { valid: false, error: 'FEN must be a non-empty string' };
    }

    const tokens = fen.trim().split(/\s+/);

    // Rule 1: Exactly 6 space-separated fields
    if (tokens.length !== 6) {
      return {
        valid: false,
        error: `FEN must contain exactly 6 space-separated fields, found ${tokens.length}`
      };
    }

    // Rule 2: Exactly 8 ranks separated by '/'
    const ranks = tokens[0].split('/');
    if (ranks.length !== 8) {
      return {
        valid: false,
        error: `Piece placement must contain exactly 8 ranks separated by '/', found ${ranks.length}`
      };
    }

    // Parse board & check Rule 3, 9, 10
    const tempBoard = new Array(64).fill(null);
    let whiteKings = 0;
    let blackKings = 0;
    let whiteKingSq = -1;
    let blackKingSq = -1;

    for (let rIdx = 0; rIdx < 8; rIdx++) {
      const rankStr = ranks[rIdx];
      const chessRank = 8 - rIdx; // 8 down to 1
      const internalRank = chessRank - 1; // 7 down to 0
      let squareCount = 0;
      let prevWasDigit = false;

      for (let c = 0; c < rankStr.length; c++) {
        const ch = rankStr[c];

        if (ch >= '1' && ch <= '8') {
          if (prevWasDigit) {
            return {
              valid: false,
              error: `Consecutive digits not allowed in rank ${chessRank}`
            };
          }
          const emptyCount = parseInt(ch, 10);
          squareCount += emptyCount;
          prevWasDigit = true;
        } else if (PIECES[ch]) {
          const piece = PIECES[ch];
          const file = squareCount;
          if (file > 7) {
            return {
              valid: false,
              error: `Rank ${chessRank} exceeds 8 squares`
            };
          }

          // Rule 10: No pawns on rank 1 or rank 8
          if (piece.type === 'p' && (chessRank === 1 || chessRank === 8)) {
            return {
              valid: false,
              error: `Pawns cannot exist on rank 1 or rank 8 (found on rank ${chessRank})`
            };
          }

          const sqIdx = (internalRank << 3) | file;
          tempBoard[sqIdx] = piece;

          if (ch === 'K') {
            whiteKings++;
            whiteKingSq = sqIdx;
          } else if (ch === 'k') {
            blackKings++;
            blackKingSq = sqIdx;
          }

          squareCount += 1;
          prevWasDigit = false;
        } else {
          // Rule 3: Invalid character
          return {
            valid: false,
            error: `Invalid character '${ch}' in rank ${chessRank}`
          };
        }
      }

      // Rule 3: Sum == 8
      if (squareCount !== 8) {
        return {
          valid: false,
          error: `Rank ${chessRank} does not sum to 8 squares (found ${squareCount})`
        };
      }
    }

    // Rule 9: Exactly one White king and one Black king
    if (whiteKings !== 1) {
      return {
        valid: false,
        error: `Piece placement must contain exactly 1 White king ('K'), found ${whiteKings}`
      };
    }
    if (blackKings !== 1) {
      return {
        valid: false,
        error: `Piece placement must contain exactly 1 Black king ('k'), found ${blackKings}`
      };
    }

    // Rule 4: Active color is 'w' or 'b'
    const activeColor = tokens[1];
    if (activeColor !== 'w' && activeColor !== 'b') {
      return {
        valid: false,
        error: `Active color must be 'w' or 'b', found '${activeColor}'`
      };
    }

    // Rule 5: Castling rights format & validity
    const castlingStr = tokens[2];
    const tempCastling = { K: false, Q: false, k: false, q: false };

    if (castlingStr === '-') {
      // Valid, no castling rights
    } else {
      if (!/^[KQkq]{1,4}$/.test(castlingStr) || new Set(castlingStr).size !== castlingStr.length) {
        return {
          valid: false,
          error: `Invalid castling rights format '${castlingStr}'`
        };
      }

      // Semantic check: kings and rooks on home squares
      if (castlingStr.includes('K')) {
        const king = tempBoard[4]; // e1
        const rook = tempBoard[7]; // h1
        if (!king || king.type !== 'k' || king.color !== 'w' ||
            !rook || rook.type !== 'r' || rook.color !== 'w') {
          return {
            valid: false,
            error: "White kingside castling ('K') requires White King on e1 and White Rook on h1"
          };
        }
        tempCastling.K = true;
      }
      if (castlingStr.includes('Q')) {
        const king = tempBoard[4]; // e1
        const rook = tempBoard[0]; // a1
        if (!king || king.type !== 'k' || king.color !== 'w' ||
            !rook || rook.type !== 'r' || rook.color !== 'w') {
          return {
            valid: false,
            error: "White queenside castling ('Q') requires White King on e1 and White Rook on a1"
          };
        }
        tempCastling.Q = true;
      }
      if (castlingStr.includes('k')) {
        const king = tempBoard[60]; // e8
        const rook = tempBoard[63]; // h8
        if (!king || king.type !== 'k' || king.color !== 'b' ||
            !rook || rook.type !== 'r' || rook.color !== 'b') {
          return {
            valid: false,
            error: "Black kingside castling ('k') requires Black King on e8 and Black Rook on h8"
          };
        }
        tempCastling.k = true;
      }
      if (castlingStr.includes('q')) {
        const king = tempBoard[60]; // e8
        const rook = tempBoard[56]; // a8
        if (!king || king.type !== 'k' || king.color !== 'b' ||
            !rook || rook.type !== 'r' || rook.color !== 'b') {
          return {
            valid: false,
            error: "Black queenside castling ('q') requires Black King on e8 and Black Rook on a8"
          };
        }
        tempCastling.q = true;
      }
    }

    // Rule 6: En passant square format & rank correspondence & pawn presence
    const epStr = tokens[3];
    let tempEpSquare = null;

    if (epStr === '-') {
      // Valid, no ep square
    } else {
      if (!/^[a-h][36]$/.test(epStr)) {
        return {
          valid: false,
          error: `Invalid en passant square format '${epStr}'`
        };
      }

      const epFile = epStr.charCodeAt(0) - 97;
      if (activeColor === 'w') {
        if (epStr[1] !== '6') {
          return {
            valid: false,
            error: `En passant square for White to move must be on rank 6, found '${epStr}'`
          };
        }
        // Black pawn just jumped from rank 7 to rank 5
        const pawnSq = (4 << 3) | epFile; // rank 5
        const skippedSq = (5 << 3) | epFile; // rank 6
        const startSq = (6 << 3) | epFile; // rank 7
        const victimPawn = tempBoard[pawnSq];
        if (!victimPawn || victimPawn.type !== 'p' || victimPawn.color !== 'b' ||
            tempBoard[skippedSq] !== null || tempBoard[startSq] !== null) {
          return {
            valid: false,
            error: `Invalid en passant square '${epStr}': missing Black pawn on rank 5 or intermediate squares not empty`
          };
        }
        tempEpSquare = skippedSq;
      } else {
        // activeColor === 'b'
        if (epStr[1] !== '3') {
          return {
            valid: false,
            error: `En passant square for Black to move must be on rank 3, found '${epStr}'`
          };
        }
        // White pawn just jumped from rank 2 to rank 4
        const pawnSq = (3 << 3) | epFile; // rank 4
        const skippedSq = (2 << 3) | epFile; // rank 3
        const startSq = (1 << 3) | epFile; // rank 2
        const victimPawn = tempBoard[pawnSq];
        if (!victimPawn || victimPawn.type !== 'p' || victimPawn.color !== 'w' ||
            tempBoard[skippedSq] !== null || tempBoard[startSq] !== null) {
          return {
            valid: false,
            error: `Invalid en passant square '${epStr}': missing White pawn on rank 4 or intermediate squares not empty`
          };
        }
        tempEpSquare = skippedSq;
      }
    }

    // Rule 7: Halfmove clock is non-negative integer
    const halfmoveStr = tokens[4];
    if (!/^\d+$/.test(halfmoveStr)) {
      return {
        valid: false,
        error: `Halfmove clock must be a non-negative integer, found '${halfmoveStr}'`
      };
    }
    const tempHalfmove = parseInt(halfmoveStr, 10);

    // Rule 8: Fullmove number is positive integer >= 1
    const fullmoveStr = tokens[5];
    if (!/^[1-9]\d*$/.test(fullmoveStr)) {
      return {
        valid: false,
        error: `Fullmove number must be a positive integer >= 1, found '${fullmoveStr}'`
      };
    }
    const tempFullmove = parseInt(fullmoveStr, 10);

    // Rule 11: Non-active king cannot be in check
    const nonActiveColor = activeColor === 'w' ? 'b' : 'w';
    const nonActiveKingSq = nonActiveColor === 'w' ? whiteKingSq : blackKingSq;

    if (isSquareAttacked(nonActiveKingSq, activeColor, tempBoard)) {
      return {
        valid: false,
        error: 'Non-active king is in check, which is impossible in legal play'
      };
    }

    return {
      valid: true,
      data: {
        board: tempBoard,
        turn: activeColor,
        castling: tempCastling,
        epSquare: tempEpSquare,
        halfmoveClock: tempHalfmove,
        fullmoveNumber: tempFullmove,
        kingPos: { w: whiteKingSq, b: blackKingSq }
      }
    };
  }

  /**
   * The complete FIDE ChessEngine class.
   */
  class ChessEngine {
    /**
     * @param {string} [fen] - Optional FEN string. Defaults to standard starting position.
     */
    constructor(fen) {
      this.board = new Array(64).fill(null);
      this.turn = 'w';
      this.castling = { K: true, Q: true, k: true, q: true };
      this.epSquare = null;
      this.halfmoveClock = 0;
      this.fullmoveNumber = 1;
      this.kingPos = { w: 4, b: 60 };
      this.history = [];
      this.repetitionCounts = new Map();

      if (fen) {
        const res = this.loadFEN(fen);
        if (!res.valid) {
          throw new Error(`Invalid initial FEN: ${res.error}`);
        }
      } else {
        this.reset();
      }
    }

    /**
     * Resets engine to standard startpos position.
     */
    reset() {
      const res = validateFEN(STARTING_FEN);
      this._applyValidatedData(res.data);
    }

    /**
     * Loads a FEN string with strict 11-rule validation.
     * Non-destructive: if invalid, state is untouched.
     * @param {string} fen
     * @returns {{ valid: boolean; error?: string }}
     */
    loadFEN(fen) {
      const res = validateFEN(fen);
      if (!res.valid) {
        return { valid: false, error: res.error };
      }
      this._applyValidatedData(res.data);
      return { valid: true };
    }

    _applyValidatedData(data) {
      this.board = data.board.slice();
      this.turn = data.turn;
      this.castling = { ...data.castling };
      this.epSquare = data.epSquare;
      this.halfmoveClock = data.halfmoveClock;
      this.fullmoveNumber = data.fullmoveNumber;
      this.kingPos = { ...data.kingPos };
      this.history = [];
      this.repetitionCounts = new Map();
      this.repetitionCounts.set(this.getPositionKey(), 1);
    }

    /**
     * Returns current active color turn ('w' or 'b').
     * @returns {'w'|'b'}
     */
    getTurn() {
      return this.turn;
    }

    /**
     * Returns canonical 6-token FEN string.
     * @returns {string}
     */
    getFEN() {
      const rankStrings = [];

      for (let r = 7; r >= 0; r--) {
        let emptyCount = 0;
        let rankStr = '';
        for (let f = 0; f < 8; f++) {
          const piece = this.board[(r << 3) | f];
          if (!piece) {
            emptyCount++;
          } else {
            if (emptyCount > 0) {
              rankStr += emptyCount;
              emptyCount = 0;
            }
            rankStr += piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
          }
        }
        if (emptyCount > 0) {
          rankStr += emptyCount;
        }
        rankStrings.push(rankStr);
      }

      const piecePlacement = rankStrings.join('/');
      const activeColor = this.turn;

      let castling = '';
      if (this.castling.K) castling += 'K';
      if (this.castling.Q) castling += 'Q';
      if (this.castling.k) castling += 'k';
      if (this.castling.q) castling += 'q';
      if (castling === '') castling = '-';

      const epTarget = this.epSquare !== null ? indexToSquare(this.epSquare) : '-';
      const halfmove = this.halfmoveClock.toString();
      const fullmove = this.fullmoveNumber.toString();

      return `${piecePlacement} ${activeColor} ${castling} ${epTarget} ${halfmove} ${fullmove}`;
    }

    /**
     * Returns canonical 4-token position key for threefold repetition.
     * @returns {string}
     */
    getPositionKey() {
      const fen = this.getFEN();
      const tokens = fen.split(' ');
      return `${tokens[0]} ${tokens[1]} ${tokens[2]} ${tokens[3]}`;
    }

    /**
     * Returns 64-element array representing board state.
     * @returns {Array<object|null>}
     */
    getBoard() {
      return this.board.slice();
    }

    /**
     * Returns history of moves as MoveResult array.
     * @returns {Array<object>}
     */
    getMoveHistory() {
      return this.getHistory();
    }

    /**
     * Returns piece at algebraic square name or null.
     * @param {string} square e.g. 'e4'
     * @returns {{ type: string; color: 'w'|'b' } | null}
     */
    getPiece(square) {
      const idx = squareToIndex(square);
      if (idx === -1) return null;
      const piece = this.board[idx];
      return piece ? { type: piece.type, color: piece.color } : null;
    }

    /**
     * Checks if specified color (or active color) king is in check.
     * @param {'w'|'b'} [color]
     * @returns {boolean}
     */
    isCheck(color = this.turn) {
      const kingSq = this.kingPos[color];
      const oppColor = color === 'w' ? 'b' : 'w';
      return isSquareAttacked(kingSq, oppColor, this.board);
    }

    /**
     * Fast check if active player has ANY legal move.
     * Exits immediately on the first legal move found.
     * @returns {boolean}
     */
    hasAnyLegalMove() {
      const color = this.turn;
      const isWhite = color === 'w';

      for (let idx = 0; idx < 64; idx++) {
        const piece = this.board[idx];
        if (!piece || piece.color !== color) continue;

        const f = idx & 7;
        const r = idx >> 3;

        switch (piece.type) {
          case 'p': {
            const forward = isWhite ? 8 : -8;
            const oneStep = idx + forward;
            if (this.board[oneStep] === null) {
              if (this._isSimulatedMoveLegal(idx, oneStep, null, false)) return true;
              if (r === (isWhite ? 1 : 6)) {
                const twoStep = idx + (forward * 2);
                if (this.board[twoStep] === null) {
                  if (this._isSimulatedMoveLegal(idx, twoStep, null, false)) return true;
                }
              }
            }
            // Captures
            if (f > 0) {
              const capIdx = idx + forward - 1;
              const targetP = this.board[capIdx];
              if (targetP && targetP.color !== color) {
                if (this._isSimulatedMoveLegal(idx, capIdx, null, false)) return true;
              } else if (capIdx === this.epSquare) {
                if (this._isSimulatedMoveLegal(idx, capIdx, null, true)) return true;
              }
            }
            if (f < 7) {
              const capIdx = idx + forward + 1;
              const targetP = this.board[capIdx];
              if (targetP && targetP.color !== color) {
                if (this._isSimulatedMoveLegal(idx, capIdx, null, false)) return true;
              } else if (capIdx === this.epSquare) {
                if (this._isSimulatedMoveLegal(idx, capIdx, null, true)) return true;
              }
            }
            break;
          }

          case 'n': {
            for (let i = 0; i < 8; i++) {
              const kr = r + KNIGHT_OFFSETS[i][0];
              const kf = f + KNIGHT_OFFSETS[i][1];
              if (kr >= 0 && kr <= 7 && kf >= 0 && kf <= 7) {
                const targetIdx = (kr << 3) | kf;
                const destP = this.board[targetIdx];
                if (!destP || destP.color !== color) {
                  if (this._isSimulatedMoveLegal(idx, targetIdx, null, false)) return true;
                }
              }
            }
            break;
          }

          case 'b':
          case 'r':
          case 'q': {
            const directions = piece.type === 'b' ? BISHOP_DIRECTIONS :
                               piece.type === 'r' ? ROOK_DIRECTIONS : QUEEN_DIRECTIONS;
            for (let d = 0; d < directions.length; d++) {
              let cr = r + directions[d][0];
              let cf = f + directions[d][1];
              while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
                const targetIdx = (cr << 3) | cf;
                const destP = this.board[targetIdx];
                if (!destP) {
                  if (this._isSimulatedMoveLegal(idx, targetIdx, null, false)) return true;
                } else {
                  if (destP.color !== color) {
                    if (this._isSimulatedMoveLegal(idx, targetIdx, null, false)) return true;
                  }
                  break;
                }
                cr += directions[d][0];
                cf += directions[d][1];
              }
            }
            break;
          }

          case 'k': {
            for (let i = 0; i < 8; i++) {
              const kr = r + KING_OFFSETS[i][0];
              const kf = f + KING_OFFSETS[i][1];
              if (kr >= 0 && kr <= 7 && kf >= 0 && kf <= 7) {
                const targetIdx = (kr << 3) | kf;
                const destP = this.board[targetIdx];
                if (!destP || destP.color !== color) {
                  if (this._isSimulatedMoveLegal(idx, targetIdx, null, false)) return true;
                }
              }
            }
            // Castling checks
            const oppColor = isWhite ? 'b' : 'w';
            if (isWhite && idx === 4 && !isSquareAttacked(4, oppColor, this.board)) {
              if (this.castling.K && !this.board[5] && !this.board[6] &&
                  !isSquareAttacked(5, oppColor, this.board) &&
                  !isSquareAttacked(6, oppColor, this.board)) return true;
              if (this.castling.Q && !this.board[1] && !this.board[2] && !this.board[3] &&
                  !isSquareAttacked(3, oppColor, this.board) &&
                  !isSquareAttacked(2, oppColor, this.board)) return true;
            } else if (!isWhite && idx === 60 && !isSquareAttacked(60, oppColor, this.board)) {
              if (this.castling.k && !this.board[61] && !this.board[62] &&
                  !isSquareAttacked(61, oppColor, this.board) &&
                  !isSquareAttacked(62, oppColor, this.board)) return true;
              if (this.castling.q && !this.board[57] && !this.board[58] && !this.board[59] &&
                  !isSquareAttacked(59, oppColor, this.board) &&
                  !isSquareAttacked(58, oppColor, this.board)) return true;
            }
            break;
          }
        }
      }

      return false;
    }

    /**
     * Checks if current game position is checkmate.
     * @returns {boolean}
     */
    isCheckmate() {
      return this.isCheck() && !this.hasAnyLegalMove();
    }

    /**
     * Checks if current game position is stalemate.
     * @returns {boolean}
     */
    isStalemate() {
      return !this.isCheck() && !this.hasAnyLegalMove();
    }

    /**
     * Checks FIDE draw by insufficient material:
     * - K vs K
     * - KB vs K
     * - KN vs K
     * - KB vs KB with same square color parity
     * @returns {boolean}
     */
    isInsufficientMaterial() {
      let whiteKnights = 0;
      let blackKnights = 0;
      let whiteBishops = [];
      let blackBishops = [];

      for (let i = 0; i < 64; i++) {
        const piece = this.board[i];
        if (!piece) continue;
        if (piece.type === 'p' || piece.type === 'r' || piece.type === 'q') {
          return false;
        }
        if (piece.type === 'n') {
          if (piece.color === 'w') whiteKnights++;
          else blackKnights++;
        } else if (piece.type === 'b') {
          if (piece.color === 'w') whiteBishops.push(i);
          else blackBishops.push(i);
        }
      }

      const totalWhiteMinor = whiteKnights + whiteBishops.length;
      const totalBlackMinor = blackKnights + blackBishops.length;

      // K vs K
      if (totalWhiteMinor === 0 && totalBlackMinor === 0) {
        return true;
      }

      // KB vs K or KN vs K
      if (totalWhiteMinor === 1 && totalBlackMinor === 0) return true;
      if (totalBlackMinor === 1 && totalWhiteMinor === 0) return true;

      // KB vs KB where both bishops share square color parity
      if (totalWhiteMinor === 1 && totalBlackMinor === 1 &&
          whiteBishops.length === 1 && blackBishops.length === 1) {
        const wParity = getSquareColor(whiteBishops[0]);
        const bParity = getSquareColor(blackBishops[0]);
        if (wParity === bParity) {
          return true;
        }
      }

      return false;
    }

    /**
     * Checks draw by 50-move rule (100 plies without pawn move or capture).
     * @returns {boolean}
     */
    is50MoveRule() {
      return this.halfmoveClock >= 100;
    }

    /**
     * Checks draw by threefold repetition.
     * @returns {boolean}
     */
    isThreefoldRepetition() {
      const key = this.getPositionKey();
      return (this.repetitionCounts.get(key) || 0) >= 3;
    }

    /**
     * Unified draw detection: stalemate, insufficient material, 50-move rule, threefold repetition.
     * @returns {boolean}
     */
    isDraw() {
      return this.isStalemate() ||
             this.isInsufficientMaterial() ||
             this.is50MoveRule() ||
             this.isThreefoldRepetition();
    }

    /**
     * Internal simulation helper for King safety check.
     */
    _isSimulatedMoveLegal(from, to, promotion, isEnPassant) {
      const movingPiece = this.board[from];
      const targetPiece = this.board[to];
      const color = movingPiece.color;
      const oppColor = color === 'w' ? 'b' : 'w';

      let victimSq = -1;
      let victimPiece = null;

      if (isEnPassant) {
        victimSq = color === 'w' ? to - 8 : to + 8;
        victimPiece = this.board[victimSq];
        this.board[victimSq] = null;
      }

      const origKingSq = this.kingPos[color];
      if (movingPiece.type === 'k') {
        this.kingPos[color] = to;
      }

      this.board[to] = movingPiece;
      this.board[from] = null;

      const safe = !isSquareAttacked(this.kingPos[color], oppColor, this.board);

      // Rollback
      this.board[from] = movingPiece;
      this.board[to] = targetPiece;
      if (isEnPassant) {
        this.board[victimSq] = victimPiece;
      }
      if (movingPiece.type === 'k') {
        this.kingPos[color] = origKingSq;
      }

      return safe;
    }

    /**
     * Generates pseudo-legal moves for a specific square or all pieces of the active side.
     * @param {number|null} [fromIndex=null]
     * @returns {Array}
     */
    _generatePseudoMoves(fromIndex = null) {
      const moves = [];
      const color = this.turn;
      const isWhite = color === 'w';

      const start = fromIndex !== null ? fromIndex : 0;
      const end = fromIndex !== null ? fromIndex + 1 : 64;

      for (let idx = start; idx < end; idx++) {
        const piece = this.board[idx];
        if (!piece || piece.color !== color) continue;

        const f = idx & 7;
        const r = idx >> 3;

        switch (piece.type) {
          case 'p': {
            const forward = isWhite ? 8 : -8;
            const startRank = isWhite ? 1 : 6;
            const promoRank = isWhite ? 7 : 0;

            // 1. One step
            const oneStep = idx + forward;
            if (this.board[oneStep] === null) {
              const isPromo = (oneStep >> 3) === promoRank;
              if (isPromo) {
                moves.push({ from: idx, to: oneStep, piece: 'p', color, captured: null, promotion: 'q' });
                moves.push({ from: idx, to: oneStep, piece: 'p', color, captured: null, promotion: 'r' });
                moves.push({ from: idx, to: oneStep, piece: 'p', color, captured: null, promotion: 'b' });
                moves.push({ from: idx, to: oneStep, piece: 'p', color, captured: null, promotion: 'n' });
              } else {
                moves.push({ from: idx, to: oneStep, piece: 'p', color, captured: null, promotion: null });

                // 2. Two steps from home rank
                if (r === startRank) {
                  const twoStep = idx + (forward * 2);
                  if (this.board[twoStep] === null) {
                    moves.push({ from: idx, to: twoStep, piece: 'p', color, captured: null, promotion: null, isTwoStepPawn: true });
                  }
                }
              }
            }

            // 3. Captures
            const capFiles = [f - 1, f + 1];
            for (let i = 0; i < 2; i++) {
              const cf = capFiles[i];
              if (cf >= 0 && cf <= 7) {
                const targetIdx = ((r + (isWhite ? 1 : -1)) << 3) | cf;
                const destPiece = this.board[targetIdx];
                const isPromo = (targetIdx >> 3) === promoRank;

                if (destPiece && destPiece.color !== color) {
                  if (isPromo) {
                    moves.push({ from: idx, to: targetIdx, piece: 'p', color, captured: destPiece.type, promotion: 'q' });
                    moves.push({ from: idx, to: targetIdx, piece: 'p', color, captured: destPiece.type, promotion: 'r' });
                    moves.push({ from: idx, to: targetIdx, piece: 'p', color, captured: destPiece.type, promotion: 'b' });
                    moves.push({ from: idx, to: targetIdx, piece: 'p', color, captured: destPiece.type, promotion: 'n' });
                  } else {
                    moves.push({ from: idx, to: targetIdx, piece: 'p', color, captured: destPiece.type, promotion: null });
                  }
                } else if (targetIdx === this.epSquare) {
                  // En passant capture
                  moves.push({ from: idx, to: targetIdx, piece: 'p', color, captured: 'p', promotion: null, isEnPassant: true });
                }
              }
            }
            break;
          }

          case 'n': {
            for (let i = 0; i < 8; i++) {
              const kr = r + KNIGHT_OFFSETS[i][0];
              const kf = f + KNIGHT_OFFSETS[i][1];
              if (kr >= 0 && kr <= 7 && kf >= 0 && kf <= 7) {
                const targetIdx = (kr << 3) | kf;
                const destPiece = this.board[targetIdx];
                if (destPiece === null) {
                  moves.push({ from: idx, to: targetIdx, piece: 'n', color, captured: null });
                } else if (destPiece.color !== color) {
                  moves.push({ from: idx, to: targetIdx, piece: 'n', color, captured: destPiece.type });
                }
              }
            }
            break;
          }

          case 'b':
          case 'r':
          case 'q': {
            const directions = piece.type === 'b' ? BISHOP_DIRECTIONS :
                               piece.type === 'r' ? ROOK_DIRECTIONS : QUEEN_DIRECTIONS;
            for (let d = 0; d < directions.length; d++) {
              const dr = directions[d][0];
              const df = directions[d][1];
              let cr = r + dr;
              let cf = f + df;
              while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
                const targetIdx = (cr << 3) | cf;
                const destPiece = this.board[targetIdx];
                if (destPiece === null) {
                  moves.push({ from: idx, to: targetIdx, piece: piece.type, color, captured: null });
                } else {
                  if (destPiece.color !== color) {
                    moves.push({ from: idx, to: targetIdx, piece: piece.type, color, captured: destPiece.type });
                  }
                  break;
                }
                cr += dr;
                cf += df;
              }
            }
            break;
          }

          case 'k': {
            for (let i = 0; i < 8; i++) {
              const kr = r + KING_OFFSETS[i][0];
              const kf = f + KING_OFFSETS[i][1];
              if (kr >= 0 && kr <= 7 && kf >= 0 && kf <= 7) {
                const targetIdx = (kr << 3) | kf;
                const destPiece = this.board[targetIdx];
                if (destPiece === null) {
                  moves.push({ from: idx, to: targetIdx, piece: 'k', color, captured: null });
                } else if (destPiece.color !== color) {
                  moves.push({ from: idx, to: targetIdx, piece: 'k', color, captured: destPiece.type });
                }
              }
            }

            // Castling
            const oppColor = isWhite ? 'b' : 'w';
            if (!isSquareAttacked(idx, oppColor, this.board)) {
              if (isWhite && idx === 4) {
                // Kingside (O-O)
                if (this.castling.K &&
                    this.board[5] === null && this.board[6] === null &&
                    !isSquareAttacked(5, oppColor, this.board) &&
                    !isSquareAttacked(6, oppColor, this.board)) {
                  moves.push({ from: 4, to: 6, piece: 'k', color, captured: null, isKingsideCastle: true });
                }
                // Queenside (O-O-O)
                if (this.castling.Q &&
                    this.board[1] === null && this.board[2] === null && this.board[3] === null &&
                    !isSquareAttacked(3, oppColor, this.board) &&
                    !isSquareAttacked(2, oppColor, this.board)) {
                  moves.push({ from: 4, to: 2, piece: 'k', color, captured: null, isQueensideCastle: true });
                }
              } else if (!isWhite && idx === 60) {
                // Kingside (O-O)
                if (this.castling.k &&
                    this.board[61] === null && this.board[62] === null &&
                    !isSquareAttacked(61, oppColor, this.board) &&
                    !isSquareAttacked(62, oppColor, this.board)) {
                  moves.push({ from: 60, to: 62, piece: 'k', color, captured: null, isKingsideCastle: true });
                }
                // Queenside (O-O-O)
                if (this.castling.q &&
                    this.board[57] === null && this.board[58] === null && this.board[59] === null &&
                    !isSquareAttacked(59, oppColor, this.board) &&
                    !isSquareAttacked(58, oppColor, this.board)) {
                  moves.push({ from: 60, to: 58, piece: 'k', color, captured: null, isQueensideCastle: true });
                }
              }
            }
            break;
          }
        }
      }

      return moves;
    }

    /**
     * Builds standard Algebraic Notation (SAN) prefix/body for a move before it is made.
     * PGN 8.2.3.2 disambiguation: file-first, rank-second, full-square.
     */
    _buildSANBase(move) {
      if (move.isKingsideCastle) return 'O-O';
      if (move.isQueensideCastle) return 'O-O-O';

      const fromSq = indexToSquare(move.from);
      const toSq = indexToSquare(move.to);
      const pieceUpper = move.piece.toUpperCase();
      const isCapture = !!move.captured;

      if (move.piece === 'p') {
        let san = isCapture ? fromSq[0] + 'x' + toSq : toSq;
        if (move.promotion) {
          san += '=' + move.promotion.toUpperCase();
        }
        return san;
      }

      if (move.piece === 'k') {
        return 'K' + (isCapture ? 'x' : '') + toSq;
      }

      // Piece moves: N, B, R, Q
      let disambiguation = '';

      // Find other friendly pieces of same type that could legally move to the same destination
      const otherFroms = [];
      const color = move.color;
      for (let i = 0; i < 64; i++) {
        if (i === move.from) continue;
        const p = this.board[i];
        if (p && p.color === color && p.type === move.piece) {
          const pseudoMoves = this._generatePseudoMoves(i);
          for (let j = 0; j < pseudoMoves.length; j++) {
            const pm = pseudoMoves[j];
            if (pm.to === move.to && this._isSimulatedMoveLegal(pm.from, pm.to, pm.promotion, !!pm.isEnPassant)) {
              otherFroms.push(i);
              break;
            }
          }
        }
      }

      if (otherFroms.length > 0) {
        const fromFile = move.from & 7;
        const fromRank = move.from >> 3;

        const sameFile = otherFroms.some(sq => (sq & 7) === fromFile);
        const sameRank = otherFroms.some(sq => (sq >> 3) === fromRank);

        // Under PGN 8.2.3.4, if another piece shares the file, rank can only disambiguate
        // if no candidate pieces share a rank (i.e. ranks uniquely distinguish the candidate pieces)
        const allCandidates = [move.from, ...otherFroms];
        const rankCounts = {};
        for (let k = 0; k < allCandidates.length; k++) {
          const r = allCandidates[k] >> 3;
          rankCounts[r] = (rankCounts[r] || 0) + 1;
        }
        const hasRankCollision = Object.values(rankCounts).some(c => c > 1);

        if (!sameFile) {
          disambiguation = FILES[fromFile];
        } else if (!sameRank && !hasRankCollision) {
          disambiguation = RANKS[fromRank];
        } else {
          disambiguation = FILES[fromFile] + RANKS[fromRank];
        }
      }

      return pieceUpper + disambiguation + (isCapture ? 'x' : '') + toSq;
    }

    /**
     * Alias for getLegalMoves to support { from } option object or square string.
     * @param {string|object} [opts]
     * @returns {Array<object>}
     */
    generateLegalMoves(opts) {
      if (typeof opts === 'object' && opts !== null && opts.from) {
        return this.getLegalMoves(opts.from);
      }
      return this.getLegalMoves(opts);
    }

    /**
     * Checks if current position is game over (checkmate, stalemate, or draw).
     * @returns {boolean}
     */
    isGameOver() {
      return this.isCheckmate() || this.isStalemate() || this.isDraw();
    }

    /**
     * Returns legal moves for the position.
     * If square is specified, filters moves originating from that square.
     * @param {string} [square]
     * @returns {Array<object>}
     */
    getLegalMoves(square) {
      let fromIndex = null;
      if (typeof square === 'string') {
        fromIndex = squareToIndex(square);
        if (fromIndex === -1) return [];
        const p = this.board[fromIndex];
        if (!p || p.color !== this.turn) return [];
      }

      const pseudoMoves = this._generatePseudoMoves(fromIndex);
      const legalMoves = [];

      for (let i = 0; i < pseudoMoves.length; i++) {
        const pm = pseudoMoves[i];
        if (this._isSimulatedMoveLegal(pm.from, pm.to, pm.promotion, !!pm.isEnPassant)) {
          // Construct MoveResult
          const fromStr = indexToSquare(pm.from);
          const toStr = indexToSquare(pm.to);
          const lan = fromStr + toStr + (pm.promotion ? pm.promotion.toLowerCase() : '');

          const isPromotion = !!pm.promotion;
          const isCapture = !!pm.captured;
          const isEnPassant = !!pm.isEnPassant;
          const isKingsideCastle = !!pm.isKingsideCastle;
          const isQueensideCastle = !!pm.isQueensideCastle;

          const moveResult = {
            from: fromStr,
            to: toStr,
            piece: pm.piece,
            color: pm.color,
            captured: pm.captured || null,
            promotion: pm.promotion || null,
            flags: {
              isCapture,
              isEnPassant,
              isKingsideCastle,
              isQueensideCastle,
              isPromotion,
              isCheck: false,
              isCheckmate: false,
              isStalemate: false,
              isDraw: false
            },
            san: '',
            lan,
            _internal: pm
          };

          legalMoves.push(moveResult);
        }
      }

      return legalMoves;
    }

    /**
     * Executes a move on the board and updates all game state.
     * Returns MoveResult on success, or null if illegal.
     * @param {{ from: string; to: string; promotion?: string }|object} move
     * @returns {object|null}
     */
    makeMove(move) {
      if (!move || typeof move.from !== 'string' || typeof move.to !== 'string') {
        return null;
      }

      let internalMove = null;
      let matchedLegalMove = null;

      if (move._internal && move._internal.from !== undefined) {
        internalMove = move._internal;
        matchedLegalMove = move;
      } else {
        const legalMoves = this.getLegalMoves(move.from);
        const reqPromo = move.promotion ? move.promotion.toLowerCase() : null;
        for (let i = 0; i < legalMoves.length; i++) {
          const lm = legalMoves[i];
          if (lm.from === move.from && lm.to === move.to && (lm.promotion || null) === reqPromo) {
            internalMove = lm._internal;
            matchedLegalMove = lm;
            break;
          }
        }
      }

      if (!internalMove) {
        return null;
      }

      // Precompute SAN base before applying move
      const sanBase = this._buildSANBase(internalMove);

      // Snapshot current state for rollback and history
      const prevCastling = { ...this.castling };
      const prevEpSquare = this.epSquare;
      const prevHalfmoveClock = this.halfmoveClock;
      const prevFullmoveNumber = this.fullmoveNumber;
      const prevKingPos = { ...this.kingPos };
      const posKeyBefore = this.getPositionKey();

      const from = internalMove.from;
      const to = internalMove.to;
      const movingPiece = this.board[from];
      const capturedPiece = this.board[to];

      // Physical piece movement
      this.board[from] = null;
      if (internalMove.promotion) {
        this.board[to] = PIECES[internalMove.color === 'w' ? internalMove.promotion.toUpperCase() : internalMove.promotion.toLowerCase()];
      } else {
        this.board[to] = movingPiece;
      }

      // En passant physical removal
      let epVictimSq = null;
      let epVictimPiece = null;
      if (internalMove.isEnPassant) {
        epVictimSq = internalMove.color === 'w' ? to - 8 : to + 8;
        epVictimPiece = this.board[epVictimSq];
        this.board[epVictimSq] = null;
      }

      // Castling physical rook movement
      if (internalMove.isKingsideCastle) {
        if (internalMove.color === 'w') {
          this.board[5] = this.board[7]; // f1 = h1
          this.board[7] = null;
        } else {
          this.board[61] = this.board[63]; // f8 = h8
          this.board[63] = null;
        }
      } else if (internalMove.isQueensideCastle) {
        if (internalMove.color === 'w') {
          this.board[3] = this.board[0]; // d1 = a1
          this.board[0] = null;
        } else {
          this.board[59] = this.board[56]; // d8 = a8
          this.board[56] = null;
        }
      }

      // Update king position
      if (movingPiece.type === 'k') {
        this.kingPos[movingPiece.color] = to;
      }

      // Update Castling Rights
      if (movingPiece.type === 'k') {
        if (movingPiece.color === 'w') {
          this.castling.K = false;
          this.castling.Q = false;
        } else {
          this.castling.k = false;
          this.castling.q = false;
        }
      }
      // Rooks leaving home squares
      if (from === 0) this.castling.Q = false;
      else if (from === 7) this.castling.K = false;
      else if (from === 56) this.castling.q = false;
      else if (from === 63) this.castling.k = false;

      // Rooks captured on home squares
      if (to === 0) this.castling.Q = false;
      else if (to === 7) this.castling.K = false;
      else if (to === 56) this.castling.q = false;
      else if (to === 63) this.castling.k = false;

      // Update En Passant Square
      if (movingPiece.type === 'p' && Math.abs(to - from) === 16) {
        this.epSquare = (from + to) >> 1;
      } else {
        this.epSquare = null;
      }

      // Update Halfmove Clock
      if (movingPiece.type === 'p' || internalMove.captured) {
        this.halfmoveClock = 0;
      } else {
        this.halfmoveClock++;
      }

      // Update Fullmove Number
      if (movingPiece.color === 'b') {
        this.fullmoveNumber++;
      }

      // Switch turn
      this.turn = this.turn === 'w' ? 'b' : 'w';

      // Update repetition tracking for new position
      const newPosKey = this.getPositionKey();
      const repCount = (this.repetitionCounts.get(newPosKey) || 0) + 1;
      this.repetitionCounts.set(newPosKey, repCount);

      // Evaluate check, checkmate, stalemate, and draw on resulting state
      const oppInCheck = this.isCheck();
      const oppHasMoves = this.hasAnyLegalMove();

      let isCheckmate = false;
      let isStalemate = false;
      if (oppInCheck) {
        if (!oppHasMoves) isCheckmate = true;
      } else {
        if (!oppHasMoves) isStalemate = true;
      }
      const isDraw = isStalemate || this.isInsufficientMaterial() || this.is50MoveRule() || (repCount >= 3);

      // Finalize SAN with suffix
      let san = sanBase;
      if (isCheckmate) san += '#';
      else if (oppInCheck) san += '+';

      const result = {
        from: indexToSquare(from),
        to: indexToSquare(to),
        piece: internalMove.piece,
        color: internalMove.color,
        captured: internalMove.captured || null,
        promotion: internalMove.promotion || null,
        flags: {
          isCapture: !!internalMove.captured,
          isEnPassant: !!internalMove.isEnPassant,
          isKingsideCastle: !!internalMove.isKingsideCastle,
          isQueensideCastle: !!internalMove.isQueensideCastle,
          isPromotion: !!internalMove.promotion,
          isCheck: oppInCheck,
          isCheckmate,
          isStalemate,
          isDraw
        },
        san,
        lan: indexToSquare(from) + indexToSquare(to) + (internalMove.promotion ? internalMove.promotion.toLowerCase() : '')
      };

      // Push history entry for complete undo
      this.history.push({
        internalMove,
        moveResult: result,
        prevCastling,
        prevEpSquare,
        prevHalfmoveClock,
        prevFullmoveNumber,
        prevKingPos,
        posKeyAfter: newPosKey,
        movingPiece,
        capturedPiece,
        epVictimPiece,
        epVictimSq
      });

      return result;
    }

    /**
     * Undoes the last move, fully restoring board state and game clocks.
     * Returns the undone MoveResult or null if history is empty.
     * @returns {object|null}
     */
    undoMove() {
      if (this.history.length === 0) return null;

      const entry = this.history.pop();
      const m = entry.internalMove;

      // Decrement repetition map
      const repCount = this.repetitionCounts.get(entry.posKeyAfter) - 1;
      if (repCount <= 0) {
        this.repetitionCounts.delete(entry.posKeyAfter);
      } else {
        this.repetitionCounts.set(entry.posKeyAfter, repCount);
      }

      // Revert state variables
      this.turn = m.color;
      this.castling = { ...entry.prevCastling };
      this.epSquare = entry.prevEpSquare;
      this.halfmoveClock = entry.prevHalfmoveClock;
      this.fullmoveNumber = entry.prevFullmoveNumber;
      this.kingPos = { ...entry.prevKingPos };

      // Restore moving piece
      this.board[m.from] = entry.movingPiece;

      // Restore destination square
      if (m.isEnPassant) {
        this.board[m.to] = null;
        this.board[entry.epVictimSq] = entry.epVictimPiece;
      } else if (m.isKingsideCastle) {
        this.board[m.to] = null;
        if (m.color === 'w') {
          this.board[7] = this.board[5]; // h1 = f1
          this.board[5] = null;
        } else {
          this.board[63] = this.board[61]; // h8 = f8
          this.board[61] = null;
        }
      } else if (m.isQueensideCastle) {
        this.board[m.to] = null;
        if (m.color === 'w') {
          this.board[0] = this.board[3]; // a1 = d1
          this.board[3] = null;
        } else {
          this.board[56] = this.board[59]; // a8 = d8
          this.board[59] = null;
        }
      } else {
        this.board[m.to] = entry.capturedPiece;
      }

      return entry.moveResult;
    }

    /**
     * Returns move history as array of MoveResult objects.
     * @returns {Array<object>}
     */
    getHistory() {
      return this.history.map(h => ({ ...h.moveResult, flags: { ...h.moveResult.flags } }));
    }

    /**
     * Recursive legal move leaf node traversal for validation and benchmarking.
     * @param {number} depth
     * @returns {number}
     */
    perft(depth) {
      if (depth <= 0) return 1;
      const moves = this.getLegalMoves();
      if (depth === 1) return moves.length;

      let nodes = 0;
      for (let i = 0; i < moves.length; i++) {
        this.makeMove(moves[i]);
        nodes += this.perft(depth - 1);
        this.undoMove();
      }
      return nodes;
    }

    /**
     * Perft divide for diagnostic tracing.
     * @param {number} depth
     * @returns {{ total: number; breakdown: Record<string, number> }}
     */
    perftDivide(depth) {
      if (depth <= 0) return { total: 1, breakdown: {} };
      const moves = this.getLegalMoves();
      const breakdown = {};
      let total = 0;

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const uci = move.lan;
        this.makeMove(move);
        const subNodes = depth > 1 ? this.perft(depth - 1) : 1;
        this.undoMove();
        breakdown[uci] = subNodes;
        total += subNodes;
      }
      return { total, breakdown };
    }
  }

  return {
    ChessEngine,
    squareToIndex,
    indexToSquare,
    isSquareAttacked,
    validateFEN
  };
});
