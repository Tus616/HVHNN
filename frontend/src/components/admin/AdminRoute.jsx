import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getResolvedAdminRole, hasAdminAccess } from '../../utils/adminAccess';

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function handleExpiredSession() {
      navigate('/login', {
        replace: true,
        state: {
          authError: 'Your admin session expired. Please sign in again.',
        },
      });
    }

    window.addEventListener('hvhn:auth-expired', handleExpiredSession);
    return () => window.removeEventListener('hvhn:auth-expired', handleExpiredSession);
  }, [navigate]);

  if (!hasAdminAccess(user)) {
    return (
      <Navigate
        to="/feed"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return typeof children === 'function'
    ? children({
        adminRole: getResolvedAdminRole(user),
      })
    : children;
}
