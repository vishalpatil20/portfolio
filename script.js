// ==========================================================================
// Vishal B Patil — Portfolio & Interactive Chess Coordinator
// Modules:
// 1. Theme Management (Dark & Light Mode)
// 2. Mobile Navigation & Smooth Scroll
// 3. Email Copying & Contact Form
// 4. Procedural Audio Synthesizer Integration
// 5. Standalone Chess Rules Engine, AI & Puzzles
// 6. UI Synchronization & Keyboard Shortcuts
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. THEME MANAGEMENT (DARK & LIGHT)
  // --------------------------------------------------------------------------
  const themeToggleBtn = document.getElementById('theme-toggle');

  function initTheme() {
    const savedTheme = localStorage.getItem('theme_preference');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme_preference', nextTheme);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  initTheme();

  // --------------------------------------------------------------------------
  // 2. MOBILE NAVIGATION & ACTIVE SCROLL TRACKING
  // --------------------------------------------------------------------------
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.classList.toggle('open', isOpen);
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Active section indicator on scroll
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset + 120;
    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { passive: true });

  // --------------------------------------------------------------------------
  // 3. EMAIL COPY & CONTACT FORM HANDLING
  // --------------------------------------------------------------------------
  const copyEmailBtn = document.getElementById('btn-copy-email');
  const copyBtnLabel = document.getElementById('copy-btn-label');
  const toastRegion = document.getElementById('toast-region');
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  function showToast(message) {
    if (!toastRegion) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastRegion.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
      setTimeout(() => toast.remove(), 320);
    }, 3200);
  }

  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', () => {
      const email = 'vishal.b.patil.dev@gmail.com';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(() => {
          if (copyBtnLabel) copyBtnLabel.textContent = 'Copied to Clipboard!';
          showToast('Email address copied to clipboard');
          setTimeout(() => {
            if (copyBtnLabel) copyBtnLabel.textContent = 'Copy Email Address';
          }, 2400);
        }).catch(() => fallbackCopy(email));
      } else {
        fallbackCopy(email);
      }
    });
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      if (copyBtnLabel) copyBtnLabel.textContent = 'Copied to Clipboard!';
      showToast('Email address copied to clipboard');
      setTimeout(() => {
        if (copyBtnLabel) copyBtnLabel.textContent = 'Copy Email Address';
      }, 2400);
    } catch (_) {}
    area.remove();
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (document.getElementById('form-name')?.value || '').trim();
      const email = (document.getElementById('form-email')?.value || '').trim();
      const topic = (document.getElementById('inquiry-type')?.value || 'general');
      const message = (document.getElementById('form-message')?.value || '').trim();

      if (!name || !email || !message) {
        if (formStatus) {
          formStatus.textContent = 'Please complete all required fields.';
          formStatus.className = 'form-status-msg err';
        }
        return;
      }

      const subject = encodeURIComponent(`[Portfolio Contact - ${topic.toUpperCase()}] from ${name}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}`);
      window.location.href = `mailto:vishal.b.patil.dev@gmail.com?subject=${subject}&body=${body}`;

      if (formStatus) {
        formStatus.textContent = '✓ Opening your email client... Thank you!';
        formStatus.className = 'form-status-msg ok';
      }
      contactForm.reset();
      if (window.chessAudio) window.chessAudio.playVictory();
    });
  }

  // --------------------------------------------------------------------------
  // 4. PROCEDURAL WEB AUDIO SYNTHESIZER
  // --------------------------------------------------------------------------
  if (window.ChessAudioEngine && !window.chessAudio) {
    window.chessAudio = new window.ChessAudioEngine();
    window.chessAudio.init();
  }
  const audio = window.chessAudio;

  const audioMuteBtn = document.getElementById('audio-mute-btn');
  const iconAudioOn = document.querySelector('.icon-audio-on');
  const iconAudioOff = document.querySelector('.icon-audio-off');

  function updateAudioButtonUI(isMuted) {
    if (!audioMuteBtn) return;
    audioMuteBtn.classList.toggle('muted', isMuted);
    audioMuteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    if (iconAudioOn) iconAudioOn.classList.toggle('hidden', isMuted);
    if (iconAudioOff) iconAudioOff.classList.toggle('hidden', !isMuted);
  }

  if (audioMuteBtn && audio) {
    updateAudioButtonUI(audio.isMuted());
    audioMuteBtn.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      updateAudioButtonUI(isMuted);
    });
  }

  // --------------------------------------------------------------------------
  // 5. CHESS ARENA STATE, ENGINE & MINIMAX AI
  // --------------------------------------------------------------------------
  const DOM = {
    chessBoard: document.getElementById('chess-board'),
    boardOverlay: document.getElementById('board-overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayText: document.getElementById('overlay-text'),
    overlayRestartBtn: document.getElementById('overlay-restart-btn'),

    modeBtnAi: document.getElementById('mode-btn-ai'),
    modeBtnPuzzles: document.getElementById('mode-btn-puzzles'),
    aiLevelsGroup: document.getElementById('ai-levels-group'),
    puzzleSelectGroup: document.getElementById('puzzle-select-group'),
    diffPills: document.querySelectorAll('.level-pill'),
    puzzleSelect: document.getElementById('puzzle-select'),

    flipBoardBtn: document.getElementById('flip-board-btn'),
    hintBtn: document.getElementById('hint-game-btn'),
    undoBtn: document.getElementById('undo-game-btn'),
    resetBtn: document.getElementById('reset-game-btn'),

    statusBadge: document.getElementById('game-status-badge'),
    statusPulse: document.querySelector('.status-pulse-light'),
    statusText: document.getElementById('status-text'),
    commentaryText: document.getElementById('commentary-text'),

    capturedBlack: document.getElementById('captured-black'),
    capturedWhite: document.getElementById('captured-white'),
    materialDiffBlack: document.getElementById('material-diff-black'),
    materialDiffWhite: document.getElementById('material-diff-white'),
    playerNameTop: document.getElementById('player-name-top'),
    playerNameBottom: document.getElementById('player-name-bottom'),

    sanHistoryStrip: document.getElementById('san-history-strip'),
    historyMoveCount: document.getElementById('history-move-count'),

    promotionModal: document.getElementById('promotion-modal'),
    promotionChoices: document.getElementById('promotion-choices')
  };

  // Minimax Piece Valuation & Piece-Square Tables (PST)
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

    // Move ordering (captures evaluated first)
    moves.sort((a, b) => ((b.captured ? 1 : 0) - (a.captured ? 1 : 0)));

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

  function computeAiMove(level) {
    if (!STATE.engine) return null;
    const moves = STATE.engine.getLegalMoves();
    if (moves.length === 0) return null;

    if (level === 'easy') {
      // 40% random move, 60% depth-1
      if (Math.random() < 0.4) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      return minimax(STATE.engine, 1, -Infinity, Infinity, false).move || moves[0];
    } else if (level === 'medium') {
      return minimax(STATE.engine, 2, -Infinity, Infinity, false).move || moves[0];
    } else {
      // Master: Depth 3 with alpha-beta pruning & PST
      return minimax(STATE.engine, 3, -Infinity, Infinity, false).move || moves[0];
    }
  }

  // Tactical Puzzles Setup
  const PUZZLES = {
    scholars: {
      name: "Scholar's Mate Combination",
      userColor: "w",
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3",
      solution: [
        { from: "d1", to: "h5", text: "Queen strikes out to h5, setting up the lethal mate threat on f7!" },
        { from: "h5", to: "f7", text: "CHECKMATE! 2. Qxf7# Scholar's Mate supported by the c4 Bishop!" }
      ],
      hint: "Target the vulnerable f7 square with your Queen."
    },
    opera: {
      name: "Morphy's Opera House Attack",
      userColor: "w",
      fen: "4kb1r/p2r1p1p/2p1qn2/1B4B1/8/1Q6/P1P2PPP/2KR4 w k - 0 15",
      solution: [
        { from: "b5", to: "d7", text: "1. Bxd7+! Bishop sacrifice eliminates the pinned defender on d7!" },
        { from: "b3", to: "b8", text: "2. Qb8+!! Legendary Queen Sacrifice deflects the Knight!" },
        { from: "d1", to: "d8", text: "3. Rd8# CHECKMATE! Down the open d-file with Paul Morphy's precision!" }
      ],
      hint: "Eliminate the pinned defender on d7 first."
    },
    backrank: {
      name: "Back-Rank Decapitation",
      userColor: "w",
      fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
      solution: [
        { from: "e2", to: "e8", text: "CHECKMATE! 1. Qe8# The Black King is trapped behind its own shield of pawns!" }
      ],
      hint: "Black's back rank is unprotected. Infiltrate with the Queen."
    }
  };

  // Controller State
  const STATE = {
    engine: null,
    mode: 'ai', // 'ai' | 'puzzles'
    difficulty: 'easy', // 'easy' | 'medium' | 'master'
    puzzleKey: 'scholars',
    puzzleStepIndex: 0,
    isFlipped: false,
    selectedSquare: null,
    validMoves: [],
    pendingPromotionMove: null,
    isAiThinking: false
  };

  // Coordinate Systems
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

  function getDisplayRanks() {
    return STATE.isFlipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
  }

  function getDisplayFiles() {
    return STATE.isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  }

  function findKingSquare(color) {
    if (!STATE.engine) return null;
    const board = STATE.engine.getBoard();
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && p.type === 'k' && p.color === color) {
        if (typeof window.ChessEngine.indexToSquare === 'function') {
          return window.ChessEngine.indexToSquare(i);
        }
        return FILES[i & 7] + String((i >> 3) + 1);
      }
    }
    return null;
  }

  function renderBoard() {
    if (!DOM.chessBoard || !STATE.engine) return;
    DOM.chessBoard.innerHTML = '';

    const displayRanks = getDisplayRanks();
    const displayFiles = getDisplayFiles();
    const history = STATE.engine.getHistory ? STATE.engine.getHistory() : [];
    const lastMove = history.length > 0 ? history[history.length - 1] : null;

    let inCheckSquare = null;
    if (STATE.engine.isCheck()) {
      inCheckSquare = findKingSquare(STATE.engine.getTurn());
    }

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const rank = displayRanks[r];
        const file = displayFiles[f];
        const sq = file + rank;

        const fileIdx = FILES.indexOf(file);
        const rankIdx = parseInt(rank, 10);
        const isLight = (fileIdx + rankIdx) % 2 !== 0;

        const squareEl = document.createElement('div');
        squareEl.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        squareEl.setAttribute('data-square', sq);

        if (sq === STATE.selectedSquare) squareEl.classList.add('selected');
        if (sq === inCheckSquare) squareEl.classList.add('in-check');
        if (lastMove) {
          if (sq === lastMove.from) squareEl.classList.add('last-move-src');
          if (sq === lastMove.to) squareEl.classList.add('last-move-dst');
        }

        // Rank / File Coordinates
        if (f === 0) {
          const rankLbl = document.createElement('span');
          rankLbl.className = 'coord-label rank';
          rankLbl.textContent = rank;
          squareEl.appendChild(rankLbl);
        }
        if (r === 7) {
          const fileLbl = document.createElement('span');
          fileLbl.className = 'coord-label file';
          fileLbl.textContent = file;
          squareEl.appendChild(fileLbl);
        }

        // Piece
        const piece = STATE.engine.getPiece(sq);
        if (piece) {
          const pieceEl = document.createElement('div');
          const isUserTurn = !STATE.isAiThinking && piece.color === STATE.engine.getTurn();
          pieceEl.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'} ${isUserTurn ? 'own' : ''}`;
          pieceEl.setAttribute('data-square', sq);

          const colorChar = piece.color === 'w' ? 'l' : 'd';
          const img = document.createElement('img');
          img.src = `pieces/Chess_${piece.type}${colorChar}t45.svg`;
          img.alt = `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`;
          img.draggable = false;
          pieceEl.appendChild(img);

          squareEl.appendChild(pieceEl);
        }

        // Legal Target Indicators
        const targetMove = STATE.validMoves.find(m => m.to === sq);
        if (targetMove) {
          const isCapture = !!piece;
          const dot = document.createElement('div');
          dot.className = isCapture ? 'move-dot-capture' : 'move-dot';
          squareEl.appendChild(dot);
        }

        // Square Click Interaction
        squareEl.addEventListener('click', (e) => handleSquareClick(sq, piece, e));

        DOM.chessBoard.appendChild(squareEl);
      }
    }
  }

  function handleSquareClick(sq, piece) {
    if (!STATE.engine || STATE.isAiThinking || STATE.engine.isGameOver()) return;

    // Destination clicked for a valid move
    if (STATE.selectedSquare && STATE.validMoves.some(m => m.to === sq)) {
      const fromSq = STATE.selectedSquare;
      const movePiece = STATE.engine.getPiece(fromSq);

      // Pawn promotion check
      if (movePiece && movePiece.type === 'p' && (sq.endsWith('8') || sq.endsWith('1'))) {
        STATE.pendingPromotionMove = { from: fromSq, to: sq };
        openPromotionModal(movePiece.color);
        return;
      }

      executeMove({ from: fromSq, to: sq });
      return;
    }

    // Select friendly piece
    const turn = STATE.engine.getTurn();
    if (piece && piece.color === turn) {
      STATE.selectedSquare = sq;
      STATE.validMoves = STATE.engine.getLegalMoves(sq);
      renderBoard();
      return;
    }

    // Clicked empty or enemy square without selecting friendly piece
    if (STATE.selectedSquare && sq !== STATE.selectedSquare) {
      flashErrorSquare(STATE.selectedSquare);
      STATE.selectedSquare = null;
      STATE.validMoves = [];
      renderBoard();
    }
  }

  function executeMove(moveObj) {
    const res = STATE.engine.makeMove(moveObj);
    if (!res) return;

    STATE.selectedSquare = null;
    STATE.validMoves = [];

    // Audio SFX
    if (audio) {
      if (STATE.engine.isCheckmate()) audio.playVictory();
      else if (STATE.engine.isCheck()) audio.playCheck();
      else if (res.captured || (res.flags && res.flags.isCapture)) audio.playCapture();
      else audio.playMove();
    }

    renderBoard();
    updateUIState();

    // Puzzle mode step check
    if (STATE.mode === 'puzzles') {
      handlePuzzleStep(moveObj);
      return;
    }

    // Trigger AI move if in Vs AI mode
    if (STATE.mode === 'ai' && !STATE.engine.isGameOver() && STATE.engine.getTurn() === 'b') {
      STATE.isAiThinking = true;
      updateUIState();
      setCommentary('AI is calculating move...');

      if (STATE.aiTimeoutId) clearTimeout(STATE.aiTimeoutId);
      STATE.aiTimeoutId = setTimeout(() => {
        STATE.aiTimeoutId = null;
        const aiMove = computeAiMove(STATE.difficulty);
        if (aiMove) {
          const aiRes = STATE.engine.makeMove(aiMove);
          if (audio) {
            if (STATE.engine.isCheckmate()) audio.playDefeat();
            else if (STATE.engine.isCheck()) audio.playCheck();
            else if (aiRes.captured) audio.playCapture();
            else audio.playMove();
          }
          setCommentary(`AI played ${aiRes.san}. Your turn.`);
        }
        STATE.isAiThinking = false;
        renderBoard();
        updateUIState();
      }, 450);
    }
  }

  function handlePuzzleStep(moveObj) {
    const pData = PUZZLES[STATE.puzzleKey];
    if (!pData) return;

    const expectedMove = pData.solution[STATE.puzzleStepIndex];
    if (expectedMove && moveObj.from === expectedMove.from && moveObj.to === expectedMove.to) {
      STATE.puzzleStepIndex++;
      setCommentary(`✓ ${expectedMove.text}`);

      if (STATE.puzzleStepIndex >= pData.solution.length) {
        setCommentary(`🎉 PUZZLE SOLVED! Excellent tactical play!`);
        if (audio) audio.playVictory();
      }
    } else {
      setCommentary('❌ Incorrect tactical move. Resetting position...');
      flashErrorSquare(moveObj.to);
      setTimeout(() => {
        loadPuzzle(STATE.puzzleKey);
      }, 1200);
    }
  }

  function flashErrorSquare(sq) {
    if (!sq) return;
    if (audio) audio.playIllegal();
    const sqEl = DOM.chessBoard.querySelector(`[data-square="${sq}"]`);
    if (sqEl) {
      sqEl.classList.add('error-flash');
      setTimeout(() => sqEl.classList.remove('error-flash'), 360);
    }
  }

  function openPromotionModal(color) {
    if (!DOM.promotionModal) return;
    const colorChar = color === 'w' ? 'l' : 'd';
    ['q', 'r', 'b', 'n'].forEach(type => {
      const img = DOM.promotionChoices.querySelector(`[data-promo-piece="${type}"]`);
      if (img) img.src = `pieces/Chess_${type}${colorChar}t45.svg`;
    });
    DOM.promotionModal.classList.remove('hidden');
  }

  function closePromotionModal() {
    if (DOM.promotionModal) DOM.promotionModal.classList.add('hidden');
    STATE.pendingPromotionMove = null;
  }

  if (DOM.promotionChoices) {
    DOM.promotionChoices.querySelectorAll('.promo-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const promoType = btn.getAttribute('data-promotion');
        const move = STATE.pendingPromotionMove;
        closePromotionModal();
        if (move) {
          executeMove({ ...move, promotion: promoType });
        }
      });
    });
  }

  function setCommentary(text) {
    if (!DOM.commentaryText) return;
    DOM.commentaryText.textContent = text;
  }

  function updateUIState() {
    if (!STATE.engine) return;

    const turn = STATE.engine.getTurn();
    const isGameOver = STATE.engine.isGameOver();

    // Status indicator
    if (DOM.statusPulse) {
      DOM.statusPulse.className = 'status-pulse-light';
      if (STATE.isAiThinking) DOM.statusPulse.classList.add('thinking');
      else if (STATE.engine.isCheck()) DOM.statusPulse.classList.add('check');
      else if (isGameOver) DOM.statusPulse.classList.add('over');
    }

    if (DOM.statusText) {
      if (STATE.engine.isCheckmate()) {
        const winner = turn === 'w' ? 'Black' : 'White';
        DOM.statusText.textContent = `Checkmate! ${winner} Wins!`;
      } else if (STATE.engine.isStalemate() || STATE.engine.isDraw()) {
        DOM.statusText.textContent = 'Draw / Stalemate!';
      } else if (STATE.isAiThinking) {
        DOM.statusText.textContent = 'AI is calculating...';
      } else if (STATE.engine.isCheck()) {
        DOM.statusText.textContent = `CHECK! ${turn === 'w' ? 'White' : 'Black'} to move`;
      } else {
        DOM.statusText.textContent = `${turn === 'w' ? 'White' : 'Black'} to move`;
      }
    }

    // Game Over Overlay
    if (DOM.boardOverlay) {
      if (isGameOver) {
        DOM.boardOverlay.classList.remove('hidden');
        if (DOM.overlayTitle) {
          DOM.overlayTitle.textContent = STATE.engine.isCheckmate() ? 'Checkmate' : 'Game Drawn';
        }
        if (DOM.overlayText) {
          DOM.overlayText.textContent = STATE.engine.isCheckmate()
            ? `${turn === 'w' ? 'Black' : 'White'} has achieved victory!`
            : 'Match concluded with a draw.';
        }
      } else {
        DOM.boardOverlay.classList.add('hidden');
      }
    }

    // Undo & Hint Buttons State
    const history = STATE.engine.getHistory ? STATE.engine.getHistory() : [];
    if (DOM.undoBtn) {
      DOM.undoBtn.disabled = history.length === 0;
    }
    if (DOM.hintBtn) {
      DOM.hintBtn.disabled = isGameOver || STATE.isAiThinking;
    }

    // Move History SAN Strip
    if (DOM.sanHistoryStrip) {
      DOM.sanHistoryStrip.innerHTML = '';
      if (history.length === 0) {
        DOM.sanHistoryStrip.innerHTML = '<span class="history-empty">No moves recorded yet.</span>';
      } else {
        history.forEach((m, idx) => {
          const pill = document.createElement('span');
          pill.className = `history-pill ${idx === history.length - 1 ? 'latest' : ''}`;
          const moveNum = Math.floor(idx / 2) + 1;
          const isWhite = idx % 2 === 0;
          pill.textContent = isWhite ? `${moveNum}. ${m.san}` : m.san;
          DOM.sanHistoryStrip.appendChild(pill);
        });
        DOM.sanHistoryStrip.scrollLeft = DOM.sanHistoryStrip.scrollWidth;
      }
    }
    if (DOM.historyMoveCount) {
      DOM.historyMoveCount.textContent = `${history.length} MOVES`;
    }

    // Captured Pieces & Material Differential
    updateCapturedTrays(history);
  }

  function updateCapturedTrays(history) {
    const capturedWhite = [];
    const capturedBlack = [];

    history.forEach(m => {
      if (m.captured) {
        if (m.color === 'w') capturedBlack.push(m.captured);
        else capturedWhite.push(m.captured);
      }
    });

    renderPieceList(DOM.capturedBlack, capturedBlack, 'd');
    renderPieceList(DOM.capturedWhite, capturedWhite, 'l');

    let whiteScore = 0;
    let blackScore = 0;
    capturedBlack.forEach(p => { whiteScore += PIECE_VALUES[p] || 0; });
    capturedWhite.forEach(p => { blackScore += PIECE_VALUES[p] || 0; });

    const diff = (whiteScore - blackScore) / 100;
    if (DOM.materialDiffBlack) DOM.materialDiffBlack.textContent = diff < 0 ? `+${Math.abs(diff)}` : '';
    if (DOM.materialDiffWhite) DOM.materialDiffWhite.textContent = diff > 0 ? `+${diff}` : '';
  }

  function renderPieceList(container, pieces, colorChar) {
    if (!container) return;
    container.innerHTML = '';
    pieces.sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
    pieces.forEach(type => {
      const img = document.createElement('img');
      img.className = 'captured-icon';
      img.src = `pieces/Chess_${type}${colorChar}t45.svg`;
      img.alt = `${colorChar === 'l' ? 'White' : 'Black'} ${type}`;
      container.appendChild(img);
    });
  }

  function startNewGame() {
    STATE.selectedSquare = null;
    STATE.validMoves = [];
    closePromotionModal();

    if (!window.ChessEngine) {
      console.error('ChessEngine is not loaded');
      return;
    }

    STATE.engine = new window.ChessEngine();

    if (STATE.mode === 'ai') {
      STATE.engine.reset();
      setCommentary(`Vs AI (${STATE.difficulty.toUpperCase()}). Make your opening move!`);
      if (DOM.playerNameTop) DOM.playerNameTop.textContent = 'AI Opponent';
      if (DOM.playerNameBottom) DOM.playerNameBottom.textContent = 'You (White)';
    } else {
      loadPuzzle(STATE.puzzleKey);
      return;
    }

    renderBoard();
    updateUIState();
  }

  function loadPuzzle(key) {
    const pData = PUZZLES[key] || PUZZLES.scholars;
    STATE.puzzleKey = key;
    STATE.puzzleStepIndex = 0;

    STATE.engine = new window.ChessEngine();
    STATE.engine.loadFEN(pData.fen);

    setCommentary(`Tactic: ${pData.name}. Find the winning sequence!`);
    if (DOM.playerNameTop) DOM.playerNameTop.textContent = 'Opponent';
    if (DOM.playerNameBottom) DOM.playerNameBottom.textContent = 'You (White)';

    renderBoard();
    updateUIState();
  }

  // --------------------------------------------------------------------------
  // 6. CHESS CONTROLS & KEYBOARD SHORTCUTS
  // --------------------------------------------------------------------------
  // Game Mode Switcher
  if (DOM.modeBtnAi) {
    DOM.modeBtnAi.addEventListener('click', () => {
      if (STATE.mode === 'ai') return;
      STATE.mode = 'ai';
      DOM.modeBtnAi.classList.add('active');
      DOM.modeBtnAi.setAttribute('aria-checked', 'true');
      DOM.modeBtnPuzzles.classList.remove('active');
      DOM.modeBtnPuzzles.setAttribute('aria-checked', 'false');

      if (DOM.aiLevelsGroup) DOM.aiLevelsGroup.classList.remove('hidden');
      if (DOM.puzzleSelectGroup) DOM.puzzleSelectGroup.classList.add('hidden');
      startNewGame();
    });
  }

  if (DOM.modeBtnPuzzles) {
    DOM.modeBtnPuzzles.addEventListener('click', () => {
      if (STATE.mode === 'puzzles') return;
      STATE.mode = 'puzzles';
      DOM.modeBtnPuzzles.classList.add('active');
      DOM.modeBtnPuzzles.setAttribute('aria-checked', 'true');
      DOM.modeBtnAi.classList.remove('active');
      DOM.modeBtnAi.setAttribute('aria-checked', 'false');

      if (DOM.aiLevelsGroup) DOM.aiLevelsGroup.classList.add('hidden');
      if (DOM.puzzleSelectGroup) DOM.puzzleSelectGroup.classList.remove('hidden');
      startNewGame();
    });
  }

  // Difficulty Pills
  DOM.diffPills.forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.diffPills.forEach(p => {
        const act = p === pill;
        p.classList.toggle('active', act);
        p.setAttribute('aria-checked', act ? 'true' : 'false');
      });
      STATE.difficulty = pill.getAttribute('data-level') || 'easy';
      setCommentary(`AI difficulty set to ${STATE.difficulty.toUpperCase()}.`);
    });
  });

  // Puzzle Dropdown
  if (DOM.puzzleSelect) {
    DOM.puzzleSelect.addEventListener('change', (e) => {
      loadPuzzle(e.target.value);
    });
  }

  // Flip Board
  if (DOM.flipBoardBtn) {
    DOM.flipBoardBtn.addEventListener('click', () => {
      STATE.isFlipped = !STATE.isFlipped;
      renderBoard();
      updateUIState();
    });
  }

  // Undo Move
  if (DOM.undoBtn) {
    DOM.undoBtn.addEventListener('click', () => {
      if (!STATE.engine) return;
      if (STATE.aiTimeoutId) {
        clearTimeout(STATE.aiTimeoutId);
        STATE.aiTimeoutId = null;
      }
      STATE.isAiThinking = false;
      STATE.selectedSquare = null;
      STATE.validMoves = [];
      STATE.engine.undoMove();
      if (STATE.mode === 'ai' && STATE.engine.getTurn() !== 'w') {
        STATE.engine.undoMove(); // Undo AI move as well if AI had moved
      }

      renderBoard();
      updateUIState();
      if (audio) audio.playMove();
      setCommentary('Move undone.');
    });
  }

  // Reset Game
  if (DOM.resetBtn) {
    DOM.resetBtn.addEventListener('click', startNewGame);
  }
  if (DOM.overlayRestartBtn) {
    DOM.overlayRestartBtn.addEventListener('click', startNewGame);
  }

  // Hint
  if (DOM.hintBtn) {
    DOM.hintBtn.addEventListener('click', () => {
      if (!STATE.engine || STATE.isAiThinking) return;

      if (STATE.mode === 'puzzles') {
        const pData = PUZZLES[STATE.puzzleKey];
        if (pData) {
          const expected = pData.solution[STATE.puzzleStepIndex];
          if (expected) {
            setCommentary(`💡 Hint: ${pData.hint} (Look at square ${expected.from.toUpperCase()})`);
            return;
          }
        }
      }

      // In AI mode, calculate best move via Minimax
      const best = minimax(STATE.engine, 2, -Infinity, Infinity, STATE.engine.getTurn() === 'w').move;
      if (best) {
        setCommentary(`💡 Hint: Try moving piece from ${best.from.toUpperCase()} to ${best.to.toUpperCase()}`);
      }
    });
  }

  // =========================================================================
  // 7. CURSOR SPOTLIGHT (LINEAR / SUPABASE) & CMD+K PALETTE (RAYCAST)
  // =========================================================================
  const cmdkModal = document.getElementById('cmdk-modal');
  const cmdkTrigger = document.getElementById('cmdk-trigger');
  const cmdkInput = document.getElementById('cmdk-input');
  const cmdkList = document.getElementById('cmdk-list');

  function openCmdk() {
    if (!cmdkModal || !cmdkInput) return;
    cmdkModal.classList.remove('hidden');
    cmdkInput.value = '';
    filterCmdkItems('');
    cmdkInput.focus();
  }

  function closeCmdk() {
    if (!cmdkModal) return;
    cmdkModal.classList.add('hidden');
  }

  function filterCmdkItems(query) {
    if (!cmdkList) return;
    const q = query.trim().toLowerCase();
    const items = Array.from(cmdkList.querySelectorAll('.cmdk-item'));
    let firstVisible = null;
    items.forEach((item) => {
      const match = item.textContent.toLowerCase().includes(q);
      item.classList.toggle('hidden', !match);
      item.classList.remove('active');
      if (match && !firstVisible) firstVisible = item;
    });
    if (firstVisible) firstVisible.classList.add('active');
  }

  function executeCmdkAction(cmd) {
    closeCmdk();
    if (!cmd) return;
    if (cmd.startsWith('jump:')) {
      const target = document.querySelector(cmd.slice(5));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    } else if (cmd === 'chess:puzzles') {
      const chessSec = document.getElementById('chess');
      if (chessSec) chessSec.scrollIntoView({ behavior: 'smooth' });
      if (DOM.modeBtnPuzzles) DOM.modeBtnPuzzles.click();
    } else if (cmd === 'action:theme') {
      const themeBtn = document.getElementById('theme-toggle');
      if (themeBtn) themeBtn.click();
    } else if (cmd === 'action:copy-email') {
      const copyBtn = document.getElementById('btn-copy-email');
      if (copyBtn) copyBtn.click();
    }
  }

  if (cmdkTrigger) cmdkTrigger.addEventListener('click', openCmdk);

  if (cmdkModal) {
    cmdkModal.addEventListener('click', (e) => {
      if (e.target === cmdkModal) closeCmdk();
    });
  }

  if (cmdkInput && cmdkList) {
    cmdkInput.addEventListener('input', (e) => filterCmdkItems(e.target.value));
    cmdkInput.addEventListener('keydown', (e) => {
      const visible = Array.from(cmdkList.querySelectorAll('.cmdk-item:not(.hidden)'));
      if (!visible.length) return;
      const idx = visible.findIndex((el) => el.classList.contains('active'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx >= 0) visible[idx].classList.remove('active');
        visible[(idx + 1) % visible.length].classList.add('active');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx >= 0) visible[idx].classList.remove('active');
        visible[(idx - 1 + visible.length) % visible.length].classList.add('active');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = visible[idx >= 0 ? idx : 0];
        if (active) executeCmdkAction(active.getAttribute('data-cmd'));
      }
    });

    cmdkList.addEventListener('click', (e) => {
      const btn = e.target.closest('.cmdk-item');
      if (btn) executeCmdkAction(btn.getAttribute('data-cmd'));
    });
  }

  // Cursor Spotlight Tracker (disabled on touch / reduced-motion)
  const canHoverSpotlight =
    typeof window.matchMedia === 'function'
      ? !window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  if (canHoverSpotlight) {
    let rafPending = false;
    let lastX = 0;
    let lastY = 0;
    document.addEventListener('pointermove', (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const cards = document.querySelectorAll('.card, .metric-card');
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (lastX >= rect.left - 80 && lastX <= rect.right + 80 && lastY >= rect.top - 80 && lastY <= rect.bottom + 80) {
            card.style.setProperty('--mx', `${lastX - rect.left}px`);
            card.style.setProperty('--my', `${lastY - rect.top}px`);
          }
        });
      });
    }, { passive: true });
  }

  // Keyboard Shortcuts (Cmd+K / Ctrl+K + Chess Arena F/U/R/M)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (cmdkModal && !cmdkModal.classList.contains('hidden')) closeCmdk();
      else openCmdk();
      return;
    }

    if (e.key === 'Escape' && cmdkModal && !cmdkModal.classList.contains('hidden')) {
      closeCmdk();
      return;
    }

    if (cmdkModal && !cmdkModal.classList.contains('hidden')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;

    const key = e.key.toUpperCase();
    if (key === 'F' && DOM.flipBoardBtn) DOM.flipBoardBtn.click();
    else if (key === 'U' && DOM.undoBtn && !DOM.undoBtn.disabled) DOM.undoBtn.click();
    else if (key === 'R' && DOM.resetBtn) DOM.resetBtn.click();
    else if (key === 'M' && audioMuteBtn) audioMuteBtn.click();
  });

  // Start initial game
  startNewGame();
});
