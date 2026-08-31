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
  getStoredUser,
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

function normalizeUserData(userData = {}, token = '') {
  const userId = userData.userId || userData.id || '';
  return {
    ...userData,
    id: userData.id || userId,
    userId,
    token: token || userData.token || getStoredToken(),
    onboardingCompleted: Boolean(userData.onboardingCompleted),
    isVolunteer: Boolean(userData.isVolunteer ?? userData.volunteerEnabled),
    volunteerEnabled: Boolean(userData.volunteerEnabled ?? userData.isVolunteer),
  };
}

function needsOnboardingForUser(userData) {
  return Boolean(userData) && !Boolean(userData.onboardingCompleted);
}

function routeAfterAuth(userData, fallback = '/feed') {
  return needsOnboardingForUser(userData) ? '/onboarding' : fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiry, setSessionExpiry] = useState(null);

  const setSession = useCallback((userData, token) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    const normalizedUser = normalizeUserData(userData, token);
    persistSessionStorage(normalizedUser, normalizedUser.token, expiry);
    setUser(normalizedUser);
    setSessionExpiry(expiry);
    return normalizedUser;
  }, []);

  const updateUser = useCallback((nextUserData) => {
    setUser((currentUser) => {
      const rawUser = typeof nextUserData === 'function'
        ? nextUserData(currentUser)
        : { ...(currentUser || {}), ...(nextUserData || {}) };

      const token = rawUser?.token || currentUser?.token || getStoredToken();
      const resolvedUser = normalizeUserData(rawUser, token);
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
    let active = true;
    const restoreSession = async () => {
      const token = getStoredToken();
      const expiry = window.localStorage.getItem('hvhn_session_expiry');
      const expiryMs = expiry ? parseInt(expiry, 10) : null;
      const cachedUser = getStoredUser();

      if (!token || (expiryMs && Date.now() >= expiryMs)) {
        clearStoredSession();
        if (active) setLoading(false);
        return;
      }

      try {
        if (cachedUser && active) {
          setUser(normalizeUserData(cachedUser, token));
          setSessionExpiry(expiryMs);
        }
        const response = await apiService.getProfile();
        if (!active) return;
        setSession(response.data, token);
      } catch (error) {
        if (error?.response?.status === 401) {
          clearStoredSession();
          if (active) {
            setUser(null);
            setSessionExpiry(null);
          }
        } else if (cachedUser && active) {
          setUser(normalizeUserData(cachedUser, token));
          setSessionExpiry(expiryMs);
        } else if (active) {
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    restoreSession();

    const handleExpired = () => {
      clearSession();
    };
    window.addEventListener('hvhn:auth-expired', handleExpired);

    return () => {
      active = false;
      window.removeEventListener('hvhn:auth-expired', handleExpired);
    };
  }, [clearSession, setSession]);

  useEffect(() => {
    if (!sessionExpiry) return;

    const remaining = sessionExpiry - Date.now();
    if (remaining <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      logout();
    }, remaining);

    return () => clearTimeout(timer);
  }, [logout, sessionExpiry]);

  const login = async (email, password) => {
    if (!email || !password) throw new Error('Email and password are required.');
    const res = await apiService.login({ email, password });
    const userData = res.data;
    return setSession(userData, userData.token);
  };

  const register = async (data) => {
    if (!data.fullName || !data.email || !data.password || !data.otp) {
      throw new Error('Name, email, password, and OTP are required.');
    }
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const res = await apiService.verifyRegistration(data);
    const userData = res.data;
    return setSession(userData, userData.token);
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

    return setSession(userData, response.data.token);
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
  const needsOnboarding = needsOnboardingForUser(user);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const response = await apiService.getProfile();
    updateUser((currentUser) => ({ ...(currentUser || {}), ...(response.data || {}) }));
    return response.data;
  }, [updateUser, user]);

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
      needsOnboarding,
      routeAfterAuth,
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
