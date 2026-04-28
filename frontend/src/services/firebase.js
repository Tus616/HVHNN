import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithPopup,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';

export const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  messagingSenderId: '',
  storageBucket: '',
};

const DEFAULT_EMAIL_LINK_DOMAIN = DEFAULT_FIREBASE_CONFIG.authDomain;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
};

const REQUIRED_FIREBASE_CONFIG = ['apiKey', 'authDomain', 'projectId', 'appId'];

function getMissingFirebaseConfig() {
  return REQUIRED_FIREBASE_CONFIG.filter((key) => !firebaseConfig[key]);
}

function toEnvName(field) {
  return `VITE_FIREBASE_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

export function isFirebaseConfigured() {
  return getMissingFirebaseConfig().length === 0;
}

export function getFirebaseConfigurationMessage() {
  const missing = getMissingFirebaseConfig();
  if (missing.length === 0) return '';

  return `Firebase Email Link auth is not configured. Add ${missing.map(toEnvName).join(', ')} to frontend/.env.local and restart Vite.`;
}

function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(getFirebaseConfigurationMessage());
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function getDefaultEmailLinkUrl() {
  return `${window.location.origin}/login`;
}

export function buildActionCodeSettings() {
  const actionCodeSettings = {
    url: import.meta.env.VITE_FIREBASE_EMAIL_LINK_URL || getDefaultEmailLinkUrl(),
    handleCodeInApp: true,
  };

  const iosBundleId = import.meta.env.VITE_FIREBASE_IOS_BUNDLE_ID;
  if (iosBundleId) {
    actionCodeSettings.iOS = {
      bundleId: iosBundleId,
    };
  }

  const androidPackageName = import.meta.env.VITE_FIREBASE_ANDROID_PACKAGE_NAME;
  if (androidPackageName) {
    actionCodeSettings.android = {
      packageName: androidPackageName,
      installApp: parseBoolean(import.meta.env.VITE_FIREBASE_ANDROID_INSTALL_APP, false),
    };

    const minimumVersion = import.meta.env.VITE_FIREBASE_ANDROID_MINIMUM_VERSION;
    if (minimumVersion) {
      actionCodeSettings.android.minimumVersion = minimumVersion;
    }
  }

  const linkDomain = import.meta.env.VITE_FIREBASE_LINK_DOMAIN || DEFAULT_EMAIL_LINK_DOMAIN;
  if (linkDomain) {
    actionCodeSettings.linkDomain = linkDomain;
  }

  return actionCodeSettings;
}

export function getEmailLinkSenderHint() {
  return `noreply@${firebaseConfig.authDomain}`;
}

function mapFirebaseAuthError(error, fallbackMessage) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-email':
      return 'Email is required to continue.';
    case 'auth/unauthorized-continue-uri':
      return 'This email-link URL is not authorized in Firebase. Add the domain in Authentication -> Settings -> Authorized domains.';
    case 'auth/unauthorized-domain':
      return 'This browser domain is not authorized for Firebase sign-in. Add it in Authentication -> Settings -> Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Enable the required Firebase sign-in provider in Firebase Console before using this flow.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled before completion.';
    case 'auth/popup-blocked':
      return 'The Google sign-in popup was blocked by the browser. Allow popups and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/invalid-action-code':
      return 'This sign-in link is invalid or has already been used. Request a new one.';
    case 'auth/expired-action-code':
      return 'This sign-in link has expired. Request a new one.';
    default:
      return fallbackMessage;
  }
}

export function getStoredEmailForSignIn() {
  return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) || '';
}

export function clearStoredEmailForSignIn() {
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
}

export function isEmailLinkSignIn(linkUrl) {
  if (!isFirebaseConfigured()) return false;
  return isSignInWithEmailLink(getFirebaseAuth(), linkUrl);
}

export async function sendAuthenticationLink(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const actionCodeSettings = buildActionCodeSettings();

  try {
    await sendSignInLinkToEmail(getFirebaseAuth(), normalizedEmail, actionCodeSettings);
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalizedEmail);
    return normalizedEmail;
  } catch (error) {
    throw new Error(
      mapFirebaseAuthError(error, 'We could not send the authentication link. Please try again.')
    );
  }
}

export async function signInWithGooglePopup() {
  try {
    return await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
  } catch (error) {
    throw new Error(
      mapFirebaseAuthError(error, 'We could not sign you in with Google. Please try again.')
    );
  }
}

export async function completeEmailLinkSignIn(linkUrl, emailOverride) {
  let email = (emailOverride || getStoredEmailForSignIn()).trim();

  if (!email) {
    email = window.prompt('Confirm your email address to finish signing in.')?.trim() || '';
  }

  if (!email) {
    throw new Error('We could not determine which email to verify. Request a new sign-in link.');
  }

  try {
    const credential = await signInWithEmailLink(getFirebaseAuth(), email, linkUrl);
    clearStoredEmailForSignIn();
    return credential;
  } catch (error) {
    throw new Error(
      mapFirebaseAuthError(error, 'We could not verify the sign-in link. Request a new one.')
    );
  }
}

export async function signOutFirebaseUser() {
  if (!isFirebaseConfigured()) return;
  await signOut(getFirebaseAuth());
}
