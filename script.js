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
          text: "You develop the Queen to h5, eyeing the weak f7 pawn.",
          stepUnlock: 1
        },
        {
          userMove: { from: "h5", to: "f7" },
          aiResponse: null, // Checkmate!
          text: "Checkmate! The Queen is supported by the Bishop on c4.",
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
          text: "Double check forcing the King back.",
          stepUnlock: 1
        },
        {
          userMove: { from: "f7", to: "h6" },
          aiResponse: { from: "g8", to: "h8" },
          text: "Brilliant double check! The King is cornered once again.",
          stepUnlock: 2
        },
        {
          userMove: { from: "c4", to: "g8" },
          aiResponse: { from: "f8", to: "g8" },
          text: "Incredible Queen sacrifice! The rook is forced to capture.",
          stepUnlock: 3
        },
        {
          userMove: { from: "h6", to: "f7" },
          aiResponse: null, // Checkmate!
          text: "Smothered Checkmate! The King is trapped by its own Rook.",
          stepUnlock: 4
        }
      ]
    },
    goated: {
      name: "Goated",
      description: "Paul Morphy's Opera House Mate",
      userColor: "white",
      setup: [
        // White pieces
        { sq: "g1", type: "k", color: "white" },
        { sq: "b3", type: "q", color: "white" },
        { sq: "g5", type: "b", color: "white" },
        { sq: "d1", type: "r", color: "white" },
        { sq: "a2", type: "p", color: "white" },
        { sq: "b2", type: "p", color: "white" },
        { sq: "f2", type: "p", color: "white" },
        { sq: "g2", type: "p", color: "white" },
        { sq: "h2", type: "p", color: "white" },
        // Black pieces
        { sq: "e8", type: "k", color: "black" },
        { sq: "e7", type: "q", color: "black" },
        { sq: "d7", type: "n", color: "black" },
        { sq: "d8", type: "r", color: "black" },
        { sq: "a7", type: "p", color: "black" },
        { sq: "b7", type: "p", color: "black" },
        { sq: "f7", type: "p", color: "black" },
        { sq: "g7", type: "p", color: "black" },
        { sq: "h7", type: "p", color: "black" }
      ],
      moves: [
        {
          userMove: { from: "g5", to: "f6" },
          aiResponse: { from: "d7", to: "f6" },
          text: "Bishop captures, removing the defender of the e8 flight square.",
          stepUnlock: 1
        },
        {
          userMove: { from: "b3", to: "b8" },
          aiResponse: { from: "f6", to: "b8" },
          text: "Morphy's famous Queen sacrifice! Knight is forced to capture.",
          stepUnlock: 2
        },
        {
          userMove: { from: "d1", to: "d8" },
          aiResponse: null, // Checkmate!
          text: "Checkmate! The Rook delivers the final blow protected by the Bishop.",
          stepUnlock: 4
        }
      ]
    }
  };

  // Game Engine State
  let currentLevelKey = null;
  let moveIndex = 0;
  let boardState = {}; // maps square e.g. "e4" -> { type: 'p', color: 'white' }
  let selectedSquare = null;

  // DOM Elements
  const chessBoardEl = document.getElementById('chess-board');
  const levelButtons = document.querySelectorAll('.level-pill');
  const activeLevelSpan = document.querySelector('#active-level-indicator span');
  const resetBtn = document.getElementById('reset-game-btn');
  const statusText = document.getElementById('status-text');
  const statusBadge = document.getElementById('game-status-badge');
  const statusDot = statusBadge.querySelector('.status-pulse-light');
  const contentSteps = document.querySelectorAll('.content-step');
  const contentScroller = document.getElementById('content-scroller');

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
    
    // UI states
    levelButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-level') === levelKey);
    });
    activeLevelSpan.textContent = PUZZLES[levelKey].name;
    resetBtn.disabled = false;
    
    // Status text update
    updateStatusText("Your Turn", "ready");

    // Initialize board representation
    boardState = {};
    PUZZLES[levelKey].setup.forEach(p => {
      boardState[p.sq] = { type: p.type, color: p.color };
    });

    // Reset portfolio visual steps back to Intro (step 0)
    showStep(0);

    renderBoard();
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
    // Auto-scroll left panel to top
    contentScroller.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Render the Chessboard Squares and Pieces
  function renderBoard() {
    chessBoardEl.innerHTML = '';
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    ranks.forEach(rank => {
      files.forEach(file => {
        const sq = file + rank;
        const squareColorClass = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0 ? 'light' : 'dark';
        
        const squareEl = document.createElement('div');
        squareEl.className = `chess-square ${squareColorClass}`;
        squareEl.dataset.square = sq;

        // Render rank labels on the leftmost column (a)
        if (file === 'a') {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord-label rank';
          rankLabel.textContent = rank;
          squareEl.appendChild(rankLabel);
        }

        // Render file labels on the bottom row (1)
        if (rank === '1') {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord-label file';
          fileLabel.textContent = file;
          squareEl.appendChild(fileLabel);
        }

        // Render piece if exists on square
        const piece = boardState[sq];
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `chess-piece ${piece.color}`;
          const colorLetter = piece.color === "white" ? "l" : "d";
          pieceEl.innerHTML = `<img src="pieces/Chess_${piece.type}${colorLetter}t45.svg" alt="${piece.color} ${piece.type}">`;
          squareEl.appendChild(pieceEl);
        }

        // Square Click Interaction
        squareEl.addEventListener('click', () => handleSquareClick(sq));

        chessBoardEl.appendChild(squareEl);
      });
    });

    highlightValidMoves();
  }

  // Handle click on a board square
  function handleSquareClick(sq) {
    if (!currentLevelKey) return;
    
    // Ignore clicks if AI is thinking or game is over
    if (statusDot.classList.contains('thinking') || moveIndex >= PUZZLES[currentLevelKey].moves.length) {
      return;
    }

    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];
    const piece = boardState[sq];

    // If a piece belongs to the user, select it
    if (piece && piece.color === PUZZLES[currentLevelKey].userColor) {
      selectedSquare = sq;
      highlightSquare(sq);
      highlightValidMoves();
      return;
    }

    // Try executing move from selectedSquare to click square
    if (selectedSquare) {
      const correctFrom = currentMove.userMove.from;
      const correctTo = currentMove.userMove.to;

      if (selectedSquare === correctFrom && sq === correctTo) {
        // Correct move!
        executeMove(correctFrom, correctTo);
      } else {
        // Wrong move - shake and flash red
        flashErrorSquare(selectedSquare);
        flashErrorSquare(sq);
        selectedSquare = null;
        renderBoard();
      }
    }
  }

  // Highlight the selected square
  function highlightSquare(sq) {
    const squares = document.querySelectorAll('.chess-square');
    squares.forEach(s => s.classList.remove('selected'));
    
    const target = document.querySelector(`[data-square="${sq}"]`);
    if (target) target.classList.add('selected');
  }

  // Highlight only the specific square that is the correct target move for this step
  function highlightValidMoves() {
    // Remove previous indicators
    const dots = document.querySelectorAll('.move-dot, .move-dot-capture');
    dots.forEach(d => d.remove());

    if (!selectedSquare || !currentLevelKey) return;
    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];

    if (selectedSquare === currentMove.userMove.from) {
      const destSq = currentMove.userMove.to;
      const destSquareEl = document.querySelector(`[data-square="${destSq}"]`);
      
      if (destSquareEl) {
        const hasOpponentPiece = boardState[destSq] && boardState[destSq].color !== boardState[selectedSquare].color;
        const indicator = document.createElement('div');
        indicator.className = hasOpponentPiece ? 'move-dot-capture' : 'move-dot';
        destSquareEl.appendChild(indicator);
      }
    }
  }

  // Execute a legal puzzle move
  function executeMove(from, to) {
    // Perform move in model
    boardState[to] = boardState[from];
    delete boardState[from];
    
    selectedSquare = null;
    renderBoard();

    // Trigger visual highlights for move trail
    document.querySelector(`[data-square="${from}"]`).classList.add('last-move-src');
    document.querySelector(`[data-square="${to}"]`).classList.add('last-move-dst');

    const currentMove = PUZZLES[currentLevelKey].moves[moveIndex];
    
    // Check if there is an AI response
    if (currentMove.aiResponse) {
      updateStatusText("AI is thinking...", "thinking");
      
      setTimeout(() => {
        // Execute AI response
        const aiFrom = currentMove.aiResponse.from;
        const aiTo = currentMove.aiResponse.to;
        
        boardState[aiTo] = boardState[aiFrom];
        delete boardState[aiFrom];
        
        renderBoard();
        
        // Highlight AI move trail
        document.querySelector(`[data-square="${aiFrom}"]`).classList.add('last-move-src');
        document.querySelector(`[data-square="${aiTo}"]`).classList.add('last-move-dst');
        
        // Unlock next portfolio step
        showStep(currentMove.stepUnlock);
        updateStatusText("Your Turn", "ready");
        
        moveIndex++;
      }, 1200);
    } else {
      // Checkmate! End of puzzle
      updateStatusText("Checkmate! You win!", "ready");
      showStep(currentMove.stepUnlock);
      triggerVictoryConfetti();
    }
  }

  // Flash a square red for incorrect move
  function flashErrorSquare(sq) {
    const el = document.querySelector(`[data-square="${sq}"]`);
    if (el) {
      el.classList.add('error-flash');
      setTimeout(() => el.classList.remove('error-flash'), 400);
    }
  }

  // Update Game Status Badge and Dot indicator
  function updateStatusText(text, statusType) {
    statusText.textContent = text;
    statusDot.className = 'status-pulse-light';
    if (statusType) {
      statusDot.classList.add(statusType);
    }
  }

  // Victory Confetti Particle Effect
  function triggerVictoryConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const colors = ['#f59e0b', '#06b6d4', '#8b5cf6', '#10b981', '#ec4899'];
    const particles = Array.from({ length: 120 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      r: Math.random() * 4 + 3,
      d: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5
    }));

    let animationFrameId = null;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      
      particles.forEach(p => {
        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();

        // Update positions
        p.y += p.d;
        p.tilt += 0.05;
        
        // Loop back up
        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    // Stop confetti after 7 seconds
    setTimeout(() => {
      cancelAnimationFrame(animationFrameId);
      ctx.clearRect(0, 0, width, height);
      canvas.style.display = 'none';
    }, 7000);
  }

  // Form submission simulation inside Step 4 (Victory)
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = document.getElementById('form-status');
      const btn = contactForm.querySelector('.btn-primary');
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.innerHTML = 'Sending... <span class="btn-glow"></span>';
      status.textContent = '';
      status.className = 'form-status';

      setTimeout(() => {
        status.textContent = 'Message sent! Thanks for checkmating me.';
        status.classList.add('success');
        contactForm.reset();
        btn.disabled = false;
        btn.textContent = originalText;
      }, 1500);
    });
  }
});
