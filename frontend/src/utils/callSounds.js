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
 * Incoming call ringtone (plays for recipient until answered or cut)
 */
export function startIncomingRingtone() {
  stopIncomingRingtone();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playRingBurst = () => {
    try {
      const now = ctx.currentTime;
      // Dual-tone frequency (pleasant chime: 520Hz & 660Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(520, now);
      osc2.frequency.setValueAtTime(660, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.05);
      gain.gain.setValueAtTime(0.28, now + 0.85);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.1);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.15);
      osc2.stop(now + 1.15);

      // Trigger mobile vibration if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([400, 200, 400]); } catch (_) {}
      }
    } catch (_) {}
  };

  playRingBurst();
  ringtoneInterval = setInterval(playRingBurst, 2500);
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
  // Silently transition into call without jarring oscillator bursts
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
