import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
  isActive: boolean;
  updateAvailable: boolean;
  isOnline: boolean;
  registration: ServiceWorkerRegistration | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  update: () => Promise<void>;
  skipWaiting: () => void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  const handleStateChange = useCallback((sw: ServiceWorker) => {
    setIsInstalling(sw.state === 'installing');
    setIsWaiting(sw.state === 'installed');
    setIsActive(sw.state === 'activated');

    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
      setUpdateAvailable(true);
    }
  }, []);

  const register = useCallback(async () => {
    if (!isSupported) return;

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      registrationRef.current = reg;
      setIsRegistered(true);

      if (reg.active) {
        setIsActive(true);
      }

      if (reg.waiting) {
        setIsWaiting(true);
        setUpdateAvailable(true);
      }

      if (reg.installing) {
        setIsInstalling(true);
        reg.installing.addEventListener('statechange', function () {
          handleStateChange(this);
        });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          setIsInstalling(true);
          newWorker.addEventListener('statechange', function () {
            handleStateChange(this);
          });
        }
      });
    } catch (err) {
      console.error('[useServiceWorker] Registration failed:', err);
    }
  }, [isSupported, handleStateChange]);

  const unregister = useCallback(async () => {
    if (registrationRef.current) {
      await registrationRef.current.unregister();
      registrationRef.current = null;
      setIsRegistered(false);
      setIsActive(false);
      setIsWaiting(false);
      setIsInstalling(false);
      setUpdateAvailable(false);
    }
  }, []);

  const update = useCallback(async () => {
    if (registrationRef.current) {
      await registrationRef.current.update();
    }
  }, []);

  const skipWaiting = useCallback(() => {
    const waiting = registrationRef.current?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, []);

  // Register SW on mount
  useEffect(() => {
    register();
  }, [register]);

  // Listen for controller change (new SW took over)
  useEffect(() => {
    if (!isSupported) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [isSupported]);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isSupported,
    isRegistered,
    isInstalling,
    isWaiting,
    isActive,
    updateAvailable,
    isOnline,
    registration: registrationRef.current,
    register,
    unregister,
    update,
    skipWaiting,
  };
}
