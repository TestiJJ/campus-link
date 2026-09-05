// src/VendorDashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Plus, Trash2, MessageSquare, Phone,
  Mail, ShieldCheck, AlertCircle, LogOut, Send,
  Tag, Clock, MapPin, X, Upload, CheckCircle2,
  Package, Wrench, Video, ShoppingCart, Star, Eye, Camera, Check,
  Heart, MessageCircle, UserPlus, Users, UserCheck, UserX, Search,
  Share2, DollarSign, Bell, Sparkles, AlertTriangle, ExternalLink,
  RefreshCw, Settings, Building2, ChevronRight, ChevronLeft, Copy, CheckCheck,
  Lock, Edit3, ShieldAlert, Bot, RotateCcw, Download, Smartphone, Reply,
  Film, Mic
} from 'lucide-react';
import API, { uploadFile, getMediaUrl, getWsUrl, getAuthToken, isAuthenticated } from './api';
import SafeImage from './components/SafeImage';
import StoryReplyBubble, { parseStatusReply } from './components/StoryReplyBubble';
import InAppChatBanner, { playChatNotificationSound } from './components/InAppChatBanner';
import MediaPreviewEditorModal from './components/MediaPreviewEditorModal';
import MarkdownRenderer from './components/MarkdownRenderer';
import SwipeableMessageBubble from './components/SwipeableMessageBubble';
import ChatMediaGallery from './components/ChatMediaGallery';
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
          replyToSender: parsed.reply_to_sender || 'Peer',
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


// Stale-While-Revalidate Caching Utilities for Vendor
const getCachedData = (key, fallback) => {
  try {
    const raw = localStorage.getItem(`cl_cache_vendor_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setCachedData = (key, value) => {
  try {
    localStorage.setItem(`cl_cache_vendor_${key}`, JSON.stringify(value));
  } catch {}
};

// Safe Date and Time Formatters (Prevents RangeError on iOS Safari / WebKit and ensures accurate UTC handling)
const safeTime = (dateStr, fallback = 'Recently') => {
  if (!dateStr) return fallback;
  try {
    let iso = String(dateStr).trim();
    if (!iso.endsWith('Z') && !iso.includes('+') && !iso.includes('-', 10)) {
      iso += 'Z';
    }
    const cleanStr = iso.includes('T') ? iso : iso.replace(' ', 'T');
    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? fallback : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return fallback;
  }
};

const safeDate = (dateStr, fallback = 'Recent') => {
  if (!dateStr) return fallback;
  try {
    let iso = String(dateStr).trim();
    if (!iso.endsWith('Z') && !iso.includes('+') && !iso.includes('-', 10)) {
      iso += 'Z';
    }
    const cleanStr = iso.includes('T') ? iso : iso.replace(' ', 'T');
    const d = new Date(cleanStr);
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
    if (!iso.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(iso)) {
      iso += 'Z';
    }
    const targetDate = new Date(iso);
    if (isNaN(targetDate.getTime())) return { label: 'Offline', online: false };
    
    let diffMs = Date.now() - targetDate.getTime();
    if (diffMs < 120000 && diffMs > -180000) return { label: 'Active now', online: true };
    if (diffMs < 0) diffMs = 0;

    const diffMin = Math.floor(diffMs / 60000);
    const diffHr  = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return { label: 'Active now', online: true };
    if (diffMin < 60) return { label: `Last seen ${diffMin}m ago`, online: false };
    if (diffHr  < 24) return { label: `Last seen ${diffHr}h ago`, online: false };
    if (diffHr  < 48) return { label: 'Last seen yesterday', online: false };
    const opts = { day: 'numeric', month: 'short' };
    return { label: `Last seen ${targetDate.toLocaleDateString([], opts)}`, online: false };
  } catch {
    return { label: 'Offline', online: false };
  }
};

// URL and localStorage tab persistence for Vendor
const getInitialVendorTab = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['inventory', 'services', 'orders', 'messages', 'reels', 'hub', 'settings', 'verification'].includes(tabParam)) {
      return tabParam;
    }
    const saved = localStorage.getItem('campuslink_vendor_tab');
    if (saved && ['inventory', 'services', 'orders', 'messages', 'reels', 'hub', 'settings', 'verification'].includes(saved)) {
      return saved;
    }
  } catch {}
  return 'inventory';
};

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [vendorStore, setVendorStore] = useState(() => getCachedData('store', null));
  const [activeTab, setActiveTab] = useState(getInitialVendorTab);
  // New Vendor Profile Completion Prompt State (only shows for new vendor registrations)
  const [showNewVendorModal, setShowNewVendorModal] = useState(() => {
    try {
      if (localStorage.getItem('campuslink_show_profile_completion_prompt') === 'true') {
        return true;
      }
      if (localStorage.getItem('campuslink_dismissed_vendor_profile_prompt') === 'true') {
        return false;
      }
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role === 'vendor' && u.created_at) {
          const createdTime = new Date(u.created_at).getTime();
          const isRecent = (Date.now() - createdTime) < 48 * 3600 * 1000;
          if (isRecent) return true;
        }
      }
    } catch {}
    return false;
  });


  // Operational & Store Status States
  const [storeStatus, setStoreStatus] = useState(() => localStorage.getItem('vendor_store_status') || 'open'); // 'open' | 'break' | 'closed'
  const [storeBroadcast, setStoreBroadcast] = useState(() => localStorage.getItem('vendor_store_broadcast') || 'Welcome to our campus store! Quick hostel delivery available.');
  const [broadcastInput, setBroadcastInput] = useState(() => localStorage.getItem('vendor_store_broadcast') || '');
  const [isEditingBroadcast, setIsEditingBroadcast] = useState(false);
  const [bankInfo, setBankInfo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vendor_bank_info')) || {
        bank_name: 'OPay',
        account_number: '8012345678',
        account_name: 'Campus Vendor Store'
      };
    } catch {
      return { bank_name: 'OPay', account_number: '8012345678', account_name: 'Campus Vendor Store' };
    }
  });
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({ ...bankInfo });
  const [copiedBank, setCopiedBank] = useState(false);

  // Data States (with SWR Instant-Load Cache)
  const [products, setProducts] = useState(() => getCachedData('products', []));
  const [services, setServices] = useState(() => getCachedData('services', []));
  const [vendorOrders, setVendorOrders] = useState(() => getCachedData('orders', []));
  const [vendorReviews, setVendorReviews] = useState(() => getCachedData('reviews', []));
  
  // Messaging & Friends States (SWR Instant-Load Cache)
  const [conversations, setConversations] = useState(() => getCachedData('conversations', []));
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [pendingMediaFile, setPendingMediaFile] = useState(null);
  const [pendingMediaFiles, setPendingMediaFiles] = useState([]);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);
  const [messageSubtab, setMessageSubtab] = useState('chats'); // 'chats' | 'friends' | 'requests' | 'my_friends'
  const [communityUsers, setCommunityUsers] = useState(() => getCachedData('communityUsers', []));
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityRoleFilter, setCommunityRoleFilter] = useState('all'); // 'all' | 'student' | 'vendor'
  const [friendsList, setFriendsList] = useState(() => getCachedData('friendsList', []));
  const [pendingRequests, setPendingRequests] = useState(() => getCachedData('pendingRequests', []));
  const [activePopoverMsgId, setActivePopoverMsgId] = useState(null);
  const chatBottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatMediaInputRef = useRef(null);

  // Close floating action popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.chat-popover-toolbar') && !e.target.closest('.chat-bubble-tactile')) {
        setActivePopoverMsgId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Synchronize activeTab with URL query params and localStorage
  useEffect(() => {
    try {
      localStorage.setItem('campuslink_vendor_tab', activeTab);
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [activeTab]);

  // Support browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && ['inventory', 'services', 'orders', 'messages', 'reels', 'hub', 'settings', 'verification'].includes(tab)) {
          setActiveTab(tab);
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // CampusLink AI Chat States
  const [aiMessages, setAiMessages] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Status Stories States (SWR Instant-Load Cache)
  const [statusGroups, setStatusGroups] = useState(() => getCachedData('statusGroups', []));
  const [activeStatusViewer, setActiveStatusViewer] = useState(null); // { userIdx: 0, itemIdx: 0 }
  const [createStatusModalOpen, setCreateStatusModalOpen] = useState(false);
  const [statusMediaFile, setStatusMediaFile] = useState(null);
  const [statusMediaPreview, setStatusMediaPreview] = useState(null);
  const [statusCaption, setStatusCaption] = useState('');
  const [statusType, setStatusType] = useState('text'); // 'text' | 'image' | 'video'
  const [statusBgColor, setStatusBgColor] = useState('from-emerald-600 to-teal-800');
  const [statusPrivacy, setStatusPrivacy] = useState('everyone'); // 'everyone' | 'friends'
  const [statusReplyText, setStatusReplyText] = useState('');
  const [isPublishingStatus, setIsPublishingStatus] = useState(false);

  // Selected Profile Modal State (viewing profile of students or other vendors)
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Reels States (SWR Instant-Load Cache)
  const [allReels, setAllReels] = useState(() => getCachedData('allReels', []));
  const [reelFeedFilter, setReelFeedFilter] = useState('all'); // 'all' | 'my_drops'
  const [activeCommentsReelId, setActiveCommentsReelId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const commentInputRef = useRef(null);

  // Modals State
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showReelModal, setShowReelModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile & Settings States
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone_number: '',
    business_name: '',
    business_description: '',
    location: '',
    category_id: 1,
    bio: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const avatarInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Verification Form State (with comprehensive ID options for students, graduates & school restaurants)
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [verificationForm, setVerificationForm] = useState({
    id_card_type: 'national_id', // 'student_id' | 'national_id' | 'voter_card' | 'driver_license' | 'graduate_cert' | 'cac_permit'
    id_card_number: '',
    id_card_front: '',
    id_card_back: '',
    location: '',
    phone: '',
    business_name: ''
  });

  // Product Form & Editing States
  const [editingProduct, setEditingProduct] = useState(null);
  const [universities, setUniversities] = useState([]);
  const [showUpdateDocs, setShowUpdateDocs] = useState(false);
  const [prodFile, setProdFile] = useState(null);
  const [prodPreview, setProdPreview] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: 1,
    quantity: 1,
    university_id: ''
  });

  // Service Form State (with real file)
  const [svcFile, setSvcFile] = useState(null);
  const [svcPreview, setSvcPreview] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: 5,
    location: ''
  });

  // Reel Form State (with real file)
  const [reelMediaFile, setReelMediaFile] = useState(null);
  const [reelMediaPreview, setReelMediaPreview] = useState(null);
  const [reelForm, setReelForm] = useState({
    title: '',
    description: '',
    media_type: 'image',
    location: ''
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      loadStoreData();
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  // Mobile back button / swipe gesture support (WhatsApp-style back navigation)
  useEffect(() => {
    if (!selectedPartner) return;
    const handlePopState = () => {
      setSelectedPartner(null);
    };
    window.history.pushState({ chatOpen: true }, '');
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedPartner]);

  const [inAppBanner, setInAppBanner] = useState(null);
  const selectedPartnerRef = useRef(null);
  const activeTabRef = useRef(activeTab);

  const isSwitchingPartnerRef = useRef(false);

  useEffect(() => {
    selectedPartnerRef.current = selectedPartner;
  }, [selectedPartner]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

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
  }, [selectedPartner?.partner_id, selectedPartner?.user_id, selectedPartner?.id, chatMessages]);

  // DOM observer to keep chat pinned to recent messages as media elements load
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
  }, [selectedPartner?.partner_id, selectedPartner?.user_id, selectedPartner?.id]);

  // Real-time WebSocket connection for vendor instant chat delivery & floating banner alerts
  useEffect(() => {
    const uid = user?.user_id || user?.id;
    if (!uid || !getAuthToken()) return;
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
        const wsUrl = getWsUrl(`/ws/${uid}`);
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
              const isFromMe = (newM.sender_id === uid);

              // Immediately append to thread cache
              appendThreadMessage(newM.sender_id, newM);
              appendThreadMessage(newM.recipient_id, newM);

              if (!isFromMe) {
                const currentPid = selectedPartnerRef.current?.partner_id || selectedPartnerRef.current?.user_id || selectedPartnerRef.current?.id;
                const isCurrentChatOpen = currentPid && 
                  String(currentPid) === String(newM.sender_id) &&
                  activeTabRef.current === 'messages';

                if (isCurrentChatOpen) {
                  setChatMessages(prev => {
                    if (prev.some(m => m.id === newM.id)) return prev;
                    return [...prev, newM];
                  });
                  setTimeout(() => scrollToChatBottom(false), 50);
                } else {
                  // Pop up in-app notification banner across Reels, Store, etc.
                  setInAppBanner({
                    id: newM.id || Date.now(),
                    senderId: newM.sender_id,
                    senderName: data.sender_name || 'Campus Student',
                    senderAvatar: data.sender_avatar,
                    senderRole: data.sender_role || 'Student',
                    text: newM.message_type === 'audio' ? '🎤 Voice note' : (newM.content || 'Sent a message'),
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
                        partner_name: data.sender_name || 'Campus Student',
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
            // Suppress noisy error logs
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
        // Fallback gracefully
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
  }, [user?.user_id, user?.id]);

  const handleReplyFromBanner = (senderId) => {
    setInAppBanner(null);
    setActiveTab('messages');
    setMessageSubtab('chats');
    const existing = conversations.find(c => String(c.partner_id) === String(senderId));
    if (existing) {
      handleSelectPartner(existing);
    } else {
      const commUser = communityUsers.find(u => String(u.user_id || u.id) === String(senderId));
      if (commUser) {
        handleSelectPartner({ partner_id: senderId, partner_name: commUser.full_name, role: commUser.role });
      } else {
        handleSelectPartner({ partner_id: senderId, partner_name: 'Campus User' });
      }
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
    const pid = selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id;
    if (pid && String(c.partner_id) === String(pid)) return acc;
    return acc + (c.unread_count || 0);
  }, 0);

  // WhatsApp-style browser tab title badge for unread chats
  useEffect(() => {
    const prefix = totalUnreadChatCount > 0 ? `(${totalUnreadChatCount}) ` : '';
    document.title = `${prefix}CampusLink - Merchant Hub`;
    return () => {
      document.title = 'CampusLink - Merchant Hub';
    };
  }, [totalUnreadChatCount]);

  // Active chat fast fallback auto-polling (1.0s) for vendor (WebSockets handle instant push)
  useEffect(() => {
    const pid = selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id;
    if (!pid || selectedPartner?.is_ai || !getAuthToken()) return;

    // 1. Instantly load cached messages in 0ms (memory or localStorage)
    const cached = getCachedThreadMessages(pid);
    setChatMessages(cached);
    setIsLoadingChatMessages(false);
    smartScrollToBottom(chatContainerRef.current, false);

    let isPolling = true;
    let timer = null;

    const pollChat = async () => {
      if (!isPolling || !getAuthToken()) return;
      try {
        await revalidateThreadMessages(pid, API, (fresh) => {
          setChatMessages(fresh);
          if (isUserNearBottom(chatContainerRef.current)) {
            smartScrollToBottom(chatContainerRef.current, false);
          }
        });
        setConversations(prev =>
          prev.map(c => (String(c.partner_id) === String(pid) ? { ...c, unread_count: 0 } : c))
        );
      } catch (err) {
        if (err?.response?.status === 401) {
          isPolling = false;
          if (timer) clearInterval(timer);
        }
      }
    };

    pollChat();
    timer = setInterval(pollChat, 1000);

    const handleFocus = () => {
      if (document.visibilityState === 'visible' && getAuthToken()) {
        pollChat();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isPolling = false;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [selectedPartner?.partner_id, selectedPartner?.user_id, selectedPartner?.id]);

  // Background live sync for vendor data (conversations, orders, statuses, requests)
  useEffect(() => {
    if (!getAuthToken()) return;
    let isSyncing = true;
    let interval = null;

    const syncVendorData = () => {
      if (!isSyncing || !getAuthToken()) return;
      API.get('/conversations')
        .then(res => {
          const convs = res.data || [];
          setConversations(convs);
          primeConversationsCache(convs);
        })
        .catch(err => {
          if (err?.response?.status === 401) {
            isSyncing = false;
            if (interval) clearInterval(interval);
          }
        });
      API.get('/friends/requests/pending')
        .then(res => setPendingRequests(res.data || []))
        .catch(() => {});
      API.get('/vendor/orders')
        .then(res => setVendorOrders(res.data || []))
        .catch(() => {});
      API.get('/campus/statuses')
        .then(res => setStatusGroups(res.data || []))
        .catch(() => {});
    };

    interval = setInterval(syncVendorData, 8000);
    const handleFocus = () => {
      if (getAuthToken()) syncVendorData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isSyncing = false;
      if (interval) clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Record status views
  useEffect(() => {
    if (activeStatusViewer && statusGroups[activeStatusViewer.userIdx]) {
      const group = statusGroups[activeStatusViewer.userIdx];
      const item = group.items[activeStatusViewer.itemIdx];
      if (item && !group.is_self) {
        API.post(`/campus/statuses/${item.id}/view`).catch(() => {});
      }
    }
  }, [activeStatusViewer, statusGroups]);

  const loadStoreData = async () => {
    try {
      let storeData = null;
      try {
        const storeRes = await API.get('/vendor/my-store');
        storeData = storeRes.data;
        setVendorStore(storeData);
        setCachedData('store', storeData);
        setVerificationForm({
          id_card_type: storeData.id_card_type || 'national_id',
          id_card_number: storeData.id_card_number || '',
          id_card_front: storeData.id_card_front || '',
          id_card_back: storeData.id_card_back || '',
          location: storeData.location || '',
          phone: storeData.phone || '',
          business_name: storeData.business_name || ''
        });
        if (storeData.id_card_front) setIdFrontPreview(storeData.id_card_front);
        if (storeData.id_card_back) setIdBackPreview(storeData.id_card_back);

        setProfileForm({
          full_name: storeData.user_name || user?.full_name || '',
          phone_number: storeData.phone || user?.phone_number || '',
          business_name: storeData.business_name || '',
          business_description: storeData.business_description || '',
          location: storeData.location || '',
          category_id: storeData.category_id || 1,
          bio: user?.bio || ''
        });
      } catch (storeErr) {
        console.warn('Vendor store profile warning:', storeErr);
      }

      const storeId = storeData?.id;

      // Concurrent fetch of all dashboard & community assets
      const results = await Promise.allSettled([
        API.get('/products'),
        API.get('/services'),
        API.get('/vendor/orders'),
        storeId ? API.get(`/vendors/${storeId}/reviews`) : Promise.resolve({ data: [] }),
        API.get('/conversations'),
        API.get('/reels'),
        API.get('/friends'),
        API.get('/friends/requests/pending'),
        API.get('/students'),
        API.get('/campus/statuses'),
        API.get('/universities')
      ]);

      if (results[0].status === 'fulfilled') {
        const allProds = results[0].value.data || [];
        const filteredProds = storeId ? allProds.filter(p => p.vendor_id === storeId) : allProds;
        setProducts(filteredProds);
        setCachedData('products', filteredProds);
      }
      if (results[1].status === 'fulfilled') {
        const allSvcs = results[1].value.data || [];
        const filteredSvcs = storeId ? allSvcs.filter(s => s.vendor_id === storeId) : allSvcs;
        setServices(filteredSvcs);
        setCachedData('services', filteredSvcs);
      }
      if (results[2].status === 'fulfilled') {
        const ordData = results[2].value.data || [];
        setVendorOrders(ordData);
        setCachedData('orders', ordData);
      }
      if (results[3].status === 'fulfilled') {
        const revs = results[3].value.data || [];
        setVendorReviews(revs);
        setCachedData('reviews', revs);
      }
      if (results[4].status === 'fulfilled') {
        const convs = results[4].value.data || [];
        setConversations(convs);
        setCachedData('conversations', convs);
        prefetchRecentConversations(convs);
      }
      if (results[5].status === 'fulfilled') {
        const rls = results[5].value.data || [];
        setAllReels(rls);
        setCachedData('allReels', rls);
      }
      if (results[6].status === 'fulfilled') {
        const frnds = results[6].value.data || [];
        setFriendsList(frnds);
        setCachedData('friendsList', frnds);
      }
      if (results[7].status === 'fulfilled') {
        const reqs = results[7].value.data || [];
        setPendingRequests(reqs);
        setCachedData('pendingRequests', reqs);
      }
      if (results[8].status === 'fulfilled') {
        const comm = results[8].value.data || [];
        setCommunityUsers(comm);
        setCachedData('communityUsers', comm);
      }
      if (results[9].status === 'fulfilled') {
        const stats = results[9].value.data || [];
        setStatusGroups(stats);
        setCachedData('statusGroups', stats);
      }
      if (results[10].status === 'fulfilled') {
        setUniversities(results[10].value.data || []);
      }
    } catch (err) {
      console.error('Error fetching store info:', err);
    }
  };

  // --- PROFILE MODAL ACTIONS ---
  const handleOpenProfile = async (targetUserId) => {
    try {
      const res = await API.get(`/students/${targetUserId}`);
      setSelectedProfile(res.data);
      setProfileModalOpen(true);
    } catch (err) {
      alert('Failed to load user profile.');
    }
  };

  // --- STATUS STORIES ACTIONS ---
  const handlePublishStatus = async (e) => {
    e.preventDefault();
    setIsPublishingStatus(true);
    try {
      let mediaUrl = null;
      let mediaType = 'text';
      if (statusMediaFile) {
        const isVid = (
          (statusMediaFile.type && statusMediaFile.type.startsWith('video')) ||
          Boolean(statusMediaFile.name && statusMediaFile.name.match(/\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i))
        );
        mediaType = isVid ? 'video' : 'image';
        mediaUrl = await uploadFile(statusMediaFile);
      }

      await API.post('/campus/statuses', {
        media_url: mediaUrl,
        media_type: mediaType,
        caption: statusCaption.trim(),
        background_color: statusBgColor,
        privacy_setting: statusPrivacy
      });

      setCreateStatusModalOpen(false);
      setStatusCaption('');
      setStatusMediaFile(null);
      setStatusMediaPreview(null);
      setFeedbackMsg({ type: 'success', text: 'Status story posted to campus network!' });

      const statRes = await API.get('/campus/statuses');
      setStatusGroups(statRes.data || []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post status.');
    } finally {
      setIsPublishingStatus(false);
    }
  };

  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm('Delete this status story?')) return;
    try {
      await API.delete(`/campus/statuses/${statusId}`);
      setActiveStatusViewer(null);
      setFeedbackMsg({ type: 'info', text: 'Story deleted.' });
      const statRes = await API.get('/campus/statuses');
      setStatusGroups(statRes.data || []);
    } catch (err) {
      alert('Failed to delete status story.');
    }
  };

  const handleReplyToStatus = async (recipientId, customText = null, emoji = null) => {
    const textToSend = typeof customText === 'string' ? customText : statusReplyText;
    if (!emoji && !textToSend.trim()) return;
    if (!activeStatusViewer) return;
    const group = statusGroups[activeStatusViewer.userIdx];
    if (!group) return;
    const currentItem = group.items?.[activeStatusViewer.itemIdx] || group.items?.[0];

    const payload = {
      type: 'status_reply',
      reply_text: emoji ? '' : textToSend.trim(),
      reaction: emoji || null,
      status_id: currentItem?.id,
      status_media_type: currentItem?.media_type || (currentItem?.media_url ? 'image' : 'text'),
      status_media_url: currentItem?.media_url || null,
      status_caption: currentItem?.caption || '',
      status_bg: currentItem?.background_color || null,
      author_name: group.user_name || 'Story'
    };

    try {
      await API.post('/messages', {
        recipient_id: recipientId,
        content: JSON.stringify(payload),
        message_type: 'status_reply',
        media_url: currentItem?.media_url || null
      });
      setStatusReplyText('');
      setActiveStatusViewer(null);
      setFeedbackMsg({ type: 'success', text: emoji ? `Sent ${emoji} reaction!` : 'Reply sent to chat!' });
      
      // Open that chat
      const partner = communityUsers.find(u => (u.user_id === recipientId || u.id === recipientId));
      if (partner) {
        setSelectedPartner({ partner_id: recipientId, partner_name: partner.full_name, role: partner.role });
        handleSelectPartner({ partner_id: recipientId, partner_name: partner.full_name, role: partner.role });
      }
      setActiveTab('messages');
      setMessageSubtab('chats');
      API.get('/conversations').then(res => setConversations(res.data || [])).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send reply.');
    }
  };

  // --- SETTINGS & PROFILE EDIT ACTIONS ---
  const handleUpdateVendorProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // 1. Update user profile
      await API.put('/users/profile', {
        full_name: profileForm.full_name.trim(),
        phone_number: profileForm.phone_number.trim(),
        bio: profileForm.bio.trim()
      });

      // 2. Update vendor store
      await API.put('/vendor/my-store', {
        business_name: profileForm.business_name.trim(),
        business_description: profileForm.business_description.trim(),
        location: profileForm.location.trim(),
        phone: profileForm.phone_number.trim(),
        category_id: parseInt(profileForm.category_id) || 1
      });

      // Update local storage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updated = {
        ...stored,
        full_name: profileForm.full_name.trim(),
        phone_number: profileForm.phone_number.trim(),
        bio: profileForm.bio.trim()
      };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);

      setFeedbackMsg({ type: 'success', text: 'Store profile & settings updated successfully!' });
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update settings.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadFile(file);
      await API.put('/users/profile', { profile_picture_url: url });
      await API.put('/vendor/my-store', { logo: url });
      
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      stored.profile_picture_url = url;
      localStorage.setItem('user', JSON.stringify(stored));
      setUser(stored);
      setFeedbackMsg({ type: 'success', text: 'Profile picture / Store logo updated!' });
      loadStoreData();
    } catch (err) {
      alert('Failed to update picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      await API.put('/users/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      setFeedbackMsg({ type: 'success', text: 'Password changed successfully!' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };


  // --- STATUS & HUB CONTROLS ---
  const handleToggleStoreStatus = (newStatus) => {
    setStoreStatus(newStatus);
    localStorage.setItem('vendor_store_status', newStatus);
    setFeedbackMsg({
      type: 'success',
      text: `Store status updated to: ${newStatus === 'open' ? '🟢 Open for Orders' : newStatus === 'break' ? '🟡 15-Min Break' : '🔴 Closed for Today'}`
    });
  };

  const handleSaveBroadcast = (e) => {
    e.preventDefault();
    setStoreBroadcast(broadcastInput);
    localStorage.setItem('vendor_store_broadcast', broadcastInput);
    setIsEditingBroadcast(false);
    setFeedbackMsg({ type: 'success', text: 'Live announcement banner updated!' });
  };

  const handleSaveBankInfo = (e) => {
    e.preventDefault();
    setBankInfo(bankForm);
    localStorage.setItem('vendor_bank_info', JSON.stringify(bankForm));
    setIsEditingBank(false);
    setFeedbackMsg({ type: 'success', text: 'Store bank payment details saved!' });
  };

  const handleCopyBankDetails = () => {
    const text = `${bankInfo.bank_name} - ${bankInfo.account_number} (${bankInfo.account_name})`;
    navigator.clipboard.writeText(text);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  // --- MESSAGING & CHAT ACTIONS ---
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

  const handleSelectPartner = (partner) => {
    if (!partner) return;
    const newPid = partner.partner_id || partner.user_id || partner.id;
    const cached = getCachedThreadMessages(newPid);
    setChatMessages(cached);
    setIsLoadingChatMessages(false);
    isSwitchingPartnerRef.current = true;
    setSelectedPartner(partner);
    smartScrollToBottom(chatContainerRef.current, false);
  };

  // --- CAMPUSLINK AI CHAT HANDLERS FOR VENDORS ---
  const fetchAiMessages = async () => {
    try {
      const res = await API.get('/ai/messages');
      setAiMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load AI messages:', err);
    }
  };

  const handleSelectAiChat = () => {
    setActiveTab('messages');
    setMessageSubtab('chats');
    setSelectedPartner({
      partner_id: 'campus_ai',
      partner_name: 'CampusLink AI',
      partner_role: 'Campus AI Copilot',
      is_ai: true
    });
    fetchAiMessages();
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
        role_context: 'vendor'
      });

      setAiMessages(prev => [
        ...prev,
        {
          id: res.data.id || ('ai-' + Date.now()),
          sender: 'ai',
          content: res.data.content || res.data.reply,
          created_at: res.data.created_at || new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('Failed to chat with AI:', err);
      setAiMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'ai',
          content: "I ran into a brief connection issue. Please try asking again!",
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleClearAiChat = async () => {
    if (!window.confirm('Start a new conversation with CampusLink AI?')) return;
    try {
      await API.post('/ai/clear');
      setAiMessages([]);
      fetchAiMessages();
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const handleStartReply = (msg) => {
    if (!msg) return;
    setActivePopoverMsgId(null);
    const isMine = (msg.sender_id === user?.user_id) || (msg.sender_id === user?.id);
    const senderName = isMine ? 'You' : (selectedPartner?.partner_name || 'Customer');
    const previewText = (typeof msg.content === 'string' ? msg.content : (msg.text || 'Message')).slice(0, 100);
    setReplyingToMessage({
      id: msg.id,
      sender_name: senderName,
      preview: previewText
    });
  };

  const handleCopyMessageText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setActivePopoverMsgId(null);
    setFeedbackMsg({ type: 'success', text: 'Message copied to clipboard' });
  };

  const handleReactToMessage = (msg, emoji) => {
    if (!msg || !emoji) return;
    setActivePopoverMsgId(null);
    const quoteText = (typeof msg.content === 'string' ? msg.content : (msg.text || 'Message')).slice(0, 80);
    const isMine = (msg.sender_id === user?.user_id) || (msg.sender_id === user?.id);
    const senderName = isMine ? 'You' : (selectedPartner?.partner_name || 'Customer');
    
    // Dispatch instant reaction message with reference to quoted message
    handleSendChatMessage(emoji, {
      id: msg.id,
      sender_name: senderName,
      preview: quoteText
    });
  };

  const handleSendChatMessage = async (customContent = null, customReply = null) => {
    if (selectedPartner?.is_ai) {
      return handleSendAiMessage(customContent);
    }

    const text = customContent || newMsgText;
    const hasMedia = pendingMediaFiles.length > 0;
    if ((!text.trim() && !hasMedia) || !selectedPartner) return;

    const partnerId = selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id;
    const currentReply = customReply || replyingToMessage;
    const messageText = text.trim();

    // If we have selected batch media files to send
    if (hasMedia && !customContent) {
      const filesToUpload = [...pendingMediaFiles];
      setPendingMediaFiles([]);
      setNewMsgText('');
      setReplyingToMessage(null);

      const localPreviews = filesToUpload.map(f => f.previewUrl);
      const isMulti = filesToUpload.length > 1;
      const firstIsVid = filesToUpload[0].type === 'video';
      const fallbackCaption = messageText || (firstIsVid ? 'Video' : isMulti ? `${filesToUpload.length} Photos` : 'Photo');

      const tempId = `temp_media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const optimisticMsg = {
        id: tempId,
        sender_id: user?.user_id || user?.id,
        recipient_id: partnerId,
        content: fallbackCaption,
        message_type: firstIsVid ? 'video' : isMulti ? 'images' : 'image',
        media_url: isMulti ? JSON.stringify(localPreviews) : localPreviews[0],
        reply_to_id: currentReply?.id || null,
        reply_to_sender: currentReply?.sender_name || null,
        reply_to_text: currentReply?.preview || null,
        created_at: new Date().toISOString(),
        is_read: false,
        is_optimistic: true
      };

      appendThreadMessage(partnerId, optimisticMsg);
      setChatMessages(prev => [...prev, optimisticMsg]);
      smartScrollToBottom(chatContainerRef.current, false);

      try {
        const uploadedUrls = await Promise.all(filesToUpload.map(item => uploadFile(item.file)));
        const finalMediaUrl = isMulti ? JSON.stringify(uploadedUrls) : uploadedUrls[0];
        const res = await API.post('/messages', {
          recipient_id: partnerId,
          content: fallbackCaption,
          message_type: firstIsVid ? 'video' : isMulti ? 'images' : 'image',
          media_url: finalMediaUrl,
          reply_to_id: currentReply?.id || null,
          reply_to_sender: currentReply?.sender_name || null,
          reply_to_text: currentReply?.preview || null
        });

        const confirmed = { ...res.data, is_optimistic: false };
        updateThreadMessage(partnerId, tempId, confirmed);
        setChatMessages(prev => prev.map(m => (m.id === tempId ? confirmed : m)));
      } catch (err) {
        console.error('Failed to upload media batch:', err);
        setChatMessages(prev => prev.filter(m => m.id !== tempId));
        alert('Failed to send media files.');
      }
      return;
    }

    // 1. Instantly clear input field and reply preview (0ms latency)
    if (!customContent) {
      setNewMsgText('');
      setReplyingToMessage(null);
    }

    // 2. Optimistic UI Update: Render message into active thread IMMEDIATELY
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: user?.user_id || user?.id,
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
      const idx = prev.findIndex(c => String(c.partner_id || c.user_id) === String(partnerId));
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
      const res = await API.post('/messages', {
        recipient_id: partnerId,
        content: messageText,
        message_type: currentReply ? 'reply' : 'text',
        reply_to_id: currentReply?.id || null,
        reply_to_sender: currentReply?.sender_name || null,
        reply_to_text: currentReply?.preview || null
      });

      const confirmed = { ...res.data, is_optimistic: false };
      updateThreadMessage(partnerId, tempId, confirmed);
      setChatMessages(prev => prev.map(m => (m.id === tempId ? confirmed : m)));
    } catch (err) {
      console.error('Failed to deliver message:', err);
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      alert(err.response?.data?.detail || 'Failed to send message.');
    }
  };

  const handleChatMediaSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedPartner) return;
    
    const validItems = files.slice(0, 10).map(file => ({
      id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type?.startsWith('video') ? 'video' : 'image',
      name: file.name
    }));

    setPendingMediaFiles(prev => [...prev, ...validItems].slice(0, 10));
    if (chatMediaInputRef.current) chatMediaInputRef.current.value = '';
  };

  const handleRemovePendingMedia = (idToRemove) => {
    setPendingMediaFiles(prev => {
      const remaining = prev.filter(item => item.id !== idToRemove);
      const removed = prev.find(item => item.id === idToRemove);
      if (removed?.previewUrl) {
        try { URL.revokeObjectURL(removed.previewUrl); } catch {}
      }
      return remaining;
    });
  };

  const handleConfirmSendChatMedia = async (file, caption = '') => {
    setShowMediaEditor(false);
    setPendingMediaFile(null);
    if (!file || !selectedPartner) return;

    const isVid = file.type?.startsWith('video');
    const partnerId = selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id;
    const currentReply = replyingToMessage;
    setReplyingToMessage(null);

    // 1. Optimistic 0ms Render: Create local preview URL
    const localMediaUrl = URL.createObjectURL(file);
    const tempId = `temp_media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const displayCaption = caption?.trim() || (isVid ? 'Video' : 'Photo');

    const optimisticMsg = {
      id: tempId,
      sender_id: user?.user_id || user?.id,
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
      const idx = prev.findIndex(c => String(c.partner_id || c.user_id) === String(partnerId));
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
      setChatMessages(prev => prev.map(m => (m.id === tempId ? confirmed : m)));
    } catch (err) {
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      alert(err.response?.data?.detail || 'Failed to send media.');
    }
  };

  // --- FRIEND REQUEST ACTIONS ---
  const handleSendFriendRequest = async (targetUserId) => {
    try {
      const res = await API.post(`/friends/request/${targetUserId}`);
      setFeedbackMsg({ type: 'success', text: res.data.message || 'Friend request sent!' });
      
      setCommunityUsers(prev => prev.map(u => 
        (u.user_id === targetUserId || u.id === targetUserId)
          ? { ...u, friendship_status: 'request_sent' }
          : u
      ));
      if (selectedProfile && (selectedProfile.user_id === targetUserId || selectedProfile.id === targetUserId)) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'request_sent' }));
      }
      
      const [pendRes, commRes] = await Promise.all([
        API.get('/friends/requests/pending'),
        API.get('/students')
      ]);
      setPendingRequests(pendRes.data);
      setCommunityUsers(commRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send friend request.');
    }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      const res = await API.post(`/friends/requests/${requestId}/accept`);
      setFeedbackMsg({ type: 'success', text: res.data.message || 'Friend request accepted!' });
      if (selectedProfile) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'friends' }));
      }
      
      const [friendsRes, pendRes, commRes] = await Promise.all([
        API.get('/friends'),
        API.get('/friends/requests/pending'),
        API.get('/students')
      ]);
      setFriendsList(friendsRes.data);
      setPendingRequests(pendRes.data);
      setCommunityUsers(commRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept friend request.');
    }
  };

  const handleDeclineFriendRequest = async (requestId) => {
    try {
      await API.post(`/friends/requests/${requestId}/decline`);
      setFeedbackMsg({ type: 'info', text: 'Friend request declined.' });
      if (selectedProfile) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'none' }));
      }
      const pendRes = await API.get('/friends/requests/pending');
      setPendingRequests(pendRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to decline request.');
    }
  };

  const handleRemoveFriend = async (targetUserId) => {
    if (!window.confirm('Remove friend from your campus network?')) return;
    try {
      await API.delete(`/friends/cancel/${targetUserId}`);
      setFeedbackMsg({ type: 'info', text: 'Removed connection.' });
      if (selectedProfile && (selectedProfile.user_id === targetUserId || selectedProfile.id === targetUserId)) {
        setSelectedProfile(prev => ({ ...prev, friendship_status: 'none', request_id: null }));
      }
      const [friendsRes, commRes] = await Promise.all([
        API.get('/friends'),
        API.get('/students')
      ]);
      setFriendsList(friendsRes.data);
      setCommunityUsers(commRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove connection.');
    }
  };

  // --- REELS & COMMENTS ACTIONS ---
  const handleLikeReel = async (reelId) => {
    setAllReels(prev => prev.map(r => {
      if (r.id === reelId) {
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
      const res = await API.post(`/reels/${reelId}/like`);
      setAllReels(prev => prev.map(r => r.id === reelId ? { ...r, likes_count: res.data.likes_count, has_liked: res.data.has_liked } : r));
    } catch (err) {
      console.error('Error liking reel:', err);
    }
  };

  const handlePostReelComment = async (reelId) => {
    if (!newCommentText.trim()) return;
    const content = newCommentText.trim();
    const currentReply = replyingToComment;
    const tempId = `temp_vcomm_${Date.now()}`;

    // 1. Instantly clear input and reply target
    setNewCommentText('');
    setReplyingToComment(null);

    // 2. Optimistic insert
    const optimisticComment = {
      id: tempId,
      reel_id: reelId,
      user_id: user?.user_id || user?.id,
      content: content,
      author_name: user?.business_name || user?.full_name || 'Campus Merchant',
      author_avatar: user?.profile_picture_url || null,
      author_role: 'Vendor',
      reply_to_comment_id: currentReply?.commentId || null,
      reply_to_author: currentReply?.authorName || null,
      created_at: new Date().toISOString(),
      is_optimistic: true
    };

    setAllReels(prev => prev.map(r => {
      if (r.id === reelId) {
        const currentComments = r.comments || [];
        const updated = [...currentComments, optimisticComment];
        return {
          ...r,
          comments: updated,
          comments_count: updated.length
        };
      }
      return r;
    }));

    setIsPostingComment(true);
    try {
      const payload = {
        content: content,
        reply_to_comment_id: currentReply?.commentId || null
      };
      const res = await API.post(`/reels/${reelId}/comments`, payload);
      setAllReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const updated = (r.comments || []).map(c => c.id === tempId ? res.data : c);
          return {
            ...r,
            comments: updated,
            comments_count: updated.length
          };
        }
        return r;
      }));
      setFeedbackMsg({ type: 'success', text: currentReply ? `Reply sent to @${currentReply.authorName}!` : 'Comment published on campus drop!' });
    } catch (err) {
      setAllReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const updated = (r.comments || []).filter(c => c.id !== tempId);
          return { ...r, comments: updated, comments_count: updated.length };
        }
        return r;
      }));
      alert(err.response?.data?.detail || 'Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Submit ID Verification (with flexible document types for graduates & campus restaurants)
  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let frontUrl = verificationForm.id_card_front;
      let backUrl = verificationForm.id_card_back;

      if (idFrontFile) {
        frontUrl = await uploadFile(idFrontFile);
      }
      if (idBackFile) {
        backUrl = await uploadFile(idBackFile);
      }

      if (!frontUrl || !backUrl) {
        alert('Please select clear photos for both FRONT and BACK (or Page 1 and 2) of your verification document.');
        setIsSubmitting(false);
        return;
      }

      await API.post('/vendor/verification', {
        ...verificationForm,
        id_card_front: frontUrl,
        id_card_back: backUrl
      });

      setFeedbackMsg({ type: 'success', text: 'Verification document submitted! Campus Admins will review and approve your store.' });
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Verification submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      price: '',
      category_id: 1,
      quantity: 1,
      university_id: vendorStore?.university_id || (universities[0]?.id || '')
    });
    setProdFile(null);
    setProdPreview(null);
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      description: prod.description || '',
      price: prod.price || '',
      category_id: prod.category_id || 1,
      quantity: prod.quantity || 1,
      university_id: prod.university_id || vendorStore?.university_id || ''
    });
    setProdFile(null);
    setProdPreview(prod.image || null);
    setShowProductModal(true);
  };

  // Create or Update Product (with file upload & campus selection)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let imageUrl = editingProduct ? editingProduct.image : 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80';
      if (prodFile) {
        imageUrl = await uploadFile(prodFile);
      }

      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price: parseFloat(productForm.price),
        category_id: parseInt(productForm.category_id),
        quantity: parseInt(productForm.quantity) || 1,
        university_id: productForm.university_id ? parseInt(productForm.university_id) : (vendorStore?.university_id || null),
        image: imageUrl
      };

      if (editingProduct) {
        await API.put(`/products/${editingProduct.id}`, payload);
        setFeedbackMsg({ type: 'success', text: 'Product details and campus dispatch updated!' });
      } else {
        await API.post('/products', payload);
        setFeedbackMsg({ type: 'success', text: 'Product published to Campus Marketplace!' });
      }

      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ name: '', description: '', price: '', category_id: 1, quantity: 1, university_id: '' });
      setProdFile(null);
      setProdPreview(null);
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || (editingProduct ? 'Failed to update product.' : 'Failed to add product.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Service (with file upload)
  const handleCreateService = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let imageUrl = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80';
      if (svcFile) {
        imageUrl = await uploadFile(svcFile);
      }

      await API.post('/services', {
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim(),
        price: parseFloat(serviceForm.price),
        category_id: parseInt(serviceForm.category_id),
        location: serviceForm.location.trim() || vendorStore?.location,
        image: imageUrl
      });

      setShowServiceModal(false);
      setServiceForm({ name: '', description: '', price: '', category_id: 5, location: '' });
      setSvcFile(null);
      setSvcPreview(null);
      setFeedbackMsg({ type: 'success', text: 'Service published to Campus Marketplace!' });
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Reel (with file upload)
  const handleCreateReel = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let mediaUrl = 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80';
      let mediaType = reelForm.media_type;

      if (reelMediaFile) {
        mediaUrl = await uploadFile(reelMediaFile);
        mediaType = reelMediaFile.type.startsWith('video') ? 'video' : 'image';
      }

      await API.post('/reels', {
        title: reelForm.title.trim(),
        description: reelForm.description.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        location: reelForm.location.trim() || vendorStore?.location || 'Campus SUB'
      });

      setShowReelModal(false);
      setReelForm({ title: '', description: '', media_type: 'image', location: '' });
      setReelMediaFile(null);
      setReelMediaPreview(null);
      setFeedbackMsg({ type: 'success', text: 'Promotional Drop published to Campus Reels feed!' });
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post reel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await API.delete(`/products/${id}`);
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed.');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await API.post(`/orders/${orderId}/status?status_update=${newStatus}`);
      loadStoreData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Status update failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isVerified = vendorStore?.verification_status === 'verified';
  const pendingOrdersCount = vendorOrders.filter(o => o.status === 'pending').length;
  const totalRevenue = vendorOrders
    .filter(o => o.status === 'completed' || o.status === 'confirmed')
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  // Filtered Community Users for Find Friends
  const filteredCommunity = communityUsers.filter(u => {
    const matchesRole = communityRoleFilter === 'all' ? true : u.role === communityRoleFilter;
    const query = communitySearch.toLowerCase().trim();
    if (!query) return matchesRole;
    const nameMatch = (u.full_name || '').toLowerCase().includes(query);
    const deptMatch = (u.department || '').toLowerCase().includes(query);
    const hostelMatch = (u.hostel || '').toLowerCase().includes(query);
    const bizMatch = (u.business_name || '').toLowerCase().includes(query);
    return matchesRole && (nameMatch || deptMatch || hostelMatch || bizMatch);
  });

  // Filtered Reels
  const filteredReels = reelFeedFilter === 'my_drops'
    ? allReels.filter(r => (r.author_id === user?.user_id || r.user_id === user?.user_id || r.author_id === user?.id))
    : allReels;

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased flex flex-col md:flex-row select-none">
      {/* Floating In-App Chat Notification Alert */}
      <InAppChatBanner
        banner={inAppBanner}
        onReply={handleReplyFromBanner}
        onDismiss={() => setInAppBanner(null)}
      />
      
      {/* --- DESKTOP SIDEBAR (Visible md and up) --- */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 p-5 flex-col justify-between shrink-0 shadow-xs h-full overflow-y-auto">
        <div>
          <Link to="/" className="flex items-center space-x-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-sky-500/20">
              CL
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                CAMPUS<span className="text-sky-600">VENDOR</span>
              </span>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Merchant Portal</span>
            </div>
          </Link>

          {/* Business Badge & Operational Status */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 mb-6">
            <div className="flex items-center space-x-3 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
                {vendorStore?.logo ? (
                  <SafeImage src={vendorStore.logo} alt="Logo" fallbackType="store" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5" />
                )}
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-slate-900 block truncate">{vendorStore?.business_name || 'Vendor Store'}</span>
                {isVerified ? (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified Merchant</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Pending Verification</span>
                  </span>
                )}
              </div>
            </div>

            {/* Campus Dispatch Info */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Campus:</span>
              <span className="font-bold text-sky-700 truncate max-w-[130px] flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                <span className="truncate">{vendorStore?.university_abbr || vendorStore?.university_name || 'Main Campus'}</span>
              </span>
            </div>
          </div>

          <nav className="space-y-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'inventory' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products Catalog</span>
              <span className="ml-auto text-[10px] font-bold">{products.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'services' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Campus Services</span>
              <span className="ml-auto text-[10px] font-bold">{services.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'orders' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Customer Orders</span>
              {pendingOrdersCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'messages' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chats & Stories</span>
              {(totalUnreadChatCount > 0 || pendingRequests.length > 0) && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-xs animate-pulse">
                  {totalUnreadChatCount > 0 ? totalUnreadChatCount : pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reels')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'reels' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Campus Reels & Drops</span>
            </button>

            <button
              onClick={() => setActiveTab('hub')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'hub' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Sales & Business Hub</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Profile & Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('verification')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'verification' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ID & Business Verification</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* --- MOBILE TOP HEADER (Sticky, Compact, Responsive & Install App) --- */}
      <header className={`sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 py-2 items-center justify-between shadow-2xs gap-2 ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'flex md:hidden'}`}>
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-xs text-white shadow-md shadow-sky-500/20 shrink-0">
            CL
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 block leading-tight truncate">
              CAMPUS<span className="text-sky-600">VENDOR</span>
            </span>
            <span className="text-[9px] font-bold text-slate-500 block truncate max-w-[100px] sm:max-w-[130px]">
              {vendorStore?.business_name || 'My Store'}
            </span>
          </div>
        </div>

        {/* Campus Origin Badge (Auto-scales on mobile) */}
        <div className="hidden min-[400px]:flex items-center space-x-1 px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-full text-[10px] font-bold text-sky-700 shadow-2xs shrink-0 max-w-[120px]">
          <MapPin className="w-3 h-3 text-sky-600 shrink-0" />
          <span className="truncate">{vendorStore?.university_abbr || vendorStore?.university_name || 'Campus'}</span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-xl cursor-pointer transition-colors ${activeTab === 'settings' ? 'bg-sky-50 text-sky-600 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
            title="Store Settings & Profile"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full min-w-0 max-w-full overflow-x-hidden pb-28 md:pb-8">
        
        {/* Live Store Announcement Banner (Always visible if configured) */}
        {storeBroadcast && (
          <div className={`mb-5 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-200/80 items-center justify-between text-xs text-sky-900 ${selectedPartner && activeTab === 'messages' ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span className="font-bold shrink-0 text-sky-700">STORE ANNOUNCEMENT:</span>
              <span className="font-medium truncate">{storeBroadcast}</span>
            </div>
            <button
              onClick={() => { setActiveTab('hub'); setIsEditingBroadcast(true); }}
              className="text-[10px] font-bold text-sky-700 hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Edit
            </button>
          </div>
        )}

        {/* Verification Alert Banner */}
        {!isVerified && (
          <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  {vendorStore?.verification_status === 'rejected' ? 'Verification Rejected' : 'Store Verification Pending'}
                </h4>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {vendorStore?.rejection_reason || 'Undergraduate or graduate restaurant owners, campus food operators, and external kiosks can verify with Student ID, National ID (NIN), Voter\'s Card, Driver\'s License, or CAC/Commercial Lease.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('verification')}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0 cursor-pointer shadow-xs"
            >
              {vendorStore?.id_card_front ? 'Update Verification Details' : 'Verify ID / Business'}
            </button>
          </div>
        )}

        {/* Feedback Message */}
        {feedbackMsg.text && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg({ type: '', text: '' })} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 1: PRODUCTS INVENTORY --- */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Products & Catalog
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Manage food packs, sneakers, stationery & gadget accessories.
                </p>
              </div>

              <button
                disabled={!isVerified}
                onClick={handleOpenAddProduct}
                title={!isVerified ? 'Complete ID verification first' : ''}
                className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {products.map((item) => (
                  <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="h-44 w-full rounded-2xl overflow-hidden bg-slate-100 mb-4 relative">
                        <SafeImage src={item.image} alt={item.name} fallbackType="product" className="w-full h-full object-cover" />
                        <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] font-bold text-sky-700 shadow-xs flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-sky-600" />
                          <span>{item.university_abbr || item.university_name || vendorStore?.university_abbr || 'Campus'}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-black text-sky-700">₦{Number(item.price).toLocaleString()}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Qty: {item.quantity}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>In Stock</span>
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenEditProduct(item)}
                          className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-colors cursor-pointer"
                          title="Edit product"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-10">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">Your store catalog is empty</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {isVerified ? 'Add your products to start selling to students on campus.' : 'Your store will be ready to list products once your ID or business document is approved by campus admins.'}
                </p>
                {isVerified && (
                  <button
                    onClick={handleOpenAddProduct}
                    className="mt-4 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-full shadow-md cursor-pointer"
                  >
                    + Add Your First Product
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 2: SERVICES --- */}
        {/* ========================================================================= */}
        {activeTab === 'services' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Campus Student Services
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Laundry, photography, tech repairs, tutoring & styling services.
                </p>
              </div>

              <button
                disabled={!isVerified}
                onClick={() => setShowServiceModal(true)}
                className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Service</span>
              </button>
            </div>

            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {services.map((svc) => (
                  <div key={svc.id} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="h-40 w-full rounded-2xl overflow-hidden bg-slate-100 mb-4">
                        <SafeImage src={svc.image} alt={svc.name} fallbackType="product" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs text-sky-600 font-bold block mb-1">Starting from ₦{Number(svc.price).toLocaleString()}</span>
                      <h4 className="font-bold text-sm text-slate-900">{svc.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{svc.description}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{svc.location || 'On Campus'}</span>
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Active</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-10">
                <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No services listed yet</h4>
                <p className="text-xs text-slate-500 mt-1">Offer laundry pickup, phone screen repair or photography options.</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 3: INCOMING ORDERS --- */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Customer Orders & Deliveries
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Track orders placed by students across dorms & academic faculties.
                </p>
              </div>
            </div>

            {vendorOrders.length > 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                {/* Desktop Orders Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Item Ordered</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Delivery Location</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendorOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-900">
                            <button
                              onClick={() => handleOpenProfile(o.customer_id || o.user_id)}
                              className="text-left hover:text-sky-600 hover:underline cursor-pointer"
                            >
                              {o.customer_name}
                            </button>
                          </td>
                          <td className="p-4 font-semibold text-slate-700">{o.item_title} (x{o.quantity})</td>
                          <td className="p-4 font-black text-sky-700">₦{Number(o.amount).toLocaleString()}</td>
                          <td className="p-4 text-slate-500">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{o.delivery_location}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              o.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                              o.status === 'confirmed' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {o.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 space-x-2">
                            {o.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(o.id, 'confirmed')}
                                className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                            )}
                            {o.status === 'confirmed' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Mark Delivered
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Orders Card View */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {vendorOrders.map((o) => (
                    <div key={o.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            onClick={() => handleOpenProfile(o.customer_id || o.user_id)}
                            className="text-left font-bold text-sm text-slate-900 hover:text-blue-600 truncate block"
                          >
                            {o.customer_name}
                          </button>
                          <p className="text-xs font-semibold text-slate-700 mt-0.5">{o.item_title} <span className="text-slate-400">(x{o.quantity})</span></p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          o.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          o.status === 'confirmed' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {o.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <div className="flex items-center space-x-1 text-slate-500 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[170px]">{o.delivery_location || 'Campus Delivery'}</span>
                        </div>
                        <span className="font-black text-blue-700 text-sm shrink-0">₦{Number(o.amount).toLocaleString()}</span>
                      </div>

                      <div className="pt-1">
                        {o.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(o.id, 'confirmed')}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
                          >
                            Confirm Order
                          </button>
                        )}
                        {o.status === 'confirmed' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
                          >
                            Mark as Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-10">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No orders received yet</h4>
                <p className="text-xs text-slate-500 mt-1">When students place orders for food packs or items, they appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 4: CHATS & CAMPUS NETWORK (INQUIRIES + STORIES + FRIENDS) --- */}
        {/* ========================================================================= */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            
            {/* Header & Subtabs */}
            <div className={`flex-col sm:flex-row sm:items-center justify-between gap-3 ${selectedPartner && messageSubtab === 'chats' ? 'hidden md:flex' : 'flex'}`}>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Chats, Stories & Network
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Chat with student buyers, view 24h campus stories, and connect with peers.
                </p>
              </div>

              {/* Subtabs Pill Switcher */}
              <div className="flex items-center space-x-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
                <button
                  onClick={() => setMessageSubtab('chats')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                    messageSubtab === 'chats' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Customer Inquiries</span>
                  {totalUnreadChatCount > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-xs animate-pulse">
                      {totalUnreadChatCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setMessageSubtab('friends')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                    messageSubtab === 'friends' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Find Students & Vendors</span>
                </button>

                <button
                  onClick={() => setMessageSubtab('requests')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 relative ${
                    messageSubtab === 'requests' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Requests</span>
                  {pendingRequests.length > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                      {pendingRequests.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setMessageSubtab('my_friends')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                    messageSubtab === 'my_friends' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Friends ({friendsList.length})</span>
                </button>
              </div>
            </div>

            {/* CAMPUS STATUS STORIES RAIL (Visible at the top of Chats) */}
            <div className={`p-4 bg-white border border-slate-200 rounded-3xl shadow-xs ${selectedPartner && messageSubtab === 'chats' ? 'hidden md:block' : 'block'}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Camera className="w-3.5 h-3.5 text-sky-500" />
                  <span>Campus Stories & Status Updates</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{statusGroups.length} campus updates</span>
              </div>

              <div className="flex items-center space-x-4 overflow-x-auto pb-1 scrollbar-none">
                {/* 1. My Story (Tap to Add Status) */}
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
                        className={`relative w-14 h-14 rounded-full p-0.5 transition-all flex items-center justify-center bg-slate-50 overflow-visible ${
                          hasMyStory
                            ? 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 shadow-xs shadow-sky-500/25'
                            : 'border-2 border-dashed border-sky-400 group-hover:border-sky-600'
                        }`}
                      >
                        <div className="w-full h-full rounded-full bg-white p-0.5 flex items-center justify-center overflow-hidden">
                          {user?.profile_picture_url || vendorStore?.logo ? (
                            <SafeImage
                              src={user?.profile_picture_url || vendorStore?.logo}
                              alt="My Status"
                              fallbackType="avatar"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm">
                              {user?.full_name?.charAt(0) || 'V'}
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
                          title="Post new story drop"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 mt-1.5">My Story</span>
                      <span className="text-[9px] text-slate-400">
                        {hasMyStory ? `${selfGroup.items.length} update${selfGroup.items.length > 1 ? 's' : ''}` : 'Post drop'}
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
                              <SafeImage src={group.user_avatar} alt={group.user_name} fallbackType="avatar" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <div className="w-full h-full rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                                {group.user_name.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 mt-1.5 truncate max-w-[70px] text-center">
                          {group.is_self ? 'You' : group.user_name.split(' ')[0]}
                        </span>
                        <span className={`text-[9px] font-semibold ${isUnviewed ? 'text-sky-600' : 'text-slate-400'}`}>
                          {isUnviewed ? 'New story' : 'Viewed'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* --- SUBTAB A: ACTIVE INQUIRIES & CHAT INTERFACE --- */}
            {messageSubtab === 'chats' && (
              <div className={`flex flex-col md:flex-row bg-white border border-slate-200 overflow-hidden shadow-xs ${selectedPartner ? 'h-[calc(100dvh-2rem)] md:h-[calc(100vh-18rem)] rounded-2xl md:rounded-3xl' : 'h-[calc(100vh-18rem)] min-h-[500px] rounded-3xl'}`}>
                
                {/* Conversations List */}
                <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0 bg-white ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between font-bold text-xs text-slate-800">
                    <div className="flex items-center space-x-2">
                      <span>Recent Customer Chats</span>
                      {totalUnreadChatCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                          {totalUnreadChatCount} new
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                      {conversations.length} Active
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {/* PINNED: CampusLink AI Copilot */}
                    <div className="p-2 border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-white">
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
                            <span className={`text-[10px] font-semibold flex items-center space-x-0.5 ${
                              selectedPartner?.is_ai ? 'text-blue-100' : 'text-blue-600'
                            }`}>
                              <span>Copilot</span>
                            </span>
                          </div>
                          <p className={`text-[11px] truncate mt-0.5 ${
                            selectedPartner?.is_ai ? 'text-blue-100' : 'text-slate-500'
                          }`}>
                            {aiMessages.length > 0
                              ? (aiMessages[aiMessages.length - 1].content || 'Chat with your AI copilot')
                              : 'Draft replies, promos, grammar & math'}
                          </p>
                        </div>
                      </button>
                    </div>

                    {conversations.map((c) => {
                        const pid = c.partner_id || c.user_id;
                        const partnerStoryIdx = statusGroups.findIndex(g => String(g.user_id) === String(pid));
                        const hasStory = partnerStoryIdx !== -1;
                        const storyGroup = hasStory ? statusGroups[partnerStoryIdx] : null;
                        const hasUnviewedStory = hasStory && (storyGroup.has_unviewed !== false && !storyGroup.all_viewed);

                        return (
                          <button
                            key={pid}
                            onClick={() => handleSelectPartner(c)}
                            className={`w-full p-3.5 text-left flex items-start space-x-3 transition-colors cursor-pointer ${
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
                                } else {
                                  e.stopPropagation();
                                  handleOpenProfile(pid);
                                }
                              }}
                              title={hasStory ? `Tap to view ${c.partner_name}'s story` : 'View Profile'}
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
                                  <SafeImage src={c.partner_avatar} alt="Avatar" fallbackType="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm">
                                    {c.partner_name?.charAt(0) || 'S'}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex-1 overflow-hidden">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 truncate">{c.partner_name}</span>
                                <div className="flex items-center space-x-1.5 shrink-0">
                                  {c.unread_count > 0 && (
                                    <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs animate-pulse">
                                      {c.unread_count}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400">
                                    {c.role === 'vendor' ? '🏪 Vendor' : '🎓 Student'}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {(() => {
                                  if (!c.last_message) return 'Inquired about product...';
                                  if (c.last_message.includes('"type":"status_reply"') || c.message_type === 'status_reply') {
                                    const parsed = parseStatusReply(c.last_message);
                                    return parsed.reaction ? `Reacted ${parsed.reaction} to story` : `Replied to story: "${parsed.replyText}"`;
                                  }
                                  return c.last_message;
                                })()}
                              </p>
                            </div>
                          </button>
                        );
                      })}

                    {conversations.length === 0 && (
                      <div className="p-6 text-center text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold text-slate-500">No customer chats yet</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">When customers message your store, they will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat Panel */}
                <div className={`flex-1 min-h-0 flex flex-col justify-between bg-slate-50/50 overflow-hidden ${selectedPartner ? 'flex' : 'hidden md:flex'}`}>
                  {selectedPartner ? (
                    selectedPartner.is_ai ? (
                      <>
                        {/* AI Chat Header */}
                        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedPartner(null)}
                              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                              title="Back to conversation list"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5 sm:space-x-2">
                                <h4 className="text-xs font-bold text-slate-900 truncate">CampusLink AI Copilot</h4>
                                <span className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-full font-bold shrink-0">
                                  Online • 24/7
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate max-w-[170px] sm:max-w-none">Merchant business copilot & universal intelligence</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={handleClearAiChat}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors flex items-center space-x-1"
                              title="Start new conversation"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>New Chat</span>
                            </button>
                          </div>
                        </div>

                        {/* AI Chat Messages Stream */}
                        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-3 chat-thread-container">
                          {aiMessages.length > 0 ? (
                            aiMessages.map((msg, idx) => (
                              <div
                                key={msg.id || idx}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                {msg.sender === 'ai' && (
                                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mr-2 shadow-xs mt-0.5">
                                    <Bot className="w-4 h-4" />
                                  </div>
                                )}
                                <div
                                  className={`chat-bubble-tactile max-w-[85%] sm:max-w-[75%] p-3 sm:p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                                    msg.sender === 'user'
                                      ? 'bg-blue-600 text-white rounded-br-xs'
                                      : 'bg-white border border-slate-200/80 text-slate-900 rounded-bl-xs'
                                  }`}
                                >
                                  {msg.sender === 'user' ? (
                                    <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                                  ) : (
                                    <MarkdownRenderer content={msg.content} />
                                  )}
                                  <span className={`float-right mt-1 ml-2 text-[10px] leading-none select-none font-medium ${
                                    msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                                  }`}>
                                    {safeTime(msg.created_at, 'Now')}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-10 px-4 text-center max-w-md mx-auto">
                              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                                <Sparkles className="w-7 h-7" />
                              </div>
                              <h3 className="text-base font-black text-slate-800">CampusLink AI Copilot for Merchants</h3>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Ask me to draft persuasive customer replies, write promotional WhatsApp drops, calculate discounts, or answer any general question (grammar, math, coding, science, and life on campus)!
                              </p>

                              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                                {[
                                  { text: "How do I reply to this customer asking for a discount?", icon: "💬" },
                                  { text: "Write a catchy WhatsApp promo for my new products", icon: "📢" },
                                  { text: "What is a noun?", icon: "📚" },
                                  { text: "What is 20% of ₦45,000?", icon: "🔢" }
                                ].map((promptItem, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleSendAiMessage(promptItem.text)}
                                    className="p-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left text-[11px] text-slate-700 transition-all cursor-pointer shadow-2xs flex items-start space-x-2"
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
                              <div className="p-3 bg-white border border-slate-200/80 rounded-2xl rounded-bl-xs text-slate-600 text-xs shadow-xs flex items-center space-x-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse delay-75" />
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-150" />
                                <span className="font-medium text-slate-600 ml-1">CampusLink AI is formulating a response...</span>
                              </div>
                            </div>
                          )}
                          <div ref={chatBottomRef} />
                        </div>

                        {/* AI Input Form */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendAiMessage();
                          }}
                          className="p-3 bg-white border-t border-slate-200 flex items-end space-x-2"
                        >
                          <textarea
                            rows={1}
                            placeholder="Ask CampusLink AI anything (code, grammar, customer replies, math, concepts)..."
                            value={newMsgText}
                            onChange={(e) => {
                              setNewMsgText(e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                            }}
                            onKeyDown={(e) => {
                              const isMobileDevice = typeof navigator !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768));
                              if (e.key === 'Enter') {
                                if (isMobileDevice) return;
                                if (e.shiftKey || e.altKey) return;
                                e.preventDefault();
                                if (newMsgText.trim() && !isAiTyping) {
                                  handleSendAiMessage();
                                }
                              }
                            }}
                            disabled={isAiTyping}
                            className="flex-1 p-2.5 max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none leading-relaxed transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={!newMsgText.trim() || isAiTyping}
                            className="min-h-[44px] px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl cursor-pointer disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 mb-0.5 active:scale-95"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        {/* Chat Header */}
                        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedPartner(null)}
                              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer relative"
                              title="Back to conversation list"
                            >
                              <ChevronLeft className="w-5 h-5" />
                              {otherUnreadChatCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                                  {otherUnreadChatCount}
                                </span>
                              )}
                            </button>

                            {/* WhatsApp-Style Clickable Avatar with Story Ring */}
                            {(() => {
                              const pid = selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id;
                              const partnerStoryIdx = statusGroups.findIndex(g => String(g.user_id) === String(pid));
                              const hasStory = partnerStoryIdx !== -1;
                              const storyGroup = hasStory ? statusGroups[partnerStoryIdx] : null;
                              const hasUnviewedStory = hasStory && (storyGroup.has_unviewed !== false && !storyGroup.all_viewed);

                              return (
                                <div
                                  onClick={() => {
                                    if (hasStory) {
                                      const firstUnviewed = storyGroup.items.findIndex(it => !it.is_viewed);
                                      setActiveStatusViewer({
                                        userIdx: partnerStoryIdx,
                                        itemIdx: firstUnviewed !== -1 ? firstUnviewed : 0
                                      });
                                    } else {
                                      handleOpenProfile(pid);
                                    }
                                  }}
                                  title={hasStory ? `Tap to view ${selectedPartner.partner_name}'s story` : 'Click to view profile'}
                                  className={`relative shrink-0 rounded-2xl transition-all cursor-pointer ${
                                    hasStory
                                      ? `p-0.5 ${
                                          hasUnviewedStory
                                            ? 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 shadow-xs shadow-sky-500/25 hover:scale-105'
                                            : 'bg-slate-200 border border-slate-300 opacity-70'
                                        }`
                                      : ''
                                  }`}
                                >
                                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-sky-100 flex items-center justify-center">
                                    {selectedPartner.partner_avatar ? (
                                      <SafeImage src={selectedPartner.partner_avatar} alt="Avatar" fallbackType="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-xs">
                                        {selectedPartner.partner_name?.charAt(0) || 'U'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            <div
                              onClick={() => handleOpenProfile(selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id)}
                              className="min-w-0 cursor-pointer group"
                            >
                              <div className="flex items-center space-x-1.5">
                                <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                  {selectedPartner.partner_name}
                                </h4>
                                <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                                  {selectedPartner.role === 'vendor' ? 'Vendor' : 'Student'}
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

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenProfile(selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={() => {
                                const text = `Hi! You can also reach our stall line directly on WhatsApp: ${vendorStore?.phone || user?.phone_number || '08012345678'}`;
                                handleSendChatMessage(text);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                            >
                              Share WhatsApp
                            </button>
                          </div>
                        </div>

                        {/* Cross-Profile Unread Indicator */}
                        {otherUnreadChatCount > 0 && (
                          <div
                            onClick={() => setSelectedPartner(null)}
                            className="bg-blue-50 hover:bg-blue-100 border-b border-blue-200 px-3 py-1.5 text-xs text-blue-800 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <span className="font-semibold flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              <span>You have <strong>{otherUnreadChatCount}</strong> unread message{otherUnreadChatCount > 1 ? 's' : ''} in other chats</span>
                            </span>
                            <span className="text-[11px] font-bold text-blue-600 underline">View all</span>
                          </div>
                        )}

                        {/* Chat Messages */}
                        <div ref={chatContainerRef} className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-2.5 chat-thread-container">
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
                            chatMessages.map((msg, idx) => {
                              const isMine = (msg.sender_id === user?.user_id) || (msg.sender_id === user?.id);
                              const isStatusReply = msg.message_type === 'status_reply' || (typeof msg.content === 'string' && (msg.content.includes('"type":"status_reply"') || msg.content.startsWith('Replying to') || msg.content.startsWith('Reacted ')));
                              const statusData = isStatusReply ? parseStatusReply(msg.content) : null;
                              const chatReply = parseChatReply(msg);
                              const isHighlighted = highlightedMessageId === msg.id || String(highlightedMessageId) === String(msg.id);
                              const rawMsgText = msg.content || msg.text || '';
                              const showPopover = activePopoverMsgId === msg.id;

                              return (
                                <div
                                  key={msg.id || idx}
                                  id={`chat-msg-${msg.id}`}
                                  data-msg-id={msg.id}
                                  className={`transition-all duration-300 relative ${isMine ? 'flex justify-end' : 'flex justify-start'}`}
                                >
                                  <SwipeableMessageBubble
                                    message={msg}
                                    isMine={isMine}
                                    onReply={handleStartReply}
                                  >
                                    <div
                                      onClick={() => setActivePopoverMsgId(prev => (prev === msg.id ? null : msg.id))}
                                      className={`chat-bubble-tactile relative group max-w-[85%] sm:max-w-[70%] p-2.5 sm:p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed transition-all cursor-pointer select-text ${
                                        isHighlighted ? 'ring-4 ring-blue-400 ring-offset-2 scale-[1.02] shadow-lg shadow-blue-500/25 z-20' : ''
                                      } ${
                                        isMine
                                          ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                                          : 'bg-white border border-slate-200/80 text-slate-900 rounded-bl-xs shadow-xs'
                                      }`}
                                    >
                                      {/* Tactile Floating Action Toolbar (Tap/Hover Popover) */}
                                      <div
                                        className={`chat-popover-toolbar absolute -top-11 ${
                                          isMine ? 'right-0' : 'left-0'
                                        } z-30 flex items-center space-x-1 px-2 py-1 rounded-full border border-slate-200/80 shadow-md transition-all ${
                                          showPopover
                                            ? 'opacity-100 pointer-events-auto scale-100'
                                            : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto scale-95 group-hover:scale-100'
                                        }`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* Quick Emoji Reactions */}
                                        {['❤️', '👍', '😂', '🔥', '👏', '🙏'].map((emoji) => (
                                          <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => handleReactToMessage(msg, emoji)}
                                            className="text-xs sm:text-sm hover:scale-125 active:scale-95 transition-transform p-0.5 cursor-pointer"
                                            title={`React with ${emoji}`}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                        <div className="w-px h-3.5 bg-slate-300 mx-0.5" />
                                        {/* Quick Reply Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleStartReply(msg)}
                                          className="p-1 rounded-full text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                          title="Reply"
                                        >
                                          <Reply className="w-3.5 h-3.5" />
                                        </button>
                                        {/* Copy Text Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleCopyMessageText(rawMsgText)}
                                          className="p-1 rounded-full text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                          title="Copy text"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

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
                                          className={`mb-2 p-2 rounded-r-xl border-l-4 transition-all text-left cursor-pointer hover:opacity-90 active:scale-[0.98] ${
                                            isMine
                                              ? 'bg-blue-700/50 border-white text-blue-100 shadow-inner'
                                              : 'bg-slate-100 border-blue-500 text-slate-700 hover:bg-slate-200/80'
                                          }`}
                                          title="Click to jump to original message"
                                        >
                                          <div className="flex items-center space-x-1 font-bold text-[10px] mb-0.5">
                                            <Reply className="w-2.5 h-2.5 shrink-0" />
                                            <span>{msg.reply_to_sender || chatReply?.replyToSender || 'Customer'}</span>
                                          </div>
                                          <p className="truncate text-[11px] opacity-95">{msg.reply_to_text || chatReply?.replyToText || 'Original message'}</p>
                                        </div>
                                      )}

                                      {isStatusReply ? (
                                        <StoryReplyBubble statusData={statusData} isMine={isMine} />
                                      ) : chatReply ? (
                                        <p className="whitespace-pre-wrap break-words">{chatReply.text}</p>
                                      ) : (msg.message_type === 'image' || msg.message_type === 'images' || msg.message_type === 'video' || (msg.media_url && !msg.message_type)) ? (
                                        <div className="space-y-1.5">
                                          <ChatMediaGallery
                                            mediaUrl={msg.media_url}
                                            messageType={msg.message_type}
                                            onImageClick={(url) => window.open(getMediaUrl(url), '_blank')}
                                          />
                                          {msg.content && !['Photo', 'Video', 'image', 'images'].includes(msg.content) && (
                                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                          )}
                                        </div>
                                      ) : msg.message_type === 'audio' ? (
                                        <div className="flex items-center space-x-2 py-1" onClick={(e) => e.stopPropagation()}>
                                          <span className="text-xs">🎤 Voice Note</span>
                                          <audio src={msg.media_url} controls className="h-8 max-w-[200px]" />
                                        </div>
                                      ) : (
                                        <p className="whitespace-pre-wrap break-words">{rawMsgText}</p>
                                      )}

                                      {/* Inline Timestamp & Delivery Tick */}
                                      <span className={`float-right mt-1 ml-2 inline-flex items-center space-x-1 text-[10px] leading-none select-none font-medium ${
                                        isMine ? 'text-blue-200' : 'text-slate-400'
                                      }`}>
                                        <span>{safeTime(msg.created_at, 'Now')}</span>
                                        {isMine && (
                                          <span className="inline-flex items-center">
                                            {msg.is_optimistic ? (
                                              <Clock className="w-2.5 h-2.5 opacity-70 animate-pulse" />
                                            ) : msg.is_read ? (
                                              <CheckCheck className="w-3 h-3 text-blue-200" />
                                            ) : (
                                              <Check className="w-2.5 h-2.5 opacity-80" />
                                            )}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </SwipeableMessageBubble>
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-12 text-center text-xs text-slate-400">
                              Say hello to {selectedPartner.partner_name}! Ask what product they want or offer quick pickup.
                            </div>
                          )}
                          <div ref={chatBottomRef} />
                        </div>

                        {/* Vendor Quick-Action Chips */}
                        <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center space-x-2 text-[11px] overflow-x-auto">
                          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Quick:</span>
                          <button
                            onClick={() => handleSendChatMessage(`📍 You can pick up or inspect at our stall: ${vendorStore?.location || 'SUB Food Court'}.`)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg shrink-0 cursor-pointer text-xs"
                          >
                            📍 Stall Pickup
                          </button>
                          <button
                            onClick={() => handleSendChatMessage(`💳 Bank details for transfer: ${bankInfo.bank_name} - ${bankInfo.account_number} (${bankInfo.account_name})`)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg shrink-0 cursor-pointer text-xs"
                          >
                            💳 Send Bank Info
                          </button>
                          <button
                            onClick={() => handleSendChatMessage(`✅ Your order is confirmed and currently being prepared for hostel dispatch!`)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg shrink-0 cursor-pointer text-xs"
                          >
                            📦 Order Confirmed
                          </button>
                        </div>

                        {/* Message Input Form */}
                        <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200">
                          {/* Quoted Swipe-to-Reply Banner */}
                          {replyingToMessage && (
                            <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-2xl mb-2 text-xs shadow-2xs">
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="w-1 h-7 rounded-full bg-blue-500 shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-1 text-blue-700 font-bold text-[11px]">
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

                          {/* Multi-Image Selected Thumbnail Carousel */}
                          {pendingMediaFiles.length > 0 && (
                            <div className="mb-2.5 p-2 bg-slate-100/90 rounded-2xl border border-slate-200">
                              <div className="flex items-center justify-between mb-1.5 px-1">
                                <span className="text-[11px] font-bold text-slate-700">
                                  {pendingMediaFiles.length} photo{pendingMediaFiles.length > 1 ? 's' : ''} selected
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    pendingMediaFiles.forEach(f => {
                                      if (f.previewUrl) {
                                        try { URL.revokeObjectURL(f.previewUrl); } catch {}
                                      }
                                    });
                                    setPendingMediaFiles([]);
                                  }}
                                  className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                                >
                                  Clear all
                                </button>
                              </div>
                              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
                                {pendingMediaFiles.map((item, idx) => (
                                  <div key={item.id} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-300 shadow-2xs group">
                                    {item.type === 'video' ? (
                                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white">
                                        <Film className="w-5 h-5 opacity-80" />
                                      </div>
                                    ) : (
                                      <img
                                        src={item.previewUrl}
                                        alt={`Preview ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePendingMedia(item.id)}
                                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                                      title="Remove"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                    <span className="absolute bottom-0.5 left-0.5 px-1 bg-black/60 text-white rounded text-[9px] font-bold">
                                      #{idx + 1}
                                    </span>
                                  </div>
                                ))}
                                {pendingMediaFiles.length < 10 && (
                                  <button
                                    type="button"
                                    onClick={() => chatMediaInputRef.current?.click()}
                                    className="w-16 h-16 shrink-0 rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-500 bg-white/80 hover:bg-sky-50 flex flex-col items-center justify-center text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                                    title="Add more photos"
                                  >
                                    <Plus className="w-5 h-5" />
                                    <span className="text-[9px] font-bold mt-0.5">Add</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendChatMessage();
                            }}
                            className="flex items-end space-x-2"
                          >
                            <input
                              ref={chatMediaInputRef}
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              onChange={handleChatMediaSelect}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => chatMediaInputRef.current?.click()}
                              className="w-11 h-11 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-xl cursor-pointer transition-all shrink-0 flex items-center justify-center mb-0.5"
                              title="Attach photos or video"
                            >
                              <Camera className="w-5 h-5" />
                            </button>
                            <textarea
                              rows={1}
                              placeholder={replyingToMessage ? `Replying to ${replyingToMessage.sender_name}...` : `Message ${selectedPartner.partner_name}...`}
                              value={newMsgText}
                              onChange={(e) => {
                                setNewMsgText(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                              }}
                              onKeyDown={(e) => {
                                const isMobileDevice = typeof navigator !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768));
                                if (e.key === 'Enter') {
                                  if (isMobileDevice) return;
                                  if (e.shiftKey || e.altKey) return;
                                  e.preventDefault();
                                  if (newMsgText.trim() || pendingMediaFiles.length > 0) {
                                    handleSendChatMessage();
                                  }
                                }
                              }}
                              className="flex-1 min-h-[44px] max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none leading-relaxed transition-colors"
                            />
                            <button
                              type="submit"
                              disabled={!newMsgText.trim() && pendingMediaFiles.length === 0}
                              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl cursor-pointer disabled:opacity-40 transition-all shrink-0 flex items-center justify-center shadow-xs mb-0.5"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          </form>
                        </div>
                      </>
                    )
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
                      <h4 className="text-sm font-bold text-slate-700">Select a student inquiry to chat</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Provide quick answers, hostel delivery ETAs or share stall pickup locations.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- SUBTAB B: FIND STUDENTS & VENDORS --- */}
            {messageSubtab === 'friends' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Campus Community Directory</h3>
                    <p className="text-xs text-slate-500">Connect with fellow student customers, campus creatives & verified merchants.</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCommunityRoleFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        communityRoleFilter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCommunityRoleFilter('student')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        communityRoleFilter === 'student' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Students
                    </button>
                    <button
                      onClick={() => setCommunityRoleFilter('vendor')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        communityRoleFilter === 'vendor' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Vendors
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search by name, department, hostel or business name..."
                    value={communitySearch}
                    onChange={(e) => setCommunitySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Directory Grid */}
                {filteredCommunity.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
                    {filteredCommunity.map((commUser) => {
                      const uid = commUser.user_id || commUser.id;
                      const isFriend = commUser.friendship_status === 'friends';
                      const isSent = commUser.friendship_status === 'request_sent';
                      const isReceived = commUser.friendship_status === 'request_received';

                      return (
                        <div key={uid} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between space-x-3">
                          <div
                            onClick={() => handleOpenProfile(uid)}
                            className="flex items-center space-x-3 overflow-hidden cursor-pointer group flex-1"
                            title="Click to view profile"
                          >
                            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-sm overflow-hidden group-hover:ring-2 group-hover:ring-sky-500 transition-all">
                              {commUser.profile_picture_url ? (
                                <SafeImage src={commUser.profile_picture_url} alt="Pic" fallbackType="avatar" className="w-full h-full object-cover" />
                              ) : (
                                commUser.full_name?.charAt(0) || 'C'
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                                {commUser.full_name}
                              </h4>
                              <p className="text-[10px] text-slate-500 truncate">
                                {commUser.role === 'vendor' ? (commUser.business_name || 'Campus Merchant') : (commUser.department || 'Student')}
                              </p>
                              <span className="text-[9px] text-slate-400 block truncate">
                                {commUser.hostel || 'Campus Resident'}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenProfile(uid)}
                              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-white rounded-xl cursor-pointer"
                              title="View Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {isFriend ? (
                              <button
                                onClick={() => {
                                  setSelectedPartner({ partner_id: uid, partner_name: commUser.full_name, role: commUser.role });
                                  setMessageSubtab('chats');
                                  handleSelectPartner({ partner_id: uid, partner_name: commUser.full_name, role: commUser.role });
                                }}
                                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl cursor-pointer flex items-center space-x-1"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Chat</span>
                                {getUnreadCountForUser(uid) > 0 && (
                                  <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black shadow-xs animate-pulse">
                                    {getUnreadCountForUser(uid)}
                                  </span>
                                )}
                              </button>
                            ) : isSent ? (
                              <span className="px-2.5 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-xl">
                                Sent
                              </span>
                            ) : isReceived ? (
                              <button
                                onClick={() => handleAcceptFriendRequest(commUser.request_id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl cursor-pointer"
                              >
                                Accept
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendFriendRequest(uid)}
                                className="px-3 py-1.5 bg-white hover:bg-sky-50 border border-slate-200 text-sky-700 text-[11px] font-bold rounded-xl cursor-pointer flex items-center space-x-1"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No community members found matching "{communitySearch}".
                  </div>
                )}
              </div>
            )}

            {/* --- SUBTAB C: INCOMING FRIEND REQUESTS --- */}
            {messageSubtab === 'requests' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-base text-slate-900">Incoming Friend Requests</h3>
                  <p className="text-xs text-slate-500">Students and vendors who want to connect with your store network.</p>
                </div>

                {pendingRequests.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between space-x-3">
                        <div
                          onClick={() => handleOpenProfile(req.sender_id || req.user_id)}
                          className="flex items-center space-x-3 overflow-hidden cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0">
                            {req.sender_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{req.sender_name}</h4>
                            <p className="text-[10px] text-slate-500">{req.sender_department || 'Campus Student'}</p>
                            <span className="text-[9px] text-slate-400">{req.sender_hostel || 'Hostel Resident'}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => handleAcceptFriendRequest(req.id)}
                            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineFriendRequest(req.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                            title="Decline"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <UserCheck className="w-8 h-8 mx-auto text-slate-300" />
                    <p>No pending friend requests right now.</p>
                  </div>
                )}
              </div>
            )}

            {/* --- SUBTAB D: MY FRIENDS NETWORK --- */}
            {messageSubtab === 'my_friends' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">My Campus Network</h3>
                    <p className="text-xs text-slate-500">Connected friends, returning student buyers and campus partners.</p>
                  </div>
                  <span className="text-xs font-bold bg-sky-50 text-sky-700 px-3 py-1 rounded-full">
                    {friendsList.length} Connected
                  </span>
                </div>

                {friendsList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {friendsList.map((f) => {
                      const fid = f.user_id || f.id;
                      return (
                        <div key={fid} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between space-x-3">
                          <div
                            onClick={() => handleOpenProfile(fid)}
                            className="flex items-center space-x-3 overflow-hidden cursor-pointer group flex-1"
                          >
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 overflow-hidden">
                              {f.profile_picture_url ? (
                                <SafeImage src={f.profile_picture_url} alt="Pic" fallbackType="avatar" className="w-full h-full object-cover" />
                              ) : (
                                f.full_name?.charAt(0) || 'F'
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">{f.full_name}</h4>
                              <p className="text-[10px] text-slate-500 truncate">{f.department || (f.role === 'vendor' ? 'Vendor' : 'Student')}</p>
                              <span className="text-[9px] text-emerald-600 font-bold flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Connected</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedPartner({ partner_id: fid, partner_name: f.full_name, role: f.role });
                                setMessageSubtab('chats');
                                handleSelectPartner({ partner_id: fid, partner_name: f.full_name, role: f.role });
                              }}
                              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl cursor-pointer flex items-center space-x-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Chat</span>
                              {getUnreadCountForUser(fid) > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black shadow-xs animate-pulse">
                                  {getUnreadCountForUser(fid)}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => handleRemoveFriend(fid)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer"
                              title="Unfriend"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-300" />
                    <p>You have not added any campus friends yet.</p>
                    <button
                      onClick={() => setMessageSubtab('friends')}
                      className="text-sky-600 font-bold hover:underline cursor-pointer"
                    >
                      Find students and vendors now
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 5: CAMPUS REELS & PROMO DROPS --- */}
        {/* ========================================================================= */}
        {activeTab === 'reels' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Campus Reels & Drops
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Discover trending student clips, food drops, sneakers unboxing & share promotional drops.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="bg-white p-1 rounded-2xl border border-slate-200 flex items-center space-x-1 text-xs font-bold">
                  <button
                    onClick={() => setReelFeedFilter('all')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      reelFeedFilter === 'all' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Campus ({allReels.length})
                  </button>
                  <button
                    onClick={() => setReelFeedFilter('my_drops')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      reelFeedFilter === 'my_drops' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    My Store Drops
                  </button>
                </div>

                <button
                  onClick={() => setShowReelModal(true)}
                  className="px-4 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post Promo Drop</span>
                </button>
              </div>
            </div>

            {/* Reels Feed Stream */}
            {filteredReels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReels.map((reel) => {
                  const isVideo = reel.media_type === 'video' || (reel.media_url && reel.media_url.match(/\.(mp4|webm|mov|ogg)$/i));
                  const isMine = (reel.author_id === user?.user_id || reel.user_id === user?.user_id || reel.author_id === user?.id);

                  return (
                    <div key={reel.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between">
                      {/* Author Bar */}
                      <div className="p-3.5 flex items-center justify-between border-b border-slate-100">
                        <div
                          onClick={() => handleOpenProfile(reel.author_id || reel.user_id)}
                          className="flex items-center space-x-2.5 overflow-hidden cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {reel.author_name?.charAt(0) || 'C'}
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-sky-600 transition-colors">{reel.author_name || 'Campus Creator'}</span>
                            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                              {(reel.author_university_abbr || reel.author_university) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                                  📍 {reel.author_university_abbr || reel.author_university}
                                </span>
                              )}
                              <span className="truncate">{reel.location || 'Campus Quad'}</span>
                            </div>
                          </div>
                        </div>

                        {isMine && (
                          <span className="text-[9px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                            My Drop
                          </span>
                        )}
                      </div>

                      {/* Media Display */}
                      <div className="w-full h-64 bg-slate-900 flex items-center justify-center relative overflow-hidden">
                        {isVideo ? (
                          <video
                            src={reel.media_url}
                            controls
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <SafeImage
                            src={reel.media_url}
                            alt={reel.title}
                            fallbackType="product"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      {/* Content & Action Bar */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{reel.title}</h4>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                            {reel.description}
                          </p>
                        </div>

                        {/* Interactive Like & Comments Count */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleLikeReel(reel.id)}
                              className={`flex items-center space-x-1 text-xs font-bold transition-colors cursor-pointer ${
                                reel.has_liked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${reel.has_liked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                              <span>{reel.likes_count || 0}</span>
                            </button>

                            <button
                              onClick={() => setActiveCommentsReelId(activeCommentsReelId === reel.id ? null : reel.id)}
                              className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-4 h-4 text-slate-400" />
                              <span>{reel.comments_count || (reel.comments ? reel.comments.length : 0)}</span>
                            </button>
                          </div>

                          <span className="text-[10px] text-slate-400">
                            {safeDate(reel.created_at, 'Recent')}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Comments Drawer */}
                      {activeCommentsReelId === reel.id && (
                        <div className="p-3.5 bg-slate-50 border-t border-slate-100 space-y-2.5">
                          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                            {reel.comments && reel.comments.length > 0 ? (
                              reel.comments.map((comment, idx) => (
                                <div key={comment.id || idx} className="p-2.5 bg-white rounded-xl border border-slate-100 text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center space-x-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 text-[11px]">{comment.author_name}</span>
                                      {comment.reply_to_author && (
                                        <span className="text-[9px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded-md flex items-center space-x-1">
                                          <Reply className="w-2.5 h-2.5" />
                                          <span>@{comment.reply_to_author}</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[9px] text-slate-400">
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
                                        className="text-slate-400 hover:text-sky-600 transition-colors cursor-pointer flex items-center space-x-0.5 text-[10px] font-semibold"
                                        title="Reply to comment"
                                      >
                                        <Reply className="w-3 h-3" />
                                        <span>Reply</span>
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-slate-700 leading-snug pl-0.5">{comment.content}</p>
                                </div>
                              ))
                            ) : (
                              <div className="py-2 text-center text-[11px] text-slate-400">
                                No comments on this drop yet.
                              </div>
                            )}
                          </div>

                          {/* Replying Banner */}
                          {replyingToComment && replyingToComment.reelId === reel.id && (
                            <div className="flex items-center justify-between px-2.5 py-1 bg-sky-50 border border-sky-200/80 rounded-lg text-xs text-sky-800">
                              <div className="flex items-center space-x-1 overflow-hidden">
                                <Reply className="w-3 h-3 text-sky-600 shrink-0" />
                                <span className="truncate text-[11px]">
                                  Replying to <strong className="font-bold text-sky-900">@{replyingToComment.authorName}</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setReplyingToComment(null)}
                                className="p-0.5 text-sky-500 hover:text-sky-800 cursor-pointer"
                                title="Cancel reply"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handlePostReelComment(reel.id);
                            }}
                            className="flex items-center space-x-2 pt-2 border-t border-slate-200/80"
                          >
                            <input
                              ref={commentInputRef}
                              type="text"
                              placeholder={replyingToComment && replyingToComment.reelId === reel.id ? `Reply to @${replyingToComment.authorName}...` : "Write a comment..."}
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              type="submit"
                              disabled={!newCommentText.trim() || isPostingComment}
                              className="p-2 px-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl cursor-pointer disabled:opacity-50 flex items-center space-x-1 text-xs font-bold"
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
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-10">
                <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No campus reels to show</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Be the first to post a new promo drop, unboxing clip, or hostel flash sale video!
                </p>
                <button
                  onClick={() => setShowReelModal(true)}
                  className="mt-4 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-full shadow-md cursor-pointer"
                >
                  Post Your First Promo Drop
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* --- TAB 6: SALES & BUSINESS ANALYTICS HUB --- */}
        {/* ========================================================================= */}
        {activeTab === 'hub' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-sky-600 mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Executive Merchant Performance</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Sales & Business Analytics Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Real-time commercial metrics, customer order queue, campus dispatch reach & direct bank settlement.
              </p>
            </div>

            {/* Metric Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 block uppercase">Gross Revenue</span>
                <span className="text-lg sm:text-xl font-black text-sky-700 mt-1 block">
                  ₦{totalRevenue.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Fulfillment Total</span>
              </div>

              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 block uppercase">Customer Orders</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
                  {vendorOrders.length}
                </span>
                <span className="text-[10px] text-amber-600 font-bold mt-1 block">{pendingOrdersCount} Action Required</span>
              </div>

              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 block uppercase">Active Catalog</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
                  {products.length + services.length}
                </span>
                <span className="text-[10px] text-slate-400 font-bold mt-1 block">{products.length} Goods • {services.length} Services</span>
              </div>

              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 block uppercase">Student Reach</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
                  {friendsList.length}
                </span>
                <span className="text-[10px] text-sky-600 font-bold mt-1 block">Connected Buyers</span>
              </div>
            </div>

            {/* 1. Campus Dispatch Reach & Logistics Center */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-sky-600" />
                    <span>Campus Dispatch & Logistics Reach</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your store is visible to students for hostel pickup, faculty block runs & cross-campus dispatch.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  <span>{vendorStore?.university_abbr || 'Campus'} Logistics</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Primary Dispatch Campus</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                    {vendorStore?.university_name || 'Main Campus'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Priority Local Listing</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Stall Spot / Pickup Desk</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                    {vendorStore?.location || 'SUB Food Court'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">Walk-in & Runner Handover</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Store Dispatch Hotline</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block truncate flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>{vendorStore?.phone || user?.phone_number || '+234 801 234 5678'}</span>
                  </span>
                  <span className="text-[10px] text-sky-600 font-semibold mt-1 block">WhatsApp Orders Enabled</span>
                </div>
              </div>
            </div>

            {/* 2. Direct Bank Settlement Virtual Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Direct Bank Transfer Settlement</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct account details shown to student buyers for instant bank transfer checkout.
                  </p>
                </div>
                {!isEditingBank && (
                  <button
                    onClick={() => { setBankForm({ ...bankInfo }); setIsEditingBank(true); }}
                    className="text-xs font-bold text-sky-600 hover:underline cursor-pointer"
                  >
                    Edit Details
                  </button>
                )}
              </div>

              {isEditingBank ? (
                <form onSubmit={handleSaveBankInfo} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Bank Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. OPay / Palmpay / GTBank"
                      value={bankForm.bank_name}
                      onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Account Number</label>
                    <input
                      type="text"
                      required
                      placeholder="8012345678"
                      value={bankForm.account_number}
                      onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Account Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Store Owner Name"
                      value={bankForm.account_name}
                      onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-center space-x-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      Save Bank Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBank(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-700">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                        {bankInfo.bank_name || 'BANK'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">CAMPUS LINK SETTLEMENT</span>
                    </div>
                    <h4 className="text-xl sm:text-2xl font-black font-mono tracking-widest text-white">
                      {bankInfo.account_number}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 font-medium">{bankInfo.account_name}</p>
                  </div>

                  <button
                    onClick={handleCopyBankDetails}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center space-x-2 transition-all shadow-sm self-start sm:self-center"
                  >
                    {copiedBank ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedBank ? 'Account Copied!' : 'Copy Account'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Broadcast Announcement Banner */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Campus Broadcast & Flash Announcement Banner</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Announce flash sales, menu drops, or discounts at the top of your store page.
                </p>
              </div>

              {isEditingBroadcast ? (
                <form onSubmit={handleSaveBroadcast} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50% discount on all sneakers before 6 PM today!"
                    value={broadcastInput}
                    onChange={(e) => setBroadcastInput(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      Save Announcement
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBroadcast(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-800">{storeBroadcast}</p>
                  <button
                    onClick={() => { setBroadcastInput(storeBroadcast); setIsEditingBroadcast(true); }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-sky-600 font-bold text-xs rounded-xl hover:bg-sky-50 cursor-pointer shrink-0 ml-3"
                  >
                    Edit Banner
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 7: VENDOR PROFILE & SETTINGS (JUST LIKE STUDENT DASHBOARD) --- */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Vendor Profile & Settings</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Manage your store profile, contact numbers, campus stall location, and account credentials.
              </p>
            </div>

            {/* Profile Photo & Store Summary Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 pb-6 border-b border-slate-100">
                <div className="relative self-start group">
                  {user?.profile_picture_url || vendorStore?.logo ? (
                    <SafeImage
                      src={user?.profile_picture_url || vendorStore?.logo}
                      alt={vendorStore?.business_name}
                      fallbackType="avatar"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-sky-500 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black text-3xl flex items-center justify-center shadow-md">
                      {vendorStore?.business_name?.charAt(0) || user?.full_name?.charAt(0) || 'V'}
                    </div>
                  )}

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
                    title="Change Logo / Picture"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold text-slate-900">{vendorStore?.business_name || user?.full_name}</h3>
                    {isVerified ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Verified Merchant</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Pending Verification</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{user?.email} • {vendorStore?.phone || user?.phone_number || 'No phone set'}</p>
                  <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                    "{vendorStore?.business_description || 'Official campus store offering meals, goods or services to students.'}"
                  </p>
                </div>
              </div>

              {/* Vendor Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Institution</span>
                  <p className="font-bold text-slate-800 mt-1 truncate">{vendorStore?.university_name || 'Campus'}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Stall / Location</span>
                  <p className="font-bold text-slate-800 mt-1 truncate">{vendorStore?.location || 'SUB Food Court'}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
                  <p className="font-bold text-slate-800 mt-1 truncate">{vendorStore?.category_name || 'General'}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Merchant Standing</span>
                  <p className="font-bold text-emerald-600 mt-1 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isVerified ? 'Verified Active' : 'Verification In Review'}</span>
                  </p>
                </div>
              </div>

              {/* Quick Network Navigation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => { setActiveTab('messages'); setMessageSubtab('my_friends'); }}
                  className="p-3.5 rounded-2xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-100 text-left transition-colors cursor-pointer"
                >
                  <span className="text-[10px] uppercase font-bold text-sky-600 block">Connected Friends</span>
                  <p className="font-black text-sky-900 text-sm mt-0.5">{friendsList.length} Connected</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('messages'); setMessageSubtab('requests'); }}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Friend Requests</span>
                  <p className="font-black text-slate-800 text-sm mt-0.5">{pendingRequests.length} Incoming</p>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-100 text-left transition-colors cursor-pointer"
                >
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Fulfilled Orders</span>
                  <p className="font-black text-emerald-900 text-sm mt-0.5">{vendorOrders.length} Orders</p>
                </button>
              </div>
            </div>

            {/* Edit Profile Form */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Store & Personal Information</h3>
              </div>
              <p className="text-xs text-slate-500">Keep your store name, stall address and WhatsApp contact up-to-date for campus buyers.</p>

              <form onSubmit={handleUpdateVendorProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Your Full Name (Owner)</label>
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Business / Store Name</label>
                    <input
                      type="text"
                      required
                      value={profileForm.business_name}
                      onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone / WhatsApp Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="+234 801 234 5678"
                      value={profileForm.phone_number}
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Stall / Pickup Spot</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SUB Food Court Stall 4"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Business Category</label>
                  <select
                    value={profileForm.category_id}
                    onChange={(e) => setProfileForm({ ...profileForm, category_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value={1}>Food & Meals (Cafeteria / Restaurant)</option>
                    <option value={2}>Fashion, Shoes & Wears</option>
                    <option value={3}>Laptops, Phones & Accessories</option>
                    <option value={4}>Academic Materials & Books</option>
                    <option value={5}>Laundry, Styling & Campus Services</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store Description / Bio</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what your store specializes in, opening hours, or special hostel delivery terms..."
                    value={profileForm.business_description}
                    onChange={(e) => setProfileForm({ ...profileForm, business_description: e.target.value })}
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
              <p className="text-xs text-slate-500">Ensure your vendor account is protected with a strong password (minimum 6 characters).</p>

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
                      placeholder="Repeat new password"
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
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {changingPassword ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* --- TAB 8: ID & BUSINESS VERIFICATION (FLEXIBLE FOR GRADUATES/RESTAURANTS) --- */}
        {/* ========================================================================= */}
        {activeTab === 'verification' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ID & Business Verification
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Verified stores earn a Trust Badge and gain full privileges to list products & services across campus.
              </p>
            </div>

            {isVerified && !showUpdateDocs ? (
              /* Prestigious Verified Merchant Certificate & Seal Card */
              <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 pb-6 border-b border-slate-100">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-2xl shrink-0 shadow-sm border border-emerald-200">
                    <ShieldCheck className="w-9 h-9 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-black text-slate-900">{vendorStore?.business_name || 'Vendor Store'}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>VERIFIED MERCHANT</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      This merchant profile and official business documentation have been verified and approved by Campus Administration.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Verified Campus</span>
                    <p className="font-bold text-slate-900 mt-1 flex items-center space-x-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="truncate">{vendorStore?.university_name || 'Campus University'}</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Document On File</span>
                    <p className="font-bold text-slate-900 mt-1 capitalize truncate">
                      {verificationForm.id_card_type ? verificationForm.id_card_type.replace(/_/g, ' ') : 'National ID / Permit'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Merchant Status</span>
                    <p className="font-black text-emerald-600 mt-1 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Active & Approved</span>
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5 text-xs text-emerald-950">
                  <span className="font-bold block flex items-center space-x-1.5 text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Verified Merchant Privileges</span>
                  </span>
                  <ul className="space-y-1.5 text-[11px] text-emerald-800 list-disc list-inside">
                    <li>Direct marketplace product & meal pack listing across campus faculties</li>
                    <li>Instant customer orders & delivery notifications from students</li>
                    <li>Promotional drops on Campus Reels & Stories</li>
                    <li>Official Trust Badge displayed on all catalog items and customer chat threads</li>
                  </ul>
                </div>

                <div className="pt-2 text-center sm:text-left">
                  <button
                    type="button"
                    onClick={() => setShowUpdateDocs(true)}
                    className="text-xs text-slate-500 hover:text-sky-600 underline font-semibold cursor-pointer"
                  >
                    Need to update business registration documents? Click here
                  </button>
                </div>
              </div>
            ) : (
              /* Verification Form (For unverified vendors, or if explicitly updating docs) */
              <div className="space-y-6">
                {/* Graduate / Restaurant Explanatory Notice */}
                <div className="p-4 sm:p-5 rounded-3xl bg-sky-50 border border-sky-200 flex items-start space-x-3 text-xs text-sky-900">
                  <Building2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block">For School Restaurants, Graduate Alumni & External Vendors:</span>
                    <p className="text-[11px] text-sky-800 leading-relaxed">
                      You do <strong>not</strong> need a student matric number! Cafeteria managers, graduate food entrepreneurs, and external campus shops can upload their <strong>National ID (NIN)</strong>, <strong>Voter's Card</strong>, <strong>Driver's License</strong>, <strong>Graduate/NYSC Certificate</strong>, or <strong>Campus Commercial Lease / CAC Registration</strong>.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-xs">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                        isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{vendorStore?.business_name}</h3>
                        <span className={`text-xs font-bold ${isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                          Status: {vendorStore?.verification_status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {isVerified && showUpdateDocs && (
                      <button
                        type="button"
                        onClick={() => setShowUpdateDocs(false)}
                        className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleVerificationSubmit} className="space-y-4 text-xs">
                    
                    {/* 1. Document Type Selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Select Identification / Business Document Type
                      </label>
                      <select
                        value={verificationForm.id_card_type}
                        onChange={(e) => setVerificationForm({ ...verificationForm, id_card_type: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                      >
                        <option value="national_id">🇳🇬 National Identity Number (NIN / NIMC Slip)</option>
                        <option value="voter_card">🪪 Permanent Voter's Card (INEC)</option>
                        <option value="driver_license">🚗 Driver's License (FRSC)</option>
                        <option value="graduate_cert">📜 Graduate Degree / NYSC Discharge Certificate (Alumni Vendor)</option>
                        <option value="cac_permit">🏢 CAC Business Certificate / Campus Cafeteria Lease Agreement / Stall Permit</option>
                        <option value="student_id">🎓 Student ID Card (Undergraduate Merchant)</option>
                      </select>
                    </div>

                    {/* 2. Document Identification Number (Optional) */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Document Number (NIN, CAC RC, Lease No., or License No.)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 12345678901 (NIN) or RC-987654 (CAC)"
                        value={verificationForm.id_card_number}
                        onChange={(e) => setVerificationForm({ ...verificationForm, id_card_number: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    {/* 3. Front Photo / Document Page 1 File Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Front of ID / Document Page 1 (Upload Photo or PDF scan)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setIdFrontFile(file);
                            setIdFrontPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                      />
                      {idFrontPreview && (
                        <div className="mt-2 h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                          <SafeImage src={idFrontPreview} alt="Front ID Preview" fallbackType="product" className="max-h-44 w-full object-contain" />
                        </div>
                      )}
                    </div>

                    {/* 4. Back Photo / Document Page 2 File Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Back of ID / Document Page 2 (Upload Photo or PDF scan)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setIdBackFile(file);
                            setIdBackPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                      />
                      {idBackPreview && (
                        <div className="mt-2 h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                          <SafeImage src={idBackPreview} alt="Back ID Preview" fallbackType="product" className="max-h-44 w-full object-contain" />
                        </div>
                      )}
                    </div>

                    {/* 5. Stall Location & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Campus Stall / Cafeteria Spot</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SUB Cafeteria Wing B"
                          value={verificationForm.location}
                          onChange={(e) => setVerificationForm({ ...verificationForm, location: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store Phone Contact</label>
                        <input
                          type="tel"
                          required
                          placeholder="+234 801 234 5678"
                          value={verificationForm.phone}
                          onChange={(e) => setVerificationForm({ ...verificationForm, phone: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Uploading Documents...' : 'Submit Documents for Admin Verification'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* --- NEW VENDOR WELCOME & STORE COMPLETION PROMPT MODAL --- */}
      <AnimatePresence>
        {showNewVendorModal && (
          <motion.div
            key="new-vendor-welcome-modal"
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
              {/* Header */}
              <div className="bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner border border-white/20">
                  🏪
                </div>
                <h3 className="text-xl font-black tracking-tight leading-tight">
                  Welcome to Vendor Hub!
                </h3>
                <p className="text-xs text-sky-100 mt-1 max-w-xs mx-auto">
                  Hi {user?.full_name ? user.full_name.split(' ')[0] : 'Merchant'}, your seller account is active. Complete your store settings to start receiving student orders!
                </p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  To start listing products, services, and getting verified on campus, please head to <strong>Settings</strong> to finish setting up:
                </p>

                <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">1</span>
                    <span className="font-semibold">Business Name & Description</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">2</span>
                    <span className="font-semibold">Campus Stall / Hostel Pickup Location</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">3</span>
                    <span className="font-semibold">Store Logo & WhatsApp Contact</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black shrink-0">4</span>
                    <span className="font-semibold">Student ID / KYC for Verified Badge</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewVendorModal(false);
                      localStorage.setItem('campuslink_dismissed_vendor_profile_prompt', 'true');
                      localStorage.removeItem('campuslink_show_profile_completion_prompt');
                      setActiveTab('settings');
                    }}
                    className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Go to Store Settings</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewVendorModal(false);
                      localStorage.setItem('campuslink_dismissed_vendor_profile_prompt', 'true');
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

      {/* ========================================================================= */}
      {/* --- FACEBOOK-STYLE MOBILE BOTTOM NAVIGATION BAR --- */}
      {/* ========================================================================= */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1.5 safe-nav-bottom shadow-lg ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'block'}`}>
        <div className="grid grid-cols-6 w-full max-w-lg mx-auto items-center">
          {/* Tab 1: Products */}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${
              activeTab === 'inventory' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Package className={`w-5 h-5 shrink-0 ${activeTab === 'inventory' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">Products</span>
            {activeTab === 'inventory' && (
              <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          {/* Tab 2: Services */}
          <button
            onClick={() => setActiveTab('services')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${
              activeTab === 'services' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Wrench className={`w-5 h-5 shrink-0 ${activeTab === 'services' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">Services</span>
            {activeTab === 'services' && (
              <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          {/* Tab 3: Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${
              activeTab === 'orders' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <ShoppingCart className={`w-5 h-5 shrink-0 ${activeTab === 'orders' ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-amber-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {pendingOrdersCount}
                </span>
              )}
            </div>
            <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">Orders</span>
            {activeTab === 'orders' && (
              <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          {/* Tab 4: Chats & Stories */}
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${
              activeTab === 'messages' && !selectedPartner?.is_ai ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <MessageSquare className={`w-5 h-5 shrink-0 ${activeTab === 'messages' && !selectedPartner?.is_ai ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {(totalUnreadChatCount > 0 || pendingRequests.length > 0) && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black min-w-[15px] h-3.5 px-1 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                  {totalUnreadChatCount > 0 ? totalUnreadChatCount : pendingRequests.length}
                </span>
              )}
            </div>
            <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">Chats</span>
            {activeTab === 'messages' && (
              <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          {/* Tab 5: Reels */}
          <button
            onClick={() => setActiveTab('reels')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${
              activeTab === 'reels' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Video className={`w-5 h-5 shrink-0 ${activeTab === 'reels' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">Reels</span>
            {activeTab === 'reels' && (
              <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          {/* Tab 6: Store Settings & Operations Hub */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${
              activeTab === 'settings' || activeTab === 'hub' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <Settings className={`w-5 h-5 shrink-0 ${activeTab === 'settings' || activeTab === 'hub' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            </div>
            <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">Settings</span>
            {(activeTab === 'settings' || activeTab === 'hub') && (
              <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* --- SELECTED USER PROFILE MODAL (FOR VIEWING STUDENTS OR VENDORS) --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {profileModalOpen && selectedProfile && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl relative border-t sm:border border-slate-200 text-center safe-drawer-bottom sm:pb-7"
            >
              {/* Mobile Drawer Drag Handle */}
              <div className="sm:hidden -mt-2 mb-2 flex justify-center">
                <div className="drawer-handle" />
              </div>

              <button
                onClick={() => setProfileModalOpen(false)}
                className="min-tap-target-sm absolute top-4 right-4 text-slate-400 hover:text-slate-800 cursor-pointer p-1.5"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Profile Avatar */}
              <div className="w-20 h-20 rounded-2xl mx-auto mb-3 overflow-hidden bg-sky-100 text-sky-700 font-black text-2xl flex items-center justify-center border-2 border-sky-400 shadow-md">
                {selectedProfile.profile_picture_url ? (
                  <SafeImage src={selectedProfile.profile_picture_url} alt={selectedProfile.full_name} fallbackType="avatar" className="w-full h-full object-cover" />
                ) : (
                  selectedProfile.full_name?.charAt(0) || 'U'
                )}
              </div>

              {/* Full Name & Role */}
              <div className="flex items-center justify-center space-x-2">
                <h3 className="text-lg font-black text-slate-900">{selectedProfile.full_name}</h3>
                {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-xs font-black shadow-xs animate-pulse">
                    {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id)} new
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center space-x-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  {selectedProfile.role === 'vendor' ? '🏪 Campus Merchant' : '🎓 Student'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedProfile.university_name || 'Campus University'}
                </span>
              </div>

              {/* Bio */}
              <p className="text-xs text-slate-600 mt-3 px-3 italic bg-slate-50 py-2.5 rounded-2xl border border-slate-100">
                "{selectedProfile.bio || (selectedProfile.role === 'vendor' ? 'Verified campus merchant offering quality items.' : 'Student on CampusLink connecting with peers and vendors.')}"
              </p>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs mt-4 text-left">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {selectedProfile.role === 'vendor' ? 'Stall Spot' : 'Department / Room'}
                  </span>
                  <span className="font-bold text-slate-800 truncate block mt-0.5">
                    {selectedProfile.hostel || selectedProfile.department || 'On Campus'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Connections</span>
                  <span className="font-bold text-sky-700 truncate block mt-0.5">
                    {selectedProfile.friends_count || 0} Friends
                  </span>
                </div>
              </div>

              {/* Phone / WhatsApp if available */}
              {selectedProfile.phone_number && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center justify-between">
                  <span className="font-bold flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedProfile.phone_number}</span>
                  </span>
                  <a
                    href={`https://wa.me/${selectedProfile.phone_number.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded-lg hover:bg-emerald-500 transition-colors cursor-pointer"
                  >
                    WhatsApp
                  </a>
                </div>
              )}

              {/* Friendship & Chat Action Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center space-x-2">
                {selectedProfile.friendship_status === 'none' && (
                  <button
                    onClick={() => handleSendFriendRequest(selectedProfile.user_id || selectedProfile.id)}
                    className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Send Friend Request</span>
                  </button>
                )}

                {selectedProfile.friendship_status === 'request_sent' && (
                  <button
                    onClick={() => handleRemoveFriend(selectedProfile.user_id || selectedProfile.id)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Request Sent (Cancel)
                  </button>
                )}

                {selectedProfile.friendship_status === 'request_received' && (
                  <button
                    onClick={() => handleAcceptFriendRequest(selectedProfile.request_id)}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Accept Friend Request
                  </button>
                )}

                {selectedProfile.friendship_status === 'friends' && (
                  <button
                    onClick={() => handleRemoveFriend(selectedProfile.user_id || selectedProfile.id)}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-xl cursor-pointer"
                    title="Remove Friend"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}

                {/* Instant Chat Button */}
                <button
                  onClick={() => {
                    const pid = selectedProfile.user_id || selectedProfile.id;
                    setSelectedPartner({ partner_id: pid, partner_name: selectedProfile.full_name, role: selectedProfile.role });
                    setProfileModalOpen(false);
                    setActiveTab('messages');
                    setMessageSubtab('chats');
                    handleSelectPartner({ partner_id: pid, partner_name: selectedProfile.full_name, role: selectedProfile.role });
                  }}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Now</span>
                  {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 0 && (
                    <span className="ml-1.5 px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black shadow-xs animate-pulse">
                      {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id)}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* --- WHATSAPP-STYLE STATUS STORY VIEWER MODAL --- */}
      {/* ========================================================================= */}
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

                    {/* Story Header */}
                    <div className="p-3.5 flex items-center justify-between text-white z-20 bg-gradient-to-b from-black/60 to-transparent">
                      <div
                        onClick={() => {
                          setActiveStatusViewer(null);
                          handleOpenProfile(group.user_id);
                        }}
                        className="flex items-center space-x-2.5 cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center overflow-hidden border border-white/40">
                          {group.user_avatar ? (
                            <SafeImage src={group.user_avatar} alt={group.user_name} fallbackType="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span>{group.user_name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs leading-tight">{group.user_name}</h4>
                          <span className="text-[10px] text-white/70 block">
                            {group.user_dept || 'Campus'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {(group.is_self || group.user_id === user?.user_id || group.user_id === user?.id) && (
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
                        className="absolute right-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
                        title="Next"
                      />

                      {/* WhatsApp-Style In-Card Visible Prev/Next Arrow Buttons */}
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
                                className="w-full h-full object-contain rounded-xl"
                              />
                            </div>
                          );
                        }

                        if (currentItem.media_type === 'image' || mediaUrl) {
                          return (
                            <div className="w-full h-full flex items-center justify-center p-2 relative">
                              <SafeImage
                                src={mediaUrl}
                                alt="Story"
                                fallbackType="product"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          );
                        }

                        return (
                          <div className={`w-full h-full bg-gradient-to-br ${currentItem.background_color || 'from-emerald-600 to-teal-800'} flex items-center justify-center p-8 text-center text-white text-base font-bold leading-relaxed`}>
                            {currentItem.caption}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Caption & Fast Reply Bar */}
                    <div className="p-3.5 z-20 bg-gradient-to-t from-black/80 to-transparent space-y-2">
                      {currentItem.caption && currentItem.media_url && (
                        <p className="text-xs text-white bg-black/40 p-2.5 rounded-xl backdrop-blur-xs text-center">
                          {currentItem.caption}
                        </p>
                      )}

                      {!group.is_self && (
                        <div className="space-y-2 pt-1">
                          {/* Quick Emoji Reactions */}
                          <div className="flex items-center justify-around px-2 py-1 bg-black/40 rounded-full backdrop-blur-xs">
                            {['❤️', '🔥', '👏', '😂', '😮', '🙌'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReplyToStatus(group.user_id, null, emoji)}
                                className="text-xl hover:scale-130 active:scale-90 transition-transform cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder={`Reply to ${group.user_name.split(' ')[0]}...`}
                              value={statusReplyText}
                              onChange={(e) => setStatusReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleReplyToStatus(group.user_id);
                                }
                              }}
                              className="flex-1 p-2.5 rounded-full bg-white/20 border border-white/30 text-white text-xs placeholder-white/60 focus:outline-none focus:bg-white/30"
                            />
                            <button
                              onClick={() => handleReplyToStatus(group.user_id)}
                              className="p-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-full cursor-pointer transition-colors shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* --- CREATE STATUS STORY MODAL --- */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* --- CREATE STATUS STORY MODAL --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {createStatusModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 my-0 sm:my-auto max-h-[90dvh] overflow-y-auto safe-drawer-bottom"
            >
              <div className="drawer-handle sm:hidden" />
              <button
                onClick={() => setCreateStatusModalOpen(false)}
                className="absolute top-4 right-4 min-tap-target-sm flex items-center justify-center text-slate-400 hover:text-slate-800 cursor-pointer rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-black text-slate-900 mb-1">Post 24h Campus Story Drop</h3>
              <p className="text-xs text-slate-500 mb-4">Share hot food arrivals, new item stock, or flash deals with campus friends.</p>

              <form onSubmit={handlePublishStatus} className="space-y-3.5 text-xs">
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl font-bold">
                  <button
                    type="button"
                    onClick={() => setStatusType('text')}
                    className={`py-2 min-tap-target-sm rounded-lg cursor-pointer transition-all ${statusType === 'text' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-600'}`}
                  >
                    Text Announcement
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusType('image')}
                    className={`py-2 min-tap-target-sm rounded-lg cursor-pointer transition-all ${statusType === 'image' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-600'}`}
                  >
                    Photo / Video
                  </button>
                </div>

                {statusType === 'image' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Upload Photo or Clip</label>
                    <input
                      type="file"
                      accept="image/*,video/*,video/mp4,video/quicktime,video/webm,video/x-m4v"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setStatusMediaFile(file);
                          setStatusMediaPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 cursor-pointer"
                    />
                    {statusMediaPreview && (
                      <div className="mt-2 h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
                        {((statusMediaFile?.type && statusMediaFile.type.startsWith('video')) || Boolean(statusMediaFile?.name && statusMediaFile.name.match(/\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i))) ? (
                          <video src={statusMediaPreview} className="h-36 w-full object-contain" playsInline autoPlay muted controls />
                        ) : (
                          <img src={statusMediaPreview} alt="Preview" className="h-36 w-full object-contain" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {statusType === 'text' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Story Background</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        'from-emerald-600 to-teal-800',
                        'from-sky-600 to-blue-800',
                        'from-purple-600 to-indigo-900',
                        'from-rose-600 to-amber-700'
                      ].map((bg) => (
                        <div
                          key={bg}
                          onClick={() => setStatusBgColor(bg)}
                          className={`h-8 rounded-xl bg-gradient-to-br ${bg} cursor-pointer border-2 ${statusBgColor === bg ? 'border-white ring-2 ring-sky-500' : 'border-transparent'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    {statusType === 'text' ? 'Status Content' : 'Caption (Optional)'}
                  </label>
                  <textarea
                    rows={3}
                    required={statusType === 'text'}
                    placeholder="e.g. Hot Jollof batch just came out at SUB Stall 4! Free plantain for the next 10 orders!"
                    value={statusCaption}
                    onChange={(e) => setStatusCaption(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Audience Privacy</label>
                  <select
                    value={statusPrivacy}
                    onChange={(e) => setStatusPrivacy(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="everyone">All Campus Members</option>
                    <option value="friends">Only My Connected Friends</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isPublishingStatus}
                  className="w-full min-tap-target py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50 active:scale-98"
                >
                  {isPublishingStatus ? 'Posting Story Drop...' : 'Share 24h Campus Story'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD / EDIT PRODUCT MODAL --- */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative border border-slate-200 my-0 sm:my-auto max-h-[90dvh] overflow-y-auto safe-drawer-bottom"
            >
              <div className="drawer-handle sm:hidden" />
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="absolute top-4 right-4 min-tap-target-sm flex items-center justify-center text-slate-400 hover:text-slate-800 cursor-pointer rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                {editingProduct ? 'Edit Product & Campus Dispatch' : 'List Product on Campus Marketplace'}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {editingProduct ? 'Update title, price, quantity, photo or dispatch campus.' : 'Visible to students across your institution.'}
              </p>

              <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nike Air Force 1 Triple White"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Campus Dispatch Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Dispatches From Campus / University
                  </label>
                  <select
                    value={productForm.university_id || ''}
                    onChange={(e) => setProductForm({ ...productForm, university_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                  >
                    {universities.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.abbreviation || u.state})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Students from this campus will see priority delivery & hostel dispatch.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Price (₦)</label>
                    <input
                      type="number"
                      required
                      placeholder="25000"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="1"
                      value={productForm.quantity}
                      onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
                    <select
                      value={productForm.category_id}
                      onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value={1}>Food & Meals</option>
                      <option value={2}>Fashion & Shoes</option>
                      <option value={3}>Laptops & Gadgets</option>
                      <option value={4}>Academic Services</option>
                      <option value={5}>Laundry & Cleaning</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    {editingProduct ? 'Change Product Photo (Optional)' : 'Upload Product Photo'}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setProdFile(file);
                        setProdPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 cursor-pointer"
                  />
                  {prodPreview && (
                    <div className="mt-2 h-36 rounded-xl overflow-hidden border border-slate-200">
                      <SafeImage src={prodPreview} alt="Preview" fallbackType="product" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Condition, size, flavors, pickup details..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-tap-target py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50 active:scale-98 transition-all"
                >
                  {isSubmitting
                    ? (editingProduct ? 'Saving Changes...' : 'Uploading & Publishing...')
                    : (editingProduct ? 'Save Product Changes' : 'Publish to Campus Marketplace')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD SERVICE MODAL --- */}
      <AnimatePresence>
        {showServiceModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative border border-slate-200 my-0 sm:my-auto max-h-[90dvh] overflow-y-auto safe-drawer-bottom"
            >
              <div className="drawer-handle sm:hidden" />
              <button
                onClick={() => setShowServiceModal(false)}
                className="absolute top-4 right-4 min-tap-target-sm flex items-center justify-center text-slate-400 hover:text-slate-800 cursor-pointer rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-slate-900 mb-1">List Student Service</h3>
              <p className="text-xs text-slate-500 mb-4">Laundry, photography, tutoring, tech repairs.</p>

              <form onSubmit={handleCreateService} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Service Title</label>
                  <input type="text" required placeholder="e.g. Express Hostel Laundry & Ironing" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Starting Price (₦)</label>
                    <input type="number" required placeholder="3000" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Location Tag</label>
                    <input type="text" placeholder="e.g. SUB / Jaja Hostel" value={serviceForm.location} onChange={(e) => setServiceForm({ ...serviceForm, location: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Upload Service Banner</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setSvcFile(file);
                        setSvcPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 cursor-pointer"
                  />
                  {svcPreview && (
                    <div className="mt-2 h-36 rounded-xl overflow-hidden border border-slate-200">
                      <SafeImage src={svcPreview} alt="Preview" fallbackType="product" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
                  <textarea rows={3} placeholder="Turnaround time, what is included, special perks..." value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full min-tap-target py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50 active:scale-98 transition-all">
                  {isSubmitting ? 'Uploading & Publishing...' : 'Publish Service'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD REEL MODAL --- */}
      <AnimatePresence>
        {showReelModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative border border-slate-200 my-0 sm:my-auto max-h-[90dvh] overflow-y-auto safe-drawer-bottom"
            >
              <div className="drawer-handle sm:hidden" />
              <button
                onClick={() => setShowReelModal(false)}
                className="absolute top-4 right-4 min-tap-target-sm flex items-center justify-center text-slate-400 hover:text-slate-800 cursor-pointer rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-slate-900 mb-1">Post Campus Promo Drop</h3>
              <p className="text-xs text-slate-500 mb-4">Share video drops, product unboxings or photo stories.</p>

              <form onSubmit={handleCreateReel} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Reel / Drop Title</label>
                  <input type="text" required placeholder="e.g. New Sneaker Drop at SUB Quad" value={reelForm.title} onChange={(e) => setReelForm({ ...reelForm, title: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Upload Video or Photo</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setReelMediaFile(file);
                        setReelMediaPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 cursor-pointer"
                  />
                  {reelMediaPreview && (
                    <div className="mt-2 h-40 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
                      {reelMediaFile?.type?.startsWith('video') ? (
                        <video src={getMediaUrl(reelMediaPreview)} controls className="h-40 w-full object-contain" />
                      ) : (
                        <SafeImage src={reelMediaPreview} alt="Preview" fallbackType="product" className="h-40 w-full object-contain" />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Campus Hotspot Tag</label>
                  <input type="text" placeholder="e.g. UNILAG SUB Quad" value={reelForm.location} onChange={(e) => setReelForm({ ...reelForm, location: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Caption</label>
                  <textarea rows={2} placeholder="Add details, size availability or discounts..." value={reelForm.description} onChange={(e) => setReelForm({ ...reelForm, description: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full min-tap-target py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50 active:scale-98 transition-all">
                  {isSubmitting ? 'Uploading & Posting...' : 'Post to Campus Reels Feed'}
                </button>
              </form>
            </motion.div>
          </div>
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

      {/* --- FACEBOOK/WHATSAPP-STYLE MOBILE BOTTOM NAVIGATION BAR FOR MERCHANTS --- */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-2 py-1.5 safe-nav-bottom shadow-lg ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'flex'} items-center justify-around w-full max-w-lg mx-auto`}>
        {/* Products */}
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'inventory'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Catalog"
        >
          <div className="relative flex items-center justify-center">
            <Package className={`w-5 h-5 transition-transform ${activeTab === 'inventory' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Catalog</span>
          {activeTab === 'inventory' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Orders */}
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'orders'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Orders"
        >
          <div className="relative flex items-center justify-center">
            <ShoppingCart className={`w-5 h-5 transition-transform ${activeTab === 'orders' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[8px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs ring-2 ring-white animate-bounce">
                {pendingOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Orders</span>
          {activeTab === 'orders' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Chats & Stories */}
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'messages'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Messages"
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className={`w-5 h-5 transition-transform ${activeTab === 'messages' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
            {(totalUnreadChatCount > 0 || (pendingRequests || []).length > 0) && (
              <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs ring-2 ring-white animate-bounce">
                {totalUnreadChatCount > 0 ? totalUnreadChatCount : (pendingRequests || []).length}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Chats</span>
          {activeTab === 'messages' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Sales Hub */}
        <button
          onClick={() => setActiveTab('hub')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'hub'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Sales Hub"
        >
          <div className="relative flex items-center justify-center">
            <Store className={`w-5 h-5 transition-transform ${activeTab === 'hub' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Hub</span>
          {activeTab === 'hub' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'settings'
              ? 'text-sky-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Settings"
        >
          <div className="relative flex items-center justify-center">
            <Settings className={`w-5 h-5 transition-transform ${activeTab === 'settings' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Settings</span>
          {activeTab === 'settings' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>
      </nav>

    </div>
  );
}