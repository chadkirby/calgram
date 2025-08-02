import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAccount } from "jazz-tools/react";
import { DataExporter } from "@/utils/DataExporter";
import { DataImporter } from "@/utils/DataImporter";
import { JazzAccount } from "@/schema";
import { Upload, Download, Loader2, Check, AlertCircle } from "lucide-react";

export function DataCard() {
  const { me } = useAccount(JazzAccount, {
    resolve: { root: { mealEntries: true, weightEntries: true } },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    mealCount?: number;
    weightCount?: number;
    duplicatesSkipped?: number;
    errors?: string[];
  } | null>(null);

  const handleExport = async () => {
    if (!me) return;

    setIsExporting(true);
    try {
      // Export user data
      const exportData = await DataExporter.exportUserData(me);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
      const filename = `calorie-tracker-export-${timestamp}.json`;

      // Download the file
      DataExporter.downloadJsonFile(exportData, filename);

      // Show success message
      setImportResult({
        success: true,
        message: "Data exported successfully!"
      });
    } catch (error) {
      console.error("Export failed:", error);
      setImportResult({
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
    if (!file || !me) {
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Read file content
      const fileContent = await file.text();

      // Parse JSON data
      const jsonData = DataImporter.parseJsonFile(fileContent);

      // Validate data structure
      const validation = DataImporter.validateImportData(jsonData);
      if (!validation.isValid) {
        throw new Error(`Invalid data format: ${validation.errors.join(", ")}`);
      }

      // Import data
      const result = await DataImporter.importData(jsonData, me);

      // Show success message with import details
      setImportResult({
        success: true,
        message: `Imported ${result.mealCount} meals and ${result.weightCount} weights`,
        mealCount: result.mealCount,
        weightCount: result.weightCount,
        duplicatesSkipped: result.duplicatesSkipped,
        errors: result.errors.length > 0 ? result.errors : undefined
      });
    } catch (error) {
      console.error("Import failed:", error);
      setImportResult({
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2"
          >
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
                  {importResult.duplicatesSkipped && importResult.duplicatesSkipped > 0 &&
                    `, Skipped duplicates: ${importResult.duplicatesSkipped}`
                  }
                </span>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <span className="block mt-1 text-xs">
                  Errors: {importResult.errors.join(", ")}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
