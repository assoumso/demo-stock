import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  const path = location.pathname;

  let basePermission: string | null = null;
  let actionPermission: string | null = null;

  if (path === '/') {
    basePermission = 'dashboard';
  } else {
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      basePermission = segments[0];

      // Handle specific action routes
      if (segments.length > 1) {
        if (segments[1] === 'new') {
          actionPermission = `${basePermission}:create`;
        } else if (segments[1] === 'edit') {
          actionPermission = `${basePermission}:edit`;
        } else if (segments[1] === 'invoice') {
          actionPermission = `${basePermission}:invoice`;
        } else if (basePermission === 'inventory' && segments[1] === 'adjustments') {
          // Special case for nested routes that are distinct permissions
          basePermission = 'inventory:adjustments';
        }
      }
    }
  }

  // If no permission could be determined for the route, deny access.
  if (!basePermission) {
    return <Navigate to="/" replace />;
  }

  // Check the base permission for the module (e.g., 'sales' to access any /sales/* route)
  if (!hasPermission(basePermission)) {
    return <Navigate to="/" replace />;
  }

  // If an action permission is required, check that as well
  if (actionPermission && !hasPermission(actionPermission)) {
     return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
