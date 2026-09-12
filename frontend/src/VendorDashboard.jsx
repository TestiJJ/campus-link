// src/VendorDashboard.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Plus, Trash2, MessageSquare, Phone,
  Mail, ShieldCheck, AlertCircle, LogOut, Send,
  Tag, Clock, MapPin, X, Upload, CheckCircle2,
  Home, Package, Wrench, Video, ShoppingCart, Star, Eye, Camera, Check,
  Heart, MessageCircle, UserPlus, Users, UserCheck, UserX, Search,
  Share2, DollarSign, Bell, Sparkles, AlertTriangle, ExternalLink,
  RefreshCw, Settings, Building2, ChevronRight, ChevronLeft, Copy, CheckCheck,
  Lock, Edit3, ShieldAlert, Bot, RotateCcw, Download, Smartphone, Reply,
  Film, Mic, Navigation, MoreVertical, EyeOff, Flag, Volume2, Sliders, CreditCard,
  User, Play, Pause, ShoppingBag, Compass, Award, Utensils, Laptop, BookOpen, Scissors, CheckSquare
} from 'lucide-react';
import API, { uploadFile, getMediaUrl, getWsUrl, getAuthToken, isAuthenticated } from './api';
import SafeImage from './components/SafeImage';
import StoryReplyBubble, { parseStatusReply } from './components/StoryReplyBubble';
import InAppChatBanner from './components/InAppChatBanner';
import MediaPreviewEditorModal from './components/MediaPreviewEditorModal';
import MarkdownRenderer from './components/MarkdownRenderer';
import SwipeableMessageBubble from './components/SwipeableMessageBubble';
import ChatMediaGallery from './components/ChatMediaGallery';
import InstallAppButton from './components/InstallAppButton';
import {
  isPushSupported,
  getNotificationPermissionState,
  subscribeUserToPush
} from './utils/pushNotifications';
import {
  getCachedThreadMessages,
  setCachedThreadMessages,
  mergeThreadMessages,
  appendThreadMessage,
  updateThreadMessage,
  removeThreadMessage,
  primeConversationsCache,
  revalidateThreadMessages,
  smartScrollToBottom,
  isUserNearBottom
} from './chatCache';

// Aliases for compatibility
export const getCachedChatMessages = getCachedThreadMessages;
export const setCachedChatMessages = setCachedThreadMessages;
export const prefetchRecentConversations = primeConversationsCache;

// Clean Raw JSON Strings & Extract Status/Chat Content
export function getDisplayContent(content) {
  if (!content) return "";
  let data = content;
  if (typeof content === "string" && content.trim().startsWith("{")) {
    try {
      data = JSON.parse(content);
    } catch {
      return content;
    }
  }
  if (typeof data === "object" && data !== null) {
    if (data.reply_text && data.reaction) {
      return `${data.reaction} ${data.reply_text}`;
    }
    if (data.reaction) {
      return `Reacted ${data.reaction} to story`;
    }
    return data.reply_text || data.text || data.caption || data.message || "";
  }
  return content;
}


export function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    let cleanStr = typeof timestamp === 'string' ? timestamp.trim() : timestamp;
    if (!cleanStr.endsWith('Z') && !cleanStr.includes('+') && !cleanStr.includes('-', 10)) {
      cleanStr += 'Z';
    }
    const d = new Date(typeof cleanStr === 'string' && cleanStr.includes(' ') ? cleanStr.replace(' ', 'T') : cleanStr);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "";
  }
}

export function isStatusReplyContent(content) {
  if (!content) return false;
  if (typeof content === "object" && (content.type === "status_reply" || content.status_id)) return true;
  if (typeof content === "string" && (content.includes('"type":"status_reply"') || content.includes('"status_reply"') || content.startsWith('Replying to status'))) return true;
  return false;
}

// Chat Reply Parser for Quoted Messages
export function parseChatReply(msg) {
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
}


// Stale-While-Revalidate Caching Utilities for Vendor
export function getCachedData(key, fallback) {
  try {
    const raw = localStorage.getItem(`cl_cache_vendor_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setCachedData(key, value) {
  try {
    localStorage.setItem(`cl_cache_vendor_${key}`, JSON.stringify(value));
  } catch { }
}

// Safe Date and Time Formatters (Prevents RangeError on iOS Safari / WebKit and ensures accurate UTC handling)
export function safeTime(dateStr, fallback = 'Recently') {
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
}

export function safeDate(dateStr, fallback = 'Recent') {
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
}

// Presence: format accurate last seen or active now (with rock-solid UTC timezone handling)
export function formatLastSeen(lastSeenIso, isOnline) {
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
}

// URL and localStorage tab persistence for Vendor
export function getInitialVendorTab() {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'reels' || tabParam === 'feed') return 'home';
    if (tabParam === 'services' || tabParam === 'catalog') return 'inventory';
    const validTabs = ['home', 'reels', 'inventory', 'services', 'marketplace', 'messages', 'friends', 'notifications', 'hub', 'settings', 'verification'];
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam === 'reels' ? 'home' : (tabParam === 'services' || tabParam === 'catalog') ? 'inventory' : tabParam;
    }
    const saved = localStorage.getItem('campuslink_vendor_tab');
    if (saved === 'reels' || saved === 'feed') return 'home';
    if (saved === 'services' || saved === 'catalog') return 'inventory';
    if (saved && validTabs.includes(saved)) {
      return saved === 'reels' ? 'home' : (saved === 'services' || saved === 'catalog') ? 'inventory' : saved;
    }
  } catch { }
  return 'home';
}

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
  const [isStoreLoading, setIsStoreLoading] = useState(() => !getCachedData('store', null));
  const [activeTab, setActiveTab] = useState(getInitialVendorTab);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [catalogType, setCatalogType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'services' ? 'services' : 'products';
  }); // 'products' | 'services'
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchOpen, setCatalogSearchOpen] = useState(false);
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('all');
  const [friendsTabFilter, setFriendsTabFilter] = useState('find'); // 'find' (1st) | 'all' (requests 2nd) | 'friends' (3rd)

  // Settings & Profile Experience Modals
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  // New Vendor Profile Completion Prompt State
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
    } catch { }
    return false;
  });

  // Operational & Store Status States
  const [storeStatus, setStoreStatus] = useState(() => localStorage.getItem('vendor_store_status') || 'open'); // 'open' | 'break' | 'closed'
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

  // Campus Marketplace States (Vendors can explore other campus products & services)
  const [marketplaceProducts, setMarketplaceProducts] = useState(() => getCachedData('marketplace_products', []));
  const [marketplaceServices, setMarketplaceServices] = useState(() => getCachedData('marketplace_services', []));
  const [marketplaceType, setMarketplaceType] = useState('products'); // 'products' | 'services'
  const [marketplaceCategory, setMarketplaceCategory] = useState('all');
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState('');
  const [marketplaceSelectedItem, setMarketplaceSelectedItem] = useState(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState(() => getCachedData('notifications', []));
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'

  // Messaging & Friends States (SWR Instant-Load Cache)
  const [conversations, setConversations] = useState(() => getCachedData('conversations', []));
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const chatAudioElementRef = useRef(null);
  const chatInputRef = useRef(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [pendingMediaFile, setPendingMediaFile] = useState(null);
  const [pendingMediaFiles, setPendingMediaFiles] = useState([]);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);
  const [messageSubtab, setMessageSubtab] = useState('chats'); // 'chats' | 'friends' | 'requests' | 'my_friends'
  const [communityUsers, setCommunityUsers] = useState(() => getCachedData('communityUsers', []));
  const [friendsList, setFriendsList] = useState(() => getCachedData('friendsList', []));
  const myFriends = friendsList;
  const setMyFriends = setFriendsList;
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityRoleFilter, setCommunityRoleFilter] = useState('all'); // 'all' | 'student' | 'vendor'
  const [pendingRequests, setPendingRequests] = useState(() => getCachedData('pendingRequests', []));
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [activePopoverMsgId, setActivePopoverMsgId] = useState(null);
  const [actionModalMsg, setActionModalMsg] = useState(null);
  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const aiMessagesEndRef = useRef(null);
  const chatBottomRef = messagesEndRef;
  const chatContainerRef = useRef(null);
  const chatMediaInputRef = useRef(null);

  // CampusLink AI Chat States (Scoped strictly to current merchant user)
  const [aiMessages, setAiMessages] = useState(() => {
    const uid = user?.user_id || user?.id;
    return uid ? getCachedData(`ai_messages_${uid}`, []) : [];
  });
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
  const [activePostMenuId, setActivePostMenuId] = useState(null);
  const [hiddenPostIds, setHiddenPostIds] = useState([]);
  const commentInputRef = useRef(null);

  // Settings & Sound State
  const [settingsSubtab, setSettingsSubtab] = useState('profile'); // 'profile' | 'payouts' | 'security' | 'notifications' | 'about'
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('cl_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Native Phone Push Notifications State
  const [pushState, setPushState] = useState(() => getNotificationPermissionState());
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  // Auto-sync push registration to backend on mount if already granted
  useEffect(() => {
    if (isPushSupported() && Notification.permission === 'granted') {
      subscribeUserToPush(API).then(res => {
        if (res?.success) setPushState('granted');
      }).catch(() => { });
    }
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    setPushMessage('');
    const res = await subscribeUserToPush(API);
    setPushLoading(false);
    if (res.success) {
      setPushState('granted');
      showToast('🔔 Notifications enabled successfully!', 'info');
    } else {
      showToast(res.error || 'Could not enable notifications.', 'error');
    }
  };

  // Modals State
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showReelModal, setShowReelModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  const showToast = (text, type = 'error') => {
    if (!text) return;
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(prev => (prev.text === text ? { type: '', text: '' } : prev));
    }, 4500);
  };
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

  const [verificationForm, setVerificationForm] = useState({
    id_card_type: 'national_id',
    id_card_number: '',
    id_card_front: '',
    id_card_back: '',
    location: '',
    phone: '',
    business_name: ''
  });

  // Product Form & Editing States
  const [editingProduct, setEditingProduct] = useState(null);

  // Universal Chat & Directory Filtering for Vendor
  const filteredConversations = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c =>
      (c.partner_name || '').toLowerCase().includes(q) ||
      (c.last_message || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    );
  }, [conversations, chatSearchQuery]);

  const availableCommunityToChat = useMemo(() => {
    const activePartnerIds = new Set(conversations.map(c => String(c.partner_id || c.user_id || c.id)));
    const q = chatSearchQuery.trim().toLowerCase();

    // Only connected friends can be messaged
    const friendsOnly = (myFriends || []).filter((u, idx, arr) => {
      const uid = String(u.user_id || u.id);
      return (
        uid &&
        uid !== String(user?.user_id) &&
        uid !== String(user?.id) &&
        arr.findIndex(x => String(x.user_id || x.id) === uid) === idx
      );
    });

    return friendsOnly.filter(u => {
      const uid = String(u.user_id || u.id);
      const notInActive = !activePartnerIds.has(uid);
      if (!q) return notInActive;
      return (
        (u.full_name || u.name || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.university_name || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, myFriends, chatSearchQuery, user?.user_id, user?.id]);

  // Catalog Search Filtering for Products & Services
  const displayedProducts = useMemo(() => {
    const q = catalogSearchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category_name || '').toLowerCase().includes(q)
    );
  }, [products, catalogSearchQuery]);

  const displayedServices = useMemo(() => {
    const q = catalogSearchQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q)
    );
  }, [services, catalogSearchQuery]);

  // Verification Form State
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [verificationSubmitted, setVerificationSubmitted] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-dropdown]')) {
        // close open dropdowns if needed
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
    } catch { }
  }, [activeTab]);

  const isVerified = Boolean(
    vendorStore?.verification_status === 'approved' ||
    vendorStore?.verification_status === 'verified' ||
    user?.is_verified === true ||
    user?.verification_status === 'verified'
  );
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'services') {
          setCatalogType('services');
          setActiveTab('inventory');
        } else if (tab === 'home') {
          setActiveTab('reels');
        } else if (tab && ['inventory', 'services', 'marketplace', 'messages', 'reels', 'friends', 'notifications', 'hub', 'settings', 'verification'].includes(tab)) {
          setActiveTab(tab);
        }
      } catch { }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [universities, setUniversities] = useState([]);
  const [showUpdateDocs, setShowUpdateDocs] = useState(false);
  const [prodFile, setProdFile] = useState(null);
  const [prodPreview, setProdPreview] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: 1,
    custom_category: '',
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
    custom_category: '',
    location: ''
  });

  // Reel Form State (with real file)
  const [reelMediaFile, setReelMediaFile] = useState(null);
  const [reelMediaPreview, setReelMediaPreview] = useState(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const reelFileInputRef = useRef(null);
  const [reelForm, setReelForm] = useState({
    title: '',
    description: '',
    media_type: 'image',
    location: ''
  });

  const handleDetectGpsLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'info');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(3);
        const lon = pos.coords.longitude.toFixed(3);
        setReelForm(prev => ({ ...prev, location: `📍 Live GPS (${lat}, ${lon}) • ${vendorStore?.location || 'Campus'}` }));
        setDetectingGps(false);
        showToast('Device GPS location detected!', 'info');
      },
      (err) => {
        console.warn(err);
        setReelForm(prev => ({ ...prev, location: `📍 ${vendorStore?.location || 'Campus SUB'}` }));
        setDetectingGps(false);
        showToast(`Using ${vendorStore?.location || 'Campus'} location.`, 'info');
      },
      { timeout: 8000 }
    );
  };

  const handleReelFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReelMediaFile(file);
    const previewUrl = URL.createObjectURL(file);
    setReelMediaPreview(previewUrl);
    setReelForm(prev => ({
      ...prev,
      media_type: file.type.startsWith('video') ? 'video' : 'image'
    }));
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
      setUser(parsed);
      loadStoreData();
    } catch {
      navigate('/login');
    }
  }, [navigate]);


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
  const scrollToBottom = (behavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const scrollAiToBottom = (behavior = "auto") => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const scrollToChatBottom = (instant = true) => {
    scrollToBottom(instant ? "auto" : "smooth");
  };

  // Trigger on active conversation switch or messages length change
  useEffect(() => {
    scrollToBottom("auto");
  }, [selectedPartner?.partner_id, selectedPartner?.user_id, selectedPartner?.id, activeTab, messageSubtab, chatMessages?.length]);

  // Trigger on AI tab switch or aiMessages length change
  useEffect(() => {
    scrollAiToBottom("auto");
  }, [activeTab, aiMessages?.length]);

  // Instant snap to bottom on partner selection or messages update (shows most recent chat)
  useEffect(() => {
    if (selectedPartner) {
      const snap = () => {
        scrollToBottom("auto");
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
  }, [selectedPartner?.partner_id, selectedPartner?.user_id, selectedPartner?.id, chatMessages?.length]);

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
              } catch (_) { }
            }
          }, 35000); // 35-second keepalive heartbeat for Render proxy
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') return; // Heartbeat response

            if (data.type === 'message_edited' && data.message) {
              const ed = data.message;
              setChatMessages(prev => prev.map(m => String(m.id) === String(ed.id) ? { ...m, content: ed.content, is_edited: true } : m));
              updateThreadMessage(ed.sender_id, ed.id, { content: ed.content, is_edited: true });
              updateThreadMessage(ed.recipient_id, ed.id, { content: ed.content, is_edited: true });
            }

            if (data.type === 'message_deleted' && data.message_id) {
              const delId = data.message_id;
              setChatMessages(prev => prev.filter(m => String(m.id) !== String(delId)));
              if (data.sender_id) removeThreadMessage(data.sender_id, delId);
              if (data.recipient_id) removeThreadMessage(data.recipient_id, delId);
            }

            if (data.type === 'message_reaction' && data.message_id) {
              const rId = data.message_id;
              setChatMessages(prev => prev.map(m => String(m.id) === String(rId) ? { ...m, reactions: data.reactions } : m));
              if (data.sender_id) updateThreadMessage(data.sender_id, rId, { reactions: data.reactions });
              if (data.recipient_id) updateThreadMessage(data.recipient_id, rId, { reactions: data.reactions });
            }

            if (data.type === 'messages_read' && Array.isArray(data.message_ids)) {
              const readSet = new Set(data.message_ids.map(String));
              setChatMessages(prev => prev.map(m => readSet.has(String(m.id)) ? { ...m, is_read: true } : m));
              const currentPid = selectedPartnerRef.current?.partner_id || selectedPartnerRef.current?.user_id || selectedPartnerRef.current?.id;
              if (currentPid) {
                data.message_ids.forEach(mid => {
                  updateThreadMessage(currentPid, mid, { is_read: true });
                });
              }
            }

            if (data.type === 'new_message' && data.message) {
              const newM = data.message;
              const currentUid = String(uid || user?.user_id || user?.id || vendorStore?.user_id || '');
              const isFromMe = Boolean(currentUid && (
                String(newM.sender_id) === currentUid ||
                (vendorStore?.id && String(newM.sender_id) === String(vendorStore.id))
              ));

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
                  API.post(`/messages/${newM.sender_id}/read`).catch(() => { });
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

                  // Pop real system / mobile notification banner with message details
                  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
                    navigator.serviceWorker.ready.then(reg => {
                      reg.showNotification(data.sender_name || 'Customer Message (CampusLink)', {
                        body: newM.content || (newM.message_type === 'audio' ? '🎤 Voice note' : 'New attachment'),
                        icon: data.sender_avatar || '/pwa-192x192.png',
                        badge: '/pwa-icon.svg',
                        tag: `campuslink-vendor-msg-${newM.sender_id}`,
                        renotify: true,
                        data: {
                          url: `/vendor-dashboard?tab=messages&chat=${newM.sender_id}`
                        }
                      });
                    }).catch(() => { });
                  } else if ('Notification' in window && Notification.permission === 'granted') {
                    try {
                      new Notification(data.sender_name || 'Customer Message (CampusLink)', {
                        body: newM.content || (newM.message_type === 'audio' ? '🎤 Voice note' : 'New attachment'),
                        icon: data.sender_avatar || '/pwa-192x192.png',
                        badge: '/pwa-icon.svg',
                        tag: `campuslink-vendor-msg-${newM.sender_id}`
                      });
                    } catch (_) { }
                  }
                }

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
          } catch (err) {
            // Suppress noisy error logs
          }
        };

        socket.onclose = () => {
          clearTimers();
          if (!isMounted) return;

          // Continuous exponential backoff: 3s -> 4.5s -> 6.7s -> 10s -> max 12s (never stops retrying)
          const backoffMs = Math.min(12000, 3000 * Math.pow(1.5, Math.min(retryCount, 6)));
          retryCount++;
          reconnectTimeout = setTimeout(connectWs, backoffMs);
        };

        socket.onerror = () => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.close(); } catch (_) { }
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
        } catch (_) { }
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
        .catch(() => { });
      API.get('/campus/statuses')
        .then(res => setStatusGroups(res.data || []))
        .catch(() => { });
      API.get('/notifications')
        .then(res => {
          const list = res.data?.notifications || (Array.isArray(res.data) ? res.data : []);
          const unread = res.data?.unread_count ?? list.filter(n => !n.is_read).length;
          setNotifications(list);
          setUnreadNotifCount(unread);
        })
        .catch(() => { });
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

  // Fetch and manage notifications
  const fetchNotifications = async () => {
    try {
      const res = await API.get('/notifications');
      const list = res.data?.notifications || (Array.isArray(res.data) ? res.data : []);
      const unread = res.data?.unread_count ?? list.filter(n => !n.is_read).length;
      setNotifications(list);
      setUnreadNotifCount(unread);
      setCachedData('notifications', list);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await API.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotifCount(0);
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await API.post(`/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadNotifCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('Error marking notification read:', err);
    }
    const t = (notif.notification_type || notif.type || '').toLowerCase();
    if (t.includes('reel') || t.includes('like') || t.includes('comment') || t === 'status_view') {
      setActiveTab('home');
    } else if (t.includes('friend')) {
      setActiveTab('friends');
      if (t === 'friend_request') setFriendsTabFilter('all');
      else if (t === 'friend_accept') setFriendsTabFilter('friends');
    } else if (t === 'message' || t.includes('chat') || t.includes('inquiry')) {
      setActiveTab('messages');
    } else if (t.includes('verification')) {
      setActiveTab('verification');
    } else if (t.includes('product') || t.includes('service') || t.includes('store')) {
      setActiveTab('inventory');
    }
  };

  // Record status views optimistically
  useEffect(() => {
    if (!activeStatusViewer || !statusGroups[activeStatusViewer.userIdx]) return;
    const targetGroup = statusGroups[activeStatusViewer.userIdx];
    const item = targetGroup.items?.[activeStatusViewer.itemIdx];
    if (item && !targetGroup.is_self) {
      const targetUserId = targetGroup.user_id;
      const targetItemId = item.id;

      // 1. Optimistic update in local state so viewed state reflects immediately
      setStatusGroups(prev => {
        const idx = prev.findIndex(g => g.user_id === targetUserId);
        if (idx === -1) return prev;
        const next = [...prev];
        const g = { ...next[idx] };
        if (g.items) {
          const nextItems = g.items.map(it =>
            it.id === targetItemId ? { ...it, is_viewed: true } : it
          );
          g.items = nextItems;
          g.has_unviewed = nextItems.some(it => !it.is_viewed);
          g.all_viewed = !g.has_unviewed;
          next[idx] = g;
          try {
            setCachedData('statusGroups', next);
          } catch { }
        }
        return next;
      });

      // 2. Persist view to backend
      API.post(`/campus/statuses/${targetItemId}/view`).catch(() => { });
    }
  }, [activeStatusViewer]);

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
        storeId ? API.get(`/vendors/${storeId}/reviews`) : Promise.resolve({ data: [] }),
        API.get('/conversations'),
        API.get('/reels'),
        API.get('/friends'),
        API.get('/friends/requests/pending'),
        API.get('/students'),
        API.get('/campus/statuses'),
        API.get('/universities'),
        API.get('/notifications')
      ]);

      if (results[0].status === 'fulfilled') {
        const allProds = results[0].value.data || [];
        setMarketplaceProducts(allProds);
        setCachedData('marketplace_products', allProds);
        const filteredProds = storeId ? allProds.filter(p => p.vendor_id === storeId) : allProds;
        setProducts(filteredProds);
        setCachedData('products', filteredProds);
      }
      if (results[1].status === 'fulfilled') {
        const allSvcs = results[1].value.data || [];
        setMarketplaceServices(allSvcs);
        setCachedData('marketplace_services', allSvcs);
        const filteredSvcs = storeId ? allSvcs.filter(s => s.vendor_id === storeId) : allSvcs;
        setServices(filteredSvcs);
        setCachedData('services', filteredSvcs);
      }
      if (results[2].status === 'fulfilled') {
        const revs = results[2].value.data || [];
        setVendorReviews(revs);
        setCachedData('reviews', revs);
      }
      if (results[3].status === 'fulfilled') {
        const convs = results[3].value.data || [];
        setConversations(convs);
        setCachedData('conversations', convs);
        prefetchRecentConversations(convs);
      }
      if (results[4].status === 'fulfilled') {
        const rls = results[4].value.data || [];
        setAllReels(rls);
        setCachedData('allReels', rls);
      }
      if (results[5].status === 'fulfilled') {
        const frnds = results[5].value.data || [];
        setFriendsList(frnds);
        setCachedData('friendsList', frnds);
      }
      if (results[6].status === 'fulfilled') {
        const pnd = results[6].value.data || [];
        setPendingRequests(pnd);
        setCachedData('pendingRequests', pnd);
      }
      if (results[7].status === 'fulfilled') {
        const stds = results[7].value.data || [];
        setCommunityUsers(stds);
        setCachedData('communityUsers', stds);
      }
      if (results[8].status === 'fulfilled') {
        const stats = results[8].value.data || [];
        setStatusGroups(stats);
        setCachedData('statusGroups', stats);
      }
      if (results[9].status === 'fulfilled') {
        setUniversities(results[9].value.data || []);
      }
      if (results[10].status === 'fulfilled') {
        const notifData = results[10].value.data || {};
        const list = notifData.notifications || (Array.isArray(notifData) ? notifData : []);
        const unread = notifData.unread_count ?? list.filter(n => !n.is_read).length;
        setNotifications(list);
        setUnreadNotifCount(unread);
        setCachedData('notifications', list);
      }
    } catch (err) {
      console.error('Error loading vendor dashboard data:', err);
    } finally {
      setIsStoreLoading(false);
    }
  };

  // --- PROFILE MODAL ACTIONS ---
  const handleOpenProfile = async (targetUserId) => {
    try {
      const res = await API.get(`/students/${targetUserId}`);
      setSelectedProfile(res.data);
      setProfileModalOpen(true);
    } catch (err) {
      showToast('Failed to load user profile.', 'error');
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
      showToast('Status story posted to campus network!', 'success');

      const statRes = await API.get('/campus/statuses');
      setStatusGroups(statRes.data || []);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post status.', 'error');
    } finally {
      setIsPublishingStatus(false);
    }
  };

  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm('Delete this status story?')) return;
    const prevGroups = statusGroups;
    // 0ms instant optimistic UI update
    setStatusGroups(prev => prev.map(g => ({
      ...g,
      items: (g.items || []).filter(item => item.id !== statusId)
    })).filter(g => (g.items || []).length > 0));
    setActiveStatusViewer(null);
    showToast('Story deleted.', 'info');

    try {
      await API.delete(`/campus/statuses/${statusId}`);
      API.get('/campus/statuses').then(res => setStatusGroups(res.data || [])).catch(() => { });
    } catch (err) {
      setStatusGroups(prevGroups);
      showToast('Failed to delete status story.', 'error');
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
      showToast(emoji ? `Sent ${emoji} reaction!` : 'Reply sent to chat!', 'success');

      // Open that chat
      const partner = communityUsers.find(u => (u.user_id === recipientId || u.id === recipientId));
      if (partner) {
        setSelectedPartner({ partner_id: recipientId, partner_name: partner.full_name, role: partner.role });
        handleSelectPartner({ partner_id: recipientId, partner_name: partner.full_name, role: partner.role });
      }
      setActiveTab('messages');
      setMessageSubtab('chats');
      API.get('/conversations').then(res => setConversations(res.data || [])).catch(() => { });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to send reply.', 'error');
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

      showToast('Store profile & settings updated successfully!', 'success');
      setEditProfileModalOpen(false);
      loadStoreData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update settings.', 'error');
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
      showToast('Profile picture / Store logo updated!', 'success');
      loadStoreData();
    } catch (err) {
      showToast('Failed to update picture.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await API.put('/users/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      showToast('Password changed successfully!', 'success');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setChangePasswordModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to change password.', 'error');
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
    setBroadcastModalOpen(false);
    setFeedbackMsg({ type: 'success', text: 'Live announcement banner updated!' });
  };

  const handleSaveBankInfo = (e) => {
    e.preventDefault();
    setBankInfo(bankForm);
    localStorage.setItem('vendor_bank_info', JSON.stringify(bankForm));
    setIsEditingBank(false);
    setBankModalOpen(false);
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
      } catch { }
      setTimeout(() => {
        setHighlightedMessageId(prev => (prev === targetId ? null : prev));
      }, 2500);
    }
  };

  // Chat Stale-While-Revalidate for Vendor
  const fetchMessagesForPartner = async (partnerId) => {
    if (!partnerId) return;
    // Mark as read immediately on server without waiting for GET
    API.post(`/messages/${partnerId}/read`).catch(() => { });
    setConversations(prev =>
      prev.map(c => (String(c.partner_id || c.user_id) === String(partnerId) ? { ...c, unread_count: 0 } : c))
    );

    try {
      const res = await API.get(`/messages/${partnerId}`);
      const fresh = res.data || [];
      setChatMessages(prev => {
        const freshIds = new Set(fresh.map(m => String(m.id)));
        const pendingOptimistic = prev.filter(m => m.is_optimistic && !freshIds.has(String(m.id)));
        if (
          pendingOptimistic.length === 0 &&
          prev.length === fresh.length &&
          prev.every((m, idx) => (
            m.id === fresh[idx]?.id &&
            m.content === fresh[idx]?.content &&
            m.is_read === fresh[idx]?.is_read &&
            m.reactions === fresh[idx]?.reactions &&
            m.is_edited === fresh[idx]?.is_edited &&
            !m.is_optimistic
          ))
        ) {
          return prev;
        }
        return [...fresh, ...pendingOptimistic];
      });
      scrollToChatBottom(false);
    } catch (err) {
      // silent
    }
  };

  const handleSelectPartner = (partner) => {
    if (!partner) return;
    const newPid = String(partner.partner_id || partner.user_id || partner.id || '');
    if (!newPid) return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'messages');
      url.searchParams.set('chat', newPid);
      window.history.replaceState({}, '', url.toString());
    } catch { }

    const normalized = {
      ...partner,
      partner_id: newPid,
      partner_name: partner.partner_name || partner.full_name || partner.name || partner.business_name || 'Customer',
      role: partner.role || 'student',
      partner_avatar: partner.partner_avatar || partner.avatar_url || partner.profile_picture_url || null
    };

    const cached = getCachedThreadMessages(newPid);
    setChatMessages(cached);
    setIsLoadingChatMessages(false);
    isSwitchingPartnerRef.current = true;
    setSelectedPartner(normalized);
    setActiveTab('messages');
    setMessageSubtab('chats');

    // Instant read receipt
    API.post(`/messages/${newPid}/read`).catch(() => { });
    setConversations(prev =>
      prev.map(c => (String(c.partner_id || c.user_id || c.id) === String(newPid) ? { ...c, unread_count: 0 } : c))
    );

    // Multi-tier scroll to bottom to ensure user is taken to the last chat message
    const triggerBottomScroll = () => {
      scrollToChatBottom(true);
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };
    triggerBottomScroll();
    requestAnimationFrame(triggerBottomScroll);
    setTimeout(triggerBottomScroll, 30);
    setTimeout(triggerBottomScroll, 100);
    setTimeout(triggerBottomScroll, 250);
    setTimeout(triggerBottomScroll, 500);

    fetchMessagesForPartner(newPid);
  };

  useEffect(() => {
    const pid = selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id;
    if (!pid || selectedPartner?.is_ai || pid === 'campus_ai') return;
    fetchMessagesForPartner(pid);
  }, [selectedPartner?.partner_id, selectedPartner?.user_id, selectedPartner?.id]);

  // --- CAMPUSLINK AI CHAT HANDLERS FOR VENDORS ---
  const fetchAiMessages = async () => {
    try {
      const res = await API.get('/ai/messages');
      const list = res.data || [];
      setAiMessages(list);
      const uid = user?.user_id || user?.id;
      if (uid) {
        setCachedData(`ai_messages_${uid}`, list);
      }
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

    setAiMessages(prev => {
      const updated = [...prev, userMessageObj];
      const uid = user?.user_id || user?.id;
      if (uid) setCachedData(`ai_messages_${uid}`, updated);
      return updated;
    });
    setNewMsgText('');
    setIsAiTyping(true);

    try {
      const formattedHistory = aiMessages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content || m.reply || ''
      }));

      const res = await API.post('/ai/chat', {
        message: textToSend,
        content: textToSend,
        history: formattedHistory,
        role_context: 'vendor'
      });

      const replyContent = res.data?.reply || res.data?.content || res.data?.message || res.data?.response || "I could not generate a response.";

      const aiReplyObj = {
        id: res.data?.id || ('ai-' + Date.now()),
        sender: 'ai',
        content: replyContent,
        reply: replyContent,
        created_at: res.data?.created_at || new Date().toISOString()
      };

      setAiMessages(prev => {
        const updated = [...prev, aiReplyObj];
        const uid = user?.user_id || user?.id;
        if (uid) setCachedData(`ai_messages_${uid}`, updated);
        return updated;
      });
    } catch (err) {
      console.error('AI chat error:', err);
      const errDetail = err.response?.data?.detail || err.response?.data?.reply || err.response?.data?.content || err.message;
      setAiMessages(prev => {
        const updated = [...prev, {
          id: 'err-' + Date.now(),
          sender: 'ai',
          content: `⚠️ Unable to get a response: ${errDetail}. Please try again.`,
          created_at: new Date().toISOString()
        }];
        const uid = user?.user_id || user?.id;
        if (uid) setCachedData(`ai_messages_${uid}`, updated);
        return updated;
      });
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
    const currentUserIdStr = String(user?.user_id || user?.id || vendorStore?.user_id || '');
    const isMine = Boolean(currentUserIdStr && msg.sender_id && (
      String(msg.sender_id) === currentUserIdStr ||
      (vendorStore?.id && String(msg.sender_id) === String(vendorStore.id))
    ));
    const senderName = isMine ? 'You' : (selectedPartner?.partner_name || 'Customer');
    const previewText = (typeof msg.content === 'string' ? msg.content : (msg.text || 'Message')).slice(0, 100);
    setReplyingToMessage({
      id: msg.id,
      sender_name: senderName,
      preview: previewText
    });
  };

  const handleCopyMessageText = (msgOrText) => {
    if (!msgOrText) return;
    const text = typeof msgOrText === 'string' ? msgOrText : (msgOrText.content || msgOrText.text || '');
    if (text) {
      navigator.clipboard.writeText(text);
      setFeedbackMsg({ type: 'success', text: 'Message copied to clipboard' });
      try {
        if (navigator.vibrate) navigator.vibrate(15);
      } catch { }
    }
    setActivePopoverMsgId(null);
  };

  const handleReactToMessage = async (msg, emoji) => {
    if (!msg || !emoji) return;
    const msgId = msg.id;
    const uid = String(user?.user_id || user?.id || vendorStore?.user_id || '');

    let currentReactions = {};
    try {
      currentReactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions || {});
      if (typeof currentReactions !== 'object' || currentReactions === null) currentReactions = {};
    } catch {
      currentReactions = {};
    }

    if (currentReactions[uid] === emoji) {
      delete currentReactions[uid];
    } else {
      currentReactions[uid] = emoji;
    }
    const newReactionsStr = Object.keys(currentReactions).length ? JSON.stringify(currentReactions) : null;

    // 0ms instant optimistic reaction update
    setChatMessages(prev => prev.map(m => (String(m.id) === String(msgId) ? { ...m, reactions: newReactionsStr } : m)));
    const partnerId = selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id;
    if (partnerId) {
      updateThreadMessage(partnerId, msgId, { reactions: newReactionsStr });
    }
    try {
      if (navigator.vibrate) navigator.vibrate(15);
    } catch { }

    if (String(msgId).startsWith('temp_')) return;
    try {
      await API.post(`/messages/${msgId}/react`, { emoji });
    } catch (err) {
      console.error('Failed to react to message:', err);
    }
  };

  const handleStartEditMessage = (msg) => {
    if (!msg) return;
    setActivePopoverMsgId(null);
    setReplyingToMessage(null);
    setEditingMessage(msg);
    const textContent = typeof msg.content === 'string' ? msg.content : (msg.text || '');
    setNewMsgText(textContent);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 60);
  };

  const handleCancelEditMessage = () => {
    setEditingMessage(null);
    setNewMsgText('');
  };

  const handleDeleteMessage = async (msgId) => {
    if (!msgId) return;
    setActivePopoverMsgId(null);
    const partnerId = selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id;
    // 0ms instant optimistic removal
    setChatMessages(prev => prev.filter(m => String(m.id) !== String(msgId)));
    if (partnerId) {
      removeThreadMessage(partnerId, msgId);
    }
    setFeedbackMsg({ type: 'success', text: 'Message deleted' });
    if (String(msgId).startsWith('temp_')) return;
    try {
      await API.delete(`/messages/${msgId}`);
    } catch (err) {
      console.error('Failed to delete message:', err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to delete message.' });
    }
  };

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
    const partnerId = selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id;

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setIsRecordingAudio(false);
      setRecordingSeconds(0);

      // 1. Optimistic 0ms Render
      const localAudioUrl = URL.createObjectURL(audioBlob);
      const tempId = `temp_audio_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const optimisticMsg = {
        id: tempId,
        sender_id: user?.user_id || user?.id,
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
        const idx = prev.findIndex(c => String(c.partner_id || c.user_id) === String(partnerId));
        if (idx !== -1) {
          const updated = { ...prev[idx], last_message: '🎤 Voice note', last_timestamp: new Date().toISOString() };
          const next = [updated, ...prev.filter((_, i) => i !== idx)];
          setCachedData('conversations', next);
          return next;
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
        setChatMessages(prev => prev.map(m => (m.id === tempId ? confirmed : m)));
      } catch (err) {
        setChatMessages(prev => prev.filter(m => m.id !== tempId));
        showToast('Failed to send voice note.', 'error');
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

  const handleSendChatMessage = async (customContent = null, customReply = null, overridePartner = null) => {
    const targetPartner = overridePartner || selectedPartner;
    if (targetPartner?.is_ai) {
      return handleSendAiMessage(customContent);
    }

    const text = customContent || newMsgText;
    const hasMedia = pendingMediaFiles.length > 0;
    if ((!text.trim() && !hasMedia) || !targetPartner) return;

    const partnerId = String(targetPartner.partner_id || targetPartner.user_id || targetPartner.id || '');
    if (!partnerId) {
      showToast('Please select a chat recipient first.', 'error');
      return;
    }

    // Handle Edit Mode
    if (editingMessage) {
      const updatedText = text.trim();
      const editId = editingMessage.id;
      setEditingMessage(null);
      if (!customContent) setNewMsgText('');
      if (!updatedText) return;

      // 0ms Optimistic Update
      setChatMessages(prev => prev.map(m => (String(m.id) === String(editId) ? { ...m, content: updatedText, is_edited: true } : m)));
      if (partnerId) {
        updateThreadMessage(partnerId, editId, { content: updatedText, is_edited: true });
      }
      setFeedbackMsg({ type: 'success', text: 'Message edited successfully!' });

      if (String(editId).startsWith('temp_')) return;

      try {
        await API.put(`/messages/${editId}`, { content: updatedText });
      } catch (err) {
        console.error('Failed to edit message:', err);
        setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to edit message.' });
      }
      return;
    }

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
        showToast('Failed to send media files.', 'error');
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
      const idx = prev.findIndex(c => String(c.partner_id || c.user_id || c.id) === String(partnerId));
      if (idx !== -1) {
        const updated = { ...prev[idx], last_message: messageText, last_timestamp: new Date().toISOString() };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      }
      const newConv = {
        partner_id: partnerId,
        partner_name: targetPartner?.partner_name || targetPartner?.full_name || 'Customer',
        role: targetPartner?.role || 'student',
        partner_avatar: targetPartner?.partner_avatar || targetPartner?.avatar_url || null,
        unread_count: 0,
        last_message: messageText,
        last_timestamp: new Date().toISOString()
      };
      return [newConv, ...prev];
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
      showToast(err.response?.data?.detail || 'Failed to send message.', 'error');
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
        try { URL.revokeObjectURL(removed.previewUrl); } catch { }
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
      showToast(err.response?.data?.detail || 'Failed to send media.', 'error');
    }
  };

  // --- FRIEND REQUEST ACTIONS (0ms OPTIMISTIC) ---
  const handleSendFriendRequest = async (targetUserId) => {
    if (!targetUserId) return;
    const prevUsers = communityUsers;
    const prevProfile = selectedProfile;

    // 0ms instant optimistic UI update
    setCommunityUsers(prev => prev.map(u =>
      (u.user_id === targetUserId || u.id === targetUserId)
        ? { ...u, friendship_status: 'request_sent' }
        : u
    ));
    if (selectedProfile && (selectedProfile.user_id === targetUserId || selectedProfile.id === targetUserId)) {
      setSelectedProfile(prev => ({ ...prev, friendship_status: 'request_sent' }));
    }
    showToast('Friend request sent!', 'success');

    try {
      const res = await API.post(`/friends/request/${targetUserId}`);
      if (res.data?.message) {
        showToast(res.data.message, 'success');
      }
      if (res.data?.request_id || res.data?.status) {
        const finalStatus = res.data.status || 'request_sent';
        const finalReqId = res.data.request_id || null;
        setCommunityUsers(prev => prev.map(u =>
          (u.user_id === targetUserId || u.id === targetUserId)
            ? { ...u, friendship_status: finalStatus, request_id: finalReqId }
            : u
        ));
        if (selectedProfile && (selectedProfile.user_id === targetUserId || selectedProfile.id === targetUserId)) {
          setSelectedProfile(prev => ({ ...prev, friendship_status: finalStatus, request_id: finalReqId }));
        }
      }
      API.get('/friends/requests/pending').then(r => setPendingRequests(r.data || [])).catch(() => { });
    } catch (err) {
      setCommunityUsers(prevUsers);
      if (prevProfile) setSelectedProfile(prevProfile);
      showToast(err.response?.data?.detail || 'Failed to send friend request.', 'error');
    }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    if (!requestId) return;
    const prevPending = pendingRequests;
    const prevFriends = friendsList;
    const prevUsers = communityUsers;
    const prevProfile = selectedProfile;

    const targetReq = pendingRequests.find(r => r.request_id === requestId || r.id === requestId);
    const senderId = targetReq?.sender_id;

    // 0ms instant optimistic UI update
    setPendingRequests(prev => prev.filter(r => r.request_id !== requestId && r.id !== requestId));
    setCommunityUsers(prev => prev.map(u =>
      (u.request_id === requestId || (senderId && (u.user_id === senderId || u.id === senderId)))
        ? { ...u, friendship_status: 'friends' }
        : u
    ));
    if (targetReq) {
      setFriendsList(prev => [
        {
          friend_id: targetReq.sender_id,
          friend_name: targetReq.sender_name,
          friend_avatar: targetReq.sender_avatar,
          department: targetReq.sender_department,
          level: targetReq.sender_level,
          university_name: targetReq.sender_university || 'On Campus'
        },
        ...prev
      ]);
    }
    if (selectedProfile && (selectedProfile.request_id === requestId || (senderId && (selectedProfile.user_id === senderId || selectedProfile.id === senderId)))) {
      setSelectedProfile(prev => ({ ...prev, friendship_status: 'friends' }));
    }
    showToast('Friend request accepted! You are now connected.', 'success');

    try {
      const res = await API.post(`/friends/requests/${requestId}/accept`);
      if (res.data?.message) {
        showToast(res.data.message, 'success');
      }
      Promise.all([
        API.get('/friends'),
        API.get('/friends/requests/pending'),
        API.get('/students')
      ]).then(([frRes, pendRes, commRes]) => {
        setFriendsList(frRes.data || []);
        setPendingRequests(pendRes.data || []);
        setCommunityUsers(commRes.data || []);
      }).catch(() => { });
    } catch (err) {
      setPendingRequests(prevPending);
      setFriendsList(prevFriends);
      setCommunityUsers(prevUsers);
      if (prevProfile) setSelectedProfile(prevProfile);
      showToast(err.response?.data?.detail || 'Failed to accept friend request.', 'error');
    }
  };

  const handleDeclineFriendRequest = async (requestId) => {
    if (!requestId) return;
    const prevPending = pendingRequests;
    const prevUsers = communityUsers;
    const prevProfile = selectedProfile;

    const targetReq = pendingRequests.find(r => r.request_id === requestId || r.id === requestId);
    const senderId = targetReq?.sender_id;

    // 0ms instant UI update
    setPendingRequests(prev => prev.filter(r => r.request_id !== requestId && r.id !== requestId));
    setCommunityUsers(prev => prev.map(u =>
      (u.request_id === requestId || (senderId && (u.user_id === senderId || u.id === senderId)))
        ? { ...u, friendship_status: 'none', request_id: null }
        : u
    ));
    if (selectedProfile && (selectedProfile.request_id === requestId || (senderId && (selectedProfile.user_id === senderId || selectedProfile.id === senderId)))) {
      setSelectedProfile(prev => ({ ...prev, friendship_status: 'none', request_id: null }));
    }
    showToast('Friend request declined.', 'info');

    try {
      await API.post(`/friends/requests/${requestId}/decline`);
    } catch (err) {
      setPendingRequests(prevPending);
      setCommunityUsers(prevUsers);
      if (prevProfile) setSelectedProfile(prevProfile);
      showToast(err.response?.data?.detail || 'Failed to decline request.', 'error');
    }
  };

  const handleRemoveFriend = async (targetUserId) => {
    if (!window.confirm('Remove friend from your campus network?')) return;
    const prevUsers = communityUsers;
    const prevFriends = friendsList;
    const prevProfile = selectedProfile;

    // 0ms instant UI update
    setCommunityUsers(prev => prev.map(u =>
      (u.user_id === targetUserId || u.id === targetUserId)
        ? { ...u, friendship_status: 'none', request_id: null }
        : u
    ));
    setFriendsList(prev => prev.filter(f => f.friend_id !== targetUserId && f.user_id !== targetUserId && f.id !== targetUserId));
    if (selectedProfile && (selectedProfile.user_id === targetUserId || selectedProfile.id === targetUserId)) {
      setSelectedProfile(prev => ({ ...prev, friendship_status: 'none', request_id: null }));
    }
    showToast('Removed connection.', 'info');

    try {
      const res = await API.delete(`/friends/cancel/${targetUserId}`);
      if (res.data?.message) {
        showToast(res.data.message, 'info');
      }
      API.get('/friends').then(r => setFriendsList(r.data || [])).catch(() => { });
    } catch (err) {
      setCommunityUsers(prevUsers);
      setFriendsList(prevFriends);
      if (prevProfile) setSelectedProfile(prevProfile);
      showToast(err.response?.data?.detail || 'Failed to remove connection.', 'error');
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
      showToast(currentReply ? `Reply sent to @${currentReply.authorName}!` : 'Comment published on campus drop!', 'success');
    } catch (err) {
      setAllReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const updated = (r.comments || []).filter(c => c.id !== tempId);
          return { ...r, comments: updated, comments_count: updated.length };
        }
        return r;
      }));
      showToast(err.response?.data?.detail || 'Failed to post comment.', 'error');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteReelComment = async (reelId, commentId) => {
    setAllReels(prev => prev.map(r => {
      if (r.id === reelId) {
        const nextComments = (r.comments || []).filter(c => c.id !== commentId);
        return { ...r, comments: nextComments, comments_count: Math.max(0, (r.comments_count || 1) - 1) };
      }
      return r;
    }));
    try {
      await API.delete(`/reels/${reelId}/comments/${commentId}`);
      showToast('Comment deleted.', 'info');
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleHidePost = (id) => {
    setHiddenPostIds(prev => [...prev, id]);
    showToast('Post hidden from your feed.', 'info');
    setActivePostMenuId(null);
  };

  const handleReportPost = (id) => {
    showToast('Post reported for moderator review.', 'info');
    setActivePostMenuId(null);
  };

  const handleCopyPostLink = (reel) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel.id}`);
        showToast('Link copied to clipboard!', 'success');
      }
    } catch (_) { }
    setActivePostMenuId(null);
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
        showToast('Please select clear photos for both FRONT and BACK (or Page 1 and 2) of your verification document.', 'error');
        setIsSubmitting(false);
        return;
      }

      await API.post('/vendor/verification', {
        ...verificationForm,
        id_card_front: frontUrl,
        id_card_back: backUrl
      });

      showToast('Verification document submitted! Campus Admins will review and approve your store.', 'success');
      loadStoreData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Verification submission failed.', 'error');
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

      const isOther = String(productForm.category_id) === 'other';
      const catId = isOther ? 1 : (parseInt(productForm.category_id) || 1);
      const desc = isOther && productForm.custom_category
        ? `[Category: ${productForm.custom_category.trim()}] ${productForm.description.trim()}`
        : productForm.description.trim();

      const payload = {
        name: productForm.name.trim(),
        description: desc,
        price: parseFloat(productForm.price),
        category_id: catId,
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
      setProductForm({ name: '', description: '', price: '', category_id: 1, custom_category: '', quantity: 1, university_id: '' });
      setProdFile(null);
      setProdPreview(null);
      API.get('/products').then(res => {
        const fresh = res.data || [];
        setProducts(fresh);
        setCachedData('products', fresh);
      }).catch(() => { });
    } catch (err) {
      showToast(err.response?.data?.detail || (editingProduct ? 'Failed to update product.' : 'Failed to add product.'), 'error');
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

      const isOther = String(serviceForm.category_id) === 'other';
      const catId = isOther ? 5 : (parseInt(serviceForm.category_id) || 5);
      const desc = isOther && serviceForm.custom_category
        ? `[Category: ${serviceForm.custom_category.trim()}] ${serviceForm.description.trim()}`
        : serviceForm.description.trim();

      await API.post('/services', {
        name: serviceForm.name.trim(),
        description: desc,
        price: parseFloat(serviceForm.price),
        category_id: catId,
        location: serviceForm.location.trim() || vendorStore?.location,
        image: imageUrl
      });

      setShowServiceModal(false);
      setServiceForm({ name: '', description: '', price: '', category_id: 5, custom_category: '', location: '' });
      setSvcFile(null);
      setSvcPreview(null);
      showToast('Service published to Campus Marketplace!', 'success');
      API.get('/services').then(res => {
        const fresh = res.data || [];
        setServices(fresh);
        setCachedData('services', fresh);
      }).catch(() => { });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add service.', 'error');
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
      showToast('Promotional Drop published to Campus Reels feed!', 'success');
      API.get('/reels').then(res => {
        const fresh = res.data || [];
        setAllReels(fresh);
        setCachedData('allReels', fresh);
      }).catch(() => { });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post reel.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 0ms Optimistic Delete Product
  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    const prevProducts = products;
    setProducts(prev => prev.filter(p => p.id !== id));
    setCachedData('products', products.filter(p => p.id !== id));
    showToast('Product removed successfully.', 'success');

    try {
      await API.delete(`/products/${id}`);
      API.get('/products').then(res => {
        const fresh = res.data || [];
        setProducts(fresh);
        setCachedData('products', fresh);
      }).catch(() => { });
    } catch (err) {
      setProducts(prevProducts);
      setCachedData('products', prevProducts);
      showToast(err.response?.data?.detail || 'Delete failed.', 'error');
    }
  };

  // 0ms Optimistic Delete Service
  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete this service listing?')) return;
    const prevServices = services;
    setServices(prev => prev.filter(s => s.id !== id));
    setCachedData('services', services.filter(s => s.id !== id));
    showToast('Service listing deleted successfully.', 'success');

    try {
      await API.delete(`/services/${id}`);
      API.get('/services').then(res => {
        const fresh = res.data || [];
        setServices(fresh);
        setCachedData('services', fresh);
      }).catch(() => { });
    } catch (err) {
      setServices(prevServices);
      setCachedData('services', prevServices);
      showToast(err.response?.data?.detail || 'Delete failed.', 'error');
    }
  };

  // 0ms Optimistic Delete Reel
  const handleDeleteReel = async (id) => {
    if (!window.confirm('Delete this promotional drop?')) return;
    const prevReels = allReels;
    setAllReels(prev => prev.filter(r => r.id !== id));
    setCachedData('allReels', allReels.filter(r => r.id !== id));
    showToast('Promotional drop deleted successfully.', 'success');

    try {
      await API.delete(`/reels/${id}`);
      API.get('/reels').then(res => {
        const fresh = res.data || [];
        setAllReels(fresh);
        setCachedData('allReels', fresh);
      }).catch(() => { });
    } catch (err) {
      setAllReels(prevReels);
      setCachedData('allReels', prevReels);
      showToast(err.response?.data?.detail || 'Delete failed.', 'error');
    }
  };

  // 0ms Optimistic Order Status Update
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const prevOrders = vendorOrders;
    const updated = vendorOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setVendorOrders(updated);
    setCachedData('orders', updated);
    showToast(`Order status updated to ${newStatus}.`, 'success');

    try {
      await API.post(`/orders/${orderId}/status?status_update=${newStatus}`);
      API.get('/orders').then(res => {
        const fresh = res.data || [];
        setVendorOrders(fresh);
        setCachedData('orders', fresh);
      }).catch(() => { });
    } catch (err) {
      setVendorOrders(prevOrders);
      setCachedData('orders', prevOrders);
      showToast(err.response?.data?.detail || 'Status update failed.', 'error');
    }
  };

  const handleLogout = () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('cl_cache_') || k.startsWith('campus_ai_') || k === 'token' || k === 'user' || k === 'campuslink_vendor_tab')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { }
    setAiMessages([]);
    navigate('/login');
  };

  const pendingOrdersCount = (vendorOrders || []).filter(o => o.status === 'pending').length;
  const totalRevenue = (vendorOrders || [])
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
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center space-x-2.5 mb-6 cursor-pointer text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center font-black text-sm text-white shadow-xs group-hover:scale-105 transition-transform">
              CL
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="text-base font-black tracking-tight text-slate-900 block leading-tight">
                  Campus<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Link</span>
                </span>
                {isVerified ? (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 border border-amber-300 shadow-2xs flex items-center space-x-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 fill-amber-300" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-200/60">
                    Vendor
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Vendor Portal</span>
            </div>
          </button>

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
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-slate-900 truncate">{vendorStore?.business_name || 'Vendor Store'}</span>
                  {isVerified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 fill-amber-300 shrink-0" title="Verified Campus Vendor" />
                  )}
                </div>
                {isVerified ? (
                  <span className="text-[10px] text-amber-700 font-bold flex items-center space-x-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-500" />
                    <span>Verified Vendor</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold flex items-center space-x-1 mt-0.5">
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
            {/* 1. Home & Feed */}
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'home' || activeTab === 'reels' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Home className="w-4 h-4" />
              <span>Home & Feed</span>
            </button>

            {/* 2. My Store & Services */}
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'inventory' || activeTab === 'services' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Store className="w-4 h-4" />
              <span>My Store & Items</span>
              <span className="ml-auto text-[10px] font-bold">{products.length + services.length}</span>
            </button>

            {/* 3. Campus Marketplace */}
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'marketplace' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Campus Marketplace</span>
            </button>

            {/* 4. Direct Messages */}
            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'messages' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Direct Messages</span>
              {totalUnreadChatCount > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-xs animate-pulse">
                  {totalUnreadChatCount}
                </span>
              )}
            </button>

            {/* 5. Campus Friends & Network */}
            <button
              onClick={() => setActiveTab('friends')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'friends' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Campus Network</span>
              {pendingRequests.length > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-xs">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            {/* 6. Notifications */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'notifications' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
              {unreadNotifCount > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-xs">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* 7. ID Verification */}
            <button
              onClick={() => setActiveTab('verification')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'verification' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ID & Verification</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <InstallAppButton variant="header" className="w-full justify-center" />
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full min-w-0 max-w-full flex flex-col min-h-0 h-full overflow-x-hidden overscroll-x-none ${activeTab === 'messages' ? 'overflow-hidden p-0' : 'overflow-y-auto p-0'}`}>

        {/* --- BESPOKE CAMPUS HEADER & MODERN CAPSULE NAVIGATION --- */}
        <div className={`sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs w-full ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'block'}`}>
          {/* Row 1: Brand & Top Utilities */}
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex items-center space-x-2 text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white font-black text-xs tracking-tight shadow-xs group-hover:scale-105 transition-transform">
                CL
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Campus<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Link</span>
                </span>
                {isVerified ? (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border border-amber-300 shadow-2xs inline-flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-slate-950 fill-amber-300" />
                    <span>Verified Vendor</span>
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200/60">
                    Vendor
                  </span>
                )}
                {(vendorStore?.university_abbr || vendorStore?.university_name) && (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
                    🎓 {(vendorStore?.university_abbr || vendorStore?.university_name).split(' ')[0]}
                  </span>
                )}
              </div>
            </button>

            <div className="flex items-center space-x-2">
              <div className="hidden xs:block">
                <InstallAppButton variant="header" />
              </div>

              {/* Notification Bell Button */}
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 relative cursor-pointer transition-all"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Profile / Menu Drawer Button */}
              <button
                type="button"
                onClick={() => setMenuDrawerOpen(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs overflow-hidden border border-slate-200/70 p-0.5"
                title="Menu & Profile"
                aria-label="Menu"
              >
                {user?.profile_picture_url || vendorStore?.logo ? (
                  <SafeImage
                    src={user?.profile_picture_url || vendorStore?.logo}
                    alt="Menu"
                    fallbackType="avatar"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-tr from-sky-400 to-blue-600 text-white font-black flex items-center justify-center text-xs">
                    {vendorStore?.business_name?.charAt(0) || user?.full_name?.charAt(0) || 'V'}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Modern Segmented Capsule Tabs (Desktop / Tablet: Home, My Store, Marketplace, Chats, Network, Notifications) */}
          <div className="hidden md:block px-2 sm:px-4 py-1.5 border-t border-slate-100 bg-white">
            <div className="flex items-center justify-between gap-1 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 shadow-2xs">
              {[
                { id: 'home', icon: Home, label: 'Home' },
                { id: 'inventory', icon: Store, label: 'My Store', badge: (products.length + services.length) },
                { id: 'marketplace', icon: ShoppingBag, label: 'Marketplace' },
                { id: 'messages', icon: MessageSquare, label: 'Chats', badge: totalUnreadChatCount },
                { id: 'friends', icon: Users, label: 'Network', badge: pendingRequests.length },
                { id: 'notifications', icon: Bell, label: 'Alerts', badge: unreadNotifCount }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id || (tab.id === 'home' && activeTab === 'reels') || (tab.id === 'inventory' && activeTab === 'services');
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      localStorage.setItem('campuslink_vendor_tab', tab.id);
                    }}
                    className={`flex-1 py-1.5 sm:py-2 flex items-center justify-center space-x-1.5 rounded-xl transition-all cursor-pointer relative ${isActive
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/60 font-medium'
                      }`}
                    title={tab.label}
                    aria-label={tab.label}
                  >
                    <div className="relative">
                      <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                      {tab.badge > 0 && (
                        <span className={`absolute -top-1.5 -right-2 text-white text-[9px] font-black min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs ${isActive ? 'bg-rose-500' : 'bg-rose-600'}`}>
                          {tab.badge > 15 ? '15+' : tab.badge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] hidden lg:inline tracking-tight ${isActive ? 'font-bold text-white' : 'text-slate-600'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <div className={`flex-1 w-full min-w-0 ${activeTab === 'messages' ? 'p-0 flex flex-col overflow-hidden min-h-0' : 'p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8'}`}>

          {/* Verification Alert Banner */}
          {!isVerified && !isStoreLoading && vendorStore && (
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
          {/* --- MERGED TAB: PRODUCTS & SERVICES CATALOG --- */}
          {/* ========================================================================= */}
          {(activeTab === 'inventory' || activeTab === 'services' || activeTab === 'catalog') && (
            <div className="space-y-4">
              {/* Marketplace-Style Header (Matching Student Marketplace) */}
              <div className="space-y-3 mb-2">
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('home')}
                      className="p-1.5 rounded-full hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Back to home"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900">Store Catalog & Services</h1>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setCatalogSearchOpen(prev => !prev)}
                      className="p-2 rounded-full hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Search catalog"
                    >
                      <Search className="w-5 h-5" />
                    </button>

                    <button
                      disabled={!isVerified}
                      onClick={catalogType === 'products' ? handleOpenAddProduct : () => setShowServiceModal(true)}
                      title={!isVerified ? 'Complete ID verification first' : ''}
                      className="px-3.5 sm:px-4 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold shadow-xs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden xs:inline">{catalogType === 'products' ? 'Add Product' : 'Add Service'}</span>
                      <span className="xs:hidden">Add</span>
                    </button>
                  </div>
                </div>

                {/* Mode Chips: Products, Services, Search */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogType('products');
                      setActiveTab('inventory');
                    }}
                    className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer shrink-0 ${catalogType === 'products'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                  >
                    Products ({products.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCatalogType('services');
                      setActiveTab('inventory');
                    }}
                    className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer shrink-0 ${catalogType === 'services'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                  >
                    Services ({services.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCatalogSearchOpen(prev => !prev)}
                    className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${catalogSearchOpen || catalogSearchQuery
                        ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </button>
                </div>

                {/* Search Bar (Expandable) */}
                {catalogSearchOpen && (
                  <div className="relative pt-1 animate-in fade-in duration-200">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Search ${catalogType} in your store...`}
                      value={catalogSearchQuery}
                      onChange={(e) => setCatalogSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                      autoFocus
                    />
                    {catalogSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCatalogSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Today's Picks / Status Sub-bar */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="font-extrabold text-sm sm:text-base text-slate-900">
                    {catalogType === 'products' ? `Products (${displayedProducts.length})` : `Services (${displayedServices.length})`}
                  </span>
                  <span className="text-xs text-sky-600 font-semibold flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>{vendorStore?.university_abbr || vendorStore?.university_name || 'Campus'} · Live</span>
                  </span>
                </div>
              </div>

              {/* Products Grid - Mobile 2-Column Responsive Layout Matching Student Marketplace */}
              {catalogType === 'products' && (
                displayedProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayedProducts.map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
                        <div>
                          {/* Aspect Ratio Container for Zero Cumulative Layout Shift */}
                          <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                            <SafeImage src={item.image} alt={item.name} fallbackType="product" showShimmer className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <span className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold text-sky-800 shadow-xs flex items-center space-x-1 border border-sky-100 max-w-[85%] truncate">
                              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-600 shrink-0" />
                              <span className="truncate">{item.university_abbr || item.university_name || vendorStore?.university_abbr || 'Campus'}</span>
                            </span>
                            <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-xs">
                              Qty: {item.quantity}
                            </span>
                          </div>

                          <div className="p-2.5 sm:p-4">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-sm sm:text-base font-black text-sky-700">
                                ₦{Number(item.price).toLocaleString()}
                              </span>
                              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                In Stock
                              </span>
                            </div>

                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{item.name}</h4>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-4 pt-0 flex items-center space-x-1.5 border-t border-slate-100 mt-2">
                          <button
                            onClick={() => handleOpenEditProduct(item)}
                            className="flex-1 py-1.5 sm:py-2 bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 font-bold text-[11px] sm:text-xs rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer"
                            title="Edit product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(item.id)}
                            className="p-1.5 sm:p-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Delete product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 sm:py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-10">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-800">
                      {catalogSearchQuery ? `No products match "${catalogSearchQuery}"` : 'Your store catalog is empty'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {catalogSearchQuery
                        ? 'Try different search keywords or clear the search filter.'
                        : isVerified
                          ? 'Add your products to start selling to students on campus.'
                          : 'Your store will be ready to list products once your ID or business document is approved by campus admins.'}
                    </p>
                    {isVerified && !catalogSearchQuery && (
                      <button
                        onClick={handleOpenAddProduct}
                        className="mt-4 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-full shadow-md cursor-pointer"
                      >
                        + Add Your First Product
                      </button>
                    )}
                  </div>
                )
              )}

              {/* Services Grid - Mobile 2-Column Responsive Layout */}
              {catalogType === 'services' && (
                displayedServices.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayedServices.map((svc) => (
                      <div key={svc.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
                        <div>
                          {/* Aspect Ratio Container */}
                          <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                            <SafeImage src={svc.image} alt={svc.name} fallbackType="product" showShimmer className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <span className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold text-sky-800 shadow-xs flex items-center space-x-1 border border-sky-100 max-w-[85%] truncate">
                              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-600 shrink-0" />
                              <span className="truncate">{svc.location || 'On Campus'}</span>
                            </span>
                            <span className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-xs">
                              Active
                            </span>
                          </div>

                          <div className="p-2.5 sm:p-4">
                            <span className="text-xs sm:text-sm font-black text-sky-700 block mb-1">
                              From ₦{Number(svc.price).toLocaleString()}
                            </span>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{svc.name}</h4>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-2">{svc.description}</p>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-4 pt-0 flex items-center justify-between border-t border-slate-100 mt-2">
                          <span className="text-[10px] text-slate-400 truncate">{svc.location || 'Campus'}</span>
                          <button
                            onClick={() => handleDeleteService(svc.id)}
                            className="p-1.5 sm:p-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Delete Service"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 sm:py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-10">
                    <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-800">
                      {catalogSearchQuery ? `No services match "${catalogSearchQuery}"` : 'No services listed yet'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {catalogSearchQuery ? 'Try another keyword or clear the search query.' : 'Offer laundry pickup, phone repair, styling or photography.'}
                    </p>
                    {isVerified && !catalogSearchQuery && (
                      <button
                        onClick={() => setShowServiceModal(true)}
                        className="mt-4 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-full shadow-md cursor-pointer"
                      >
                        + Add Your First Service
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* --- TAB: CAMPUS MARKETPLACE (EXPLORE ALL VENDORS & SERVICES) --- */}
          {/* ========================================================================= */}
          {activeTab === 'marketplace' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-sky-500 text-white flex items-center justify-center font-bold shadow-xs">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Campus Marketplace
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Discover products, student offerings & services across campus faculties.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Type Filter Buttons */}
                <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
                  {[
                    { id: 'all', label: 'All Listings' },
                    { id: 'products', label: 'Products' },
                    { id: 'services', label: 'Services' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMarketplaceType(t.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${marketplaceType === t.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search & Category Filter Bar */}
              <div className="space-y-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by product name, service, brand, or category..."
                    value={marketplaceSearchQuery}
                    onChange={(e) => setMarketplaceSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-400 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  />
                  {marketplaceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMarketplaceSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'all', label: 'All Categories' },
                    { id: 'food', label: 'Food & Meals' },
                    { id: 'fashion', label: 'Fashion & Wears' },
                    { id: 'tech', label: 'Laptops & Gadgets' },
                    { id: 'academic', label: 'Academic & Books' },
                    { id: 'services', label: 'Repairs & Services' },
                    { id: 'other', label: 'Other' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMarketplaceCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${marketplaceCategory === cat.id
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marketplace Listings Grid */}
              {(() => {
                const searchQ = marketplaceSearchQuery.toLowerCase().trim();
                const filteredProducts = (marketplaceProducts || []).filter(p => {
                  if (marketplaceType === 'services') return false;
                  if (marketplaceCategory !== 'all') {
                    const cName = (p.category_name || '').toLowerCase();
                    if (marketplaceCategory === 'food' && !cName.includes('food') && !cName.includes('meal')) return false;
                    if (marketplaceCategory === 'fashion' && !cName.includes('fashion') && !cName.includes('shoe') && !cName.includes('wear')) return false;
                    if (marketplaceCategory === 'tech' && !cName.includes('laptop') && !cName.includes('gadget') && !cName.includes('tech')) return false;
                    if (marketplaceCategory === 'academic' && !cName.includes('academic') && !cName.includes('book')) return false;
                    if (marketplaceCategory === 'services' && !cName.includes('service') && !cName.includes('clean')) return false;
                    if (marketplaceCategory === 'other' && (cName.includes('food') || cName.includes('fashion') || cName.includes('laptop') || cName.includes('academic') || cName.includes('service'))) return false;
                  }
                  if (!searchQ) return true;
                  return (
                    (p.name || '').toLowerCase().includes(searchQ) ||
                    (p.description || '').toLowerCase().includes(searchQ) ||
                    (p.vendor_name || '').toLowerCase().includes(searchQ) ||
                    (p.university_name || '').toLowerCase().includes(searchQ)
                  );
                });

                const filteredServices = (marketplaceServices || []).filter(s => {
                  if (marketplaceType === 'products') return false;
                  if (marketplaceCategory !== 'all') {
                    const cName = (s.category_name || '').toLowerCase();
                    if (marketplaceCategory === 'services' && !cName.includes('service') && !cName.includes('clean')) return true; // keep services
                    if (marketplaceCategory === 'food' && !cName.includes('food') && !cName.includes('meal')) return false;
                    if (marketplaceCategory === 'fashion' && !cName.includes('fashion') && !cName.includes('shoe') && !cName.includes('wear')) return false;
                    if (marketplaceCategory === 'tech' && !cName.includes('laptop') && !cName.includes('gadget') && !cName.includes('tech')) return false;
                    if (marketplaceCategory === 'academic' && !cName.includes('academic') && !cName.includes('book')) return false;
                    if (marketplaceCategory === 'other' && (cName.includes('food') || cName.includes('fashion') || cName.includes('laptop') || cName.includes('academic'))) return false;
                  }
                  if (!searchQ) return true;
                  return (
                    (s.name || '').toLowerCase().includes(searchQ) ||
                    (s.description || '').toLowerCase().includes(searchQ) ||
                    (s.location || '').toLowerCase().includes(searchQ) ||
                    (s.vendor_name || '').toLowerCase().includes(searchQ)
                  );
                });

                const totalItems = filteredProducts.length + filteredServices.length;

                if (totalItems === 0) {
                  return (
                    <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 space-y-3">
                      <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                      <h4 className="text-base font-bold text-slate-800">No items found in Marketplace</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Try clearing your search or switching categories to explore other student & vendor offerings.
                      </p>
                      {(marketplaceSearchQuery || marketplaceCategory !== 'all' || marketplaceType !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setMarketplaceSearchQuery('');
                            setMarketplaceCategory('all');
                            setMarketplaceType('all');
                          }}
                          className="px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Render Products */}
                    {filteredProducts.map((p) => {
                      const isFriendWithSeller = (myFriends || []).some(
                        f => String(f.user_id || f.id) === String(p.vendor_user_id || p.user_id)
                      );
                      const isOwnProduct = String(p.vendor_id) === String(vendorStore?.id) || String(p.user_id) === String(user?.user_id || user?.id);

                      return (
                        <div
                          key={`prod-${p.id}`}
                          className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-sky-200 transition-all flex flex-col group"
                        >
                          {/* Image Box */}
                          <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                            <SafeImage
                              src={p.image}
                              alt={p.name}
                              fallbackType="product"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-lg">
                              Product
                            </span>
                            {p.quantity <= 0 && (
                              <span className="absolute top-2 right-2 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-xs">
                                Sold Out
                              </span>
                            )}
                          </div>

                          {/* Info Area */}
                          <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2">
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-sky-600 truncate uppercase">
                                  {p.category_name || 'Retail'}
                                </span>
                                {(p.university_name || p.dispatch_location) && (
                                  <span className="text-[9px] text-slate-400 truncate max-w-[90px]">
                                    {p.university_name || p.dispatch_location}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 mt-0.5 group-hover:text-sky-600 transition-colors">
                                {p.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                {p.description || 'Quality product listed on campus marketplace.'}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              {/* Price and Seller Badge */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm sm:text-base font-black text-slate-900">
                                  ₦{Number(p.price || 0).toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(p.vendor_user_id || p.user_id)}
                                  className="text-[10px] font-bold text-slate-600 hover:text-sky-600 flex items-center space-x-1 truncate max-w-[120px] cursor-pointer"
                                  title={p.vendor_name || 'Vendor Profile'}
                                >
                                  <span className="truncate">{p.vendor_name || 'Vendor'}</span>
                                  {p.is_vendor_verified && (
                                    <Award className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" title="Verified Vendor" />
                                  )}
                                </button>
                              </div>

                              {/* Action Buttons */}
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(p.vendor_user_id || p.user_id)}
                                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-colors"
                                >
                                  Profile
                                </button>
                                {isOwnProduct ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTab('inventory');
                                      handleOpenEditProduct(p);
                                    }}
                                    className="py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-colors"
                                  >
                                    Manage
                                  </button>
                                ) : isFriendWithSeller ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sid = p.vendor_user_id || p.user_id;
                                      setSelectedPartner({ partner_id: sid, partner_name: p.vendor_name, role: 'vendor' });
                                      setActiveTab('messages');
                                      handleSelectPartner({ partner_id: sid, partner_name: p.vendor_name, role: 'vendor' });
                                    }}
                                    className="py-1.5 px-2 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl text-center cursor-pointer shadow-xs transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>Chat</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSendFriendRequest(p.vendor_user_id || p.user_id)}
                                    className="py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    <span>Connect</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render Services */}
                    {filteredServices.map((s) => {
                      const isFriendWithSeller = (myFriends || []).some(
                        f => String(f.user_id || f.id) === String(s.user_id)
                      );
                      const isOwnService = String(s.user_id) === String(user?.user_id || user?.id);

                      return (
                        <div
                          key={`svc-${s.id}`}
                          className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col group"
                        >
                          {/* Image Box */}
                          <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                            <SafeImage
                              src={s.image}
                              alt={s.name}
                              fallbackType="product"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-2 left-2 bg-emerald-700 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-xs">
                              Service
                            </span>
                            {s.location && (
                              <span className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[100px]">{s.location}</span>
                              </span>
                            )}
                          </div>

                          {/* Info Area */}
                          <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2">
                            <div>
                              <span className="text-[10px] font-bold text-emerald-600 truncate uppercase block">
                                {s.category_name || 'Campus Service'}
                              </span>
                              <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 mt-0.5 group-hover:text-emerald-700 transition-colors">
                                {s.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                {s.description || 'Professional student/vendor service on campus.'}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              {/* Price and Provider Badge */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-[9px] text-slate-400 block font-semibold">Starts at</span>
                                  <span className="text-sm sm:text-base font-black text-emerald-700">
                                    ₦{Number(s.price || 0).toLocaleString()}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(s.user_id)}
                                  className="text-[10px] font-bold text-slate-600 hover:text-emerald-600 flex items-center space-x-1 truncate max-w-[120px] cursor-pointer"
                                  title={s.vendor_name || 'Provider Profile'}
                                >
                                  <span className="truncate">{s.vendor_name || 'Provider'}</span>
                                </button>
                              </div>

                              {/* Action Buttons */}
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(s.user_id)}
                                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-colors"
                                >
                                  Profile
                                </button>
                                {isOwnService ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTab('inventory');
                                    }}
                                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-colors"
                                  >
                                    Manage
                                  </button>
                                ) : isFriendWithSeller ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sid = s.user_id;
                                      setSelectedPartner({ partner_id: sid, partner_name: s.vendor_name, role: 'vendor' });
                                      setActiveTab('messages');
                                      handleSelectPartner({ partner_id: sid, partner_name: s.vendor_name, role: 'vendor' });
                                    }}
                                    className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl text-center cursor-pointer shadow-xs transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>Chat</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSendFriendRequest(s.user_id)}
                                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    <span>Connect</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* --- TAB: NOTIFICATIONS & ALERTS --- */}
          {/* ========================================================================= */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-sky-500/20">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Notifications
                      </h1>
                      {unreadNotifCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-xs animate-pulse">
                          {unreadNotifCount} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Friend requests, store updates, peer interactions & system alerts.
                    </p>
                  </div>
                </div>

                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="px-4 py-2 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
                  >
                    <CheckCheck className="w-4 h-4 text-sky-600" />
                    <span>Mark all as read</span>
                  </button>
                )}
              </div>

              {/* Notification Filter Chips */}
              <div className="flex items-center space-x-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto">
                {[
                  { id: 'all', label: 'All Notifications' },
                  { id: 'unread', label: `Unread (${unreadNotifCount})` },
                  { id: 'social', label: 'Requests & Friends' },
                  { id: 'store', label: 'Store & Verification' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setNotifFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${notifFilter === f.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Notifications List */}
              {(() => {
                const filteredList = (notifications || []).filter(n => {
                  if (notifFilter === 'unread') return !n.is_read;
                  if (notifFilter === 'social') return n.type === 'friend_request' || n.type === 'friend_accept' || n.type === 'like' || n.type === 'comment';
                  if (notifFilter === 'store') return n.type === 'verification' || n.type === 'product' || n.type === 'order' || n.type === 'system';
                  return true;
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 space-y-3">
                      <BellOff className="w-12 h-12 text-slate-300 mx-auto" />
                      <h4 className="text-base font-bold text-slate-800">No notifications found</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {notifFilter === 'unread'
                          ? "You're all caught up! No unread notifications right now."
                          : "You don't have any notifications in this category yet."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {filteredList.map((notif) => {
                      const isUnread = !notif.is_read;
                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer flex items-start space-x-3.5 ${isUnread
                              ? 'bg-sky-50/70 border-sky-200 hover:border-sky-300 shadow-xs'
                              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                        >
                          {/* Left Icon / Avatar */}
                          <div className="relative shrink-0 mt-0.5">
                            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden flex items-center justify-center font-bold text-sky-700">
                              {notif.sender_avatar ? (
                                <SafeImage src={notif.sender_avatar} alt="Avatar" fallbackType="avatar" className="w-full h-full object-cover" />
                              ) : notif.type === 'friend_request' || notif.type === 'friend_accept' ? (
                                <UserPlus className="w-5 h-5 text-sky-600" />
                              ) : notif.type === 'like' ? (
                                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                              ) : notif.type === 'verification' ? (
                                <ShieldCheck className="w-5 h-5 text-amber-500" />
                              ) : (
                                <Bell className="w-5 h-5 text-indigo-600" />
                              )}
                            </div>
                            {isUnread && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-sky-500 border-2 border-white rounded-full shadow-xs" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className={`text-xs sm:text-sm font-bold truncate ${isUnread ? 'text-slate-900' : 'text-slate-800'}`}>
                                {notif.title || (notif.type === 'friend_request' ? 'New Friend Request' : 'Campus Alert')}
                              </h4>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                              {notif.message || notif.content || 'Tap to view details'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* --- TAB 3: CUSTOMER CHATS & INQUIRIES --- */}
          {/* ========================================================================= */}
          {activeTab === 'messages' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">

              {/* Header */}
              <div className={`p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Campus Chats</h2>
                    {conversations.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        {conversations.length}
                      </span>
                    )}
                    {totalUnreadChatCount > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                        {totalUnreadChatCount} new
                      </span>
                    )}
                  </div>
                </div>

                {selectedPartner && (
                  <div className="flex items-center space-x-2 text-xs">
                    {selectedPartner.is_ai ? (
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">CampusLink AI Copilot</span>
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
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800">{selectedPartner.partner_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                          {selectedPartner.role === 'vendor' ? 'Vendor' : 'Student'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Active Inquiries & Chat Interface */}
              <div className={`flex flex-col md:flex-row bg-white border border-slate-200 overflow-hidden shadow-xs flex-1 min-h-0 ${selectedPartner ? 'rounded-2xl md:rounded-3xl' : 'rounded-3xl'}`}>

                {/* Conversations List */}
                <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0 bg-white ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
                  {/* Universal Chat & Directory Search */}
                  <div className="p-2.5 border-b border-slate-100 bg-white">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search chats or friends..."
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        className="w-full pl-8.5 pr-7 py-1.5 bg-slate-100/90 focus:bg-white border border-transparent focus:border-sky-400 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                      />
                      {chatSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setChatSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {/* PINNED: CampusLink AI Copilot */}
                    <div className="p-2 border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-white">
                      <button
                        type="button"
                        onClick={handleSelectAiCopilot}
                        className={`w-full p-2.5 rounded-2xl text-left flex items-start space-x-3 transition-all cursor-pointer ${(selectedPartner?.is_ai || selectedPartner?.partner_id === 'campus_ai')
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                            : 'hover:bg-blue-50/80 border border-blue-100/80'
                          }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${(selectedPartner?.is_ai || selectedPartner?.partner_id === 'campus_ai')
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-600 text-white shadow-xs'
                          }`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black truncate ${(selectedPartner?.is_ai || selectedPartner?.partner_id === 'campus_ai') ? 'text-white' : 'text-slate-900'
                              }`}>
                              AI Business Copilot
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${(selectedPartner?.is_ai || selectedPartner?.partner_id === 'campus_ai')
                                ? 'bg-white/25 text-white'
                                : 'bg-blue-100 text-blue-700'
                              }`}>
                              24/7 AI
                            </span>
                          </div>
                          <p className={`text-[11px] truncate mt-0.5 ${(selectedPartner?.is_ai || selectedPartner?.partner_id === 'campus_ai') ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                            {aiMessages.length > 0
                              ? (aiMessages[aiMessages.length - 1].content || 'Chat with your AI copilot')
                              : 'Draft replies, promos, grammar & math'}
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Section: Active Conversations */}
                    {filteredConversations.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Recent Chats</span>
                          <span className="font-bold text-sky-600">({filteredConversations.length})</span>
                        </div>
                        {filteredConversations.map((c) => {
                          const pid = c.partner_id || c.user_id || c.id;
                          const partnerStoryIdx = statusGroups.findIndex(g => String(g.user_id) === String(pid));
                          const hasStory = partnerStoryIdx !== -1;
                          const storyGroup = hasStory ? statusGroups[partnerStoryIdx] : null;
                          const hasUnviewedStory = hasStory && (storyGroup.has_unviewed !== false && !storyGroup.all_viewed);
                          const isSelected = !selectedPartner?.is_ai && selectedPartner?.partner_id !== 'campus_ai' && String(selectedPartner?.partner_id) === String(pid);

                          return (
                            <button
                              key={pid}
                              type="button"
                              onClick={() => handleSelectPartner(c)}
                              className={`w-full p-3.5 text-left flex items-start space-x-3 transition-all active:scale-[0.99] cursor-pointer ${isSelected ? 'bg-sky-50/80 border-l-4 border-sky-500' : 'hover:bg-slate-50'
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
                                className={`relative shrink-0 rounded-2xl transition-all ${hasStory
                                    ? `p-0.5 cursor-pointer ${hasUnviewedStory
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
                                    if (!c.last_message) return 'Say hello...';
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
                      </div>
                    )}

                    {/* Section: Connected Friends to Message */}
                    {availableCommunityToChat.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-slate-50 border-y border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>{chatSearchQuery ? 'Matching Friends' : 'Connected Friends'}</span>
                          <span className="font-bold text-sky-600">({availableCommunityToChat.length})</span>
                        </div>
                        {availableCommunityToChat.map((s) => {
                          const sid = s.user_id || s.id;
                          const isSelected = !selectedPartner?.is_ai && selectedPartner?.partner_id !== 'campus_ai' && String(selectedPartner?.partner_id) === String(sid);
                          return (
                            <button
                              key={sid}
                              onClick={() => handleSelectPartner({
                                partner_id: sid,
                                partner_name: s.full_name || s.name || 'Friend',
                                partner_avatar: s.profile_picture_url || s.avatar_url,
                                role: s.role || (s.is_vendor ? 'vendor' : 'student'),
                                partner_phone: s.phone_number,
                                department: s.department,
                                university_name: s.university_name,
                                is_friend: true
                              })}
                              className={`w-full p-3 sm:p-3.5 text-left flex items-start space-x-3 transition-colors cursor-pointer ${isSelected ? 'bg-sky-50/80 border-l-4 border-sky-500' : 'hover:bg-slate-50'
                                }`}
                            >
                              <div className="relative shrink-0">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-sky-100 flex items-center justify-center">
                                  {s.profile_picture_url ? (
                                    <SafeImage src={s.profile_picture_url} alt={s.full_name} fallbackType="avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center">
                                      {s.full_name?.charAt(0) || 'U'}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-900 truncate">{s.full_name}</span>
                                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                    {s.role || (s.is_vendor ? 'Vendor' : 'Student')}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {s.department || s.university_name || 'Tap to message friend'}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {filteredConversations.length === 0 && availableCommunityToChat.length === 0 && (
                      <div className="p-6 text-center text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold text-slate-500">No matching chats</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Try searching with a different term.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat Panel */}
                <div className={`flex-1 min-h-0 flex flex-col justify-between bg-slate-50/50 overflow-hidden ${selectedPartner ? 'flex' : 'hidden md:flex'}`}>
                  {selectedPartner ? (
                    (selectedPartner.is_ai || selectedPartner.partner_id === 'campus_ai') ? (
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
                        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto overflow-x-hidden w-full max-w-full space-y-3 chat-thread-container">
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
                                  className={`chat-bubble-tactile max-w-[85%] sm:max-w-[75%] p-3 sm:p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-xs ${msg.sender === 'user'
                                      ? 'bg-blue-600 text-white rounded-br-xs'
                                      : 'bg-white border border-slate-200/80 text-slate-900 rounded-bl-xs'
                                    }`}
                                >
                                  {msg.sender === 'user' ? (
                                    <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                                  ) : (
                                    <MarkdownRenderer content={msg.content} />
                                  )}
                                  <span className={`float-right mt-1 ml-2 text-[10px] leading-none select-none font-medium ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
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
                          <div ref={aiMessagesEndRef} />
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
                                  className={`relative shrink-0 rounded-2xl transition-all cursor-pointer ${hasStory
                                      ? `p-0.5 ${hasUnviewedStory
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
                        <div ref={chatContainerRef} className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto overflow-x-hidden w-full max-w-full space-y-2.5 chat-thread-container">
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
                              const currentUserIdStr = String(user?.user_id || user?.id || vendorStore?.user_id || '');
                              const isMine = Boolean(currentUserIdStr && msg.sender_id && (
                                String(msg.sender_id) === currentUserIdStr ||
                                (vendorStore?.id && String(msg.sender_id) === String(vendorStore.id))
                              ));
                              const isStatusReply = msg.message_type === 'status_reply' || (typeof msg.content === 'string' && (msg.content.includes('"type":"status_reply"') || msg.content.startsWith('Replying to') || msg.content.startsWith('Reacted ')));
                              const statusData = isStatusReply ? parseStatusReply(msg.content) : null;
                              const chatReply = parseChatReply(msg);
                              const isHighlighted = highlightedMessageId === msg.id || String(highlightedMessageId) === String(msg.id);
                              const rawMsgText = msg.content || msg.text || '';
                              const isPopoverOpen = Boolean(activePopoverMsgId && String(activePopoverMsgId) === String(msg.id));

                              return (
                                <div
                                  key={msg.id || idx}
                                  id={`chat-msg-${msg.id}`}
                                  data-msg-id={msg.id}
                                  className="w-full"
                                >
                                  <SwipeableMessageBubble
                                    message={msg}
                                    isMine={isMine}
                                    onSwipeReply={() => handleStartReply(msg)}
                                    onReply={() => handleStartReply(msg)}
                                  >
                                    <div
                                      onClick={() => setActionModalMsg(msg)}
                                      onTouchStart={() => {
                                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = setTimeout(() => {
                                          setActionModalMsg(msg);
                                          try { if (navigator.vibrate) navigator.vibrate(25); } catch { }
                                        }, 400);
                                      }}
                                      onTouchEnd={() => {
                                        if (longPressTimerRef.current) {
                                          clearTimeout(longPressTimerRef.current);
                                          longPressTimerRef.current = null;
                                        }
                                      }}
                                      onTouchCancel={() => {
                                        if (longPressTimerRef.current) {
                                          clearTimeout(longPressTimerRef.current);
                                          longPressTimerRef.current = null;
                                        }
                                      }}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        setActionModalMsg(msg);
                                      }}
                                      className={`relative max-w-[82%] sm:max-w-[70%] w-fit flex flex-col ${isMine ? 'items-end' : 'items-start'} cursor-pointer active:scale-[0.99] transition-transform select-none group/bubble`}
                                    >

                                      {/* Main Message Bubble */}
                                      <div
                                        className={`w-fit max-w-full px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-xs text-xs sm:text-[13px] leading-relaxed break-words relative chat-bubble-tactile ${msg.reactions ? 'mb-2.5' : ''
                                          } ${isHighlighted ? 'ring-4 ring-blue-400 ring-offset-2 scale-[1.02] shadow-lg shadow-blue-500/25 z-20' : ''
                                          } ${isMine
                                            ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-2xl rounded-tl-sm'
                                          }`}
                                      >
                                        {/* Quoted Message Preview Box (if replying) */}
                                        {(msg.reply_to_text || msg.reply_to_sender || chatReply) && (
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const targetId = msg.reply_to_id || chatReply?.replyToId;
                                              if (targetId) {
                                                handleScrollToQuotedMessage(targetId);
                                              }
                                            }}
                                            className={`w-full p-1.5 px-2 rounded mb-1 text-xs border-l-[3px] select-none cursor-pointer transition-all hover:opacity-90 ${isMine
                                                ? 'bg-black/15 border-white text-white'
                                                : 'bg-slate-100 dark:bg-slate-700/60 border-blue-600 text-slate-800 dark:text-slate-200'
                                              }`}
                                            title="Click to jump to original message"
                                          >
                                            <p className="font-bold text-[11px] truncate">{msg.reply_to_sender || chatReply?.replyToSender || 'Customer'}</p>
                                            <p className="truncate max-w-[220px] text-[11px] opacity-85">{getDisplayContent(msg.reply_to_text || chatReply?.replyToText || 'Original message')}</p>
                                          </div>
                                        )}

                                        {/* Bubble Body Content */}
                                        {chatReply ? (
                                          <p className="whitespace-pre-wrap break-words">{getDisplayContent(chatReply.text)}</p>
                                        ) : (isStatusReply && statusData) || parseStatusReply(msg) ? (
                                          <StoryReplyBubble statusData={statusData || parseStatusReply(msg)} msg={msg} isMine={isMine} />
                                        ) : isStatusReplyContent(msg.content) ? (
                                          <div className="space-y-1">
                                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold mb-0.5 ${isMine ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                              }`}>
                                              <span>📷 Replying to status</span>
                                            </div>
                                            <p className="whitespace-pre-wrap break-words">{getDisplayContent(msg.content)}</p>
                                          </div>
                                        ) : (msg.message_type === 'image' || msg.message_type === 'images' || msg.message_type === 'video' || (msg.media_url && !msg.message_type)) ? (
                                          <div className="space-y-1.5">
                                            <ChatMediaGallery
                                              mediaUrl={msg.media_url}
                                              messageType={msg.message_type}
                                              onImageClick={(url) => window.open(getMediaUrl(url), '_blank')}
                                            />
                                            {msg.content && !['Photo', 'Video', 'image', 'images'].includes(msg.content) && (
                                              <p className="whitespace-pre-wrap break-words">{getDisplayContent(msg.content)}</p>
                                            )}
                                          </div>
                                        ) : msg.message_type === 'audio' ? (
                                          <div className="flex items-center space-x-3 py-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayAudio(msg.id, msg.media_url);
                                              }}
                                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${isMine ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                }`}
                                            >
                                              {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                            </button>
                                            <div>
                                              <div className="flex items-center space-x-1 mb-1">
                                                {[4, 8, 14, 18, 10, 16, 8, 12, 14, 10, 6, 12, 8].map((h, i) => (
                                                  <span
                                                    key={i}
                                                    className={`w-1 rounded-full transition-all ${playingAudioId === msg.id
                                                        ? 'animate-pulse bg-emerald-400'
                                                        : isMine
                                                          ? 'bg-blue-200'
                                                          : 'bg-slate-300'
                                                      }`}
                                                    style={{ height: `${h}px` }}
                                                  />
                                                ))}
                                              </div>
                                              <span className={`text-[10px] font-semibold ${isMine ? 'text-blue-100' : 'text-slate-500'}`}>
                                                🎤 Voice Note ({msg.duration ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, '0')}` : '0:15'})
                                              </span>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="leading-relaxed whitespace-pre-wrap">{getDisplayContent(rawMsgText)}</p>
                                        )}

                                        {/* Inline Timestamp & Delivery Tick (WhatsApp Double Blue Ticks) */}
                                        <div className={`text-[10px] mt-1 float-right ml-2 inline-flex items-center gap-1 select-none opacity-85 ${isMine ? 'text-blue-100' : 'text-slate-400'
                                          }`}>
                                          <span>{safeTime(msg.created_at, 'Now')}</span>
                                          {msg.is_edited && <span className="italic text-[9px] opacity-70">edited</span>}
                                          {isMine && (
                                            <span className="inline-flex items-center ml-0.5" title={msg.is_optimistic ? 'Sending...' : msg.is_read ? 'Read / Viewed' : 'Delivered'}>
                                              {msg.is_optimistic ? (
                                                <Clock className="w-2.5 h-2.5 opacity-70 animate-pulse text-white" />
                                              ) : msg.is_read ? (
                                                <span className="inline-flex items-center text-cyan-300 drop-shadow-[0_0_2px_rgba(103,232,249,0.9)]">
                                                  <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </span>
                                              ) : (
                                                <CheckCheck className="w-3 h-3 text-white/50" />
                                              )}
                                            </span>
                                          )}
                                        </div>

                                        {/* WhatsApp Reaction Pill Badge */}
                                        {msg.reactions && (() => {
                                          let rObj = {};
                                          try {
                                            rObj = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions || {});
                                            if (typeof rObj !== 'object' || rObj === null) rObj = {};
                                          } catch {
                                            if (typeof msg.reactions === 'string' && msg.reactions.length <= 4) rObj = { d: msg.reactions };
                                          }
                                          const emojis = Object.values(rObj || {});
                                          if (!emojis.length) return null;
                                          const uniqueEmojis = Array.from(new Set(emojis));
                                          return (
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionModalMsg(msg);
                                              }}
                                              className={`absolute -bottom-3 ${isMine ? 'right-2' : 'left-2'
                                                } z-20 flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-md rounded-full text-xs font-medium cursor-pointer hover:scale-110 active:scale-95 transition-all select-none`}
                                              title={`Reactions: ${emojis.join(' ')}`}
                                            >
                                              <span className="text-[13px] leading-none">{uniqueEmojis.slice(0, 3).join('')}</span>
                                              {emojis.length > 1 && (
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-0.5">
                                                  {emojis.length}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
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
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Direct Messaging Area (Only if connected friends or AI) */}
                        {(() => {
                          const isConnectedFriend = Boolean(
                            selectedPartner?.is_ai ||
                            selectedPartner?.partner_id === 'campus_ai' ||
                            (myFriends || []).some(f => String(f.user_id || f.id) === String(selectedPartner?.partner_id || selectedPartner?.user_id || selectedPartner?.id)) ||
                            selectedPartner?.is_friend === true
                          );

                          if (!isConnectedFriend) {
                            return (
                              <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-200 text-center space-y-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                                  <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Direct Messaging Locked</h4>
                                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                                    You and {selectedPartner.partner_name} are not connected as friends yet. You can view their profile or send a friend request to unlock direct chatting.
                                  </p>
                                </div>
                                <div className="flex items-center justify-center space-x-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenProfile(selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                                  >
                                    View Profile
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSendFriendRequest(selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id)}
                                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors flex items-center space-x-1.5"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Send Friend Request</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <>
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

                                {/* Quoted Edit-Message Banner */}
                                {editingMessage && (
                                  <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-2xl mb-2 text-xs shadow-2xs">
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className="w-1 h-7 rounded-full bg-amber-500 shrink-0" />
                                      <div className="min-w-0">
                                        <div className="flex items-center space-x-1 text-amber-800 font-bold text-[11px]">
                                          <Edit3 className="w-3 h-3" />
                                          <span>Editing Sent Message</span>
                                        </div>
                                        <p className="text-slate-600 truncate text-[11px]">
                                          {editingMessage.content}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditMessage}
                                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer shrink-0 ml-2"
                                      title="Cancel editing"
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
                                              try { URL.revokeObjectURL(f.previewUrl); } catch { }
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

                                {isRecordingAudio ? (
                                  <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-2xl animate-pulse">
                                    <div className="flex items-center space-x-2.5">
                                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                                      <Mic className="w-4 h-4 text-rose-600" />
                                      <span className="text-xs font-bold text-rose-700">
                                        Recording VN: {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
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
                                      ref={chatInputRef}
                                      rows={1}
                                      placeholder={editingMessage ? 'Edit your message...' : replyingToMessage ? `Replying to ${replyingToMessage.sender_name}...` : `Message ${selectedPartner.partner_name}...`}
                                      value={newMsgText}
                                      onChange={(e) => {
                                        setNewMsgText(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                                      }}
                                      onKeyDown={(e) => {
                                        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                                        if (e.key === 'Enter') {
                                          if (isTouch) return;
                                          if (e.shiftKey || e.altKey) return;
                                          e.preventDefault();
                                          if (newMsgText.trim() || pendingMediaFiles.length > 0) {
                                            handleSendChatMessage();
                                          }
                                        }
                                      }}
                                      className={`flex-1 min-h-[44px] max-h-36 overflow-y-auto p-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none resize-none leading-relaxed transition-colors ${editingMessage ? 'border-amber-400 focus:border-amber-500 bg-amber-50/40' : 'border-slate-200 focus:border-blue-500 focus:bg-white'
                                        }`}
                                    />
                                    {!editingMessage && (
                                      <button
                                        type="button"
                                        onClick={handleStartRecordingAudio}
                                        className="w-11 h-11 bg-slate-100 hover:bg-emerald-50 active:scale-95 text-slate-600 hover:text-emerald-600 rounded-xl cursor-pointer transition-all shrink-0 flex items-center justify-center mb-0.5"
                                        title="Record Voice Note"
                                      >
                                        <Mic className="w-5 h-5" />
                                      </button>
                                    )}
                                    <button
                                      type="submit"
                                      disabled={!newMsgText.trim() && pendingMediaFiles.length === 0}
                                      className={`w-11 h-11 text-white rounded-xl cursor-pointer disabled:opacity-40 transition-all shrink-0 flex items-center justify-center shadow-xs mb-0.5 active:scale-95 ${editingMessage ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                      title={editingMessage ? 'Save edited message' : 'Send message'}
                                    >
                                      {editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                                    </button>
                                  </form>
                                )}
                              </div>
                            </>
                          );
                        })()}

                        {/* WhatsApp-Style Message Options Bottom Sheet / Modal */}
                        {actionModalMsg && (
                          <div
                            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
                            onClick={() => setActionModalMsg(null)}
                          >
                            <div
                              className="w-full sm:max-w-xs bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* WhatsApp Quick Reactions Bar */}
                              <div className="flex items-center justify-around py-3 px-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                                {['❤️', '👍', '😂', '🔥', '👏', '🙏'].map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      const m = actionModalMsg;
                                      setActionModalMsg(null);
                                      handleReactToMessage(m, emoji);
                                    }}
                                    className="text-2xl hover:scale-130 active:scale-95 transition-transform p-1 cursor-pointer leading-none"
                                    title={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>

                              {/* Message Quote Preview Snippet */}
                              <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400 truncate border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                <span className="truncate italic">
                                  "{typeof actionModalMsg.content === 'string' ? actionModalMsg.content.slice(0, 75) : (actionModalMsg.text || 'Attachment')}"
                                </span>
                              </div>

                              {/* WhatsApp Options Menu */}
                              <div className="p-2 space-y-1">
                                {/* Reply */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const m = actionModalMsg;
                                    setActionModalMsg(null);
                                    handleStartReply(m);
                                  }}
                                  className="w-full flex items-center space-x-3 px-3.5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer active:scale-98"
                                >
                                  <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center shrink-0">
                                    <Reply className="w-4 h-4" />
                                  </div>
                                  <span>Reply</span>
                                </button>

                                {/* Copy Text */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const m = actionModalMsg;
                                    setActionModalMsg(null);
                                    handleCopyMessageText(m);
                                  }}
                                  className="w-full flex items-center space-x-3 px-3.5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer active:scale-98"
                                >
                                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Copy className="w-4 h-4" />
                                  </div>
                                  <span>Copy Text</span>
                                </button>

                                {/* Edit Message (Only for own messages, non-audio) */}
                                {(() => {
                                  const currentUserIdStr = String(user?.user_id || user?.id || vendorStore?.user_id || '');
                                  const isMine = Boolean(currentUserIdStr && actionModalMsg.sender_id && (
                                    String(actionModalMsg.sender_id) === currentUserIdStr ||
                                    (vendorStore?.id && String(actionModalMsg.sender_id) === String(vendorStore.id))
                                  ));
                                  if (isMine && actionModalMsg.message_type !== 'audio') {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const m = actionModalMsg;
                                          setActionModalMsg(null);
                                          handleStartEditMessage(m);
                                        }}
                                        className="w-full flex items-center space-x-3 px-3.5 py-3 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-2xl transition-colors cursor-pointer active:scale-98"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                                          <Edit3 className="w-4 h-4" />
                                        </div>
                                        <span>Edit Message</span>
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Delete Message (Only for own messages) */}
                                {(() => {
                                  const currentUserIdStr = String(user?.user_id || user?.id || vendorStore?.user_id || '');
                                  const isMine = Boolean(currentUserIdStr && actionModalMsg.sender_id && (
                                    String(actionModalMsg.sender_id) === currentUserIdStr ||
                                    (vendorStore?.id && String(actionModalMsg.sender_id) === String(vendorStore.id))
                                  ));
                                  if (isMine) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const id = actionModalMsg.id;
                                          setActionModalMsg(null);
                                          handleDeleteMessage(id);
                                        }}
                                        className="w-full flex items-center space-x-3 px-3.5 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-colors cursor-pointer active:scale-98"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                                          <Trash2 className="w-4 h-4" />
                                        </div>
                                        <span>Delete Message</span>
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              {/* Cancel button */}
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setActionModalMsg(null)}
                                  className="w-full py-2.5 text-center text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* --- DEDICATED TAB: CAMPUS NETWORK & FRIENDS --- */}
          {/* ========================================================================= */}
          {activeTab === 'friends' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Campus Network & Friends
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Connect with returning student buyers, fellow campus merchants & creative peers.
                  </p>
                </div>

                {/* Subtabs Filter Pills */}
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setFriendsTabFilter('find')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${friendsTabFilter === 'find'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Find Peers</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFriendsTabFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${friendsTabFilter === 'all'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Requests</span>
                    {pendingRequests.length > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${friendsTabFilter === 'all' ? 'bg-white text-sky-600' : 'bg-rose-500 text-white animate-pulse'
                        }`}>
                        {pendingRequests.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFriendsTabFilter('friends')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${friendsTabFilter === 'friends'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Your Friends ({friendsList.length})</span>
                  </button>
                </div>
              </div>

              {/* View 1: Friend Requests */}
              {friendsTabFilter === 'all' && (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900">Incoming Friend Requests</h3>
                      <p className="text-xs text-slate-500">Students and merchants who requested to connect with your store network.</p>
                    </div>
                    {pendingRequests.length > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        {pendingRequests.length} Pending
                      </span>
                    )}
                  </div>

                  {pendingRequests.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between space-x-3 hover:border-sky-200 transition-all">
                          <div
                            onClick={() => handleOpenProfile(req.sender_id || req.user_id)}
                            className="flex items-center space-x-3 overflow-hidden cursor-pointer group flex-1 min-w-0"
                          >
                            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0">
                              {req.sender_name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors truncate">{req.sender_name}</h4>
                              <p className="text-[10px] text-slate-500 truncate">{req.sender_department || 'Campus Student'}</p>
                              <span className="text-[9px] text-slate-400 block truncate">{req.sender_hostel || 'Hostel Resident'}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAcceptFriendRequest(req.id)}
                              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl cursor-pointer active:scale-95 transition-transform"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineFriendRequest(req.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                              title="Decline"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-14 text-center text-xs text-slate-400 space-y-2">
                      <UserCheck className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">No pending friend requests right now.</p>
                      <p className="text-slate-400">When students or peers send you requests, they will show up here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Connected Friends */}
              {friendsTabFilter === 'friends' && (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900">Connected Campus Friends</h3>
                      <p className="text-xs text-slate-500">Your network of student buyers, loyal patrons & business peers.</p>
                    </div>
                    <span className="text-xs font-bold bg-sky-50 text-sky-700 px-3 py-1 rounded-full border border-sky-200">
                      {friendsList.length} Connected
                    </span>
                  </div>

                  {friendsList.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {friendsList.map((f) => {
                        const fid = f.user_id || f.id;
                        return (
                          <div key={fid} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between space-x-3 hover:border-emerald-200 transition-all">
                            <div
                              onClick={() => handleOpenProfile(fid)}
                              className="flex items-center space-x-3 overflow-hidden cursor-pointer group flex-1 min-w-0"
                            >
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 overflow-hidden">
                                {f.profile_picture_url ? (
                                  <SafeImage src={f.profile_picture_url} alt="Pic" fallbackType="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  f.full_name?.charAt(0) || 'F'
                                )}
                              </div>
                              <div className="overflow-hidden min-w-0">
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
                                type="button"
                                onClick={() => {
                                  setSelectedPartner({ partner_id: fid, partner_name: f.full_name, role: f.role });
                                  setActiveTab('messages');
                                  handleSelectPartner({ partner_id: fid, partner_name: f.full_name, role: f.role });
                                }}
                                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl cursor-pointer flex items-center space-x-1 active:scale-95 transition-transform"
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
                                type="button"
                                onClick={() => handleRemoveFriend(fid)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
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
                    <div className="py-14 text-center text-xs text-slate-400 space-y-2">
                      <Users className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">You haven't connected with any campus friends yet.</p>
                      <button
                        type="button"
                        onClick={() => setFriendsTabFilter('find')}
                        className="mt-2 text-sky-600 font-bold hover:underline cursor-pointer"
                      >
                        Find and connect with students on campus now →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* View 3: Campus Directory (Find Peers) */}
              {friendsTabFilter === 'find' && (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900">Campus Directory</h3>
                      <p className="text-xs text-slate-500">Discover and network with students, campus creators & fellow merchants.</p>
                    </div>

                    <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setCommunityRoleFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${communityRoleFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommunityRoleFilter('student')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${communityRoleFilter === 'student' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Students
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommunityRoleFilter('vendor')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${communityRoleFilter === 'vendor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Vendors
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name, department, hostel or business name..."
                      value={communitySearch}
                      onChange={(e) => setCommunitySearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-400 rounded-2xl text-xs text-slate-800 focus:outline-none transition-all"
                    />
                    {communitySearch && (
                      <button
                        type="button"
                        onClick={() => setCommunitySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Directory Grid */}
                  {filteredCommunity.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
                      {filteredCommunity.map((commUser) => {
                        const uid = commUser.user_id || commUser.id;
                        const isFriend = commUser.friendship_status === 'friends';
                        const isSent = commUser.friendship_status === 'request_sent';
                        const isReceived = commUser.friendship_status === 'request_received';

                        return (
                          <div key={uid} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between space-x-3 hover:border-sky-200 transition-all">
                            <div
                              onClick={() => handleOpenProfile(uid)}
                              className="flex items-center space-x-3 overflow-hidden cursor-pointer group flex-1 min-w-0"
                              title="Click to view profile"
                            >
                              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-sm overflow-hidden group-hover:ring-2 group-hover:ring-sky-500 transition-all">
                                {commUser.profile_picture_url ? (
                                  <SafeImage src={commUser.profile_picture_url} alt="Pic" fallbackType="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  commUser.full_name?.charAt(0) || 'C'
                                )}
                              </div>
                              <div className="overflow-hidden min-w-0">
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
                                type="button"
                                onClick={() => handleOpenProfile(uid)}
                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-white rounded-xl cursor-pointer transition-colors"
                                title="View Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {isFriend ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPartner({ partner_id: uid, partner_name: commUser.full_name, role: commUser.role });
                                    setActiveTab('messages');
                                    handleSelectPartner({ partner_id: uid, partner_name: commUser.full_name, role: commUser.role });
                                  }}
                                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl cursor-pointer flex items-center space-x-1 active:scale-95 transition-transform"
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
                                  type="button"
                                  onClick={() => handleAcceptFriendRequest(commUser.request_id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl cursor-pointer active:scale-95 transition-transform"
                                >
                                  Accept
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSendFriendRequest(uid)}
                                  className="px-3 py-1.5 bg-white hover:bg-sky-50 border border-slate-200 text-sky-700 text-[11px] font-bold rounded-xl cursor-pointer flex items-center space-x-1 active:scale-95 transition-transform"
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* --- TAB 5: CAMPUS HOME & PROMO DROPS (MATCHING STUDENT FEED) --- */}
          {/* ========================================================================= */}
          {(activeTab === 'home' || activeTab === 'reels') && (
            <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
                    Campus Home & Drops
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                    Discover trending student clips, food drops, new stock & share promotional drops.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Filter Pills */}
                  <div className="bg-white p-1 rounded-2xl border border-slate-200 flex items-center space-x-1 text-xs font-bold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setReelFeedFilter('all')}
                      className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${reelFeedFilter === 'all' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      All Campus ({allReels.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReelFeedFilter('my_drops')}
                      className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${reelFeedFilter === 'my_drops' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      My Store Drops
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      API.get('/reels').then(res => {
                        const fresh = res.data || [];
                        setAllReels(fresh);
                        setCachedData('allReels', fresh);
                        showToast('Feed refreshed!', 'info');
                      }).catch(() => { });
                    }}
                    className="p-2 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-600 rounded-xl transition-all shadow-xs cursor-pointer"
                    title="Refresh Feed"
                  >
                    <RefreshCw className="w-4 h-4 text-sky-500" />
                  </button>
                </div>
              </div>

              {/* Campus Stories Rail (Modern Instagram/Threads Circular Story Rings) */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Campus Stories
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">24h Drops</span>
                </div>

                <div className="flex items-center space-x-3 sm:space-x-4 overflow-x-auto scrollbar-none momentum-scroll py-1 px-1">
                  {/* 1. Create / View Store Story Ring */}
                  {(() => {
                    const selfGroup = statusGroups.find(g => g.is_self);
                    const hasMyStory = Boolean(selfGroup && selfGroup.items && selfGroup.items.length > 0);
                    return (
                      <div
                        onClick={() => {
                          if (hasMyStory) {
                            const selfIdx = statusGroups.findIndex(g => g.is_self);
                            setActiveStatusViewer({ userIdx: selfIdx !== -1 ? selfIdx : 0, itemIdx: 0 });
                          } else {
                            setCreateStatusModalOpen(true);
                          }
                        }}
                        className="flex flex-col items-center shrink-0 cursor-pointer group active:scale-95 transition-transform"
                      >
                        <div className="relative">
                          <div className={`w-15 h-15 sm:w-17 sm:h-17 rounded-full p-[2.5px] transition-all ${hasMyStory
                              ? 'bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 shadow-sm'
                              : 'border-2 border-dashed border-slate-300 group-hover:border-sky-400'
                            }`}>
                            <div className="w-full h-full rounded-full p-[2px] bg-white overflow-hidden">
                              {user?.profile_picture_url || vendorStore?.logo ? (
                                <SafeImage
                                  src={user?.profile_picture_url || vendorStore?.logo}
                                  alt="Your Story"
                                  fallbackType="avatar"
                                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-200"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm">
                                  {vendorStore?.business_name?.charAt(0) || user?.full_name?.charAt(0) || 'V'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Plus / Add Story Floating Badge */}
                          <div
                            onClick={(e) => {
                              if (hasMyStory) {
                                e.stopPropagation();
                                setCreateStatusModalOpen(true);
                              }
                            }}
                            className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center border-2 border-white shadow-xs hover:scale-110 transition-transform"
                            title="Add to story"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[68px] text-center mt-1.5 group-hover:text-sky-600 transition-colors">
                          {hasMyStory ? 'Your story' : 'Add story'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* 2. Peer Campus Story Rings */}
                  {statusGroups
                    .filter(g => !g.is_self)
                    .map((group) => {
                      const origIdx = statusGroups.findIndex(g => g.user_id === group.user_id);
                      const isUnviewed = group.has_unviewed !== false && !group.all_viewed;

                      return (
                        <div
                          key={group.user_id}
                          onClick={() => {
                            const firstUnviewed = group.items?.findIndex(it => !it.is_viewed) ?? -1;
                            setActiveStatusViewer({
                              userIdx: origIdx !== -1 ? origIdx : 0,
                              itemIdx: firstUnviewed !== -1 ? firstUnviewed : 0
                            });
                          }}
                          className="flex flex-col items-center shrink-0 cursor-pointer group active:scale-95 transition-transform"
                        >
                          <div className={`w-15 h-15 sm:w-17 sm:h-17 rounded-full p-[2.5px] transition-all ${isUnviewed
                              ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-sm'
                              : 'bg-slate-200'
                            }`}>
                            <div className="w-full h-full rounded-full p-[2px] bg-white overflow-hidden">
                              {group.user_avatar ? (
                                <SafeImage
                                  src={group.user_avatar}
                                  alt={group.user_name}
                                  fallbackType="avatar"
                                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-200"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-sky-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                                  {group.user_name?.charAt(0)}
                                </div>
                              )}
                            </div>
                          </div>

                          <span className={`text-[11px] truncate max-w-[68px] text-center mt-1.5 transition-colors ${isUnviewed ? 'font-bold text-slate-900 group-hover:text-sky-600' : 'font-medium text-slate-500'
                            }`}>
                            {group.user_name?.split(' ')[0] || group.user_name}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Campus Drop Composer (Clean single bar matching StudentDashboard) */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-2.5 sm:p-3 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div
                    onClick={() => handleOpenProfile(user?.user_id || user?.id)}
                    className="relative cursor-pointer shrink-0"
                    title="Store Profile"
                  >
                    {user?.profile_picture_url || vendorStore?.logo ? (
                      <SafeImage
                        src={user?.profile_picture_url || vendorStore?.logo}
                        alt="Store"
                        fallbackType="avatar"
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm">
                        {vendorStore?.business_name?.charAt(0) || user?.full_name?.charAt(0) || 'V'}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-500/30" />
                  </div>

                  <div
                    onClick={() => setShowReelModal(true)}
                    className="flex-1 bg-slate-100/90 hover:bg-slate-200/70 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-500 font-medium cursor-pointer transition-colors"
                  >
                    <span className="truncate">Share a promo drop, new stock or food special...</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowReelModal(true)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Add promo photo or video drop"
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
                  </button>
                </div>
              </div>

              {/* Reels Feed Stream */}
              <div className="space-y-4">
                {filteredReels.filter(r => !hiddenPostIds.includes(r.id)).length > 0 ? (
                  filteredReels.filter(r => !hiddenPostIds.includes(r.id)).map((reel) => {
                    const isVideo = reel.media_type === 'video' || (reel.media_url && reel.media_url.match(/\.(mp4|webm|mov|ogg)$/i));
                    const isMine = (reel.author_id === user?.user_id || reel.user_id === user?.user_id || reel.author_id === user?.id);

                    return (
                      <div key={reel.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                        {/* Post Header */}
                        <div className="p-3.5 sm:p-4 flex items-start justify-between gap-2 relative">
                          <div className="flex items-start space-x-2.5 min-w-0">
                            <div
                              onClick={() => handleOpenProfile(reel.author_id || reel.user_id)}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                            >
                              {reel.author_name?.charAt(0) || 'C'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(reel.author_id || reel.user_id)}
                                  className="font-bold text-xs text-slate-900 hover:text-sky-600 transition-colors text-left truncate"
                                >
                                  {reel.author_name || 'Campus Creator'}
                                </button>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isMine || reel.author_role === 'vendor' ? 'bg-amber-100 text-amber-800' : 'bg-sky-50 text-sky-700'
                                  }`}>
                                  {isMine ? 'My Store Drop' : reel.author_role === 'vendor' ? 'Merchant' : 'Student'}
                                </span>
                                {(reel.author_university_abbr || reel.author_university) && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    📍 {reel.author_university_abbr || reel.author_university}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                <span className="flex items-center space-x-0.5 text-sky-600 font-semibold">
                                  <MapPin className="w-2.5 h-2.5 text-sky-500" />
                                  <span>{reel.location || 'Campus'}</span>
                                </span>
                                <span>•</span>
                                <span>{safeDate(reel.created_at, 'Recent')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Post Settings Menu */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setActivePostMenuId(activePostMenuId === reel.id ? null : reel.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                              title="Drop settings"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activePostMenuId === reel.id && (
                              <>
                                <div className="fixed inset-0 z-20" onClick={() => setActivePostMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                                  {isMine && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePostMenuId(null);
                                        handleDeleteReel(reel.id);
                                      }}
                                      className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 text-rose-500" />
                                      <span>Delete Drop</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPostLink(reel)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                    <Copy className="w-4 h-4 text-slate-400" />
                                    <span>Copy Link</span>
                                  </button>
                                  {(reel.author_id || reel.user_id) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePostMenuId(null);
                                        handleOpenProfile(reel.author_id || reel.user_id);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-4 h-4 text-slate-400" />
                                      <span>View Creator</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleHidePost(reel.id)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                    <EyeOff className="w-4 h-4 text-slate-400" />
                                    <span>Hide Drop</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReportPost(reel.id)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                    <Flag className="w-4 h-4 text-slate-400" />
                                    <span>Report Drop</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Content: Title & Description */}
                        <div className="px-4 pb-3">
                          {reel.title && (
                            <h4 className="font-extrabold text-sm text-slate-900 mb-1">{reel.title}</h4>
                          )}
                          {reel.description && (
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                              {reel.description}
                            </p>
                          )}
                        </div>

                        {/* Media Display */}
                        {reel.media_url && (
                          <div className="w-full bg-slate-950 overflow-hidden" style={{ maxHeight: '70vw', minHeight: '200px' }}>
                            {isVideo ? (
                              <video
                                src={getMediaUrl(reel.media_url)}
                                controls
                                playsInline
                                className="w-full h-full object-contain"
                                style={{ maxHeight: '70vw', minHeight: '200px' }}
                              />
                            ) : (
                              <SafeImage
                                src={reel.media_url}
                                alt={reel.title || 'Reel media'}
                                fallbackType="product"
                                className="w-full h-full object-contain"
                                style={{ maxHeight: '70vw', minHeight: '200px' }}
                              />
                            )}
                          </div>
                        )}

                        {/* Action Bar */}
                        <div className="px-4 py-2.5 flex items-center justify-between border-t border-slate-100 bg-white">
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => handleLikeReel(reel.id)}
                              className={`flex items-center space-x-1.5 text-xs font-bold transition-colors cursor-pointer ${reel.has_liked ? 'text-rose-500' : 'text-slate-600 hover:text-rose-500'
                                }`}
                            >
                              <Heart className={`w-4 h-4 ${reel.has_liked ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                              <span>{reel.likes_count || 0}</span>
                            </button>

                            <button
                              onClick={() => setActiveCommentsReelId(activeCommentsReelId === reel.id ? null : reel.id)}
                              className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-4 h-4 text-sky-500" />
                              <span>{reel.comments_count || (reel.comments ? reel.comments.length : 0)}</span>
                            </button>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-300 hidden sm:block">Campus Drops</span>
                        </div>

                        {/* Interactive Comments Drawer */}
                        {activeCommentsReelId === reel.id && (
                          <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 space-y-3">
                            {/* Comments List */}
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                              {reel.comments && reel.comments.length > 0 ? (
                                reel.comments.map((comment, idx) => {
                                  const canDeleteComment = (user?.user_id && comment.user_id === user.user_id) ||
                                    (user?.id && comment.user_id === user.id) ||
                                    isMine;

                                  return (
                                    <div key={comment.id || idx} className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs text-xs">
                                      <div className="flex items-center justify-between mb-1 gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                          <span className="font-bold text-slate-900 truncate">{comment.author_name}</span>
                                          {comment.reply_to_author && (
                                            <span className="text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md flex items-center space-x-1 shrink-0">
                                              <Reply className="w-2.5 h-2.5" />
                                              <span>@{comment.reply_to_author}</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2 shrink-0">
                                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
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
                                            title="Reply"
                                          >
                                            <Reply className="w-3 h-3" />
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
                                      <p className="text-slate-700 leading-relaxed">{comment.content}</p>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="py-4 text-center text-xs text-slate-400">
                                  No comments on this drop yet.
                                </div>
                              )}
                            </div>

                            {/* Replying Indicator Banner */}
                            {replyingToComment && replyingToComment.reelId === reel.id && (
                              <div className="flex items-center justify-between px-3 py-1.5 bg-sky-50 border border-sky-200/80 rounded-xl text-xs text-sky-800">
                                <div className="flex items-center space-x-1.5 overflow-hidden min-w-0">
                                  <Reply className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                  <span className="truncate">
                                    Replying to <strong className="font-bold text-sky-900">@{replyingToComment.authorName}</strong>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setReplyingToComment(null)}
                                  className="p-1 text-sky-500 hover:text-sky-800 cursor-pointer shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Comment Input */}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handlePostReelComment(reel.id);
                              }}
                              className="flex items-center space-x-2 pt-2 border-t border-slate-200/60"
                            >
                              <input
                                ref={commentInputRef}
                                type="text"
                                placeholder={replyingToComment && replyingToComment.reelId === reel.id
                                  ? `Reply to @${replyingToComment.authorName}...`
                                  : "Write a comment..."}
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                className="flex-1 p-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                              />
                              <button
                                type="submit"
                                disabled={!newCommentText.trim() || isPostingComment}
                                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1 shrink-0"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{replyingToComment && replyingToComment.reelId === reel.id ? 'Reply' : 'Post'}</span>
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-10">
                    <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-800">No campus reels to show</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {reelFeedFilter === 'my_drops'
                        ? 'You have not posted any promotional drops yet. Share a promo drop above!'
                        : 'Be the first to post a new promo drop, unboxing clip, or hostel flash sale video!'}
                    </p>
                  </div>
                )}
              </div>
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
                    {(vendorOrders || []).length}
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
                      onClick={() => { setBroadcastInput(storeBroadcast); setBroadcastModalOpen(true); }}
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
          {/* --- TAB 7: STORE PROFILE & SETTINGS (MODERN SOCIAL / IOS GROUPED EXPERIENCE) --- */}
          {/* ========================================================================= */}
          {activeTab === 'settings' && (
            <div className="w-full max-w-2xl mx-auto space-y-3.5 sm:space-y-5 pb-16 overflow-x-hidden min-w-0">
              {/* Header Title */}
              <div className="px-1">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Settings & Profile</h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage your store identity, stall location, notifications & security.</p>
              </div>

              {/* 1. HERO STORE PROFILE CARD */}
              <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-xs relative overflow-hidden w-full min-w-0">
                {/* Subtle background gradient glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-400/10 via-sky-500/5 to-transparent rounded-bl-full pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left space-y-3.5 sm:space-y-0 sm:space-x-5 w-full min-w-0">
                  {/* Store Logo / Avatar with Camera Overlay */}
                  <div className="relative group shrink-0">
                    {user?.profile_picture_url || vendorStore?.logo ? (
                      <SafeImage
                        src={user?.profile_picture_url || vendorStore?.logo}
                        alt={vendorStore?.business_name || user?.full_name}
                        fallbackType="avatar"
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-sky-500 shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center shadow-md">
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
                      className="absolute -bottom-1 -right-1 p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-md cursor-pointer transition-transform group-hover:scale-110 active:scale-95"
                      title="Change Store Logo"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Profile Details */}
                  <div className="w-full flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center sm:justify-start gap-1 sm:gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 break-words max-w-full">
                        {vendorStore?.business_name || user?.business_name || user?.full_name || 'Campus Merchant'}
                      </h2>
                      {isVerified ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1 shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Verified Merchant</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveTab('verification')}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center space-x-1 shrink-0 hover:bg-amber-100 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Get Verified →</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1 break-words">
                      {user?.email} {(vendorStore?.phone || user?.phone_number) && `• ${vendorStore?.phone || user?.phone_number}`}
                    </p>

                    {/* Campus Badges */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2.5 max-w-full">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center space-x-1 max-w-full">
                        <Store className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[170px]">{vendorStore?.category_name || 'Retail & Services'}</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center space-x-1 max-w-full">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[150px]">{vendorStore?.location || 'SUB Food Court'}</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-700 text-[11px] font-semibold shrink-0">
                        {vendorStore?.university_name || 'Main Campus'}
                      </span>
                    </div>

                    {(vendorStore?.business_description || user?.bio) && (
                      <p className="text-xs text-slate-600 mt-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic break-words">
                        "{vendorStore?.business_description || user?.bio}"
                      </p>
                    )}

                    {/* Edit Profile & Password Action Buttons */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-start sm:space-x-2 w-full max-w-xs mx-auto sm:mx-0">
                      <button
                        type="button"
                        onClick={() => setEditProfileModalOpen(true)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangePasswordModalOpen(true)}
                        className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Password</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Merchant Store Stats Strip */}
                <div className="grid grid-cols-3 gap-1 mt-5 pt-4 border-t border-slate-100 text-center w-full">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('inventory'); setCatalogType('products'); }}
                    className="py-2 px-1 rounded-2xl hover:bg-sky-50/70 transition-colors cursor-pointer group"
                  >
                    <p className="text-base sm:text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors">{(products || []).length}</p>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight">Products</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('inventory'); setCatalogType('services'); }}
                    className="py-2 px-1 rounded-2xl hover:bg-sky-50/70 transition-colors cursor-pointer group"
                  >
                    <p className="text-base sm:text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors">{(services || []).length}</p>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight">Services</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="py-2 px-1 rounded-2xl hover:bg-sky-50/70 transition-colors cursor-pointer group"
                  >
                    <p className="text-base sm:text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors">{(vendorOrders || []).length}</p>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight">Orders</span>
                  </button>
                </div>
              </div>

              {/* 2. GROUPED SETTINGS: PREFERENCES & SOUNDS */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs w-full min-w-0">
                <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Preferences & Alerts</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {/* Push Notifications Row */}
                  <div className="p-3.5 sm:p-5 flex items-center justify-between gap-3 w-full min-w-0">
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-1">
                      <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Phone Push Notifications</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2 sm:line-clamp-1">Instant sound & lock screen alerts for new orders & buyer chats.</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {pushState === 'granted' ? (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1 shrink-0">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : pushState === 'denied' ? (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1 shrink-0">
                          <AlertCircle className="w-3 h-3" />
                          <span>Blocked</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEnablePush}
                          disabled={pushLoading}
                          className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {pushLoading ? 'Enabling...' : 'Enable'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* In-App Sounds Toggle */}
                  <div className="p-3.5 sm:p-5 flex items-center justify-between gap-3 w-full min-w-0">
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-1">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">In-App Audio Chimes</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2 sm:line-clamp-1">Gentle audio sounds on incoming buyer messages & order alerts.</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={soundEnabled}
                        onClick={() => {
                          const next = !soundEnabled;
                          setSoundEnabled(next);
                          try { localStorage.setItem('cl_sound_enabled', String(next)); } catch (_) { }
                          showToast(next ? 'In-app audio sounds enabled' : 'In-app audio sounds muted', 'info');
                        }}
                        className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 ${soundEnabled ? 'bg-sky-500' : 'bg-slate-300'
                          }`}
                      >
                        <span
                          className={`block w-6 h-6 bg-white rounded-full transition-transform shadow-xs ${soundEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. GROUPED SETTINGS: STORE OPERATIONS & SETTLEMENT */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs w-full min-w-0">
                <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Store Operations & Account</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {/* Store Profile Row */}
                  <button
                    type="button"
                    onClick={() => setEditProfileModalOpen(true)}
                    className="w-full p-3.5 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Store Identity & Contact Details</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {vendorStore?.business_name || 'Set store name'} • {vendorStore?.phone || user?.phone_number || 'Hotline'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>

                  {/* Stall & Delivery Spot Row */}
                  <button
                    type="button"
                    onClick={() => setEditProfileModalOpen(true)}
                    className="w-full p-3.5 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Stall Spot & Pickup Desk</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {vendorStore?.location || 'Tap to set stall location or hostel delivery point'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>

                  {/* Bank Settlement Details Row */}
                  <button
                    type="button"
                    onClick={() => { setBankForm({ ...bankInfo }); setBankModalOpen(true); }}
                    className="w-full p-3.5 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Bank Payouts & Settlement</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {bankInfo.bank_name} • {bankInfo.account_number} ({bankInfo.account_name})
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>

                  {/* ID & Business Verification Row */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('verification')}
                    className="w-full p-3.5 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isVerified ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">ID & Business Verification</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {isVerified ? 'Verified Merchant Certificate Active' : 'Submit ID to unlock verified badge & full perks'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>

                  {/* Broadcast Announcement Row */}
                  <button
                    type="button"
                    onClick={() => { setBroadcastInput(storeBroadcast); setBroadcastModalOpen(true); }}
                    className="w-full p-3.5 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Campus Flash Announcement</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {storeBroadcast || 'Post flash promo or menu special banner'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>

                  {/* Password & Security Row */}
                  <button
                    type="button"
                    onClick={() => setChangePasswordModalOpen(true)}
                    className="w-full p-3.5 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Account Security & Password</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">Update your merchant account password.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>
                </div>
              </div>

              {/* 4. GROUPED SETTINGS: APP & UPDATES */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs w-full min-w-0">
                <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">App & Downloads</span>
                </div>
                <div className="p-3.5 sm:p-5 space-y-4 w-full min-w-0">
                  <InstallAppButton variant="settings" showInstalled={true} />

                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">CampusLink Merchant Edition</span>
                      <span className="text-slate-500 block text-[11px]">v2.4.2 • {vendorStore?.university_name || 'Main Campus'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const keysToRemove = [];
                          for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (k && k.startsWith('cl_cache_')) keysToRemove.push(k);
                          }
                          keysToRemove.forEach(k => localStorage.removeItem(k));
                          showToast('Temporary cache cleared! Reloading...', 'info');
                          setTimeout(() => window.location.reload(), 600);
                        } catch (_) {
                          window.location.reload();
                        }
                      }}
                      className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear Cache & Sync
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. SIGN OUT BUTTON */}
              <div className="bg-white rounded-3xl border border-rose-100 p-3.5 sm:p-5 shadow-xs flex items-center justify-between gap-3 w-full min-w-0">
                <div className="min-w-0 flex-1 pr-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Sign Out of Merchant Store</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">End your merchant session on this browser.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
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
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
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

        </div>
      </main>

      {/* --- MODAL 1: EDIT STORE & MERCHANT PROFILE --- */}
      <AnimatePresence>
        {editProfileModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overscroll-contain">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl p-4 sm:p-7 max-h-[85dvh] overflow-y-auto overscroll-contain space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-7"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-sky-600 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900">Edit Store & Merchant Profile</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditProfileModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateVendorProfile} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Merchant Owner Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store / Business Brand Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.business_name}
                    onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hotline & WhatsApp</label>
                    <input
                      type="tel"
                      placeholder="e.g. +2348012345678"
                      value={profileForm.phone_number}
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store Category</label>
                    <select
                      value={profileForm.category_id}
                      onChange={(e) => setProfileForm({ ...profileForm, category_id: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                    >
                      <option value={1}>Food & Meals (Cafeteria / Restaurant)</option>
                      <option value={2}>Fashion, Shoes & Wears</option>
                      <option value={3}>Laptops, Phones & Accessories</option>
                      <option value={4}>Academic Materials & Books</option>
                      <option value={5}>Laundry, Styling & Campus Services</option>
                      <option value={6}>Hostel Essentials & Groceries</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Stall Spot / Campus Delivery Location</label>
                  <input
                    type="text"
                    placeholder="e.g. SUB Food Court Stall 4 / Faculty Block B Desk"
                    value={profileForm.location}
                    onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store Description & Customer Bio</label>
                  <textarea
                    rows={3}
                    placeholder="Introduce your store offerings, delivery speed, and opening hours..."
                    value={profileForm.business_description}
                    onChange={(e) => setProfileForm({ ...profileForm, business_description: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm resize-none"
                  />
                </div>

                <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs flex items-center justify-end space-x-2 pt-3 pb-1 border-t border-slate-100 z-10 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setEditProfileModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: CHANGE MERCHANT PASSWORD --- */}
      <AnimatePresence>
        {changePasswordModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overscroll-contain">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl p-4 sm:p-7 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-7"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-sky-600 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setChangePasswordModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
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
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs flex items-center justify-end space-x-2 pt-3 pb-1 border-t border-slate-100 z-10 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setChangePasswordModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                  >
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: BANK PAYOUT SETTLEMENT --- */}
      <AnimatePresence>
        {bankModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overscroll-contain">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl p-4 sm:p-7 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-7"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900">Direct Bank Settlement Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                These bank account details will be shown to student customers during checkout so they can transfer payment directly to you.
              </p>

              <form onSubmit={handleSaveBankInfo} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OPay / PalmPay / Access Bank / GTBank"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10-digit Account Number"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Account Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Exact name matching bank records"
                    value={bankForm.account_name}
                    onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm"
                  />
                </div>

                <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs flex items-center justify-end space-x-2 pt-3 pb-1 border-t border-slate-100 z-10 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setBankModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    Save Bank Details
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 4: CAMPUS FLASH BROADCAST BANNER --- */}
      <AnimatePresence>
        {broadcastModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overscroll-contain">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl p-4 sm:p-7 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-7"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900">Campus Flash Announcement</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                This message appears in an eye-catching banner across your store page and product listings to announce flash sales or menu drops.
              </p>

              <form onSubmit={handleSaveBroadcast} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Announcement Message</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. 50% discount on all sneakers before 6 PM today! / Fresh hot jollof rice available now!"
                    value={broadcastInput}
                    onChange={(e) => setBroadcastInput(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-[16px] sm:text-sm resize-none"
                  />
                </div>

                <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs flex items-center justify-end space-x-2 pt-3 pb-1 border-t border-slate-100 z-10 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setBroadcastModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    Save Banner
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


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
                {(selectedProfile.is_verified || selectedProfile.is_vendor_verified || selectedProfile.verification_status === 'approved') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400/20 via-yellow-400/20 to-amber-500/20 text-amber-900 border border-amber-300 text-[10px] font-black shadow-2xs" title="Verified Campus Vendor">
                    <Award className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    <span>Verified</span>
                  </span>
                )}
                {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id) > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-xs font-black shadow-xs animate-pulse">
                    {getUnreadCountForUser(selectedProfile.user_id || selectedProfile.id)} new
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center space-x-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  {selectedProfile.role === 'vendor' ? '🏪 Campus Vendor' : '🎓 Student'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedProfile.university_name || 'Campus University'}
                </span>
              </div>

              {/* Bio */}
              <p className="text-xs text-slate-600 mt-3 px-3 italic bg-slate-50 py-2.5 rounded-2xl border border-slate-100">
                "{selectedProfile.bio || (selectedProfile.role === 'vendor' ? 'Verified campus vendor offering quality items.' : 'Student on CampusLink connecting with peers and vendors.')}"
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
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
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
                    <>
                      <button
                        onClick={() => handleRemoveFriend(selectedProfile.user_id || selectedProfile.id)}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-xl cursor-pointer"
                        title="Remove Friend"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
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
                    </>
                  )}
                </div>

                {selectedProfile.friendship_status !== 'friends' && (
                  <p className="text-[11px] text-slate-400 italic">
                    Direct chatting unlocks once you and {selectedProfile.full_name} are connected as friends.
                  </p>
                )}
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
                            className={`h-full transition-all duration-300 ${idx < activeStatusViewer.itemIdx
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
                      <option value="other">Others (Specify below)</option>
                    </select>
                  </div>
                </div>

                {String(productForm.category_id) === 'other' && (
                  <div>
                    <label className="block text-[11px] font-bold text-sky-600 uppercase mb-1">Specify Custom Category</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Handmade Crafts, Hair Styling, Perfumes, Electronics Repair..."
                      value={productForm.custom_category || ''}
                      onChange={(e) => setProductForm({ ...productForm, custom_category: e.target.value })}
                      className="w-full p-2.5 bg-sky-50/50 border border-sky-300 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-xs font-semibold"
                    />
                  </div>
                )}

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
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Service Category</label>
                    <select
                      value={serviceForm.category_id}
                      onChange={(e) => setServiceForm({ ...serviceForm, category_id: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value={5}>Laundry & Cleaning</option>
                      <option value={4}>Academic & Tutoring</option>
                      <option value={2}>Beauty, Hair & Fashion</option>
                      <option value={3}>Tech & Gadget Repair</option>
                      <option value={1}>Food & Event Catering</option>
                      <option value="other">Others (Specify below)</option>
                    </select>
                  </div>
                </div>

                {String(serviceForm.category_id) === 'other' && (
                  <div>
                    <label className="block text-[11px] font-bold text-sky-600 uppercase mb-1">Specify Custom Service Category</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Photography & Videography, Moving/Haulage, Graphic Design..."
                      value={serviceForm.custom_category || ''}
                      onChange={(e) => setServiceForm({ ...serviceForm, custom_category: e.target.value })}
                      className="w-full p-2.5 bg-sky-50/50 border border-sky-300 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500 text-xs font-semibold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Location Tag</label>
                  <input type="text" placeholder="e.g. SUB / Jaja Hostel" value={serviceForm.location} onChange={(e) => setServiceForm({ ...serviceForm, location: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
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

      {/* ========================================================================= */}
      {/* --- SLIDE-OVER MENU DRAWER MODAL (MATCHING STUDENT DASHBOARD) --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {menuDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuDrawerOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            {/* Slide-over Drawer (From Right) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="absolute inset-y-0 right-0 max-w-sm w-full bg-slate-50 shadow-2xl flex flex-col border-l border-slate-200 z-10"
            >
              {/* Drawer Top Header */}
              <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-black text-slate-900 tracking-tight">Merchant Menu</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Vendor
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuDrawerOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Store Profile Card */}
                <button
                  type="button"
                  onClick={() => {
                    handleOpenProfile(user?.user_id || user?.id);
                    setMenuDrawerOpen(false);
                  }}
                  className="w-full p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:bg-slate-50/80 transition-all flex items-center space-x-3 text-left cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    {user?.profile_picture_url || vendorStore?.logo ? (
                      <SafeImage
                        src={user?.profile_picture_url || vendorStore?.logo}
                        alt="Store"
                        fallbackType="avatar"
                        className="w-12 h-12 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center text-base">
                        {vendorStore?.business_name?.charAt(0) || user?.full_name?.charAt(0) || 'V'}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h4 className="font-extrabold text-sm text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {vendorStore?.business_name || user?.full_name || 'Campus Store'}
                      </h4>
                      {isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {vendorStore?.location || user?.university_name || 'Campus Vendor Store'}
                    </p>
                    <span className="inline-flex items-center text-[10px] font-bold text-sky-600 mt-0.5">
                      View Store Profile →
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                </button>

                {/* Quick Navigation Shortcuts */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1 mb-2">Shortcuts</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {
                        title: 'Feed & Drops',
                        desc: 'Campus moments',
                        icon: Home,
                        color: 'text-blue-600 bg-blue-50',
                        tab: 'reels'
                      },
                      {
                        title: 'Friends',
                        desc: `${pendingRequests.length} pending`,
                        icon: Users,
                        color: 'text-sky-600 bg-sky-50',
                        tab: 'friends'
                      },
                      {
                        title: 'Store Catalog',
                        desc: `${products.length} products`,
                        icon: Store,
                        color: 'text-amber-600 bg-amber-50',
                        tab: 'inventory'
                      },
                      {
                        title: 'Orders',
                        desc: `${pendingOrdersCount} pending`,
                        icon: ShoppingCart,
                        color: 'text-emerald-600 bg-emerald-50',
                        tab: 'orders'
                      },
                      {
                        title: 'Chats',
                        desc: `${totalUnreadChatCount} unread`,
                        icon: MessageSquare,
                        color: 'text-indigo-600 bg-indigo-50',
                        tab: 'messages'
                      },
                      {
                        title: 'Settings',
                        desc: 'Store details',
                        icon: Settings,
                        color: 'text-slate-600 bg-slate-100',
                        tab: 'settings'
                      }
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.title}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.tab);
                            setMenuDrawerOpen(false);
                          }}
                          className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-all flex flex-col items-start text-left cursor-pointer group"
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${item.color}`}>
                            <Icon className="w-5 h-5 stroke-[2.2]" />
                          </div>
                          <span className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold truncate w-full">
                            {item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* More Settings & Utilities List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('verification');
                      setMenuDrawerOpen(false);
                    }}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">ID & Business Verification</span>
                        <span className="text-[10px] text-slate-400">{isVerified ? 'Verified Merchant' : 'Action Required'}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      setMenuDrawerOpen(false);
                    }}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Store Preferences & Bank Info</span>
                        <span className="text-[10px] text-slate-400">Payment, delivery & stall hours</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  {/* Notification Sounds Toggle */}
                  <div className="w-full p-3.5 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Notification Chimes</span>
                        <span className="text-[10px] text-slate-400">{soundEnabled ? 'Enabled' : 'Muted'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !soundEnabled;
                        setSoundEnabled(next);
                        try { localStorage.setItem('cl_sound_enabled', String(next)); } catch (_) { }
                        showToast(next ? 'Sound alerts enabled' : 'Sound alerts muted', 'info');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${soundEnabled ? 'bg-sky-500' : 'bg-slate-300'
                        }`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                  </div>
                </div>

                {/* Install App Button if PWA available */}
                <div className="p-1">
                  <InstallAppButton variant="full" />
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuDrawerOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer border border-rose-200/60"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FLOATING NOTIFICATION / FEEDBACK TOAST --- */}
      <AnimatePresence>
        {feedbackMsg.text && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] pointer-events-auto"
          >
            <div className={`p-3.5 sm:p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-center justify-between space-x-3 ${feedbackMsg.type === 'error'
                ? 'bg-rose-600/95 border-rose-500 text-white'
                : feedbackMsg.type === 'info'
                  ? 'bg-slate-900/95 border-slate-700 text-white'
                  : 'bg-emerald-600/95 border-emerald-500 text-white'
              }`}>
              <div className="flex items-center space-x-2.5 min-w-0">
                {feedbackMsg.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 shrink-0 text-white" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
                )}
                <span className="text-xs font-bold leading-snug break-words">{feedbackMsg.text}</span>
              </div>
              <button
                onClick={() => setFeedbackMsg({ type: '', text: '' })}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* --- MODERN MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 py-1.5 safe-nav-bottom shadow-lg ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'block'}`}>
        <div className="grid grid-cols-6 w-full max-w-lg mx-auto items-center">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'inventory', icon: Store, label: 'Store' },
            { id: 'marketplace', icon: ShoppingBag, label: 'Market' },
            { id: 'messages', icon: MessageSquare, label: 'Chats', badge: totalUnreadChatCount },
            { id: 'friends', icon: Users, label: 'Friends', badge: pendingRequests.length },
            { id: 'notifications', icon: Bell, label: 'Alerts', badge: unreadNotifCount }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === 'home'
              ? (activeTab === 'home' || activeTab === 'reels')
              : tab.id === 'inventory'
                ? (activeTab === 'inventory' || activeTab === 'services' || activeTab === 'catalog')
                : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  localStorage.setItem('campuslink_vendor_tab', tab.id);
                }}
                className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative min-w-0 ${isActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-900 font-medium'
                  }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center ring-1 ring-white">
                      {tab.badge > 15 ? '15+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] tracking-tight mt-0.5 truncate max-w-full text-center block w-full">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 w-6 h-0.5 bg-sky-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}