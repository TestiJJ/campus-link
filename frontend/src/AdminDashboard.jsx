// src/AdminDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, Store, Package, CheckCircle2,
  XCircle, AlertCircle, Eye, LogOut, Search,
  Tag, ShoppingBag, Check, X, Wrench,
  Trash2, RotateCcw, GraduationCap, Phone, Mail,
  MapPin, Clock, Filter, AlertTriangle, ChevronRight,
  Heart, MessageSquare, Video, Menu, Activity, Sparkles,
  ExternalLink, Layers, UserX, UserCheck, Ban,
  Settings, Megaphone, ShieldAlert,
  ToggleLeft, ToggleRight, Radio, Server, RefreshCw,
  Loader2, Send, Zap, Wifi
} from 'lucide-react';
import API, { getMediaUrl } from './api';
import SafeImage from './components/SafeImage';
import InstallAppButton from './components/InstallAppButton';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('vendors'); // 'vendors' | 'products' | 'services' | 'reels' | 'students' | 'stats' | 'settings'
  
  // Data States
  const [stats, setStats] = useState(null);
  const [allVendors, setAllVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [reels, setReels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState({ type: '', text: '' });

  // Vendor Filter & Search State
  const [vendorFilter, setVendorFilter] = useState('pending'); // 'pending' | 'verified' | 'rejected' | 'all'
  const [vendorSearch, setVendorSearch] = useState('');

  // Product, Service, Reel, User Search State
  const [productSearch, setProductSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [reelSearch, setReelSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all' | 'active' | 'suspended' | 'banned' | 'vendor' | 'student'

  // Admin Settings & Governance States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState('all'); // 'all' | 'students' | 'vendors'
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState({ type: '', text: '' });

  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    return localStorage.getItem('campuslink_maintenance_mode') === 'true';
  });
  const [strictMatricVerification, setStrictMatricVerification] = useState(() => {
    return localStorage.getItem('campuslink_strict_matric') !== 'false';
  });

  // Modals
  const [selectedVendorForId, setSelectedVendorForId] = useState(null);
  const [rejectModalVendor, setRejectModalVendor] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [revokeModalVendor, setRevokeModalVendor] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'product' | 'service' | 'reel', item }
  const [userToToggleStatus, setUserToToggleStatus] = useState(null); // { user, nextStatus }
  const [userToDelete, setUserToDelete] = useState(null); // target user object

  // Quick rejection presets
  const REJECTION_PRESETS = [
    'Front ID card photo is blurry or unreadable.',
    'Back of ID card is missing or incomplete.',
    'Student ID is expired. Please upload current session matric card.',
    'Applicant legal name does not match name on the ID card.',
    'Stall or campus location details are incomplete.'
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== 'admin') {
        alert('Access denied: Restricted to Platform Administrators.');
        navigate('/');
        return;
      }
      setAdminUser(parsed);
      loadAdminData();
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        API.get('/admin/stats'),
        API.get('/admin/vendors'),
        API.get('/products'),
        API.get('/services'),
        API.get('/reels'),
        API.get('/admin/users')
      ]);

      if (results[0].status === 'fulfilled') setStats(results[0].value.data);
      if (results[1].status === 'fulfilled') setAllVendors(results[1].value.data);
      if (results[2].status === 'fulfilled') setProducts(results[2].value.data);
      if (results[3].status === 'fulfilled') setServices(results[3].value.data);
      if (results[4].status === 'fulfilled') setReels(results[4].value.data);
      if (results[5].status === 'fulfilled') setUsers(results[5].value.data);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Vendor Action: Approve
  const handleApprove = async (vendorId, businessName) => {
    setActionLoading(true);
    try {
      await API.post(`/admin/vendors/${vendorId}/action`, { action: 'approve' });
      setToastMessage({ type: 'success', text: `"${businessName}" is now verified! Verified Vendor badge active.` });
      await loadAdminData();
      if (selectedVendorForId?.id === vendorId) setSelectedVendorForId(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve vendor.');
    } finally {
      setActionLoading(false);
    }
  };

  // Vendor Action: Reject
  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectModalVendor) return;
    setActionLoading(true);
    try {
      const reason = rejectionReason.trim() || 'Clear front and back photos of student/national ID required.';
      await API.post(`/admin/vendors/${rejectModalVendor.id}/action`, {
        action: 'reject',
        rejection_reason: reason
      });
      setToastMessage({ type: 'error', text: `Application for "${rejectModalVendor.business_name}" rejected.` });
      setRejectModalVendor(null);
      setRejectionReason('');
      if (selectedVendorForId?.id === rejectModalVendor.id) setSelectedVendorForId(null);
      await loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject vendor.');
    } finally {
      setActionLoading(false);
    }
  };

  // Vendor Action: Revoke Status
  const handleRevoke = async () => {
    if (!revokeModalVendor) return;
    setActionLoading(true);
    try {
      await API.post(`/admin/vendors/${revokeModalVendor.id}/action`, {
        action: 'revoke',
        rejection_reason: 'Verification status revoked by administrator for re-evaluation.'
      });
      setToastMessage({ type: 'warning', text: `Status revoked for "${revokeModalVendor.business_name}". Set to pending review.` });
      setRevokeModalVendor(null);
      await loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to revoke vendor status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Item Deletion: Product, Service, or Reel
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setActionLoading(true);
    try {
      if (itemToDelete.type === 'product') {
        await API.delete(`/products/${itemToDelete.item.id}`);
        setToastMessage({ type: 'success', text: `Product "${itemToDelete.item.name}" removed from marketplace.` });
      } else if (itemToDelete.type === 'service') {
        await API.delete(`/services/${itemToDelete.item.id}`);
        setToastMessage({ type: 'success', text: `Service "${itemToDelete.item.name}" removed from marketplace.` });
      } else if (itemToDelete.type === 'reel') {
        await API.delete(`/reels/${itemToDelete.item.id}`);
        setToastMessage({ type: 'success', text: `Reel "${itemToDelete.item.title}" removed from community feed.` });
      }
      setItemToDelete(null);
      await loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to remove ${itemToDelete.type}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // User Suspension & Reactivation
  const handleConfirmUserStatusToggle = async () => {
    if (!userToToggleStatus) return;
    setActionLoading(true);
    try {
      const { user, nextStatus } = userToToggleStatus;
      const res = await API.put(`/admin/users/${user.user_id}/status`, { status: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, status: nextStatus } : u))
      );
      setToastMessage({
        type: 'success',
        text: res.data.message || `User account successfully ${nextStatus === 'suspended' ? 'suspended' : 'reactivated'}.`
      });
      setUserToToggleStatus(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user status.');
    } finally {
      setActionLoading(false);
    }
  };

  // User Deletion & Profile Take-Down
  const handleConfirmUserDelete = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    try {
      await API.delete(`/admin/users/${userToDelete.user_id}`);
      setUsers((prev) => prev.filter((u) => u.user_id !== userToDelete.user_id));
      setToastMessage({
        type: 'success',
        text: `User profile for "${userToDelete.full_name}" has been permanently taken down.`
      });
      setUserToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('campuslink_token');
      localStorage.removeItem('user');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('cl_cache_') || k.startsWith('campus_ai_'))) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    window.location.replace('/login');
  };

  // Campus-Wide Emergency Broadcast Announcement
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      setBroadcastFeedback({ type: 'error', text: 'Please enter a message for the announcement.' });
      return;
    }
    setBroadcastLoading(true);
    setBroadcastFeedback({ type: '', text: '' });
    try {
      const res = await API.post('/admin/broadcast', {
        title: broadcastTitle.trim() || 'CampusLink Admin Notice',
        message: broadcastMessage.trim(),
        target_role: broadcastAudience
      });
      setBroadcastFeedback({
        type: 'success',
        text: res.data?.message || 'Emergency alert dispatched successfully across campus!'
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      await loadAdminData();
    } catch (err) {
      setBroadcastFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to dispatch broadcast.' });
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Purge System Caches & Reload
  const handlePurgeAllCaches = async () => {
    setActionLoading(true);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('cl_cache_') || k.startsWith('campus_ai_'))) {
          localStorage.removeItem(k);
        }
      }
      await loadAdminData();
      setToastMessage({ type: 'success', text: 'Platform database and client cache re-indexed cleanly.' });
    } catch {
      setToastMessage({ type: 'info', text: 'Platform refresh completed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMaintenance = () => {
    const nextVal = !maintenanceMode;
    setMaintenanceMode(nextVal);
    localStorage.setItem('campuslink_maintenance_mode', String(nextVal));
    setToastMessage({
      type: nextVal ? 'warning' : 'success',
      text: nextVal ? 'Platform Maintenance Mode is now ENABLED.' : 'Platform Maintenance Mode is now DISABLED.'
    });
  };

  const handleToggleStrictMatric = () => {
    const nextVal = !strictMatricVerification;
    setStrictMatricVerification(nextVal);
    localStorage.setItem('campuslink_strict_matric', String(nextVal));
    setToastMessage({
      type: 'success',
      text: nextVal ? 'Strict Matric ID verification requirement ACTIVE.' : 'Strict Matric ID requirement relaxed.'
    });
  };

  // Computed Vendors Filter
  const filteredVendors = useMemo(() => {
    return allVendors.filter((v) => {
      const matchesStatus =
        vendorFilter === 'all' ? true : v.verification_status === vendorFilter;
      const q = vendorSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.business_name?.toLowerCase().includes(q) ||
        v.user_name?.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.location?.toLowerCase().includes(q) ||
        v.university_name?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [allVendors, vendorFilter, vendorSearch]);

  const pendingCount = useMemo(() => {
    return allVendors.filter((v) => v.verification_status === 'pending').length;
  }, [allVendors]);

  const verifiedCount = useMemo(() => {
    return allVendors.filter((v) => v.verification_status === 'verified').length;
  }, [allVendors]);

  const rejectedCount = useMemo(() => {
    return allVendors.filter((v) => v.verification_status === 'rejected').length;
  }, [allVendors]);

  // Computed Products Filter
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.vendor_name?.toLowerCase().includes(q) ||
      p.vendor_location?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Computed Services Filter
  const filteredServices = useMemo(() => {
    const q = serviceSearch.toLowerCase().trim();
    if (!q) return services;
    return services.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      s.vendor_name?.toLowerCase().includes(q) ||
      s.location?.toLowerCase().includes(q)
    );
  }, [services, serviceSearch]);

  // Computed Reels Filter
  const filteredReels = useMemo(() => {
    const q = reelSearch.toLowerCase().trim();
    if (!q) return reels;
    return reels.filter((r) =>
      r.title?.toLowerCase().includes(q) ||
      r.author_name?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q)
    );
  }, [reels, reelSearch]);

  // Computed Users Filter
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userStatusFilter === 'active') {
      list = list.filter((u) => (u.status || 'active') === 'active');
    } else if (userStatusFilter === 'suspended') {
      list = list.filter((u) => u.status === 'suspended');
    } else if (userStatusFilter === 'banned') {
      list = list.filter((u) => u.status === 'banned');
    } else if (userStatusFilter === 'vendor') {
      list = list.filter((u) => u.role === 'vendor');
    } else if (userStatusFilter === 'student') {
      list = list.filter((u) => u.role === 'student' || !u.role);
    }
    const q = userSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter((u) =>
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.university_name?.toLowerCase().includes(q) ||
      u.matric_number?.toLowerCase().includes(q)
    );
  }, [users, userSearch, userStatusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col md:flex-row w-full max-w-full overflow-x-hidden">
      
      {/* --- MOBILE HEADER (md:hidden) --- */}
      <header className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 py-2.5 safe-top flex items-center justify-between sticky top-0 z-30 shadow-xs w-full">
        <Link to="/" className="flex items-center space-x-2 shrink-0 min-tap-target-sm">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-xs text-white shadow-xs">
            CL
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xs text-slate-900 tracking-tight leading-none">
              CAMPUS<span className="text-sky-600">ADMIN</span>
            </span>
            <span className="text-[9px] font-semibold text-slate-400 leading-tight">SuperAdmin</span>
          </div>
        </Link>

        <div className="flex items-center space-x-1.5 shrink-0">
          <InstallAppButton variant="header" />
          <button
            onClick={loadAdminData}
            title="Refresh Data"
            disabled={loading}
            className="p-2 min-tap-target-sm rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center justify-center"
            aria-label="Refresh Data"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
          
          {adminUser && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold max-w-[120px] truncate transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                  : 'bg-sky-50 border-sky-100 text-sky-800 hover:bg-sky-100'
              }`}
              title="Admin Settings"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{adminUser.full_name?.split(' ')[0] || 'Admin'}</span>
            </button>
          )}

          <button
            onClick={() => setShowLogoutModal(true)}
            title="Log Out Admin"
            className="p-2 min-tap-target-sm rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-colors cursor-pointer flex items-center justify-center"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- DESKTOP SIDEBAR (md:flex) --- */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 p-5 flex-col justify-between shrink-0 shadow-xs z-20">
        <div>
          <Link to="/" className="flex items-center space-x-2.5 mb-8 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              CL
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                CAMPUS<span className="text-sky-600">LINK</span>
              </span>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">SuperAdmin Console</span>
            </div>
          </Link>

          {/* Admin User Card */}
          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 mb-6 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-slate-900 block truncate">{adminUser?.full_name || 'Admin'}</span>
              <span className="text-[10px] text-sky-700 font-medium">Platform Administrator</span>
            </div>
          </div>

          <nav className="space-y-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('vendors')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'vendors' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Vendors & Verification</span>
              {pendingCount > 0 && (
                <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === 'vendors' ? 'bg-white text-sky-700' : 'bg-amber-100 text-amber-800 animate-pulse'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'products' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Marketplace Products</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'products' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'services' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Campus Services</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'services' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}>
                {services.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reels')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'reels' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Reels & Likes</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'reels' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}>
                {reels.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'students' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Registered Students</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'students' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}>
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'stats' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Platform Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-sky-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Admin Settings</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <InstallAppButton variant="header" className="w-full justify-center" />
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full py-2.5 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out Admin</span>
          </button>
        </div>
      </aside>

      {/* --- FACEBOOK/STUDENT-STYLE MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1.5 py-1.5 safe-nav-bottom flex items-center justify-around shadow-lg w-full max-w-lg mx-auto">
        {/* Vendors */}
        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'vendors' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Vendors"
        >
          <div className="relative flex items-center justify-center">
            <Store className={`w-5 h-5 transition-transform ${activeTab === 'vendors' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-xs">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Vendors</span>
          {activeTab === 'vendors' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Products */}
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'products' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Products"
        >
          <div className="relative flex items-center justify-center">
            <Package className={`w-5 h-5 transition-transform ${activeTab === 'products' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Products</span>
          {activeTab === 'products' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Services */}
        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'services' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Services"
        >
          <div className="relative flex items-center justify-center">
            <Wrench className={`w-5 h-5 transition-transform ${activeTab === 'services' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Services</span>
          {activeTab === 'services' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Reels */}
        <button
          onClick={() => setActiveTab('reels')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'reels' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Reels"
        >
          <div className="relative flex items-center justify-center">
            <Video className={`w-5 h-5 transition-transform ${activeTab === 'reels' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Reels</span>
          {activeTab === 'reels' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Students */}
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'students' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Students"
        >
          <div className="relative flex items-center justify-center">
            <GraduationCap className={`w-5 h-5 transition-transform ${activeTab === 'students' ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Students</span>
          {activeTab === 'students' && (
            <span className="absolute top-0 w-8 h-1 bg-sky-500 rounded-full shadow-xs shadow-sky-500/50" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-tap-target flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all active:scale-90 cursor-pointer relative ${
            activeTab === 'settings' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
          aria-label="Admin Settings"
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

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 max-w-full overflow-x-hidden p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-28 md:pb-8">
        
        {/* --- MODERN SEGMENTED CAPSULE TAB STRIP --- */}
        <div className="mb-5 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 backdrop-blur-md rounded-2xl border border-slate-300/60 shadow-2xs min-w-max">
            {[
              { id: 'vendors', icon: Store, label: 'Vendors & ID Review', badge: pendingCount, badgeColor: 'bg-rose-500' },
              { id: 'products', icon: Package, label: 'Products', badge: products.length },
              { id: 'services', icon: Wrench, label: 'Services', badge: services.length },
              { id: 'reels', icon: Video, label: 'Reels', badge: reels.length },
              { id: 'students', icon: GraduationCap, label: 'Users & Roles', badge: users.length },
              { id: 'stats', icon: Activity, label: 'Ecosystem Analytics' },
              { id: 'settings', icon: Settings, label: 'Admin Settings', isLive: true }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer shrink-0 relative ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5] text-sky-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? (tab.badgeColor ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300')
                        : (tab.badgeColor ? 'bg-rose-500 text-white animate-bounce' : 'bg-slate-300/80 text-slate-700')
                    }`}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                  {tab.isLive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs border ${
              toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              toastMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
              'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
              {toastMessage.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{toastMessage.text}</span>
            </div>
            <button onClick={() => setToastMessage({ type: '', text: '' })} className="font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* --- TAB 1: VENDOR VERIFICATION & DIRECTORY --- */}
        {activeTab === 'vendors' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                  <span>Vendor Directory & ID Review</span>
                  <span className="text-xs bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full font-bold shrink-0">
                    {allVendors.length} Total
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Inspect student merchant ID cards, grant verified badges, or moderate store access.
                </p>
              </div>

              <button
                onClick={loadAdminData}
                disabled={loading}
                className="hidden sm:flex px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-500' : ''}`} />
                <span>Refresh Data</span>
              </button>
            </div>

            {/* Filter Pills with Icons */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl text-xs font-bold overflow-x-auto">
                <button
                  onClick={() => setVendorFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                    vendorFilter === 'pending' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pending</span>
                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full text-[10px]">
                    {pendingCount}
                  </span>
                </button>

                <button
                  onClick={() => setVendorFilter('verified')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                    vendorFilter === 'verified' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Verified</span>
                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full text-[10px]">
                    {verifiedCount}
                  </span>
                </button>

                <button
                  onClick={() => setVendorFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                    vendorFilter === 'rejected' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Rejected</span>
                  <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full text-[10px]">
                    {rejectedCount}
                  </span>
                </button>

                <button
                  onClick={() => setVendorFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                    vendorFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All ({allVendors.length})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search store, applicant, campus..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span className="text-xs text-slate-500 font-semibold">Loading vendor profiles...</span>
              </div>
            ) : filteredVendors.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
                  >
                    <div>
                      {/* Vendor Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 font-black text-base flex items-center justify-center shrink-0">
                            {vendor.logo ? (
                              <SafeImage src={vendor.logo} alt={vendor.business_name} fallbackType="store" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                              <Store className="w-6 h-6" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <h3 className="font-bold text-base text-slate-900 leading-snug truncate">{vendor.business_name}</h3>
                            <span className="text-xs text-slate-500 block truncate">
                              Applicant: <strong className="text-slate-800">{vendor.user_name}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {vendor.verification_status === 'verified' && (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold flex items-center space-x-1 shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        )}
                        {vendor.verification_status === 'pending' && (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-extrabold flex items-center space-x-1 shrink-0 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}
                        {vendor.verification_status === 'rejected' && (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-extrabold flex items-center space-x-1 shrink-0">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed break-words">
                        {vendor.business_description || 'No store description submitted.'}
                      </p>

                      {/* Store Meta Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-5">
                        <div className="bg-slate-50 p-2.5 rounded-xl min-w-0 overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center space-x-1 mb-0.5 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Campus</span>
                          </span>
                          <span className="font-semibold text-slate-800 truncate block">{vendor.university_name}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl min-w-0 overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center space-x-1 mb-0.5 truncate">
                            <Store className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Stall Location</span>
                          </span>
                          <span className="font-semibold text-slate-800 truncate block">{vendor.location || 'SUB Food Court'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl min-w-0 overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center space-x-1 mb-0.5 truncate">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Phone</span>
                          </span>
                          <span className="font-semibold text-slate-800 truncate block">{vendor.phone || 'No phone'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl min-w-0 overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center space-x-1 mb-0.5 truncate">
                            <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Category</span>
                          </span>
                          <span className="font-semibold text-sky-700 truncate block">{vendor.category_name}</span>
                        </div>
                      </div>

                      {/* Rejection Note Warning if Rejected */}
                      {vendor.verification_status === 'rejected' && vendor.rejection_reason && (
                        <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold block">Rejection Feedback:</strong>
                            <span>{vendor.rejection_reason}</span>
                          </div>
                        </div>
                      )}

                      {/* ID Card Previews (Front & Back) */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">Submitted Student / National ID Photos:</span>
                          {(vendor.id_card_front || vendor.id_card_back) && (
                            <button
                              onClick={() => setSelectedVendorForId(vendor)}
                              className="text-sky-600 hover:text-sky-700 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect High-Res</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div
                            onClick={() => vendor.id_card_front && setSelectedVendorForId(vendor)}
                            className="h-28 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 cursor-pointer relative group"
                          >
                            {vendor.id_card_front ? (
                              <SafeImage src={vendor.id_card_front} alt="ID Front" fallbackType="product" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">No Front ID</div>
                            )}
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                            <span className="absolute bottom-1.5 left-1.5 bg-slate-900/80 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">Front ID</span>
                          </div>

                          <div
                            onClick={() => vendor.id_card_back && setSelectedVendorForId(vendor)}
                            className="h-28 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 cursor-pointer relative group"
                          >
                            {vendor.id_card_back ? (
                              <SafeImage src={vendor.id_card_back} alt="ID Back" fallbackType="product" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">No Back ID</div>
                            )}
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                            <span className="absolute bottom-1.5 left-1.5 bg-slate-900/80 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">Back ID</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons based on status */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      {vendor.verification_status === 'pending' && (
                        <>
                          <button
                            disabled={actionLoading}
                            onClick={() => handleApprove(vendor.id, vendor.business_name)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve & Verify</span>
                          </button>

                          <button
                            disabled={actionLoading}
                            onClick={() => setRejectModalVendor(vendor)}
                            className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject Application</span>
                          </button>
                        </>
                      )}

                      {vendor.verification_status === 'verified' && (
                        <>
                          <button
                            disabled={actionLoading}
                            onClick={() => setRevokeModalVendor(vendor)}
                            className="py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span>Revoke Verified Status</span>
                          </button>

                          <span className="text-xs text-emerald-700 font-bold flex items-center justify-center sm:justify-start space-x-1 py-1 sm:py-0">
                            <Check className="w-4 h-4" />
                            <span>Active Merchant</span>
                          </span>
                        </>
                      )}

                      {vendor.verification_status === 'rejected' && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleApprove(vendor.id, vendor.business_name)}
                          className="w-full py-2.5 rounded-xl bg-sky-50 hover:bg-sky-500 text-sky-700 hover:text-white border border-sky-200 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Re-approve Application</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-10">
                <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Vendors Found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {vendorSearch ? 'No merchants matched your search.' : `No merchants with status "${vendorFilter}".`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: MARKETPLACE PRODUCTS --- */}
        {activeTab === 'products' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                  <Package className="w-6 h-6 text-sky-600 shrink-0" />
                  <span>Marketplace Products Catalog</span>
                  <span className="text-xs bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full font-bold shrink-0">
                    {products.length} Live
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Inspect student listings and remove any policy-violating products immediately.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search product, seller, location..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Product Details</th>
                      <th className="p-4">Vendor / Merchant</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Stall / Location</th>
                      <th className="p-4 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 flex items-center space-x-3">
                          <SafeImage
                            src={p.image}
                            alt={p.name}
                            fallbackType="product"
                            className="w-12 h-12 rounded-2xl object-cover bg-slate-100 shrink-0 border border-slate-200"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-snug">{p.name}</span>
                            <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.description || 'No description'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-slate-800 block">{p.vendor_name}</span>
                          {p.is_vendor_verified ? (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-0.5 mt-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verified Vendor</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-bold">Unverified</span>
                          )}
                        </td>
                        <td className="p-4 font-black text-sky-700 text-sm">
                          ₦{Number(p.price).toLocaleString()}
                        </td>
                        <td className="p-4 text-slate-600 font-medium">
                          {p.vendor_location || 'Campus Quad'}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setItemToDelete({ type: 'product', item: p })}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Remove Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                          No products found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card Layout for Smaller Screens */}
            <div className="sm:hidden space-y-3">
              {filteredProducts.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                    <SafeImage src={p.image} alt={p.name} fallbackType="product" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100" />
                    <div className="overflow-hidden min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">{p.name}</span>
                      <span className="text-xs font-black text-sky-600 block mt-0.5">₦{Number(p.price).toLocaleString()}</span>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-0.5 overflow-hidden">
                        <span className="truncate">{p.vendor_name}</span>
                        <span>•</span>
                        <span className="truncate">{p.vendor_location || 'Campus'}</span>
                      </div>
                      {p.is_vendor_verified && (
                        <span className="text-[9px] text-emerald-600 font-bold flex items-center space-x-0.5 mt-0.5">
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                          <span>Verified Merchant</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setItemToDelete({ type: 'product', item: p })}
                    className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 shrink-0 cursor-pointer transition-colors"
                    title="Remove Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs text-slate-400 font-medium block">No products found matching your search.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: CAMPUS SERVICES --- */}
        {activeTab === 'services' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                  <Wrench className="w-6 h-6 text-sky-600 shrink-0" />
                  <span>Campus Services Catalog</span>
                  <span className="text-xs bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full font-bold shrink-0">
                    {services.length} Live
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Hardcover binding, laundry pickup, laptop repairs, braiding & academic tutorials.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search service, provider, campus..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Service Details</th>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Starting Price</th>
                      <th className="p-4">Hostel / Location</th>
                      <th className="p-4 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredServices.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 flex items-center space-x-3">
                          <SafeImage
                            src={s.image}
                            alt={s.name}
                            fallbackType="product"
                            className="w-12 h-12 rounded-2xl object-cover bg-slate-100 shrink-0 border border-slate-200"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-snug">{s.name}</span>
                            <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{s.description}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-slate-800 block">{s.vendor_name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{s.vendor_phone || 'In-app Chat'}</span>
                        </td>
                        <td className="p-4 font-black text-sky-700 text-sm">
                          {s.price}
                        </td>
                        <td className="p-4 text-slate-600 font-medium">
                          {s.location || 'Campus Wide'}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setItemToDelete({ type: 'service', item: s })}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Remove Service"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredServices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                          No services found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card Layout for Smaller Screens */}
            <div className="sm:hidden space-y-3">
              {filteredServices.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                    <SafeImage src={s.image} alt={s.name} fallbackType="product" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100" />
                    <div className="overflow-hidden min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">{s.name}</span>
                      <span className="text-xs font-black text-sky-600 block mt-0.5">{s.price}</span>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-0.5 overflow-hidden">
                        <span className="truncate">{s.vendor_name}</span>
                        <span>•</span>
                        <span className="truncate">{s.location || 'Campus'}</span>
                      </div>
                      {s.vendor_phone && (
                        <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                          Tel: {s.vendor_phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setItemToDelete({ type: 'service', item: s })}
                    className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 shrink-0 cursor-pointer transition-colors"
                    title="Remove Service"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
                  <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs text-slate-400 font-medium block">No services found matching your search.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 4: CAMPUS REELS & LIKES MODERATION --- */}
        {activeTab === 'reels' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                  <Video className="w-6 h-6 text-rose-500 shrink-0" />
                  <span>Campus Reels & Community Likes</span>
                  <span className="text-xs bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-bold shrink-0">
                    {reels.length} Posts
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Inspect student video reels, track real-time likes & engagement, and take down spam.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search reels by title, creator, hostel..."
                  value={reelSearch}
                  onChange={(e) => setReelSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReels.map((reel) => (
                <div
                  key={reel.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="h-64 bg-slate-900 relative overflow-hidden">
                    <SafeImage
                      src={reel.media_url}
                      alt={reel.title}
                      fallbackType="product"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Location Badge */}
                    <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-sky-400" />
                      <span>{reel.location || 'Campus Quad'}</span>
                    </span>

                    {/* Likes & Engagement Overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                      <div className="flex items-center space-x-3 text-xs font-bold">
                        <span className="flex items-center space-x-1 text-rose-400 bg-black/50 px-2 py-1 rounded-full">
                          <Heart className="w-3.5 h-3.5 fill-current" />
                          <span>{reel.likes_count || 0} Likes</span>
                        </span>
                        <span className="flex items-center space-x-1 text-slate-200 bg-black/50 px-2 py-1 rounded-full">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{reel.comments_count || 0}</span>
                        </span>
                      </div>

                      <span className="text-[10px] bg-sky-500 text-white font-bold px-2 py-0.5 rounded-full">
                        {reel.author_role || 'Student'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">{reel.author_name}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 leading-snug line-clamp-2">{reel.title}</h4>
                      {reel.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{reel.description}</p>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">ID #{reel.id}</span>
                      <button
                        onClick={() => setItemToDelete({ type: 'reel', item: reel })}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Take Down Reel</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredReels.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 p-8">
                  <Video className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-700 text-sm">No Reels Found</h4>
                  <p className="text-xs text-slate-400 mt-1">There are no posts matching your search query.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 5: REGISTERED STUDENTS & USERS DIRECTORY --- */}
        {activeTab === 'students' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                  <GraduationCap className="w-6 h-6 text-sky-600 shrink-0" />
                  <span>Registered Students & Community Members</span>
                  <span className="text-xs bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full font-bold shrink-0">
                    {users.length} Accounts
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Manage registered campus members, enforce account suspensions, and take down abusive profiles.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, email, campus, matric..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Accounts', count: users.length },
                { id: 'active', label: 'Active', count: users.filter(u => (u.status || 'active') === 'active').length },
                { id: 'suspended', label: 'Suspended', count: users.filter(u => u.status === 'suspended').length },
                { id: 'banned', label: 'Banned', count: users.filter(u => u.status === 'banned').length },
                { id: 'vendor', label: 'Vendors', count: users.filter(u => u.role === 'vendor').length },
                { id: 'student', label: 'Students', count: users.filter(u => u.role === 'student' || !u.role).length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setUserStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                    userStatusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    userStatusFilter === tab.id
                      ? 'bg-slate-700 text-slate-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">User Name</th>
                      <th className="p-4">Contact Info</th>
                      <th className="p-4">Campus / Institution</th>
                      <th className="p-4">Department & Level</th>
                      <th className="p-4">System Role</th>
                      <th className="p-4">Account Status</th>
                      <th className="p-4">Email Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.user_id} className={`transition-colors ${u.status === 'suspended' ? 'bg-rose-50/20 hover:bg-rose-50/40' : 'hover:bg-slate-50/60'}`}>
                        <td className="p-4 font-bold text-slate-900 flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                            u.status === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                          }`}>
                            {u.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <span className="block">{u.full_name}</span>
                            {u.matric_number && (
                              <span className="text-[10px] font-mono text-slate-400 font-normal">Matric: {u.matric_number}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-800 block font-medium">{u.email}</span>
                          <span className="text-[10px] text-slate-400">{u.phone_number}</span>
                        </td>
                        <td className="p-4 text-slate-700 font-medium">
                          {u.university_name}
                        </td>
                        <td className="p-4 text-slate-600">
                          {u.department ? `${u.department} (${u.level || '300L'})` : 'Campus Member'}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'vendor' ? 'bg-sky-100 text-sky-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.status === 'banned' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center space-x-1 w-fit border border-rose-300">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              <span>Banned</span>
                            </span>
                          ) : u.status === 'suspended' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px] flex items-center space-x-1 w-fit border border-amber-200">
                              <Ban className="w-3 h-3 text-amber-600" />
                              <span>Suspended</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center space-x-1 w-fit border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {u.is_email_verified ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center space-x-1 w-fit border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px] w-fit border border-amber-200">
                              Pending OTP
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {u.user_id !== adminUser?.user_id ? (
                            <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                              {u.status === 'suspended' || u.status === 'banned' ? (
                                <button
                                  type="button"
                                  onClick={() => setUserToToggleStatus({ user: u, nextStatus: 'active' })}
                                  title="Restore full account access"
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Reactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setUserToToggleStatus({ user: u, nextStatus: 'suspended' })}
                                  title="Suspend account temporarily"
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[10px] border border-amber-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>Suspend</span>
                                </button>
                              )}

                              {u.status !== 'banned' && (
                                <button
                                  type="button"
                                  onClick={() => setUserToToggleStatus({ user: u, nextStatus: 'banned' })}
                                  title="Permanently ban user account"
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                                  <span>Ban</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setUserToDelete(u)}
                                title="Permanently take down profile"
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-slate-600" />
                                <span>Delete</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 italic">Current Admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                          No users found matching your filter or search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards for Smaller Screens */}
            <div className="sm:hidden space-y-3">
              {filteredUsers.map((u) => (
                <div key={u.user_id} className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 ${
                  u.status === 'suspended' ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 overflow-hidden min-w-0">
                      <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 shadow-xs ${
                        u.status === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {u.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">{u.full_name}</span>
                        {u.matric_number && (
                          <span className="text-[10px] font-mono text-slate-400 font-normal block truncate">Matric: {u.matric_number}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'vendor' ? 'bg-sky-100 text-sky-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {u.role}
                      </span>
                      {u.status === 'banned' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                          Banned
                        </span>
                      ) : u.status === 'suspended' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 pt-1">
                    <div className="flex items-center space-x-1.5 text-slate-500 overflow-hidden">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    {u.phone_number && (
                      <div className="flex items-center space-x-1.5 text-slate-500 overflow-hidden">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{u.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5 text-slate-500 overflow-hidden">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{u.university_name}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{u.department ? `${u.department} (${u.level || '300L'})` : 'Student Member'}</span>
                    {u.is_email_verified ? (
                      <span className="text-emerald-700 font-bold flex items-center space-x-0.5 shrink-0">
                        <Check className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold shrink-0">Unverified OTP</span>
                    )}
                  </div>

                  {u.user_id !== adminUser?.user_id && (
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {u.status === 'suspended' || u.status === 'banned' ? (
                        <button
                          type="button"
                          onClick={() => setUserToToggleStatus({ user: u, nextStatus: 'active' })}
                          className="flex-1 min-w-[90px] py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Reactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUserToToggleStatus({ user: u, nextStatus: 'suspended' })}
                          className="flex-1 min-w-[80px] py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Suspend</span>
                        </button>
                      )}
                      {u.status !== 'banned' && (
                        <button
                          type="button"
                          onClick={() => setUserToToggleStatus({ user: u, nextStatus: 'banned' })}
                          className="flex-1 min-w-[70px] py-1.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Ban</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setUserToDelete(u)}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs border border-slate-200 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
                  <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs text-slate-400 font-medium block">No users found matching your filter or search.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 6: PLATFORM ANALYTICS --- */}
        {activeTab === 'stats' && stats && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  CampusLink Ecosystem Analytics
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  High-level metrics across campus activity, merchant growth, and community transactions.
                </p>
              </div>

              <div className="hidden sm:flex px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold items-center space-x-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Verification Gate: Online</span>
              </div>
            </div>

            {/* Core Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase flex items-center space-x-1 truncate">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Registered Students</span>
                </span>
                <span className="text-xl sm:text-3xl font-black text-slate-900 mt-1 block truncate">{stats.total_students}</span>
              </div>
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase flex items-center space-x-1 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Verified Vendors</span>
                </span>
                <span className="text-xl sm:text-3xl font-black text-emerald-600 mt-1 block truncate">{stats.verified_vendors}</span>
              </div>
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase flex items-center space-x-1 truncate">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Pending Review</span>
                </span>
                <span className="text-xl sm:text-3xl font-black text-amber-600 mt-1 block truncate">{stats.pending_vendors}</span>
              </div>
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] font-bold text-sky-600 uppercase flex items-center space-x-1 truncate">
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Products</span>
                </span>
                <span className="text-xl sm:text-3xl font-black text-sky-600 mt-1 block truncate">{stats.total_products}</span>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center space-x-1 truncate">
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  <span>Student Services</span>
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block truncate">{stats.total_services}</span>
              </div>
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center space-x-1 truncate">
                  <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Campus Reels</span>
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block truncate">{stats.total_reels}</span>
              </div>
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 overflow-hidden">
                <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center space-x-1 truncate">
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  <span>Orders Processed</span>
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block truncate">{stats.total_orders}</span>
              </div>
            </div>

            {/* Platform Security Protocol Box */}
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 to-blue-950 text-white shadow-xl min-w-0 overflow-hidden">
              <div className="flex items-center space-x-2.5 mb-3">
                <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
                <h3 className="font-bold text-base">Campus ID Verification Protocol Architecture</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl mb-4">
                CampusLink enforces strict ID verification before any student merchant is permitted to publish items.
                Merchants submit high-resolution front & back photographs of their university student identification card or national e-ID.
                Unverified accounts remain sandboxed with no public marketplace visibility.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-300">
                <span className="px-3 py-1 bg-white/10 rounded-full">Bank-Grade Verification Gate</span>
                <span className="px-3 py-1 bg-white/10 rounded-full">Anti-Impersonation Protection</span>
                <span className="px-3 py-1 bg-white/10 rounded-full">Manual Admin Oversight</span>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 7: ADMIN SETTINGS & PLATFORM GOVERNANCE --- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center space-x-2.5">
                  <span>SuperAdmin Command & Platform Governance</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Live session enforcement, campus broadcasts, ID protocol verification gates, and platform diagnostics.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center space-x-2 shrink-0 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Tier-1 SuperAdmin Console</span>
                </div>
              </div>
            </div>

            {/* 1. SuperAdmin Profile & Live System Authority (Hero Card) */}
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl relative overflow-hidden border border-slate-800">
              {/* Subtle ambient blur orb */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-white/10">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg ring-2 ring-white/20 shrink-0">
                    {adminUser?.full_name?.charAt(0) || 'A'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h2 className="text-lg sm:text-xl font-black text-white truncate tracking-tight">
                        {adminUser?.full_name || 'Platform Administrator'}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 border border-sky-400/30 text-sky-300 text-[10px] font-black uppercase tracking-wider">
                        {adminUser?.role || 'admin'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 truncate">{adminUser?.email}</p>
                    <div className="flex items-center space-x-2 mt-2 text-[11px] text-emerald-300 font-semibold">
                      <span className="flex items-center space-x-1.5 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Live WebSocket: Instant Real-Time Kick (0ms)</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 font-bold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out Console</span>
                  </button>
                </div>
              </div>

              {/* Status Matrix Tiles inside Hero Card */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-5">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center space-x-2 text-sky-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold">Instant Kick Engine</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Dual-layer WebSocket broadcast + 403 API interceptor immediately locks banned accounts.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center space-x-2 text-emerald-400 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-bold">Verification Gate</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    {strictMatricVerification ? 'Mandatory ID Review Active' : 'Open Registration Mode'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center space-x-2 text-indigo-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-bold">Accounts Managed</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    {users.length} Registered Users • {allVendors.length} Merchant Stores
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Emergency Campus Announcement Broadcast Suite */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900">Campus-Wide Emergency Broadcast</h3>
                  <p className="text-xs text-slate-500">Push instant banner alerts and notifications directly to active student & vendor screens.</p>
                </div>
              </div>

              {/* Feedback Alert */}
              {broadcastFeedback.text && (
                <div className={`my-4 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs border ${
                  broadcastFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {broadcastFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{broadcastFeedback.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBroadcastFeedback({ type: '', text: '' })}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendBroadcast} className="space-y-4 mt-5">
                {/* Target Audience Segmented Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Target Audience</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'All Campus Members', desc: 'Students & Vendors' },
                      { id: 'students', label: 'Students Only', desc: 'Student Community' },
                      { id: 'vendors', label: 'Vendors Only', desc: 'Campus Merchants' }
                    ].map((aud) => (
                      <button
                        key={aud.id}
                        type="button"
                        onClick={() => setBroadcastAudience(aud.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          broadcastAudience === aud.id
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40 text-amber-950 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold block">{aud.label}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{aud.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Broadcast Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Announcement Title / Subject</label>
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. Scheduled System Optimization or Campus Safety Advisory"
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-slate-50/50"
                  />
                </div>

                {/* Broadcast Message Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Announcement Message Body</label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {broadcastMessage.length} characters
                    </span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Write the comprehensive alert or message that all active devices will receive..."
                    className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-slate-50/50 resize-none leading-relaxed"
                  />
                </div>

                {/* Delivery Notice */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                  <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Instant Real-Time Push:</strong> When dispatched, all connected sockets receive this announcement immediately. A permanent notification is also generated in users' activity inboxes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={broadcastLoading}
                  className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {broadcastLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dispatching Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Dispatch Live Campus Broadcast</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* 3. Platform Governance & System Controls */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900">Platform Governance & Security Controls</h3>
                  <p className="text-xs text-slate-500">Configure global enrollment gates and active system runtime parameters.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {/* Switch 1: Strict Matric ID */}
                <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Strict ID Verification</span>
                      <button
                        type="button"
                        onClick={handleToggleStrictMatric}
                        className="text-sky-600 hover:text-sky-700 cursor-pointer"
                        title="Toggle verification requirement"
                      >
                        {strictMatricVerification ? (
                          <ToggleRight className="w-7 h-7 text-sky-600" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-400" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Require physical student ID review before merchants can publish marketplace items.
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg inline-block w-fit ${
                    strictMatricVerification ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {strictMatricVerification ? 'Mandatory ID Enforcement' : 'Open Vendor Registration'}
                  </span>
                </div>

                {/* Switch 2: Maintenance Mode */}
                <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Maintenance Sandbox</span>
                      <button
                        type="button"
                        onClick={handleToggleMaintenance}
                        className="text-amber-600 hover:text-amber-700 cursor-pointer"
                        title="Toggle Maintenance Mode"
                      >
                        {maintenanceMode ? (
                          <ToggleRight className="w-7 h-7 text-amber-600" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-400" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Temporarily lock public order checkout for scheduled database optimization.
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg inline-block w-fit ${
                    maintenanceMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {maintenanceMode ? 'Maintenance Window Active' : 'Normal Live Operations'}
                  </span>
                </div>

                {/* Action 3: Purge System Cache */}
                <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3.5">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">System Cache & State Sync</span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Force clean memory cache, refresh feed indexing, and re-sync real-time user channels.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePurgeAllCaches}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${actionLoading ? 'animate-spin text-sky-600' : ''}`} />
                    <span>Sync Platform State</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Administrator Danger Zone */}
            <div className="p-6 sm:p-7 rounded-3xl bg-rose-50/70 border border-rose-200 shadow-xs">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-rose-900">Administrator Danger Zone</h3>
                  <p className="text-xs text-rose-700">Platform session moderation safeguards and sign-out controls.</p>
                </div>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed my-3 max-w-3xl">
                Ending your administrator session will clear local moderation credentials and redirect you to the login screen. Ensure all pending ID checks or user disputes are finalized.
              </p>
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of SuperAdmin Console</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* --- ID CARD HIGH-RES ZOOM INSPECTION MODAL --- */}
      <AnimatePresence>
        {selectedVendorForId && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-8 shadow-2xl relative my-auto"
            >
              <button
                onClick={() => setSelectedVendorForId(null)}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1 text-slate-400 hover:text-slate-800 cursor-pointer font-bold"
                aria-label="Close Inspection Modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-2 pr-8">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-black flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                    {selectedVendorForId.business_name} - ID Review
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Submitted by: <strong className="text-slate-800">{selectedVendorForId.user_name}</strong> ({selectedVendorForId.phone})
                  </p>
                </div>
              </div>

              {/* ID Cards Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-4 sm:my-6">
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">Front ID Card:</span>
                  <div className="h-44 sm:h-64 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                    {selectedVendorForId.id_card_front ? (
                      <SafeImage
                        src={selectedVendorForId.id_card_front}
                        alt="Front ID"
                        fallbackType="product"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">No Front ID Photo</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">Back ID Card:</span>
                  <div className="h-44 sm:h-64 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                    {selectedVendorForId.id_card_back ? (
                      <SafeImage
                        src={selectedVendorForId.id_card_back}
                        alt="Back ID"
                        fallbackType="product"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">No Back ID Photo</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Quick Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedVendorForId(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Close
                </button>

                {selectedVendorForId.verification_status !== 'rejected' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      setRejectModalVendor(selectedVendorForId);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Application</span>
                  </button>
                )}

                {selectedVendorForId.verification_status !== 'verified' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleApprove(selectedVendorForId.id, selectedVendorForId.business_name)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Verify</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- VENDOR REJECTION MODAL WITH PRESETS --- */}
      <AnimatePresence>
        {rejectModalVendor && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-8 shadow-2xl relative my-auto"
            >
              <button
                onClick={() => {
                  setRejectModalVendor(null);
                  setRejectionReason('');
                }}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1 text-slate-400 hover:text-slate-800 cursor-pointer font-bold"
                aria-label="Close Rejection Modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2.5 mb-2 pr-8">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  Reject Vendor Application
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Explain why <strong className="text-slate-800">{rejectModalVendor.business_name}</strong> cannot be verified. This reason will appear in the vendor's dashboard so they can re-upload.
              </p>

              {/* Quick Presets */}
              <span className="text-[11px] font-bold text-slate-600 block mb-2">Quick Rejection Presets:</span>
              <div className="space-y-1.5 mb-4">
                {REJECTION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className="w-full text-left text-xs p-2.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 text-slate-700 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>{preset}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </button>
                ))}
              </div>

              <form onSubmit={handleReject} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Feedback Note to Merchant:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter custom rejection reason..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalVendor(null);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{actionLoading ? 'Rejecting...' : 'Confirm Rejection'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- REVOKE STATUS MODAL --- */}
      <AnimatePresence>
        {revokeModalVendor && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">
                Revoke Verified Status?
              </h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Are you sure you want to revoke verified status for <strong className="text-slate-800">{revokeModalVendor.business_name}</strong>?
                Their store will be placed in pending review until authorized again.
              </p>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setRevokeModalVendor(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRevoke}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  {actionLoading ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CONFIRM DELETE PRODUCT / SERVICE / REEL MODAL --- */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-4">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">
                Remove {itemToDelete.type.toUpperCase()} from Platform?
              </h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-800">{itemToDelete.item.name || itemToDelete.item.title}</strong>?
                This action is permanent.
              </p>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  {actionLoading ? 'Removing...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CONFIRM USER SUSPEND / REACTIVATE MODAL --- */}
      <AnimatePresence>
        {userToToggleStatus && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative my-auto"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold mb-4 ${
                userToToggleStatus.nextStatus === 'banned'
                  ? 'bg-rose-100 text-rose-800'
                  : userToToggleStatus.nextStatus === 'suspended'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {userToToggleStatus.nextStatus === 'banned' ? (
                  <ShieldAlert className="w-6 h-6 text-rose-600" />
                ) : userToToggleStatus.nextStatus === 'suspended' ? (
                  <Ban className="w-6 h-6 text-amber-600" />
                ) : (
                  <UserCheck className="w-6 h-6 text-emerald-600" />
                )}
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">
                {userToToggleStatus.nextStatus === 'banned'
                  ? 'Ban User Account Permanently?'
                  : userToToggleStatus.nextStatus === 'suspended'
                  ? 'Suspend User Account?'
                  : 'Reactivate User Account?'}
              </h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                {userToToggleStatus.nextStatus === 'banned' ? (
                  <>
                    Are you sure you want to permanently ban <strong className="text-slate-800">{userToToggleStatus.user.full_name}</strong> ({userToToggleStatus.user.email})?
                    Their active sessions will be terminated immediately in real time, and they will be barred from creating or accessing any campus account.
                  </>
                ) : userToToggleStatus.nextStatus === 'suspended' ? (
                  <>
                    Are you sure you want to suspend <strong className="text-slate-800">{userToToggleStatus.user.full_name}</strong> ({userToToggleStatus.user.email})?
                    Their active sessions will be terminated immediately in real time, and they will not be able to log in or interact with the platform until reactivated.
                  </>
                ) : (
                  <>
                    Are you sure you want to reactivate <strong className="text-slate-800">{userToToggleStatus.user.full_name}</strong>?
                    Their account will immediately regain access to log in and participate in campus activities.
                  </>
                )}
              </p>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setUserToToggleStatus(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmUserStatusToggle}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 text-center ${
                    userToToggleStatus.nextStatus === 'banned'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : userToToggleStatus.nextStatus === 'suspended'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {actionLoading
                    ? 'Updating...'
                    : userToToggleStatus.nextStatus === 'banned'
                    ? 'Confirm Permanent Ban'
                    : userToToggleStatus.nextStatus === 'suspended'
                    ? 'Confirm Suspension'
                    : 'Confirm Reactivation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CONFIRM TAKE DOWN / DELETE STUDENT PROFILE MODAL --- */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-4">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">
                Permanently Take Down Profile?
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Are you sure you want to permanently delete the profile of <strong className="text-slate-800">{userToDelete.full_name}</strong> ({userToDelete.email})?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-6 text-[11px] text-rose-800 space-y-1">
                <p className="font-bold">This permanent action will wipe:</p>
                <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                  <li>Profile credentials and campus registration</li>
                  <li>All marketplace listings and vendor stores</li>
                  <li>Reels, direct messages, peer friend links, and notifications</li>
                </ul>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmUserDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  {actionLoading ? 'Deleting...' : 'Permanently Take Down'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CONFIRM ADMIN LOGOUT MODAL --- */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-4">
                <LogOut className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">
                End Administrator Session?
              </h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                You are about to sign out of the CampusLink Administrator Command Center. To resume platform moderation, you will need to re-authenticate with your SuperAdmin credentials.
              </p>
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Stay Signed In
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer text-center flex items-center justify-center space-x-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Confirm Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
