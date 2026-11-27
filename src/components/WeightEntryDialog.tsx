import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { type BodyWeightUnit, bodyWeightUnits } from "../schema";
import { WeightInput, getStepForUnit, getPlaceholderForUnit } from "@/components/WeightInput";
import { UnitPreferenceManager } from "@/utils/UnitPreferenceManager";
import { useDb } from "jazz-tools/react";
import { app } from "../../jazz/jazz.generated";
import { useAccount } from "@/lib/account";
import type { Weight } from "@/lib/data";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";
import { DatePicker } from "@/components/ui/date-picker";

// Zod schema for weight form validation
const weightFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  weightValue: z.coerce.number().positive("Weight must be a positive number"),
  unit: z.enum(bodyWeightUnits),
  notes: z.string().optional().default(""),
});

type WeightFormValues = z.infer<typeof weightFormSchema>;

// Get current date in YYYY-MM-DD format for default (timezone-aware)
function getCurrentDate() {
  return DateTime.now().toISODate();
}

interface WeightEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSave?: (data: {
    date: string;
    weightValue: number;
    unit: BodyWeightUnit;
    notes?: string;
  }) => Promise<void>;
  entry?: Weight;
  mode: "add" | "edit";
}

export function WeightEntryDialog({
  isOpen,
  onClose,
  onSuccess,
  onSave,
  entry,
  mode,
}: WeightEntryDialogProps) {
  const db = useDb();
  const { profile, saveProfile } = useAccount();
  const { updateSyncStatus } = useNetworkStatus();

  // Get default unit from user preferences
  const getDefaultUnit = (): BodyWeightUnit => {
    return UnitPreferenceManager.getBodyWeightUnit(profile);
  };

  const [formData, setFormData] = useState<WeightFormValues>({
    date: getCurrentDate(),
    weightValue: 0,
    unit: getDefaultUnit(),
    notes: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof WeightFormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Initialize form when dialog opens or the entry or mode changes. This adjusts state
  // during render whenever any of the tracked values change (null on first render so it
  // also runs on mount). Not on profile changes: the profile is only read for the default
  // unit when the form opens, and a profile update (saving a new unit preference, or a
  // rename in another tab) mustn't wipe what's being typed or the success message.
  const [prevResetDeps, setPrevResetDeps] = useState<{
    isOpen: boolean;
    entry: typeof entry;
    mode: typeof mode;
  } | null>(null);
  if (
    prevResetDeps === null ||
    prevResetDeps.isOpen !== isOpen ||
    prevResetDeps.entry !== entry ||
    prevResetDeps.mode !== mode
  ) {
    setPrevResetDeps({ isOpen, entry, mode });
    if (isOpen) {
      if (mode === "edit" && entry) {
        setFormData({
          date: DateTime.fromISO(entry.timestamp).toISODate() || getCurrentDate(),
          weightValue: entry.weightValue,
          unit: entry.unit || getDefaultUnit(),
          notes: entry.notes || "",
        });
      } else {
        setFormData({
          date: getCurrentDate(),
          weightValue: 0,
          unit: getDefaultUnit(),
          notes: "",
        });
      }
      setErrors({});
      setSubmitSuccess(false);
    }
  }

  // Real-time validation helper
  const validateField = (field: keyof WeightFormValues, value: any) => {
    try {
      const fieldSchema = weightFormSchema.shape[field];
      fieldSchema.parse(value);
      // Clear error if validation passes
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues[0]?.message || "Invalid value";
        setErrors((prev) => ({ ...prev, [field]: errorMessage }));
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
          async () =>
            db.update(app.weightEntries, entry.id, {
              timestamp: validatedData.date,
              weightValue: validatedData.weightValue,
              unit: validatedData.unit,
              notes: validatedData.notes || "",
            }),
          "weight-update",
          updateSyncStatus,
        )();
      } else {
        // Create new entry
        if (onSave) {
          await onSave({
            date: validatedData.date,
            weightValue: validatedData.weightValue,
            unit: validatedData.unit,
            notes: validatedData.notes,
          });
        }
      }

      // Save unit preference for future use
      if (profile && profile.bodyWeightUnit !== validatedData.unit) {
        saveProfile({ bodyWeightUnit: validatedData.unit });
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
        weightValue: "Failed to save weight. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const notesId = useId();

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add Weight Entry" : "Edit Weight Entry"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Record a new weight measurement for the selected date."
              : "Update the weight measurement details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <fieldset className="space-y-2 min-w-0">
            <legend className="text-sm font-medium">Date</legend>
            <DatePicker
              value={formData.date}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, date: value }));
                validateField("date", value);
              }}
              error={!!errors.date}
            />
            {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </fieldset>

          <fieldset className="space-y-2 min-w-0">
            <legend className="text-sm font-medium">Weight</legend>
            <WeightInput
              value={formData.weightValue}
              unit={formData.unit}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, weightValue: value }));
                validateField("weightValue", value);
              }}
              onUnitChange={(unit) => {
                const bodyUnit = unit as BodyWeightUnit;
                setFormData((prev) => ({ ...prev, unit: bodyUnit }));
                validateField("unit", bodyUnit);
              }}
              availableUnits={[...bodyWeightUnits]}
              placeholder={getPlaceholderForUnit(formData.unit)}
              step={getStepForUnit(formData.unit)}
              error={!!errors.weightValue}
              className="touch-manipulation min-h-[44px] sm:min-h-[40px]"
              inputMode="decimal"
              aria-label="Weight input with unit selector"
              aria-describedby={errors.weightValue ? "weight-error" : undefined}
            />
            {errors.weightValue && (
              <p id="weight-error" className="text-sm text-destructive">
                {errors.weightValue}
              </p>
            )}
          </fieldset>

          <div className="space-y-2">
            <label htmlFor={notesId} className="text-sm font-medium">
              Notes (Optional)
            </label>
            <Textarea
              id={notesId}
              placeholder="Add any notes about this weight measurement..."
              value={formData.notes}
              onChange={(e) => {
                const value = e.target.value.trim();
                setFormData((prev) => ({ ...prev, notes: value }));
                validateField("notes", value);
              }}
              className={`${errors.notes ? "border-destructive focus-visible:ring-destructive" : ""} touch-manipulation min-h-[88px] sm:min-h-[80px]`}
              rows={3}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : mode === "add" ? (
                "Add Weight"
              ) : (
                "Update Weight"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
