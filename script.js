// Interactive Split-Screen Chess Portfolio Controller

document.addEventListener('DOMContentLoaded', () => {

  // Audio Engine Initialization
  if (window.ChessAudioEngine && !window.chessAudio) {
    window.chessAudio = new window.ChessAudioEngine();
    window.chessAudio.init();
  }

  // DOM Elements
  const chessBoardEl = document.getElementById('chess-board');
  const boardOverlay = document.getElementById('board-overlay');
  const levelButtons = document.querySelectorAll('.level-pill-horizontal');
  const activeLevelSpan = document.querySelector('#active-level-indicator span');
  const resetBtn = document.getElementById('reset-game-btn');
  const undoBtn = document.getElementById('undo-game-btn');
  const hintBtn = document.getElementById('hint-game-btn');
  const statusText = document.getElementById('status-text');
  const statusBadge = document.getElementById('game-status-badge');
  const statusDot = statusBadge ? statusBadge.querySelector('.status-pulse-light') : null;
  
  const contentSteps = document.querySelectorAll('.content-step');
  const contentScroller = document.getElementById('content-scroller');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const modeButtons = document.querySelectorAll('.mode-pill');
  const audioMuteBtn = document.getElementById('audio-mute-btn');

  const entryModal = document.getElementById('entry-modal');
  const btnModePlay = document.getElementById('btn-mode-play');
  const btnModeDirect = document.getElementById('btn-mode-direct');

  const progressVal = document.getElementById('progress-val');
  const progressFill = document.getElementById('progress-fill');
  const commentaryText = document.getElementById('commentary-text');

  const sanHistoryStrip = document.getElementById('san-history-strip');
  const historyMoveCount = document.getElementById('history-move-count');

  const capturedBlackEl = document.getElementById('captured-black');
  const capturedWhiteEl = document.getElementById('captured-white');
  const materialDiffBlack = document.getElementById('material-diff-black');
  const materialDiffWhite = document.getElementById('material-diff-white');

  const promotionModal = document.getElementById('promotion-modal');
  const promotionChoices = document.getElementById('promotion-choices');

  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  // Engine & Controller State
  let engine = null;
  let activeMode = 'ai'; // 'ai' or 'puzzles'
  let activeLevel = 'easy'; // 'easy', 'medium', 'master' or 'difficult'
  let selectedSquare = null;
  let validMovesForSelected = [];
  let pendingMove = null;
  let isAiThinking = false;
  let puzzleIndex = 0;

  const PUZZLES = {
    easy: {
      name: "Easy Puzzle",
      description: "Scholar's Mate Combination",
      userColor: "w",
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3",
      moves: [
        { from: "d1", to: "h5", text: "Queen moves to h5, threatening f7." },
        { from: "h5", to: "f7", text: "CHECKMATE! Scholar's Mate supported by c4 Bishop." }
      ]
    },
    difficult: {
      name: "Difficult Puzzle",
      description: "Morphy's Opera House Mating Attack",
      userColor: "w",
      fen: "4kb1r/p2r1p1p/2p1qn2/1B4B1/8/1Q6/P1P2PPP/2KR4 w k - 0 15",
      moves: [
        { from: "b5", to: "d7", text: "BISHOP SACRIFICE on d7!" },
        { from: "b3", to: "b8", text: "LEGENDARY QUEEN SACRIFICE on b8!" },
        { from: "d1", to: "d8", text: "CHECKMATE! Rook delivers final blow down the open d-file." }
      ]
    }
  };

  // Minimax AI Valuation Tables
  const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  const PST_PAWN = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ];

  const PST_KNIGHT = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ];

  function evaluateBoard(eng) {
    if (eng.isCheckmate()) return eng.getTurn() === 'w' ? -99999 : 99999;
    if (eng.isDraw() || eng.isStalemate()) return 0;

    let totalScore = 0;
    const board = eng.getBoard();

    for (let idx = 0; idx < 64; idx++) {
      const piece = board[idx];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type] || 0;
      let pstVal = 0;
      if (piece.type === 'p') pstVal = piece.color === 'w' ? PST_PAWN[63 - idx] : PST_PAWN[idx];
      else if (piece.type === 'n') pstVal = piece.color === 'w' ? PST_KNIGHT[63 - idx] : PST_KNIGHT[idx];

      const score = val + pstVal;
      totalScore += piece.color === 'w' ? score : -score;
    }
    return totalScore;
  }

  function minimax(eng, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || eng.isGameOver()) {
      return { score: evaluateBoard(eng) };
    }

    const moves = eng.getLegalMoves();
    if (moves.length === 0) return { score: evaluateBoard(eng) };

    // Move ordering (captures first)
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    let bestMove = moves[0];

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        eng.makeMove(move);
        const evalObj = minimax(eng, depth - 1, alpha, beta, false);
        eng.undoMove();
        if (evalObj.score > maxEval) {
          maxEval = evalObj.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, evalObj.score);
        if (beta <= alpha) break;
      }
      return { score: maxEval, move: bestMove };
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        eng.makeMove(move);
        const evalObj = minimax(eng, depth - 1, alpha, beta, true);
        eng.undoMove();
        if (evalObj.score < minEval) {
          minEval = evalObj.score;
          bestMove = move;
        }
        beta = Math.min(beta, evalObj.score);
        if (beta <= alpha) break;
      }
      return { score: minEval, move: bestMove };
    }
  }

  function getAiMove(difficulty) {
    if (!engine) return null;
    const moves = engine.getLegalMoves();
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      if (Math.random() < 0.65) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      return minimax(engine, 1, -Infinity, Infinity, false).move || moves[0];
    } else if (difficulty === 'medium') {
      return minimax(engine, 2, -Infinity, Infinity, false).move || moves[0];
    } else {
      return minimax(engine, 3, -Infinity, Infinity, false).move || moves[0];
    }
  }

  // Handle Entry Modal
  if (btnModePlay) {
    btnModePlay.addEventListener('click', () => {
      if (entryModal) entryModal.classList.add('hidden');
      initGame('ai', 'easy');
    });
  }

  if (btnModeDirect) {
    btnModeDirect.addEventListener('click', () => {
      if (entryModal) entryModal.classList.add('hidden');
      initGame('ai', 'easy');
    });
  }

  // Portfolio Tab Buttons
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const stepNum = parseInt(btn.getAttribute('data-step-tab'), 10);
      switchTabTo(stepNum);
    });
  });

  // Mode Pill Buttons
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      modeButtons.forEach(b => {
        const isAct = b === btn;
        b.classList.toggle('active', isAct);
        b.setAttribute('aria-checked', isAct);
      });
      activeMode = mode;
      initGame(mode, activeLevel);
    });
  });

  // Level Pill Buttons
  levelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-level');
      levelButtons.forEach(b => {
        const isAct = b === btn;
        b.classList.toggle('active', isAct);
        b.setAttribute('aria-checked', isAct);
      });
      activeLevel = level;
      initGame(activeMode, level);
    });
  });

  // Reset Button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      initGame(activeMode, activeLevel);
    });
  }

  // Undo Button
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (!engine || isAiThinking) return;
      engine.undoMove();
      if (activeMode === 'ai') engine.undoMove(); // Undo AI move as well
      selectedSquare = null;
      renderBoard();
      updateUIState();
      if (window.chessAudio) window.chessAudio.playMove();
    });
  }

  // Hint Button
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (!engine || isAiThinking) return;
      const best = minimax(engine, 2, -Infinity, Infinity, engine.getTurn() === 'w').move;
      if (best && commentaryText) {
        commentaryText.textContent = `💡 Hint: Try moving piece at ${best.from.toUpperCase()} to ${best.to.toUpperCase()}`;
        highlightSquare(best.from);
      }
    });
  }

  // Audio Toggle Button
  if (audioMuteBtn) {
    audioMuteBtn.addEventListener('click', () => {
      audioMuteBtn.classList.toggle('muted');
      const isMuted = audioMuteBtn.classList.contains('muted');
      audioMuteBtn.setAttribute('aria-pressed', isMuted);
      audioMuteBtn.title = isMuted ? 'Unmute Sound' : 'Mute Sound';
      const onIcon = audioMuteBtn.querySelector('.icon-audio-on');
      const offIcon = audioMuteBtn.querySelector('.icon-audio-off');
      if (onIcon) onIcon.classList.toggle('hidden', isMuted);
      if (offIcon) offIcon.classList.toggle('hidden', !isMuted);
      if (window.chessAudio) window.chessAudio.toggleMute();
    });
  }

  // Pawn Promotion Buttons
  if (promotionChoices) {
    promotionChoices.querySelectorAll('.promo-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const promoType = btn.getAttribute('data-promotion');
        if (promotionModal) promotionModal.classList.add('hidden');
        if (pendingMove) {
          executeEngineMove({ ...pendingMove, promotion: promoType });
          pendingMove = null;
        }
      });
    });
  }

  // Keyboard Navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toUpperCase();
    if (['1', '2', '3', '4', '5'].includes(key)) {
      switchTabTo(parseInt(key, 10));
    } else if (key === 'R') {
      initGame(activeMode, activeLevel);
    } else if (key === 'U' && undoBtn && !undoBtn.disabled) {
      undoBtn.click();
    } else if (key === 'M' && audioMuteBtn) {
      audioMuteBtn.click();
    }
  });

  // Contact Form Submission
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameVal = document.getElementById('form-name')?.value.trim();
      const emailVal = document.getElementById('form-email')?.value.trim();
      const msgVal = document.getElementById('form-message')?.value.trim();

      if (!nameVal || !emailVal || !msgVal) {
        if (formStatus) {
          formStatus.textContent = '❌ Please complete all required fields.';
          formStatus.style.color = '#c94a4a';
        }
        return;
      }

      if (formStatus) {
        formStatus.textContent = '✓ Message sent successfully! Thank you for reaching out.';
        formStatus.style.color = '#6c584c';
      }
      contactForm.reset();
      if (window.chessAudio) window.chessAudio.playVictory();
    });
  }

  // Initialize Game Session
  function initGame(mode, level) {
    activeMode = mode;
    activeLevel = level;
    selectedSquare = null;
    validMovesForSelected = [];
    isAiThinking = false;
    puzzleIndex = 0;

    if (boardOverlay) boardOverlay.classList.add('hidden');
    if (resetBtn) resetBtn.disabled = false;
    if (activeLevelSpan) activeLevelSpan.textContent = level.toUpperCase();

    if (!window.ChessEngine) {
      console.error("ChessEngine not loaded");
      return;
    }

    engine = new window.ChessEngine();

    if (mode === 'puzzles') {
      const pData = PUZZLES[level] || PUZZLES.easy;
      engine.loadFEN(pData.fen);
      if (commentaryText) commentaryText.textContent = `${pData.name}: ${pData.description}`;
    } else {
      engine.reset(); // Standard starting position
      if (commentaryText) commentaryText.textContent = `VS AI (${level.toUpperCase()}): Make your opening move!`;
    }

    updateUIState();
    renderBoard();
  }

  // Switch Active Portfolio Tab
  function switchTabTo(stepNum) {
    tabButtons.forEach(btn => {
      const sTab = parseInt(btn.getAttribute('data-step-tab'), 10);
      btn.classList.toggle('active', sTab === stepNum);
    });

    contentSteps.forEach(step => {
      const sNum = parseInt(step.getAttribute('data-step'), 10);
      step.classList.toggle('active', sNum === stepNum);
    });

    if (contentScroller) {
      contentScroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Render Chessboard 8x8 Grid
  function renderBoard() {
    chessBoardEl.innerHTML = '';
    if (!engine) return;

    const board = engine.getBoard(); // 64 element array
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    const inCheckSq = engine.isCheck() ? findKingSquare(engine.getTurn()) : null;
    const history = engine.getHistory ? engine.getHistory() : [];
    const lastMove = history.length > 0 ? history[history.length - 1] : null;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sqIndex = r * 8 + f;
        const sq = files[f] + ranks[r];
        const isLight = (r + f) % 2 === 0;

        const squareEl = document.createElement('div');
        squareEl.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        squareEl.setAttribute('data-square', sq);

        if (sq === selectedSquare) squareEl.classList.add('selected');
        if (sq === inCheckSq) squareEl.classList.add('in-check');
        if (lastMove) {
          if (sq === lastMove.from) squareEl.classList.add('last-move-src');
          if (sq === lastMove.to) squareEl.classList.add('last-move-dst');
        }

        // Coordinates
        if (f === 0) {
          const rL = document.createElement('span');
          rL.className = 'coord-label rank';
          rL.textContent = ranks[r];
          squareEl.appendChild(rL);
        }
        if (r === 7) {
          const fL = document.createElement('span');
          fL.className = 'coord-label file';
          fL.textContent = files[f];
          squareEl.appendChild(fL);
        }

        // Render Piece SVG
        const piece = engine.getPiece(sq);
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;

          const img = document.createElement('img');
          const colorChar = piece.color === 'w' ? 'l' : 'd';
          img.src = `pieces/Chess_${piece.type}${colorChar}t45.svg`;
          img.alt = `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`;
          pieceEl.appendChild(img);
          squareEl.appendChild(pieceEl);
        }

        // Target dots / capture rings
        const isTarget = validMovesForSelected.some(m => m.to === sq);
        if (isTarget) {
          const isCap = !!piece;
          const dot = document.createElement('div');
          dot.className = isCap ? 'move-dot-capture' : 'move-dot';
          squareEl.appendChild(dot);
        }

        // Click Handler
        squareEl.addEventListener('click', () => handleSquareClick(sq));

        chessBoardEl.appendChild(squareEl);
      }
    }
  }

  function findKingSquare(color) {
    if (!engine) return null;
    const board = engine.getBoard();
    for (let i = 0; i < 64; i++) {
      if (board[i] && board[i].type === 'k' && board[i].color === color) {
        if (window.ChessEngine && window.ChessEngine.indexToSquare) {
          return window.ChessEngine.indexToSquare(i);
        }
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        return files[i & 7] + ranks[i >> 3];
      }
    }
    return null;
  }

  // Handle Board Square Click
  function handleSquareClick(sq) {
    if (!engine || isAiThinking) return;
    if (engine.isGameOver()) return;

    const piece = engine.getPiece(sq);
    const turn = engine.getTurn();

    // Select piece owned by current turn
    if (piece && piece.color === turn) {
      selectedSquare = sq;
      validMovesForSelected = engine.generateLegalMoves({ from: sq });
      renderBoard();
      return;
    }

    // Attempt to move to destination square
    if (selectedSquare) {
      const targetMove = validMovesForSelected.find(m => m.to === sq);
      if (targetMove) {
        // Pawn promotion check
        if (targetMove.piece === 'p' && (sq.endsWith('8') || sq.endsWith('1'))) {
          pendingMove = targetMove;
          if (promotionModal) promotionModal.classList.remove('hidden');
          return;
        }

        executeEngineMove(targetMove);
      } else {
        flashErrorSquare(selectedSquare);
        selectedSquare = null;
        validMovesForSelected = [];
        renderBoard();
      }
    }
  }

  // Execute move in engine
  function executeEngineMove(moveObj) {
    const res = engine.makeMove(moveObj);
    selectedSquare = null;
    validMovesForSelected = [];

    // Audio SFX
    if (window.chessAudio) {
      if (engine.isCheckmate()) window.chessAudio.playVictory();
      else if (engine.isCheck()) window.chessAudio.playCheck();
      else if (res.captured) window.chessAudio.playCapture();
      else window.chessAudio.playMove();
    }

    renderBoard();
    updateUIState();

    // Tactical puzzle auto-advance logic
    if (activeMode === 'puzzles') {
      puzzleIndex++;
      const pData = PUZZLES[activeLevel] || PUZZLES.easy;
      if (puzzleIndex === 1) switchTabTo(2);      // Experience
      else if (puzzleIndex === 2) switchTabTo(3); // Projects
      else if (engine.isCheckmate()) switchTabTo(5); // Contact
    }

    // AI Turn Trigger in VS AI Mode
    if (activeMode === 'ai' && !engine.isGameOver() && engine.getTurn() === 'b') {
      isAiThinking = true;
      updateStatusText("AI is thinking...", "thinking");

      setTimeout(() => {
        const aiMove = getAiMove(activeLevel);
        if (aiMove) {
          const aiRes = engine.makeMove(aiMove);
          if (window.chessAudio) {
            if (engine.isCheckmate()) window.chessAudio.playDefeat();
            else if (engine.isCheck()) window.chessAudio.playCheck();
            else if (aiRes.captured) window.chessAudio.playCapture();
            else window.chessAudio.playMove();
          }
        }
        isAiThinking = false;
        renderBoard();
        updateUIState();
      }, 500);
    }
  }

  function flashErrorSquare(sq) {
    if (!sq) return;
    if (window.chessAudio) window.chessAudio.playIllegal();
    const el = document.querySelector(`[data-square="${sq}"]`);
    if (el) {
      el.classList.add('error-flash');
      setTimeout(() => el.classList.remove('error-flash'), 400);
    }
  }

  function updateStatusText(text, statusType) {
    if (statusText) statusText.textContent = text;
    if (statusDot) {
      statusDot.className = 'status-pulse-light';
      if (statusType) statusDot.classList.add(statusType);
    }
  }

  // Sync state with UI panels (Move History, Material Trays, Status Text, Progress)
  function updateUIState() {
    if (!engine) return;

    // Turn / Status
    if (engine.isCheckmate()) {
      const winner = engine.getTurn() === 'w' ? 'Black' : 'White';
      updateStatusText(`Checkmate! ${winner} Wins!`, 'ready');
    } else if (engine.isStalemate() || engine.isDraw()) {
      updateStatusText('Draw / Stalemate!', 'ready');
    } else if (engine.isCheck()) {
      updateStatusText('CHECK!', 'thinking');
    } else if (!isAiThinking) {
      const turnStr = engine.getTurn() === 'w' ? 'White to move' : 'Black to move';
      updateStatusText(turnStr, 'ready');
    }

    // Undo / Hint button state
    const history = engine.getHistory();
    if (undoBtn) undoBtn.disabled = history.length === 0 || isAiThinking;
    if (hintBtn) hintBtn.disabled = engine.isGameOver() || isAiThinking;

    // SAN History Strip
    if (sanHistoryStrip) {
      sanHistoryStrip.innerHTML = '';
      if (history.length === 0) {
        sanHistoryStrip.innerHTML = '<span class="history-placeholder">No moves recorded</span>';
      } else {
        history.forEach((m, idx) => {
          const moveSpan = document.createElement('span');
          moveSpan.className = 'history-move-pill';
          const moveNum = Math.floor(idx / 2) + 1;
          const isWhite = idx % 2 === 0;
          moveSpan.textContent = isWhite ? `${moveNum}. ${m.san}` : m.san;
          sanHistoryStrip.appendChild(moveSpan);
        });
        sanHistoryStrip.scrollLeft = sanHistoryStrip.scrollWidth;
      }
    }
    if (historyMoveCount) historyMoveCount.textContent = `${history.length} MOVES`;

    // Match Progress Tracker
    if (progressVal && progressFill) {
      const moveCount = history.length;
      progressVal.textContent = `${moveCount} MOVES`;
      const pct = Math.min(100, Math.round((moveCount / 40) * 100));
      progressFill.style.width = `${pct}%`;
    }

    // Material Tally & Captured Trays
    const capturedWhite = []; // Captured white pieces (captured by Black)
    const capturedBlack = []; // Captured black pieces (captured by White)

    history.forEach(m => {
      if (m.captured) {
        if (m.color === 'w') {
          // White move captured a black piece
          capturedBlack.push(m.captured);
        } else {
          // Black move captured a white piece
          capturedWhite.push(m.captured);
        }
      }
    });

    renderCapturedTray(capturedBlackEl, capturedBlack, 'b');
    renderCapturedTray(capturedWhiteEl, capturedWhite, 'w');

    // Material Balance
    let whiteScore = 0;
    let blackScore = 0;

    capturedBlack.forEach(p => { whiteScore += PIECE_VALUES[p] || 0; });
    capturedWhite.forEach(p => { blackScore += PIECE_VALUES[p] || 0; });

    const diff = (whiteScore - blackScore) / 100;
    if (materialDiffBlack) {
      materialDiffBlack.textContent = diff > 0 ? `+${diff}` : '';
    }
    if (materialDiffWhite) {
      materialDiffWhite.textContent = diff < 0 ? `+${Math.abs(diff)}` : '';
    }
  }

  function renderCapturedTray(containerEl, pieceList, color) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const colorChar = color === 'w' ? 'l' : 'd';
    pieceList.forEach(type => {
      const img = document.createElement('img');
      img.className = 'captured-piece-icon';
      img.src = `pieces/Chess_${type}${colorChar}t45.svg`;
      img.alt = `${color === 'w' ? 'White' : 'Black'} ${type}`;
      containerEl.appendChild(img);
    });
  }

  // Initial Game Load
  initGame('ai', 'easy');
});
