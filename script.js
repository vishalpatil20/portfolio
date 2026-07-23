// Interactive Split-Screen Chess Portfolio Engine

document.addEventListener('DOMContentLoaded', () => {

  // Puzzle Positions Data loaded from real FEN strings
  const PUZZLES = {
    easy: {
      name: "Go Easy",
      description: "Scholar's Mate Combination",
      userColor: "white",
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3",
      moves: [
        {
          userMove: { from: "d1", to: "h5" },
          aiResponse: { from: "a7", to: "a6" },
          text: "Queen moves to h5, developing with threats on f7."
        },
        {
          userMove: { from: "h5", to: "f7" },
          aiResponse: null, // Checkmate!
          text: "CHECKMATE! The Queen is supported by the Bishop on c4."
        }
      ]
    },
    difficult: {
      name: "Difficult",
      description: "Paul Morphy's Opera House Mating Combination",
      userColor: "white",
      fen: "4kb1r/p2r1p1p/2p1qn2/1B4B1/8/1Q6/P1P2PPP/2KR4 w k - 0 15",
      moves: [
        {
          userMove: { from: "h1", to: "d1" },
          aiResponse: { from: "e7", to: "e6" },
          text: "DEVELOPMENT! White brings the second Rook to the open file; Black defends with Qe6."
        },
        {
          userMove: { from: "b5", to: "d7" },
          aiResponse: { from: "f6", to: "d7" },
          text: "BISHOP SACRIFICE! Capturing on d7 and forcing Black's Knight to recapture."
        },
        {
          userMove: { from: "b3", to: "b8" },
          aiResponse: { from: "d7", to: "b8" },
          text: "THE QUEEN SACRIFICE ON b8!! Morphy's legendary signature move forcing Knight recapture."
        },
        {
          userMove: { from: "d1", to: "d8" },
          aiResponse: null, // Checkmate!
          text: "CHECKMATE! The Rook delivers the final checkmate blow along the open file!"
        }
      ]
    }
  };

  // Game Engine State
  let currentLevelKey = null;
  let moveIndex = 0;
  let boardState = {};
  let selectedSquare = null;

  // DOM Elements
  const chessBoardEl = document.getElementById('chess-board');
  const levelButtons = document.querySelectorAll('.level-pill-horizontal');
  const activeLevelSpan = document.querySelector('#active-level-indicator span');
  const resetBtn = document.getElementById('reset-game-btn');
  const statusText = document.getElementById('status-text');
  const statusBadge = document.getElementById('game-status-badge');
  const statusDot = statusBadge.querySelector('.status-pulse-light');
  const contentSteps = document.querySelectorAll('.content-step');
  const contentScroller = document.getElementById('content-scroller');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const boardOverlay = document.getElementById('board-overlay');

  // Entry Modal DOM
  const entryModal = document.getElementById('entry-modal');
  const btnModePlay = document.getElementById('btn-mode-play');
  const btnModeDirect = document.getElementById('btn-mode-direct');

  // Match Tracker DOM
  const progressVal = document.getElementById('progress-val');
  const progressFill = document.getElementById('progress-fill');
  const commentaryText = document.getElementById('commentary-text');

  // Parse FEN String into boardState representation
  function parseFEN(fenString) {
    const state = {};
    const parts = fenString.trim().split(/\s+/);
    const boardPart = parts[0];
    const ranks = boardPart.split('/');
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let r = 0; r < 8; r++) {
      const rankStr = ranks[r];
      let fIndex = 0;
      for (let i = 0; i < rankStr.length; i++) {
        const char = rankStr[i];
        if (isNaN(char)) {
          const isWhite = char === char.toUpperCase();
          const type = char.toLowerCase();
          const sq = files[fIndex] + (8 - r);
          state[sq] = {
            type: type,
            color: isWhite ? 'white' : 'black'
          };
          fIndex++;
        } else {
          const emptyCount = parseInt(char, 10);
          fIndex += emptyCount;
        }
      }
    }
    return state;
  }

  // Handle Entry Modal Selection
  if (btnModePlay) {
    btnModePlay.addEventListener('click', () => {
      if (entryModal) entryModal.classList.add('hidden');
      startLevel('difficult');
    });
  }

  if (btnModeDirect) {
    btnModeDirect.addEventListener('click', () => {
      if (entryModal) entryModal.classList.add('hidden');
      startLevel('difficult');
    });
  }

  // Initialize Tab clicks - ALL tabs fully unlocked and accessible at any time
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const stepNum = parseInt(btn.getAttribute('data-step-tab'));
      switchTabTo(stepNum);
    });
  });

  // Initialize Level selection
  levelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-level');
      startLevel(level);
    });
  });

  resetBtn.addEventListener('click', () => {
    if (currentLevelKey) startLevel(currentLevelKey);
  });

  // Start a Puzzle Level
  function startLevel(levelKey) {
    currentLevelKey = levelKey;
    moveIndex = 0;
    selectedSquare = null;
    
    // Hide startup overlay
    if (boardOverlay) {
      boardOverlay.classList.add('hidden');
    }
    
    // UI states
    levelButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-level') === levelKey);
    });
    if (activeLevelSpan) activeLevelSpan.textContent = PUZZLES[levelKey].name;
    if (resetBtn) resetBtn.disabled = false;
    
    // Status text & commentary update
    updateStatusText("Your Turn", "ready");
    if (commentaryText) {
      commentaryText.textContent = `${PUZZLES[levelKey].name}: ${PUZZLES[levelKey].description}. Make your first move!`;
    }

    // Initialize board representation from FEN
    boardState = parseFEN(PUZZLES[levelKey].fen);

    updateProgressBar();
    renderBoard();
  }

  // Update Progress Bar
  function updateProgressBar() {
    if (!currentLevelKey || !progressVal || !progressFill) return;
    const total = PUZZLES[currentLevelKey].moves.length;
    const current = moveIndex;
    progressVal.textContent = `${current} / ${total} MOVES`;
    const pct = Math.min(100, Math.round((current / total) * 100));
    progressFill.style.width = `${pct}%`;
  }

  // Switch to an active tab and content step
  function switchTabTo(stepNum) {
    tabButtons.forEach(btn => {
      const sTab = parseInt(btn.getAttribute('data-step-tab'));
      btn.classList.toggle('active', sTab === stepNum);
    });
    showStep(stepNum);
  }

  // Show a specific step in the scrollable panel
  function showStep(stepNum) {
    contentSteps.forEach(step => {
      const sNum = parseInt(step.getAttribute('data-step'));
      if (sNum === stepNum) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });
    if (contentScroller) {
      contentScroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Render Chessboard
  function renderBoard() {
    chessBoardEl.innerHTML = '';
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = files[f] + ranks[r];
        const isLight = (r + f) % 2 === 0;

        const squareEl = document.createElement('div');
        squareEl.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        squareEl.setAttribute('data-square', sq);

        // Coordinates labels
        if (f === 0) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord-label rank';
          rankLabel.textContent = ranks[r];
          squareEl.appendChild(rankLabel);
        }
        if (r === 7) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord-label file';
          fileLabel.textContent = files[f];
          squareEl.appendChild(fileLabel);
        }

        // Render piece if exists
        const piece = boardState[sq];
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `chess-piece ${piece.color}`;
          
          const img = document.createElement('img');
          const colorChar = piece.color === 'white' ? 'l' : 'd';
          const typeChar = piece.type.toLowerCase();
          img.src = `pieces/Chess_${typeChar}${colorChar}t45.svg`;
          img.alt = `${piece.color} ${piece.type}`;
          
          pieceEl.appendChild(img);
          squareEl.appendChild(pieceEl);
        }

        // Square Click Listener
        squareEl.addEventListener('click', () => handleSquareClick(sq));

        chessBoardEl.appendChild(squareEl);
      }
    }
  }

  // Handle Square Click
  function handleSquareClick(sq) {
    if (!currentLevelKey) return;
    
    if (statusDot.classList.contains('thinking') || moveIndex >= PUZZLES[currentLevelKey].moves.length) {
      return;
    }

    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];
    const piece = boardState[sq];

    // Select piece
    if (piece && piece.color === PUZZLES[currentLevelKey].userColor) {
      selectedSquare = sq;
      highlightSquare(sq);
      highlightValidMoves();
      return;
    }

    // Try executing move
    if (selectedSquare) {
      const correctFrom = currentMove.userMove.from;
      const correctTo = currentMove.userMove.to;

      if (selectedSquare === correctFrom && sq === correctTo) {
        executeMove(correctFrom, correctTo);
      } else {
        flashErrorSquare(selectedSquare);
        flashErrorSquare(sq);
        selectedSquare = null;
        renderBoard();
      }
    }
  }

  // Highlight selected square
  function highlightSquare(sq) {
    document.querySelectorAll('.chess-square').forEach(el => {
      el.classList.remove('selected');
    });
    const el = document.querySelector(`[data-square="${sq}"]`);
    if (el) el.classList.add('selected');
  }

  // Highlight valid target destination
  function highlightValidMoves() {
    if (!selectedSquare || !currentLevelKey) return;
    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];
    if (selectedSquare === currentMove.userMove.from) {
      const destSq = currentMove.userMove.to;
      const destSquareEl = document.querySelector(`[data-square="${destSq}"]`);
      if (destSquareEl) {
        const isCapture = !!boardState[destSq];
        const indicator = document.createElement('div');
        indicator.className = isCapture ? 'move-dot-capture' : 'move-dot';
        destSquareEl.appendChild(indicator);
      }
    }
  }

  // Execute legal move
  function executeMove(from, to) {
    boardState[to] = boardState[from];
    delete boardState[from];
    
    selectedSquare = null;
    renderBoard();

    // Highlights
    const srcEl = document.querySelector(`[data-square="${from}"]`);
    const dstEl = document.querySelector(`[data-square="${to}"]`);
    if (srcEl) srcEl.classList.add('last-move-src');
    if (dstEl) dstEl.classList.add('last-move-dst');

    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];
    
    // Update commentary
    if (commentaryText) commentaryText.textContent = currentMove.text;

    moveIndex++;
    updateProgressBar();

    if (currentMove.aiResponse) {
      updateStatusText("AI is thinking...", "thinking");
      
      setTimeout(() => {
        const aiFrom = currentMove.aiResponse.from;
        const aiTo = currentMove.aiResponse.to;
        
        boardState[aiTo] = boardState[aiFrom];
        delete boardState[aiFrom];
        
        renderBoard();
        
        const aiSrcEl = document.querySelector(`[data-square="${aiFrom}"]`);
        const aiDstEl = document.querySelector(`[data-square="${aiTo}"]`);
        if (aiSrcEl) aiSrcEl.classList.add('last-move-src');
        if (aiDstEl) aiDstEl.classList.add('last-move-dst');

        // Auto-advance portfolio step based on progress
        if (currentLevelKey === 'difficult') {
          if (moveIndex === 1) switchTabTo(2);      // Move 1 -> Experience
          else if (moveIndex === 2) switchTabTo(3); // Move 2 -> Projects
          else if (moveIndex === 3) switchTabTo(4); // Move 3 -> Tech Stack
        } else if (currentLevelKey === 'easy') {
          if (moveIndex === 1) switchTabTo(3);      // Move 1 -> Projects
        }

        updateStatusText("Your Turn", "ready");
      }, 1000);
    } else {
      updateStatusText("Checkmate! You win!", "ready");
      // Auto-switch to Contact & Chess.com Challenge tab on Checkmate victory!
      switchTabTo(5);
    }
  }

  function flashErrorSquare(sq) {
    if (!sq) return;
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
      if (statusType) {
        statusDot.classList.add(statusType);
      }
    }
  }
});
