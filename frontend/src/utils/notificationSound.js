// src/utils/notificationSound.js

/**
 * Universal notification sound manager for CampusLink.
 * Plays a clean, melodic WhatsApp-style dual-tone chime.
 * Supports HTML5 Audio with seamless Web Audio API synthesized fallback.
 */

let audioContext = null;
let isAudioUnlocked = false;

// Preload audio element
let notificationAudio = null;
if (typeof window !== 'undefined') {
  try {
    notificationAudio = new Audio('/sounds/notification.mp3');
    notificationAudio.preload = 'auto';
  } catch (_) {}
}

/**
 * Ensures AudioContext exists and resumes it after user gesture.
 */
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
};

/**
 * Unlocks audio context on the first user interaction (touch/click/keypress).
 * This satisfies mobile browser autoplay policies.
 */
export const unlockAudio = () => {
  if (isAudioUnlocked) return;
  isAudioUnlocked = true;

  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (notificationAudio) {
      // Play and immediately pause/rewind at volume 0 to unlock HTMLAudioElement
      const origVolume = notificationAudio.volume;
      notificationAudio.volume = 0;
      notificationAudio.play().then(() => {
        notificationAudio.pause();
        notificationAudio.currentTime = 0;
        notificationAudio.volume = origVolume;
      }).catch(() => {
        notificationAudio.volume = origVolume;
      });
    }
  } catch (_) {}

  // Remove listeners once unlocked
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
};

// Auto-register unlock listeners
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
}

/**
 * Synthesizes a crisp, pleasant WhatsApp-style double-tone chime (A5 -> E6).
 * Used as an instant, zero-latency fallback if an audio asset is missing or blocked.
 */
export const playSynthesizedChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // --- Tone 1 (Warm lower chime ~880Hz / A5) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.13);

    // --- Tone 2 (Sweet higher chime ~1318.5Hz / E6) ---
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.08);
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.39);
  } catch (e) {
    console.warn('Synthesized chime note:', e);
  }
};

/**
 * Plays the incoming message notification sound.
 * Tries the high-definition audio file first, seamlessly falling back to synthesized chime.
 */
export const playMessageNotificationSound = () => {
  // Attempt HTML5 Audio first
  if (notificationAudio) {
    try {
      notificationAudio.currentTime = 0;
      notificationAudio.volume = 0.7;
      const playPromise = notificationAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser blocked HTML5 audio, try synthesized chime
          playSynthesizedChime();
        });
        return;
      }
    } catch (_) {}
  }

  // Fallback to Web Audio synthesis
  playSynthesizedChime();
};

/**
 * Plays a soft alert notification sound for social events (likes, comments, orders).
 */
export const playAlertNotificationSound = () => {
  playSynthesizedChime();
};

export default {
  playMessageNotificationSound,
  playAlertNotificationSound,
  playSynthesizedChime,
  unlockAudio,
};
