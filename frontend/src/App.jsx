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

export default function App() {
  return (
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

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </ReactLenis>
  );
}