import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface NetworkErrorHandlerProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

export function NetworkErrorHandler({ children, onRetry }: NetworkErrorHandlerProps) {
  const { networkStatus, clearSyncError } = useNetworkStatus();

  const handleRetry = () => {
    clearSyncError();
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <>
      {/* Sync Error Alert */}
      {networkStatus.syncError && (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sync Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{networkStatus.syncError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="ml-2 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {children}
    </>
  );
}

// Connection Status Component for displaying in pages
export function ConnectionStatus() {
  const { networkStatus } = useNetworkStatus();

  if (networkStatus.isOnline && networkStatus.isConnected) {
    return null; // Don't show anything when everything is working
  }

  return (
    <div className="mb-4">
      <Alert variant={networkStatus.isOnline ? "default" : "destructive"}>
        {networkStatus.isOnline ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <AlertTitle>
          {networkStatus.isOnline ? "Connection Issues" : "You're Offline"}
        </AlertTitle>
        <AlertDescription>
          {networkStatus.isOnline
            ? "Having trouble syncing your data. Your changes are being saved locally."
            : "Your changes will be saved locally and synced when you reconnect."}
          {networkStatus.lastSyncAttempt && (
            <span className="block text-xs mt-1 text-muted-foreground">
              Last sync attempt: {networkStatus.lastSyncAttempt.toLocaleTimeString()}
            </span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
