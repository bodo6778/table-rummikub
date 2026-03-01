let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Call this early on any user gesture to unlock audio for later non-gesture calls
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  detune = 0
) {
  const ctx = getCtx();
  if (ctx.state !== "running") return; // skip if still locked

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Short click — tile placed into meld or dropped */
export function playDrop() {
  playTone(800, 0.08, "sine", 0.12);
  playTone(500, 0.1, "sine", 0.08);
}

/** Soft pop — tile drawn from pool */
export function playDraw() {
  playTone(600, 0.06, "sine", 0.1);
  setTimeout(() => playTone(900, 0.1, "sine", 0.12), 50);
}

/** Gentle ding — it's your turn */
export function playTurnNotify() {
  playTone(700, 0.15, "triangle", 0.1);
  setTimeout(() => playTone(1050, 0.2, "triangle", 0.12), 120);
}

/** Short rising fanfare — win */
export function playWin() {
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, "triangle", 0.12), i * 120);
  });
}

/** Low buzz — error / invalid action */
export function playError() {
  playTone(200, 0.15, "sawtooth", 0.06);
  setTimeout(() => playTone(180, 0.15, "sawtooth", 0.06), 80);
}
