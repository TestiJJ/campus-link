// src/components/VoiceCallModal.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  UserPlus, Users, X, Check, Loader2, Sparkles,
  ChevronDown, Maximize2, ShieldCheck
} from 'lucide-react';
import SafeImage from './SafeImage';

export default function VoiceCallModal({
  callState, // 'idle' | 'calling' | 'ringing' | 'incoming' | 'connected' | 'ended'
  callData, // { callId, partnerId, partnerName, partnerAvatar, isCaller, duration, isMuted, isSpeaker }
  callDuration = 0,
  onAnswer,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
  onInviteMember,
  availableFriends = []
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState([]);

  // Auto-maximize if a new incoming call arrives
  useEffect(() => {
    if (callState === 'incoming') {
      setIsMinimized(false);
    }
  }, [callState]);

  if (callState === 'idle' || !callData) return null;

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const isIncoming = callState === 'incoming';
  const isCalling = callState === 'calling' || callState === 'ringing';
  const isConnected = callState === 'connected';
  const isEnded = callState === 'ended';

  const partnerName = callData.partnerName || 'CampusLink User';
  const partnerAvatar = callData.partnerAvatar;

  // ============================================================
  // MINIMIZED FLOATING PIP WIDGET (Allows multitasking on call)
  // ============================================================
  if (isMinimized && (isConnected || isCalling)) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:right-5 sm:left-auto sm:translate-x-0 z-[120] pointer-events-auto">
        <motion.div
          initial={{ y: -20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.9 }}
          className="bg-slate-900/95 border border-sky-500/40 backdrop-blur-xl rounded-2xl shadow-2xl p-2 px-3.5 flex items-center space-x-3 text-white ring-1 ring-sky-400/20"
        >
          {/* Caller Avatar & Info - Tap to expand */}
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center space-x-2.5 cursor-pointer text-left group"
            title="Tap to return to full call screen"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 border border-sky-400/50 shadow-xs">
                <SafeImage
                  src={partnerAvatar}
                  alt={partnerName}
                  fallbackType="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                isConnected ? 'bg-sky-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`} />
            </div>

            <div className="min-w-0 pr-1">
              <p className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[140px] group-hover:text-sky-300 transition-colors">
                {partnerName}
              </p>
              <p className="text-[10px] font-semibold text-sky-400 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block animate-pulse" />
                <span>{isConnected ? formatDuration(callDuration) : 'Calling...'}</span>
              </p>
            </div>
          </button>

          {/* Quick Floating In-Call Controls */}
          <div className="flex items-center space-x-1.5 border-l border-slate-800 pl-2">
            {/* Mute */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                callData.isMuted
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={callData.isMuted ? 'Unmute' : 'Mute'}
            >
              {callData.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            {/* Speaker / Extra Volume */}
            <button
              type="button"
              onClick={onToggleSpeaker}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                callData.isSpeaker
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={callData.isSpeaker ? 'Speaker On (Extra Volume)' : 'Speaker Off'}
            >
              {callData.isSpeaker ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* End Call */}
            <button
              type="button"
              onClick={onEndCall}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer shadow-xs active:scale-95"
              title="Hang up"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>

            {/* Maximize Icon */}
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Maximize"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // FULL SCREEN IMMERSIVE CALL MODAL (CampusLink Electric Blue Theme)
  // ============================================================
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-sky-500/30 shadow-2xl p-6 sm:p-7 text-white flex flex-col items-center justify-between min-h-[460px] overflow-hidden"
        >
          {/* Ambient Royal Blue Glow Background */}
          <div className="absolute top-0 inset-x-0 h-44 bg-gradient-to-b from-blue-600/20 via-sky-500/10 to-transparent pointer-events-none rounded-t-3xl" />
          <div className="absolute -top-16 -left-16 w-44 h-44 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar Utilities: Minimize & End-to-End Encryption Badge */}
          <div className="w-full flex items-center justify-between text-xs text-slate-400 relative z-10">
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] font-semibold text-slate-300">Encrypted Voice Call</span>
            </div>

            {/* Minimize button (Allows user to multitask) */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-xs"
              title="Minimize call to multitask"
              aria-label="Minimize call"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Caller / Receiver Avatar with Dynamic Pulsing Rings */}
          <div className="flex flex-col items-center my-auto relative z-10">
            <div className="relative mb-5">
              {/* Outer Pulsing Glow Wave */}
              {(isCalling || isIncoming || isConnected) && (
                <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping opacity-60 pointer-events-none" />
              )}
              {(isCalling || isIncoming) && (
                <div className="absolute -inset-8 rounded-full bg-sky-500/10 animate-pulse pointer-events-none" />
              )}

              {/* Main Avatar Frame */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-sky-400/60 shadow-xl shadow-blue-900/40 bg-slate-800">
                <SafeImage
                  src={partnerAvatar}
                  alt={partnerName}
                  fallbackType="avatar"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Speaker Indicator Badge */}
              {callData.isSpeaker && isConnected && (
                <span className="absolute bottom-1 right-1 p-1.5 rounded-full bg-sky-500 text-white shadow-md ring-2 ring-slate-900" title="Speakerphone active">
                  <Volume2 className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            {/* Partner Name & Subtext */}
            <h3 className="text-xl sm:text-2xl font-black text-white text-center tracking-tight truncate max-w-[260px]">
              {partnerName}
            </h3>

            {/* Live Call Status / Timer */}
            <div className="mt-2 flex items-center justify-center">
              {isIncoming && (
                <span className="text-xs font-bold text-sky-400 flex items-center space-x-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Incoming Campus Voice Call...</span>
                </span>
              )}

              {isCalling && (
                <span className="text-xs font-semibold text-sky-300 flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span>{callState === 'ringing' ? 'Ringing out...' : 'Connecting audio...'}</span>
                </span>
              )}

              {isConnected && (
                <div className="flex items-center space-x-2 bg-blue-950/60 px-3 py-1 rounded-full border border-sky-500/30">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-sm font-black text-sky-200 tracking-wider">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              )}

              {isEnded && (
                <span className="text-xs font-semibold text-rose-400">
                  Call Terminated
                </span>
              )}
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div className="w-full flex flex-col items-center space-y-4 relative z-10 pt-2">
            {/* INCOMING CALL ACTIONS */}
            {isIncoming && (
              <div className="w-full flex items-center justify-around px-4">
                {/* Decline Button (Red) */}
                <button
                  type="button"
                  onClick={onReject}
                  className="flex flex-col items-center space-y-1.5 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all">
                    <PhoneOff className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-rose-400">Decline</span>
                </button>

                {/* Answer Button (CampusLink Vibrant Royal Blue) */}
                <button
                  type="button"
                  onClick={onAnswer}
                  className="flex flex-col items-center space-y-1.5 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-blue-500/40 transition-all animate-bounce ring-4 ring-blue-500/20">
                    <Phone className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-sky-400">Accept</span>
                </button>
              </div>
            )}

            {/* OUTGOING CALL ACTIONS (Calling / Ringing) */}
            {isCalling && (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={onEndCall}
                  className="flex flex-col items-center space-y-1.5 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all">
                    <PhoneOff className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-rose-400">Cancel Call</span>
                </button>
              </div>
            )}

            {/* CONNECTED IN-CALL CONTROLS */}
            {isConnected && (
              <div className="w-full flex flex-col space-y-4">
                <div className="flex items-center justify-center space-x-3.5">
                  {/* Mute Mic Toggle */}
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      callData.isMuted
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={callData.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {callData.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Speaker / Extra Loudspeaker Toggle */}
                  <button
                    type="button"
                    onClick={onToggleSpeaker}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      callData.isSpeaker
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={callData.isSpeaker ? 'Loudspeaker On (Extra Volume)' : 'Loudspeaker Off (Normal)'}
                  >
                    {callData.isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>

                  {/* Add Member / Group Call Invite */}
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                    title="Add friend to call"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>

                  {/* End Call Button */}
                  <button
                    type="button"
                    onClick={onEndCall}
                    className="w-12 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-rose-600/30 active:scale-95"
                    title="End Call"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* ENDED STATE */}
            {isEnded && (
              <div className="py-2 text-center text-xs font-semibold text-slate-400">
                <span>Call ended</span>
              </div>
            )}
          </div>

          {/* Quick Add Member Modal */}
          {showInviteModal && (
            <div
              className="absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-md p-5 flex flex-col justify-between animate-in fade-in duration-150"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-bold text-white">Add to Voice Call</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Search friend to add..."
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="mt-3 max-h-52 overflow-y-auto space-y-1.5 divide-y divide-slate-800/60">
                  {availableFriends
                    .filter(f => {
                      const name = f.full_name || f.partner_name || f.username || '';
                      return name.toLowerCase().includes(inviteSearch.toLowerCase().trim());
                    })
                    .slice(0, 10)
                    .map(f => {
                      const fid = f.user_id || f.partner_id || f.id;
                      const isInvited = invitedIds.includes(String(fid));
                      const fname = f.full_name || f.partner_name || 'Campus Student';

                      return (
                        <div key={fid} className="pt-2 flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 shrink-0">
                              <SafeImage
                                src={f.avatar_url || f.partner_avatar || f.avatar}
                                alt={fname}
                                fallbackType="avatar"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                              {fname}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isInvited}
                            onClick={() => {
                              onInviteMember(f);
                              setInvitedIds(prev => [...prev, String(fid)]);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isInvited
                                ? 'bg-slate-800 text-slate-500'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                            }`}
                          >
                            {isInvited ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-full mt-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
