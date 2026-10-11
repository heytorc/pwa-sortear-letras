'use strict';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const STORAGE_KEY = 'sorteio-letras-state';
const DEFAULT_BG = '#1a1a2e';

const state = {
  drawn: [],
  allowRepeats: false,
  countdownEnabled: true,
  countdownSeconds: 10,
  soundEnabled: true,
  hapticsEnabled: true,
  isAnimating: false,
  countdownTimer: null,
  sheetOpen: false,
  resetDialogOpen: false,
};

let chipColors = [];
let audioCtx = null;

let elLetterDisplay,
    elLetter,
    elCountdown,
    elDrawnList,
    elSheet,
    elThemeMeta,
    elBtnSound,
    elBtnSettings,
    elBtnReset,
    elAppOverlay,
    elResetDialog,
    elResetCancel,
    elResetConfirm;

function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 68%, 46%)`;
}

function setBackground(color) {
  elLetterDisplay.style.backgroundColor = color;
  elThemeMeta.setAttribute('content', color);
}

function setLetter(ch) {
  elLetter.textContent = ch;
}

function getAudioCtx() {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTick(progress = 0) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    const freq = 500 + progress * 600;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.055);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch (_) {}
}

function playLanding() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [440, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25 - i * 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  } catch (_) {}
}

function playCountdownBell() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.22);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (_) {}
}

// ---- Haptics ----
// Android/Chrome: Vibration API. iOS 17.4+ Safari: toggling a hidden <input switch> gives a tap.
let hapticLabel = null;

function iosHapticTap() {
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.className = 'haptic-switch';
    hapticLabel.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    hapticLabel.appendChild(input);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}

function haptic(kind = 'tick') {
  if (!state.hapticsEnabled) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'landing' ? [30, 40, 60] : 8);
    } else if (kind === 'landing') {
      iosHapticTap();
      setTimeout(iosHapticTap, 90);
    } else {
      iosHapticTap();
    }
  } catch (_) {}
}

const STEPS = 22;
const MIN_DELAY = 45;
const MAX_DELAY = 420;

function startDraw() {
  if (state.isAnimating || state.sheetOpen || state.resetDialogOpen) return;
  stopCountdown();

  const pool = state.allowRepeats
    ? ALPHABET
    : ALPHABET.filter((letter) => !state.drawn.includes(letter));

  if (pool.length === 0) {
    showAllDrawnMessage();
    return;
  }

  const target = pool[Math.floor(Math.random() * pool.length)];
  state.isAnimating = true;
  elLetter.classList.remove('landed');

  const color = randomColor();
  setBackground(color);

  const delays = Array.from({ length: STEPS - 1 }, (_, i) =>
    MIN_DELAY * Math.pow(MAX_DELAY / MIN_DELAY, i / (STEPS - 2))
  );

  let step = 0;

  function tick() {
    if (step < STEPS - 1) {
      setLetter(ALPHABET[Math.floor(Math.random() * 26)]);
      playTick(step / (STEPS - 1));
      haptic('tick');
      step += 1;
      setTimeout(tick, delays[step - 1]);
    } else {
      setLetter(target);
      playLanding();
      haptic('landing');
      void elLetter.offsetWidth;
      elLetter.classList.add('landed');
      state.drawn.push(target);
      chipColors.push(color);
      updateDrawnList();
      saveState();
      state.isAnimating = false;
      if (state.countdownEnabled) setTimeout(startCountdown, 180);
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

function startCountdown() {
  stopCountdown();

  let remaining = state.countdownSeconds;
  elCountdown.removeAttribute('hidden');
  elCountdown.textContent = remaining;

  state.countdownTimer = setInterval(() => {
    remaining -= 1;
    elCountdown.textContent = remaining;

    if (remaining <= 0) {
      playCountdownBell();
      stopCountdown();
    }
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

function updateDrawnList() {
  elDrawnList.innerHTML = '';

  state.drawn.forEach((letter, index) => {
    const chip = document.createElement('span');
    chip.className = 'drawn-chip';
    chip.textContent = letter;
    chip.style.background = chipColors[index] || randomColor();
    elDrawnList.appendChild(chip);
  });

  if (elDrawnList.parentElement) {
    elDrawnList.parentElement.scrollLeft = elDrawnList.parentElement.scrollWidth;
  }
}

function resetStateSession() {
  state.drawn = [];
  chipColors = [];
  stopCountdown();
  setBackground(DEFAULT_BG);
  setLetter('?');
  elLetter.classList.remove('landed');
  updateDrawnList();
  saveState();
}

function openResetDialog() {
  if (state.sheetOpen) closeSheet();
  state.resetDialogOpen = true;
  elResetDialog.hidden = false;
  elAppOverlay.hidden = false;
}

function closeResetDialog() {
  state.resetDialogOpen = false;
  elResetDialog.hidden = true;
  if (!state.sheetOpen) elAppOverlay.hidden = true;
}

function openSheet() {
  state.sheetOpen = true;
  elSheet.classList.add('open');
  elSheet.setAttribute('aria-hidden', 'false');
  elAppOverlay.hidden = false;
}

function closeSheet() {
  state.sheetOpen = false;
  elSheet.classList.remove('open');
  elSheet.setAttribute('aria-hidden', 'true');
  if (!state.resetDialogOpen) elAppOverlay.hidden = true;
}

function toggleSheet() {
  if (state.sheetOpen) closeSheet();
  else openSheet();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      drawn: state.drawn,
      chipColors,
      allowRepeats: state.allowRepeats,
      countdownEnabled: state.countdownEnabled,
      countdownSeconds: state.countdownSeconds,
      soundEnabled: state.soundEnabled,
      hapticsEnabled: state.hapticsEnabled,
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
    state.hapticsEnabled = saved.hapticsEnabled ?? true;
  } catch (_) {}
}

function setSoundIcon() {
  const iconName = state.soundEnabled ? 'volume-2' : 'volume-x';

  elBtnSound.innerHTML = `<i data-lucide="${iconName}"></i>`;
  elBtnSound.classList.toggle('muted', !state.soundEnabled);

  if (window.lucide) lucide.createIcons();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  setSoundIcon();
  saveState();
}

function initBottomSheet() {
  const handle = document.getElementById('sheet-handle');

  handle.addEventListener('click', (event) => {
    if (handle.dataset.dragged === 'true') {
      handle.dataset.dragged = 'false';
      return;
    }
    toggleSheet();
  });

  let startY = 0;
  let currentY = 0;
  let dragging = false;

  handle.addEventListener('touchstart', (event) => {
    startY = event.touches[0].clientY;
    currentY = startY;
    dragging = true;
    handle.dataset.dragged = 'false';
    elSheet.classList.add('dragging');
  }, { passive: true });

  handle.addEventListener('touchmove', (event) => {
    if (!dragging) return;
    currentY = event.touches[0].clientY;
    const delta = currentY - startY;
    if (Math.abs(delta) > 6) handle.dataset.dragged = 'true';

    const offset = state.sheetOpen ? Math.max(0, delta) : Math.min(0, delta);
    elSheet.style.transform = `translateY(${offset}px)`;
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    elSheet.classList.remove('dragging');
    elSheet.style.transform = '';

    const delta = currentY - startY;
    if (state.sheetOpen && delta > 60) closeSheet();
    else if (!state.sheetOpen && delta < -60) openSheet();
  });
}

function init() {
  elLetterDisplay = document.getElementById('letter-display');
  elLetter = document.getElementById('letter');
  elCountdown = document.getElementById('countdown-display');
  elDrawnList = document.getElementById('drawn-list');
  elSheet = document.getElementById('bottom-sheet');
  elThemeMeta = document.getElementById('theme-color-meta');
  elBtnSound = document.getElementById('btn-sound');
  elBtnSettings = document.getElementById('btn-settings');
  elBtnReset = document.getElementById('btn-reset');
  elAppOverlay = document.getElementById('app-overlay');
  elResetDialog = document.getElementById('reset-dialog');
  elResetCancel = document.getElementById('reset-cancel');
  elResetConfirm = document.getElementById('reset-confirm');

  loadState();

  document.getElementById('opt-repeats').checked = state.allowRepeats;
  document.getElementById('opt-countdown').checked = state.countdownEnabled;
  document.getElementById('opt-seconds').value = state.countdownSeconds;
  document.getElementById('opt-haptics').checked = state.hapticsEnabled;

  setSoundIcon();
  updateDrawnList();

  elLetterDisplay.addEventListener('click', () => {
    if (state.sheetOpen || state.resetDialogOpen || state.isAnimating) return;
    startDraw();
  });

  elBtnSound.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSound();
  });

  elBtnSettings.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSheet();
  });

  elBtnReset.addEventListener('click', (event) => {
    event.stopPropagation();
    openResetDialog();
  });

  elAppOverlay.addEventListener('click', () => {
    if (state.resetDialogOpen) {
      closeResetDialog();
      return;
    }
    if (state.sheetOpen) closeSheet();
  });

  elResetCancel.addEventListener('click', () => {
    closeResetDialog();
  });

  elResetConfirm.addEventListener('click', () => {
    resetStateSession();
    closeResetDialog();
  });

  document.getElementById('opt-repeats').addEventListener('change', (event) => {
    state.allowRepeats = event.target.checked;
    saveState();
  });

  document.getElementById('opt-countdown').addEventListener('change', (event) => {
    state.countdownEnabled = event.target.checked;
    saveState();
  });

  document.getElementById('opt-haptics').addEventListener('change', (event) => {
    state.hapticsEnabled = event.target.checked;
    saveState();
    if (state.hapticsEnabled) haptic('landing');
  });

  document.getElementById('opt-seconds').addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    state.countdownSeconds = Number.isFinite(value) ? Math.min(300, Math.max(1, value)) : 30;
    event.target.value = state.countdownSeconds;
    saveState();
  });

  initBottomSheet();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
