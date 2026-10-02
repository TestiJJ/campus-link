// src/components/VoiceCallModal.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  UserPlus, Users, X, Check, Loader2, Sparkles
} from 'lucide-react';
import SafeImage from './SafeImage';

export default function VoiceCallModal({
  callState, // 'idle' | 'calling' | 'ringing' | 'incoming' | 'connected' | 'ended'
  callData, // { callId, partnerId, partnerName, partnerAvatar, isCaller, duration, isMuted, isSpeaker }
  onAnswer,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
  onInviteMember,
  availableFriends = []
}) {
  const [duration, setDuration] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState([]);

  // Live in-call timer
  useEffect(() => {
    let interval = null;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 flex flex-col items-center justify-between min-h-[460px] relative overflow-hidden"
        >
          {/* Subtle Ambient Pulse Light */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Header: Call Type & Security Badge */}
          <div className="flex flex-col items-center space-y-1 relative z-10">
            <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>CampusLink Voice Call</span>
            </span>
            <p className="text-xs text-slate-400 pt-1 font-medium">
              {isIncoming && 'Incoming Voice Call...'}
              {callState === 'calling' && 'Calling...'}
              {callState === 'ringing' && 'Ringing (Recipient online)...'}
              {isConnected && `In Call • ${formatDuration(duration)}`}
              {isEnded && 'Call Ended'}
            </p>
          </div>

          {/* Center: Avatar & Ripple Animation */}
          <div className="flex flex-col items-center my-6 relative z-10">
            <div className="relative flex items-center justify-center">
              {/* Outer Ripple Rings (Visible when ringing or speaking) */}
              {(isIncoming || isCalling || isConnected) && (
                <>
                  <span className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
                  <span className="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-pulse" />
                </>
              )}

              {/* Main Avatar Container */}
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-700/80 shadow-2xl relative z-10 bg-slate-800 flex items-center justify-center">
                {partnerAvatar ? (
                  <SafeImage
                    src={partnerAvatar}
                    alt={partnerName}
                    fallbackType="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-sky-600 to-emerald-600 flex items-center justify-center text-3xl font-black text-white">
                    {partnerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-xl font-black text-white mt-5 text-center truncate max-w-[260px]">
              {partnerName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isConnected ? 'High-Definition Audio (Encrypted)' : 'Campus Peer'}
            </p>
          </div>

          {/* Bottom Action Controls */}
          <div className="w-full flex flex-col items-center space-y-4 relative z-10">
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

                {/* Answer Button (Green) */}
                <button
                  type="button"
                  onClick={onAnswer}
                  className="flex flex-col items-center space-y-1.5 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all animate-bounce">
                    <Phone className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400">Accept</span>
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
                <div className="flex items-center justify-center space-x-4">
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

                  {/* Speaker / Volume Toggle */}
                  <button
                    type="button"
                    onClick={onToggleSpeaker}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      callData.isSpeaker
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={callData.isSpeaker ? 'Speaker On' : 'Speaker Off'}
                  >
                    {callData.isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>

                  {/* Add Member / Group Call Invite */}
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                    title="Add user to call"
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
                    <Users className="w-4 h-4 text-emerald-400" />
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
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
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
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            }`}
                          >
                            {isInvited ? 'Invited' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  {availableFriends.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-6">
                      No online friends found to add.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Back to Call
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
