import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, type WeightEntry } from "../schema";
import { DateTime } from "luxon";
import { Edit, Trash2, Weight, ChevronDown } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";
import type { Loaded } from "jazz-tools";

interface WeightEntryListProps {
  onEdit: (entry: Loaded<typeof WeightEntry>) => void;
  addButton?: React.ReactNode;
}

export function WeightEntryList({ onEdit, addButton }: WeightEntryListProps) {
  const { me } = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        weightEntries: { $each: true },
      }
    },
  });

  const { updateSyncStatus } = useNetworkStatus();
  const [deleteEntry, setDeleteEntry] = useState<Loaded<typeof WeightEntry> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
  const ENTRIES_PER_LOAD = 10;

  // Sort weight entries by date (newest first)
  const sortedEntries = useMemo(() => {
    if (!me?.root?.weightEntries) return [];

    return [...me.root.weightEntries]
      .filter((entry): entry is Loaded<typeof WeightEntry> => entry != null)
      .sort((a, b) => DateTime.fromISO(b.timestamp).toMillis() - DateTime.fromISO(a.timestamp).toMillis());
  }, [me?.root?.weightEntries]);

  // Get entries to display based on current display count
  const displayedEntries = useMemo(() => {
    return sortedEntries.slice(0, displayCount);
  }, [sortedEntries, displayCount]);

  const hasMoreEntries = displayCount < sortedEntries.length;
  const remainingEntries = sortedEntries.length - displayCount;

  const handleDelete = async () => {
    if (!deleteEntry || !me?.root?.weightEntries) return;

    setIsDeleting(true);
    try {
      await withSyncErrorHandling(
        async () => {
          const index = me.root.weightEntries.indexOf(deleteEntry);
          if (index > -1) {
            me.root.weightEntries.splice(index, 1);
          }
        },
        'weight-deletion',
        updateSyncStatus
      )();
    } catch (error) {
      console.error("Error deleting weight entry:", error);
      SyncErrorHandler.handleSyncError(error, updateSyncStatus);
    } finally {
      setIsDeleting(false);
      setDeleteEntry(null);
    }
  };

  const formatDate = (timestamp: string) => {
    return DateTime.fromISO(timestamp).toLocaleString(DateTime.DATE_MED);
  };

  const formatRelativeDate = (timestamp: string) => {
    const date = DateTime.fromISO(timestamp);
    const now = DateTime.now();
    const diff = now.diff(date, 'days').days;

    if (diff < 1) return "Today";
    if (diff < 2) return "Yesterday";
    if (diff < 7) return `${Math.floor(diff)} days ago`;
    return date.toLocaleString(DateTime.DATE_MED);
  };

  if (sortedEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-row justify-between items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Weight Entries</CardTitle>
            {addButton}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Weight className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No weight entries yet</h3>
            <p className="text-gray-500">Start tracking your weight to see your progress over time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-row justify-between items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Weight Entries</CardTitle>
            {addButton}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayedEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4 w-full">
                  {/* Vertically centered icon */}
                  <div className="flex-shrink-0 flex items-center h-full">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Weight className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  {/* Stack fields vertically */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-lg font-semibold text-gray-900">
                      {entry.weightValue} lbs
                    </p>
                    <Badge variant="outline" className="text-xs w-fit mt-1 mb-1">
                      {formatRelativeDate(entry.timestamp)}
                    </Badge>
                    {entry.notes && (
                      <p className="text-sm text-gray-600 mt-2">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(entry)}
                      className="h-8 w-8 p-0"
                      title="Edit entry"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteEntry(entry)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      title="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMoreEntries && (
            <div className="pt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setDisplayCount(prev => Math.min(prev + ENTRIES_PER_LOAD, sortedEntries.length))}
                className="w-full sm:w-auto"
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                Show {Math.min(ENTRIES_PER_LOAD, remainingEntries)} more
                {remainingEntries > ENTRIES_PER_LOAD && ` (${remainingEntries} remaining)`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Weight Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this weight entry from{" "}
              {deleteEntry && formatDate(deleteEntry.timestamp)}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
