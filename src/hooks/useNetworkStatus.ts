import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastSyncAttempt?: Date;
  syncError?: string;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isConnected: navigator.onLine,
  });

  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        isConnected: true,
        syncError: undefined,
      }));
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        isConnected: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateSyncStatus = (error?: string) => {
    setNetworkStatus(prev => ({
      ...prev,
      lastSyncAttempt: new Date(),
      syncError: error,
      isConnected: !error && prev.isOnline,
    }));
  };

  const clearSyncError = () => {
    setNetworkStatus(prev => ({
      ...prev,
      syncError: undefined,
      isConnected: prev.isOnline,
    }));
  };

  return {
    networkStatus,
    updateSyncStatus,
    clearSyncError,
  };
}