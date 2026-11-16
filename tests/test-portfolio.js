/**
 * tests/test-portfolio.js
 * Verification Suite for Redesigned Portfolio & Chess Arena
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { setupDOM, teardownDOM, getConsoleErrors } = require('./mock-dom.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

console.log('\n--- Running Portfolio & Chess Arena Verification Suite ---');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

try {
  // 1. Setup DOM
  const { window, document } = setupDOM(htmlContent);

  // 2. Load Engines & Script into Global Context
  const chessEngineCode = fs.readFileSync(path.join(ROOT_DIR, 'chess-engine.js'), 'utf8');
  const chessAudioCode = fs.readFileSync(path.join(ROOT_DIR, 'chess-audio.js'), 'utf8');
  const scriptCode = fs.readFileSync(path.join(ROOT_DIR, 'script.js'), 'utf8');

  vm.runInThisContext(chessEngineCode);
  vm.runInThisContext(chessAudioCode);

  assert(typeof window.ChessEngine === 'function' || typeof global.ChessEngine === 'function', 'ChessEngine class loaded');
  assert(typeof window.ChessAudioEngine === 'function' || typeof global.ChessAudioEngine === 'function', 'ChessAudioEngine class loaded');

  // Load Main Script
  vm.runInThisContext(scriptCode);

  // Trigger DOMContentLoaded
  document.dispatchEvent(new window.Event('DOMContentLoaded'));

  // 3. Verify Key Page Sections Exist
  assert(document.getElementById('header') !== null, 'Site header exists');
  assert(document.getElementById('hero') !== null, 'Hero section exists');
  assert(document.getElementById('about') !== null, 'About section exists');
  assert(document.getElementById('experience') !== null, 'Experience section exists');
  assert(document.getElementById('projects') !== null, 'Projects section exists');
  assert(document.getElementById('chess') !== null, 'Interactive Chess Arena exists');
  assert(document.getElementById('skills') !== null, 'Skills / Arsenal section exists');
  assert(document.getElementById('contact') !== null, 'Contact section exists');

  // 4. Test Theme Toggling
  const themeToggle = document.getElementById('theme-toggle');
  assert(themeToggle !== null, 'Theme toggle button exists');
  const initialTheme = document.documentElement.getAttribute('data-theme');
  assert(initialTheme === 'dark' || initialTheme === 'light', `Initial theme set: ${initialTheme}`);

  themeToggle.dispatchEvent(new window.Event('click'));
  const toggledTheme = document.documentElement.getAttribute('data-theme');
  assert(toggledTheme !== initialTheme, `Theme toggled to: ${toggledTheme}`);

  // 5. Verify Chessboard Initialization
  const boardEl = document.getElementById('chess-board');
  assert(boardEl !== null, 'Chess board container exists');
  const squares = boardEl.querySelectorAll('.chess-square');
  assert(squares.length === 64, `Chessboard renders 64 squares (found: ${squares.length})`);

  const initialPieces = boardEl.querySelectorAll('.chess-piece');
  assert(initialPieces.length === 32, `Initial position has 32 pieces (found: ${initialPieces.length})`);

  // 6. Test Interactive Move (Click e2 then e4)
  const e2 = boardEl.querySelector('[data-square="e2"]');
  assert(e2 !== null, 'Square e2 exists');
  e2.dispatchEvent(new window.Event('click'));

  const dotsAfterClick = boardEl.querySelectorAll('.move-dot, .move-dot-capture');
  assert(dotsAfterClick.length > 0, `Legal move indicators rendered on piece click (${dotsAfterClick.length} moves)`);

  const e4 = boardEl.querySelector('[data-square="e4"]');
  assert(e4 !== null, 'Square e4 exists');
  e4.dispatchEvent(new window.Event('click'));

  // Verify Move Recorded
  const historyPills = document.querySelectorAll('.history-pill');
  assert(historyPills.length >= 1, `Move recorded in history log (count: ${historyPills.length})`);

  // 7. Test Undo Button
  const undoBtn = document.getElementById('undo-game-btn');
  assert(undoBtn !== null, 'Undo button exists');
  assert(!undoBtn.disabled, 'Undo button enabled after player move');
  undoBtn.dispatchEvent(new window.Event('click'));

  const historyAfterUndo = document.querySelectorAll('.history-pill');
  assert(historyAfterUndo.length === 0, 'Move undone cleanly from history');

  // 8. Test Puzzles Mode Toggle
  const modePuzzlesBtn = document.getElementById('mode-btn-puzzles');
  assert(modePuzzlesBtn !== null, 'Puzzles mode button exists');
  modePuzzlesBtn.dispatchEvent(new window.Event('click'));

  const puzzleSelectGroup = document.getElementById('puzzle-select-group');
  assert(puzzleSelectGroup && !puzzleSelectGroup.classList.contains('hidden'), 'Puzzle selector visible in puzzles mode');

  const commentary = document.getElementById('commentary-text');
  assert(commentary && commentary.textContent.includes('Tactic:'), 'Tactical commentary updated for puzzle');

  // 9. Test Sound Mute Button
  const audioMuteBtn = document.getElementById('audio-mute-btn');
  assert(audioMuteBtn !== null, 'Audio mute button exists');
  audioMuteBtn.dispatchEvent(new window.Event('click'));
  assert(audioMuteBtn.classList.contains('muted'), 'Audio button toggles to muted state');

  // 10. Test Flip Board Button
  const flipBtn = document.getElementById('flip-board-btn');
  assert(flipBtn !== null, 'Flip board button exists');
  flipBtn.dispatchEvent(new window.Event('click'));
  const firstRankAfterFlip = boardEl.querySelector('.coord-label.rank');
  assert(firstRankAfterFlip && firstRankAfterFlip.textContent === '1', 'Board orientation flipped to rank 1 at top');

  // 11. Test Contact Form Validation
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  assert(contactForm !== null && formStatus !== null, 'Contact form exists');
  contactForm.dispatchEvent(new window.Event('submit'));
  assert(formStatus.classList.contains('err'), 'Empty submission triggers validation error');

  // 12. Check Console Errors
  const errors = getConsoleErrors ? getConsoleErrors() : [];
  assert(errors.length === 0, `Zero unhandled console errors during full run (errors: ${errors.length})`);

  teardownDOM();
} catch (err) {
  console.error('Test execution error:', err);
  failedTests++;
}

console.log('\n==========================================');
console.log(`TOTAL PASSED: ${passedTests}`);
console.log(`TOTAL FAILED: ${failedTests}`);
console.log('==========================================\n');

if (failedTests > 0) process.exit(1);
