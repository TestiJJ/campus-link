import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

/**
 * Checks if the current app environment is running inside a native mobile container
 * (Capacitor Android / iOS) or a standalone installed mobile PWA.
 */
export const isMobileContainer = () => {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
  } catch {}
  return false;
};

/**
 * PublicRoute guard:
 * 1. Platform-Aware Initial Routing:
 *    - Inside Mobile App: Unauthenticated visitors on '/' skip marketing landing page and land directly on /login.
 *    - Desktop/Web Browser: Preserves full marketing landing page.
 * 2. Persistent Auto-Login:
 *    - Authenticated users automatically bypass public & login routes directly to their primary dashboard.
 */
export default function PublicRoute({ children }) {
  const { pathname } = useLocation();
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  // 1. Authenticated session: Auto-drop straight into primary dashboard
  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      if (user && user.role) {
        if (user.role === 'admin') {
          return <Navigate to="/admin-dashboard" replace />;
        }
        if (user.role === 'vendor') {
          return <Navigate to="/vendor-dashboard" replace />;
        }
        return <Navigate to="/student-dashboard" replace />;
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  // 2. Mobile App / Phone Container: Skip landing page on boot and show clean login
  if (pathname === '/' && isMobileContainer()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
