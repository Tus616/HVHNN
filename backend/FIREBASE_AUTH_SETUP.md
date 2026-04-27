# Firebase Admin Authentication Setup

This project now exposes Firebase token verification endpoints at:

- `POST http://localhost:8080/verifyToken`
- `POST http://localhost:8080/api/auth/verifyToken`

## 1. Replace the Firebase service account placeholder

Put your real Firebase Admin SDK JSON key at:

- `backend/src/main/resources/firebase/serviceAccountKey.json`

The current file is only a placeholder and must be replaced before token verification can work.

## 2. Enable the email sign-in provider in Firebase Console

For the React email-link flow in this project, make sure **Authentication -> Sign-in method -> Email/Password** is enabled and **Passwordless sign-in / Email link** is turned on as well.

## 3. Start the Spring Boot backend

```powershell
cd backend
mvn spring-boot:run
```

## 4. Verify a Firebase ID token from the frontend

Send this payload to the backend:

```json
{
  "idToken": "PASTE_FIREBASE_ID_TOKEN_HERE"
}
```

Successful response example:

```json
{
  "valid": true,
  "message": "Firebase ID token is valid",
  "uid": "firebase-user-uid",
  "email": "user@example.com",
  "emailVerified": true
}
```

Error response example:

```json
{
  "timestamp": "2026-04-08T15:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Invalid Firebase ID token",
  "path": "/verifyToken"
}
```

## 5. Example React frontend snippet

```jsx
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Replace these values with your Firebase Web App config from Firebase Console.
const firebaseConfig = {
  apiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
  authDomain: 'REPLACE_WITH_PROJECT.firebaseapp.com',
  projectId: 'REPLACE_WITH_PROJECT_ID',
  appId: 'REPLACE_WITH_WEB_APP_ID',
};

// Initialize the Firebase client SDK once in your frontend app.
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

export async function loginAndVerifyWithBackend(email, password) {
  // Step 1: Sign the user in with Firebase Authentication.
  const userCredential = await signInWithEmailAndPassword(auth, email, password);

  // Step 2: Read the Firebase ID token that represents the signed-in user.
  const idToken = await userCredential.user.getIdToken();

  // Step 3: Send that token to Spring Boot for server-side verification.
  const response = await fetch('http://localhost:8080/verifyToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || 'Token verification failed');
  }

  return payload;
}
```

If your frontend uses a dev proxy for `/api`, you can call `'/api/auth/verifyToken'` instead of `http://localhost:8080/verifyToken`.
