import { useState } from "react";
import { DEFAULT_TIME_RANGE } from "@/utils/timeRanges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDb } from "jazz-tools/react";
import { type BodyWeightUnit } from "../schema";
import { app } from "../../jazz/jazz.generated";
import { useAccount } from "@/lib/account";
import type { Weight } from "@/lib/data";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WeightPageErrorFallback } from "@/components/PageErrorFallback";
import { NetworkErrorHandler, ConnectionStatus } from "@/components/NetworkErrorHandler";
import { WeightChart } from "@/components/WeightChart";
import { WeightEntryList } from "@/components/WeightEntryList";
import { WeightEntryDialog } from "@/components/WeightEntryDialog";
import { Plus } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";

function WeightPageContent() {
  const db = useDb();
  const { profile } = useAccount();

  const { updateSyncStatus } = useNetworkStatus();
  const [timeRange, setTimeRange] = useState(DEFAULT_TIME_RANGE);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    entry?: Weight;
  }>({
    isOpen: false,
    mode: "add",
  });

  // Handle time range change with loading state
  const handleTimeRangeChange = (value: string) => {
    setIsLoading(true);
    setTimeRange(value);
    // Simulate brief loading for better UX
    setTimeout(() => setIsLoading(false), 200);
  };

  const handleAddWeight = () => {
    setDialogState({
      isOpen: true,
      mode: "add",
    });
  };

  const handleEditWeight = (entry: Weight) => {
    setDialogState({
      isOpen: true,
      mode: "edit",
      entry,
    });
  };

  const handleCloseDialog = () => {
    setDialogState({
      isOpen: false,
      mode: "add",
    });
  };

  const handleSaveWeight = async (data: {
    date: string;
    weightValue: number;
    unit: BodyWeightUnit;
    notes?: string;
  }) => {
    try {
      await withSyncErrorHandling(
        async () =>
          db.insert(app.weightEntries, {
            timestamp: data.date,
            weightValue: data.weightValue,
            unit: data.unit,
            notes: data.notes || "",
          }),
        "weight-creation",
        updateSyncStatus,
      )();
    } catch (error) {
      console.error("Error recording weight:", error);
      SyncErrorHandler.handleSyncError(error, updateSyncStatus);
      throw error;
    }
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <ConnectionStatus />

      <Card>
        <CardHeader>
          <div className="flex flex-row justify-between items-center gap-2">
            <CardTitle className="text-lg sm:text-xl lg:text-2xl">
              Weight Tracking{" "}
              {profile?.firstName && (
                <span className="text-sm text-muted-foreground truncate">
                  ({profile.firstName})
                </span>
              )}
            </CardTitle>
            {/* Removed Add Weight button from here */}
          </div>
        </CardHeader>
        <CardContent>
          {/* Chart Section */}
          <div className="space-y-4 sm:space-y-6">
            <WeightChart
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              isLoading={isLoading}
            />

            {/* Entries List */}
            <WeightEntryList
              onEdit={handleEditWeight}
              addButton={
                <Button onClick={handleAddWeight} size="sm" className="shrink-0">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Weight
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <WeightEntryDialog
        isOpen={dialogState.isOpen}
        onClose={handleCloseDialog}
        onSuccess={() => {
          // Refresh data after save
          handleCloseDialog();
        }}
        onSave={dialogState.mode === "add" ? handleSaveWeight : undefined}
        entry={dialogState.entry}
        mode={dialogState.mode}
      />
    </div>
  );
}

export function WeightPage() {
  return (
    <ErrorBoundary fallback={WeightPageErrorFallback}>
      <NetworkErrorHandler>
        <WeightPageContent />
      </NetworkErrorHandler>
    </ErrorBoundary>
  );
}
