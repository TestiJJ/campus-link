// src/Auth.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ArrowRight, Lock, Mail, Phone,
  User, Building2, Store, CheckCircle2,
  AlertCircle, ChevronDown, Eye, EyeOff, X,
  GraduationCap, Car, Video, ShoppingBag,
  Activity, RefreshCw, Wifi, WifiOff, KeyRound
} from 'lucide-react';
import InstallAppButton from './components/InstallAppButton';

const DEFAULT_BACKEND_URL = 'https://campus-link-backend-vhxr.onrender.com';

const rawEnvUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = (rawEnvUrl && !rawEnvUrl.includes('campuslink-backend.onrender.com'))
  ? rawEnvUrl.replace(/\/+$/, '').replace(/\/api$/, '')
  : DEFAULT_BACKEND_URL;

const DEFAULT_INSTITUTIONS = [
  { id: 52, name: "Joseph Ayo Babalola University, Ikeji-Arakeji", abbreviation: "JABU", state: "Osun", type: "Private" },
  { id: 25, name: "University of Lagos", abbreviation: "UNILAG", state: "Lagos", type: "Federal" },
  { id: 22, name: "University of Ibadan", abbreviation: "UI", state: "Oyo", type: "Federal" },
  { id: 18, name: "Obafemi Awolowo University, Ile-Ife", abbreviation: "OAU", state: "Osun", type: "Federal" },
  { id: 12, name: "Federal University of Technology, Akure", abbreviation: "FUTA", state: "Ondo", type: "Federal" },
  { id: 44, name: "Afe Babalola University, Ado-Ekiti", abbreviation: "ABUAD", state: "Ekiti", type: "Private" },
  { id: 49, name: "Covenant University, Ota", abbreviation: "CU", state: "Ogun", type: "Private" },
  { id: 46, name: "Babcock University, Ilishan-Remo", abbreviation: "BABCOCK", state: "Ogun", type: "Private" },
  { id: 38, name: "Lagos State University, Ojo", abbreviation: "LASU", state: "Lagos", type: "State" },
  { id: 37, name: "Ladoke Akintola University of Technology", abbreviation: "LAUTECH", state: "Oyo", type: "State" },
  { id: 50, name: "Elizade University, Ilara-Mokin", abbreviation: "ELIZADE", state: "Ondo", type: "Private" },
  { id: 51, name: "Lead City University, Ibadan", abbreviation: "LCU", state: "Oyo", type: "Private" },
  { id: 54, name: "Redeemer's University, Ede", abbreviation: "RUN", state: "Osun", type: "Private" }
];

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();

  const isInitialSignUp =
    location.pathname === '/signup' ||
    new URLSearchParams(location.search).get('tab') === 'signup' ||
    new URLSearchParams(location.search).get('type') !== null;

  const initialRoleParam = new URLSearchParams(location.search).get('type');
  const initialRole = (initialRoleParam === 'vendor' || initialRoleParam === 'student') ? initialRoleParam : 'student';

  const [isLogin, setIsLogin] = useState(!isInitialSignUp);
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Diagnostic Server Status State
  const [serverStatus, setServerStatus] = useState('checking'); // 'online' | 'waking' | 'offline' | 'checking'
  const [serverPingMs, setServerPingMs] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Form State
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
  const [institutions, setInstitutions] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_universities');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasJabu = parsed.some(u => (u.abbreviation || '').toUpperCase() === 'JABU' || (u.name || '').includes('Babalola'));
          if (!hasJabu) {
            parsed.unshift({
              id: 52,
              name: "Joseph Ayo Babalola University, Ikeji-Arakeji",
              abbreviation: "JABU",
              state: "Osun",
              type: "Private"
            });
          }
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_INSTITUTIONS;
  });
  const [instSearch, setInstSearch] = useState('');
  const [showInstDropdown, setShowInstDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Enter email, 2: Enter code & new password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Alert & Feedback Messages
  const [errorMessage, setErrorMessage] = useState(() => {
    try {
      const alertMsg = sessionStorage.getItem('auth_alert');
      if (alertMsg) {
        sessionStorage.removeItem('auth_alert');
        return alertMsg;
      }
    } catch {}
    return '';
  });
  const [invalidFieldId, setInvalidFieldId] = useState(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  // Diagnostic Server Health Check (Warms up Render backend & checks reachability)
  const checkServerHealth = async (isInitial = false) => {
    setIsCheckingHealth(true);
    if (!isInitial) setServerStatus('checking');
    const start = performance.now();

    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET'
      });
      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        setServerStatus('online');
        setServerPingMs(elapsed);
        console.log(`[CampusLink Server Ping] Live & Reachable in ${elapsed}ms`);
      } else {
        setServerStatus('waking');
        setServerPingMs(elapsed);
      }
    } catch (err) {
      console.warn('[CampusLink Server Ping] Notice:', err);
      setServerStatus('offline');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Pre-Login Health Ping on Mount (Warms up server while user types)
  useEffect(() => {
    checkServerHealth(true);
  }, []);

  // Fetch institutions on component mount
  useEffect(() => {
    async function loadInstitutions() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/universities`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const hasJabu = data.some(u => (u.abbreviation || '').toUpperCase() === 'JABU' || (u.name || '').includes('Joseph Ayo Babalola'));
            if (!hasJabu) {
              data.push({
                id: 52,
                name: "Joseph Ayo Babalola University, Ikeji-Arakeji",
                abbreviation: "JABU",
                state: "Osun",
                type: "Private"
              });
            }
            data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setInstitutions(data);
            try {
              localStorage.setItem('cached_universities', JSON.stringify(data));
            } catch {}
          }
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

  // Timer countdown for forgot password resend cooldown
  useEffect(() => {
    let timer;
    if (forgotCooldown > 0) {
      timer = setTimeout(() => setForgotCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [forgotCooldown]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrorMessage('');
    setEmailAlreadyExists(false);
    setInvalidFieldId(null);
  };

  const handleSelectInstitution = (inst) => {
    setFormData((prev) => ({
      ...prev,
      university_id: inst.id || inst.abbreviation || inst.name,
    }));
    setInstSearch(inst.abbreviation ? `${inst.name} (${inst.abbreviation})` : inst.name);
    setShowInstDropdown(false);
    setErrorMessage('');
    setInvalidFieldId(null);
  };

  const formatAuthError = (err, serverData = null, defaultMsg = 'Operation failed. Please try again.') => {
    // 1. Direct Backend Detail Message (e.g., "Invalid email or password", "Database connection failed", etc.)
    if (serverData?.detail && typeof serverData.detail === 'string') {
      return serverData.detail;
    }

    const msg = String(err?.message || '');
    const code = String(err?.code || '');

    // 2. Network Connection Breakdown (ERR_NETWORK, net::ERR_FAILED, Host unreachable)
    if (
      code === 'ERR_NETWORK' ||
      err?.name === 'TypeError' ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('net::ERR_FAILED') ||
      msg.toLowerCase().includes('network error')
    ) {
      return 'Cannot connect to CampusLink server. Please verify backend service status on Render.';
    }

    // 3. HTTP Gateway Timeouts
    if (
      msg.includes('408') ||
      msg.includes('504') ||
      msg.includes('502') ||
      msg.includes('503')
    ) {
      return 'Server is warming up on Render. Please wait a few seconds and try again.';
    }

    return msg || defaultMsg;
  };

  const triggerValidationError = (msg, elementId = null) => {
    setErrorMessage(msg);
    setInvalidFieldId(elementId);
    if (elementId === 'field-university') {
      setShowInstDropdown(true);
    }
    setTimeout(() => {
      let targetEl = elementId ? document.getElementById(elementId) : null;
      if (!targetEl) {
        targetEl = document.getElementById('auth-error-banner-bottom') || document.getElementById('auth-error-banner-top');
      }
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (targetEl.focus && typeof targetEl.focus === 'function') {
          try { targetEl.focus(); } catch (_) {}
        }
      }
    }, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setEmailAlreadyExists(false);
    setInvalidFieldId(null);

    if (isLogin) {
      if (!formData.email.trim()) {
        triggerValidationError('Please enter your email address.', 'field-email');
        return;
      }
      if (!formData.password) {
        triggerValidationError('Please enter your password.', 'field-password');
        return;
      }
    } else {
      // Registration: validate fields in visual order from top to bottom
      if (!formData.full_name.trim()) {
        triggerValidationError('Full legal name is required.', 'field-full_name');
        return;
      }
      if (!formData.email.trim()) {
        triggerValidationError('Please enter your email address.', 'field-email');
        return;
      }
      if (!formData.phone_number.trim()) {
        triggerValidationError('Phone number is required.', 'field-phone_number');
        return;
      }
      if (!formData.university_id) {
        triggerValidationError('Please select your university or polytechnic institution.', 'field-university');
        return;
      }
      if (role === 'vendor' && !formData.business_name.trim()) {
        triggerValidationError('Business store name is required for vendor registration.', 'field-business_name');
        return;
      }
      if (!formData.password) {
        triggerValidationError('Please enter a password.', 'field-password');
        return;
      }
      if (formData.password.length < 6) {
        triggerValidationError('Password must be at least 6 characters long.', 'field-password');
        return;
      }
      if (formData.password !== formData.confirm_password) {
        triggerValidationError('Passwords do not match. Please verify.', 'field-confirm_password');
        return;
      }
      if (!formData.agreedToTerms) {
        triggerValidationError('You must accept the CampusLink Community Safety Agreement to proceed.', 'agreedToTerms');
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

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        console.error('[CampusLink Auth Error Response]', {
          status: response.status,
          statusText: response.statusText,
          detail: data?.detail,
          data
        });

        const detailText = String(data?.detail || '').toLowerCase();

        // Case 1: Email already fully registered — switch to login, do NOT open OTP modal
        if (!isLogin && response.status === 400 && detailText.includes('email is already registered')) {
          setEmailAlreadyExists(true);
          triggerValidationError('An account with this email already exists. Sign in instead.', 'auth-error-banner-bottom');
          return;
        }

        // Case 2: Email registered but not yet verified — open OTP modal so user can verify
        if (!isLogin && (response.status === 403 || (response.status === 400 && detailText.includes('not verified')))) {
          setPendingEmail(formData.email.trim());
          setShowOtpModal(true);
          setResendCooldown(30);
          setErrorMessage('This email is pending verification. Enter the 6-digit code sent to your inbox.');
          return;
        }

        // Case 3: Login with unverified email
        if (isLogin && response.status === 403 && detailText.includes('not verified')) {
          setPendingEmail(formData.email.trim());
          setShowOtpModal(true);
          setResendCooldown(30);
          setErrorMessage('Your email is not verified yet. Please enter the 6-digit code sent to your email.');
          return;
        }

        const finalErr = formatAuthError(null, data, isLogin ? 'Invalid email or password.' : 'Registration failed. Please check your details.');
        triggerValidationError(finalErr, 'auth-error-banner-bottom');
        return;
      }

      // Success Handling
      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.vendor_store) {
          try {
            localStorage.setItem('cl_cache_vendor_store', JSON.stringify(data.vendor_store));
          } catch {}
        }
        if (data.user) {
          try {
            localStorage.setItem('cl_cache_student_user', JSON.stringify(data.user));
          } catch {}
        }

        if (localStorage.getItem('campuslink_new_signup_pending') === 'true') {
          localStorage.setItem('campuslink_show_profile_completion_prompt', 'true');
          localStorage.removeItem('campuslink_new_signup_pending');
        }

        if (data.user?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (data.user?.role === 'vendor') {
          navigate('/vendor-dashboard', { replace: true });
        } else {
          navigate('/student-dashboard', { replace: true });
        }
      } else {
        localStorage.setItem('campuslink_new_signup_pending', 'true');
        setPendingEmail(formData.email.trim());
        if (data.message) {
          setOtpSuccessMessage(data.message);
        }
        setShowOtpModal(true);
        setResendCooldown(60);
      }
    } catch (err) {
      console.error('[CampusLink Auth Exception]', err);
      const finalErr = formatAuthError(err, null, isLogin ? 'Invalid email or password.' : 'Registration failed. Please check your details.');
      triggerValidationError(finalErr, 'auth-error-banner-bottom');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: otpCode.trim() })
      });

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

      // Attempt automatic login after verification
      try {
        const loginRes = await fetch(`${API_BASE_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pendingEmail, password: formData.password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem('token', loginData.access_token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          if (loginData.user?.role === 'admin') navigate('/admin', { replace: true });
          else if (loginData.user?.role === 'vendor') navigate('/vendor-dashboard', { replace: true });
          else navigate('/student-dashboard', { replace: true });
        } else {
          setErrorMessage(formatAuthError(null, loginData, 'Login after verification failed.'));
        }
      } catch (loginErr) {
        setErrorMessage(formatAuthError(loginErr, null, 'Login after verification failed.'));
      }

      localStorage.setItem('campuslink_new_signup_pending', 'true');
    } catch (err) {
      setErrorMessage(formatAuthError(err, null, 'Invalid verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail })
      });

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
      setErrorMessage(formatAuthError(err, null, 'Failed to resend verification code.'));
    } finally {
      setResendLoading(false);
    }
  };

  const handleOpenForgotPassword = (prefillEmail) => {
    const targetEmail = (typeof prefillEmail === 'string' && prefillEmail) ? prefillEmail : (formData.email || '');
    setForgotEmail(targetEmail);
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotStep(1);
    setForgotError('');
    setForgotSuccess('');
    setShowForgotModal(true);
  };

  const handleSendResetCode = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      let data = {};
      try { data = await response.json(); } catch {}

      if (!response.ok) {
        throw new Error(data.detail || 'Could not find an account with this email.');
      }

      setForgotStep(2);
      setForgotCooldown(60);
      setForgotSuccess(data.message || 'A 6-digit reset code has been sent to your email.');
    } catch (err) {
      setForgotError(err.message || 'Failed to send password reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (forgotCooldown > 0 || forgotLoading) return;
    setForgotLoading(true);
    setForgotError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() })
      });

      let data = {};
      try { data = await response.json(); } catch {}

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to resend code.');
      }

      setForgotCooldown(60);
      setForgotSuccess('A fresh 6-digit reset code has been sent to your email.');
    } catch (err) {
      setForgotError(err.message || 'Failed to resend reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    setForgotError('');

    const cleanCode = forgotOtp.trim();
    if (cleanCode.length !== 6) {
      setForgotError('Please enter the full 6-digit code sent to your email.');
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please verify both fields.');
      return;
    }

    setForgotLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          code: cleanCode,
          new_password: forgotNewPassword
        })
      });

      let data = {};
      try { data = await response.json(); } catch {}

      if (!response.ok) {
        throw new Error(data.detail || 'Password reset failed. Please check the code.');
      }

      // Success! Close modal and prompt user to sign in
      setShowForgotModal(false);
      setIsLogin(true);
      setFormData(prev => ({
        ...prev,
        email: forgotEmail.trim().toLowerCase(),
        password: ''
      }));
      setOtpSuccessMessage(data.message || 'Password reset successful! Please sign in with your new password.');
      setErrorMessage('');
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const filteredInstitutions = institutions.filter((inst) => {
    const q = (instSearch || '').toLowerCase().trim();
    if (!q) return true;

    const cleanQ = q.replace(/\buni\b/g, 'university').trim();
    const nameLower = (inst.name || '').toLowerCase();
    const abbrLower = (inst.abbreviation || '').toLowerCase();
    const stateLower = (inst.state || '').toLowerCase();

    // 1. Direct matches
    if (nameLower.includes(q) || abbrLower.includes(q) || stateLower.includes(q)) return true;
    if (cleanQ && nameLower.includes(cleanQ)) return true;

    // 2. Tokenized search (e.g. "joseph ayo babalola uni")
    const words = q.split(/\s+/).filter(Boolean);
    const allTokensMatch = words.every((token) => {
      const tokenNorm = token === 'uni' ? 'university' : token;
      return nameLower.includes(tokenNorm) || abbrLower.includes(token) || stateLower.includes(token);
    });
    return allTokensMatch;
  });

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-50/70 via-white to-slate-50 text-slate-900 font-sans flex flex-col items-center justify-start sm:justify-center py-8 px-4 relative overflow-x-hidden">

      {/* Top Navigation */}
      <div className="w-full max-w-4xl mb-6 flex items-center justify-between z-10">
        <Link to="/" className="inline-flex items-center space-x-2.5 group">
          <img
            src="/logo.png"
            alt="CampusLink"
            className="w-9 h-9 rounded-xl object-contain shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform"
          />
          <span className="font-extrabold text-sm tracking-tight text-slate-900">
            CAMPUS<span className="text-sky-600">LINK</span>
          </span>
        </Link>
        <div className="flex items-center space-x-2.5">
          <InstallAppButton variant="header" />
          <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-sky-600 transition-colors">
            ← Back to Homepage
          </Link>
        </div>
      </div>

      {/* Main Form Container Card */}
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10 my-auto">

        {/* Left Brand Panel (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-sky-500 via-sky-600 to-blue-600 text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs p-1 mb-6 border border-white/30 shadow-md">
              <img src="/logo.png" alt="CampusLink" className="w-full h-full object-contain rounded-xl" />
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
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-4">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMessage('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isLogin ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${!isLogin ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Create Account
            </button>
          </div>


          {/* Alerts */}
          {errorMessage && (
            <div id="auth-error-banner-top" className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
              {/* Show "Sign In Instead" & "Forgot Password" CTAs when email is already registered */}
              {emailAlreadyExists && (
                <div className="mt-2.5 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setEmailAlreadyExists(false);
                      setErrorMessage('');
                    }}
                    className="w-full py-2 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <span>Sign In Instead</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenForgotPassword(formData.email)}
                    className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-sky-600" />
                    <span>Forgot password? Reset it here</span>
                  </button>
                </div>
              )}
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
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center space-x-3 ${role === 'student'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${role === 'student' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
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
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center space-x-3 ${role === 'vendor'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${role === 'vendor' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
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
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Full Name (Sign Up Only) */}
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Full Legal Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="field-full_name"
                    type="text"
                    name="full_name"
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
                  id="field-email"
                  type="email"
                  name="email"
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
                    id="field-phone_number"
                    type="tel"
                    name="phone_number"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">
                    University / Polytechnic <span className="text-rose-500">*</span>
                  </label>
                  {invalidFieldId === 'field-university' && (
                    <span className="text-[10px] font-bold text-rose-600 animate-pulse">Required</span>
                  )}
                </div>
                <div
                  id="field-university"
                  tabIndex={0}
                  onClick={() => setShowInstDropdown(true)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl text-xs flex items-center justify-between cursor-pointer focus:outline-none transition-all ${
                    invalidFieldId === 'field-university'
                      ? 'bg-rose-50 border-2 border-rose-500 ring-2 ring-rose-200 text-rose-900 shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-sky-500'
                  }`}
                >
                  <Building2 className={`w-4 h-4 absolute left-3.5 top-[38px] -translate-y-1/2 ${invalidFieldId === 'field-university' ? 'text-rose-500' : 'text-slate-400'}`} />
                  <span className={formData.university_id ? 'font-bold text-slate-900' : (invalidFieldId === 'field-university' ? 'font-bold text-rose-600' : 'text-slate-400')}>
                    {instSearch || (invalidFieldId === 'field-university' ? '⚠️ Click here to select your university' : 'Select your university/polytechnic')}
                  </span>
                  <ChevronDown className={`w-4 h-4 ${invalidFieldId === 'field-university' ? 'text-rose-500' : 'text-slate-400'}`} />
                </div>
                {invalidFieldId === 'field-university' && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center space-x-1">
                    <span>⚠️ Please click above to pick your school from the list.</span>
                  </p>
                )}

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
                          key={inst.id || inst.name}
                          onClick={() => handleSelectInstitution(inst)}
                          className="p-2.5 rounded-xl hover:bg-sky-50 text-xs font-semibold text-slate-700 hover:text-sky-700 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <span>{inst.name}</span>
                            {inst.abbreviation && (
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-md">
                                {inst.abbreviation}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase shrink-0 ml-2">{inst.type || 'University'}</span>
                        </div>
                      ))}
                      {filteredInstitutions.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400">
                          No institution found matching "{instSearch}".
                        </div>
                      )}
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
                    id="field-business_name"
                    type="text"
                    name="business_name"
                    placeholder="e.g. Campus Kicks & Hoodies"
                    value={formData.business_name}
                    onChange={handleInputChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Stall Location or Campus Hub</label>
                    <span className="text-[9px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">Optional</span>
                  </div>
                  <input
                    type="text"
                    name="hostel"
                    placeholder="e.g. SUB Food Court Stall 4 (optional)"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">Department</label>
                    <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">Optional</span>
                  </div>
                  <input
                    type="text"
                    name="department"
                    placeholder="e.g. Computer Science (optional)"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">Hostel Room</label>
                    <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">Optional</span>
                  </div>
                  <input
                    type="text"
                    name="hostel"
                    placeholder="e.g. Moremi Hall B12 (optional)"
                    value={formData.hostel}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => handleOpenForgotPassword(formData.email)}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="field-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
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
                    id="field-confirm_password"
                    type={showPassword ? 'text' : 'password'}
                    name="confirm_password"
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

            {/* Bottom Error Banner right above submit button for instant visibility without scrolling */}
            {errorMessage && (
              <div id="auth-error-banner-bottom" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
                {emailAlreadyExists && (
                  <div className="mt-2.5 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(true);
                        setEmailAlreadyExists(false);
                        setErrorMessage('');
                      }}
                      className="w-full py-2 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <span>Sign In Instead</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenForgotPassword(formData.email)}
                      className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-sky-600" />
                      <span>Forgot password? Reset it here</span>
                    </button>
                  </div>
                )}
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

      {/* --- FORGOT PASSWORD MODAL --- */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-200 text-slate-900"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
                <KeyRound className="w-6 h-6" />
              </div>

              {forgotStep === 1 ? (
                <>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Reset Your Password</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
                    Enter your registered email address and we'll send you a 6-digit verification code to choose a new password.
                  </p>

                  {forgotError && (
                    <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSendResetCode} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          placeholder="student@university.edu.ng or your email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail.trim()}
                      className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/25 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5"
                    >
                      <span>{forgotLoading ? 'Sending code...' : 'Send 6-Digit Reset Code'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel and return to sign in
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Set New Password</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                    Enter the 6-digit code sent to <strong className="text-slate-800">{forgotEmail}</strong> and choose a secure new password.
                  </p>

                  {forgotSuccess && (
                    <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{forgotSuccess}</span>
                    </div>
                  )}

                  {forgotError && (
                    <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center tracking-widest text-lg font-black p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        New Password (Min. 6 Characters)
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={forgotShowPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setForgotShowPassword(!forgotShowPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {forgotShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={forgotShowPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading || forgotOtp.length < 6 || forgotNewPassword.length < 6 || forgotNewPassword !== forgotConfirmPassword}
                      className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/25 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 mt-2"
                    >
                      <span>{forgotLoading ? 'Updating Password...' : 'Save New Password & Sign In'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep(1);
                          setForgotOtp('');
                          setForgotError('');
                        }}
                        className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                      >
                        ← Change email
                      </button>

                      <button
                        type="button"
                        disabled={forgotCooldown > 0 || forgotLoading}
                        onClick={handleResendResetCode}
                        className="font-bold text-sky-600 hover:underline disabled:text-slate-400 cursor-pointer"
                      >
                        {forgotCooldown > 0 ? `Resend code in ${forgotCooldown}s` : 'Resend code'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Viewport Alert Banner (Guaranteed instant visibility without scrolling) */}
      {errorMessage && (
        <div
          role="alert"
          onClick={() => {
            const target = invalidFieldId ? document.getElementById(invalidFieldId) : null;
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              try { target.focus(); } catch (_) {}
            }
          }}
          className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-3.5 px-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-rose-500/40 flex items-center space-x-3 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider">Action Required</span>
            <span className="block text-xs font-semibold text-slate-100 leading-snug truncate sm:whitespace-normal">
              {errorMessage}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setErrorMessage('');
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}