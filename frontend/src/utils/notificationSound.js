// src/utils/notificationSound.js

/**
 * Notification sound utilities for CampusLink.
 * Audio effects are disabled to provide a calm, clean, user-friendly experience.
 */

export const getAudioContext = () => null;
export const unlockAudio = () => {};
export const playSynthesizedChime = () => {};
export const playMessageNotificationSound = () => {};
export const playAlertNotificationSound = () => {};

export default {
  playMessageNotificationSound,
  playAlertNotificationSound,
  playSynthesizedChime,
  unlockAudio,
};
