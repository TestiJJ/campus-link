// src/utils/useWebRtcVoiceCall.js
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  startIncomingRingtone,
  stopIncomingRingtone,
  startRingbackTone,
  stopRingbackTone,
  playConnectedTone,
  playDeclinedTone,
  playEndCallTone
} from './callSounds';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export function useWebRtcVoiceCall({
  currentUser,
  socketRef,
  onSendWsMessage,
  onLogMissedCall,
  onLogCallEnded,
  onLogCallDeclined
}) {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'incoming' | 'connected' | 'ended'
  const [callData, setCallData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const disconnectTimerRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // Stale closure guards
  const callDataRef = useRef(callData);
  useEffect(() => { callDataRef.current = callData; }, [callData]);
  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  const callDurationRef = useRef(callDuration);
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  // Web Audio booster pipeline for physical loudspeaker extra volume
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);

  const setupAudioBooster = useCallback((mediaStream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch (_) {}
      }
      sourceNodeRef.current = ctx.createMediaStreamSource(mediaStream);

      // Limiter / Compressor to avoid distortion when boosting volume
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-22, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      const gain = ctx.createGain();
      // Loudspeaker default: 2.8x extra boost!
      gain.gain.setValueAtTime(isSpeaker ? 2.8 : 0.95, ctx.currentTime);
      gainNodeRef.current = gain;

      sourceNodeRef.current.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) {
      console.warn('[WebAudio Booster] Fallback to standard audio element:', e);
    }
  }, [isSpeaker]);

  // Create or retrieve hidden audio element for remote audio playback
  useEffect(() => {
    if (!remoteAudioRef.current && typeof document !== 'undefined') {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.volume = 1.0;
      remoteAudioRef.current = audio;
      document.body.appendChild(audio);
    }
    return () => {
      if (remoteAudioRef.current && remoteAudioRef.current.parentNode) {
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
        remoteAudioRef.current = null;
      }
    };
  }, []);

  // Resume Web Audio context & ensure remote audio plays smoothly when switching apps or returning to tab
  useEffect(() => {
    const handleVisibility = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      if (remoteAudioRef.current && callStateRef.current === 'connected') {
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  // In-call duration timer
  useEffect(() => {
    let interval = null;
    if (callState === 'connected') {
      callDurationRef.current = 0;
      setCallDuration(0);
      interval = setInterval(() => {
        callDurationRef.current += 1;
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (callState === 'idle') {
      callDurationRef.current = 0;
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Cleanup helper
  const cleanUpCall = useCallback(() => {
    stopIncomingRingtone();
    stopRingbackTone();

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (_) {}
      });
      localStreamRef.current = null;
    }

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (_) {}
      sourceNodeRef.current = null;
    }

    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    pendingCandidatesRef.current = [];
    setIsMuted(false);
  }, []);

  /**
   * End an ongoing or pending call
   */
  const endCall = useCallback(() => {
    playEndCallTone();

    const activeCall = callDataRef.current;
    const dur = callDurationRef.current;

    if (activeCall && onSendWsMessage) {
      onSendWsMessage({
        type: 'end_call',
        target_user_id: activeCall.partnerId,
        call_id: activeCall.callId,
        duration: dur
      });
    }

    if (activeCall && dur > 0 && onLogCallEnded) {
      onLogCallEnded(activeCall.partnerId, dur);
    }

    cleanUpCall();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallData(null);
    }, 700);
  }, [cleanUpCall, onSendWsMessage, onLogCallEnded]);

  /**
   * Initialize a new RTCPeerConnection with audio tracks
   */
  const createPeerConnection = useCallback((partnerId, callId) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && onSendWsMessage) {
        onSendWsMessage({
          type: 'ice_candidate',
          target_user_id: partnerId,
          candidate: event.candidate,
          call_id: callId
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
      setupAudioBooster(remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        playConnectedTone();
        setCallState('connected');
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
      } else if (pc.connectionState === 'disconnected') {
        // Do NOT drop call immediately when user leaves or minimizes app!
        // Allow a 15-second grace window for mobile background reconnection
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            if (pcRef.current && (pcRef.current.connectionState === 'disconnected' || pcRef.current.connectionState === 'failed')) {
              endCall();
            }
            disconnectTimerRef.current = null;
          }, 15000);
        }
      } else if (pc.connectionState === 'failed') {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        endCall();
      }
    };

    return pc;
  }, [onSendWsMessage, setupAudioBooster, endCall]);

  /**
   * OUTGOING: Start a voice call to a partner
   */
  const startCall = useCallback(async (targetPartner) => {
    if (!targetPartner || !currentUser) return;
    const targetId = String(targetPartner.partner_id || targetPartner.user_id || targetPartner.id || '');
    if (!targetId) return;

    cleanUpCall();

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const partnerName = targetPartner.partner_name || targetPartner.name || targetPartner.full_name || 'Campus Peer';
    const partnerAvatar = targetPartner.partner_avatar || targetPartner.avatar_url || targetPartner.avatar || null;

    setCallData({
      callId,
      partnerId: targetId,
      partnerName,
      partnerAvatar,
      isCaller: true,
      isMuted: false,
      isSpeaker: true
    });
    setCallState('calling');
    startRingbackTone();

    try {
      // 1. Get microphone audio with echo cancellation & noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });
      localStreamRef.current = stream;

      // 2. Create peer connection & attach audio tracks
      const pc = createPeerConnection(targetId, callId);
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // 3. Create offer SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send call offer via WebSocket
      if (onSendWsMessage) {
        onSendWsMessage({
          type: 'call_user',
          target_user_id: targetId,
          call_id: callId,
          caller_name: currentUser.full_name || currentUser.name || 'Campus Student',
          caller_avatar: currentUser.avatar_url || currentUser.profile_picture_url || null,
          offer
        });
      }

      // 5. 35s Ringing timeout (auto-cancels and logs missed call if no answer)
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current !== 'connected') {
          playEndCallTone();
          setCallState('ended');
          if (onSendWsMessage) {
            onSendWsMessage({
              type: 'reject_call',
              caller_id: currentUser.user_id || currentUser.id,
              call_id: callId,
              reason: 'timeout'
            });
          }
          if (onLogMissedCall) onLogMissedCall(targetId);
          setTimeout(() => {
            cleanUpCall();
            setCallState('idle');
            setCallData(null);
          }, 1200);
        }
      }, 35000);
    } catch (err) {
      console.error('[WebRTC] Failed to access microphone:', err);
      alert('Microphone access is needed to make voice calls. Please enable microphone permissions in your browser settings.');
      cleanUpCall();
      setCallState('idle');
      setCallData(null);
    }
  }, [cleanUpCall, createPeerConnection, currentUser, onSendWsMessage, onLogMissedCall]);

  /**
   * INCOMING: Answer the call
   */
  const answerCall = useCallback(async () => {
    const activeCall = callDataRef.current;
    if (!activeCall || !activeCall.offer) return;
    stopIncomingRingtone();

    try {
      // 1. Request microphone audio with high-quality echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });
      localStreamRef.current = stream;

      // 2. Create peer connection
      const pc = createPeerConnection(activeCall.partnerId, activeCall.callId);
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // 3. Set remote offer & local answer
      await pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer));

      // Add any queued ICE candidates received while ringing
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 4. Send answer via WebSocket
      if (onSendWsMessage) {
        onSendWsMessage({
          type: 'accept_call',
          caller_id: activeCall.partnerId,
          call_id: activeCall.callId,
          answer,
          responder_name: currentUser?.full_name || 'Campus Peer'
        });
      }

      playConnectedTone();
      setCallState('connected');
    } catch (err) {
      console.error('[WebRTC] Failed to answer call:', err);
      rejectCall('error');
    }
  }, [createPeerConnection, currentUser, onSendWsMessage]);

  /**
   * INCOMING: Reject / Decline the call immediately
   */
  const rejectCall = useCallback((reason = 'declined') => {
    const finalReason = typeof reason === 'string' && reason ? reason : 'declined';
    stopIncomingRingtone();
    playEndCallTone();

    const activeCall = callDataRef.current;
    if (activeCall && onSendWsMessage) {
      onSendWsMessage({
        type: 'reject_call',
        caller_id: activeCall.partnerId,
        call_id: activeCall.callId,
        reason: finalReason
      });
    }

    // Dismiss immediately for recipient
    cleanUpCall();
    setCallState('idle');
    setCallData(null);
  }, [cleanUpCall, onSendWsMessage]);

  /**
   * Toggle local microphone mute
   */
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        setCallData(prev => prev ? { ...prev, isMuted: !audioTrack.enabled } : prev);
      }
    }
  }, []);

  /**
   * Toggle speakerphone extra volume
   */
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(prev => {
      const next = !prev;
      if (gainNodeRef.current && audioContextRef.current) {
        try {
          gainNodeRef.current.gain.setTargetAtTime(next ? 2.8 : 0.95, audioContextRef.current.currentTime, 0.05);
        } catch (_) {}
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? 1.0 : 0.8;
      }
      setCallData(cd => cd ? { ...cd, isSpeaker: next } : cd);
      return next;
    });
  }, []);

  // Listen for actions dispatched from system notification clicks (Answer / Decline)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'REJECT_CALL_ACTION') {
        rejectCall('declined');
      } else if (event.data.type === 'ANSWER_CALL_ACTION') {
        answerCall();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [rejectCall, answerCall]);

  /**
   * Invite another member to join current call (group voice call)
   */
  const inviteMember = useCallback((targetUser) => {
    const activeCall = callDataRef.current;
    if (!activeCall || !onSendWsMessage) return;
    const tid = String(targetUser.user_id || targetUser.partner_id || targetUser.id || '');
    if (!tid) return;

    onSendWsMessage({
      type: 'add_call_participant',
      target_user_id: tid,
      call_id: activeCall.callId,
      inviter_name: currentUser?.full_name || 'Campus Student',
      inviter_avatar: currentUser?.avatar_url || currentUser?.profile_picture_url || null
    });
  }, [currentUser, onSendWsMessage]);

  /**
   * Main WebSocket Event Dispatcher for Incoming Signaling Messages
   */
  const handleSignalingMessage = useCallback(async (data) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'incoming_call': {
        // Someone is calling current user
        cleanUpCall();
        setCallData({
          callId: data.call_id,
          partnerId: data.caller_id,
          partnerName: data.caller_name || 'Campus Peer',
          partnerAvatar: data.caller_avatar || null,
          offer: data.offer,
          isCaller: false,
          isMuted: false,
          isSpeaker: true
        });
        setCallState('incoming');
        startIncomingRingtone();

        // System notification if browser is minimized or in background
        if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
          if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(`📞 Incoming Call from ${data.caller_name || 'CampusLink Peer'}`, {
                body: 'CampusLink Voice Call · Tap to answer or open call',
                icon: data.caller_avatar || '/pwa-192x192.png',
                badge: '/pwa-icon.svg',
                tag: `campuslink-call-${data.call_id}`,
                requireInteraction: true,
                renotify: true,
                vibrate: [500, 250, 500, 250, 500, 250, 500],
                actions: [
                  { action: 'answer', title: '📞 Answer' },
                  { action: 'decline', title: '❌ Decline' }
                ],
                data: {
                  url: window.location.href,
                  call_id: data.call_id
                }
              });
            }).catch(() => {});
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`📞 Incoming Call from ${data.caller_name || 'CampusLink Peer'}`, {
                body: 'CampusLink Voice Call · Tap to answer',
                icon: data.caller_avatar || '/pwa-192x192.png',
                requireInteraction: true,
                tag: `campuslink-call-${data.call_id}`
              });
            } catch (_) {}
          }
        }
        break;
      }

      case 'call_ringing': {
        // Server confirms recipient device is ringing
        setCallState('ringing');
        break;
      }

      case 'call_accepted': {
        // Recipient picked up the call!
        stopRingbackTone();
        if (pcRef.current && data.answer) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            // Add any queued candidates
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
            }
          } catch (err) {
            console.error('[WebRTC] Error setting remote description:', err);
          }
        }
        playConnectedTone();
        setCallState('connected');
        break;
      }

      case 'call_target_offline': {
        // Target is not online
        stopRingbackTone();
        playEndCallTone();
        alert(`${callDataRef.current?.partnerName || 'User'} is currently offline.`);
        setCallState('ended');
        setTimeout(() => {
          cleanUpCall();
          setCallState('idle');
          setCallData(null);
        }, 800);
        break;
      }

      case 'call_rejected': {
        // Recipient declined or timed out
        stopRingbackTone();
        playDeclinedTone();

        const activeCall = callDataRef.current;
        const partner = activeCall?.partnerName || 'User';
        const isDecline = !data.reason || data.reason === 'declined';
        const endReason = isDecline
          ? `${partner} declined the call`
          : (data.reason === 'busy' ? `${partner} is on another call` : 'Call timed out');

        setCallData(prev => prev ? { ...prev, endReason, isDeclined: true } : prev);
        setCallState('ended');

        if (activeCall && onLogCallDeclined && isDecline) {
          onLogCallDeclined(activeCall.partnerId);
        }

        // Keep modal visible for 2.5s so caller clearly hears tone and sees "Call Declined"
        setTimeout(() => {
          cleanUpCall();
          setCallState('idle');
          setCallData(null);
        }, 2500);
        break;
      }

      case 'ice_candidate': {
        if (data.candidate) {
          if (pcRef.current && pcRef.current.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.error('[WebRTC] Error adding ICE candidate:', e);
            }
          } else {
            // Queue until remote description is set
            pendingCandidatesRef.current.push(data.candidate);
          }
        }
        break;
      }

      case 'call_ended': {
        // Remote party hung up
        stopIncomingRingtone();
        stopRingbackTone();
        playEndCallTone();
        const finalDur = Number(data.duration) || callDurationRef.current;
        const activeCall = callDataRef.current;
        if (activeCall && finalDur > 0 && onLogCallEnded) {
          onLogCallEnded(activeCall.partnerId, finalDur);
        }
        cleanUpCall();
        setCallState('ended');
        setTimeout(() => {
          setCallState('idle');
          setCallData(null);
        }, 800);
        break;
      }

      case 'incoming_group_call_invite': {
        // Group invite received
        if (window.confirm(`${data.inviter_name || 'A friend'} invited you to join a voice call. Join now?`)) {
          startCall({
            partner_id: data.inviter_id,
            partner_name: data.inviter_name,
            partner_avatar: data.inviter_avatar
          });
        }
        break;
      }

      default:
        break;
    }
  }, [cleanUpCall, playConnectedTone, playEndCallTone, startCall, onLogCallEnded, onLogCallDeclined]);

  return {
    callState,
    callData,
    callDuration,
    isMuted,
    isSpeaker,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    inviteMember,
    handleSignalingMessage
  };
}
