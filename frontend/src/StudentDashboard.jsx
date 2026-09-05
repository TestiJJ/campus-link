// src/StudentDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Video, Navigation, MessageSquare, User,
  LogOut, Search, Heart, Plus, ShieldCheck,
  Phone, MapPin, Send, Utensils, CheckCircle2,
  Clock, AlertCircle, Sparkles, X, Camera,
  Building2, Users, Wrench, Share2, Upload, MessageCircle,
  UserPlus, UserCheck, UserX, Eye, Mail, Star, Laptop, BookOpen, Scissors,
  Trash2, KeyRound, Lock, Edit3, GraduationCap, Compass, ExternalLink, AlertTriangle,
  Mic, MicOff, Play, Pause, Paperclip, Image as ImageIcon, Film, Volume2,
  Bell, Megaphone, ChevronLeft, ChevronRight, FileText, Settings, Check, CheckCheck, Sliders, EyeOff,
  MoreVertical, Copy, Flag, Bot, Brain, Bookmark, RefreshCw, Reply
} from 'lucide-react';
import API, { uploadFile, getMediaUrl, getWsUrl, getAuthToken, isAuthenticated } from './api';
import SafeImage from './components/SafeImage';
import StoryReplyBubble, { parseStatusReply } from './components/StoryReplyBubble';
import InAppChatBanner, { playChatNotificationSound } from './components/InAppChatBanner';
import MediaPreviewEditorModal from './components/MediaPreviewEditorModal';
import {
  getCachedThreadMessages,
  setCachedThreadMessages,
  mergeThreadMessages,
  appendThreadMessage,
  updateThreadMessage,
  primeConversationsCache,
  revalidateThreadMessages,
  smartScrollToBottom,
  isUserNearBottom
} from './chatCache';

// Aliases for compatibility
const getCachedChatMessages = getCachedThreadMessages;
const setCachedChatMessages = setCachedThreadMessages;
const prefetchRecentConversations = primeConversationsCache;

const renderCategoryIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('food') || n.includes('meal') || n.includes('snack')) return <Utensils className="w-3.5 h-3.5" />;
  if (n.includes('fashion') || n.includes('shoe') || n.includes('thrift')) return <ShoppingBag className="w-3.5 h-3.5" />;
  if (n.includes('laptop') || n.includes('gadget') || n.includes('tech')) return <Laptop className="w-3.5 h-3.5" />;
  if (n.includes('academic') || n.includes('book') || n.includes('stationery')) return <BookOpen className="w-3.5 h-3.5" />;
  if (n.includes('laundry') || n.includes('clean')) return <Sparkles className="w-3.5 h-3.5" />;
  if (n.includes('photo') || n.includes('media')) return <Camera className="w-3.5 h-3.5" />;
  if (n.includes('repair') || n.includes('skill')) return <Wrench className="w-3.5 h-3.5" />;
  if (n.includes('hair') || n.includes('beauty')) return <Scissors className="w-3.5 h-3.5" />;
  return <ShoppingBag className="w-3.5 h-3.5" />;
};


// Stale-While-Revalidate Caching Utilities
const getCachedData = (key, fallback) => {
  try {
    const raw = localStorage.getItem(`cl_cache_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setCachedData = (key, value) => {
  try {
    localStorage.setItem(`cl_cache_${key}`, JSON.stringify(value));
  } catch {}
};

// Chat Reply Parser for Quoted Messages
export const parseChatReply = (msg) => {
  if (!msg) return null;
  const content = msg.content || msg.text || '';
  if (
    msg.message_type === 'reply' ||
    (typeof content === 'string' && content.trim().startsWith('{') && content.includes('"type":"chat_reply"'))
  ) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (parsed && parsed.type === 'chat_reply') {
        return {
          isChatReply: true,
          replyToId: parsed.reply_to_id,
          replyToSender: parsed.reply_to_sender || 'Campus Peer',
          replyToText: parsed.reply_to_text || '',
          text: parsed.text || ''
        };
      }
    } catch {
      return null;
    }
  }
  return null;
};

// Safe Date and Time Formatters (Prevents RangeError on iOS Safari / WebKit)
const safeTime = (dateStr, fallback = 'Recently') => {
  if (!dateStr) return fallback;
  try {
    let cleanStr = typeof dateStr === 'string' ? dateStr.trim() : dateStr;
    if (typeof cleanStr === 'string' && !cleanStr.endsWith('Z') && !cleanStr.includes('+') && !cleanStr.includes('-', 10)) {
      cleanStr += 'Z';
    }
    const d = new Date(typeof cleanStr === 'string' && cleanStr.includes(' ') ? cleanStr.replace(' ', 'T') : cleanStr);
    return isNaN(d.getTime()) ? fallback : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return fallback;
  }
};

const safeDate = (dateStr, fallback = 'Recent') => {
  if (!dateStr) return fallback;
  try {
    let cleanStr = typeof dateStr === 'string' ? dateStr.trim() : dateStr;
    if (typeof cleanStr === 'string' && !cleanStr.endsWith('Z') && !cleanStr.includes('+') && !cleanStr.includes('-', 10)) {
      cleanStr += 'Z';
    }
    const d = new Date(typeof cleanStr === 'string' && cleanStr.includes(' ') ? cleanStr.replace(' ', 'T') : cleanStr);
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return fallback;
  }
};

// Presence: format accurate last seen or active now (with rock-solid UTC timezone handling)
const formatLastSeen = (lastSeenIso, isOnline) => {
  if (isOnline) return { label: 'Active now', online: true };
  if (!lastSeenIso) return { label: 'Offline', online: false };
  try {
    let raw = String(lastSeenIso).trim();
    let iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
    // Naive timestamps from server are UTC
    if (!iso.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(iso)) {
      iso += 'Z';
    }
    const targetDate = new Date(iso);
    if (isNaN(targetDate.getTime())) return { label: 'Offline', online: false };

    let diffMs = Date.now() - targetDate.getTime();
    // Allow slight tolerance if client clock is slightly behind server
    if (diffMs < 120000 && diffMs > -180000) return { label: 'Active now', online: true };
    if (diffMs < 0) diffMs = 0;

    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return { label: 'Active now', online: true };
    if (diffMin < 60) return { label: `Last seen ${diffMin}m ago`, online: false };
    if (diffHr < 24) return { label: `Last seen ${diffHr}h ago`, online: false };
    if (diffHr < 48) return { label: 'Last seen yesterday', online: false };
    const opts = { day: 'numeric', month: 'short' };
    return { label: `Last seen ${targetDate.toLocaleDateString([], opts)}`, online: false };
  } catch {
    return { label: 'Offline', online: false };
  }
};

// URL and localStorage tab persistence
const getInitialStudentTab = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['marketplace', 'reels', 'campus', 'messages', 'profile'].includes(tabParam)) {
      return tabParam;
    }
    const saved = localStorage.getItem('campuslink_student_tab');
    if (saved && ['marketplace', 'reels', 'campus', 'messages', 'profile'].includes(saved)) {
      return saved;
    }
  } catch {}
  return 'marketplace';
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    const cached = getCachedData('student_user', null);
    if (cached) return cached;
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState(getInitialStudentTab);
  
  // Marketplace State
  const [marketType, setMarketType] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('marketType');
      if (p === 'services' || p === 'products') return p;
    } catch {}
    return 'products';
  });
  const [products, setProducts] = useState(() => getCachedData('products', []));
  const [services, setServices] = useState(() => getCachedData('services', []));
  const [categories, setCategories] = useState(() => getCachedData('categories', []));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Instant render: zero-delay load if cached products/categories are already present
  const [loading, setLoading] = useState(() => {
    const cachedProds = getCachedData('products', []);
    const cachedCats = getCachedData('categories', []);
    return !(cachedProds.length > 0 || cachedCats.length > 0);
  });

  // Reels State
  const [reels, setReels] = useState(() => getCachedData('reels', []));
  const [reelText, setReelText] = useState('');
  const [reelLocation, setReelLocation] = useState('Campus Hub');
  const [detectingGps, setDetectingGps] = useState(false);
  const [reelFile, setReelFile] = useState(null);
  const [reelPreview, setReelPreview] = useState(null);
  const [reelPosting, setReelPosting] = useState(false);
  const [activeCommentsReelId, setActiveCommentsReelId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [postingComment, setPostingComment] = useState(false);
  const [activePostMenuId, setActivePostMenuId] = useState(null);
  const [hiddenPostIds, setHiddenPostIds] = useState([]);
  const reelFileInputRef = useRef(null);
  const commentInputRef = useRef(null);

  // Synchronize activeTab and marketType with browser URL and localStorage
  useEffect(() => {
    try {
      localStorage.setItem('campuslink_student_tab', activeTab);
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        if (activeTab === 'marketplace' && marketType) {
          url.searchParams.set('marketType', marketType);
        } else {
          url.searchParams.delete('marketType');
        }
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [activeTab, marketType]);

  // Support browser Back/Forward navigation between tabs
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && ['marketplace', 'reels', 'campus', 'messages', 'profile'].includes(tab)) {
          setActiveTab(tab);
        }
        const mt = params.get('marketType');
        if (mt === 'products' || mt === 'services') {
          setMarketType(mt);
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // Campus Notice Board & Lost/Found State (SWR Instant Load)
  const [notices, setNotices] = useState(() => getCachedData('notices', []));
  const [activeNoticeMenuId, setActiveNoticeMenuId] = useState(null);
  const [noticeType, setNoticeType] = useState('all'); // 'all' | 'lost' | 'found' | 'announcement'
  const [noticeCategory, setNoticeCategory] = useState('all');
  const [noticeSearch, setNoticeSearch] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [newNoticeForm, setNewNoticeForm] = useState({
    type: 'lost',
    title: '',
    category: 'id_card',
    description: '',
    location: '',
    date_lost_or_found: '',
    contact_phone: '',
    image_url: ''
  });
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [universityName, setUniversityName] = useState('University Campus');

  // WhatsApp-Style Campus Status State (SWR Instant Load)
  const [statusGroups, setStatusGroups] = useState(() => getCachedData('statusGroups', []));
  const [activeStatusViewer, setActiveStatusViewer] = useState(null); // { userIdx: 0, itemIdx: 0 }
  const [createStatusModalOpen, setCreateStatusModalOpen] = useState(false);
  const [statusMode, setStatusMode] = useState('media'); // 'media' | 'text'
  const [statusMediaFile, setStatusMediaFile] = useState(null);
  const [statusMediaPreview, setStatusMediaPreview] = useState(null);
  const [newStatusForm, setNewStatusForm] = useState({
    media_type: 'image',
    caption: '',
    background_color: 'from-emerald-600 to-teal-800',
    media_url: ''
  });
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [statusReplyText, setStatusReplyText] = useState('');
  const statusFileInputRef = useRef(null);

  // WhatsApp Story Privacy & Viewers State
  const [statusPrivacy, setStatusPrivacy] = useState('friends'); // 'friends' | 'campus' | 'custom'
  const [statusPrivacyModalOpen, setStatusPrivacyModalOpen] = useState(false);
  const [selectedAudienceFriends, setSelectedAudienceFriends] = useState([]);
  const [statusViewersModalOpen, setStatusViewersModalOpen] = useState(false);
  const [activeStoryViewers, setActiveStoryViewers] = useState([]);

  // Chat Voice Notes (VN) & Media State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const chatMediaInputRef = useRef(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const chatAudioElementRef = useRef(null);

  // Messages, Friends & Social Graph State (SWR Instant Load)
  const [messageSubtab, setMessageSubtab] = useState('chats'); // 'chats' | 'friends' | 'requests' | 'my_friends'
  const [conversations, setConversations] = useState(() => getCachedData('conversations', []));
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [inAppBanner, setInAppBanner] = useState(null);
  const selectedPartnerRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  const isSwitchingPartnerRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);

  // Chat Swipe-to-Reply State
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [pendingMediaFile, setPendingMediaFile] = useState(null);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const chatInputRef = useRef(null);

  useEffect(() => {
    selectedPartnerRef.current = selectedPartner;
  }, [selectedPartner]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // --- PRESENCE HEARTBEAT ---
  // Sends a heartbeat every 30 s so the backend knows we are online.
  // Also fires an offline signal when the tab is hidden or closed.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let isCancelled = false;
    let interval = null;

    const sendHeartbeat = () => {
      if (isCancelled || !getAuthToken()) return;
      API.post('/presence/heartbeat').catch((err) => {
        if (err?.response?.status === 401) {
          isCancelled = true;
          if (interval) clearInterval(interval);
        }
      });
    };
    const sendOffline = () => {
      const activeToken = getAuthToken();
      if (!activeToken) return;
      // fetch with keepalive:true survives page unload and supports Bearer auth
      const baseUrl = (API.defaults.baseURL || '').replace(/\/api$/, '');
      const offlineUrl = `${baseUrl}/api/presence/offline`;
      fetch(offlineUrl, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`,
        },
        body: JSON.stringify({}),
      }).catch(() => {});
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') sendOffline();
      else sendHeartbeat();
    };

    sendHeartbeat(); // mark online immediately on mount
    interval = setInterval(sendHeartbeat, 30000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', sendOffline);

    return () => {
      isCancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', sendOffline);
      sendOffline(); // mark offline on component unmount (logout)
    };
  }, []);

  // Chat auto-scroll helpers: Instant on open, smooth on new message
  const scrollToChatBottom = (instant = true) => {
    if (chatContainerRef.current) {
      if (instant) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      } else {
        try {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        } catch {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }
    }
  };

  // Instant snap to bottom on partner selection or messages update (shows most recent chat)
  useEffect(() => {
    if (selectedPartner) {
      const snap = () => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      };
      snap();
      const r1 = requestAnimationFrame(snap);
      const t1 = setTimeout(snap, 30);
      const t2 = setTimeout(snap, 100);
      const t3 = setTimeout(snap, 250);
      const t4 = setTimeout(snap, 600);
      const t5 = setTimeout(() => {
        snap();
        isSwitchingPartnerRef.current = false;
      }, 1000);
      return () => {
        cancelAnimationFrame(r1);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, [selectedPartner?.partner_id, chatMessages]);

  // DOM observer to keep chat pinned to recent messages as photos/media elements load
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
      if (isNearBottom || isSwitchingPartnerRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el, { childList: true, subtree: true, attributes: true });
    return () => {
      observer.disconnect();
    };
  }, [selectedPartner?.partner_id]);

  // Real-time WebSocket connection for instant chat delivery & floating banner alerts
  useEffect(() => {
    if (!currentUser?.user_id || !getAuthToken()) return;
    let socket = null;
    let pingInterval = null;
    let reconnectTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let isMounted = true;

    const clearTimers = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const connectWs = () => {
      if (!isMounted) return;
      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        return;
      }
      clearTimers();

      try {
        const wsUrl = getWsUrl(`/ws/${currentUser.user_id}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          retryCount = 0; // Successfully connected, reset retry counter
          pingInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: 'ping' }));
              } catch (_) {}
            }
          }, 35000); // 35-second keepalive heartbeat for Render proxy
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') return; // Heartbeat response

            if (data.type === 'new_message' && data.message) {
              const newM = data.message;
              const isFromMe = newM.sender_id === currentUser.user_id;

              // Immediately append to thread cache
              appendThreadMessage(newM.sender_id, newM);
              appendThreadMessage(newM.recipient_id, newM);

              if (!isFromMe) {
                const isCurrentChatOpen = selectedPartnerRef.current && 
                  String(selectedPartnerRef.current.partner_id) === String(newM.sender_id) &&
                  activeTabRef.current === 'messages';

                if (isCurrentChatOpen) {
                  setChatMessages(prev => {
                    if (prev.some(m => m.id === newM.id)) return prev;
                    return [...prev, newM];
                  });
                  if (isUserNearBottom(chatContainerRef.current)) {
                    smartScrollToBottom(chatContainerRef.current, true);
                  }
                } else {
                  // Pop up in-app notification banner across Reels, Marketplace, etc.
                  setInAppBanner({
                    id: newM.id || Date.now(),
                    senderId: newM.sender_id,
                    senderName: data.sender_name || 'Campus Peer',
                    senderAvatar: data.sender_avatar,
                    senderRole: data.sender_role,
                    text: newM.message_type === 'audio' ? '🎤 Voice note' : (newM.content || 'Sent a photo/video'),
                    timestamp: Date.now()
                  });
                  playChatNotificationSound();

                  // Immediately increment unread count in conversations state
                  setConversations(prev => {
                    const existing = prev.find(c => String(c.partner_id) === String(newM.sender_id));
                    if (existing) {
                      return prev.map(c => String(c.partner_id) === String(newM.sender_id) ? {
                        ...c,
                        unread_count: (c.unread_count || 0) + 1,
                        last_message: newM.content || 'New message',
                        last_timestamp: newM.created_at
                      } : c);
                    } else {
                      return [{
                        partner_id: newM.sender_id,
                        partner_name: data.sender_name || 'Campus Peer',
                        partner_avatar: data.sender_avatar,
                        partner_role: data.sender_role || 'Student',
                        is_friend: true,
                        unread_count: 1,
                        last_message: newM.content || 'New message',
                        last_timestamp: newM.created_at
                      }, ...prev];
                    }
                  });
                }
              }
            }
          } catch (err) {
            // Suppress error storms
          }
        };

        socket.onclose = () => {
          clearTimers();
          if (!isMounted) return;

          if (retryCount < MAX_RETRIES) {
            // Exponential backoff with jitter: 2s, ~4s, ~8s, ~16s, max 30s
            const backoffMs = Math.min(30000, 2000 * Math.pow(1.8, retryCount) + Math.random() * 800);
            retryCount++;
            reconnectTimeout = setTimeout(connectWs, backoffMs);
          }
        };

        socket.onerror = () => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.close(); } catch (_) {}
          }
        };
      } catch (err) {
        // Fall back gracefully to polling
      }
    };

    const handleReconnectTrigger = () => {
      if (!isMounted) return;
      retryCount = 0;
      connectWs();
    };

    window.addEventListener('online', handleReconnectTrigger);
    window.addEventListener('focus', handleReconnectTrigger);

    connectWs();

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleReconnectTrigger);
      window.removeEventListener('focus', handleReconnectTrigger);
      clearTimers();
      if (socket) {
        try {
          socket.onclose = null;
          socket.onerror = null;
          socket.close();
        } catch (_) {}
      }
    };
  }, [currentUser?.user_id]);

  const handleReplyFromBanner = (senderId) => {
    setInAppBanner(null);
    setActiveTab('messages');
    setMessageSubtab('chats');
    const existing = conversations.find(c => String(c.partner_id) === String(senderId));
    if (existing) {
      handleSelectPartner(existing);
    } else {
      const partner = { partner_id: senderId, partner_name: 'Campus Peer' };
      handleSelectPartner(partner);
    }
  };

  // Unread badge helpers across multi-profile views
  const getUnreadCountForUser = (userId) => {
    if (!userId || !conversations?.length) return 0;
    const conv = conversations.find(c => String(c.partner_id) === String(userId));
    return conv?.unread_count || 0;
  };

  const totalUnreadChatCount = (conversations || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const otherUnreadChatCount = (conversations || []).reduce((acc, c) => {
    if (selectedPartner && String(c.partner_id) === String(selectedPartner.partner_id)) return acc;
    return acc + (c.unread_count || 0);
  }, 0);

  // WhatsApp-style browser tab title badge for unread chats
  useEffect(() => {
    const prefix = totalUnreadChatCount > 0 ? `(${totalUnreadChatCount}) ` : '';
    document.title = `${prefix}CampusLink - Student Portal`;
    return () => {
      document.title = 'CampusLink - Student Portal';
    };
  }, [totalUnreadChatCount]);

  // Mobile back button / swipe gesture support (WhatsApp-style back navigation)
  useEffect(() => {
    if (!selectedPartner) return;
    const handlePopState = () => {
      setSelectedPartner(null);
    };
    try {
      window.history.pushState({ chatOpen: true }, '', window.location.href);
    } catch {}
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedPartner]);

  // My AI & Memory Vault State (SWR Instant Load)
  const [aiMessages, setAiMessages] = useState([]);
  const [aiMemories, setAiMemories] = useState(() => getCachedData('aiMemories', []));
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [newMemoryForm, setNewMemoryForm] = useState({ title: '', content: '', category: 'academic' });
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [storeInfoToggled, setStoreInfoToggled] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  // Campus Community Directory & Friends (SWR Instant Load)
  const [communityUsers, setCommunityUsers] = useState(() => getCachedData('communityUsers', []));
  const [friendsFilter, setFriendsFilter] = useState('all'); // 'all' | 'students' | 'sellers'
  const [campusStudents, setCampusStudents] = useState(() => getCachedData('campusStudents', []));
  const [myFriends, setMyFriends] = useState(() => getCachedData('myFriends', []));
  const [pendingRequests, setPendingRequests] = useState(() => getCachedData('pendingRequests', []));
  const [studentSearch, setStudentSearch] = useState('');

  // Student Profile Modal State
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Orders State (SWR Instant Load)
  const [orderModalItem, setOrderModalItem] = useState(null);
  const [orderDeliveryLocation, setOrderDeliveryLocation] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [myOrders, setMyOrders] = useState(() => getCachedData('myOrders', []));

  // Profile Settings State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    bio: '',
    phone_number: '',
    department: '',
    level: '',
    hostel: '',
    current_password: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const avatarInputRef = useRef(null);

  const [notifications, setNotifications] = useState(() => getCachedData('notifications', []));
  const [unreadCount, setUnreadCount] = useState(() => getCachedData('unreadCount', 0));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'social' | 'orders'

  // Mobile back button & Escape key support for notification slide-over drawer
  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePopState = () => {
      setNotificationsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setNotificationsOpen(false);
      }
    };
    try {
      window.history.pushState({ notifDrawerOpen: true }, '', window.location.href);
    } catch {}
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen]);

  // New User Profile Completion Prompt State (only shows for new accounts)
  const [showNewUserModal, setShowNewUserModal] = useState(() => {
    try {
      if (localStorage.getItem('campuslink_show_profile_completion_prompt') === 'true') {
        return true;
      }
      if (localStorage.getItem('campuslink_dismissed_profile_prompt') === 'true') {
        return false;
      }
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        const isIncomplete = !u.department || !u.hostel || !u.phone_number;
        if (u.created_at) {
          const createdTime = new Date(u.created_at).getTime();
          const isRecent = (Date.now() - createdTime) < 48 * 3600 * 1000;
          if (isRecent && isIncomplete) return true;
        }
      }
    } catch {}
    return false;
  });


  // Feedback Toast
  const [toast, setToast] = useState({ text: '', type: '' });

  const loadAllData = async () => {
    // Only show full skeleton spinner if we don't already have cached items on screen
    if (products.length === 0 && services.length === 0) {
      setLoading(true);
    }
    try {
      const [prodRes, svcRes, catRes, reelsRes, convRes, notRes, statRes, commRes, reqRes, friendsRes, studRes, notifRes, meRes, ordersRes, memsRes] = await Promise.all([
        API.get('/products').catch(err => { console.warn('Products fetch error:', err); return { data: [] }; }),
        API.get('/services').catch(err => { console.warn('Services fetch error:', err); return { data: [] }; }),
        API.get('/categories').catch(err => { console.warn('Categories fetch error:', err); return { data: [] }; }),
        API.get('/reels').catch(err => { console.warn('Reels fetch error:', err); return { data: [] }; }),
        API.get('/conversations').catch(err => { console.warn('Conversations fetch error:', err); return { data: [] }; }),
        API.get('/campus/notices').catch(err => { console.warn('Notices fetch error:', err); return { data: [] }; }),
        API.get('/campus/statuses').catch(err => { console.warn('Statuses fetch error:', err); return { data: [] }; }),
        API.get('/community/users').catch(err => { console.warn('Community fetch error:', err); return { data: [] }; }),
        API.get('/friends/requests/pending').catch(err => { console.warn('Requests fetch error:', err); return { data: [] }; }),
        API.get('/friends').catch(err => { console.warn('Friends fetch error:', err); return { data: [] }; }),
        API.get('/students').catch(err => { console.warn('Students fetch error:', err); return { data: [] }; }),
        API.get('/notifications').catch(() => ({ data: [] })),
        API.get('/me').catch(() => ({ data: null })),
        API.get('/orders/my').catch(() => ({ data: [] })),
        API.get('/ai/memories').catch(() => ({ data: [] }))
      ]);
      const fetchedProds = prodRes.data || [];
      const fetchedSvcs = svcRes.data || [];
      const fetchedCats = catRes.data || [];
      const fetchedReels = reelsRes.data || [];

      setProducts(fetchedProds);
      setServices(fetchedSvcs);
      setCategories(fetchedCats);
      setReels(fetchedReels);

      // Persist to local cache for instant reload
      setCachedData('products', fetchedProds);
      setCachedData('services', fetchedSvcs);
      setCachedData('categories', fetchedCats);
      setCachedData('reels', fetchedReels);
      const fetchedConvs = convRes.data || [];
      const fetchedNotices = notRes.data || [];
      const fetchedStatuses = statRes.data || [];
      const fetchedCommunity = commRes.data || [];
      const fetchedRequests = reqRes.data || [];
      const fetchedFriends = friendsRes.data || [];
      const fetchedStudents = studRes.data || commRes.data || [];
      const fetchedOrders = ordersRes.data || [];
      const fetchedMemories = memsRes.data || [];

      setConversations(fetchedConvs);
      setNotices(fetchedNotices);
      setStatusGroups(fetchedStatuses);
      setCommunityUsers(fetchedCommunity);
      setPendingRequests(fetchedRequests);
      setMyFriends(fetchedFriends);
      setCampusStudents(fetchedStudents);
      setMyOrders(fetchedOrders);
      setAiMemories(fetchedMemories);

      // Instantly prefetch top conversations in the background for 0ms chat loading
      prefetchRecentConversations(fetchedConvs);

      setCachedData('conversations', fetchedConvs);
      setCachedData('notices', fetchedNotices);
      setCachedData('statusGroups', fetchedStatuses);
      setCachedData('communityUsers', fetchedCommunity);
      setCachedData('pendingRequests', fetchedRequests);
      setCachedData('myFriends', fetchedFriends);
      setCachedData('campusStudents', fetchedStudents);
      setCachedData('myOrders', fetchedOrders);
      setCachedData('aiMemories', fetchedMemories);

      const notifs = notifRes.data?.notifications || (Array.isArray(notifRes.data) ? notifRes.data : []);
      const unread = notifRes.data?.unread_count ?? notifs.filter(n => !n.is_read).length;
      setNotifications(notifs);
      setUnreadCount(unread);
      setCachedData('notifications', notifs);
      setCachedData('unreadCount', unread);

      if (meRes?.data) {
        const u = meRes.data;
        setCurrentUser(u);
        localStorage.setItem('user', JSON.stringify(u));
        setProfileForm({
          full_name: u.full_name || '',
          bio: u.bio || '',
          phone_number: u.phone_number || '',
          department: u.department || '',
          level: u.level || '',
          hostel: u.hostel || '',
          current_password: ''
        });
      }
    } catch (err) {
      console.error('Error fetching campus data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await API.get('/notifications');
      const list = res.data?.notifications || (Array.isArray(res.data) ? res.data : []);
      const unread = res.data?.unread_count ?? list.filter(n => !n.is_read).length;
      setNotifications(list);
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await API.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await API.post(`/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
    setNotificationsOpen(false);
    const t = (notif.notification_type || notif.type || '').toLowerCase();
    if (t.includes('reel') || t.includes('like') || t.includes('comment') || t === 'status_view') {
      setActiveTab('reels');
    } else if (t.includes('friend') || t === 'message') {
      setActiveTab('messages');
      if (t === 'friend_request') setMessageSubtab('requests');
      else if (t === 'friend_accept') setMessageSubtab('my_friends');
    } else if (t.includes('notice') || t.includes('lost') || t.includes('found')) {
      setActiveTab('campus');
    } else if (t.includes('order') || t.includes('service')) {
      setActiveTab('marketplace');
      if (t.includes('service')) setMarketType('services');
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(storedUser);
      setCurrentUser(parsed);
      setOrderDeliveryLocation(parsed.hostel || 'Hostel Room');
      setProfileForm({
        full_name: parsed.full_name || '',
        bio: parsed.bio || '',
        phone_number: parsed.phone_number || '',
        department: parsed.department || '',
        level: parsed.level || '',
        hostel: parsed.hostel || '',
        current_password: ''
      });
      loadAllData();
    } catch (err) {
      console.error('Error initializing student dashboard user data:', err);
      // Only clear and redirect if JSON parsing truly failed
      try {
        JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }

    // Gentle background sync (keeps reels/posts, statuses, chats and notices live without manual refresh)
    let syncCancelled = false;
    let syncInterval = null;

    const syncDashboard = () => {
      if (syncCancelled || !getAuthToken()) return;
      fetchNotifications();
      API.get('/reels')
        .then(res => {
          if (res.data && Array.isArray(res.data)) {
            setReels(res.data);
            setCachedData('reels', res.data);
          }
        })
        .catch(err => {
          if (err?.response?.status === 401) {
            syncCancelled = true;
            if (syncInterval) clearInterval(syncInterval);
          }
        });
      API.get('/campus/statuses')
        .then(res => {
          if (res.data && Array.isArray(res.data)) setStatusGroups(res.data);
        })
        .catch(() => {});
      API.get('/friends/requests/pending')
        .then(res => setPendingRequests(res.data || []))
        .catch(() => {});
      API.get('/conversations')
        .then(res => setConversations(res.data || []))
        .catch(() => {});
    };

    syncInterval = setInterval(syncDashboard, 15000);
    const onWindowFocus = () => {
      if (getAuthToken()) syncDashboard();
    };
    window.addEventListener('focus', onWindowFocus);

    return () => {
      syncCancelled = true;
      if (syncInterval) clearInterval(syncInterval);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [navigate]);

  // Manual In-App Refresh (Soft reload for posts, stories, notices, and chats)
  const handleManualRefresh = async (showToast = true) => {
    setIsRefreshing(true);
    try {
      const [reelsRes, statRes, notRes, convRes, notifRes, prodRes, svcRes] = await Promise.all([
        API.get('/reels').catch(() => ({ data: [] })),
        API.get('/campus/statuses').catch(() => ({ data: [] })),
        API.get('/campus/notices').catch(() => ({ data: [] })),
        API.get('/conversations').catch(() => ({ data: [] })),
        API.get('/notifications').catch(() => ({ data: [] })),
        API.get('/products').catch(() => ({ data: [] })),
        API.get('/services').catch(() => ({ data: [] }))
      ]);

      if (reelsRes.data && Array.isArray(reelsRes.data)) {
        setReels(reelsRes.data);
        setCachedData('reels', reelsRes.data);
      }
      if (statRes.data && Array.isArray(statRes.data)) setStatusGroups(statRes.data);
      if (notRes.data && Array.isArray(notRes.data)) setNotices(notRes.data);
      if (convRes.data && Array.isArray(convRes.data)) setConversations(convRes.data);
      if (prodRes.data && Array.isArray(prodRes.data)) {
        setProducts(prodRes.data);
        setCachedData('products', prodRes.data);
      }
      if (svcRes.data && Array.isArray(svcRes.data)) {
        setServices(svcRes.data);
        setCachedData('services', svcRes.data);
      }

      const notifs = notifRes.data?.notifications || (Array.isArray(notifRes.data) ? notifRes.data : []);
      const unread = notifRes.data?.unread_count ?? notifs.filter(n => !n.is_read).length;
      setNotifications(notifs);
      setUnreadCount(unread);

      if (selectedPartner?.partner_id) {
        fetchMessagesForPartner(selectedPartner.partner_id);
      }

      if (showToast) {
        setToast({ text: 'All posts, stories & chats updated! ✨', type: 'success' });
      }
    } catch (err) {
      console.error('Manual refresh error:', err);
      if (showToast) {
        setToast({ text: 'Sync failed. Please check network.', type: 'error' });
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Reload Social Data (Friends & Requests)
  const reloadSocialData = async () => {
    try {
      const [studRes, reqRes, friendsRes, convRes] = await Promise.all([
        API.get('/students'),
        API.get('/friends/requests/pending'),
        API.get('/friends'),
        API.get('/conversations')
      ]);
      setCampusStudents(studRes.data || []);
      setPendingRequests(reqRes.data || []);
      setMyFriends(friendsRes.data || []);
      const convs = convRes.data || [];
      setConversations(convs);
      primeConversationsCache(convs);
    } catch (err) {
      console.error('Error reloading social data:', err);
    }
  };

  // Chat Stale-While-Revalidate (Auto-marks as read and updates conversations)
  const fetchMessagesForPartner = async (partnerId) => {
    if (!partnerId) return;
    try {
      await revalidateThreadMessages(partnerId, API, (fresh) => {
        setChatMessages(fresh);
        if (isUserNearBottom(chatContainerRef.current)) {
          smartScrollToBottom(chatContainerRef.current, false);
        }
      });
      setConversations(prev =>
        prev.map(c => (String(c.partner_id) === String(partnerId) ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      console.error('Error loading chat messages:', err);
    }
  };

  useEffect(() => {
    if (!selectedPartner?.partner_id) return;
    if (selectedPartner.is_ai) return;
    if (!getAuthToken()) return;

    // 1. Instantly load cached messages in 0ms to eliminate delay
    const cached = getCachedThreadMessages(selectedPartner.partner_id);
    setChatMessages(cached);
    setIsLoadingChatMessages(false);
    smartScrollToBottom(chatContainerRef.current, false);

    // 2. Fetch latest messages from server in background without blocking UI
    fetchMessagesForPartner(selectedPartner.partner_id);

    // 3. Fallback polling (8s) if WebSocket is temporarily inactive (WebSockets handle instant push)
    const pollTimer = setInterval(() => {
      if (getAuthToken()) {
        fetchMessagesForPartner(selectedPartner.partner_id);
      } else {
        clearInterval(pollTimer);
      }
    }, 8000);

    const handleFocus = () => {
      if (document.visibilityState === 'visible' && getAuthToken()) {
        fetchMessagesForPartner(selectedPartner.partner_id);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [selectedPartner?.partner_id]);

  // Instant 0ms Chat Selection (Loads cached messages immediately on click without any lag)
  const handleSelectPartner = (c) => {
    if (!c) return;
    const partnerId = c.partner_id || c.user_id || c.id;
    const cached = getCachedThreadMessages(partnerId);
    setChatMessages(cached);
    setIsLoadingChatMessages(false);
    isSwitchingPartnerRef.current = true;
    setSelectedPartner(c);
    smartScrollToBottom(chatContainerRef.current, false);
  };

  // Trigger Swipe-to-Reply or Click-to-Reply
  const handleStartReply = (msg) => {
    if (!msg) return;
    const isMine = msg.sender_id === currentUser.user_id;
    const senderName = isMine ? 'You' : (selectedPartner?.partner_name || 'Peer');
    let preview = '';
    if (msg.message_type === 'audio') preview = '🎤 Voice Note';
    else if (msg.message_type === 'image') preview = '📷 Photo';
    else if (msg.message_type === 'video') preview = '🎥 Video';
    else {
      const parsed = parseChatReply(msg);
      preview = parsed ? parsed.text : (msg.content || msg.text || '');
    }
    setReplyingToMessage({
      id: msg.id,
      sender_name: senderName,
      preview: preview.length > 70 ? preview.slice(0, 70) + '...' : preview,
      message_type: msg.message_type
    });
    try {
      if (navigator.vibrate) navigator.vibrate(25);
    } catch {}
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 60);
  };

  // Jump to and highlight original replied-to message in chat thread
  const handleScrollToQuotedMessage = (targetId) => {
    if (!targetId) return;
    const targetElement = document.getElementById(`chat-msg-${targetId}`) || document.querySelector(`[data-msg-id="${targetId}"]`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetId);
      try {
        if (navigator.vibrate) navigator.vibrate(20);
      } catch {}
      setTimeout(() => {
        setHighlightedMessageId(prev => (prev === targetId ? null : prev));
      }, 2500);
    }
  };

  // Send Message (Instant Zero-Latency Optimistic Delivery)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (selectedPartner?.is_ai) {
      return handleSendAiMessage();
    }
    if (!newMsgText.trim() || !selectedPartner?.partner_id) return;

    const messageText = newMsgText.trim();
    const currentReply = replyingToMessage;
    const partnerId = selectedPartner.partner_id;

    // 1. Instantly clear input field and reply preview (0ms latency)
    setNewMsgText('');
    setReplyingToMessage(null);

    // 2. Optimistic UI Update: Render message into active thread IMMEDIATELY
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: currentUser?.user_id,
      recipient_id: partnerId,
      content: messageText,
      message_type: currentReply ? 'reply' : 'text',
      reply_to_id: currentReply?.id || null,
      reply_to_sender: currentReply?.sender_name || null,
      reply_to_text: currentReply?.preview || null,
      created_at: new Date().toISOString(),
      is_read: false,
      is_optimistic: true
    };

    appendThreadMessage(partnerId, optimisticMsg);
    setChatMessages(prev => [...prev, optimisticMsg]);

    // 3. Immediately update the conversation row in sidebar to top
    setConversations(prev => {
      const idx = prev.findIndex(c => String(c.partner_id) === String(partnerId));
      if (idx !== -1) {
        const updated = { ...prev[idx], last_message: messageText, last_timestamp: new Date().toISOString() };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      }
      return prev;
    });

    // 4. Instant scroll to bottom
    smartScrollToBottom(chatContainerRef.current, false);

    // 5. Fire network request in background without blocking next user input
    try {
      const payload = {
        recipient_id: partnerId,
        content: messageText,
        message_type: currentReply ? 'reply' : 'text',
        reply_to_id: currentReply?.id || null,
        reply_to_sender: currentReply?.sender_name || null,
        reply_to_text: currentReply?.preview || null
      };

      const res = await API.post('/messages', payload);
      const confirmed = { ...res.data, is_optimistic: false };
      updateThreadMessage(partnerId, tempId, confirmed);
      setChatMessages(prev => prev.map(m => (m.id === tempId ? confirmed : m)));
    } catch (err) {
      console.error('Failed to deliver message:', err);
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      alert(err.response?.data?.detail || 'Failed to send message.');
    }
  };

  // --- CHAT VOICE NOTE (VN) RECORDING & PLAYBACK ---
  const handleStartRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access is required to record a Voice Note. Please allow microphone permissions in your browser.');
    }
  };

  const handleStopAndSendAudio = async () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    const duration = recordingSeconds || 1;
    const partnerId = selectedPartner?.partner_id;
    
    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setIsRecordingAudio(false);
      setRecordingSeconds(0);

      // 1. Optimistic 0ms Render: Create local blob audio for immediate playback
      const localAudioUrl = URL.createObjectURL(audioBlob);
      const tempId = `temp_audio_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const optimisticMsg = {
        id: tempId,
        sender_id: currentUser?.user_id,
        recipient_id: partnerId,
        content: 'Voice note',
        message_type: 'audio',
        media_url: localAudioUrl,
        duration: duration,
        created_at: new Date().toISOString(),
        is_read: false,
        is_optimistic: true
      };

      appendThreadMessage(partnerId, optimisticMsg);
      setChatMessages(prev => [...prev, optimisticMsg]);
      setConversations(prev => {
        const idx = prev.findIndex(c => String(c.partner_id) === String(partnerId));
        if (idx !== -1) {
          const updated = { ...prev[idx], last_message: '🎤 Voice note', last_timestamp: new Date().toISOString() };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        }
        return prev;
      });
      smartScrollToBottom(chatContainerRef.current, false);

      // 2. Upload & Send in background
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice_note.webm');
        const uploadRes = await API.post('/upload', formData);
        const audioUrl = uploadRes.data.url;

        const res = await API.post('/messages', {
          recipient_id: partnerId,
          content: 'Voice note',
          message_type: 'audio',
          media_url: audioUrl,
          duration: duration
        });
        const confirmed = { ...res.data, is_optimistic: false };
        updateThreadMessage(partnerId, tempId, confirmed);
        setChatMessages(prev => prev.map(m => m.id === tempId ? confirmed : m));
      } catch (err) {
        setChatMessages(prev => prev.filter(m => m.id !== tempId));
        alert(err.response?.data?.detail || 'Failed to send voice note.');
      }
    };
    mediaRecorderRef.current.stop();
  };

  const handleCancelRecordingAudio = () => {
    if (mediaRecorderRef.current) {
      clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    }
  };

  const handleChatMediaSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPartner?.partner_id) return;
    const isVid = file.type.startsWith('video');
    const isImg = file.type.startsWith('image');
    if (!isVid && !isImg) {
      alert('Please select an image or video file.');
      return;
    }
    setPendingMediaFile(file);
    setShowMediaEditor(true);
    if (chatMediaInputRef.current) chatMediaInputRef.current.value = '';
  };

  const handleConfirmSendChatMedia = async (file, caption = '') => {
    setShowMediaEditor(false);
    setPendingMediaFile(null);
    if (!file || !selectedPartner?.partner_id) return;

    const isVid = file.type?.startsWith('video');
    const partnerId = selectedPartner.partner_id;
    const currentReply = replyingToMessage;
    setReplyingToMessage(null);

    // 1. Optimistic 0ms Render: Create local preview URL
    const localMediaUrl = URL.createObjectURL(file);
    const tempId = `temp_media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const displayCaption = caption?.trim() || (isVid ? 'Video' : 'Photo');

    const optimisticMsg = {
      id: tempId,
      sender_id: currentUser?.user_id,
      recipient_id: partnerId,
      content: displayCaption,
      message_type: isVid ? 'video' : 'image',
      media_url: localMediaUrl,
      reply_to_id: currentReply?.id || null,
      reply_to_sender: currentReply?.sender_name || null,
      reply_to_text: currentReply?.preview || null,
      created_at: new Date().toISOString(),
      is_read: false,
      is_optimistic: true
    };

    appendThreadMessage(partnerId, optimisticMsg);
    setChatMessages(prev => [...prev, optimisticMsg]);
    setConversations(prev => {
      const idx = prev.findIndex(c => String(c.partner_id) === String(partnerId));
      if (idx !== -1) {
        const updated = {
          ...prev[idx],
          last_message: caption?.trim() ? `📷 ${caption.trim()}` : (isVid ? '📹 Video' : '📷 Photo'),
          last_timestamp: new Date().toISOString()
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      }
      return prev;
    });

    smartScrollToBottom(chatContainerRef.current, false);

    // 2. Upload & Send in background
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await API.post('/upload', formData);
      const mediaUrl = uploadRes.data.url;

      const payload = {
        recipient_id: partnerId,
        content: displayCaption,
        message_type: isVid ? 'video' : 'image',
        media_url: mediaUrl,
        reply_to_id: currentReply?.id || null,
        reply_to_sender: currentReply?.sender_name || null,
        reply_to_text: currentReply?.preview || null
      };

      const res = await API.post('/messages', payload);
      const confirmed = { ...res.data, is_optimistic: false };
      updateThreadMessage(partnerId, tempId, confirmed);
      setChatMessages(prev => prev.map(m => m.id === tempId ? confirmed : m));
    } catch (err) {
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      alert(err.response?.data?.detail || 'Failed to send media.');
    }
  };

  const handlePlayAudio = (msgId, audioUrl) => {
    if (playingAudioId === msgId) {
      if (chatAudioElementRef.current) {
        chatAudioElementRef.current.pause();
      }
      setPlayingAudioId(null);
      return;
    }
    if (chatAudioElementRef.current) {
      chatAudioElementRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    chatAudioElementRef.current = audio;
    setPlayingAudioId(msgId);
    audio.play().catch(e => console.error('Audio play error:', e));
    audio.onended = () => {
      setPlayingAudioId(null);
    };
  };

  // --- MY AI & MEMORY VAULT HANDLERS ---
  const fetchAiMessages = async () => {
    try {
      const res = await API.get('/ai/messages');
      setAiMessages(res.data || []);
    } catch (err) {
      console.error('Failed to fetch AI messages:', err);
    }
  };

  const fetchAiMemories = async () => {
    try {
      const res = await API.get('/ai/memories');
      setAiMemories(res.data || []);
    } catch (err) {
      console.error('Failed to fetch AI memories:', err);
    }
  };

  const handleSelectAiChat = () => {
    setActiveTab('messages');
    setSelectedPartner({
      partner_id: 'campus_ai',
      partner_name: 'CampusLink AI',
      partner_role: 'Campus AI Assistant',
      is_ai: true
    });
    fetchAiMessages();
    fetchAiMemories();
  };

  const handleSendAiMessage = async (customPrompt = null) => {
    const textToSend = (typeof customPrompt === 'string' ? customPrompt : newMsgText).trim();
    if (!textToSend || isAiTyping) return;

    const userMessageObj = {
      id: 'temp-' + Date.now(),
      sender: 'user',
      content: textToSend,
      created_at: new Date().toISOString()
    };
    
    setAiMessages(prev => [...prev, userMessageObj]);
    setNewMsgText('');
    setIsAiTyping(true);

    try {
      const res = await API.post('/ai/chat', {
        content: textToSend,
        store_as_info: storeInfoToggled
      });

      setAiMessages(prev => [...prev, {
        id: res.data.id || ('ai-' + Date.now()),
        sender: 'ai',
        content: res.data.content,
        is_memory_trigger: res.data.is_memory_trigger,
        created_at: res.data.created_at || new Date().toISOString()
      }]);

      if (res.data.is_memory_trigger || storeInfoToggled) {
        fetchAiMemories();
        setStoreInfoToggled(false);
      }
    } catch (err) {
      console.error('Failed to chat with AI:', err);
      setAiMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        sender: 'ai',
        content: "Sorry, I ran into an issue connecting with your campus assistant. Please try asking again in a moment!",
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleCreateMemory = async (e) => {
    if (e) e.preventDefault();
    if (!newMemoryForm.content.trim()) {
      alert('Please enter some content or information to remember.');
      return;
    }
    setIsSavingMemory(true);
    try {
      await API.post('/ai/memories', {
        title: newMemoryForm.title.trim() || 'Quick Note',
        content: newMemoryForm.content.trim(),
        category: newMemoryForm.category || 'academic'
      });
      setNewMemoryForm({ title: '', content: '', category: 'academic' });
      fetchAiMemories();
      fetchAiMessages();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save information.');
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    if (!window.confirm('Delete this stored memory?')) return;
    try {
      await API.delete(`/ai/memories/${memoryId}`);
      setAiMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete note.');
    }
  };

  const handleClearAiChat = async () => {
    if (!window.confirm('Clear your conversation with My AI? Your stored memory vault will stay safe!')) return;
    try {
      await API.post('/ai/clear');
      fetchAiMessages();
    } catch (err) {
      alert('Failed to clear AI chat.');
    }
  };

  // --- NOTICE BOARD HANDLERS ---
  const fetchCampusNotices = async () => {
    try {
      const params = {};
      if (noticeType !== 'all') params.notice_type = noticeType;
      if (noticeCategory !== 'all') params.category = noticeCategory;
      if (noticeSearch.trim()) params.search = noticeSearch.trim();
      const res = await API.get('/campus/notices', { params });
      setNotices(res.data || []);
    } catch (err) {
      console.error('Failed to fetch notices:', err);
    }
  };

  useEffect(() => {
    fetchCampusNotices();
  }, [noticeType, noticeCategory, noticeSearch]);

  const handleCreateNotice = async (e) => {
    if (e) e.preventDefault();
    if (!newNoticeForm.title.trim() || !newNoticeForm.description.trim() || !newNoticeForm.location.trim()) {
      alert('Please fill in title, campus location, and description.');
      return;
    }
    setSubmittingNotice(true);
    try {
      await API.post('/campus/notices', newNoticeForm);
      setToast({ text: 'Report / announcement posted to campus notice board!', type: 'success' });
      setReportModalOpen(false);
      setNewNoticeForm({
        type: 'lost',
        title: '',
        category: 'id_card',
        description: '',
        location: '',
        date_lost_or_found: '',
        contact_phone: currentUser?.phone_number || '',
        image_url: ''
      });
      fetchCampusNotices();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post notice.');
    } finally {
      setSubmittingNotice(false);
    }
  };

  const handleResolveNotice = async (noticeId) => {
    try {
      await API.patch(`/campus/notices/${noticeId}/resolve`);
      setToast({ text: 'Notice marked as claimed / resolved!', type: 'success' });
      fetchCampusNotices();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update notice status.');
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Delete this notice?')) return;
    try {
      await API.delete(`/campus/notices/${noticeId}`);
      setToast({ text: 'Notice removed.', type: 'info' });
      fetchCampusNotices();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete notice.');
    }
  };

  // --- WHATSAPP STATUS STORIES HANDLERS ---
  const fetchCampusStatuses = async () => {
    try {
      const res = await API.get('/campus/statuses');
      setStatusGroups(res.data || []);
    } catch (err) {
      console.error('Failed to fetch statuses:', err);
    }
  };

  const handleCreateStatus = async (e) => {
    if (e) e.preventDefault();
    if (statusMode === 'text' && !newStatusForm.caption?.trim()) {
      alert('Please enter a status thought or update.');
      return;
    }
    if (statusMode === 'media' && !statusMediaFile) {
      alert('Please select a photo or video to share to your campus story.');
      return;
    }
    setSubmittingStatus(true);
    try {
      let mediaUrl = null;
      let mediaType = 'text';

      if (statusMode === 'media' && statusMediaFile) {
        const isVid = (
          (statusMediaFile.type && statusMediaFile.type.startsWith('video')) ||
          Boolean(statusMediaFile.name && statusMediaFile.name.match(/\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i))
        );
        mediaType = isVid ? 'video' : 'image';
        mediaUrl = await uploadFile(statusMediaFile);
      }

      const payload = {
        media_type: mediaType,
        caption: newStatusForm.caption?.trim() || '',
        background_color: statusMode === 'text' ? (newStatusForm.background_color || 'from-emerald-600 to-teal-800') : null,
        media_url: mediaUrl,
        privacy_setting: statusPrivacy,
        allowed_user_ids: statusPrivacy === 'custom' ? selectedAudienceFriends : []
      };
      await API.post('/campus/statuses', payload);
      setToast({ 
        text: 'Story shared! Visible to your campus circle.', 
        type: 'success' 
      });
      setCreateStatusModalOpen(false);
      setStatusMediaFile(null);
      setStatusMediaPreview(null);
      setNewStatusForm({
        media_type: 'image',
        caption: '',
        background_color: 'from-emerald-600 to-teal-800',
        media_url: ''
      });
      fetchCampusStatuses();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post story.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleReplyToStatus = async (customText = null) => {
    const textToSend = typeof customText === 'string' ? customText : statusReplyText;
    if (!textToSend.trim() || !activeStatusViewer) return;
    const group = statusGroups[activeStatusViewer.userIdx];
    if (!group) return;
    const currentItem = group.items?.[activeStatusViewer.itemIdx] || group.items?.[0];

    const payload = {
      type: 'status_reply',
      reply_text: textToSend.trim(),
      reaction: null,
      status_id: currentItem?.id,
      status_media_type: currentItem?.media_type || (currentItem?.media_url ? 'image' : 'text'),
      status_media_url: currentItem?.media_url || null,
      status_caption: currentItem?.caption || '',
      status_bg: currentItem?.background_color || null,
      author_name: group.user_name || 'Story'
    };

    try {
      await API.post('/messages', {
        recipient_id: group.user_id,
        content: JSON.stringify(payload),
        message_type: 'status_reply',
        media_url: currentItem?.media_url || null
      });
      setToast({ text: `Reply sent to ${group.user_name}`, type: 'success' });
      if (!customText) setStatusReplyText('');
      API.get('/conversations').then(res => setConversations(res.data || [])).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send reply.');
    }
  };

  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm('Delete this story?')) return;
    try {
      await API.delete(`/campus/statuses/${statusId}`);
      setActiveStatusViewer(null);
      fetchCampusStatuses();
      setToast({ text: 'Story deleted!', type: 'success' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete story.');
    }
  };

  const handleSendStatusReaction = async (emoji) => {
    if (!activeStatusViewer) return;
    const group = statusGroups[activeStatusViewer.userIdx];
    if (!group) return;
    const currentItem = group.items?.[activeStatusViewer.itemIdx] || group.items?.[0];

    const payload = {
      type: 'status_reply',
      reply_text: '',
      reaction: emoji,
      status_id: currentItem?.id,
      status_media_type: currentItem?.media_type || (currentItem?.media_url ? 'image' : 'text'),
      status_media_url: currentItem?.media_url || null,
      status_caption: currentItem?.caption || '',
      status_bg: currentItem?.background_color || null,
      author_name: group.user_name || 'Story'
    };

    try {
      await API.post('/messages', {
        recipient_id: group.user_id,
        content: JSON.stringify(payload),
        message_type: 'status_reply',
        media_url: currentItem?.media_url || null
      });
      setToast({ text: `Sent ${emoji} to ${group.user_name}`, type: 'success' });
      API.get('/conversations').then(res => setConversations(res.data || [])).catch(() => {});
    } catch (err) {
      console.error('Failed to send reaction:', err);
    }
  };

  // Auto-record status view when activeStatusViewer changes
  useEffect(() => {
    if (activeStatusViewer && statusGroups[activeStatusViewer.userIdx]) {
      const group = statusGroups[activeStatusViewer.userIdx];
      const item = group.items[activeStatusViewer.itemIdx];
      if (item && !group.is_self) {
        API.post(`/campus/statuses/${item.id}/view`).catch(() => {});
      }
    }
  }, [activeStatusViewer, statusGroups]);

  // --- FRIEND REQUEST ACTIONS ---

  // 1. Send Friend Request
  const handleSendFriendRequest = async (targetUserId) => {
    try {
      const res = await API.post(`/friends/request/${targetUserId}`);
      setToast({ text: res.data.message, type: 'success' });
      await reloadSocialData();
      if (selectedProfile && selectedProfile.user_id === targetUserId) {
        setSelectedProfile(prev => ({
          ...prev,
          friendship_status: res.data.status,
          request_id: res.data.request_id
        }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send friend request.');
    }
  };

  // 2. Accept Friend Request
  const handleAcceptFriendRequest = async (requestId) => {
    try {
      const res = await API.post(`/friends/requests/${requestId}/accept`);
      setToast({ text: res.data.message, type: 'success' });
      await reloadSocialData();
      if (selectedProfile) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'friends' }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept friend request.');
    }
  };

  // 3. Decline Friend Request
  const handleDeclineFriendRequest = async (requestId) => {
    try {
      const res = await API.post(`/friends/requests/${requestId}/decline`);
      setToast({ text: `Friend request declined.`, type: 'info' });
      await reloadSocialData();
      if (selectedProfile) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'none' }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to decline friend request.');
    }
  };

  // 4. Cancel Friend Request or Unfriend
  const handleCancelOrRemoveFriend = async (targetUserId) => {
    try {
      const res = await API.delete(`/friends/cancel/${targetUserId}`);
      setToast({ text: res.data.message, type: 'info' });
      await reloadSocialData();
      if (selectedProfile && selectedProfile.user_id === targetUserId) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'none', request_id: null }));
      }
    } catch (err) {
      alert('Failed to remove connection.');
    }
  };

  // 5. Open Full Profile Modal
  const handleViewProfile = async (userId) => {
    try {
      const res = await API.get(`/students/${userId}`);
      setSelectedProfile(res.data);
      setProfileModalOpen(true);
    } catch (err) {
      alert('Could not load student profile.');
    }
  };

  // 6. Start Chat from Profile or Student Card (Instant Cache Render)
  const handleStartChatWithStudent = (student) => {
    const partnerId = student.user_id || student.id;
    const existing = conversations.find(c => String(c.partner_id) === String(partnerId));
    if (existing) {
      handleSelectPartner(existing);
    } else {
      const partner = {
        partner_id: partnerId,
        partner_name: student.full_name,
        partner_phone: student.phone_number,
        partner_avatar: student.profile_picture_url,
        partner_role: 'Student',
        department: student.department,
        level: student.level
      };
      handleSelectPartner(partner);
    }
    setActiveTab('messages');
    setMessageSubtab('chats');
    setProfileModalOpen(false);
  };

  // 7. Start Chat with Vendor from Marketplace (Instant Cache Render)
  const handleStartVendorChat = (productOrService) => {
    const existing = conversations.find(c => 
      (productOrService.vendor_user_id && String(c.partner_id) === String(productOrService.vendor_user_id)) ||
      (productOrService.vendor_name && c.partner_name === productOrService.vendor_name)
    );
    if (existing) {
      handleSelectPartner(existing);
    } else {
      const partnerId = productOrService.vendor_user_id || `v_${productOrService.vendor_id || productOrService.vendor_name}`;
      const partner = {
        partner_id: partnerId,
        partner_name: productOrService.vendor_name || 'Campus Merchant',
        partner_phone: productOrService.vendor_phone,
        partner_role: 'Vendor',
        location: productOrService.vendor_location || productOrService.location
      };
      handleSelectPartner(partner);
    }
    setActiveTab('messages');
    setMessageSubtab('chats');
  };

  // Like Reel (with instant optimistic update)
  const handleLikeReel = async (id) => {
    setReels(prev => prev.map(r => {
      if (r.id === id) {
        const nextLiked = !r.has_liked;
        return {
          ...r,
          has_liked: nextLiked,
          likes_count: nextLiked ? (r.likes_count || 0) + 1 : Math.max(0, (r.likes_count || 1) - 1)
        };
      }
      return r;
    }));

    try {
      const res = await API.post(`/reels/${id}/like`);
      setReels(prev => prev.map(r => r.id === id ? { ...r, likes_count: res.data.likes_count, has_liked: res.data.has_liked } : r));
    } catch (err) {
      console.error('Error liking reel:', err);
    }
  };

  // Submit Comment or Reply on Post (Instant Optimistic Update)
  const handlePostComment = async (reelId) => {
    if (!newCommentText.trim()) return;
    const commentContent = newCommentText.trim();
    const currentReply = replyingToComment;
    const tempId = `temp_c_${Date.now()}`;

    // 1. Instantly clear input and reply target
    setNewCommentText('');
    setReplyingToComment(null);

    // 2. Optimistic insert
    const optimisticComment = {
      id: tempId,
      reel_id: reelId,
      user_id: currentUser?.user_id || currentUser?.id,
      content: commentContent,
      author_name: currentUser?.full_name || 'Campus Student',
      author_avatar: currentUser?.profile_picture_url || null,
      author_role: currentUser?.role === 'vendor' ? 'Vendor' : 'Student',
      reply_to_comment_id: currentReply?.commentId || null,
      reply_to_author: currentReply?.authorName || null,
      created_at: new Date().toISOString(),
      is_optimistic: true
    };

    setReels(prev => prev.map(r => {
      if (r.id === reelId) {
        const currentComments = r.comments || [];
        const updatedComments = [...currentComments, optimisticComment];
        return {
          ...r,
          comments: updatedComments,
          comments_count: updatedComments.length
        };
      }
      return r;
    }));

    setPostingComment(true);
    try {
      const payload = {
        content: commentContent,
        reply_to_comment_id: currentReply?.commentId || null
      };
      const res = await API.post(`/reels/${reelId}/comments`, payload);
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const updatedComments = (r.comments || []).map(c => c.id === tempId ? res.data : c);
          return {
            ...r,
            comments: updatedComments,
            comments_count: updatedComments.length
          };
        }
        return r;
      }));
      setToast({ text: currentReply ? `Reply sent to @${currentReply.authorName}!` : 'Comment added to campus post!', type: 'success' });
    } catch (err) {
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const updatedComments = (r.comments || []).filter(c => c.id !== tempId);
          return {
            ...r,
            comments: updatedComments,
            comments_count: updatedComments.length
          };
        }
        return r;
      }));
      alert(err.response?.data?.detail || 'Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  // Geolocation detection
  const handleDetectGpsLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(3);
        const lon = pos.coords.longitude.toFixed(3);
        setReelLocation(`📍 Live GPS (${lat}, ${lon}) • ${universityName}`);
        setDetectingGps(false);
        setToast({ text: `Device GPS location detected!`, type: 'info' });
      },
      (err) => {
        console.warn(err);
        setReelLocation(`📍 ${universityName} Campus`);
        setDetectingGps(false);
        setToast({ text: `Using ${universityName} campus location.`, type: 'info' });
      },
      { timeout: 7000 }
    );
  };

  // Select Reel File
  const handleReelFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReelFile(file);
      const previewUrl = URL.createObjectURL(file);
      setReelPreview(previewUrl);
    }
  };

  // Post Reel Submit (Supports pure text, normal photos, and videos)
  const handlePostReelSubmit = async (e) => {
    e.preventDefault();
    if (!reelFile && !reelText.trim()) {
      alert('Please add a photo, video or write some text to share!');
      return;
    }

    setReelPosting(true);
    try {
      let mediaUrl = null;
      let mediaType = 'text';

      if (reelFile) {
        mediaUrl = await uploadFile(reelFile);
        mediaType = reelFile.type.startsWith('video') ? 'video' : 'image';
      }

      await API.post('/reels', {
        title: reelText.trim() ? reelText.trim().slice(0, 60) : 'Campus Moment',
        description: reelText.trim() || undefined,
        media_url: mediaUrl,
        media_type: mediaType,
        location: reelLocation || `${universityName} Campus`
      });

      setReelText('');
      setReelFile(null);
      setReelPreview(null);
      setToast({ text: 'Post published to campus feed!', type: 'success' });
      const res = await API.get('/reels');
      setReels(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post to campus.');
    } finally {
      setReelPosting(false);
    }
  };

  // Delete Reel Post
  const handleDeleteReel = async (reelId) => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
    try {
      await API.delete(`/reels/${reelId}`);
      setReels(prev => prev.filter(r => r.id !== reelId));
      setActivePostMenuId(null);
      setToast({ text: 'Post deleted successfully!', type: 'success' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete post.');
    }
  };

  // Copy Post Link
  const handleCopyPostLink = (reel) => {
    const shareUrl = `${window.location.origin}/dashboard?reel=${reel.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setToast({ text: 'Post link copied to clipboard!', type: 'success' });
        setActivePostMenuId(null);
      }).catch(() => {
        setToast({ text: 'Link: ' + shareUrl, type: 'info' });
        setActivePostMenuId(null);
      });
    } else {
      setToast({ text: 'Link: ' + shareUrl, type: 'info' });
      setActivePostMenuId(null);
    }
  };

  // Report Post Content
  const handleReportPost = (reelId) => {
    setActivePostMenuId(null);
    setToast({ text: 'Post reported to campus moderators for review.', type: 'info' });
  };

  // Hide Post from Current Feed
  const handleHidePost = (reelId) => {
    setHiddenPostIds(prev => [...prev, reelId]);
    setActivePostMenuId(null);
    setToast({ text: 'Post hidden from your feed.', type: 'info' });
  };

  // Delete Reel Comment
  const handleDeleteReelComment = async (reelId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await API.delete(`/reels/comments/${commentId}`);
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const updated = (r.comments || []).filter(c => c.id !== commentId);
          return {
            ...r,
            comments: updated,
            comments_count: Math.max(0, (r.comments_count || 1) - 1)
          };
        }
        return r;
      }));
      setToast({ text: 'Comment deleted.', type: 'info' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete comment.');
    }
  };

  // Profile Picture Upload
  const handleAvatarSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploadedUrl = await uploadFile(file);
      await API.post('/users/profile-picture', { profile_picture_url: uploadedUrl });
      const updatedUser = { ...currentUser, profile_picture_url: uploadedUrl };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setToast({ text: 'Profile picture updated successfully!', type: 'success' });
    } catch (err) {
      alert('Failed to update profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Update Profile Details
  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = {
        full_name: (profileForm.full_name || '').trim(),
        bio: (profileForm.bio || '').trim(),
        phone_number: (profileForm.phone_number || '').trim(),
        department: (profileForm.department || '').trim(),
        level: (profileForm.level || '').trim(),
        hostel: (profileForm.hostel || '').trim(),
      };
      const res = await API.put('/users/profile', payload);
      const updated = res.data.user;
      setCurrentUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      setToast({ text: 'Profile information updated successfully!', type: 'success' });
      setProfileForm(prev => ({
        ...prev,
        full_name: updated.full_name || '',
        bio: updated.bio || '',
        phone_number: updated.phone_number || '',
        department: updated.department || '',
        level: updated.level || '',
        hostel: updated.hostel || '',
        current_password: ''
      }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    if (e) e.preventDefault();
    if (!passwordForm.current_password) {
      alert('Please enter your current password.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      alert('New password must be at least 6 characters long.');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await API.put('/users/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      setToast({ text: res.data.message || 'Password changed successfully!', type: 'success' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };


  // Place Food / Product Order
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!orderModalItem) return;
    try {
      const totalAmount = orderModalItem.price * orderQuantity;
      await API.post('/orders', {
        vendor_id: orderModalItem.vendor_id,
        item_title: orderModalItem.name,
        product_id: marketType === 'products' ? orderModalItem.id : null,
        service_id: marketType === 'services' ? orderModalItem.id : null,
        quantity: orderQuantity,
        amount: totalAmount,
        delivery_location: orderDeliveryLocation.trim() || 'Campus Hostel Room'
      });
      setOrderModalItem(null);
      setToast({ text: `Order placed for ${orderModalItem.name}! Delivery arriving at ${orderDeliveryLocation}.`, type: 'success' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Filtered Lists
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category_id === parseInt(selectedCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const filteredServices = services.filter(s => {
    const matchesCat = selectedCategory === 'all' || s.category_id === parseInt(selectedCategory);
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredStudents = campusStudents.filter(s => {
    const q = studentSearch.toLowerCase().trim();
    const matchesSearch = !q || (
      (s.full_name && s.full_name.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.university_name && s.university_name.toLowerCase().includes(q)) ||
      (s.business_name && s.business_name.toLowerCase().includes(q)) ||
      (s.bio && s.bio.toLowerCase().includes(q)) ||
      (s.hostel && s.hostel.toLowerCase().includes(q))
    );

    const matchesRole =
      friendsFilter === 'all' ||
      (friendsFilter === 'students' && (s.role === 'student' || !s.is_seller)) ||
      (friendsFilter === 'sellers' && (s.role === 'vendor' || s.is_seller));

    return matchesSearch && matchesRole;
  });

  const filteredNotices = notices.filter(n => {
    const q = noticeSearch.toLowerCase().trim();
    const matchesSearch = !q || (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.description && n.description.toLowerCase().includes(q)) ||
      (n.location && n.location.toLowerCase().includes(q)) ||
      (n.author_name && n.author_name.toLowerCase().includes(q))
    );

    const matchesType = noticeType === 'all' || n.type === noticeType;
    const matchesCat = noticeCategory === 'all' || n.category === noticeCategory;

    return matchesSearch && matchesType && matchesCat;
  });

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased flex flex-col md:flex-row select-none">
      {/* Floating In-App Chat Notification Alert */}
      <InAppChatBanner
        banner={inAppBanner}
        onReply={handleReplyFromBanner}
        onDismiss={() => setInAppBanner(null)}
      />
      
      {/* Desktop Sidebar Navigation (Hidden on small screens) */}
      <aside className="hidden md:flex flex-col md:w-64 bg-white border-r border-slate-200 p-5 justify-between shrink-0 shadow-xs h-full overflow-y-auto">
        <div>
          <Link to="/" className="flex items-center space-x-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-sky-500/20">
              CL
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                CAMPUS<span className="text-sky-600">LINK</span>
              </span>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Student Portal</span>
            </div>
          </Link>

          {/* Student Profile Card with Live Avatar */}
          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 mb-6 flex items-center space-x-3">
            <div className="relative">
              {currentUser?.profile_picture_url ? (
                <SafeImage
                  src={currentUser.profile_picture_url}
                  alt={currentUser.full_name}
                  fallbackType="avatar"
                  className="w-10 h-10 rounded-xl object-cover border border-sky-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                  {currentUser?.full_name?.charAt(0) || 'S'}
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-slate-900 block truncate">{currentUser?.full_name}</span>
              <span className="text-[10px] text-sky-700 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-sky-600" />
                <span>Verified Student</span>
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => { setActiveTab('marketplace'); setMarketType('products'); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'marketplace' && marketType === 'products' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Campus Marketplace</span>
            </button>

            <button
              onClick={() => { setActiveTab('marketplace'); setMarketType('services'); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'marketplace' && marketType === 'services' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Campus Services</span>
            </button>

            <button
              onClick={() => setActiveTab('reels')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'reels' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Campus Reels</span>
            </button>

            <button
              onClick={() => setActiveTab('campus')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'campus' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notices & Lost/Found</span>
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer relative ${
                activeTab === 'messages' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Messages & Friends</span>
              {(totalUnreadChatCount > 0 || pendingRequests.length > 0) && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs animate-pulse">
                  {totalUnreadChatCount > 0 ? totalUnreadChatCount : pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'profile' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile & Settings</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto max-w-7xl w-full min-w-0 ${selectedPartner && activeTab === 'messages' ? 'p-0 md:p-6 lg:p-8 pb-0 md:pb-8' : 'p-4 sm:p-6 lg:p-8 pb-24 md:pb-8'}`}>
        
        {/* Mobile Top Header (Facebook style top bar for small screens) */}
        <div className={`items-center justify-between pb-3 mb-4 border-b border-slate-200 ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'flex md:hidden'}`}>
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-xs text-white shadow-xs">
              CL
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900">
              CAMPUS<span className="text-sky-600">LINK</span>
            </span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[120px]">
              {universityName ? universityName.split(' ')[0] : 'Campus'}
            </span>
            {/* In-App Manual Refresh Button (Mobile) */}
            <button
              onClick={() => handleManualRefresh(true)}
              disabled={isRefreshing}
              className={`p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-sky-600 cursor-pointer shadow-2xs transition-all active:scale-95 ${
                isRefreshing ? 'text-sky-600 bg-sky-50 border-sky-300' : ''
              }`}
              title="Refresh feeds, stories & chats"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
            </button>
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-sky-600 cursor-pointer shadow-2xs"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className="p-1 rounded-xl bg-white border border-slate-200 cursor-pointer shadow-2xs"
              title="Profile & Settings"
            >
              {currentUser?.profile_picture_url ? (
                <SafeImage src={currentUser?.profile_picture_url} alt={currentUser?.full_name} fallbackType="avatar" className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  {currentUser?.full_name?.charAt(0) || 'S'}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Top Header Bar with Live Notification Bell & Student Profile (Desktop/Tablet) */}
        <header className="hidden md:flex sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 font-semibold mb-0.5">
              <GraduationCap className="w-4 h-4 text-sky-600" />
              <span>{universityName || currentUser?.university_name || 'CampusLink University'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Hello, {currentUser?.full_name ? currentUser.full_name.split(' ')[0] : 'Student'}! 👋
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* In-App Manual Refresh Button (Desktop) */}
            <button
              onClick={() => handleManualRefresh(true)}
              disabled={isRefreshing}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-sky-600 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isRefreshing ? 'text-sky-600 bg-sky-50 border-sky-300' : ''
              }`}
              title="Refresh feeds, stories & chats"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
              <span className="text-xs font-bold hidden sm:inline">
                {isRefreshing ? 'Syncing...' : 'Refresh'}
              </span>
            </button>

            {/* Live Notification Bell with Drawer Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-sky-600 transition-all cursor-pointer shadow-xs flex items-center justify-center"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Profile Nav Button */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center space-x-2.5 p-1.5 pr-3.5 rounded-2xl bg-white hover:bg-sky-50/60 border border-slate-200 hover:border-sky-300 transition-all cursor-pointer shadow-xs"
              title="Edit Profile & Settings"
            >
              {currentUser?.profile_picture_url ? (
                <SafeImage src={currentUser?.profile_picture_url} alt={currentUser?.full_name} fallbackType="avatar" className="w-8 h-8 rounded-xl object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black flex items-center justify-center text-xs">
                  {currentUser?.full_name?.charAt(0) || 'S'}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <span className="text-xs font-bold text-slate-800 block leading-tight">
                  {currentUser?.full_name ? currentUser.full_name.split(' ')[0] : 'Profile'}
                </span>
                <span className="text-[10px] text-sky-600 font-semibold">Settings</span>
              </div>
            </button>
          </div>
        </header>

        {/* Toast Alert */}
        {toast.text && (
          <div className="mb-6 p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <span>{toast.text}</span>
            <button onClick={() => setToast({ text: '', type: '' })} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* --- TAB 1: CAMPUS MARKETPLACE (JUMIA STYLE) --- */}
        {activeTab === 'marketplace' && (
          <div>
            {/* Header & Sub-Switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Campus Marketplace
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Shop verified campus vendor products, meal packs & essential student services.
                </p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center border border-slate-200">
                <button
                  onClick={() => setMarketType('products')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    marketType === 'products' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Products ({products.length})
                </button>
                <button
                  onClick={() => setMarketType('services')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    marketType === 'services' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Services ({services.length})
                </button>
              </div>
            </div>

            {/* Search Input & Category Pills */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs mb-8 space-y-4">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search ${marketType} by title, vendor, sneakers, food...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer shrink-0 ${
                    selectedCategory === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id.toString())}
                    className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                      selectedCategory === c.id.toString() ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="text-slate-600">{renderCategoryIcon(c.name)}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {marketType === 'products' && (
              filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
                      <div>
                        <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                          <SafeImage src={p.image} alt={p.name} fallbackType="product" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-sky-800 shadow-xs flex items-center space-x-1 border border-sky-100">
                            <MapPin className="w-3 h-3 text-sky-600" />
                            <span>{p.university_abbr || p.university_name || p.vendor_location || 'Campus Stall'}</span>
                          </span>
                        </div>

                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-black text-sky-700 bg-sky-50 px-2.5 py-1 rounded-xl border border-sky-200 inline-flex items-center space-x-1">
                              <MessageCircle className="w-3.5 h-3.5 text-sky-600" />
                              <span>Negotiable in Chat</span>
                            </span>
                            {p.is_vendor_verified && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>Verified Seller</span>
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{p.name}</h4>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-slate-500 font-medium">By {p.vendor_name}</span>
                            {(p.university_abbr || p.university_name) && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                📍 {p.university_abbr || p.university_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.description}</p>
                          <p className="text-[10px] text-slate-400 mt-2 flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                            <span>Dispatched from {p.university_name || p.university_abbr || 'campus'}. Inspect & meet at seller's hostel or quad</span>
                          </p>
                        </div>
                      </div>

                      <div className="p-4 pt-0 space-y-2">
                        <button
                          onClick={() => handleStartVendorChat(p)}
                          className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat with Seller to Negotiate & Agree Location</span>
                        </button>

                        <button
                          onClick={() => {
                            setOrderModalItem(p);
                            setOrderQuantity(1);
                          }}
                          className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-[11px] rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Place Agreed Order for Delivery</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-10">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800">No products match your search</h4>
                  <p className="text-xs text-slate-500 mt-1">Try selecting another category or typing different keywords.</p>
                </div>
              )
            )}

            {/* Services Grid */}
            {marketType === 'services' && (
              filteredServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredServices.map((s) => (
                    <div key={s.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="h-44 w-full bg-slate-100 relative">
                          <SafeImage src={s.image} alt={s.name} fallbackType="product" className="w-full h-full object-cover" />
                          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-700 flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{s.location || 'On Campus'}</span>
                          </span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 inline-flex items-center space-x-1">
                              <Wrench className="w-3.5 h-3.5 text-slate-600" />
                              <span>Fee & Scope Negotiable in Chat</span>
                            </span>
                          </div>
                          <h4 className="font-bold text-base text-slate-900">{s.name}</h4>
                          <span className="text-xs text-slate-500 font-medium block">Provider: {s.vendor_name}</span>
                          <p className="text-xs text-slate-600 mt-2">{s.description}</p>
                          <p className="text-[10px] text-slate-400 mt-2 flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Campus location: {s.location || 'On Campus'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="p-4 pt-0 space-y-2">
                        <button
                          onClick={() => handleStartVendorChat(s)}
                          className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat with Provider to Discuss & Schedule</span>
                        </button>

                        <button
                          onClick={() => {
                            setOrderModalItem(s);
                            setOrderQuantity(1);
                          }}
                          className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-[11px] rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Schedule Agreed Service</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-10">
                  <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800">No services listed yet</h4>
                </div>
              )
            )}
          </div>
        )}

        {/* --- TAB 2: CAMPUS REELS --- */}
        {activeTab === 'reels' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Campus Reels & Feed
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Watch student video drops, campus clips, and share updates across campus.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleManualRefresh(true)}
                disabled={isRefreshing}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-600 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Refresh feed & posts"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Refresh Feed'}</span>
              </button>
            </div>

            {/* Facebook-Style Post Creator Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center space-x-3 mb-4">
                {currentUser?.profile_picture_url ? (
                  <SafeImage src={currentUser?.profile_picture_url} alt="You" fallbackType="avatar" className="w-10 h-10 rounded-full object-cover border border-sky-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 text-white font-bold flex items-center justify-center text-sm">
                    {currentUser?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <span className="font-bold text-xs text-slate-900 block">{currentUser?.full_name}</span>
                  <span className="text-[10px] text-slate-400">Share with students across {universityName}</span>
                </div>
              </div>

              <form onSubmit={handlePostReelSubmit} className="space-y-3">
                <textarea
                  rows={3}
                  value={reelText}
                  onChange={(e) => setReelText(e.target.value)}
                  placeholder={`What's happening on campus, ${currentUser?.full_name?.split(' ')[0]}? Share thoughts, announcements, photos, or videos...`}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white resize-none leading-relaxed"
                />

                {reelPreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-72 bg-slate-900 flex items-center justify-center">
                    {reelFile?.type?.startsWith('video') ? (
                      <video src={getMediaUrl(reelPreview)} controls className="max-h-72 w-full object-contain" />
                    ) : (
                      <SafeImage src={reelPreview} alt="Preview" fallbackType="product" className="max-h-72 w-full object-contain" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setReelFile(null);
                        setReelPreview(null);
                      }}
                      className="absolute top-3 right-3 bg-slate-950/80 text-white p-1.5 rounded-full hover:bg-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Quick Location Selector & GPS */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Tag Location:</span>
                  <button
                    type="button"
                    onClick={handleDetectGpsLocation}
                    disabled={detectingGps}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Detect device GPS location"
                  >
                    <Navigation className={`w-3 h-3 text-sky-600 ${detectingGps ? 'animate-spin' : ''}`} />
                    <span>{detectingGps ? 'Locating...' : 'My Live GPS'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReelLocation(`📍 ${universityName} Campus`)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    🏫 {universityName.split(' ')[0]} Campus
                  </button>
                  <button
                    type="button"
                    onClick={() => setReelLocation('📍 Central Library')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    📚 Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setReelLocation('📍 Student Union (SUB)')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    🏛️ SUB
                  </button>
                  <button
                    type="button"
                    onClick={() => setReelLocation('📍 Hostels Quad')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    🛏️ Hostels Quad
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={reelFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleReelFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => reelFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-600 text-slate-600 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-sky-500" />
                      <span>{reelFile ? 'Change Photo/Video' : 'Add Photo / Video'}</span>
                    </button>

                    <div className="flex items-center space-x-1 bg-slate-100 px-3 py-1.5 rounded-xl text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-sky-500" />
                      <input
                        type="text"
                        value={reelLocation}
                        onChange={(e) => setReelLocation(e.target.value)}
                        placeholder="Custom Location Tag"
                        className="bg-transparent border-none text-xs text-slate-800 focus:outline-none w-36 sm:w-44"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={reelPosting || (!reelFile && !reelText.trim())}
                    className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50 self-end sm:self-auto"
                  >
                    {reelPosting ? 'Posting...' : 'Post to Campus'}
                  </button>
                </div>
              </form>
            </div>

            {/* Reels Feed */}
            <div className="space-y-6">
              {reels.filter(r => !hiddenPostIds.includes(r.id)).map((reel) => {
                const isAuthor = (currentUser?.user_id && reel.user_id === currentUser.user_id) ||
                                 (currentUser?.id && reel.user_id === currentUser.id) ||
                                 currentUser?.role === 'admin';

                return (
                <div key={reel.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Post Header */}
                  <div className="p-4 flex items-center justify-between border-b border-slate-100 relative">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {reel.author_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => reel.user_id && handleViewProfile(reel.user_id)}
                            className="font-bold text-xs text-slate-900 hover:text-sky-600 transition-colors text-left"
                          >
                            {reel.author_name}
                          </button>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            reel.author_role === 'vendor' ? 'bg-amber-100 text-amber-800' : 'bg-sky-50 text-sky-700'
                          }`}>
                            {reel.author_role === 'vendor' ? 'Campus Merchant' : 'Student'}
                          </span>
                          {(reel.author_university_abbr || reel.author_university) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                              <span>📍</span>
                              <span>{reel.author_university_abbr || reel.author_university}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center space-x-0.5 text-sky-600 font-semibold">
                            <MapPin className="w-3 h-3 text-sky-500" />
                            <span>{reel.location || 'Campus'}</span>
                          </span>
                          <span>•</span>
                          <span>{safeDate(reel.created_at, 'Recent')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Post Settings Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActivePostMenuId(activePostMenuId === reel.id ? null : reel.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        title="Post settings"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activePostMenuId === reel.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActivePostMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                            {isAuthor && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReel(reel.id)}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" />
                                <span>Delete Post</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyPostLink(reel)}
                              className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                            >
                              <Copy className="w-4 h-4 text-slate-400" />
                              <span>Copy Post Link</span>
                            </button>

                            {reel.user_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePostMenuId(null);
                                  handleViewProfile(reel.user_id);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                              >
                                <User className="w-4 h-4 text-slate-400" />
                                <span>View Creator Profile</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleHidePost(reel.id)}
                              className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                            >
                              <EyeOff className="w-4 h-4 text-slate-400" />
                              <span>Hide from Feed</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReportPost(reel.id)}
                              className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                            >
                              <Flag className="w-4 h-4 text-slate-400" />
                              <span>Report Post</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
                  {/* If text-only post, render with rich Facebook status card typography */}
                  {(!reel.media_url || reel.media_type === 'text') ? (
                    <div className="p-6 bg-gradient-to-br from-slate-50 via-sky-50/20 to-slate-50 border-y border-slate-100">
                      <p className="text-slate-800 text-sm sm:text-base font-semibold leading-relaxed whitespace-pre-line">
                        {reel.description || reel.title}
                      </p>
                    </div>
                  ) : (
                    <>
                      {reel.description && (
                        <div className="px-5 py-3 text-xs text-slate-700 leading-relaxed font-medium">
                          {reel.description}
                        </div>
                      )}

                      <div className="w-full bg-slate-950 max-h-[520px] overflow-hidden flex items-center justify-center">
                        {reel.media_type === 'video' ? (
                          <video src={getMediaUrl(reel.media_url)} controls className="max-h-[520px] w-full object-contain" />
                        ) : (
                          <SafeImage src={reel.media_url} alt={reel.title} fallbackType="product" className="max-h-[520px] w-full object-contain" />
                        )}
                      </div>
                    </>
                  )}

                  {/* Action Bar (Likes & Comments Toggle) */}
                  <div className="p-3.5 px-5 flex items-center justify-between border-t border-slate-100 bg-white">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleLikeReel(reel.id)}
                        className={`flex items-center space-x-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          reel.has_liked ? 'text-rose-500' : 'text-slate-600 hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${reel.has_liked ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                        <span>{reel.likes_count || 0} Likes</span>
                      </button>

                      <button
                        onClick={() => setActiveCommentsReelId(activeCommentsReelId === reel.id ? null : reel.id)}
                        className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 text-sky-500" />
                        <span>{reel.comments_count || (reel.comments ? reel.comments.length : 0)} Comments</span>
                      </button>
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400">Campus Stories</span>
                  </div>

                  {/* Interactive Comments Drawer */}
                  {activeCommentsReelId === reel.id && (
                    <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-3">
                      {/* Comments List */}
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                        {reel.comments && reel.comments.length > 0 ? (
                          reel.comments.map((comment, idx) => {
                            const canDeleteComment = (currentUser?.user_id && comment.user_id === currentUser.user_id) ||
                                                     (currentUser?.id && comment.user_id === currentUser.id) ||
                                                     isAuthor ||
                                                     currentUser?.role === 'admin';

                            return (
                            <div key={comment.id || idx} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900">{comment.author_name}</span>
                                  {comment.reply_to_author && (
                                    <span className="text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md flex items-center space-x-1">
                                      <Reply className="w-2.5 h-2.5" />
                                      <span>@{comment.reply_to_author}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-slate-400">
                                    {safeTime(comment.created_at, 'Just now')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingToComment({
                                        reelId: reel.id,
                                        commentId: comment.id,
                                        authorName: comment.author_name,
                                        text: comment.content
                                      });
                                      setTimeout(() => commentInputRef.current?.focus(), 60);
                                    }}
                                    className="text-slate-400 hover:text-sky-600 transition-colors p-0.5 cursor-pointer flex items-center space-x-0.5 text-[11px] font-semibold"
                                    title="Reply to this comment"
                                  >
                                    <Reply className="w-3 h-3" />
                                    <span>Reply</span>
                                  </button>
                                  {canDeleteComment && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReelComment(reel.id, comment.id)}
                                      className="text-slate-300 hover:text-rose-500 transition-colors p-0.5 cursor-pointer"
                                      title="Delete comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-700 leading-relaxed pl-0.5">{comment.content}</p>
                            </div>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-400">
                            No comments yet. Be the first to share your thoughts!
                          </div>
                        )}
                      </div>

                      {/* Replying Indicator Banner */}
                      {replyingToComment && replyingToComment.reelId === reel.id && (
                        <div className="flex items-center justify-between px-3 py-1.5 bg-sky-50 border border-sky-200/80 rounded-xl text-xs text-sky-800">
                          <div className="flex items-center space-x-1.5 overflow-hidden">
                            <Reply className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="truncate">
                              Replying to <strong className="font-bold text-sky-900">@{replyingToComment.authorName}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyingToComment(null)}
                            className="p-1 text-sky-500 hover:text-sky-800 cursor-pointer"
                            title="Cancel reply"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Comment Input Form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handlePostComment(reel.id);
                        }}
                        className="flex items-center space-x-2 pt-2 border-t border-slate-200/60"
                      >
                        <input
                          ref={commentInputRef}
                          type="text"
                          placeholder={replyingToComment && replyingToComment.reelId === reel.id ? `Reply to @${replyingToComment.authorName}...` : "Write a comment on this post..."}
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="flex-1 p-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="submit"
                          disabled={postingComment || !newCommentText.trim()}
                          className="p-2.5 px-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 flex items-center space-x-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{replyingToComment && replyingToComment.reelId === reel.id ? 'Reply' : 'Post'}</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>
                );
              })}

              {reels.filter(r => !hiddenPostIds.includes(r.id)).length === 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                  <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700 text-sm">No campus posts to show</h3>
                  <p className="text-xs text-slate-400 mt-1">Be the first to share a photo, video or thought with campus!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: CAMPUS NOTICE BOARD & LOST & FOUND HUB --- */}
        {activeTab === 'campus' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200">
                    Campus Utility Hub
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>{universityName}</span>
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Campus Notice Board & Lost / Found
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                  Report misplaced student ID cards, phones, ATM cards, and keys to help fellow students recover their items, or check official SUG & faculty campus announcements.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Report Item / Post Notice</span>
                </button>
              </div>
            </div>

            {/* Campus Isolation Security Banner */}
            <div className="p-3.5 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-2xl flex items-start sm:items-center space-x-3 text-xs text-sky-950 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="font-extrabold text-sky-900 block sm:inline">Strict Campus Isolation: </span>
                <span className="text-slate-700">You are viewing verified notices for <strong>{universityName || 'your university'}</strong> only. Students from other universities cannot access, view, or post to your campus notice board.</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Notices</span>
                  <p className="text-lg font-black text-slate-900">{notices.length}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-500 block">Lost Items</span>
                  <p className="text-lg font-black text-rose-700">{notices.filter(n => n.type === 'lost' && n.status === 'open').length} Looking</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Found Items</span>
                  <p className="text-lg font-black text-emerald-700">{notices.filter(n => n.type === 'found' && n.status === 'open').length} Safe</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-sky-500 block">Announcements</span>
                  <p className="text-lg font-black text-sky-700">{notices.filter(n => n.type === 'announcement').length} Active</p>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              {/* Type Switcher */}
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 overflow-x-auto text-xs">
                {[
                  { id: 'all', label: 'All Notices', count: notices.length },
                  { id: 'lost', label: 'Lost Items (Needs Help)', count: notices.filter(n => n.type === 'lost').length },
                  { id: 'found', label: 'Found Items (Claim Here)', count: notices.filter(n => n.type === 'found').length },
                  { id: 'announcement', label: 'Campus Announcements', count: notices.filter(n => n.type === 'announcement').length }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setNoticeType(t.id)}
                    className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                      noticeType === t.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${noticeType === t.id ? 'bg-white/20 text-white' : 'bg-white text-slate-600'}`}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search & Category Pills */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search notice title, student name, matric number, or campus location..."
                    value={noticeSearch}
                    onChange={(e) => setNoticeSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                  {[
                    { id: 'all', label: 'All Categories' },
                    { id: 'id_card', label: 'Student ID Cards' },
                    { id: 'phone_gadget', label: 'Phones & Gadgets' },
                    { id: 'keys', label: 'Keys' },
                    { id: 'wallet_atm', label: 'Wallets & ATMs' },
                    { id: 'books', label: 'Books & Folders' },
                    { id: 'announcement', label: 'Announcements' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setNoticeCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl font-bold transition-colors shrink-0 cursor-pointer text-xs ${
                        noticeCategory === cat.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notices Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  <span>Campus Notices ({filteredNotices.length})</span>
                </h3>
                <span className="text-xs text-slate-400 font-medium">Real-time reports for {universityName}</span>
              </div>

              {filteredNotices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredNotices.map((n) => {
                    const isOwner = n.user_id === currentUser?.user_id;
                    const isClaimed = n.status === 'claimed' || n.status === 'resolved';

                    return (
                      <div
                        key={n.id}
                        className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                          n.type === 'lost'
                            ? 'border-rose-200 hover:border-rose-300'
                            : n.type === 'found'
                              ? 'border-emerald-200 hover:border-emerald-300'
                              : 'border-indigo-200 hover:border-indigo-300'
                        }`}
                      >
                        <div>
                          {/* Image preview (if any) */}
                          {n.image_url && (
                            <div className="h-44 w-full bg-slate-100 relative overflow-hidden">
                              <SafeImage
                                src={n.image_url}
                                alt={n.title}
                                fallbackType="product"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="p-5">
                            {/* Tags Header */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 border ${
                                  n.type === 'lost'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : n.type === 'found'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {n.type === 'lost' && <AlertCircle className="w-3 h-3" />}
                                {n.type === 'found' && <CheckCircle2 className="w-3 h-3" />}
                                {n.type === 'announcement' && <Megaphone className="w-3 h-3" />}
                                <span>{n.type === 'lost' ? 'Lost Item' : n.type === 'found' ? 'Found Item' : 'Announcement'}</span>
                              </span>

                              <div className="flex items-center space-x-1.5 relative">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isClaimed
                                      ? 'bg-slate-100 text-slate-500 line-through'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {isClaimed ? 'Claimed' : 'Active'}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setActiveNoticeMenuId(activeNoticeMenuId === n.id ? null : n.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Notice settings"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {activeNoticeMenuId === n.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-20"
                                      onClick={() => setActiveNoticeMenuId(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                                      {isOwner && (
                                        <>
                                          {!isClaimed && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveNoticeMenuId(null);
                                                handleResolveNotice(n.id);
                                              }}
                                              className="w-full px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                              <span>Mark Claimed</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveNoticeMenuId(null);
                                              handleDeleteNotice(n.id);
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                            <span>Delete Notice</span>
                                          </button>
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveNoticeMenuId(null);
                                          const noticeText = `${n.title}\n${n.description}\nLocation: ${n.location} • ${universityName}`;
                                          if (navigator.clipboard && navigator.clipboard.writeText) {
                                            navigator.clipboard.writeText(noticeText);
                                            setToast({ text: 'Notice details copied to clipboard!', type: 'success' });
                                          } else {
                                            setToast({ text: 'Notice: ' + n.title, type: 'info' });
                                          }
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Copy Details</span>
                                      </button>
                                      {n.user_id && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveNoticeMenuId(null);
                                            handleViewProfile(n.user_id);
                                          }}
                                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                        >
                                          <User className="w-3.5 h-3.5 text-slate-400" />
                                          <span>View Reporter</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveNoticeMenuId(null);
                                          setToast({ text: 'Notice reported for moderator review.', type: 'info' });
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                      >
                                        <Flag className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Report Notice</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Title & Description */}
                            <h4 className="font-extrabold text-base text-slate-900 leading-snug mb-2">
                              {n.title}
                            </h4>

                            <p className="text-xs text-slate-600 leading-relaxed mb-4 line-clamp-3">
                              {n.description}
                            </p>

                            {/* Meta items: Location and Date */}
                            <div className="space-y-1.5 text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4">
                              {n.location && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="font-semibold text-slate-800 truncate">{n.location}</span>
                                </div>
                              )}
                              {n.date_lost_or_found && (
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{n.date_lost_or_found}</span>
                                </div>
                              )}
                            </div>

                            {/* Reporter Info */}
                            <div className="flex items-center space-x-2.5 pt-2 border-t border-slate-100">
                              {n.author_avatar ? (
                                <SafeImage src={n.author_avatar} alt={n.author_name} fallbackType="avatar" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                  {n.author_name?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="overflow-hidden">
                                <span className="text-xs font-bold text-slate-800 block truncate">{n.author_name}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{n.author_department || 'Student'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-5 pt-0 space-y-2">
                          {/* Owner Controls */}
                          {isOwner ? (
                            <div className="flex items-center space-x-2">
                              {!isClaimed && (
                                <button
                                  type="button"
                                  onClick={() => handleResolveNotice(n.id)}
                                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark Claimed</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteNotice(n.id)}
                                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer"
                                title="Delete notice"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {/* WhatsApp Inquire / Claim Button */}
                              {n.contact_phone && (
                                <a
                                  href={`https://wa.me/${n.contact_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Hello ${n.author_name}, I saw your post on CampusLink Notice Board regarding "${n.title}" at ${universityName}. I would like to inquire/claim.`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-xs"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  <span>WhatsApp Reporter</span>
                                </a>
                              )}

                              <div className="flex items-center space-x-2">
                                {/* Direct Call */}
                                {n.contact_phone && (
                                  <a
                                    href={`tel:${n.contact_phone}`}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5"
                                  >
                                    <Phone className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Call</span>
                                  </a>
                                )}

                                {/* CampusLink Chat */}
                                <button
                                  type="button"
                                  onClick={() => handleStartChatWithStudent({
                                    user_id: n.user_id,
                                    full_name: n.author_name,
                                    phone_number: n.contact_phone,
                                    department: n.author_department,
                                    profile_picture_url: n.author_avatar
                                  })}
                                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Chat</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-10">
                  <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800">No notices matched your filter</h4>
                  <p className="text-xs text-slate-500 mt-1">Try changing category or report a new lost/found item.</p>
                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    + Post First Notice
                  </button>
                </div>
              )}
            </div>

            {/* Campus Security & Recovery Tips Card */}
            <div className="p-6 bg-gradient-to-r from-indigo-50 via-sky-50 to-blue-50 rounded-3xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Safety & Verification Protocol</span>
                <h4 className="font-bold text-sm text-slate-900">Found an item or claiming your lost property?</h4>
                <p className="text-xs text-slate-600 max-w-xl">
                  Always arrange handovers in public, well-lit campus areas such as the library quad, security post, or faculty lounge. When claiming, please provide proof of ownership (e.g. matric card, unlock code, or matching serial number).
                </p>
              </div>
              <button
                onClick={() => setReportModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                + Report an Item
              </button>
            </div>

          </div>
        )}

        {/* --- TAB 4: MESSAGES & CAMPUS FRIENDS SYSTEM --- */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {/* Instagram-Style Campus Stories Rail */}
            {!selectedPartner && (
              <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5 text-sky-500" />
                    <span>Campus Stories</span>
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] text-slate-400 font-semibold">{statusGroups.length} active</span>
                    <button
                      type="button"
                      onClick={() => setStatusPrivacyModalOpen(true)}
                      className="text-[11px] text-slate-500 hover:text-sky-600 font-semibold cursor-pointer hidden sm:inline"
                    >
                      Privacy
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-4 overflow-x-auto pb-1 scrollbar-none">
                  {/* 1. My Story (Your Story Bubble) */}
                  {(() => {
                    const selfGroup = statusGroups.find(g => g.is_self);
                    const hasMyStory = Boolean(selfGroup && selfGroup.items && selfGroup.items.length > 0);
                    return (
                      <div className="flex flex-col items-center shrink-0 cursor-pointer group">
                        <div
                          onClick={() => {
                            if (hasMyStory) {
                              const selfIdx = statusGroups.findIndex(g => g.is_self);
                              setActiveStatusViewer({ userIdx: selfIdx !== -1 ? selfIdx : 0, itemIdx: 0 });
                            } else {
                              setCreateStatusModalOpen(true);
                            }
                          }}
                          className={`relative w-14 h-14 rounded-full p-0.5 transition-all flex items-center justify-center bg-slate-50 ${
                            hasMyStory
                              ? 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 shadow-xs shadow-sky-500/25'
                              : 'border-2 border-dashed border-sky-400 group-hover:border-sky-600'
                          }`}
                        >
                          <div className="w-full h-full rounded-full bg-white p-0.5 overflow-hidden flex items-center justify-center">
                            {currentUser?.profile_picture_url ? (
                              <SafeImage
                                src={currentUser.profile_picture_url}
                                alt="Your Story"
                                fallbackType="avatar"
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm">
                                {currentUser?.full_name?.charAt(0) || 'U'}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateStatusModalOpen(true);
                            }}
                            className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs transition-transform active:scale-90"
                            title="Add to story"
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                          </button>
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 mt-1.5">Your Story</span>
                        <span className="text-[9px] text-slate-400">
                          {hasMyStory ? `${selfGroup.items.length} drop${selfGroup.items.length > 1 ? 's' : ''}` : 'Add story'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* 2. Peer Campus Stories (CampusLink Blue & White signature rings, faded when viewed) */}
                  {statusGroups
                    .filter(g => !g.is_self)
                    .map((group) => {
                      const origIdx = statusGroups.findIndex(g => g.user_id === group.user_id);
                      const isUnviewed = group.has_unviewed !== false && !group.all_viewed;
                      return (
                        <div
                          key={group.user_id}
                          onClick={() => {
                            const firstUnviewed = group.items.findIndex(it => !it.is_viewed);
                            setActiveStatusViewer({
                              userIdx: origIdx !== -1 ? origIdx : 0,
                              itemIdx: firstUnviewed !== -1 ? firstUnviewed : 0
                            });
                          }}
                          className="flex flex-col items-center shrink-0 cursor-pointer group"
                        >
                          <div
                            className={`w-14 h-14 rounded-full p-0.5 transition-transform group-hover:scale-105 flex items-center justify-center ${
                              isUnviewed
                                ? 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 shadow-xs shadow-sky-500/25'
                                : 'bg-slate-200 border border-slate-300 opacity-60'
                            }`}
                          >
                            <div className="w-full h-full rounded-full bg-white p-0.5 flex items-center justify-center overflow-hidden">
                              {group.user_avatar ? (
                                <SafeImage
                                  src={group.user_avatar}
                                  alt={group.user_name}
                                  fallbackType="avatar"
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                                  {group.user_name.charAt(0)}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-slate-800 mt-1.5 truncate max-w-[65px] text-center">
                            {group.user_name.split(' ')[0]}
                          </span>
                          <span className={`text-[9px] font-semibold ${isUnviewed ? 'text-sky-600' : 'text-slate-400'}`}>
                            {isUnviewed ? 'New story' : 'Viewed'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}


            {/* Chat Box Container */}
            <div className={`flex flex-col bg-white overflow-hidden ${selectedPartner && messageSubtab === 'chats' ? 'h-[100dvh] md:h-[calc(100vh-17rem)] rounded-none md:rounded-3xl border-0 md:border border-slate-200 shadow-none md:shadow-xs' : 'h-[calc(100vh-17rem)] min-h-[500px] rounded-3xl border border-slate-200 shadow-xs'}`}>
              
              {/* Top Sub-Switcher */}
              <div className={`p-3 sm:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 ${selectedPartner && messageSubtab === 'chats' ? 'hidden md:flex' : 'flex'}`}>
              <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto text-xs">
                <button
                  onClick={() => setMessageSubtab('chats')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                    messageSubtab === 'chats' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Active Chats {conversations.length > 0 && `(${conversations.length})`}</span>
                  {totalUnreadChatCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                      {totalUnreadChatCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setMessageSubtab('friends')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                    messageSubtab === 'friends' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Find Campus Friends ({campusStudents.length})
                </button>

                <button
                  onClick={() => setMessageSubtab('requests')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                    messageSubtab === 'requests' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Friend Requests</span>
                  {pendingRequests.length > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {pendingRequests.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setMessageSubtab('my_friends')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                    messageSubtab === 'my_friends' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Friends ({myFriends.length})
                </button>
              </div>

              {selectedPartner && messageSubtab === 'chats' && (
                <div className="flex items-center space-x-2 text-xs">
                  {selectedPartner.is_ai ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800">CampusLink AI</span>
                      <button
                        type="button"
                        onClick={handleClearAiChat}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-semibold rounded-xl text-[11px] cursor-pointer transition-colors"
                        title="Clear conversation"
                      >
                        Clear Chat
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800">{selectedPartner.partner_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                          {selectedPartner.partner_role || 'Student'}
                        </span>
                      </div>
                      {selectedPartner.partner_role === 'Vendor' && selectedPartner.partner_phone && (
                        <a
                          href={`https://wa.me/${selectedPartner.partner_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 text-[11px]"
                        >
                          Store WhatsApp
                        </a>
                      )}
                      {selectedPartner.partner_role === 'Student' && (
                        <button
                          onClick={() => handleViewProfile(selectedPartner.partner_id)}
                          className="px-2.5 py-1 bg-sky-50 text-sky-700 font-bold rounded-lg hover:bg-sky-100 text-[11px] cursor-pointer"
                        >
                          View Profile
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Subtab Views */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/40">
              
              {/* 1. SUBTAB: ACTIVE CHATS (2-Column Split View) */}
              {messageSubtab === 'chats' && (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  {/* Left Column: Conversations List */}
                  <div className={`w-full md:w-84 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0 overflow-hidden bg-white ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                      {/* PINNED: CampusLink AI Assistant */}
                      <div className="p-2 border-b border-slate-100 bg-gradient-to-b from-blue-50/40 to-white">
                        <button
                          type="button"
                          onClick={handleSelectAiChat}
                          className={`w-full p-2.5 rounded-2xl text-left flex items-center space-x-3 transition-all cursor-pointer border ${
                            selectedPartner?.is_ai
                              ? 'bg-blue-600 text-white shadow-md border-transparent'
                              : 'bg-white hover:bg-blue-50/60 border-blue-100/80 shadow-xs'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                              selectedPartner?.is_ai
                                ? 'bg-white/20 text-white'
                                : 'bg-blue-600 text-white'
                            }`}>
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-black truncate flex items-center space-x-1.5 ${
                                selectedPartner?.is_ai ? 'text-white' : 'text-slate-900'
                              }`}>
                                <span>CampusLink AI</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                                  selectedPartner?.is_ai ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  AI
                                </span>
                              </span>
                              <span className={`text-[10px] font-semibold flex items-center space-x-1 ${
                                selectedPartner?.is_ai ? 'text-blue-100' : 'text-blue-600'
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                <span>Online 24/7</span>
                              </span>
                            </div>
                            <p className={`text-[11px] truncate mt-0.5 ${
                              selectedPartner?.is_ai ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                              {aiMessages.length > 0
                                ? (aiMessages[aiMessages.length - 1].content || 'Ask anything about academics & campus')
                                : 'Academics, CGPA, questions & advice'}
                            </p>
                          </div>
                        </button>
                      </div>

                        {conversations.length > 0 ? (
                        conversations.map((c) => {
                          const partnerStoryIdx = statusGroups.findIndex(g => String(g.user_id) === String(c.partner_id));
                          const hasStory = partnerStoryIdx !== -1;
                          const storyGroup = hasStory ? statusGroups[partnerStoryIdx] : null;
                          const hasUnviewedStory = hasStory && (storyGroup.has_unviewed !== false && !storyGroup.all_viewed);

                          return (
                            <button
                              key={c.partner_id}
                              onClick={() => handleSelectPartner(c)}
                              className={`w-full p-3.5 sm:p-4 text-left flex items-start space-x-3 transition-colors cursor-pointer ${
                                selectedPartner?.partner_id === c.partner_id ? 'bg-sky-50/80 border-l-4 border-sky-500' : 'hover:bg-slate-50'
                              }`}
                            >
                              {/* WhatsApp-Style Clickable Story Avatar */}
                              <div
                                onClick={(e) => {
                                  if (hasStory) {
                                    e.stopPropagation();
                                    const firstUnviewed = storyGroup.items.findIndex(it => !it.is_viewed);
                                    setActiveStatusViewer({
                                      userIdx: partnerStoryIdx,
                                      itemIdx: firstUnviewed !== -1 ? firstUnviewed : 0
                                    });
                                  }
                                }}
                                title={hasStory ? `Tap to view ${c.partner_name}'s story` : ''}
                                className={`relative shrink-0 rounded-2xl transition-all ${
                                  hasStory
                                    ? `p-0.5 cursor-pointer ${
                                        hasUnviewedStory
                                          ? 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 shadow-xs shadow-sky-500/25 hover:scale-105'
                                          : 'bg-slate-200 border border-slate-300 opacity-70'
                                      }`
                                    : ''
                                }`}
                              >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-sky-100 flex items-center justify-center">
                                  {c.partner_avatar ? (
                                    <SafeImage src={c.partner_avatar} alt={c.partner_name} fallbackType="avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0">
                                      {c.partner_name?.charAt(0) || 'U'}
                                    </div>
                                  )}
                                </div>
                                {/* Online presence dot */}
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${c.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                {c.unread_count > 0 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                                    {c.unread_count}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-900 truncate">{c.partner_name}</span>
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {c.partner_role}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.last_message}</p>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-8 text-center text-xs text-slate-400">
                          <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p className="font-bold text-slate-600">No active chats yet</p>
                          <p className="mt-1">Connect with classmates in "Find Campus Friends" or chat with sellers in the marketplace!</p>
                          <button
                            onClick={() => setMessageSubtab('friends')}
                            className="mt-3 px-3 py-1.5 bg-sky-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Explore Campus Directory
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Chat View */}
                  <div className={`flex-1 flex flex-col justify-between overflow-hidden bg-white ${selectedPartner ? 'flex' : 'hidden md:flex'}`}>
                    {selectedPartner ? (
                      selectedPartner.is_ai ? (
                        <>
                          {/* AI Chat Header */}
                          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedPartner(null)}
                                className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl shrink-0 cursor-pointer"
                                title="Back to conversation list"
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">CampusLink AI Assistant</h4>
                                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold shrink-0">24/7 AI</span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate flex items-center space-x-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                  <span>Online • Always available</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                type="button"
                                onClick={handleClearAiChat}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors"
                                title="Clear conversation"
                              >
                                Clear Chat
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPartner(null)}
                                className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                                title="Close chat"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* AI Chat Messages */}
                          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                            {aiMessages.length > 0 ? (
                              aiMessages.map((msg, idx) => (
                                <div
                                  key={msg.id || idx}
                                  className={`flex ${
                                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mr-2 shadow-xs mt-0.5">
                                      <Bot className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div
                                    className={`max-w-sm sm:max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                                      msg.sender === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    <span className={`block text-[9px] mt-1.5 text-right ${
                                      msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                                    }`}>
                                      {safeTime(msg.created_at, 'Just now')}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-12 px-4 text-center max-w-lg mx-auto">
                                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
                                  <Bot className="w-8 h-8" />
                                </div>
                                <h3 className="text-base font-black text-slate-800">CampusLink AI Assistant</h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  Ask me anything about academics, definitions, reply suggestions, CGPA, math, or campus life!
                                </p>

                                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                                  {[
                                    { text: "What is a noun?", icon: "📚" },
                                    { text: "How do I reply to: 'Can you send me the lecture slides?'", icon: "💬" },
                                    { text: "How can I maintain a 5.0 first-class CGPA?", icon: "🎓" },
                                    { text: "What is 20% of ₦80,000?", icon: "🔢" }
                                  ].map((promptItem, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => handleSendAiMessage(promptItem.text)}
                                      className="p-2.5 bg-white hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-xl text-left text-[11px] text-slate-700 transition-all cursor-pointer shadow-2xs flex items-start space-x-2"
                                    >
                                      <span className="text-sm">{promptItem.icon}</span>
                                      <span className="font-medium line-clamp-2">{promptItem.text}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isAiTyping && (
                              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                  <Sparkles className="w-4 h-4 animate-spin" />
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none text-slate-600 text-xs shadow-xs flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse delay-75" />
                                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-150" />
                                  <span className="font-medium text-slate-600 ml-1">CampusLink AI is formulating a response...</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* AI Chat Input Bar */}
                          <div className="p-3 bg-white border-t border-slate-200">
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                              <input
                                type="text"
                                placeholder="Ask CampusLink AI anything (academics, definitions, reply ideas, math)..."
                                value={newMsgText}
                                onChange={(e) => setNewMsgText(e.target.value)}
                                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs text-slate-800 focus:outline-none"
                              />

                              <button
                                type="submit"
                                disabled={isAiTyping || !newMsgText.trim()}
                                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-colors disabled:opacity-50 shadow-xs"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Peer Chat Mobile/Desktop WhatsApp-style Header */}
                          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedPartner(null)}
                                className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl shrink-0 cursor-pointer relative"
                                title="Back to conversations"
                              >
                                <ChevronLeft className="w-5 h-5" />
                                {otherUnreadChatCount > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-[9px] font-black w-4 h-4 flex items-center justify-center shadow-xs">
                                    {otherUnreadChatCount}
                                  </span>
                                )}
                              </button>
                              {(() => {
                                const partnerPid = selectedPartner.partner_id || selectedPartner.id || selectedPartner.user_id;
                                const headerStoryIdx = statusGroups.findIndex(g => String(g.user_id) === String(partnerPid));
                                const headerHasStory = headerStoryIdx !== -1;
                                const headerStoryGroup = headerHasStory ? statusGroups[headerStoryIdx] : null;
                                const headerHasUnviewed = headerHasStory && (headerStoryGroup.has_unviewed !== false && !headerStoryGroup.all_viewed);

                                return (
                                  <div
                                    onClick={() => {
                                      if (headerHasStory) {
                                        const firstUnviewed = headerStoryGroup.items.findIndex(it => !it.is_viewed);
                                        setActiveStatusViewer({
                                          userIdx: headerStoryIdx,
                                          itemIdx: firstUnviewed !== -1 ? firstUnviewed : 0
                                        });
                                      }
                                    }}
                                    title={headerHasStory ? `Tap to view ${selectedPartner.partner_name || selectedPartner.name || 'user'}'s story` : ''}
                                    className={`relative shrink-0 rounded-2xl transition-all ${
                                      headerHasStory
                                        ? `p-0.5 cursor-pointer ${
                                            headerHasUnviewed
                                              ? 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 shadow-xs shadow-sky-500/25 hover:scale-105'
                                              : 'bg-slate-200 border border-slate-300 opacity-70'
                                          }`
                                        : ''
                                    }`}
                                  >
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-sky-100 flex items-center justify-center">
                                      {selectedPartner.partner_avatar || selectedPartner.avatar_url || selectedPartner.avatar ? (
                                        <SafeImage
                                          src={selectedPartner.partner_avatar || selectedPartner.avatar_url || selectedPartner.avatar}
                                          alt={selectedPartner.partner_name || selectedPartner.name || 'User'}
                                          fallbackType="avatar"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-sm">
                                          {(selectedPartner.partner_name || selectedPartner.name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                                  </div>
                                );
                              })()}
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {selectedPartner.partner_name || selectedPartner.name || selectedPartner.full_name || 'Chat Partner'}
                                  </h4>
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                                    (selectedPartner.partner_role || selectedPartner.role) === 'Vendor' || (selectedPartner.partner_role || selectedPartner.role) === 'Seller'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : (selectedPartner.partner_role || selectedPartner.role) === 'Agent'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-sky-100 text-sky-800'
                                  }`}>
                                    {selectedPartner.partner_role || selectedPartner.role || 'Student'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate flex items-center space-x-1">
                                  {(() => {
                                    const presence = formatLastSeen(selectedPartner.last_seen, selectedPartner.is_online);
                                    return (
                                      <>
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 inline-block ${presence.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                        <span>{presence.label}</span>
                                      </>
                                    );
                                  })()}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              {(selectedPartner.phone || selectedPartner.whatsapp_phone) && (
                                <a
                                  href={`https://wa.me/${(selectedPartner.whatsapp_phone || selectedPartner.phone || '').replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-[11px] flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                                  title="Chat on WhatsApp"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedPartner(null)}
                                className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                                title="Close chat"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Cross-Profile Unread Messages Notice Banner */}
                          {otherUnreadChatCount > 0 && (
                            <div className="bg-sky-50/90 border-b border-sky-100 px-3 py-1.5 flex items-center justify-between text-xs text-sky-800 shrink-0">
                              <span className="flex items-center space-x-1.5 truncate font-medium">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                                <span className="truncate">
                                  You have {otherUnreadChatCount} unread message{otherUnreadChatCount > 1 ? 's' : ''} in other chats
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedPartner(null)}
                                className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-100/80 px-2 py-0.5 rounded-lg ml-2 shrink-0 cursor-pointer transition-colors"
                              >
                                View chats &rarr;
                              </button>
                            </div>
                          )}

                          {/* Chat Messages */}
                          <div ref={chatContainerRef} className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-3 overscroll-contain scroll-smooth">
                          {isLoadingChatMessages && chatMessages.length === 0 ? (
                            <div className="space-y-4 py-3 animate-pulse">
                              <div className="flex justify-start">
                                <div className="h-10 bg-slate-200/80 rounded-2xl rounded-bl-none w-48 shadow-2xs" />
                              </div>
                              <div className="flex justify-end">
                                <div className="h-14 bg-sky-200/70 rounded-2xl rounded-br-none w-56 shadow-2xs" />
                              </div>
                              <div className="flex justify-start">
                                <div className="h-8 bg-slate-200/80 rounded-2xl rounded-bl-none w-36 shadow-2xs" />
                              </div>
                              <div className="flex justify-end">
                                <div className="h-12 bg-sky-200/70 rounded-2xl rounded-br-none w-44 shadow-2xs" />
                              </div>
                              <div className="flex justify-center my-3">
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-white/90 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
                                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                                  <span className="font-semibold">Loading messages...</span>
                                </div>
                              </div>
                            </div>
                          ) : chatMessages.length > 0 ? (
                            chatMessages.map((msg) => {
                              const isMine = msg.sender_id === currentUser.user_id;
                              const chatReply = parseChatReply(msg);
                              const isHighlighted = highlightedMessageId === msg.id || String(highlightedMessageId) === String(msg.id);

                              return (
                                <div
                                  key={msg.id}
                                  id={`chat-msg-${msg.id}`}
                                  data-msg-id={msg.id}
                                  className={`relative flex items-center group select-none transition-all duration-300 ${
                                    isMine ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  {/* Swipe to Reply Backing Indicator */}
                                  <div className={`absolute ${isMine ? 'right-2' : 'left-2'} text-sky-500 opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none flex items-center space-x-1 text-[11px] font-bold`}>
                                    <Reply className="w-4 h-4 text-sky-500" />
                                  </div>

                                  <motion.div
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 65 }}
                                    dragElastic={0.25}
                                    onDragEnd={(e, info) => {
                                      if (info.offset.x > 35) {
                                        handleStartReply(msg);
                                      }
                                    }}
                                    className={`relative max-w-sm sm:max-w-md p-3 rounded-2xl text-xs leading-relaxed transition-all cursor-grab active:cursor-grabbing ${
                                      isHighlighted ? 'ring-4 ring-sky-400 ring-offset-2 scale-[1.02] shadow-lg shadow-sky-500/25 z-20' : ''
                                    } ${
                                      isMine
                                        ? 'bg-sky-500 text-white rounded-br-none shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                                    }`}
                                  >
                                    {/* Desktop Hover Quick-Reply Button */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartReply(msg);
                                      }}
                                      className={`hidden group-hover:flex absolute -top-2 ${
                                        isMine ? '-left-6' : '-right-6'
                                      } w-5 h-5 rounded-full bg-white border border-slate-200 shadow-2xs text-slate-400 hover:text-sky-600 items-center justify-center transition-all cursor-pointer z-10`}
                                      title="Reply to this message"
                                    >
                                      <Reply className="w-3 h-3" />
                                    </button>

                                    {/* Quoted Message Card (Clickable to jump to original message) */}
                                    {(msg.reply_to_text || msg.reply_to_sender || chatReply) && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const targetId = msg.reply_to_id || chatReply?.replyToId;
                                          if (targetId) {
                                            handleScrollToQuotedMessage(targetId);
                                          }
                                        }}
                                        className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 transition-all text-left cursor-pointer hover:opacity-85 active:scale-[0.98] ${
                                          isMine
                                            ? 'bg-sky-600/60 border-white text-sky-100 shadow-inner'
                                            : 'bg-slate-100 border-sky-500 text-slate-700 hover:bg-slate-200/80'
                                        }`}
                                        title="Click to jump to original message"
                                      >
                                        <div className="flex items-center space-x-1 font-bold text-[10px] mb-0.5">
                                          <Reply className="w-2.5 h-2.5 shrink-0" />
                                          <span>{msg.reply_to_sender || chatReply?.replyToSender || 'Campus Peer'}</span>
                                        </div>
                                        <p className="truncate opacity-90">{msg.reply_to_text || chatReply?.replyToText || 'Original message'}</p>
                                      </div>
                                    )}

                                    {/* Bubble Body Content */}
                                    {chatReply ? (
                                      <p className="whitespace-pre-wrap break-words">{chatReply.text}</p>
                                    ) : parseStatusReply(msg) ? (
                                      <StoryReplyBubble
                                        msg={msg}
                                        isMine={isMine}
                                        onStoryClick={(statusId) => {
                                          const gIdx = statusGroups.findIndex(g => g.items?.some(it => it.id === statusId));
                                          if (gIdx !== -1) {
                                            const iIdx = statusGroups[gIdx].items.findIndex(it => it.id === statusId);
                                            setActiveStatusViewer({ userIdx: gIdx, itemIdx: iIdx !== -1 ? iIdx : 0 });
                                          }
                                        }}
                                      />
                                    ) : msg.message_type === 'audio' ? (
                                      <div className="flex items-center space-x-3 py-1">
                                        <button
                                          type="button"
                                          onClick={() => handlePlayAudio(msg.id, msg.media_url)}
                                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                            isMine ? 'bg-white text-sky-600 hover:bg-sky-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                          }`}
                                        >
                                          {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                        </button>
                                        <div>
                                          <div className="flex items-center space-x-1 mb-1">
                                            {[4, 8, 14, 18, 10, 16, 8, 12, 14, 10, 6, 12, 8].map((h, i) => (
                                              <span
                                                key={i}
                                                className={`w-1 rounded-full transition-all ${
                                                  playingAudioId === msg.id
                                                    ? 'animate-pulse bg-emerald-400'
                                                    : isMine
                                                      ? 'bg-sky-200'
                                                      : 'bg-slate-300'
                                                }`}
                                                style={{ height: `${h}px` }}
                                              />
                                            ))}
                                          </div>
                                          <span className={`text-[10px] font-semibold ${isMine ? 'text-sky-100' : 'text-slate-500'}`}>
                                            🎤 Voice Note ({msg.duration ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, '0')}` : '0:15'})
                                          </span>
                                        </div>
                                      </div>
                                    ) : msg.message_type === 'image' ? (
                                      <div className="space-y-1.5">
                                        <SafeImage
                                          src={msg.media_url}
                                          alt="Shared in chat"
                                          fallbackType="product"
                                          className="rounded-xl max-h-60 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                          onClick={() => window.open(getMediaUrl(msg.media_url), '_blank')}
                                        />
                                        {msg.content && msg.content !== 'Photo' && <p>{msg.content}</p>}
                                      </div>
                                    ) : msg.message_type === 'video' ? (
                                      <div className="space-y-1.5">
                                        <video
                                          src={msg.media_url}
                                          controls
                                          className="rounded-xl max-h-64 w-full bg-black"
                                        />
                                        {msg.content && msg.content !== 'Video' && <p>{msg.content}</p>}
                                      </div>
                                    ) : (
                                      <p>{msg.content || msg.text}</p>
                                    )}
                                    <div className={`flex items-center justify-end space-x-1 text-[9px] mt-1 ${
                                      isMine ? 'text-sky-100' : 'text-slate-400'
                                    }`}>
                                      <span>{safeTime(msg.created_at, 'Just now')}</span>
                                      {isMine && (
                                        <span className="inline-flex items-center ml-0.5">
                                          {msg.is_optimistic ? (
                                            <Clock className="w-2.5 h-2.5 opacity-70 animate-pulse" />
                                          ) : msg.is_read ? (
                                            <CheckCheck className="w-3 h-3 text-sky-200" />
                                          ) : (
                                            <Check className="w-2.5 h-2.5 opacity-80" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-20 text-center text-xs text-slate-400">
                              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                              <p className="font-bold text-slate-600">No messages exchanged yet</p>
                              <p className="mt-1">Say hello to {selectedPartner.partner_name} to start your campus conversation!</p>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Messaging Lock & Friend Request Guard */}
                        {selectedPartner.partner_role === 'Student' && selectedPartner.is_friend === false && selectedPartner.friendship_status !== 'friends' ? (
                          <div className="p-4 bg-amber-50 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center space-x-2 text-xs text-amber-900 font-medium">
                              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                              <span>
                                Messaging is locked. You can chat with <strong>{selectedPartner.partner_name}</strong> once they accept your friend request.
                              </span>
                            </div>
                            <button
                              onClick={() => handleSendFriendRequest(selectedPartner.partner_id)}
                              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
                            >
                              Send Friend Request
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Message Input Form & VN Voice Recorder */}
                            <div className="p-3 bg-white border-t border-slate-200">
                              {/* Quoted Swipe-to-Reply Banner */}
                              {replyingToMessage && (
                                <div className="flex items-center justify-between px-3.5 py-2 bg-sky-50 border border-sky-200 rounded-2xl mb-2.5 text-xs shadow-2xs">
                                  <div className="flex items-center space-x-2.5 min-w-0">
                                    <div className="w-1 h-7 rounded-full bg-sky-500 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="flex items-center space-x-1 text-sky-700 font-bold text-[11px]">
                                        <Reply className="w-3 h-3" />
                                        <span>Replying to {replyingToMessage.sender_name}</span>
                                      </div>
                                      <p className="text-slate-600 truncate text-[11px]">
                                        {replyingToMessage.preview}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setReplyingToMessage(null)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer shrink-0 ml-2"
                                    title="Cancel reply"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              {isRecordingAudio ? (
                                <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-2xl p-2 px-4">
                                  <div className="flex items-center space-x-3">
                                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                                    <span className="text-xs font-bold text-rose-700">
                                      Recording Voice Note: {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={handleCancelRecordingAudio}
                                      className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                                      title="Cancel recording"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleStopAndSendAudio}
                                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      <span>Send VN</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                                  {/* Hidden Attachment Input for Photos & Videos */}
                                  <input
                                    ref={chatMediaInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleChatMediaSelect}
                                    className="hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => chatMediaInputRef.current?.click()}
                                    title="Attach Photo or Video"
                                    className="p-2.5 bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 rounded-xl transition-colors cursor-pointer"
                                  >
                                    <Paperclip className="w-4 h-4" />
                                  </button>

                                  <input
                                    ref={chatInputRef}
                                    type="text"
                                    placeholder={replyingToMessage ? `Replying to ${replyingToMessage.sender_name}...` : `Message ${selectedPartner.partner_name}...`}
                                    value={newMsgText}
                                    onChange={(e) => setNewMsgText(e.target.value)}
                                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                                  />

                                  {/* Voice Note Button */}
                                  <button
                                    type="button"
                                    onClick={handleStartRecordingAudio}
                                    title="Record Voice Note"
                                    className="p-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-xl transition-colors cursor-pointer"
                                  >
                                    <Mic className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="submit"
                                    disabled={!newMsgText.trim()}
                                    className="p-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                </form>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                        <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
                        <h4 className="text-sm font-bold text-slate-700">Select a peer or conversation to start chatting</h4>
                        <p className="text-xs text-slate-400 mt-1">Connect with sellers or classmates across campus.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. SUBTAB: FIND CAMPUS FRIENDS (Full-Width Directory) */}
              {messageSubtab === 'friends' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search and Role Filter Header */}
                  <div className="p-4 bg-white border-b border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search users by name, university, department, or seller store..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs">
                        <button
                          onClick={() => setFriendsFilter('all')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                            friendsFilter === 'all'
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          All Members ({campusStudents.length})
                        </button>
                        <button
                          onClick={() => setFriendsFilter('students')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                            friendsFilter === 'students'
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          Students
                        </button>
                        <button
                          onClick={() => setFriendsFilter('sellers')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                            friendsFilter === 'sellers'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          Sellers & Merchants
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cards Directory */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {filteredStudents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredStudents.map((stud) => {
                          const isSeller = stud.is_seller || stud.role === 'vendor';
                          return (
                            <div
                              key={stud.user_id}
                              className="p-5 rounded-3xl border border-slate-200 bg-white hover:shadow-md hover:border-sky-200 transition-all flex flex-col justify-between"
                            >
                              <div>
                                {/* Profile Header */}
                                <div className="flex items-start space-x-3.5">
                                  {stud.profile_picture_url ? (
                                    <SafeImage
                                      src={stud.profile_picture_url}
                                      alt={stud.full_name}
                                      fallbackType="avatar"
                                      className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-xs shrink-0"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 text-white font-black flex items-center justify-center text-lg shadow-xs shrink-0">
                                      {stud.full_name.charAt(0)}
                                    </div>
                                  )}

                                  <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center space-x-1">
                                      <h4 className="font-bold text-sm text-slate-900 truncate">{stud.full_name}</h4>
                                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    </div>

                                    {/* Role Badge */}
                                    <div className="mt-1">
                                      {isSeller ? (
                                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                          <ShoppingBag className="w-3 h-3 text-amber-700" />
                                          <span>Campus Seller ({stud.business_name || 'Store'})</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200">
                                          <GraduationCap className="w-3 h-3 text-sky-600" />
                                          <span>Verified Student</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* University Name */}
                                    <div className="text-xs text-slate-500 font-semibold flex items-center space-x-1 mt-1">
                                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{stud.university_name || universityName}</span>
                                    </div>

                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {stud.department} • {stud.level}
                                    </div>
                                  </div>
                                </div>

                                {/* Bio Quote */}
                                <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                                  "{stud.bio || (isSeller ? 'Verified seller on campus with active products & services.' : 'Student connecting on CampusLink.')}"
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                <button
                                  onClick={() => handleViewProfile(stud.user_id)}
                                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Profile</span>
                                </button>

                                <div className="flex items-center space-x-1.5">
                                  {stud.friendship_status === 'friends' ? (
                                    <>
                                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl flex items-center space-x-1">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Friends</span>
                                      </span>
                                      <button
                                        onClick={() => handleStartChatWithStudent(stud)}
                                        className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs relative"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>Chat</span>
                                        {getUnreadCountForUser(stud.user_id) > 0 && (
                                          <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full shadow-xs animate-pulse">
                                            {getUnreadCountForUser(stud.user_id)}
                                          </span>
                                        )}
                                      </button>
                                    </>
                                  ) : stud.friendship_status === 'request_sent' ? (
                                    <button
                                      onClick={() => handleCancelOrRemoveFriend(stud.user_id)}
                                      className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-rose-50 text-amber-800 hover:text-rose-700 border border-amber-200 text-xs font-bold cursor-pointer transition-colors"
                                      title="Click to cancel pending request"
                                    >
                                      Request Sent (Cancel)
                                    </button>
                                  ) : stud.friendship_status === 'request_received' ? (
                                    <button
                                      onClick={() => handleAcceptFriendRequest(stud.request_id)}
                                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center space-x-1"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Accept</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSendFriendRequest(stud.user_id)}
                                      className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      <span>Add Friend</span>
                                    </button>
                                  )}

                                  {isSeller && stud.friendship_status !== 'friends' && (
                                    <button
                                      onClick={() => handleStartVendorChat({
                                        vendor_user_id: stud.user_id,
                                        vendor_name: stud.business_name || stud.full_name,
                                        vendor_phone: stud.phone_number,
                                        vendor_location: stud.hostel
                                      })}
                                      className="px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                                      title="Chat with Seller"
                                    >
                                      <ShoppingBag className="w-3 h-3 text-amber-600" />
                                      <span>Chat Seller</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-10 max-w-md mx-auto">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-800">No members match your search</h4>
                        <p className="text-xs text-slate-500 mt-1">Try clearing filters or search for another department or university.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. SUBTAB: FRIEND REQUESTS (Full-Width View) */}
              {messageSubtab === 'requests' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm text-slate-900">Pending Incoming Friend Requests ({pendingRequests.length})</h3>
                      <span className="text-xs text-slate-400">Accept requests to connect and chat</span>
                    </div>

                    {pendingRequests.length > 0 ? (
                      pendingRequests.map((req) => (
                        <div key={req.request_id} className="p-5 rounded-3xl border border-sky-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start space-x-3.5">
                            {req.sender_avatar ? (
                              <SafeImage src={req.sender_avatar} alt={req.sender_name} fallbackType="avatar" className="w-12 h-12 rounded-2xl object-cover border border-sky-200 shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black flex items-center justify-center text-base shrink-0">
                                {req.sender_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-bold text-sm text-slate-900">{req.sender_name}</h4>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                                  {req.sender_role === 'vendor' ? 'Campus Merchant' : 'Student'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {req.sender_department} • {req.sender_level} • {req.sender_university || universityName}
                              </p>
                              <p className="text-xs text-slate-600 mt-1 italic">
                                "{req.sender_bio || 'Wants to connect with you on CampusLink.'}"
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleAcceptFriendRequest(req.request_id)}
                              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center space-x-1.5 shadow-xs"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Accept Request</span>
                            </button>

                            <button
                              onClick={() => handleDeclineFriendRequest(req.request_id)}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                            >
                              Decline
                            </button>

                            <button
                              onClick={() => handleViewProfile(req.sender_id)}
                              className="p-2 text-slate-400 hover:text-slate-800 rounded-xl cursor-pointer"
                              title="View Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8">
                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <h4 className="font-bold text-slate-800">No pending friend requests</h4>
                        <p className="text-xs text-slate-500 mt-1">When students or sellers send you friend requests, they will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. SUBTAB: MY FRIENDS (Full-Width Grid) */}
              {messageSubtab === 'my_friends' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm text-slate-900">Connected Campus Friends ({myFriends.length})</h3>
                      <span className="text-xs text-slate-400">Directly message any of your accepted friends</span>
                    </div>

                    {myFriends.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {myFriends.map((f) => (
                          <div key={f.id} className="p-4 rounded-3xl bg-white border border-slate-200 hover:shadow-xs transition-all flex items-center justify-between">
                            <div className="flex items-center space-x-3 overflow-hidden">
                              {f.profile_picture_url ? (
                                <SafeImage src={f.profile_picture_url} alt={f.full_name} fallbackType="avatar" className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 font-black flex items-center justify-center text-sm shrink-0">
                                  {f.full_name.charAt(0)}
                                </div>
                              )}
                              <div className="overflow-hidden">
                                <span className="font-bold text-xs text-slate-900 block truncate">{f.full_name}</span>
                                <span className="text-[11px] text-slate-500 block truncate">{f.department} • {f.level}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{f.university_name || universityName}</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0 ml-2">
                              <button
                                onClick={() => handleViewProfile(f.id)}
                                className="p-2 text-slate-400 hover:text-slate-800 rounded-xl cursor-pointer"
                                title="View Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartChatWithStudent(f)}
                                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs flex items-center space-x-1.5 relative"
                              >
                                <span>Chat</span>
                                {getUnreadCountForUser(f.id || f.user_id) > 0 && (
                                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full shadow-xs animate-pulse">
                                    {getUnreadCountForUser(f.id || f.user_id)}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8">
                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <h4 className="font-bold text-slate-800">No connected campus friends yet</h4>
                        <p className="text-xs text-slate-500 mt-1">Explore "Find Campus Friends" to connect with peers and merchants!</p>
                        <button
                          onClick={() => setMessageSubtab('friends')}
                          className="mt-3 px-4 py-2 bg-sky-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Discover Peers
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

        {/* --- TAB 5: PROFILE & SETTINGS --- */}
        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Profile & Settings</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage your student credentials, hostel residence, and account security.</p>
            </div>

            {/* Profile Photo & Summary Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 pb-6 border-b border-slate-100">
                <div className="relative self-start group">
                  {currentUser?.profile_picture_url ? (
                    <SafeImage
                      src={currentUser.profile_picture_url}
                      alt={currentUser.full_name}
                      fallbackType="avatar"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-sky-500 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black text-3xl flex items-center justify-center shadow-md">
                      {currentUser?.full_name?.charAt(0) || 'S'}
                    </div>
                  )}

                  {/* Hidden File Input */}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-2 -right-2 p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-md cursor-pointer transition-transform group-hover:scale-110"
                    title="Change Profile Picture"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold text-slate-900">{currentUser?.full_name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-sky-600" />
                      <span>Verified Student</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{currentUser?.email} {currentUser?.phone_number && `• ${currentUser.phone_number}`}</p>
                  <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                    "{currentUser?.bio || 'Add a short bio below to introduce yourself to your campus community.'}"
                  </p>
                </div>
              </div>

              {/* Student Academic & Location Quick Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Institution</span>
                  <p className="font-bold text-slate-800 mt-1 truncate">{universityName}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <p className="font-bold text-slate-800 mt-1 truncate">{currentUser?.department || 'Not set'}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Level</span>
                  <p className="font-bold text-slate-800 mt-1">{currentUser?.level || '100L'}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Hostel Room</span>
                  <p className="font-bold text-slate-800 mt-1 truncate">{currentUser?.hostel || 'Not set'}</p>
                </div>
              </div>

              {/* Student Community Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => { setActiveTab('messages'); setMessageSubtab('my_friends'); }}
                  className="p-3.5 rounded-2xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-100 text-left transition-colors cursor-pointer"
                >
                  <span className="text-[10px] uppercase font-bold text-sky-600 block">Connected Friends</span>
                  <p className="font-black text-sky-900 text-sm mt-0.5">{(myFriends || []).length} Connected Peers</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('messages'); setMessageSubtab('requests'); }}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Friend Requests</span>
                  <p className="font-black text-slate-800 text-sm mt-0.5">{(pendingRequests || []).length} Incoming</p>
                </button>
                <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
                  <span className="text-[10px] uppercase font-bold text-sky-600 block">Campus Marketplace</span>
                  <p className="font-black text-sky-900 text-sm mt-0.5">{(myOrders || []).length} Completed Orders</p>
                </div>
              </div>
            </div>

            {/* Edit Profile Form */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Profile Information</h3>
              </div>
              <p className="text-xs text-slate-500">Keep your academic details and hostel room number current so vendors can deliver accurately.</p>

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +2348012345678"
                      value={profileForm.phone_number}
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Academic Level</label>
                    <select
                      value={profileForm.level}
                      onChange={(e) => setProfileForm({ ...profileForm, level: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Select Level</option>
                      <option value="100L">100 Level</option>
                      <option value="200L">200 Level</option>
                      <option value="300L">300 Level</option>
                      <option value="400L">400 Level</option>
                      <option value="500L">500 Level</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hostel Residence & Room</label>
                  <input
                    type="text"
                    placeholder="e.g. Moremi Hall, Room B12"
                    value={profileForm.hostel}
                    onChange={(e) => setProfileForm({ ...profileForm, hostel: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Student Bio</label>
                  <textarea
                    rows={2}
                    placeholder="Share what you study, your hobbies, or what skills you offer on campus..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Security & Password</h3>
              </div>
              <p className="text-xs text-slate-500">Ensure your student account is using a secure password (minimum 6 characters).</p>

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 6 characters"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Re-enter new password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {changingPassword ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* Logout Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 flex items-center justify-between shadow-xs">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Sign Out of CampusLink</h4>
                <p className="text-xs text-slate-500 mt-0.5">End your current session on this browser.</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>

          </div>
        )}

      </main>

      {/* --- STUDENT FULL PROFILE POPUP MODAL --- */}
      <AnimatePresence>
        {profileModalOpen && selectedProfile && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative border border-slate-200"
            >
              {/* Header Gradient */}
              <div className="h-28 bg-gradient-to-r from-sky-400 to-blue-600 relative p-4 flex justify-end">
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card Body */}
              <div className="p-6 pt-0 relative">
                {/* Avatar */}
                <div className="-mt-12 mb-4 flex items-end justify-between">
                  {selectedProfile.profile_picture_url ? (
                    <SafeImage
                      src={selectedProfile.profile_picture_url}
                      alt={selectedProfile.full_name}
                      fallbackType="avatar"
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-sky-500 border-4 border-white text-white font-black text-3xl flex items-center justify-center shadow-md">
                      {selectedProfile.full_name.charAt(0)}
                    </div>
                  )}

                  <div className="flex flex-col items-end space-y-1">
                    {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 0 && (
                      <span className="text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-2xs animate-pulse">
                        <MessageSquare className="w-3 h-3 text-rose-500" />
                        <span>{getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id)} new chat{getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 1 ? 's' : ''}</span>
                      </span>
                    )}
                    {selectedProfile.role === 'vendor' || selectedProfile.is_seller ? (
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center space-x-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                        <span>Campus Seller</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full flex items-center space-x-1">
                        <GraduationCap className="w-3.5 h-3.5 text-sky-600" />
                        <span>Verified Student</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Name & Academic / Store info */}
                <h3 className="text-xl font-black text-slate-900">{selectedProfile.full_name}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedProfile.university_name || universityName}</span>
                  <span>•</span>
                  <span>{selectedProfile.department} ({selectedProfile.level})</span>
                </p>

                {selectedProfile.business_name && (
                  <div className="mt-2 text-xs font-bold text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-200 flex items-center space-x-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Store: {selectedProfile.business_name}</span>
                  </div>
                )}

                {/* Bio */}
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedProfile.bio || (selectedProfile.role === 'vendor' ? 'Verified campus merchant offering products and services.' : 'Passionate student on CampusLink connecting with peers.')}"
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Hostel / Location</span>
                    <span className="font-bold text-slate-800 truncate block">{selectedProfile.hostel || 'On Campus'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Campus Friends</span>
                    <span className="font-bold text-sky-700">{selectedProfile.friends_count || 0} Connected</span>
                  </div>
                </div>

                {/* Direct Phone / Contact Bar */}
                {selectedProfile.phone_number && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-slate-700 font-medium">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{selectedProfile.phone_number}</span>
                    </div>
                    <a
                      href={`https://wa.me/${selectedProfile.phone_number.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}

                {/* Relationship & Friend Action Buttons */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {/* Friend Request Toggle Button */}
                  {selectedProfile.friendship_status === 'none' && (
                    <button
                      onClick={() => handleSendFriendRequest(selectedProfile.user_id)}
                      className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Campus Friend</span>
                    </button>
                  )}

                  {selectedProfile.friendship_status === 'request_sent' && (
                    <button
                      onClick={() => handleCancelOrRemoveFriend(selectedProfile.user_id)}
                      className="flex-1 py-2.5 bg-amber-50 hover:bg-rose-50 text-amber-800 hover:text-rose-700 font-bold text-xs rounded-xl border border-amber-200 cursor-pointer transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Request Sent (Cancel)</span>
                    </button>
                  )}

                  {selectedProfile.friendship_status === 'request_received' && (
                    <button
                      onClick={() => handleAcceptFriendRequest(selectedProfile.request_id)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept Friend Request</span>
                    </button>
                  )}

                  {selectedProfile.friendship_status === 'friends' && (
                    <button
                      onClick={() => handleCancelOrRemoveFriend(selectedProfile.user_id)}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                      title="Unfriend"
                    >
                      Unfriend
                    </button>
                  )}

                  {/* Send Message Button: Strictly only if accepted friends or merchant */}
                  {selectedProfile.friendship_status === 'friends' ? (
                    <button
                      onClick={() => handleStartChatWithStudent(selectedProfile)}
                      className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Send Message</span>
                      {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black shadow-xs animate-pulse">
                          {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id)}
                        </span>
                      )}
                    </button>
                  ) : (selectedProfile.is_seller || selectedProfile.role === 'vendor') ? (
                    <button
                      onClick={() => {
                        handleStartVendorChat({
                          vendor_user_id: selectedProfile.user_id,
                          vendor_name: selectedProfile.business_name || selectedProfile.full_name,
                          vendor_phone: selectedProfile.phone_number,
                          vendor_location: selectedProfile.hostel
                        });
                        setProfileModalOpen(false);
                      }}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Message Merchant</span>
                      {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black shadow-xs animate-pulse">
                          {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id)}
                        </span>
                      )}
                    </button>
                  ) : null}
                </div>

                {selectedProfile.friendship_status !== 'friends' && !selectedProfile.is_seller && selectedProfile.role !== 'vendor' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-3 text-center font-medium">
                    🔒 Messaging is locked until {selectedProfile.full_name} accepts your friend request.
                  </p>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- REPORT NOTICE / LOST & FOUND MODAL --- */}
      <AnimatePresence>
        {reportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 max-h-[90vh] flex flex-col"
            >
              <button
                onClick={() => setReportModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Post Campus Notice / Report Item</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Broadcast lost items, found property, or department announcements to {universityName}.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateNotice} className="space-y-3.5 text-xs flex-1 overflow-y-auto pr-1">
                {/* Type Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">Notice Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'lost', label: 'Lost Item', color: 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200' },
                      { id: 'found', label: 'Found Item', color: 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' },
                      { id: 'announcement', label: 'Announcement', color: 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewNoticeForm(prev => ({ ...prev, type: t.id }))}
                        className={`py-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                          newNoticeForm.type === t.id
                            ? t.color
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder={
                      newNoticeForm.type === 'lost'
                        ? 'e.g. Lost Student ID Card (Ekene Chinedu, Computer Science)'
                        : newNoticeForm.type === 'found'
                          ? 'e.g. Found Black HP Laptop Charger'
                          : 'e.g. SUG Townhall Meeting: Campus Hostel Maintenance'
                    }
                    value={newNoticeForm.title}
                    onChange={(e) => setNewNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Category & Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Category</label>
                    <select
                      value={newNoticeForm.category}
                      onChange={(e) => setNewNoticeForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="id_card">Student ID Card</option>
                      <option value="phone_gadget">Phone / Laptop / Gadget</option>
                      <option value="keys">Keys / Access Card</option>
                      <option value="wallet_atm">Wallet / ATM Card / Cash</option>
                      <option value="books">Books / Notes / File</option>
                      <option value="announcement">General Announcement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Date Misplaced / Found</label>
                    <input
                      type="text"
                      placeholder="e.g. Today around 2pm"
                      value={newNoticeForm.date_lost_or_found}
                      onChange={(e) => setNewNoticeForm(prev => ({ ...prev, date_lost_or_found: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Campus Location */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Campus Location / Landmark *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Faculty of Science LT 2, Central Library Reading Room"
                    value={newNoticeForm.location}
                    onChange={(e) => setNewNoticeForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Contact Phone / WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 08012345678"
                    value={newNoticeForm.contact_phone}
                    onChange={(e) => setNewNoticeForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Description & Instructions to Claim *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe item appearance, distinguishing marks, where to meet, or claim procedure..."
                    value={newNoticeForm.description}
                    onChange={(e) => setNewNoticeForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingNotice}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {submittingNotice ? 'Publishing...' : 'Publish to Notice Board'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ORDER / HOSTEL DELIVERY MODAL --- */}
      <AnimatePresence>
        {orderModalItem && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-200">
              <button onClick={() => setOrderModalItem(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-slate-900 mb-1">Order {orderModalItem.name}</h3>
              <p className="text-xs text-slate-500 mb-4">Vendor: {orderModalItem.vendor_name}</p>

              <form onSubmit={handlePlaceOrder} className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl">
                  <span className="font-bold text-slate-700">Item Price:</span>
                  <span className="font-black text-sky-700 text-sm">₦{Number(orderModalItem.price).toLocaleString()}</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quantity</label>
                  <input type="number" min="1" max="10" value={orderQuantity} onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800" />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Delivery Hostel & Room Number</label>
                  <input type="text" required placeholder="e.g. Moremi Hall Room B12" value={orderDeliveryLocation} onChange={(e) => setOrderDeliveryLocation(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800" />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-sky-50 rounded-2xl text-sky-900">
                  <span className="font-bold">Total Amount:</span>
                  <span className="font-black text-base">₦{Number(orderModalItem.price * orderQuantity).toLocaleString()}</span>
                </div>

                <button type="submit" className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer">
                  Confirm Order & Request Room Delivery
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- WHATSAPP-STYLE STATUS STORY VIEWER MODAL --- */}
      <AnimatePresence>
        {activeStatusViewer && statusGroups[activeStatusViewer.userIdx] && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-0 sm:p-4">
            {(() => {
              const group = statusGroups[activeStatusViewer.userIdx];
              const currentItem = group.items[activeStatusViewer.itemIdx] || group.items[0];

              const handleNext = () => {
                if (activeStatusViewer.itemIdx < group.items.length - 1) {
                  setActiveStatusViewer(prev => ({ ...prev, itemIdx: prev.itemIdx + 1 }));
                } else if (activeStatusViewer.userIdx < statusGroups.length - 1) {
                  setActiveStatusViewer({ userIdx: activeStatusViewer.userIdx + 1, itemIdx: 0 });
                } else {
                  setActiveStatusViewer(null);
                }
              };

              const handlePrev = () => {
                if (activeStatusViewer.itemIdx > 0) {
                  setActiveStatusViewer(prev => ({ ...prev, itemIdx: prev.itemIdx - 1 }));
                } else if (activeStatusViewer.userIdx > 0) {
                  const prevGroup = statusGroups[activeStatusViewer.userIdx - 1];
                  setActiveStatusViewer({ userIdx: activeStatusViewer.userIdx - 1, itemIdx: prevGroup.items.length - 1 });
                }
              };

              return (
                <div className="relative flex items-center justify-center w-full max-w-md h-full sm:h-[88vh]">
                  {/* WhatsApp Web Desktop Left/Prev Story Button (Outside Card) */}
                  {(activeStatusViewer.itemIdx > 0 || activeStatusViewer.userIdx > 0) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrev();
                      }}
                      className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-white items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl transition-all cursor-pointer group"
                      title="Previous Story"
                      aria-label="Previous Story"
                    >
                      <ChevronLeft className="w-7 h-7 group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
                    </button>
                  )}

                  {/* WhatsApp Web Desktop Right/Next Story Button (Outside Card) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                    className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-white items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl transition-all cursor-pointer group"
                    title="Next Story"
                    aria-label="Next Story"
                  >
                    <ChevronRight className="w-7 h-7 group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                  </button>

                  {/* Main Story Viewer Card */}
                  <div className="relative w-full h-full bg-slate-900 sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl">
                    {/* Top Segmented Progress Bar */}
                    <div className="p-3 pb-0 flex items-center space-x-1 z-20">
                      {group.items.map((_, idx) => (
                        <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              idx < activeStatusViewer.itemIdx
                                ? 'w-full bg-white'
                                : idx === activeStatusViewer.itemIdx
                                  ? 'w-full bg-emerald-400'
                                  : 'w-0'
                            }`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Header */}
                    <div className="p-3.5 flex items-center justify-between text-white z-20 bg-gradient-to-b from-black/60 to-transparent">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center overflow-hidden border border-white/40">
                          {group.user_avatar ? (
                            <SafeImage src={group.user_avatar} alt={group.user_name} fallbackType="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span>{group.user_name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h4 className="font-bold text-xs leading-tight">{group.user_name}</h4>
                            {(group.user_university_abbr || group.user_university) && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                                📍 {group.user_university_abbr || group.user_university}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-white/70 block mt-0.5">
                            {currentItem.time_ago || 'Recent'} • {group.user_department || group.user_dept || 'Student'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {(group.user_id === currentUser?.user_id || group.user_id === currentUser?.id || currentUser?.role === 'admin') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStatus(currentItem.id)}
                            className="p-1.5 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white cursor-pointer transition-colors"
                            title="Delete this story"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setActiveStatusViewer(null)}
                          className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white cursor-pointer transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Center Content Slide */}
                    <div className="relative flex-1 flex items-center justify-center overflow-hidden">
                      {/* Click zones for Prev / Next */}
                      <div
                        onClick={handlePrev}
                        className="absolute left-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
                        title="Previous"
                      />
                      <div
                        onClick={handleNext}
                        className="absolute right-0 top-0 bottom-0 w-2/3 z-10 cursor-pointer"
                        title="Next"
                      />

                      {/* WhatsApp-Style In-Card Floating Prev/Next Arrow Buttons */}
                      {(activeStatusViewer.itemIdx > 0 || activeStatusViewer.userIdx > 0) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrev();
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white flex items-center justify-center backdrop-blur-md border border-white/25 shadow-xl transition-all cursor-pointer group"
                          title="Previous Story"
                          aria-label="Previous Story"
                        >
                          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNext();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white flex items-center justify-center backdrop-blur-md border border-white/25 shadow-xl transition-all cursor-pointer group"
                        title="Next Story"
                        aria-label="Next Story"
                      >
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                      </button>

                      {(() => {
                        const mediaUrl = currentItem.media_url ? getMediaUrl(currentItem.media_url) : null;
                        const isVideo = (
                          currentItem.media_type === 'video' ||
                          (currentItem.media_url && Boolean(currentItem.media_url.match(/\.(mp4|mov|webm|m4v|3gp|avi|mkv)(\?.*)?$/i))) ||
                          (currentItem.media_url && currentItem.media_url.includes('/video/upload/'))
                        );

                        if (isVideo && mediaUrl) {
                          return (
                            <div className="w-full h-full flex items-center justify-center p-2 relative bg-black">
                              <video
                                key={mediaUrl}
                                src={mediaUrl}
                                autoPlay
                                playsInline
                                controls
                                className="max-h-full max-w-full object-contain rounded-xl"
                              />
                              {currentItem.caption && (
                                <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-xs p-3 rounded-2xl text-center text-white text-xs z-20">
                                  {currentItem.caption}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (currentItem.media_type === 'image' || mediaUrl) {
                          return (
                            <div className="w-full h-full flex items-center justify-center p-2 relative">
                              <SafeImage
                                src={mediaUrl}
                                alt="Status"
                                fallbackType="product"
                                className="max-h-full max-w-full object-contain"
                              />
                              {currentItem.caption && (
                                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-xs p-3 rounded-2xl text-center text-white text-xs z-20">
                                  {currentItem.caption}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          /* Full Screen Vibrant Text Status */
                          <div
                            className={`w-full h-full flex flex-col items-center justify-center p-8 text-center text-white bg-gradient-to-tr ${
                              currentItem.background_color || 'from-emerald-600 to-teal-800'
                            }`}
                          >
                            <p className="text-xl sm:text-2xl font-black leading-relaxed max-w-xs drop-shadow-md">
                              {currentItem.caption}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Bottom: Viewers pill for own story, or Quick Reaction & Reply for peer story */}
                    {group.is_self ? (
                      <div className="p-3 bg-gradient-to-t from-black/80 to-transparent z-20 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveStoryViewers(currentItem.viewers || []);
                            setStatusViewersModalOpen(true);
                          }}
                          className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-xs transition-all cursor-pointer text-xs font-bold shadow-xs"
                        >
                          <Eye className="w-4 h-4 text-emerald-400" />
                          <span>Seen by {currentItem.views_count || (currentItem.viewers && currentItem.viewers.length) || 0} friends</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-gradient-to-t from-black/80 to-transparent z-20 space-y-2">
                        {/* Quick Reaction Emojis */}
                        <div className="flex items-center justify-around px-2">
                          {['❤️', '🔥', '👏', '😂', '😮', '🙌'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleSendStatusReaction(emoji)}
                              className="text-lg p-1.5 rounded-full hover:bg-white/20 transition-transform active:scale-125 cursor-pointer"
                              title={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {/* Reply Input */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            placeholder={`Reply to ${group.user_name}...`}
                            value={statusReplyText}
                            onChange={(e) => setStatusReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleReplyToStatus()}
                            className="flex-1 p-2.5 bg-white/20 backdrop-blur-xs border border-white/30 rounded-2xl text-xs text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
                          />
                          <button
                            type="button"
                            onClick={() => handleReplyToStatus()}
                            disabled={!statusReplyText.trim()}
                            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* --- CREATE STATUS STORY MODAL (PHOTO, VIDEO & TEXT) --- */}
      <AnimatePresence>
        {createStatusModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative border border-slate-200 my-auto"
            >
              <button
                onClick={() => {
                  setCreateStatusModalOpen(false);
                  setStatusMediaFile(null);
                  setStatusMediaPreview(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 p-1 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900 leading-tight">Create Campus Story</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Share with your campus circle (disappears in 24h).</p>
              </div>

              {/* Tab Selector: Photo/Video vs Text */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setStatusMode('media')}
                  className={`py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    statusMode === 'media'
                      ? 'bg-white text-sky-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Camera className="w-4 h-4 text-sky-500" />
                  <span>Photo / Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusMode('text')}
                  className={`py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    statusMode === 'text'
                      ? 'bg-white text-sky-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Edit3 className="w-4 h-4 text-emerald-500" />
                  <span>Text / Vibe</span>
                </button>
              </div>

              {/* Story Audience Pill */}
              <div className="mb-4 flex items-center justify-between p-2.5 bg-sky-50/80 border border-sky-200/80 rounded-xl text-xs">
                <div className="flex items-center space-x-1.5 text-sky-950 font-semibold truncate">
                  <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="text-slate-600">Audience:</span>
                  <span className="font-bold text-sky-700 truncate">
                    {statusPrivacy === 'friends' ? 'My Friends' : statusPrivacy === 'campus' ? 'All Campus Peers' : 'Selected Friends'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusPrivacyModalOpen(true)}
                  className="text-[11px] font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer shrink-0 ml-2"
                >
                  Change
                </button>
              </div>

              <form onSubmit={handleCreateStatus} className="space-y-3.5 text-xs">
                {statusMode === 'media' ? (
                  <div className="space-y-3">
                    <input
                      ref={statusFileInputRef}
                      type="file"
                      accept="image/*,video/*,video/mp4,video/quicktime,video/webm,video/x-m4v"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setStatusMediaFile(file);
                          setStatusMediaPreview(URL.createObjectURL(file));
                        }
                      }}
                    />

                    {statusMediaPreview ? (
                      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 h-48 flex items-center justify-center group">
                        {((statusMediaFile?.type && statusMediaFile.type.startsWith('video')) || Boolean(statusMediaFile?.name && statusMediaFile.name.match(/\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i))) ? (
                          <video src={statusMediaPreview} controls playsInline autoPlay muted className="h-full w-full object-contain" />
                        ) : (
                          <img src={statusMediaPreview} alt="Story preview" className="h-full w-full object-contain" />
                        )}
                        <div className="absolute top-2 right-2 flex items-center space-x-1.5 bg-slate-900/70 backdrop-blur-xs p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => statusFileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusMediaFile(null);
                              setStatusMediaPreview(null);
                            }}
                            className="p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg cursor-pointer transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => statusFileInputRef.current?.click()}
                        className="h-44 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all text-center group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-sky-100 flex items-center justify-center text-sky-600 mb-2 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-slate-700 text-xs">Tap to select photo or video</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Supports JPG, PNG, MP4 clips up to 60s</span>
                      </div>
                    )}

                    <div>
                      <input
                        type="text"
                        maxLength={140}
                        placeholder="Add a caption (optional)..."
                        value={newStatusForm.caption}
                        onChange={(e) => setNewStatusForm(prev => ({ ...prev, caption: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Live Preview of Gradient Status */}
                    <div
                      className={`h-36 rounded-2xl bg-gradient-to-tr ${newStatusForm.background_color} p-4 flex items-center justify-center text-center text-white shadow-inner relative`}
                    >
                      <p className="font-bold text-sm leading-relaxed max-w-xs break-words">
                        {newStatusForm.caption || 'Type your vibe or thought...'}
                      </p>
                    </div>

                    <textarea
                      rows={3}
                      maxLength={140}
                      placeholder="What's on your mind? Share a campus thought..."
                      value={newStatusForm.caption}
                      onChange={(e) => setNewStatusForm(prev => ({ ...prev, caption: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
                    />

                    {/* Gradient Theme Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Color Gradient</label>
                      <div className="flex items-center space-x-2">
                        {[
                          { id: 'from-emerald-600 to-teal-800', name: 'Emerald' },
                          { id: 'from-sky-500 to-blue-700', name: 'Sky' },
                          { id: 'from-indigo-600 to-purple-800', name: 'Indigo' },
                          { id: 'from-rose-600 to-pink-800', name: 'Rose' },
                          { id: 'from-amber-500 to-orange-700', name: 'Amber' },
                          { id: 'from-slate-800 to-slate-950', name: 'Midnight' }
                        ].map((bg) => (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() => setNewStatusForm(prev => ({ ...prev, background_color: bg.id }))}
                            className={`w-7 h-7 rounded-full bg-gradient-to-tr ${bg.id} cursor-pointer transition-transform ${
                              newStatusForm.background_color === bg.id ? 'scale-125 ring-2 ring-sky-500 ring-offset-2' : 'hover:scale-110'
                            }`}
                            title={bg.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateStatusModalOpen(false);
                      setStatusMediaFile(null);
                      setStatusMediaPreview(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingStatus || (statusMode === 'media' && !statusMediaFile) || (statusMode === 'text' && !newStatusForm.caption?.trim())}
                    className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
                  >
                    {submittingStatus ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sharing Story...</span>
                      </>
                    ) : (
                      <span>Share to Story</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- WHATSAPP-STYLE STATUS PRIVACY MODAL --- */}
      <AnimatePresence>
        {statusPrivacyModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 space-y-4"
            >
              <button
                onClick={() => setStatusPrivacyModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Status Privacy</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Who can see your WhatsApp-style status updates?
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* Option 1: My Friends */}
                <div
                  onClick={() => setStatusPrivacy('friends')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3 ${
                    statusPrivacy === 'friends'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    statusPrivacy === 'friends' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                  }`}>
                    {statusPrivacy === 'friends' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs text-slate-900">My Friends</span>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded-md">Recommended</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Only your accepted mutual friends can view your status updates.
                    </p>
                  </div>
                </div>

                {/* Option 2: All Campus Peers */}
                <div
                  onClick={() => setStatusPrivacy('campus')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3 ${
                    statusPrivacy === 'campus'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    statusPrivacy === 'campus' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                  }`}>
                    {statusPrivacy === 'campus' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900">All Campus Peers</span>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Any verified student enrolled at your university can discover and view your status.
                    </p>
                  </div>
                </div>

                {/* Option 3: Only Share With... */}
                <div
                  onClick={() => setStatusPrivacy('custom')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3 ${
                    statusPrivacy === 'custom'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    statusPrivacy === 'custom' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                  }`}>
                    {statusPrivacy === 'custom' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-xs text-slate-900">Only Share With...</span>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Choose specific campus friends who can see this status.
                    </p>

                    {statusPrivacy === 'custom' && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 max-h-40 overflow-y-auto">
                        {(myFriends || []).length > 0 ? (
                          (myFriends || []).map((f) => {
                            const isSelected = selectedAudienceFriends.includes(f.id);
                            return (
                              <div
                                key={f.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAudienceFriends(prev => 
                                    isSelected ? prev.filter(id => id !== f.id) : [...prev, f.id]
                                  );
                                }}
                                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
                              >
                                <div className="flex items-center space-x-2">
                                  {f.profile_picture_url ? (
                                    <SafeImage src={f.profile_picture_url} alt="" fallbackType="avatar" className="w-6 h-6 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold text-[10px] flex items-center justify-center">
                                      {f.full_name?.charAt(0) || 'F'}
                                    </div>
                                  )}
                                  <span className="text-xs font-semibold text-slate-800">{f.full_name}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                                />
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-slate-400 block py-1">No friends added yet. Connect with campus peers first!</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setStatusPrivacyModalOpen(false);
                    setToast({ text: `Story privacy set to: ${statusPrivacy === 'friends' ? 'My Friends' : statusPrivacy === 'campus' ? 'All Campus' : 'Selected Friends'}`, type: 'success' });
                  }}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- STATUS STORY VIEWERS DRAWER / MODAL --- */}
      <AnimatePresence>
        {statusViewersModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-slate-200"
            >
              <button
                onClick={() => setStatusViewersModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Story Viewers</h3>
                  <span className="text-xs text-slate-500">
                    {activeStoryViewers.length} friend{activeStoryViewers.length === 1 ? '' : 's'} viewed
                  </span>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-100">
                {activeStoryViewers.length > 0 ? (
                  activeStoryViewers.map((viewer, vIdx) => (
                    <div key={vIdx} className="pt-2 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        {viewer.avatar ? (
                          <SafeImage src={viewer.avatar} alt="" fallbackType="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                            {(viewer.name || 'F').charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold text-slate-800 block leading-tight">{viewer.name}</span>
                          <span className="text-[10px] text-slate-400">{safeTime(viewer.viewed_at, 'Recently')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No friends have viewed this status yet.
                  </div>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusViewersModalOpen(false)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NOTIFICATION CENTER SLIDE-OVER DRAWER --- */}
      <AnimatePresence>
        {notificationsOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationsOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 sticky top-0 z-10 backdrop-blur-xs">
                  <div className="flex items-center space-x-2.5">
                    {/* Clear Back Button */}
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="p-2 -ml-1 text-slate-700 hover:text-slate-900 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer font-bold text-xs shrink-0"
                      title="Back to Dashboard"
                      aria-label="Back to Dashboard"
                    >
                      <ChevronLeft className="w-5 h-5 shrink-0 text-slate-800" />
                      <span>Back</span>
                    </button>

                    <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 leading-tight">Notifications</h3>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllNotificationsRead}
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Close Notifications"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex items-center space-x-1.5 text-xs overflow-x-auto">
                  <button
                    onClick={() => setNotifFilter('all')}
                    className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                      notifFilter === 'all' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotifFilter('social')}
                    className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                      notifFilter === 'social' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Social & Friends
                  </button>
                  <button
                    onClick={() => setNotifFilter('notices')}
                    className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                      notifFilter === 'notices' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Campus Notices & Lost
                  </button>
                  <button
                    onClick={() => setNotifFilter('orders')}
                    className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                      notifFilter === 'orders' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Orders
                  </button>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {(() => {
                    const filtered = notifications.filter(n => {
                      const t = (n.notification_type || n.type || '').toLowerCase();
                      if (notifFilter === 'social') {
                        return t.includes('like') || t.includes('comment') || t.includes('reel') || t.includes('friend') || t === 'status_view' || t === 'message';
                      }
                      if (notifFilter === 'notices') {
                        return t.includes('notice') || t.includes('lost') || t.includes('found');
                      }
                      if (notifFilter === 'orders') {
                        return t.includes('order') || t.includes('service');
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-20 text-center px-6">
                          <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                          <h4 className="font-bold text-slate-700 text-sm">No notifications here yet</h4>
                          <p className="text-xs text-slate-400 mt-1">
                            When peers like your reels, comment, send friend requests, or post campus notices & lost/found items, they'll show up here!
                          </p>
                        </div>
                      );
                    }

                    return filtered.map((n) => {
                      const t = (n.notification_type || n.type || '').toLowerCase();
                      const msg = n.message || n.body || '';
                      const isLike = t.includes('like');
                      const isComment = t.includes('comment');
                      const isFriendReq = t === 'friend_request';
                      const isFriendAcc = t === 'friend_accept';
                      const isNotice = t.includes('notice') || t.includes('lost') || t.includes('found');
                      const isView = t === 'status_view';
                      const isMessage = t === 'message';

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-4 flex items-start space-x-3.5 hover:bg-slate-50 transition-colors cursor-pointer relative ${
                            !n.is_read ? 'bg-sky-50/40' : 'bg-white'
                          }`}
                        >
                          {/* Actor Avatar / Icon */}
                          <div className="relative shrink-0">
                            {n.actor_avatar ? (
                              <SafeImage src={n.actor_avatar} alt="" fallbackType="avatar" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                                {n.actor_name?.charAt(0) || 'C'}
                              </div>
                            )}

                            {/* Badge Icon */}
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-xs ${
                              isLike ? 'bg-rose-500' :
                              isComment ? 'bg-blue-500' :
                              isFriendReq ? 'bg-indigo-500' :
                              isFriendAcc ? 'bg-emerald-500' :
                              isNotice ? 'bg-amber-500' :
                              isMessage ? 'bg-sky-500' :
                              isView ? 'bg-purple-500' : 'bg-slate-700'
                            }`}>
                              {isLike ? <Heart className="w-2.5 h-2.5 fill-current" /> :
                               isComment ? <MessageCircle className="w-2.5 h-2.5" /> :
                               isFriendReq ? <UserPlus className="w-2.5 h-2.5" /> :
                               isFriendAcc ? <CheckCircle2 className="w-2.5 h-2.5" /> :
                               isNotice ? <Bell className="w-2.5 h-2.5" /> :
                               isMessage ? <MessageSquare className="w-2.5 h-2.5" /> :
                               isView ? <Eye className="w-2.5 h-2.5" /> :
                               <ShoppingBag className="w-2.5 h-2.5" />}
                            </div>
                          </div>

                          {/* Text Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-xs text-slate-900 truncate">{n.title}</h4>
                              <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                {safeTime(n.created_at, 'Now')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 leading-snug line-clamp-2">
                              {msg}
                            </p>
                          </div>

                          {/* Unread Indicator Dot */}
                          {!n.is_read && (
                            <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Footer with prominent Back Button */}
                <div className="p-4 border-t border-slate-200 bg-white flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-medium">CampusLink Real-time Notification Engine</span>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NEW USER WELCOME & PROFILE COMPLETION PROMPT MODAL --- */}
      <AnimatePresence>
        {showNewUserModal && (
          <motion.div
            key="new-user-welcome-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-sky-100 overflow-hidden"
            >
              {/* Top Banner Header */}
              <div className="bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner border border-white/20">
                  🎉
                </div>
                <h3 className="text-xl font-black tracking-tight leading-tight">
                  Welcome to CampusLink!
                </h3>
                <p className="text-xs text-sky-100 mt-1 max-w-xs mx-auto">
                  Hi {currentUser?.full_name ? currentUser.full_name.split(' ')[0] : 'there'}, your account is ready. Complete your profile to get full access to the campus community!
                </p>
              </div>

              {/* Body Checklist */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  To start connecting with peers, chatting, buying, and ordering on campus, please head to <strong>Settings</strong> to finish setting up:
                </p>

                <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">1</span>
                    <span className="font-semibold">Department & Academic Level</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">2</span>
                    <span className="font-semibold">Hostel / Campus Hall of Residence</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">3</span>
                    <span className="font-semibold">Active WhatsApp / Call Phone Number</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">4</span>
                    <span className="font-semibold">Profile Photo & Student Bio</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewUserModal(false);
                      localStorage.setItem('campuslink_dismissed_profile_prompt', 'true');
                      localStorage.removeItem('campuslink_show_profile_completion_prompt');
                      setActiveTab('profile');
                    }}
                    className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Go to Profile Settings</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewUserModal(false);
                      localStorage.setItem('campuslink_dismissed_profile_prompt', 'true');
                      localStorage.removeItem('campuslink_show_profile_completion_prompt');
                    }}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    I'll do this later
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MEDIA PREVIEW & PHOTO/VIDEO EDITOR MODAL --- */}
      <MediaPreviewEditorModal
        isOpen={showMediaEditor}
        file={pendingMediaFile}
        onClose={() => {
          setShowMediaEditor(false);
          setPendingMediaFile(null);
        }}
        onConfirm={handleConfirmSendChatMedia}
      />

      {/* --- FACEBOOK-STYLE MOBILE BOTTOM NAVIGATION BAR (Compact Icons for Small Screens) --- */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1.5 safe-nav-bottom items-center justify-around shadow-lg ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'flex'}`}>
        {/* Market */}
        <button
          onClick={() => { setActiveTab('marketplace'); setMarketType('products'); }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'marketplace' && marketType === 'products'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <ShoppingBag className={`w-5 h-5 ${activeTab === 'marketplace' && marketType === 'products' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Market</span>
          {activeTab === 'marketplace' && marketType === 'products' && (
            <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
          )}
        </button>

        {/* Services */}
        <button
          onClick={() => { setActiveTab('marketplace'); setMarketType('services'); }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'marketplace' && marketType === 'services'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <Wrench className={`w-5 h-5 ${activeTab === 'marketplace' && marketType === 'services' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Services</span>
          {activeTab === 'marketplace' && marketType === 'services' && (
            <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
          )}
        </button>

        {/* Reels */}
        <button
          onClick={() => setActiveTab('reels')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'reels'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <Video className={`w-5 h-5 ${activeTab === 'reels' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Reels</span>
          {activeTab === 'reels' && (
            <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
          )}
        </button>

        {/* Notices & Lost/Found */}
        <button
          onClick={() => setActiveTab('campus')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'campus'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <Bell className={`w-5 h-5 ${activeTab === 'campus' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Notices</span>
          {activeTab === 'campus' && (
            <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
          )}
        </button>

        {/* Chats & Friends */}
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'messages'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${activeTab === 'messages' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {(totalUnreadChatCount > 0 || (pendingRequests || []).length > 0) && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black min-w-[15px] h-3.5 px-1 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {totalUnreadChatCount > 0 ? totalUnreadChatCount : (pendingRequests || []).length}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Chats</span>
          {activeTab === 'messages' && (
            <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
          )}
        </button>

        {/* Profile & Settings */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'profile'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Profile</span>
          {activeTab === 'profile' && (
            <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
          )}
        </button>
      </nav>

    </div>
  );
}
