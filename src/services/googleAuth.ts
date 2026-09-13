/**
 * SERVICE D'AUTHENTIFICATION GOOGLE & ACCÈS OAUTH
 * Phase 4 : Connexion au compte Google de l'administrateur AKF Partners
 * pour obtenir le jeton OAuth (Scopes: spreadsheets, drive.readonly)
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline',
});

export interface GoogleAuthResult {
  user: User;
  accessToken: string;
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || '';

  if (!accessToken) {
    throw new Error(
      "Impossible d'obtenir le jeton d'accès Google Sheets. Veuillez vérifier les autorisations accordées."
    );
  }

  // Sauvegarde locale du jeton pour la session
  sessionStorage.setItem('akf_google_access_token', accessToken);
  sessionStorage.setItem('akf_google_user_email', result.user.email || '');

  return {
    user: result.user,
    accessToken,
  };
}

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem('akf_google_access_token');
}

export function getStoredUserEmail(): string | null {
  return sessionStorage.getItem('akf_google_user_email');
}

export function setStoredAccessToken(token: string, email = ''): void {
  sessionStorage.setItem('akf_google_access_token', token);
  if (email) {
    sessionStorage.setItem('akf_google_user_email', email);
  }
}

export async function signOutGoogle(): Promise<void> {
  sessionStorage.removeItem('akf_google_access_token');
  sessionStorage.removeItem('akf_google_user_email');
  await fbSignOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
