import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { User } from 'firebase/auth';
import { subscribeToAuthState, signOut } from '../services/auth';
import { UserProfile } from '../models/types';
import { getUserProfile } from '../services/auth';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  resetIdleTimer: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  resetIdleTimer: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      signOut();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer]);

  // Track app background/foreground to account for idle time while backgrounded
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestampRef.current = Date.now();
        clearIdleTimer();
      } else if (nextState === 'active' && user) {
        const bg = backgroundTimestampRef.current;
        if (bg && Date.now() - bg >= IDLE_TIMEOUT_MS) {
          signOut();
        } else {
          resetIdleTimer();
        }
        backgroundTimestampRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user, clearIdleTimer, resetIdleTimer]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        setProfile(p);
        resetIdleTimer();
      } else {
        setProfile(null);
        clearIdleTimer();
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      clearIdleTimer();
    };
  }, [resetIdleTimer, clearIdleTimer]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, resetIdleTimer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
