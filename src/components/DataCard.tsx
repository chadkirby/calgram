import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDb } from "jazz-tools/react";
import { DataExporter } from "@/utils/DataExporter";
import { DataImporter } from "@/utils/DataImporter";
import { useAccount } from "@/lib/account";
import { exportAccount, importIntoAccount } from "@/lib/backup";
import { Upload, Download, Loader2, Check, AlertCircle } from "lucide-react";

export function DataCard() {
  const db = useDb();
  const { accountId, profile, saveProfile } = useAccount();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    mealCount?: number;
    weightCount?: number;
    duplicatesSkipped?: number;
  } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = await exportAccount(db, profile);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");
      const filename = `calorie-tracker-export-${timestamp}.json`;

      // Download the file
      DataExporter.downloadJsonFile(exportData, filename);

      // Show success message
      setImportResult({
        success: true,
        message: "Data exported successfully!",
      });
    } catch (error) {
      console.error("Export failed:", error);
      setImportResult({
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accountId) {
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Read file content
      const fileContent = await file.text();

      // Parse, validate, then insert the rows this account doesn't have yet
      const jsonData = DataImporter.parseJsonFile(fileContent);
      const result = await importIntoAccount(db, accountId, jsonData, saveProfile);

      setImportResult({
        success: true,
        message: `Imported ${result.mealCount} meals and ${result.weightCount} weights`,
        ...result,
      });
    } catch (error) {
      console.error("Import failed:", error);
      setImportResult({
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsImporting(false);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Import and export your calorie tracking data.
        </p>

        {/* Import/Export Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import Data
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>

        {/* Status Messages */}
        {importResult && (
          <Alert variant={importResult.success ? "default" : "destructive"}>
            {importResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {importResult.message}
              {importResult.success && importResult.mealCount !== undefined && (
                <span className="block mt-1 text-xs">
                  Meals: {importResult.mealCount}, Weights: {importResult.weightCount}
                  {!!importResult.duplicatesSkipped &&
                    `, Skipped (already present): ${importResult.duplicatesSkipped}`}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
