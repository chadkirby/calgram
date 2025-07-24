// Network error handling utilities for Jazz sync operations

export interface SyncError {
  type: 'network' | 'auth' | 'data' | 'unknown';
  message: string;
  timestamp: Date;
  retryable: boolean;
}

export class SyncErrorHandler {
  private static retryAttempts = new Map<string, number>();
  private static maxRetries = 3;
  private static retryDelay = 1000; // Start with 1 second

  static handleSyncError(error: any, updateNetworkStatus?: (error?: string) => void): SyncError {
    const syncError = this.categorizeError(error);
    
    // Update network status if handler is provided
    if (updateNetworkStatus) {
      updateNetworkStatus(syncError.message);
    }

    // Log error for debugging
    console.error('Jazz sync error:', {
      type: syncError.type,
      message: syncError.message,
      originalError: error,
      timestamp: syncError.timestamp,
    });

    return syncError;
  }

  private static categorizeError(error: any): SyncError {
    const timestamp = new Date();
    
    // Network-related errors
    if (error?.name === 'NetworkError' || 
        error?.message?.includes('fetch') ||
        error?.message?.includes('network') ||
        !navigator.onLine) {
      return {
        type: 'network',
        message: 'Unable to sync data. Check your internet connection.',
        timestamp,
        retryable: true,
      };
    }

    // Authentication errors
    if (error?.status === 401 || 
        error?.status === 403 ||
        error?.message?.includes('auth')) {
      return {
        type: 'auth',
        message: 'Authentication failed. Please sign in again.',
        timestamp,
        retryable: false,
      };
    }

    // Data validation errors
    if (error?.status === 400 || 
        error?.message?.includes('validation') ||
        error?.message?.includes('invalid')) {
      return {
        type: 'data',
        message: 'Data validation failed. Please check your input.',
        timestamp,
        retryable: false,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: error?.message || 'An unexpected sync error occurred.',
      timestamp,
      retryable: true,
    };
  }

  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationId: string,
    updateNetworkStatus?: (error?: string) => void
  ): Promise<T> {
    const attempts = this.retryAttempts.get(operationId) || 0;
    
    try {
      const result = await operation();
      
      // Clear retry count on success
      this.retryAttempts.delete(operationId);
      
      // Clear network error status
      if (updateNetworkStatus) {
        updateNetworkStatus();
      }
      
      return result;
    } catch (error) {
      const syncError = this.handleSyncError(error, updateNetworkStatus);
      
      if (syncError.retryable && attempts < this.maxRetries) {
        // Increment retry count
        this.retryAttempts.set(operationId, attempts + 1);
        
        // Calculate exponential backoff delay
        const delay = this.retryDelay * Math.pow(2, attempts);
        
        console.log(`Retrying operation ${operationId} in ${delay}ms (attempt ${attempts + 1}/${this.maxRetries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the operation
        return this.retryWithBackoff(operation, operationId, updateNetworkStatus);
      }
      
      // Max retries reached or non-retryable error
      throw error;
    }
  }

  static clearRetryCount(operationId: string) {
    this.retryAttempts.delete(operationId);
  }

  static getRetryCount(operationId: string): number {
    return this.retryAttempts.get(operationId) || 0;
  }
}

// Utility function to wrap Jazz operations with error handling
export function withSyncErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationId: string,
  updateNetworkStatus?: (error?: string) => void
) {
  return async (...args: T): Promise<R> => {
    return SyncErrorHandler.retryWithBackoff(
      () => fn(...args),
      operationId,
      updateNetworkStatus
    );
  };
}