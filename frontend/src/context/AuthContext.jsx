import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import {
  completeEmailLinkSignIn,
  isEmailLinkSignIn as isFirebaseEmailLinkSignIn,
  sendAuthenticationLink,
  signInWithGooglePopup,
  signOutFirebaseUser,
} from '../services/firebase';
import {
  clearSessionStorage,
  getStoredToken,
  persistSessionStorage,
} from '../utils/sessionStorage';

const AuthContext = createContext(null);

const ROLES = {
  USER: 1,
  VOLUNTEER: 1,
  MODERATOR: 2,
  COMMUNITY_ADMIN: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

function normalizeRole(role) {
  const normalizedRole = String(role || '').trim().toUpperCase();
  if (normalizedRole === 'ROLE_ADMIN') return 'ADMIN';
  return normalizedRole;
}

function clearStoredSession() {
  clearSessionStorage();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiry, setSessionExpiry] = useState(null);

  const setSession = useCallback((userData, token) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    persistSessionStorage(userData, token, expiry);
    setUser(userData);
    setSessionExpiry(expiry);
  }, []);

  const updateUser = useCallback((nextUserData) => {
    setUser((currentUser) => {
      const resolvedUser = typeof nextUserData === 'function'
        ? nextUserData(currentUser)
        : { ...(currentUser || {}), ...(nextUserData || {}) };

      const token = resolvedUser?.token || currentUser?.token || getStoredToken();
      const expiry = sessionExpiry || Date.now() + 24 * 60 * 60 * 1000;
      persistSessionStorage(resolvedUser, token, expiry);
      return resolvedUser;
    });
  }, [sessionExpiry]);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setSessionExpiry(null);
  }, []);

  const logout = useCallback(async () => {
    clearSession();
    try {
      await signOutFirebaseUser();
    } catch {
      // Ignore Firebase sign-out failures and still clear the local session.
    }
  }, [clearSession]);

  useEffect(() => {
    const saved = localStorage.getItem('hvhn_user');
    const expiry = localStorage.getItem('hvhn_session_expiry');

    if (saved && expiry) {
      if (Date.now() < parseInt(expiry, 10)) {
        try {
          setUser(JSON.parse(saved));
        } catch {
          clearStoredSession();
        }
        setSessionExpiry(parseInt(expiry, 10));
      } else {
        clearStoredSession();
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionExpiry) return;

    const remaining = sessionExpiry - Date.now();
    if (remaining <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      logout();
      alert('Your session has expired. Please login again.');
    }, remaining);

    return () => clearTimeout(timer);
  }, [logout, sessionExpiry]);

  const login = async (email, password) => {
    if (!email || !password) throw new Error('Email and password are required.');
    const res = await apiService.login({ email, password });
    const userData = res.data;
    setSession(userData, userData.token);
    return userData;
  };

  const register = async (data) => {
    if (!data.fullName || !data.email || !data.password) {
      throw new Error('Name, email, and password are required.');
    }
    if (data.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const res = await apiService.register(data);
    const userData = res.data;
    setSession(userData, userData.token);
    return userData;
  };

  const sendLoginLink = async (email) => {
    if (!email) throw new Error('Email is required.');
    return sendAuthenticationLink(email);
  };

  const finalizeFirebaseLogin = useCallback(async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await apiService.loginWithFirebase({
      idToken,
      fullName: firebaseUser.displayName || '',
      email: firebaseUser.email,
      firebaseUid: firebaseUser.uid,
    });

    const userData = {
      ...response.data,
      email: firebaseUser.email ?? response.data.email,
      fullName: firebaseUser.displayName ?? response.data.fullName,
      verified: firebaseUser.emailVerified ?? response.data.verified,
      profileImage: firebaseUser.photoURL ?? response.data.profileImage,
    };

    setSession(userData, response.data.token);
    return userData;
  }, [setSession]);

  const completeLoginLink = useCallback(async (linkUrl) => {
    const credential = await completeEmailLinkSignIn(linkUrl);
    return finalizeFirebaseLogin(credential.user);
  }, [finalizeFirebaseLogin]);

  const loginWithGoogle = useCallback(async () => {
    const credential = await signInWithGooglePopup();
    return finalizeFirebaseLogin(credential.user);
  }, [finalizeFirebaseLogin]);

  const isEmailLinkLogin = useCallback((linkUrl) => {
    return isFirebaseEmailLinkSignIn(linkUrl);
  }, []);

  const isAuthenticated = !!user;

  const refreshProfile = useCallback(async () => {
    if (!user?.userId) return null;
    const response = await apiService.getProfile(user.userId);
    updateUser((currentUser) => ({ ...(currentUser || {}), ...(response.data || {}) }));
    return response.data;
  }, [updateUser, user?.userId]);

  const hasRole = useCallback((requiredRole) => {
    if (!user) return false;
    return (ROLES[normalizeRole(user.role)] || 0) >= (ROLES[normalizeRole(requiredRole)] || 0);
  }, [user]);

  const isAdmin = hasRole('COMMUNITY_ADMIN');
  const isModerator = hasRole('MODERATOR');

  const isOwner = useCallback((resourceUserId) => {
    return user && (user.userId === resourceUserId || user.id === resourceUserId);
  }, [user]);

  const canPerformAction = useCallback((action, resource = {}) => {
    if (!user) return false;
    switch (action) {
      case 'create_request': return isAuthenticated;
      case 'accept_request': return isAuthenticated && user?.isVolunteer && !isOwner(resource.requesterId);
      case 'complete_request': return isAuthenticated && isOwner(resource.volunteerId);
      case 'cancel_request': return isAuthenticated && (isOwner(resource.requesterId) || isAdmin);
      case 'manage_community': return isAdmin || isOwner(resource.creatorId);
      case 'view_admin': return isAdmin;
      case 'delete_user': return isAdmin;
      default: return isAuthenticated;
    }
  }, [user, isAuthenticated, isAdmin, isOwner]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      updateUser,
      refreshProfile,
      loading,
      sendLoginLink,
      completeLoginLink,
      loginWithGoogle,
      isEmailLinkLogin,
      isAuthenticated,
      hasRole,
      isAdmin,
      isModerator,
      isOwner,
      canPerformAction,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
