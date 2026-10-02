// src/utils/useWebRtcVoiceCall.js
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  startIncomingRingtone,
  stopIncomingRingtone,
  startRingbackTone,
  stopRingbackTone,
  playConnectedTone,
  playEndCallTone
} from './callSounds';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function useWebRtcVoiceCall({ currentUser, socketRef, onSendWsMessage, onLogMissedCall }) {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'incoming' | 'connected' | 'ended'
  const [callData, setCallData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // Create or retrieve hidden audio element for remote audio playback
  useEffect(() => {
    if (!remoteAudioRef.current && typeof document !== 'undefined') {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
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

  // Cleanup helper
  const cleanUpCall = useCallback(() => {
    stopIncomingRingtone();
    stopRingbackTone();

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (_) {}
      });
      localStreamRef.current = null;
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
      if (event.streams && event.streams[0]) {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        playConnectedTone();
        setCallState('connected');
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, [onSendWsMessage]);

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
      // 1. Get microphone audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
        if (callState !== 'connected') {
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
          }, 1500);
        }
      }, 35000);
    } catch (err) {
      console.error('[WebRTC] Failed to access microphone:', err);
      alert('Microphone access is needed to make voice calls. Please enable microphone permissions in your browser settings.');
      cleanUpCall();
      setCallState('idle');
      setCallData(null);
    }
  }, [cleanUpCall, createPeerConnection, currentUser, onSendWsMessage, onLogMissedCall, callState]);

  /**
   * INCOMING: Answer the call
   */
  const answerCall = useCallback(async () => {
    if (!callData || !callData.offer) return;
    stopIncomingRingtone();

    try {
      // 1. Request microphone audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // 2. Create peer connection
      const pc = createPeerConnection(callData.partnerId, callData.callId);
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // 3. Set remote offer & local answer
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

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
          caller_id: callData.partnerId,
          call_id: callData.callId,
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
  }, [callData, createPeerConnection, currentUser, onSendWsMessage]);

  /**
   * INCOMING: Reject / Decline the call
   */
  const rejectCall = useCallback((reason = 'declined') => {
    stopIncomingRingtone();
    playEndCallTone();

    if (callData && onSendWsMessage) {
      onSendWsMessage({
        type: 'reject_call',
        caller_id: callData.partnerId,
        call_id: callData.callId,
        reason
      });
    }

    setCallState('ended');
    setTimeout(() => {
      cleanUpCall();
      setCallState('idle');
      setCallData(null);
    }, 1200);
  }, [callData, cleanUpCall, onSendWsMessage]);

  /**
   * End an ongoing or pending call
   */
  const endCall = useCallback(() => {
    playEndCallTone();

    if (callData && onSendWsMessage) {
      onSendWsMessage({
        type: 'end_call',
        target_user_id: callData.partnerId,
        call_id: callData.callId
      });
    }

    setCallState('ended');
    setTimeout(() => {
      cleanUpCall();
      setCallState('idle');
      setCallData(null);
    }, 1200);
  }, [callData, cleanUpCall, onSendWsMessage]);

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
   * Toggle speaker
   */
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(prev => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? 1.0 : 0.4;
      }
      setCallData(cd => cd ? { ...cd, isSpeaker: next } : cd);
      return next;
    });
  }, []);

  /**
   * Invite another member to join current call (group voice call)
   */
  const inviteMember = useCallback((targetUser) => {
    if (!callData || !onSendWsMessage) return;
    const tid = String(targetUser.user_id || targetUser.partner_id || targetUser.id || '');
    if (!tid) return;

    onSendWsMessage({
      type: 'add_call_participant',
      target_user_id: tid,
      call_id: callData.callId,
      inviter_name: currentUser?.full_name || 'Campus Student',
      inviter_avatar: currentUser?.avatar_url || currentUser?.profile_picture_url || null
    });
  }, [callData, currentUser, onSendWsMessage]);

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
        alert(`${callData?.partnerName || 'User'} is currently offline.`);
        setCallState('ended');
        setTimeout(() => {
          cleanUpCall();
          setCallState('idle');
          setCallData(null);
        }, 1200);
        break;
      }

      case 'call_rejected': {
        // Recipient declined or timed out
        stopRingbackTone();
        playEndCallTone();
        setCallState('ended');
        setTimeout(() => {
          cleanUpCall();
          setCallState('idle');
          setCallData(null);
        }, 1200);
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
        setCallState('ended');
        setTimeout(() => {
          cleanUpCall();
          setCallState('idle');
          setCallData(null);
        }, 1200);
        break;
      }

      case 'incoming_group_call_invite': {
        // Group invite received
        if (window.confirm(`${data.inviter_name || 'A friend'} invited you to join a voice call. Join now?`)) {
          // If already in call, switch or connect
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
  }, [cleanUpCall, playConnectedTone, playEndCallTone, startCall, callData]);

  return {
    callState,
    callData,
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
