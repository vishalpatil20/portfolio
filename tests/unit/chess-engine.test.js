/**
 * Comprehensive Automated Unit Test Suite for ChessEngine
 * Zero external npm dependencies. Standalone Node.js test runner.
 */

const { ChessEngine, squareToIndex, indexToSquare, isSquareAttacked, validateFEN } = require('../../chess-engine.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function describe(suiteName, fn) {
  console.log(`\n\x1b[1m\x1b[34m--- ${suiteName} ---\x1b[0m`);
  fn();
}

function it(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✗\x1b[0m ${testName}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failures.push({ suite: testName, error: err.message, stack: err.stack });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Failed'}: expected [${expected}], got [${actual}]`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Failed'}: expected ${expectedStr}, got ${actualStr}`);
  }
}

// ==========================================
// SUITE 1: Board Coordinates & Math
// ==========================================
describe('Suite 1: Board Coordinates & Math', () => {
  it('converts algebraic squares to indices accurately', () => {
    assertEqual(squareToIndex('a1'), 0, 'a1 should be index 0');
    assertEqual(squareToIndex('h1'), 7, 'h1 should be index 7');
    assertEqual(squareToIndex('a2'), 8, 'a2 should be index 8');
    assertEqual(squareToIndex('e4'), 28, 'e4 should be index 28');
    assertEqual(squareToIndex('a8'), 56, 'a8 should be index 56');
    assertEqual(squareToIndex('h8'), 63, 'h8 should be index 63');
  });

  it('rejects invalid algebraic squares', () => {
    assertEqual(squareToIndex('i1'), -1, 'i1 is off board');
    assertEqual(squareToIndex('a9'), -1, 'a9 is off board');
    assertEqual(squareToIndex(''), -1, 'empty string is invalid');
    assertEqual(squareToIndex('e44'), -1, 'length > 2 is invalid');
  });

  it('converts indices to algebraic squares accurately', () => {
    assertEqual(indexToSquare(0), 'a1');
    assertEqual(indexToSquare(7), 'h1');
    assertEqual(indexToSquare(28), 'e4');
    assertEqual(indexToSquare(56), 'a8');
    assertEqual(indexToSquare(63), 'h8');
    assertEqual(indexToSquare(-1), '');
    assertEqual(indexToSquare(64), '');
  });
});

// ==========================================
// SUITE 2: FEN Parser & 11 Strict Rules
// ==========================================
describe('Suite 2: FEN Parser & 11 Strict Rules', () => {
  const validStartpos = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('accepts standard starting position', () => {
    const res = validateFEN(validStartpos);
    assert(res.valid, 'startpos should be valid');
  });

  it('Rule 1: rejects FEN without exactly 6 tokens', () => {
    // 5 tokens
    const fiveTokens = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0';
    const res5 = validateFEN(fiveTokens);
    assert(!res5.valid && res5.error.includes('6 space-separated fields'), 'must reject 5 tokens');

    // 7 tokens
    const sevenTokens = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 extra';
    const res7 = validateFEN(sevenTokens);
    assert(!res7.valid && res7.error.includes('6 space-separated fields'), 'must reject 7 tokens');
  });

  it('Rule 2: rejects FEN without exactly 8 ranks', () => {
    const sevenRanks = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1';
    const res = validateFEN(sevenRanks);
    assert(!res.valid && res.error.includes('8 ranks separated by'), 'must reject 7 ranks');
  });

  it('Rule 3: rejects rank sum not equal to 8 and invalid characters', () => {
    // Rank sum 7
    const rankSum7 = 'rnbqkbnr/pppppppp/8/8/7/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const res7 = validateFEN(rankSum7);
    assert(!res7.valid && res7.error.includes('does not sum to 8 squares'), 'must reject sum 7');

    // Rank sum 9
    const rankSum9 = 'rnbqkbnr/pppppppp/8/8/9/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const res9 = validateFEN(rankSum9);
    assert(!res9.valid, 'must reject sum 9');

    // Consecutive digits
    const consecDigits = 'rnbqkbnr/pppppppp/8/8/44/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const resCD = validateFEN(consecDigits);
    assert(!resCD.valid && resCD.error.includes('Consecutive digits not allowed'), 'must reject consecutive digits');

    // Invalid character
    const invalidChar = 'rnbqkbnr/pppppppp/8/8/4x3/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const resChar = validateFEN(invalidChar);
    assert(!resChar.valid && resChar.error.includes("Invalid character 'x'"), 'must reject invalid char');
  });

  it('Rule 4: rejects invalid active color', () => {
    const res = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1');
    assert(!res.valid && res.error.includes("Active color must be 'w' or 'b'"), 'must reject active color x');
  });

  it('Rule 5: rejects invalid castling rights format & semantics', () => {
    // Duplicate characters
    const resDup = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KKkq - 0 1');
    assert(!resDup.valid && resDup.error.includes('castling rights format'), 'must reject duplicate K');

    // Invalid character
    const resChar = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQx - 0 1');
    assert(!resChar.valid, 'must reject invalid castling char');

    // Semantic: K castling right but no Rook on h1
    const noH1Rook = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w KQkq - 0 1';
    const resNoRook = validateFEN(noH1Rook);
    assert(!resNoRook.valid && resNoRook.error.includes('requires White King on e1 and White Rook on h1'), 'must reject castling right without rook on home square');
  });

  it('Rule 6: rejects invalid en passant square format and semantic requirements', () => {
    // Invalid format
    const resFormat = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e9 0 1');
    assert(!resFormat.valid && resFormat.error.includes('en passant square format'), 'must reject e9');

    // Rank mismatch: White to move requires rank 6
    const resRank = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e3 0 1');
    assert(!resRank.valid && resRank.error.includes('must be on rank 6'), 'must reject e3 when white to move');

    // Missing pawn on rank 5 for White to move with ep e6
    const missingPawn = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1';
    const resPawn = validateFEN(missingPawn);
    assert(!resPawn.valid && resPawn.error.includes('missing Black pawn on rank 5'), 'must reject e6 when no black pawn on e5');

    // Valid en passant setup
    const validEP = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    const resValid = validateFEN(validEP);
    assert(resValid.valid, 'valid EP position must pass');
  });

  it('Rule 7: rejects invalid halfmove clock', () => {
    const resNeg = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1');
    assert(!resNeg.valid && resNeg.error.includes('Halfmove clock must be a non-negative integer'), 'must reject -1');
    const resAlpha = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - abc 1');
    assert(!resAlpha.valid, 'must reject non-integer halfmove');
  });

  it('Rule 8: rejects invalid fullmove number', () => {
    const resZero = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0');
    assert(!resZero.valid && resZero.error.includes('Fullmove number must be a positive integer >= 1'), 'must reject fullmove 0');
  });

  it('Rule 9: rejects wrong number of kings', () => {
    // 0 White kings
    const noWhiteKing = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w KQkq - 0 1';
    const res0 = validateFEN(noWhiteKing);
    assert(!res0.valid && res0.error.includes("exactly 1 White king ('K')"), 'must reject 0 white kings');

    // 2 White kings
    const twoWhiteKings = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNK w KQkq - 0 1';
    const res2 = validateFEN(twoWhiteKings);
    assert(!res2.valid && res2.error.includes("exactly 1 White king ('K')"), 'must reject 2 white kings');
  });

  it('Rule 10: rejects pawns on rank 1 or rank 8', () => {
    const pawnOn8 = 'rnbqkbnP/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const res = validateFEN(pawnOn8);
    assert(!res.valid && res.error.includes('Pawns cannot exist on rank 1 or rank 8'), 'must reject pawn on rank 8');

    const pawnOn1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNp w KQkq - 0 1';
    const res1 = validateFEN(pawnOn1);
    assert(!res1.valid && res1.error.includes('Pawns cannot exist on rank 1 or rank 8'), 'must reject pawn on rank 1');
  });

  it('Rule 11: rejects non-active king in check', () => {
    // White to move, but Black King is in check from White Queen on e7
    const blackKingChecked = 'rnb1kbnr/ppppQppp/8/8/8/8/PPPP1PPP/RNB1KBNR w KQkq - 0 1';
    const res = validateFEN(blackKingChecked);
    assert(!res.valid && res.error.includes('Non-active king is in check'), 'must reject position where side not to move is checked');
  });

  it('ensures loadFEN is strictly non-destructive when given invalid FEN', () => {
    const engine = new ChessEngine();
    const originalFEN = engine.getFEN();

    const res = engine.loadFEN('invalid-fen-string');
    assert(!res.valid, 'loadFEN should return false for invalid string');
    assertEqual(engine.getFEN(), originalFEN, 'FEN must be completely unmodified after failed loadFEN');
  });
});

// ==========================================
// SUITE 3: Canonical FEN Serialization & Round-Trip
// ==========================================
describe('Suite 3: Canonical FEN Serialization & Round-Trip', () => {
  const testFens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'
  ];

  testFens.forEach((fen, i) => {
    it(`preserves round-trip idempotency for position ${i + 1}`, () => {
      const engine = new ChessEngine(fen);
      assertEqual(engine.getFEN(), fen, `getFEN() must equal input FEN for test position ${i + 1}`);
    });
  });
});

// ==========================================
// SUITE 4: Piece Move Generation
// ==========================================
describe('Suite 4: Piece Move Generation', () => {
  it('generates 20 opening moves for White in startpos', () => {
    const engine = new ChessEngine();
    const moves = engine.getLegalMoves();
    assertEqual(moves.length, 20, 'Initial position must have exactly 20 legal moves (16 pawn pushes + 4 knight leaps)');
  });

  it('generates pawn moves: 1-step, 2-step, and diagonal captures', () => {
    const engine = new ChessEngine('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const moves = engine.getLegalMoves('e4');
    // e4 can advance to e5, or capture on d5
    const lans = moves.map(m => m.lan).sort();
    assertDeepEqual(lans, ['e4d5', 'e4e5'], 'e4 pawn should have advance e5 and capture d5');
  });

  it('generates 4 promotions for pawn reaching 8th rank', () => {
    // Black King on a8, White King on a1, White pawn on e7, e8 is empty
    const engine = new ChessEngine('k7/4P3/8/8/8/8/8/K7 w - - 0 1');
    const moves = engine.getLegalMoves('e7');
    assertEqual(moves.length, 4, 'Pawn on e7 should have 4 promotion options (q, r, b, n)');
    const promos = moves.map(m => m.promotion).sort();
    assertDeepEqual(promos, ['b', 'n', 'q', 'r']);
  });

  it('generates 8 knight leaps correctly jumping over pieces', () => {
    const engine = new ChessEngine('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1');
    const moves = engine.getLegalMoves('e4');
    assertEqual(moves.length, 8, 'Central knight on e4 must have 8 legal leaps');
  });

  it('generates sliding rays for Bishop, Rook, Queen with collision stopping', () => {
    // Rook on e4 with friendly piece on e6, enemy piece on c4
    const engine = new ChessEngine('4k3/8/4P3/8/2p1R3/8/8/4K3 w - - 0 1');
    const moves = engine.getLegalMoves('e4');
    const tos = moves.map(m => m.to).sort();
    // Cannot reach e6 or e7/e8. Can reach c4 (capture) but not a4/b4.
    assert(tos.includes('c4'), 'Rook must be able to capture on c4');
    assert(!tos.includes('b4'), 'Rook cannot jump past c4');
    assert(!tos.includes('e6'), 'Rook cannot capture friendly piece on e6');
    assert(tos.includes('e5'), 'Rook can move to e5');
  });

  it('generates 1-step moves for King and avoids moving into check', () => {
    const engine = new ChessEngine('k7/8/8/8/8/8/r7/4K3 w - - 0 1');
    const moves = engine.getLegalMoves('e1');
    // Black rook on a2 attacks 2nd rank. White King on e1 cannot step to d2, e2, f2!
    const tos = moves.map(m => m.to).sort();
    assertDeepEqual(tos, ['d1', 'f1'], 'King on e1 under 2nd rank attack can only step to d1 or f1');
  });
});

// ==========================================
// SUITE 5: En Passant & Rank-Clear Pin Edge Case
// ==========================================
describe('Suite 5: En Passant & Rank-Clear Pin Edge Case', () => {
  it('executes en passant capture and removes victim pawn from board', () => {
    // White pawn on e5, Black pawn just played d7-d5 setting ep target d6
    const engine = new ChessEngine('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    const epMove = engine.makeMove({ from: 'e5', to: 'd6' });
    assert(epMove !== null, 'En passant capture exd6 should be legal');
    assert(epMove.flags.isEnPassant, 'MoveResult flags.isEnPassant must be true');
    assert(epMove.flags.isCapture, 'MoveResult flags.isCapture must be true');
    assertEqual(epMove.captured, 'p', 'Captured piece must be pawn');
    assertEqual(engine.getPiece('d5'), null, 'Victim pawn on d5 must be removed from board');
    assertEqual(engine.getPiece('d6').type, 'p', 'White pawn must now be on d6');
  });

  it('resets en passant square after 1 halfmove if not taken', () => {
    const engine = new ChessEngine('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    assertEqual(engine.epSquare, squareToIndex('d6'), 'Initial epSquare should be d6');
    // White plays Nf3 instead of exd6
    engine.makeMove({ from: 'g1', to: 'f3' });
    assertEqual(engine.epSquare, null, 'epSquare must expire after 1 halfmove');
  });

  it('CRITICAL: blocks en passant when rank-clearing exposes King to horizontal check', () => {
    // Rank 4: Black King on a4, Black pawn on e4, White pawn on f4, White rook on h4
    // FEN: 8/8/8/8/k3pP1R/8/8/4K3 b - f3 0 1
    const engine = new ChessEngine('8/8/8/8/k3pP1R/8/8/4K3 b - f3 0 1');
    const legalMoves = engine.getLegalMoves('e4');
    const epMoves = legalMoves.filter(m => m.to === 'f3');
    assertEqual(epMoves.length, 0, 'e4xf3 must be ILLEGAL because removing both pawns exposes King on a4 to Rook on h4');

    const moveRes = engine.makeMove({ from: 'e4', to: 'f3' });
    assertEqual(moveRes, null, 'makeMove for illegal en passant pin must return null');
  });
});

// ==========================================
// SUITE 6: Castling Mechanics & Rights Revocation
// ==========================================
describe('Suite 6: Castling Mechanics & Rights Revocation', () => {
  it('executes Kingside and Queenside castling for White', () => {
    const engine = new ChessEngine('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    // O-O
    const m1 = engine.makeMove({ from: 'e1', to: 'g1' });
    assert(m1 !== null && m1.flags.isKingsideCastle, 'O-O should succeed');
    assertEqual(m1.san, 'O-O', 'SAN should be O-O');
    assertEqual(engine.getPiece('g1').type, 'k', 'King on g1');
    assertEqual(engine.getPiece('f1').type, 'r', 'Rook on f1');
    assertEqual(engine.getPiece('h1'), null, 'h1 empty');

    // Undo and try O-O-O
    engine.undoMove();
    assertEqual(engine.getPiece('e1').type, 'k', 'King restored to e1');
    assertEqual(engine.getPiece('h1').type, 'r', 'Rook restored to h1');

    const m2 = engine.makeMove({ from: 'e1', to: 'c1' });
    assert(m2 !== null && m2.flags.isQueensideCastle, 'O-O-O should succeed');
    assertEqual(m2.san, 'O-O-O', 'SAN should be O-O-O');
    assertEqual(engine.getPiece('c1').type, 'k', 'King on c1');
    assertEqual(engine.getPiece('d1').type, 'r', 'Rook on d1');
    assertEqual(engine.getPiece('a1'), null, 'a1 empty');
  });

  it('prevents castling while King is in check', () => {
    // Black king on b8 (safe), Black rook on e8 checks White king on e1
    const engine = new ChessEngine('1k2r3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    assert(engine.isCheck('w'), 'White King is in check');
    const moves = engine.getLegalMoves('e1');
    const castles = moves.filter(m => m.flags.isKingsideCastle || m.flags.isQueensideCastle);
    assertEqual(castles.length, 0, 'Cannot castle while in check');
  });

  it('prevents castling when transit square is attacked', () => {
    // Black king on c8 (safe), Black rook on f8 attacks f1 transit square
    const engine = new ChessEngine('2k2r2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    const moves = engine.getLegalMoves('e1');
    const kingside = moves.find(m => m.flags.isKingsideCastle);
    assertEqual(kingside, undefined, 'Cannot castle kingside through attacked f1');
    const queenside = moves.find(m => m.flags.isQueensideCastle);
    assert(queenside !== undefined, 'Queenside castling remains legal');
  });

  it('permits Queenside castling even if b1 is attacked (b1 is not King transit)', () => {
    // Black bishop on a2 attacks b1
    const engine = new ChessEngine('r3k2r/8/8/8/8/8/b7/R3K2R w KQkq - 0 1');
    const moves = engine.getLegalMoves('e1');
    const queenside = moves.find(m => m.flags.isQueensideCastle);
    assert(queenside !== undefined, 'Queenside castling is legal when b1 attacked because King only transits d1 and c1');
  });

  it('revokes castling rights when King moves', () => {
    const engine = new ChessEngine('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    engine.makeMove({ from: 'e1', to: 'e2' });
    assertEqual(engine.castling.K, false, 'White loses K right on king move');
    assertEqual(engine.castling.Q, false, 'White loses Q right on king move');
    assertEqual(engine.castling.k, true, 'Black retains k right');
  });

  it('revokes castling rights when Rook is captured on its home square', () => {
    // Black captures White rook on a1
    const engine = new ChessEngine('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    engine.makeMove({ from: 'a8', to: 'a1' });
    assertEqual(engine.castling.Q, false, 'White loses Q right when rook on a1 is captured');
    assertEqual(engine.castling.K, true, 'White retains K right');
    assertEqual(engine.castling.q, false, 'Black loses q right when rook moves from a8');
  });
});

// ==========================================
// SUITE 7: Check, Checkmate & Stalemate Detection
// ==========================================
describe('Suite 7: Check, Checkmate & Stalemate Detection', () => {
  it("detects Scholar's Mate checkmate correctly", () => {
    // 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    const engine = new ChessEngine();
    engine.makeMove({ from: 'e2', to: 'e4' });
    engine.makeMove({ from: 'e7', to: 'e5' });
    engine.makeMove({ from: 'f1', to: 'c4' });
    engine.makeMove({ from: 'b8', to: 'c6' });
    engine.makeMove({ from: 'd1', to: 'h5' });
    engine.makeMove({ from: 'g8', to: 'f6' });
    const mateMove = engine.makeMove({ from: 'h5', to: 'f7' });

    assert(engine.isCheck(), 'Black must be in check');
    assert(engine.isCheckmate(), 'Black must be in checkmate');
    assertEqual(mateMove.flags.isCheckmate, true, 'flags.isCheckmate must be true');
    assertEqual(mateMove.san, 'Qxf7#', 'SAN must be Qxf7#');
    assertEqual(engine.getLegalMoves().length, 0, 'No legal moves in checkmate');
  });

  it('detects Stalemate correctly', () => {
    // FEN with Black King on a8, White Queen on c7, White King on a6
    const engine = new ChessEngine('k7/2Q5/K7/8/8/8/8/8 b - - 0 1');
    assert(!engine.isCheck(), 'Black King is NOT in check');
    assert(engine.isStalemate(), 'Game must be in stalemate');
    assert(engine.isDraw(), 'Stalemate is a draw');
    assertEqual(engine.getLegalMoves().length, 0, 'No legal moves in stalemate');
  });
});

// ==========================================
// SUITE 8: FIDE Draw Rules
// ==========================================
describe('Suite 8: FIDE Draw Rules', () => {
  it('detects draw by 50-move rule (100 plies)', () => {
    // Rooks present to prevent insufficient material draw
    const engine = new ChessEngine('r3k3/8/8/8/8/8/8/R3K3 w - - 99 50');
    assert(!engine.isDraw(), 'At 99 halfmoves, not yet draw');
    // Non-pawn non-capture move
    engine.makeMove({ from: 'e1', to: 'e2' });
    assertEqual(engine.halfmoveClock, 100, 'Halfmove clock reaches 100');
    assert(engine.is50MoveRule(), '50-move rule satisfied');
    assert(engine.isDraw(), 'isDraw() must be true at 100 halfmoves');
  });

  it('detects draw by threefold repetition', () => {
    const engine = new ChessEngine();
    // 1. Nf3 Nf6 2. Ng1 Ng8 (Position 2) 3. Nf3 Nf6 4. Ng1 Ng8 (Position 3)
    engine.makeMove({ from: 'g1', to: 'f3' });
    engine.makeMove({ from: 'g8', to: 'f6' });
    engine.makeMove({ from: 'f3', to: 'g1' });
    engine.makeMove({ from: 'f6', to: 'g8' });
    assert(!engine.isThreefoldRepetition(), 'Not yet 3 repetitions');

    engine.makeMove({ from: 'g1', to: 'f3' });
    engine.makeMove({ from: 'g8', to: 'f6' });
    engine.makeMove({ from: 'f3', to: 'g1' });
    const finalMove = engine.makeMove({ from: 'f6', to: 'g8' });

    assert(engine.isThreefoldRepetition(), 'Threefold repetition reached');
    assert(engine.isDraw(), 'isDraw() must be true on threefold repetition');
    assertEqual(finalMove.flags.isDraw, true, 'MoveResult flags.isDraw must be true');
  });

  it('detects insufficient material: K vs K, KB vs K, KN vs K', () => {
    const k_k = new ChessEngine('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    assert(k_k.isInsufficientMaterial(), 'K vs K is insufficient material');

    const kb_k = new ChessEngine('4k3/8/8/8/8/8/5B2/4K3 w - - 0 1');
    assert(kb_k.isInsufficientMaterial(), 'KB vs K is insufficient material');

    const kn_k = new ChessEngine('4k3/8/8/8/8/8/5N2/4K3 w - - 0 1');
    assert(kn_k.isInsufficientMaterial(), 'KN vs K is insufficient material');
  });

  it('distinguishes same-color vs opposite-color bishops in KB vs KB', () => {
    // White Bc1: r=0, f=2 -> (0+2)%2 = 0 (dark square)
    // Black Be3: r=2, f=4 -> (2+4)%2 = 0 (dark square)
    const sameColor = new ChessEngine('7k/8/8/8/8/4b3/8/2B1K3 w - - 0 1');
    assert(sameColor.isInsufficientMaterial(), 'KB vs KB with same-colored bishops is dead position');

    // Opposite color: White Bc1 (dark square), Black Be4: r=3, f=4 -> (3+4)%2 = 1 (light square)
    const oppColor = new ChessEngine('7k/8/8/8/4b3/8/8/2B1K3 w - - 0 1');
    assert(!oppColor.isInsufficientMaterial(), 'KB vs KB with opposite-colored bishops is NOT dead position (helpmate possible)');
  });
});

// ==========================================
// SUITE 9: SAN Move Notation & Disambiguation
// ==========================================
describe('Suite 9: SAN Move Notation & Disambiguation', () => {
  it('disambiguates knights by file (Nbd7)', () => {
    // White knights on b1 and f3, d2 is empty (PPP1PPPP on rank 2)
    const engine = new ChessEngine('rnbqkb1r/pppppppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1');
    const move = engine.makeMove({ from: 'b1', to: 'd2' });
    assert(move !== null, 'Move b1-d2 must be legal');
    assertEqual(move.san, 'Nbd2', 'SAN must disambiguate by file: Nbd2');
  });

  it('disambiguates knights by rank (N1d7)', () => {
    // White knights on d2 and d6, Black king safely on h8 (not in check)
    // Both knights can jump to e4
    const engine = new ChessEngine('7k/8/3N4/8/8/8/3N4/4K3 w - - 0 1');
    const move = engine.makeMove({ from: 'd2', to: 'e4' });
    assert(move !== null, 'Move d2-e4 must be legal');
    assertEqual(move.san, 'N2e4', 'SAN must disambiguate by rank: N2e4');
  });

  it('disambiguates multiple queens by full square (Qh4e1)', () => {
    // Black King on b8 (safe), White King on c2 (safe)
    // Three White Queens on h4, h1, and a1 all attacking empty square e1:
    // h4 to e1: diagonal (r=3, f=7 to r=0, f=4) dr=-3, df=-3
    // h1 to e1: orthogonal (r=0, f=7 to r=0, f=4) df=-3
    // a1 to e1: orthogonal (r=0, f=0 to r=0, f=4) df=+4
    // For Qh4 moving to e1: Qh1 shares file h, Qa1 shares rank 1!
    // Therefore neither file nor rank is unique -> full square disambiguation Qh4e1!
    const engine = new ChessEngine('1k6/8/8/8/7Q/8/2K5/Q6Q w - - 0 1');
    const move = engine.makeMove({ from: 'h4', to: 'e1' });
    assert(move !== null, 'Move h4-e1 must be legal');
    assertEqual(move.san, 'Qh4e1', 'SAN must disambiguate by full square: Qh4e1');
  });
});

// ==========================================
// SUITE 10: State Reversibility (makeMove & undoMove)
// ==========================================
describe('Suite 10: State Reversibility (makeMove & undoMove)', () => {
  it('undoes move sequence restoring 100% bit-for-bit FEN and state', () => {
    const engine = new ChessEngine();
    const initialFen = engine.getFEN();

    // Play 6 halfmoves
    const m1 = engine.makeMove({ from: 'e2', to: 'e4' });
    const m2 = engine.makeMove({ from: 'e7', to: 'e5' });
    const m3 = engine.makeMove({ from: 'g1', to: 'f3' });
    const m4 = engine.makeMove({ from: 'b8', to: 'c6' });
    const m5 = engine.makeMove({ from: 'f1', to: 'b5' });
    const m6 = engine.makeMove({ from: 'a7', to: 'a6' });

    assertEqual(engine.getHistory().length, 6, 'History should contain 6 moves');

    // Undo all 6 moves
    assertEqual(engine.undoMove().san, m6.san);
    assertEqual(engine.undoMove().san, m5.san);
    assertEqual(engine.undoMove().san, m4.san);
    assertEqual(engine.undoMove().san, m3.san);
    assertEqual(engine.undoMove().san, m2.san);
    assertEqual(engine.undoMove().san, m1.san);

    assertEqual(engine.undoMove(), null, 'Undo on empty history returns null');
    assertEqual(engine.getFEN(), initialFen, 'Engine FEN after full undo must exactly equal initial FEN');
    assertEqual(engine.getHistory().length, 0, 'History should be empty');
  });
});

// ==========================================
// SUITE 11: Perft Benchmarks
// ==========================================
describe('Suite 11: Perft Benchmarks', () => {
  it('Position 1 (Startpos): Depth 1 = 20', () => {
    const engine = new ChessEngine();
    const t0 = Date.now();
    const nodes = engine.perft(1);
    const ms = Date.now() - t0;
    assertEqual(nodes, 20, `Startpos Depth 1 must be 20 nodes (${ms}ms)`);
  });

  it('Position 1 (Startpos): Depth 2 = 400', () => {
    const engine = new ChessEngine();
    const t0 = Date.now();
    const nodes = engine.perft(2);
    const ms = Date.now() - t0;
    assertEqual(nodes, 400, `Startpos Depth 2 must be 400 nodes (${ms}ms)`);
  });

  it('Position 1 (Startpos): Depth 3 = 8,902', () => {
    const engine = new ChessEngine();
    const t0 = Date.now();
    const nodes = engine.perft(3);
    const ms = Date.now() - t0;
    assertEqual(nodes, 8902, `Startpos Depth 3 must be 8902 nodes (${ms}ms)`);
  });

  it('Position 1 (Startpos): Depth 4 = 197,281', () => {
    const engine = new ChessEngine();
    const t0 = Date.now();
    const nodes = engine.perft(4);
    const ms = Date.now() - t0;
    assertEqual(nodes, 197281, `Startpos Depth 4 must be 197281 nodes (${ms}ms)`);
  });

  it('Position 2 (Kiwipete): Depth 1 = 48', () => {
    const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    const engine = new ChessEngine(kiwipete);
    const nodes = engine.perft(1);
    assertEqual(nodes, 48, 'Kiwipete Depth 1 must be 48 nodes');
  });

  it('Position 2 (Kiwipete): Depth 2 = 2,039', () => {
    const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    const engine = new ChessEngine(kiwipete);
    const nodes = engine.perft(2);
    assertEqual(nodes, 2039, 'Kiwipete Depth 2 must be 2039 nodes');
  });

  it('Position 2 (Kiwipete): Depth 3 = 97,862', () => {
    const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    const engine = new ChessEngine(kiwipete);
    const t0 = Date.now();
    const nodes = engine.perft(3);
    const ms = Date.now() - t0;
    assertEqual(nodes, 97862, `Kiwipete Depth 3 must be 97862 nodes (${ms}ms)`);
  });
});

// ==========================================
// SUITE 12: Interface Contract Compliance (PROJECT.md lines 72-111)
// ==========================================
describe('Suite 12: Interface Contract Compliance (PROJECT.md lines 72-111)', () => {
  it('exposes all mandatory ChessEngine methods per PROJECT.md interface', () => {
    const engine = new ChessEngine();
    const requiredMethods = [
      'loadFEN',
      'getFEN',
      'getPiece',
      'getLegalMoves',
      'makeMove',
      'undoMove',
      'isCheck',
      'isCheckmate',
      'isStalemate',
      'isDraw',
      'getHistory',
      'reset'
    ];
    for (const method of requiredMethods) {
      assertEqual(typeof engine[method], 'function', `Method ${method} must exist on ChessEngine`);
    }
  });

  it('verifies MoveResult schema and exact 9 boolean flags from makeMove', () => {
    const engine = new ChessEngine();
    const move = engine.makeMove({ from: 'e2', to: 'e4' });
    assert(move !== null, 'Valid move should produce MoveResult');

    assertEqual(typeof move.from, 'string', 'move.from must be string');
    assertEqual(typeof move.to, 'string', 'move.to must be string');
    assertEqual(typeof move.piece, 'string', 'move.piece must be string');
    assert(move.color === 'w' || move.color === 'b', 'move.color must be "w" or "b"');
    assertEqual(typeof move.san, 'string', 'move.san must be string');
    assertEqual(typeof move.lan, 'string', 'move.lan must be string');

    // Verify exact flags
    const flagKeys = [
      'isCapture',
      'isEnPassant',
      'isKingsideCastle',
      'isQueensideCastle',
      'isPromotion',
      'isCheck',
      'isCheckmate',
      'isStalemate',
      'isDraw'
    ];
    for (const flag of flagKeys) {
      assertEqual(typeof move.flags[flag], 'boolean', `move.flags.${flag} must be boolean`);
    }
  });

  it('verifies getPiece returns null or { type, color: "w" | "b" }', () => {
    const engine = new ChessEngine();
    const whitePawn = engine.getPiece('e2');
    assert(whitePawn !== null, 'e2 must have piece');
    assertEqual(whitePawn.type, 'p', 'Piece type must be "p"');
    assertEqual(whitePawn.color, 'w', 'Piece color must be "w"');

    const empty = engine.getPiece('e4');
    assertEqual(empty, null, 'e4 is empty at startpos');

    const invalid = engine.getPiece('z9');
    assertEqual(invalid, null, 'Invalid coordinate returns null');
  });

  it('verifies loadFEN non-destructive error contract { valid, error }', () => {
    const engine = new ChessEngine();
    const initialFen = engine.getFEN();
    const res = engine.loadFEN('invalid fen token sequence');
    assertEqual(res.valid, false, 'Invalid FEN returns valid: false');
    assertEqual(typeof res.error, 'string', 'Invalid FEN returns error string');
    assertEqual(engine.getFEN(), initialFen, 'Engine state remains untouched on invalid FEN');
  });

  it('verifies reset restores engine state cleanly', () => {
    const engine = new ChessEngine();
    engine.makeMove({ from: 'e2', to: 'e4' });
    engine.makeMove({ from: 'e7', to: 'e5' });
    assert(engine.getHistory().length === 2, 'History has 2 moves');

    engine.reset();
    assertEqual(engine.getHistory().length, 0, 'History reset to 0');
    assertEqual(engine.getFEN(), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'FEN reset to startpos');
  });
});

// ==========================================
// Test Runner Summary
// ==========================================
console.log('\n==========================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`\x1b[32mPASSED: ${passedTests}\x1b[0m`);
if (failedTests > 0) {
  console.log(`\x1b[31mFAILED: ${failedTests}\x1b[0m`);
  process.exit(1);
} else {
  console.log('\x1b[32mALL UNIT TESTS PASSED SUCCESSFULLY! (100%)\x1b[0m');
  process.exit(0);
}
