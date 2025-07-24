import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface PageErrorFallbackProps {
  error?: Error;
  retry: () => void;
  pageName?: string;
}

export function PageErrorFallback({ error, retry, pageName = "page" }: PageErrorFallbackProps) {
  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {pageName} Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Unable to load {pageName}</AlertTitle>
            <AlertDescription>
              {error?.message || `There was a problem loading the ${pageName}. This might be a temporary issue.`}
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button onClick={retry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>If this problem persists, try:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Refreshing your browser</li>
              <li>Checking your internet connection</li>
              <li>Clearing your browser cache</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Specific fallback for meal logging page
export function MealPageErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return <PageErrorFallback error={error} retry={retry} pageName="Meal Logging" />;
}

// Specific fallback for weight tracking page
export function WeightPageErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return <PageErrorFallback error={error} retry={retry} pageName="Weight Tracking" />;
}

// Specific fallback for daily view page
export function DailyPageErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return <PageErrorFallback error={error} retry={retry} pageName="Daily View" />;
}

// Specific fallback for trends page
export function TrendPageErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return <PageErrorFallback error={error} retry={retry} pageName="Trends" />;
}