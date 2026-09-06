import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import InstallPwaPrompt from './InstallPwaPrompt';

// Code-split route components for instant initial page load
const LandingPage = lazy(() => import('./LandingPage'));
const Auth = lazy(() => import('./Auth'));
const StudentDashboard = lazy(() => import('./StudentDashboard'));
const VendorDashboard = lazy(() => import('./VendorDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

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

// Modern, lightweight loading indicator for route transitions
function PageLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-sky-500 animate-spin" />
        <div className="absolute w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping" />
      </div>
      <p className="mt-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">Loading CampusLink...</p>
    </div>
  );
}

// Error boundary to prevent white blank screens and auto-recover from transient errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('CampusLink App Error:', error, errorInfo);
  }
  handleClearCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('cl_cache_') || k.startsWith('campuslink_student_') || k.startsWith('campuslink_vendor_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
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
              onClick={() => this.handleClearCache()}
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
              <Route path="/vendor" element={<PrivateRoute><VendorRedirect /></PrivateRoute>} />
              <Route path="/feed" element={<PrivateRoute><TabRedirect tab="reels" /></PrivateRoute>} />
              <Route path="/reels" element={<PrivateRoute><TabRedirect tab="reels" /></PrivateRoute>} />
              <Route path="/market" element={<PrivateRoute><TabRedirect tab="marketplace" /></PrivateRoute>} />
              <Route path="/marketplace" element={<PrivateRoute><TabRedirect tab="marketplace" /></PrivateRoute>} />
              <Route path="/campus" element={<PrivateRoute><TabRedirect tab="campus" /></PrivateRoute>} />
              <Route path="/eateries" element={<PrivateRoute><TabRedirect tab="campus" subtab="eateries" /></PrivateRoute>} />
              <Route path="/chat" element={<PrivateRoute><TabRedirect tab="messages" /></PrivateRoute>} />
              <Route path="/messages" element={<PrivateRoute><TabRedirect tab="messages" /></PrivateRoute>} />

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </ErrorBoundary>
  );
}