import React, { useEffect } from 'react';
import { MessageSquare, X, ArrowRight } from 'lucide-react';
import SafeImage from './SafeImage';

// Synthetic pleasant chime using standard Web Audio API (zero external asset requests)
export const playChatNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Warm chime chord sequence (D5 -> A5)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch (err) {
    // Audio contexts might be blocked until first user interaction; fail silently
  }
};

export default function InAppChatBanner({ banner, onReply, onDismiss }) {
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [banner?.id, onDismiss]);

  if (!banner) return null;

  return (
    <div
      role="alert"
      className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[9999] w-[93%] sm:w-[420px] max-w-lg bg-slate-900/95 text-white backdrop-blur-xl border border-sky-500/40 rounded-2xl shadow-2xl p-3 sm:p-3.5 flex items-center space-x-3 transition-all transform animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
      onClick={() => onReply(banner.senderId)}
    >
      {/* Sender Avatar */}
      <div className="relative shrink-0">
        <SafeImage
          src={banner.senderAvatar}
          alt={banner.senderName}
          fallbackType="avatar"
          className="w-10 h-10 rounded-full object-cover border border-sky-400/50 shadow-xs"
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
      </div>

      {/* Message Info */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center space-x-1.5 mb-0.5">
          <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[170px]">
            {banner.senderName}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider shrink-0">
            {banner.senderRole || 'Chat'}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0 ml-auto">
            Just now
          </span>
        </div>
        <p className="text-xs text-slate-200 truncate font-normal">
          {banner.text || 'Sent you a message'}
        </p>
      </div>

      {/* Reply Action & Dismiss */}
      <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onReply(banner.senderId)}
          className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <span>Reply</span>
          <ArrowRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
