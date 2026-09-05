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
  Lock, Edit3, ShieldAlert, Bot, RotateCcw, Download, Smartphone
} from 'lucide-react';
import API, { uploadFile } from './api';

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [vendorStore, setVendorStore] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'services' | 'orders' | 'messages' | 'reels' | 'hub' | 'settings' | 'verification'

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

  // Data States
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [vendorReviews, setVendorReviews] = useState([]);
  
  // Messaging & Friends States
  const [conversations, setConversations] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [messageSubtab, setMessageSubtab] = useState('chats'); // 'chats' | 'friends' | 'requests' | 'my_friends'
  const [communityUsers, setCommunityUsers] = useState([]);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityRoleFilter, setCommunityRoleFilter] = useState('all'); // 'all' | 'student' | 'vendor'
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const chatBottomRef = useRef(null);

  // CampusLink AI Chat States
  const [aiMessages, setAiMessages] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Status Stories States (WhatsApp/Instagram-style)
  const [statusGroups, setStatusGroups] = useState([]);
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

  // Reels States
  const [allReels, setAllReels] = useState([]);
  const [reelFeedFilter, setReelFeedFilter] = useState('all'); // 'all' | 'my_drops'
  const [activeCommentsReelId, setActiveCommentsReelId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

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

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

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
      const storeRes = await API.get('/vendor/my-store');
      setVendorStore(storeRes.data);
      setVerificationForm({
        id_card_type: storeRes.data.id_card_type || 'national_id',
        id_card_number: storeRes.data.id_card_number || '',
        id_card_front: storeRes.data.id_card_front || '',
        id_card_back: storeRes.data.id_card_back || '',
        location: storeRes.data.location || '',
        phone: storeRes.data.phone || '',
        business_name: storeRes.data.business_name || ''
      });
      if (storeRes.data.id_card_front) setIdFrontPreview(storeRes.data.id_card_front);
      if (storeRes.data.id_card_back) setIdBackPreview(storeRes.data.id_card_back);

      setProfileForm({
        full_name: storeRes.data.user_name || user?.full_name || '',
        phone_number: storeRes.data.phone || user?.phone_number || '',
        business_name: storeRes.data.business_name || '',
        business_description: storeRes.data.business_description || '',
        location: storeRes.data.location || '',
        category_id: storeRes.data.category_id || 1,
        bio: user?.bio || ''
      });

      // Concurrent fetch of all dashboard & community assets
      const results = await Promise.allSettled([
        API.get('/products'),
        API.get('/services'),
        API.get('/vendor/orders'),
        API.get(`/vendors/${storeRes.data.id}/reviews`),
        API.get('/conversations'),
        API.get('/reels'),
        API.get('/friends'),
        API.get('/friends/requests/pending'),
        API.get('/students'),
        API.get('/campus/statuses'),
        API.get('/universities')
      ]);

      if (results[0].status === 'fulfilled') {
        setProducts(results[0].value.data.filter(p => p.vendor_id === storeRes.data.id));
      }
      if (results[1].status === 'fulfilled') {
        setServices(results[1].value.data.filter(s => s.vendor_id === storeRes.data.id));
      }
      if (results[2].status === 'fulfilled') {
        setVendorOrders(results[2].value.data);
      }
      if (results[3].status === 'fulfilled') {
        setVendorReviews(results[3].value.data);
      }
      if (results[4].status === 'fulfilled') {
        setConversations(results[4].value.data);
      }
      if (results[5].status === 'fulfilled') {
        setAllReels(results[5].value.data);
      }
      if (results[6].status === 'fulfilled') {
        setFriendsList(results[6].value.data);
      }
      if (results[7].status === 'fulfilled') {
        setPendingRequests(results[7].value.data);
      }
      if (results[8].status === 'fulfilled') {
        setCommunityUsers(results[8].value.data);
      }
      if (results[9].status === 'fulfilled') {
        setStatusGroups(results[9].value.data || []);
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
      if (statusMediaFile) {
        mediaUrl = await uploadFile(statusMediaFile);
      }

      await API.post('/campus/statuses', {
        media_url: mediaUrl,
        media_type: statusMediaFile ? (statusMediaFile.type.startsWith('video') ? 'video' : 'image') : 'text',
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

  const handleReplyToStatus = async (recipientId) => {
    if (!statusReplyText.trim()) return;
    try {
      await API.post('/messages', {
        recipient_id: recipientId,
        content: `Replying to your story: "${statusReplyText.trim()}"`
      });
      setStatusReplyText('');
      setActiveStatusViewer(null);
      setFeedbackMsg({ type: 'success', text: 'Reply sent to chat!' });
      
      // Open that chat
      const partner = communityUsers.find(u => (u.user_id === recipientId || u.id === recipientId));
      if (partner) {
        setSelectedPartner({ partner_id: recipientId, partner_name: partner.full_name, role: partner.role });
        handleSelectPartner({ partner_id: recipientId, partner_name: partner.full_name, role: partner.role });
      }
      setActiveTab('messages');
      setMessageSubtab('chats');
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
  const handleSelectPartner = async (partner) => {
    setSelectedPartner(partner);
    try {
      const partnerId = partner.partner_id || partner.user_id || partner.id;
      const res = await API.get(`/messages/${partnerId}`);
      setChatMessages(Array.isArray(res.data) ? res.data : (res.data?.messages || []));
    } catch (err) {
      console.error('Failed to load partner messages:', err);
      setChatMessages([]);
    }
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

  const handleSendChatMessage = async (customContent = null) => {
    if (selectedPartner?.is_ai) {
      return handleSendAiMessage(customContent);
    }

    const text = customContent || newMsgText;
    if (!text.trim() || !selectedPartner || isSendingMsg) return;

    setIsSendingMsg(true);
    const partnerId = selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id;

    try {
      const res = await API.post('/messages', {
        recipient_id: partnerId,
        content: text.trim()
      });

      setChatMessages(prev => [...prev, res.data]);
      if (!customContent) setNewMsgText('');

      const convRes = await API.get('/conversations');
      setConversations(convRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message.');
    } finally {
      setIsSendingMsg(false);
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
    setIsPostingComment(true);
    try {
      const res = await API.post(`/reels/${reelId}/comments`, { content: newCommentText.trim() });
      setAllReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const currentComments = r.comments || [];
          const updated = [...currentComments, res.data];
          return {
            ...r,
            comments: updated,
            comments_count: updated.length
          };
        }
        return r;
      }));
      setNewCommentText('');
      setFeedbackMsg({ type: 'success', text: 'Comment published on campus drop!' });
    } catch (err) {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col md:flex-row">
      
      {/* --- DESKTOP SIDEBAR (Visible md and up) --- */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 p-5 flex-col justify-between shrink-0 shadow-xs h-screen sticky top-0">
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
                  <img src={vendorStore.logo} alt="Logo" className="w-full h-full object-cover" />
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
              {pendingRequests.length > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingRequests.length}
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
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
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
                        <img src={svc.image} alt={svc.name} className="w-full h-full object-cover" />
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

            {/* WHATSAPP-STYLE CAMPUS STATUS STORIES RAIL (Visible at the top of Chats) */}
            <div className={`p-4 bg-white border border-slate-200 rounded-3xl shadow-xs ${selectedPartner && messageSubtab === 'chats' ? 'hidden md:block' : 'block'}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Campus Stories & Status Updates</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{statusGroups.length} campus updates</span>
              </div>

              <div className="flex items-center space-x-4 overflow-x-auto pb-1 scrollbar-none">
                {/* 1. My Status (Tap to Add Status) */}
                <div
                  onClick={() => setCreateStatusModalOpen(true)}
                  className="flex flex-col items-center shrink-0 cursor-pointer group"
                >
                  <div className="relative w-14 h-14 rounded-full p-0.5 border-2 border-dashed border-emerald-400 group-hover:border-emerald-600 transition-all flex items-center justify-center bg-slate-50 overflow-visible">
                    {user?.profile_picture_url || vendorStore?.logo ? (
                      <img
                        src={user?.profile_picture_url || vendorStore?.logo}
                        alt="My Status"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm">
                        {user?.full_name?.charAt(0) || 'V'}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-800 mt-1.5">My Status</span>
                  <span className="text-[9px] text-slate-400">Post drop</span>
                </div>

                {/* 2. Campus Stories from Students & Vendors */}
                {statusGroups.map((group, uIdx) => (
                  <div
                    key={group.user_id}
                    onClick={() => setActiveStatusViewer({ userIdx: uIdx, itemIdx: 0 })}
                    className="flex flex-col items-center shrink-0 cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 via-teal-400 to-sky-500 shadow-xs group-hover:scale-105 transition-transform flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-white p-0.5 flex items-center justify-center overflow-hidden">
                        {group.user_avatar ? (
                          <img src={group.user_avatar} alt={group.user_name} className="w-full h-full rounded-full object-cover" />
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
                    <span className="text-[9px] text-emerald-600 font-semibold">
                      {group.items.length} update{group.items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* --- SUBTAB A: ACTIVE INQUIRIES & CHAT INTERFACE --- */}
            {messageSubtab === 'chats' && (
              <div className={`flex flex-col md:flex-row bg-white border border-slate-200 overflow-hidden shadow-xs ${selectedPartner ? 'h-[calc(100dvh-2rem)] md:h-[calc(100vh-18rem)] rounded-2xl md:rounded-3xl' : 'h-[calc(100vh-18rem)] min-h-[500px] rounded-3xl'}`}>
                
                {/* Conversations List */}
                <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0 bg-white ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between font-bold text-xs text-slate-800">
                    <span>Recent Customer Chats</span>
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

                    {conversations.length > 0 ? (
                      conversations.map((c) => (
                        <button
                          key={c.partner_id || c.user_id}
                          onClick={() => handleSelectPartner(c)}
                          className={`w-full p-3.5 text-left flex items-start space-x-3 transition-colors cursor-pointer ${
                            selectedPartner?.partner_id === c.partner_id ? 'bg-sky-50/80 border-l-4 border-sky-500' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProfile(c.partner_id || c.user_id);
                            }}
                            title="View Profile"
                            className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-sm hover:ring-2 hover:ring-sky-500 transition-all overflow-hidden"
                          >
                            {c.partner_avatar ? (
                              <img src={c.partner_avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              c.partner_name?.charAt(0) || 'S'
                            )}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 truncate">{c.partner_name}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {c.role === 'vendor' ? '🏪 Vendor' : '🎓 Student'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.last_message || 'Inquired about product...'}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                        <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                        <p>No customer chats yet.</p>
                        <p className="text-[11px] text-slate-400">When students ask about your products, their messages show here.</p>
                        <button
                          onClick={() => setMessageSubtab('friends')}
                          className="mt-2 text-sky-600 font-bold text-[11px] hover:underline cursor-pointer"
                        >
                          Explore Campus Students & Vendors
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat Panel */}
                <div className={`flex-1 flex flex-col justify-between bg-slate-50/50 overflow-hidden ${selectedPartner ? 'flex' : 'hidden md:flex'}`}>
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
                        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
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
                                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
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
                              <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none text-slate-600 text-xs shadow-xs flex items-center space-x-2">
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
                          className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
                        >
                          <input
                            type="text"
                            placeholder="Ask CampusLink AI anything (reply ideas, promo copy, grammar, math)..."
                            value={newMsgText}
                            onChange={(e) => setNewMsgText(e.target.value)}
                            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={!newMsgText.trim() || isAiTyping}
                            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
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
                              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                              title="Back to conversation list"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div
                              onClick={() => handleOpenProfile(selectedPartner.partner_id || selectedPartner.user_id || selectedPartner.id)}
                              className="flex items-center space-x-2 sm:space-x-2.5 cursor-pointer group min-w-0"
                              title="Click to view full profile"
                            >
                              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-xs overflow-hidden group-hover:ring-2 group-hover:ring-sky-500 transition-all shrink-0">
                                {selectedPartner.partner_avatar ? (
                                  <img src={selectedPartner.partner_avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  selectedPartner.partner_name?.charAt(0) || 'U'
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                                    {selectedPartner.partner_name}
                                  </h4>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                                    {selectedPartner.role === 'vendor' ? 'Vendor' : 'Student'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate">Tap to view profile</p>
                              </div>
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

                        {/* Chat Messages */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-3">
                          {chatMessages.length > 0 ? (
                            chatMessages.map((msg, idx) => {
                              const isMine = (msg.sender_id === user?.user_id) || (msg.sender_id === user?.id);
                              return (
                                <div
                                  key={msg.id || idx}
                                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-xs sm:max-w-md p-3 rounded-2xl text-xs leading-relaxed ${
                                      isMine
                                        ? 'bg-sky-500 text-white rounded-br-none shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                                    }`}
                                  >
                                    <p>{msg.content || msg.text}</p>
                                    <span className={`block text-[9px] mt-1 text-right ${isMine ? 'text-sky-100' : 'text-slate-400'}`}>
                                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                    </span>
                                  </div>
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
                            className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 font-semibold rounded-lg shrink-0 cursor-pointer text-xs"
                          >
                            📍 Stall Pickup
                          </button>
                          <button
                            onClick={() => handleSendChatMessage(`💳 Bank details for transfer: ${bankInfo.bank_name} - ${bankInfo.account_number} (${bankInfo.account_name})`)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 font-semibold rounded-lg shrink-0 cursor-pointer text-xs"
                          >
                            💳 Send Bank Info
                          </button>
                          <button
                            onClick={() => handleSendChatMessage(`✅ Your order is confirmed and currently being prepared for hostel dispatch!`)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 font-semibold rounded-lg shrink-0 cursor-pointer text-xs"
                          >
                            📦 Order Confirmed
                          </button>
                        </div>

                        {/* Message Input Form */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendChatMessage();
                          }}
                          className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
                        >
                          <input
                            type="text"
                            placeholder={`Reply to ${selectedPartner.partner_name}...`}
                            value={newMsgText}
                            onChange={(e) => setNewMsgText(e.target.value)}
                            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                          <button
                            type="submit"
                            disabled={!newMsgText.trim() || isSendingMsg}
                            className="p-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
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
                                <img src={commUser.profile_picture_url} alt="Pic" className="w-full h-full object-cover" />
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
                                <img src={f.profile_picture_url} alt="Pic" className="w-full h-full object-cover" />
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
                          <img
                            src={reel.media_url}
                            alt={reel.title}
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
                            {reel.created_at ? new Date(reel.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Comments Drawer */}
                      {activeCommentsReelId === reel.id && (
                        <div className="p-3.5 bg-slate-50 border-t border-slate-100 space-y-2.5">
                          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                            {reel.comments && reel.comments.length > 0 ? (
                              reel.comments.map((comment, idx) => (
                                <div key={comment.id || idx} className="p-2.5 bg-white rounded-xl border border-slate-100 text-xs">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-bold text-slate-900 text-[11px]">{comment.author_name}</span>
                                    <span className="text-[9px] text-slate-400">
                                      {comment.created_at ? new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                    </span>
                                  </div>
                                  <p className="text-slate-700 leading-snug">{comment.content}</p>
                                </div>
                              ))
                            ) : (
                              <div className="py-2 text-center text-[11px] text-slate-400">
                                No comments on this drop yet.
                              </div>
                            )}
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handlePostReelComment(reel.id);
                            }}
                            className="flex items-center space-x-2 pt-2 border-t border-slate-200/80"
                          >
                            <input
                              type="text"
                              placeholder="Write a comment..."
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              type="submit"
                              disabled={!newCommentText.trim() || isPostingComment}
                              className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
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
                    <img
                      src={user?.profile_picture_url || vendorStore?.logo}
                      alt={vendorStore?.business_name}
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
                          <img src={idFrontPreview} alt="Front ID Preview" className="max-h-44 w-full object-contain" />
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
                          <img src={idBackPreview} alt="Back ID Preview" className="max-h-44 w-full object-contain" />
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

      {/* ========================================================================= */}
      {/* --- FACEBOOK-STYLE MOBILE BOTTOM NAVIGATION BAR --- */}
      {/* ========================================================================= */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1.5 shadow-lg safe-bottom ${selectedPartner && activeTab === 'messages' ? 'hidden' : 'block'}`}>
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
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {pendingRequests.length}
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
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 my-auto text-center"
            >
              <button
                onClick={() => setProfileModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Profile Avatar */}
              <div className="w-20 h-20 rounded-2xl mx-auto mb-3 overflow-hidden bg-sky-100 text-sky-700 font-black text-2xl flex items-center justify-center border-2 border-sky-400 shadow-md">
                {selectedProfile.profile_picture_url ? (
                  <img src={selectedProfile.profile_picture_url} alt={selectedProfile.full_name} className="w-full h-full object-cover" />
                ) : (
                  selectedProfile.full_name?.charAt(0) || 'U'
                )}
              </div>

              {/* Full Name & Role */}
              <h3 className="text-lg font-black text-slate-900">{selectedProfile.full_name}</h3>
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
                            <img src={group.user_avatar} alt={group.user_name} className="w-full h-full object-cover" />
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

                      {currentItem.media_type === 'video' ? (
                        <video
                          src={currentItem.media_url}
                          controls
                          autoPlay
                          className="w-full h-full object-contain"
                        />
                      ) : currentItem.media_url ? (
                        <img
                          src={currentItem.media_url}
                          alt="Story"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${currentItem.background_color || 'from-emerald-600 to-teal-800'} flex items-center justify-center p-8 text-center text-white text-base font-bold leading-relaxed`}>
                          {currentItem.caption}
                        </div>
                      )}
                    </div>

                    {/* Caption & Fast Reply Bar */}
                    <div className="p-3.5 z-20 bg-gradient-to-t from-black/80 to-transparent space-y-2">
                      {currentItem.caption && currentItem.media_url && (
                        <p className="text-xs text-white bg-black/40 p-2.5 rounded-xl backdrop-blur-xs text-center">
                          {currentItem.caption}
                        </p>
                      )}

                      {!group.is_self && (
                        <div className="flex items-center space-x-2 pt-1">
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
                            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full cursor-pointer transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
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
      <AnimatePresence>
        {createStatusModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 my-auto max-h-[92vh] overflow-y-auto"
            >
              <button
                onClick={() => setCreateStatusModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer"
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
                    className={`py-1.5 rounded-lg cursor-pointer ${statusType === 'text' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-600'}`}
                  >
                    Text Announcement
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusType('image')}
                    className={`py-1.5 rounded-lg cursor-pointer ${statusType === 'image' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-600'}`}
                  >
                    Photo / Video
                  </button>
                </div>

                {statusType === 'image' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Upload Photo or Clip</label>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setStatusMediaFile(file);
                          setStatusMediaPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 cursor-pointer"
                    />
                    {statusMediaPreview && (
                      <div className="mt-2 h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
                        {statusMediaFile?.type?.startsWith('video') ? (
                          <video src={statusMediaPreview} className="h-36 w-full object-contain" controls />
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
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
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
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative border border-slate-200 my-auto max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer"
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
                      <img src={prodPreview} alt="Preview" className="w-full h-full object-cover" />
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
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
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
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative border border-slate-200 my-auto max-h-[92vh] overflow-y-auto">
              <button onClick={() => setShowServiceModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer">
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
                      <img src={svcPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
                  <textarea rows={3} placeholder="Turnaround time, what is included, special perks..." value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50">
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
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative border border-slate-200 my-auto max-h-[92vh] overflow-y-auto">
              <button onClick={() => setShowReelModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 cursor-pointer">
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
                        <video src={reelMediaPreview} controls className="h-40 w-full object-contain" />
                      ) : (
                        <img src={reelMediaPreview} alt="Preview" className="h-40 w-full object-contain" />
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

                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50">
                  {isSubmitting ? 'Uploading & Posting...' : 'Post to Campus Reels Feed'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}