// src/App.jsx
import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactLenis, useLenis } from 'lenis/react';
import PrivateRoute from './PrivateRoute';
import InstallPwaPrompt from './InstallPwaPrompt';

// Code-split route components for instant initial page load
const LandingPage = lazy(() => import('./LandingPage'));
const Auth = lazy(() => import('./Auth'));
const StudentDashboard = lazy(() => import('./StudentDashboard'));
const VendorDashboard = lazy(() => import('./VendorDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

// Smooth scroll restoration on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  const lenis = useLenis();

  useEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, lenis]);

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

// Error boundary to prevent white blank screens
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
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 font-black text-2xl shadow-sm">
            !
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
            CampusLink encountered an unexpected error. Please try reloading or returning home.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
            >
              Go to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Reload Page
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

export default function App() {
  return (
    <ErrorBoundary>
      <ReactLenis
        root
        options={{
        lerp: 0.09,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
      }}
    >
      <Router>
        <ScrollToTop />
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white">
          <InstallPwaPrompt />
          <Suspense fallback={<PageLoading />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/signup" element={<Auth />} />
              <Route path="/auth" element={<Auth />} />

              {/* Protected Routes */}
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

              {/* Role-aware /dashboard and /vendor redirects */}
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/vendor" element={<VendorRedirect />} />

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </ReactLenis>
  </ErrorBoundary>
);
}