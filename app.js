'use strict';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const STORAGE_KEY = 'sorteio-letras-state';
const DEFAULT_BG = '#1a1a2e';

const state = {
  drawn: [],
  allowRepeats: true,
  countdownEnabled: false,
  countdownSeconds: 30,
  soundEnabled: true,
  isAnimating: false,
  countdownTimer: null,
};

// Parallel array: color assigned to each drawn letter
let chipColors = [];

// ---- DOM refs ----
let elLetterDisplay, elLetter, elCountdown, elDrawnList, elSheet,
    elThemeMeta, elBtnSound;

// ---- Color ----
function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 68%, 46%)`;
}

function setBackground(color) {
  elLetterDisplay.style.backgroundColor = color;
  // Update browser chrome color. For hsl() we keep the meta in sync via computed style.
  elThemeMeta.setAttribute('content', color);
}

function setLetter(ch) {
  elLetter.textContent = ch;
}

// ---- Audio (Web Audio API, no files) ----
let audioCtx = null;
function getAudioCtx() {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// progress: 0=fast/start, 1=slow/about-to-land
function playTick(progress = 0) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    const freq = 500 + progress * 600; // 500→1100 Hz as it slows
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.055);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.start(now); osc.stop(now + 0.07);
  } catch (_) {}
}

function playLanding() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [440, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25 - i * 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.5);
    });
  } catch (_) {}
}

// ---- Draw animation (power-eased slot machine) ----
const STEPS = 22;      // total tick count
const MIN_DELAY = 45, MAX_DELAY = 420; // ms

function startDraw() {
  if (state.isAnimating) return;
  stopCountdown();

  const pool = state.allowRepeats
    ? ALPHABET
    : ALPHABET.filter(l => !state.drawn.includes(l));
  if (pool.length === 0) { showAllDrawnMessage(); return; }

  // Target chosen BEFORE animation starts
  const target = pool[Math.floor(Math.random() * pool.length)];
  state.isAnimating = true;
  elLetter.classList.remove('landed');

  const color = randomColor();
  setBackground(color); // change bg immediately at draw start

  // Power-eased delays: delay[i] = MIN * (MAX/MIN)^(i/(STEPS-2))
  const delays = Array.from({ length: STEPS - 1 }, (_, i) =>
    MIN_DELAY * Math.pow(MAX_DELAY / MIN_DELAY, i / (STEPS - 2))
  );

  let step = 0;
  function tick() {
    if (step < STEPS - 1) {
      setLetter(ALPHABET[Math.floor(Math.random() * 26)]);
      playTick(step / (STEPS - 1)); // rising pitch progress
      step++;
      setTimeout(tick, delays[step - 1]);
    } else {
      setLetter(target);
      playLanding();
      // trigger landing pop
      void elLetter.offsetWidth;
      elLetter.classList.add('landed');
      state.drawn.push(target);
      chipColors.push(color);
      updateDrawnList();
      saveState();
      state.isAnimating = false;
      if (state.countdownEnabled) setTimeout(startCountdown, 200);
    }
  }
  tick();
}

function showAllDrawnMessage() {
  setLetter('✓');
  elLetter.classList.remove('landed');
  void elLetter.offsetWidth;
  elLetter.classList.add('landed');
}

// ---- Countdown ----
function startCountdown() {
  stopCountdown();
  let remaining = state.countdownSeconds;
  elCountdown.removeAttribute('hidden');
  elCountdown.textContent = remaining;

  state.countdownTimer = setInterval(() => {
    remaining--;
    elCountdown.textContent = remaining;
    if (remaining <= 0) stopCountdown();
  }, 1000);
}

function stopCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
  elCountdown.setAttribute('hidden', '');
  elCountdown.textContent = '';
}

// ---- Drawn list ----
function updateDrawnList() {
  elDrawnList.innerHTML = '';
  state.drawn.forEach((letter, i) => {
    const chip = document.createElement('span');
    chip.className = 'drawn-chip';
    chip.textContent = letter;
    chip.style.background = chipColors[i] || randomColor();
    elDrawnList.appendChild(chip);
  });
  // Scroll to end
  elDrawnList.parentElement.scrollLeft = elDrawnList.parentElement.scrollWidth;
}

// ---- Reset ----
function reset() {
  state.drawn = [];
  chipColors = [];
  stopCountdown();
  setBackground(DEFAULT_BG);
  setLetter('?');
  elLetter.classList.remove('landed');
  updateDrawnList();
  saveState();
}

// ---- Persistence ----
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      drawn: state.drawn,
      chipColors,
      allowRepeats: state.allowRepeats,
      countdownEnabled: state.countdownEnabled,
      countdownSeconds: state.countdownSeconds,
      soundEnabled: state.soundEnabled,
    }));
  } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.drawn = Array.isArray(saved.drawn) ? saved.drawn : [];
    chipColors = Array.isArray(saved.chipColors) ? saved.chipColors : [];
    state.allowRepeats = saved.allowRepeats ?? true;
    state.countdownEnabled = saved.countdownEnabled ?? false;
    state.countdownSeconds = saved.countdownSeconds ?? 30;
    state.soundEnabled = saved.soundEnabled ?? true;
  } catch (_) {}
}

// ---- Sound toggle ----
function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  updateSoundIcon();
  saveState();
}

function updateSoundIcon() {
  elBtnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
  elBtnSound.classList.toggle('muted', !state.soundEnabled);
}

// ---- Bottom sheet (click toggle + swipe to dismiss) ----
function initBottomSheet() {
  const handle = document.getElementById('sheet-handle');

  handle.addEventListener('click', (e) => {
    // Ignore click if it was the end of a drag gesture
    if (handle.dataset.dragged === 'true') {
      handle.dataset.dragged = 'false';
      return;
    }
    elSheet.classList.toggle('open');
  });

  let startY = 0, currentY = 0, dragging = false;

  const getSheetHeight = () => elSheet.getBoundingClientRect().height;

  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    handle.dataset.dragged = 'false';
    elSheet.classList.add('dragging');
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (Math.abs(delta) > 6) handle.dataset.dragged = 'true';
    const isOpen = elSheet.classList.contains('open');
    const height = getSheetHeight();
    if (isOpen) {
      // allow dragging down only
      const y = Math.max(0, delta);
      elSheet.style.transform = `translateY(${y}px)`;
    } else {
      // allow dragging up from collapsed position
      const collapsed = height - 48;
      const y = Math.min(collapsed, Math.max(0, collapsed + delta));
      elSheet.style.transform = `translateY(${y}px)`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    elSheet.classList.remove('dragging');
    elSheet.style.transform = '';
    const delta = currentY - startY;
    const isOpen = elSheet.classList.contains('open');
    if (isOpen && delta > 60) {
      elSheet.classList.remove('open');
    } else if (!isOpen && delta < -60) {
      elSheet.classList.add('open');
    }
  });
}

// ---- Init ----
function init() {
  elLetterDisplay = document.getElementById('letter-display');
  elLetter = document.getElementById('letter');
  elCountdown = document.getElementById('countdown-display');
  elDrawnList = document.getElementById('drawn-list');
  elSheet = document.getElementById('bottom-sheet');
  elThemeMeta = document.getElementById('theme-color-meta');
  elBtnSound = document.getElementById('btn-sound');

  loadState();

  // Reflect loaded settings in UI
  document.getElementById('opt-repeats').checked = state.allowRepeats;
  document.getElementById('opt-countdown').checked = state.countdownEnabled;
  document.getElementById('opt-seconds').value = state.countdownSeconds;
  updateSoundIcon();
  updateDrawnList();

  // Main click target
  elLetterDisplay.addEventListener('click', startDraw);

  // Top bar buttons
  elBtnSound.addEventListener('click', (e) => { e.stopPropagation(); toggleSound(); });
  document.getElementById('btn-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    reset();
  });

  // Settings
  document.getElementById('opt-repeats').addEventListener('change', (e) => {
    state.allowRepeats = e.target.checked;
    saveState();
  });
  document.getElementById('opt-countdown').addEventListener('change', (e) => {
    state.countdownEnabled = e.target.checked;
    saveState();
  });
  document.getElementById('opt-seconds').addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    state.countdownSeconds = Number.isFinite(v) ? Math.min(300, Math.max(1, v)) : 30;
    e.target.value = state.countdownSeconds;
    saveState();
  });

  initBottomSheet();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
