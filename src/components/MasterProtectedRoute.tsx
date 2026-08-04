import React from 'react';
import { Navigate } from 'react-router-dom';

interface MasterProtectedRouteProps {
  children: React.ReactNode;
}

const MasterProtectedRoute = ({ children }: MasterProtectedRouteProps) => {
  const MASTER_KEY_HASH = 'ce4a73d81b972ea511852c7bdabf9b5a72b719706667245119d47b8bf2b67cad';
  const hasAccess = sessionStorage.getItem('master_access_token') === MASTER_KEY_HASH;

  if (!hasAccess) {
    return <Navigate to="/master/login" replace />;
  }

  return <>{children}</>;
};

export default MasterProtectedRoute;
