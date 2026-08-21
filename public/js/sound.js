// ============================================================
// Sonidos de feedback (beep exito / beep error) generados
// en tiempo real con Web Audio API. No requiere archivos .mp3.
// ============================================================

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _audioCtx = new AC();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playTone(freq, durationMs, type = 'sine', delayMs = 0) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  const startTime = ctx.currentTime + delayMs / 1000;
  const endTime = startTime + durationMs / 1000;

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.start(startTime);
  osc.stop(endTime + 0.02);
}

// Beep positivo: dos tonos ascendentes, tipo "confirmacion"
function beepSuccess() {
  try {
    playTone(880, 90, 'sine', 0);
    playTone(1318, 120, 'sine', 90);
  } catch (e) { /* audio no disponible aun (requiere interaccion del usuario) */ }
}

// Beep de error: tono grave y disonante
function beepError() {
  try {
    playTone(180, 220, 'square', 0);
  } catch (e) { /* noop */ }
}
