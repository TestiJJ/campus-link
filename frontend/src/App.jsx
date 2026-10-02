import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import InstallPwaPrompt from './InstallPwaPrompt';
import { PwaProvider } from './context/PwaContext';

// Resilient code-splitting with auto-retry and cache-bust recovery on deployments
function lazyWithRetry(componentImport, componentName = 'chunk') {
  return lazy(async () => {
    const retryKey = `cl_retry_${componentName}`;
    const pageHasBeenRetried = typeof window !== 'undefined' ? sessionStorage.getItem(retryKey) : null;
    try {
      const module = await componentImport();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(retryKey);
      }
      if (!module || typeof module !== 'object' || !module.default) {
        throw new Error(`Dynamic import ${componentName} failed to resolve a default component export.`);
      }
      return module;
    } catch (error) {
      console.warn(`Dynamic module import error for ${componentName}:`, error);
      if (typeof window !== 'undefined' && !pageHasBeenRetried) {
        sessionStorage.setItem(retryKey, 'true');
        // Force window reload to get fresh index.html and fresh chunk URLs
        window.location.reload();
        return new Promise(() => {}); // Hold until page reloads
      }
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(retryKey);
      }
      throw error;
    }
  });
}

// Code-split route components for instant initial page load
const LandingPage = lazyWithRetry(() => import('./LandingPage'), 'LandingPage');
const Auth = lazyWithRetry(() => import('./Auth'), 'Auth');
const StudentDashboard = lazyWithRetry(() => import('./StudentDashboard'), 'StudentDashboard');
const VendorDashboard = lazyWithRetry(() => import('./VendorDashboard'), 'VendorDashboard');
const AdminDashboard = lazyWithRetry(() => import('./AdminDashboard'), 'AdminDashboard');

// Native scroll restoration on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}

// Modern skeleton loading indicator for route transitions
function PageLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 max-w-4xl mx-auto space-y-5 animate-pulse">
      {/* Top Navbar Skeleton */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-200" />
          <div className="w-28 h-5 rounded-lg bg-slate-200" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-slate-200" />
          <div className="w-9 h-9 rounded-xl bg-slate-200" />
        </div>
      </div>
      {/* Hero / Banner Skeleton */}
      <div className="h-32 sm:h-40 rounded-3xl bg-slate-200/80" />
      {/* Content Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="p-4 rounded-3xl bg-white border border-slate-200/80 space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="space-y-1.5 flex-1">
              <div className="w-2/3 h-4 bg-slate-200 rounded-md" />
              <div className="w-1/3 h-3 bg-slate-100 rounded-md" />
            </div>
          </div>
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="w-4/5 h-3.5 bg-slate-200 rounded-md" />
        </div>
        <div className="p-4 rounded-3xl bg-white border border-slate-200/80 space-y-3 hidden sm:block">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="space-y-1.5 flex-1">
              <div className="w-2/3 h-4 bg-slate-200 rounded-md" />
              <div className="w-1/3 h-3 bg-slate-100 rounded-md" />
            </div>
          </div>
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="w-4/5 h-3.5 bg-slate-200 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function PingPage() {
  const jsonResponse = {
    status: 200,
    message: "successfully pinged"
  };

  useEffect(() => {
    document.title = 'CampusLink Ping';
    // Immediately redirect to backend ping endpoint so client receives raw JSON
    window.location.replace('https://campus-link-backend-vhxr.onrender.com/ping');
  }, []);

  return (
    <pre style={{
      margin: 0,
      padding: '20px',
      fontFamily: 'monospace',
      fontSize: '14px',
      background: '#ffffff',
      color: '#0f172a',
      minHeight: '100vh',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }}>
      {JSON.stringify(jsonResponse)}
    </pre>
  );
}

// Error boundary to prevent white blank screens and auto-recover from transient errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    const errMsg = (error?.message || String(error || '')).toLowerCase();
    const isChunkError =
      errMsg.includes('dynamically imported module') ||
      errMsg.includes('importing a module script failed') ||
      errMsg.includes('failed to fetch dynamically imported module') ||
      errMsg.includes('error loading dynamically imported module') ||
      errMsg.includes('loading chunk');

    if (isChunkError && typeof window !== 'undefined') {
      const reloadKey = 'cl_boundary_chunk_reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        // Auto-refresh to fetch updated script chunks from server
        window.location.reload();
      }
    }
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('CampusLink App Error:', error, errorInfo);
  }
  async handleClearCacheAndReload() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('cl_cache_') || k.startsWith('campuslink_student_') || k.startsWith('campuslink_vendor_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }
  handleResetSession() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.href = '/login';
  }
  render() {
    if (this.state.hasError) {
      const errText = this.state.error ? (this.state.error.message || String(this.state.error)) : '';
      const isChunkError =
        errText.toLowerCase().includes('dynamically imported module') ||
        errText.toLowerCase().includes('importing a module script failed') ||
        errText.toLowerCase().includes('failed to fetch dynamically imported module') ||
        errText.toLowerCase().includes('error loading dynamically imported module') ||
        errText.toLowerCase().includes('loading chunk');

      if (isChunkError) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
            <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 font-black text-2xl shadow-sm animate-pulse">
              ⚡
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">New CampusLink Version Available</h2>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              We just released an update with the latest calling and performance improvements. Tap below to load the new version.
            </p>
            <button
              onClick={() => this.handleClearCacheAndReload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-md cursor-pointer transition-all"
            >
              Update to Latest Version
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 font-black text-2xl shadow-sm">
            !
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
            CampusLink encountered an unexpected error. You can try reloading or clearing temporary cached state below.
          </p>

          {errText && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-mono text-left max-w-md w-full overflow-x-auto break-words shadow-xs">
              <span className="font-bold block mb-0.5">Error Detail:</span>
              {errText}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
            >
              Reload Page
            </button>
            <button
              onClick={() => this.handleClearCacheAndReload()}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all"
            >
              Clear Cache & Refresh
            </button>
            <button
              onClick={() => this.handleResetSession()}
              className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-xl cursor-pointer transition-all"
            >
              Sign In Again
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Redirects that preserve query params (e.g. ?tab=profile) and respect role
function DashboardRedirect() {
  const { search } = useLocation();
  const userStr = localStorage.getItem('user');
  let target = '/student-dashboard';
  try {
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u.role === 'vendor') target = '/vendor-dashboard';
      else if (u.role === 'admin') target = '/admin-dashboard';
    }
  } catch {}
  return <Navigate to={`${target}${search}`} replace />;
}

function VendorRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/vendor-dashboard${search}`} replace />;
}

// Dynamic tab redirector for fast-navigation shortcuts like /feed, /market, /chat
function TabRedirect({ tab, subtab }) {
  const { search } = useLocation();
  const userStr = localStorage.getItem('user');
  let target = '/student-dashboard';
  try {
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u.role === 'vendor') target = '/vendor-dashboard';
      else if (u.role === 'admin') target = '/admin-dashboard';
    }
  } catch {}

  const searchParams = new URLSearchParams(search);
  if (tab && !searchParams.has('tab')) {
    searchParams.set('tab', tab);
  }
  if (subtab && !searchParams.has('subtab')) {
    searchParams.set('subtab', subtab);
  }
  const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return <Navigate to={`${target}${queryStr}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <PwaProvider>
        <Router>
          <ScrollToTop />
          <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white">
            <InstallPwaPrompt />
            <Suspense fallback={<PageLoading />}>
              <Routes>
                {/* Public Routes (Auto-bypassed if user is already authenticated) */}
                <Route
                  path="/"
                  element={
                    <PublicRoute>
                      <LandingPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Auth />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <PublicRoute>
                      <Auth />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/auth"
                  element={
                    <PublicRoute>
                      <Auth />
                    </PublicRoute>
                  }
                />

                {/* Primary Protected Dashboards */}
                <Route 
                  path="/student-dashboard" 
                  element={
                    <PrivateRoute allowedRoles={['student']}>
                      <StudentDashboard />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/vendor-dashboard" 
                  element={
                    <PrivateRoute allowedRoles={['vendor']}>
                      <VendorDashboard />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <PrivateRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/admin-dashboard" 
                  element={
                    <PrivateRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </PrivateRoute>
                  } 
                />

                {/* Fast-Navigation Direct URLs & Aliases */}
                <Route path="/dashboard" element={<PrivateRoute><DashboardRedirect /></PrivateRoute>} />
                <Route path="/student" element={<PrivateRoute><DashboardRedirect /></PrivateRoute>} />
                <Route path="/vendor" element={<PrivateRoute><VendorRedirect /></PrivateRoute>} />
                <Route path="/home" element={<PrivateRoute><TabRedirect tab="reels" /></PrivateRoute>} />
                <Route path="/feed" element={<PrivateRoute><TabRedirect tab="reels" /></PrivateRoute>} />
                <Route path="/reels" element={<PrivateRoute><TabRedirect tab="reels" /></PrivateRoute>} />
                <Route path="/market" element={<PrivateRoute><TabRedirect tab="marketplace" /></PrivateRoute>} />
                <Route path="/marketplace" element={<PrivateRoute><TabRedirect tab="marketplace" /></PrivateRoute>} />
                <Route path="/services" element={<PrivateRoute><TabRedirect tab="marketplace" subtab="services" /></PrivateRoute>} />
                <Route path="/campus" element={<PrivateRoute><TabRedirect tab="campus" /></PrivateRoute>} />
                <Route path="/eateries" element={<PrivateRoute><TabRedirect tab="campus" subtab="eateries" /></PrivateRoute>} />
                <Route path="/chat" element={<PrivateRoute><TabRedirect tab="messages" /></PrivateRoute>} />
                <Route path="/messages" element={<PrivateRoute><TabRedirect tab="messages" /></PrivateRoute>} />

                {/* Direct Health / Ping Route for Monitor Services & Browser Queries */}
                <Route path="/ping" element={<PingPage />} />
                <Route path="/api/ping" element={<PingPage />} />

                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </PwaProvider>
    </ErrorBoundary>
  );
}