// src/utils/callSounds.js
// Uses native Web Audio API to synthesize realistic ringtones and call sound effects
// Guaranteed to work across mobile and desktop without external MP3 file dependencies

let audioCtx = null;
let ringtoneInterval = null;
let ringbackInterval = null;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a warm, percussive chime note with realistic acoustic decay and subtle harmonic overtone
 */
function playChimeNote(ctx, freq, startTime, duration = 0.38, peakGain = 0.22) {
  try {
    const now = startTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const noteGain = ctx.createGain();

    // Fundamental tone (pure sine)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // Subtle 2nd harmonic (warm triangle wave at octave)
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.08, now);
    osc2.connect(overtoneGain);
    overtoneGain.connect(noteGain);

    osc1.connect(noteGain);
    noteGain.connect(ctx.destination);

    // Bell / Marimba percussive envelope: immediate crisp attack, natural exponential ring-out
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  } catch (_) {}
}

/**
 * Incoming call ringtone (plays for recipient until answered or cut)
 * Beautiful, melodic 6-note smartphone chime arpeggio (C5 -> E5 -> G5 -> C6 -> G5 -> C6 -> E6)
 */
export function startIncomingRingtone() {
  stopIncomingRingtone();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playMelodicChime = () => {
    try {
      const now = ctx.currentTime + 0.02;

      // Sparkling musical arpeggio melody
      playChimeNote(ctx, 523.25, now + 0.00, 0.32, 0.20); // C5
      playChimeNote(ctx, 659.25, now + 0.12, 0.32, 0.22); // E5
      playChimeNote(ctx, 783.99, now + 0.24, 0.35, 0.24); // G5
      playChimeNote(ctx, 1046.50, now + 0.36, 0.42, 0.26); // C6
      playChimeNote(ctx, 783.99, now + 0.54, 0.32, 0.20); // G5
      playChimeNote(ctx, 1046.50, now + 0.68, 0.45, 0.26); // C6
      playChimeNote(ctx, 1318.51, now + 0.90, 0.55, 0.18); // High E6 resonant finish

      // Realistic incoming call mobile vibration rhythm
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([350, 150, 350, 600]); } catch (_) {}
      }
    } catch (_) {}
  };

  playMelodicChime();
  ringtoneInterval = setInterval(playMelodicChime, 2400);
}

export function stopIncomingRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(0); } catch (_) {}
  }
}

/**
 * Outgoing ringback tone (plays for caller while waiting for recipient to pick up)
 */
export function startRingbackTone() {
  stopRingbackTone();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playBeepBurst = () => {
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
      gain.gain.setValueAtTime(0.12, now + 1.2);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.35);
      osc2.stop(now + 1.35);
    } catch (_) {}
  };

  playBeepBurst();
  ringbackInterval = setInterval(playBeepBurst, 3000);
}

export function stopRingbackTone() {
  if (ringbackInterval) {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
  }
}

/**
 * Connected chime (silent/clean connection to avoid any feedback or funny sounds)
 */
export function playConnectedTone() {
  stopIncomingRingtone();
  stopRingbackTone();
}

/**
 * Call declined / Line busy tone (3 short standard telecom busy pulses)
 * Universally signals to caller that the recipient pressed Decline
 */
export function playDeclinedTone() {
  stopIncomingRingtone();
  stopRingbackTone();
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const beeps = [0, 0.22, 0.44];

    beeps.forEach((startOffset) => {
      const t = now + startOffset;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(480, t);
      osc2.frequency.setValueAtTime(620, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      gain.gain.setValueAtTime(0.18, t + 0.12);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.15);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.16);
      osc2.stop(t + 0.16);
    });

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([120, 80, 120, 80, 120]); } catch (_) {}
    }
  } catch (_) {}
}

/**
 * End call tone (played softly when call terminates)
 */
export function playEndCallTone() {
  stopIncomingRingtone();
  stopRingbackTone();
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (_) {}
}

