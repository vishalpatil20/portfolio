// Interactive Split-Screen Chess Portfolio Engine

document.addEventListener('DOMContentLoaded', () => {

  // Puzzle Positions Data
  const PUZZLES = {
    easy: {
      name: "Easy",
      description: "Scholar's Mate Combination",
      userColor: "white",
      setup: [
        // White pieces
        { sq: "e1", type: "k", color: "white" },
        { sq: "d1", type: "q", color: "white" },
        { sq: "c4", type: "b", color: "white" },
        { sq: "a2", type: "p", color: "white" },
        { sq: "b2", type: "p", color: "white" },
        { sq: "c2", type: "p", color: "white" },
        { sq: "d2", type: "p", color: "white" },
        { sq: "e4", type: "p", color: "white" },
        { sq: "f2", type: "p", color: "white" },
        { sq: "g2", type: "p", color: "white" },
        { sq: "h2", type: "p", color: "white" },
        // Black pieces
        { sq: "e8", type: "k", color: "black" },
        { sq: "c6", type: "n", color: "black" },
        { sq: "e5", type: "p", color: "black" },
        { sq: "a7", type: "p", color: "black" },
        { sq: "b7", type: "p", color: "black" },
        { sq: "c7", type: "p", color: "black" },
        { sq: "d7", type: "p", color: "black" },
        { sq: "f7", type: "p", color: "black" },
        { sq: "g7", type: "p", color: "black" },
        { sq: "h7", type: "p", color: "black" }
      ],
      moves: [
        {
          userMove: { from: "d1", to: "h5" },
          aiResponse: { from: "a7", to: "a6" },
          text: "Queen moves to h5, threatening the weak f7 pawn.",
          stepUnlock: 2
        },
        {
          userMove: { from: "h5", to: "f7" },
          aiResponse: null, // Checkmate!
          text: "CHECKMATE! The Queen is supported by the Bishop on c4.",
          stepUnlock: 4
        }
      ]
    },
    medium: {
      name: "Medium",
      description: "Philidor's Legacy (Smothered Mate)",
      userColor: "white",
      setup: [
        // White pieces
        { sq: "h1", type: "k", color: "white" },
        { sq: "c4", type: "q", color: "white" },
        { sq: "g5", type: "n", color: "white" },
        { sq: "f2", type: "p", color: "white" },
        { sq: "g2", type: "p", color: "white" },
        { sq: "h2", type: "p", color: "white" },
        // Black pieces
        { sq: "h8", type: "k", color: "black" },
        { sq: "f8", type: "r", color: "black" },
        { sq: "g7", type: "p", color: "black" },
        { sq: "h7", type: "p", color: "black" }
      ],
      moves: [
        {
          userMove: { from: "g5", to: "f7" },
          aiResponse: { from: "h8", to: "g8" },
          text: "Double check forcing the King into the corner.",
          stepUnlock: 2
        },
        {
          userMove: { from: "c4", to: "g8" },
          aiResponse: { from: "f8", to: "g8" },
          text: "Brilliant Queen sacrifice on g8! Rook is forced to capture.",
          stepUnlock: 3
        },
        {
          userMove: { from: "f7", to: "h6" },
          aiResponse: null, // Checkmate!
          text: "Smothered Checkmate! The King is trapped by its own Rook.",
          stepUnlock: 4
        }
      ]
    },
    goated: {
      name: "Goated",
      description: "Paul Morphy's Opera House 4-Move Masterpiece",
      userColor: "white",
      setup: [
        // White pieces
        { sq: "c1", type: "k", color: "white" },
        { sq: "b3", type: "q", color: "white" },
        { sq: "b5", type: "b", color: "white" },
        { sq: "g5", type: "b", color: "white" },
        { sq: "d1", type: "r", color: "white" },
        { sq: "h1", type: "r", color: "white" },
        { sq: "a2", type: "p", color: "white" },
        { sq: "b2", type: "p", color: "white" },
        { sq: "c2", type: "p", color: "white" },
        { sq: "f2", type: "p", color: "white" },
        { sq: "g2", type: "p", color: "white" },
        { sq: "h2", type: "p", color: "white" },
        // Black pieces
        { sq: "e8", type: "k", color: "black" },
        { sq: "e6", type: "q", color: "black" },
        { sq: "d7", type: "n", color: "black" },
        { sq: "f6", type: "n", color: "black" },
        { sq: "d8", type: "r", color: "black" },
        { sq: "a7", type: "p", color: "black" },
        { sq: "b7", type: "p", color: "black" },
        { sq: "c6", type: "p", color: "black" },
        { sq: "f7", type: "p", color: "black" },
        { sq: "g7", type: "p", color: "black" },
        { sq: "h7", type: "p", color: "black" }
      ],
      moves: [
        {
          userMove: { from: "b5", to: "d7" },
          aiResponse: { from: "d8", to: "d7" },
          text: "BISHOP SACRIFICE! Capturing on d7 and forcing Black's Rook to take back.",
          stepUnlock: 1
        },
        {
          userMove: { from: "d1", to: "d7" },
          aiResponse: { from: "f6", to: "d7" },
          text: "ROOK SACRIFICE! Eliminating the d7 defender to clear the open file.",
          stepUnlock: 2
        },
        {
          userMove: { from: "b3", to: "b8" },
          aiResponse: { from: "d7", to: "b8" },
          text: "THE QUEEN SACRIFICE ON b8! Morphy's legendary signature move!",
          stepUnlock: 3
        },
        {
          userMove: { from: "d1", to: "d8" },
          aiResponse: null, // Checkmate!
          text: "CHECKMATE! The remaining Rook delivers the final checkmate blow.",
          stepUnlock: 4
        }
      ]
    }
  };

  // Game Engine State
  let currentLevelKey = null;
  let moveIndex = 0;
  let boardState = {};
  let selectedSquare = null;
  let isDirectAccessMode = false;

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

  // Handle Entry Modal Selection
  if (btnModePlay) {
    btnModePlay.addEventListener('click', () => {
      entryModal.classList.add('hidden');
      isDirectAccessMode = false;
      startLevel('goated');
    });
  }

  if (btnModeDirect) {
    btnModeDirect.addEventListener('click', () => {
      entryModal.classList.add('hidden');
      isDirectAccessMode = true;
      unlockTabsUpTo(4);
      switchTabTo(1);
      startLevel('goated');
      if (boardOverlay) boardOverlay.classList.add('hidden');
    });
  }

  // Initialize Tab clicks
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('locked') || isDirectAccessMode) {
        const stepNum = parseInt(btn.getAttribute('data-step-tab'));
        switchTabTo(stepNum);
      }
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
    activeLevelSpan.textContent = PUZZLES[levelKey].name;
    resetBtn.disabled = false;
    
    // Status text & commentary update
    updateStatusText("Your Turn", "ready");
    if (commentaryText) {
      commentaryText.textContent = `${PUZZLES[levelKey].name}: ${PUZZLES[levelKey].description}. Make your first move!`;
    }

    // Initialize board representation
    boardState = {};
    PUZZLES[levelKey].setup.forEach(p => {
      boardState[p.sq] = { type: p.type, color: p.color };
    });

    // Handle tab locks based on mode
    if (!isDirectAccessMode) {
      tabButtons.forEach(btn => {
        const sTab = parseInt(btn.getAttribute('data-step-tab'));
        if (sTab > 1) {
          btn.classList.add('locked');
          btn.classList.remove('active');
        } else {
          btn.classList.remove('locked');
          if (sTab === 1) btn.classList.add('active');
        }
      });
      switchTabTo(1);
    } else {
      unlockTabsUpTo(4);
    }

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

  // Unlock all tabs up to target step
  function unlockTabsUpTo(stepNum) {
    tabButtons.forEach(btn => {
      const sTab = parseInt(btn.getAttribute('data-step-tab'));
      if (sTab <= stepNum) {
        btn.classList.remove('locked');
      }
    });
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
    contentScroller.scrollTo({ top: 0, behavior: 'smooth' });
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
          const pCode = (piece.color === 'white' ? 'w' : 'b') + piece.type.toUpperCase();
          img.src = `pieces/${pCode}.svg`;
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
      el.classList.remove('selected', 'valid-dest');
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
    document.querySelector(`[data-square="${from}"]`).classList.add('last-move-src');
    document.querySelector(`[data-square="${to}"]`).classList.add('last-move-dst');

    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];
    
    // Update commentary
    if (commentaryText) commentaryText.textContent = currentMove.text;

    // Goated Move 2 Special Exchange: Slide White second Rook to d1
    if (currentLevelKey === 'goated' && moveIndex === 1) {
      boardState['d1'] = { type: 'r', color: 'white' };
      delete boardState['h1'];
    }

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
        
        document.querySelector(`[data-square="${aiFrom}"]`).classList.add('last-move-src');
        document.querySelector(`[data-square="${aiTo}"]`).classList.add('last-move-dst');
        
        if (!isDirectAccessMode) {
          unlockTabsUpTo(currentMove.stepUnlock);
          switchTabTo(currentMove.stepUnlock);
        }
        updateStatusText("Your Turn", "ready");
      }, 1100);
    } else {
      updateStatusText("Checkmate! You win!", "ready");
      if (!isDirectAccessMode) {
        unlockTabsUpTo(currentMove.stepUnlock);
        switchTabTo(currentMove.stepUnlock);
      }
    }
  }

  function flashErrorSquare(sq) {
    const el = document.querySelector(`[data-square="${sq}"]`);
    if (el) {
      el.classList.add('error-flash');
      setTimeout(() => el.classList.remove('error-flash'), 400);
    }
  }

  function updateStatusText(text, statusType) {
    statusText.textContent = text;
    statusDot.className = 'status-pulse-light';
    if (statusType) {
      statusDot.classList.add(statusType);
    }
  }
});
