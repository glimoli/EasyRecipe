import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../models/types';

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const profile: UserProfile = {
    uid: credential.user.uid,
    displayName,
    email,
    preferences: {
      measurementSystem: 'imperial',
      defaultServings: 4,
    },
    createdAt: new Date(),
  };
  await setDoc(doc(db, 'users', credential.user.uid), profile);
  return credential;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  const credential = await signInWithPopup(auth, provider);

  // Create profile if first sign-in
  const profileRef = doc(db, 'users', credential.user.uid);
  const existing = await getDoc(profileRef);
  if (!existing.exists()) {
    const profile: UserProfile = {
      uid: credential.user.uid,
      displayName: credential.user.displayName ?? 'User',
      email: credential.user.email ?? '',
      photoUrl: credential.user.photoURL ?? undefined,
      preferences: {
        measurementSystem: 'imperial',
        defaultServings: 4,
      },
      createdAt: new Date(),
    };
    await setDoc(profileRef, profile);
  }
  return credential;
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
