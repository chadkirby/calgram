import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2 } from "lucide-react";
import { z } from "zod";
import { DateTime } from "luxon";
import { WeightEntry } from "../schema";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";
import type { Loaded } from "jazz-tools";

// Zod schema for weight form validation
const weightFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  weightValue: z.coerce.number().positive("Weight must be a positive number"),
  notes: z.string().optional().default(""),
});

type WeightFormValues = z.infer<typeof weightFormSchema>;

interface WeightEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSave?: (data: {
    date: string;
    weightValue: number;
    notes?: string;
  }) => Promise<void>;
  entry?: Loaded<typeof WeightEntry>;
  mode: "add" | "edit";
}

export function WeightEntryDialog({ isOpen, onClose, onSuccess, onSave, entry, mode }: WeightEntryDialogProps) {
  const { updateSyncStatus } = useNetworkStatus();

  // Get current date in YYYY-MM-DD format for default (timezone-aware)
  const getCurrentDate = () => {
    return DateTime.now().toISODate();
  };

  const [formData, setFormData] = useState<WeightFormValues>({
    date: getCurrentDate(),
    weightValue: 0,
    notes: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof WeightFormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Initialize form when dialog opens or entry changes
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && entry) {
        setFormData({
          date: DateTime.fromISO(entry.timestamp).toISODate() || getCurrentDate(),
          weightValue: entry.weightValue,
          notes: entry.notes || "",
        });
      } else {
        setFormData({
          date: getCurrentDate(),
          weightValue: 0,
          notes: "",
        });
      }
      setErrors({});
      setSubmitSuccess(false);
    }
  }, [isOpen, entry, mode]);

  // Real-time validation helper
  const validateField = (field: keyof WeightFormValues, value: any) => {
    try {
      const fieldSchema = weightFormSchema.shape[field];
      fieldSchema.parse(value);
      // Clear error if validation passes
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues[0]?.message || "Invalid value";
        setErrors(prev => ({ ...prev, [field]: errorMessage }));
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form with Zod
    const validationResult = weightFormSchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Partial<Record<keyof WeightFormValues, string>> = {};
      validationResult.error.issues.forEach((issue) => {
        if (issue.path.length > 0) {
          const field = issue.path[0] as keyof WeightFormValues;
          newErrors[field] = issue.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    // Clear any previous errors
    setErrors({});
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const validatedData = validationResult.data;

      if (mode === "edit" && entry) {
        // Update existing entry
        await withSyncErrorHandling(
          async () => {
            entry.timestamp = validatedData.date;
            entry.weightValue = validatedData.weightValue;
            entry.notes = validatedData.notes || "";
          },
          'weight-update',
          updateSyncStatus
        )();
      } else {
        // Create new entry
        if (onSave) {
          await onSave({
            date: validatedData.date,
            weightValue: validatedData.weightValue,
            notes: validatedData.notes,
          });
        }
      }

      // Show success feedback
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        onClose();
        onSuccess();
      }, 1000);

    } catch (error) {
      console.error("Error saving weight:", error);
      SyncErrorHandler.handleSyncError(error, updateSyncStatus);

      // Set a user-friendly error message
      setErrors({
        weightValue: "Failed to save weight. Please check your connection and try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Weight Entry" : "Edit Weight Entry"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Record a new weight measurement for the selected date."
              : "Update the weight measurement details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => {
                const value = e.target.value.trim();
                setFormData(prev => ({ ...prev, date: value }));
                validateField('date', value);
              }}
              className={`${errors.date ? "border-destructive focus-visible:ring-destructive" : ""} touch-manipulation min-h-[44px] sm:min-h-[40px]`}
              autoFocus={false}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Weight (lbs)</label>
            <Input
              type="number"
              step="0.1"
              placeholder="Enter your weight"
              value={formData.weightValue || ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setFormData(prev => ({ ...prev, weightValue: value }));
                validateField('weightValue', value);
              }}
              className={`${errors.weightValue ? "border-destructive focus-visible:ring-destructive" : ""} touch-manipulation min-h-[44px] sm:min-h-[40px]`}
              inputMode="decimal"
              autoFocus
            />
            {errors.weightValue && (
              <p className="text-sm text-destructive">{errors.weightValue}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <Textarea
              placeholder="Add any notes about this weight measurement..."
              value={formData.notes}
              onChange={(e) => {
                const value = e.target.value.trim();
                setFormData(prev => ({ ...prev, notes: value }));
                validateField('notes', value);
              }}
              className={`${errors.notes ? "border-destructive focus-visible:ring-destructive" : ""} touch-manipulation min-h-[88px] sm:min-h-[80px]`}
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes}</p>
            )}
          </div>

          {submitSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
              <AlertTitle className="text-green-800">Success!</AlertTitle>
              <AlertDescription className="text-green-700">
                Weight {mode === "add" ? "recorded" : "updated"} successfully.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                mode === "add" ? "Add Weight" : "Update Weight"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
