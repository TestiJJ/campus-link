import React from 'react';
import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (!token || !storedUser) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(storedUser);
    
    // Strict Role Enforcement
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        // Automatically bounce user to their designated portal
        if (user.role === 'admin') {
          return <Navigate to="/admin" replace />;
        }
        if (user.role === 'vendor') {
          return <Navigate to="/vendor-dashboard" replace />;
        }
        return <Navigate to="/student-dashboard" replace />;
      }
    }

    return children;
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
}
