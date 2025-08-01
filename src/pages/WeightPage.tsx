import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, WeightEntry, type BodyWeightUnit } from "../schema";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WeightPageErrorFallback } from "@/components/PageErrorFallback";
import { NetworkErrorHandler, ConnectionStatus } from "@/components/NetworkErrorHandler";
import { WeightChart } from "@/components/WeightChart";
import { WeightEntryList } from "@/components/WeightEntryList";
import { WeightEntryDialog } from "@/components/WeightEntryDialog";
import { Plus } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";
import type { Loaded } from "jazz-tools";

function WeightPageContent() {
  const { me } = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        weightEntries: { $each: true },
      }
    },
  });

  const { updateSyncStatus } = useNetworkStatus();
  const [timeRange, setTimeRange] = useState("30");
  const [isLoading, setIsLoading] = useState(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    entry?: Loaded<typeof WeightEntry>;
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

  const handleEditWeight = (entry: Loaded<typeof WeightEntry>) => {
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
    if (!me?.root) return;

    try {
      await withSyncErrorHandling(
        async () => {
          // Create weight entry using Jazz schema
          const weightEntry = WeightEntry.create({
            timestamp: data.date,
            weightValue: data.weightValue,
            unit: data.unit,
            notes: data.notes || "",
          }, me.root._owner);

          // Add to weight entries
          me.root.weightEntries?.push(weightEntry);

          return weightEntry;
        },
        'weight-creation',
        updateSyncStatus
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
              Weight Tracking
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
                <Button
                  onClick={handleAddWeight}
                  size="sm"
                  className="shrink-0"
                >
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
