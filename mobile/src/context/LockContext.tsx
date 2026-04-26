import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '../services/storage';

interface LockContextType {
  isAppLockEnabled: boolean;
  isLocked: boolean;
  setAppLockEnabled: (enabled: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  // We use a ref to track authenticating status to prevent the AppState listener
  // from locking the app while the FaceID/TouchID prompt is active (which triggers 'inactive')
  const isAuthenticating = useRef(false);

  useEffect(() => {
    // Load initial settings
    const loadSettings = async () => {
      const enabled = await storage.getAppLock();
      setIsAppLockEnabled(enabled);
      
      // If the app starts and lock is enabled, we lock immediately
      if (enabled) {
        setIsLocked(true);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    // Listen to backgrounding to auto-lock
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // If we go to background or inactive, and lock is enabled, lock it!
      // Exclude 'inactive' if we are currently authenticating, since the native prompt causes 'inactive'.
      if ((nextAppState === 'background' || nextAppState === 'inactive') && !isAuthenticating.current) {
        if (isAppLockEnabled) {
          setIsLocked(true);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAppLockEnabled]);

  const unlock = async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      // If hardware was lost or passcodes removed, we gracefully unlock to avoid permanently locking the user out.
      setIsLocked(false);
      return true;
    }

    try {
      isAuthenticating.current = true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Budget',
        fallbackLabel: 'Use Passcode',
      });
      
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } finally {
      // Small delay before releasing the lock to ensure AppState settles back to 'active'
      setTimeout(() => {
        isAuthenticating.current = false;
      }, 500);
    }
  };

  const setAppLockEnabled = async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      // Before enabling, force them to authenticate successfully
      isAuthenticating.current = true;
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (!hasHardware || !isEnrolled) {
          return false; // Can't enable if no hardware or passcode set
        }

        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable App Lock',
          fallbackLabel: 'Use Passcode',
        });

        if (!auth.success) {
          return false; // User cancelled or failed
        }
      } finally {
        setTimeout(() => { isAuthenticating.current = false; }, 500);
      }
    }

    // Save
    await storage.setAppLock(enabled);
    setIsAppLockEnabled(enabled);
    // If we just turned it ON we shouldn't immediately lock them out, they are clearly right here.
    // If they turn it OFF and were locked (unlikely state to be in, but still), unlock.
    if (!enabled) setIsLocked(false);
    return true;
  };

  return (
    <LockContext.Provider value={{ isAppLockEnabled, isLocked, setAppLockEnabled, unlock }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock() {
  const context = useContext(LockContext);
  if (!context) {
    throw new Error('useLock must be used within a LockProvider');
  }
  return context;
}
