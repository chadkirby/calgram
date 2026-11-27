import { useState } from "react";
import { Launching } from "@/components/Launching";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { DataExporter } from "@/utils/DataExporter";
import type { ClassicIdentity } from "./classicIdentity";
import { beginMigration, storedCarried, useMigration } from "./migrate";

/**
 * Shows the app, unless this browser is migrating Classic data. It sits outside the
 * router and the session's signed-in/signed-out trees, so neither the welcome screen
 * nor "Start" appears while an account is half migrated. While it checks, a device
 * whose account was ready shows the app shell, which reads no data.
 */
export function MigrationGate({ children }: { children: React.ReactNode }) {
  const migration = useMigration();
  switch (migration.kind) {
    case "idle":
      return children;
    case "checking":
      return <Launching />;
    case "moving":
      return <MovingData copied={migration.copied} total={migration.total} />;
    case "failed":
      return <MigrationFallback identity={migration.identity} />;
  }
}

function MovingData({ copied, total }: { copied: number; total: number }) {
  const { networkStatus } = useNetworkStatus();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Moving your data</h1>
      <output className="text-sm text-muted-foreground">
        {!networkStatus.isOnline
          ? "You're offline. This continues when you're back online."
          : total > 0
            ? `${copied.toLocaleString()} of ${total.toLocaleString()} entries`
            : "Reading your meals and weigh-ins…"}
      </output>
      {total > 0 && (
        <progress className="w-64" max={total} value={copied}>
          {Math.round((copied / total) * 100)}%
        </progress>
      )}
    </div>
  );
}

/** The guided screen when migration fails (R7): retry, or download the old data. */
function MigrationFallback({ identity }: { identity: ClassicIdentity }) {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      const { readClassicAccount } = await import("./classicReader");
      const data = await readClassicAccount(identity);
      // Meals logged under Start wait in this browser until the move succeeds; include them.
      const carried = storedCarried(identity);
      if (carried) {
        data.mealEntries.push(...carried.mealEntries);
        data.weightEntries.push(...carried.weightEntries);
      }
      DataExporter.downloadJsonFile(data, DataExporter.exportFilename());
    } catch (error) {
      console.error("Downloading the old data failed:", error);
      setMessage("Couldn't reach your old data either. Please try again in a little while.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">We couldn't move your data yet</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Sammygram has moved to a new home, and your meals and weigh-ins need to come along. That
        didn't work this time, usually because the old service didn't answer. Nothing has been lost:
        your data is still where it was.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => void beginMigration(identity)} disabled={downloading}>
          Try again
        </Button>
        <Button variant="outline" onClick={download} disabled={downloading}>
          {downloading ? "Downloading…" : "Download my old data"}
        </Button>
      </div>
      {message && (
        <p role="alert" className="max-w-md text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
