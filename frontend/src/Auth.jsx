// src/Auth.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ArrowRight, Lock, Mail, Phone,
  User, Building2, Store, CheckCircle2,
  AlertCircle, ChevronDown, Eye, EyeOff, X,
  GraduationCap, Car, Video, ShoppingBag
} from 'lucide-react';

const DEFAULT_BACKEND_URL = 'https://campus-link-backend-vhxr.onrender.com';

const rawEnvUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = (rawEnvUrl && !rawEnvUrl.includes('campuslink-backend.onrender.com'))
  ? rawEnvUrl.replace(/\/+$/, '').replace(/\/api$/, '')
  : DEFAULT_BACKEND_URL;

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();

  const isInitialSignUp =
    location.pathname === '/signup' ||
    new URLSearchParams(location.search).get('tab') === 'signup' ||
    new URLSearchParams(location.search).get('type') !== null;

  const initialRoleParam = new URLSearchParams(location.search).get('type');

  const [isLogin, setIsLogin] = useState(!isInitialSignUp);
  const [role, setRole] = useState(initialRoleParam === 'vendor' ? 'vendor' : 'student');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
    university_id: '',
    matric_number: '',
    department: '',
    level: '100L',
    hostel: '',
    business_name: '',
    business_description: '',
    category_id: 1,
    agreedToTerms: false,
  });

  // Institution Selector State
  const [institutions, setInstitutions] = useState([]);
  const [instSearch, setInstSearch] = useState('');
  const [showInstDropdown, setShowInstDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);


  // Alert & Feedback Messages
  const [errorMessage, setErrorMessage] = useState('');
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  // Fetch institutions on component mount
  useEffect(() => {
    async function loadInstitutions() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/universities`);
        if (res.ok) {
          const data = await res.json();
          setInstitutions(data);
        }
      } catch (err) {
        console.warn('Could not load institutions list:', err);
      }
    }
    loadInstitutions();
  }, []);

  // Sync mode when URL changes
  useEffect(() => {
    const isSignupUrl = location.pathname === '/signup';
    setIsLogin(!isSignupUrl);
    setErrorMessage('');
    const typeParam = new URLSearchParams(location.search).get('type');
    if (typeParam === 'vendor') setRole('vendor');
    if (typeParam === 'student') setRole('student');
  }, [location.pathname, location.search]);

  // Click outside to close institution dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowInstDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Timer countdown for resend OTP cooldown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrorMessage('');
  };

  const handleSelectInstitution = (inst) => {
    setFormData((prev) => ({
      ...prev,
      university_id: inst.id,
    }));
    setInstSearch(inst.name);
    setShowInstDropdown(false);
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!formData.password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (!isLogin) {
      if (!formData.full_name.trim()) {
        setErrorMessage('Full legal name is required.');
        return;
      }
      if (!formData.phone_number.trim()) {
        setErrorMessage('Phone number is required.');
        return;
      }
      if (!formData.university_id) {
        setErrorMessage('Please select your university or polytechnic institution.');
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setErrorMessage('Passwords do not match. Please verify.');
        return;
      }
      if (!formData.agreedToTerms) {
        setErrorMessage('You must accept the CampusLink Community Safety Agreement to proceed.');
        return;
      }
    }

    setLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/register';
    const payload = isLogin
      ? { email: formData.email.trim(), password: formData.password }
      : {
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone_number: formData.phone_number.trim(),
          password: formData.password,
          role,
          university_id: formData.university_id,
          matric_number: formData.matric_number ? formData.matric_number.trim() : null,
          department: role === 'student' ? (formData.department?.trim() || null) : null,
          level: role === 'student' ? formData.level : null,
          hostel: formData.hostel?.trim() || null,
          business_name: role === 'vendor' ? (formData.business_name || `${formData.full_name}'s Store`) : null,
          business_description: role === 'vendor' ? formData.business_description : null,
          category_id: role === 'vendor' ? Number(formData.category_id) : null,
        };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        if (response.status === 408 || response.status === 504 || response.status === 502 || response.status === 503) {
          throw new Error('Server is waking up. Please wait 10 seconds and try again.');
        }
        if (response.status === 403 && data.detail && data.detail.includes('not verified')) {
          setPendingEmail(formData.email.trim());
          setShowOtpModal(true);
          setResendCooldown(30);
          throw new Error('Your email is not verified yet. Please enter the 6-digit code sent to your email.');
        }
        throw new Error(data.detail || (isLogin ? 'Invalid email or password.' : 'Registration failed. Please check your details.'));
      }

      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (localStorage.getItem('campuslink_new_signup_pending') === 'true') {
          localStorage.setItem('campuslink_show_profile_completion_prompt', 'true');
          localStorage.removeItem('campuslink_new_signup_pending');
        }

        if (data.user?.role === 'admin') {
          navigate('/admin');
        } else if (data.user?.role === 'vendor') {
          navigate('/vendor-dashboard');
        } else {
          navigate('/student-dashboard');
        }
      } else {
        localStorage.setItem('campuslink_new_signup_pending', 'true');
        setPendingEmail(formData.email.trim());
        setShowOtpModal(true);
        setResendCooldown(60);
      }
    } catch (err) {
      setErrorMessage(formatAuthError(err, 'An error occurred during authentication.'));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const formatAuthError = (err, defaultMsg = 'Operation failed. Please try again.') => {
    if (err?.name === 'AbortError') {
      return 'Server is waking up. Please wait 10 seconds and try again.';
    }
    const msg = err?.message || '';
    if (
      msg.includes('408') ||
      msg.includes('504') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('waking up')
    ) {
      return 'Server is waking up. Please wait 10 seconds and try again.';
    }
    if (
      err?.name === 'TypeError' &&
      (msg.includes('fetch') || msg.includes('NetworkError') || msg.toLowerCase().includes('load fail') || msg.toLowerCase().includes('failed to fetch'))
    ) {
      return 'Server is waking up or connection was interrupted. Please wait a few seconds and try again.';
    }
    return msg || defaultMsg;
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: otpCode.trim() }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid verification code. Please try again.');
      }

      setShowOtpModal(false);
      setIsLogin(true);
      setOtpCode('');
      setErrorMessage('');
      setOtpSuccessMessage('Email verified successfully! You can now log in.');
      localStorage.setItem('campuslink_new_signup_pending', 'true');
    } catch (err) {
      setErrorMessage(formatAuthError(err, 'Invalid verification code.'));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setErrorMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to resend verification code.');
      }

      setResendCooldown(60);
      setOtpSuccessMessage(data.message || 'A fresh verification code has been sent to your email.');
    } catch (err) {
      setErrorMessage(formatAuthError(err, 'Failed to resend verification code.'));
    } finally {
      clearTimeout(timeoutId);
      setResendLoading(false);
    }
  };

  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(instSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-50/70 via-white to-slate-50 text-slate-900 font-sans flex flex-col items-center justify-start sm:justify-center py-8 px-4 relative overflow-x-hidden">
      
      {/* Top Navigation */}
      <div className="w-full max-w-4xl mb-6 flex items-center justify-between z-10">
        <Link to="/" className="inline-flex items-center space-x-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-slate-900">
            CAMPUS<span className="text-sky-600">LINK</span>
          </span>
        </Link>
        <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-sky-600 transition-colors">
          ← Back to Homepage
        </Link>
      </div>

      {/* Main Form Container Card */}
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10 my-auto">
        
        {/* Left Brand Panel (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-sky-500 via-sky-600 to-blue-600 text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center mb-6 border border-white/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight leading-snug">
              Trade safely with verified campus peers.
            </h2>
            <p className="text-sky-100 text-xs mt-3 leading-relaxed">
              CampusLink unites verified campus storefronts, TikTok-style reels, and campus rides across Nigerian institutions.
            </p>
          </div>

          <div className="space-y-3 my-8 relative z-10 text-xs">
            <div className="flex items-start space-x-3 bg-white/10 border border-white/20 p-3.5 rounded-2xl backdrop-blur-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Student & Merchant Verified</span>
                <p className="text-sky-100 text-[11px] mt-0.5">Admin ID checks protect your orders and payments.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 bg-white/10 border border-white/20 p-3.5 rounded-2xl backdrop-blur-xs">
              <Car className="w-4 h-4 text-sky-200 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Campus Rides & Eateries</span>
                <p className="text-sky-100 text-[11px] mt-0.5">Book shuttles and order food directly to your hostel room.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 bg-white/10 border border-white/20 p-3.5 rounded-2xl backdrop-blur-xs">
              <Video className="w-4 h-4 text-sky-200 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Campus Video Reels</span>
                <p className="text-sky-100 text-[11px] mt-0.5">Share campus moments, unboxings, and study vibes.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/20 flex items-center justify-between text-[11px] text-sky-100 relative z-10 font-medium">
            <span>© 2026 CampusLink</span>
            <span>Zero-Fee Student Platform</span>
          </div>
        </div>

        {/* Right Form Area */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white">
          
          {/* Form Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Your Account'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {isLogin
                ? 'Sign in to access your campus marketplace, reels and rides.'
                : 'Join students and verified campus vendors on CampusLink.'}
            </p>
          </div>

          {/* Mode Switcher: Sign In vs Sign Up */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMessage('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isLogin ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setErrorMessage('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isLogin ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {otpSuccessMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{otpSuccessMessage}</span>
            </div>
          )}

          {/* Role Switcher (Visible during registration) */}
          {!isLogin && (
            <div className="mb-6">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-2">
                I am registering as:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center space-x-3 ${
                    role === 'student'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    role === 'student' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold">Student</span>
                    <span className="text-[10px] text-slate-500">Buy, Reels & Rides</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('vendor')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center space-x-3 ${
                    role === 'vendor'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    role === 'vendor' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold">Campus Vendor</span>
                    <span className="text-[10px] text-slate-500">Storefront Seller</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name (Sign Up Only) */}
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Full Legal Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="full_name"
                    required
                    placeholder="e.g. Chidinma Okeke"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="student@university.edu.ng or your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Phone Number (Sign Up Only) */}
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    name="phone_number"
                    required
                    placeholder="+234 801 234 5678"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Institution Selector (Sign Up Only) */}
            {!isLogin && (
              <div className="relative" ref={dropdownRef}>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  University / Polytechnic
                </label>
                <div
                  onClick={() => setShowInstDropdown(true)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 flex items-center justify-between cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-[38px] -translate-y-1/2" />
                  <span className={formData.university_id ? 'font-bold text-slate-900' : 'text-slate-400'}>
                    {instSearch || 'Select your university/polytechnic'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>

                {showInstDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                    <input
                      type="text"
                      placeholder="Search institution name..."
                      value={instSearch}
                      onChange={(e) => setInstSearch(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 mb-2 focus:outline-none focus:border-sky-500"
                    />
                    <div className="space-y-1">
                      {filteredInstitutions.map((inst) => (
                        <div
                          key={inst.id}
                          onClick={() => handleSelectInstitution(inst)}
                          className="p-2.5 rounded-xl hover:bg-sky-50 text-xs font-semibold text-slate-700 hover:text-sky-700 cursor-pointer flex items-center justify-between"
                        >
                          <span>{inst.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase">{inst.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vendor Specific Details */}
            {!isLogin && role === 'vendor' && (
              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-3">
                <span className="text-xs font-bold text-sky-900 block">Vendor Storefront Details:</span>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Business Store Name</label>
                  <input
                    type="text"
                    name="business_name"
                    required
                    placeholder="e.g. Campus Kicks & Hoodies"
                    value={formData.business_name}
                    onChange={handleInputChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Stall Location or Campus Hub</label>
                  <input
                    type="text"
                    name="hostel"
                    placeholder="e.g. SUB Food Court Stall 4"
                    value={formData.hostel}
                    onChange={handleInputChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            )}

            {/* Student Specific Details */}
            {!isLogin && role === 'student' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    placeholder="e.g. Computer Science"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hostel Room</label>
                  <input
                    type="text"
                    name="hostel"
                    placeholder="e.g. Moremi Hall B12"
                    value={formData.hostel}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Sign Up Only) */}
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirm_password"
                    required
                    placeholder="••••••••"
                    value={formData.confirm_password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Terms Agreement Checkbox (Sign Up Only) */}
            {!isLogin && (
              <div className="flex items-start space-x-2 pt-1">
                <input
                  type="checkbox"
                  name="agreedToTerms"
                  id="agreedToTerms"
                  checked={formData.agreedToTerms}
                  onChange={handleInputChange}
                  className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="agreedToTerms" className="text-[11px] text-slate-600 leading-snug cursor-pointer">
                  I agree to the CampusLink Safety Guidelines and pledge never to engage in fraud or impersonation on campus.
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              <span>{loading ? 'Processing...' : isLogin ? 'Sign In to Account' : 'Complete Registration'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Switch Prompt */}
          <div className="mt-6 text-center text-xs text-slate-500">
            {isLogin ? (
              <span>
                New to CampusLink?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-sky-600 font-bold hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-sky-600 font-bold hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>

        </div>

      </div>

      {/* --- EMAIL OTP VERIFICATION MODAL --- */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-200 text-slate-900"
            >
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-black text-slate-900 tracking-tight">Verify Your Email</h3>
              <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
                We sent a 6-digit verification code to <strong className="text-slate-800">{pendingEmail}</strong>. Please check your inbox or spam folder.
              </p>



              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-widest text-lg font-black p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/25 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify Email & Continue'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || resendLoading}
                  onClick={handleResendOtp}
                  className="text-xs font-semibold text-sky-600 hover:underline disabled:text-slate-400 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Did not receive code? Resend'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}