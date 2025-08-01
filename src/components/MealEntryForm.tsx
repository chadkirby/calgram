import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { WeightInput } from "@/components/WeightInput";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";

import { JazzAccount, MealEntry } from "../schema";
import { CalorieCalculator } from "../utils/CalorieCalculator";
import { FoodIntelligenceManager } from "../utils/FoodIntelligenceManager";
import { DataImporter } from "../utils/DataImporter";
import { UnitPreferenceManager } from "../utils/UnitPreferenceManager";
import { WeightConverter } from "../utils/WeightConverter";
import { Info, Check, Upload, Loader2 } from "lucide-react";
import * as React from "react";
import { z } from "zod";
import { DateTime } from "luxon";
import { type Loaded } from "jazz-tools";

// Enhanced Zod schema for comprehensive form validation
const mealFormSchema = z.object({
  date: z
    .string()
    .min(1, "Date is required"),
  time: z
    .string()
    .min(1, "Time is required"),
  foodName: z
    .string()
    .min(1, "Food name is required")
    .trim(),
  foodCategory: z
    .string()
    .min(1, "Food category is required")
    .trim(),
  caloriesPerGram: z
    .number()
    .nonnegative("Calories per gram cannot be negative"),
  weightValue: z
    .number(), // Weight in display unit (allow negative for discarded food)
  weightUnit: z.enum(['g', 'oz', 'lb', 'kg']),
  notes: z
    .string()
    .optional()
    .default(""),
});

type MealFormValues = z.infer<typeof mealFormSchema>;

interface MealEntryFormProps {
  mode: 'create' | 'edit';
  initialData?: Loaded<typeof MealEntry>;
  onSuccess: (meal: Loaded<typeof MealEntry>) => void;
  onCancel: () => void;
  me: Loaded<typeof JazzAccount>;
  showImport?: boolean; // Only show import on create mode
  title?: string; // Custom title for the form
  defaultDate?: string; // Default date for create mode (YYYY-MM-DD format)
}

export function MealEntryForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
  me,
  showImport = false,
  title,
  defaultDate
}: MealEntryFormProps) {
  const { updateSyncStatus } = useNetworkStatus();

  // Get current date in YYYY-MM-DD format for default (timezone-aware)
  const getCurrentDate = () => {
    return DateTime.now().toISODate();
  };

  // Get current time in HH:MM format for default
  const getCurrentTime = () => {
    return DateTime.now().toFormat('HH:mm');
  };

  // Parse initial data for edit mode
  const getInitialFormData = (): MealFormValues => {
    // Get user's preferred meal weight unit
    const preferredUnit = UnitPreferenceManager.getMealWeightUnit(me?.profile || undefined);
    
    if (mode === 'edit' && initialData) {
      const dateTime = DateTime.fromISO(initialData.timestamp);
      
      // For edit mode, use the stored display unit or convert from grams to preferred unit
      const displayUnit = initialData.displayUnit || preferredUnit;
      const weightValue = initialData.displayUnit 
        ? WeightConverter.fromGrams(initialData.weightInGrams, displayUnit)
        : WeightConverter.fromGrams(initialData.weightInGrams, preferredUnit);
      
      return {
        date: dateTime.toISODate() || getCurrentDate(),
        time: dateTime.toFormat('HH:mm'),
        foodName: initialData.foodName,
        foodCategory: initialData.foodCategory,
        caloriesPerGram: initialData.caloriesPerGram,
        weightValue: weightValue,
        weightUnit: displayUnit,
        notes: initialData.notes || "",
      };
    }

    return {
      date: defaultDate || getCurrentDate(),
      time: getCurrentTime(),
      foodName: "",
      foodCategory: "",
      caloriesPerGram: 0,
      weightValue: 0,
      weightUnit: preferredUnit,
      notes: "",
    };
  };

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [formData, setFormData] = React.useState<MealFormValues>(getInitialFormData);
  const [errors, setErrors] = React.useState<Partial<Record<keyof MealFormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState<{
    isImporting: boolean;
    success: boolean;
    message: string;
  }>({
    isImporting: false,
    success: false,
    message: "",
  });

  // File input ref for import functionality
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (importTimeoutRef.current) {
        clearTimeout(importTimeoutRef.current);
      }
    };
  }, []);

  // Real-time validation helper
  const validateField = (field: keyof MealFormValues, value: any) => {
    try {
      const fieldSchema = mealFormSchema.shape[field];
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

  // Get food intelligence data for suggestions
  const foodIntelligence = me?.root?.foodIntelligence;
  const recentFoods = foodIntelligence ? FoodIntelligenceManager.getRecentFoods(foodIntelligence) : [];
  const recentCategories = foodIntelligence ? FoodIntelligenceManager.getRecentCategories(foodIntelligence) : [];

  // Handle food selection to auto-populate fields
  const handleFoodSelection = (foodName: string) => {
    // Always update the foodName in form data
    setFormData(prev => ({ ...prev, foodName }));

    // If we have food intelligence data, try to auto-populate other fields
    if (foodIntelligence) {
      const foodData = foodIntelligence.foodData?.[foodName];
      if (foodData) {
        // Auto-populate calories per gram and category from previous usage
        setFormData(prev => ({
          ...prev,
          foodName,
          caloriesPerGram: foodData.lastUsedCPG,
          foodCategory: foodData.lastUsedCategory,
        }));
      }
    }
  };

  // Get current values for reactive calculations
  const currentCaloriesPerGram = formData.caloriesPerGram || 0;
  const currentWeightValue = formData.weightValue || 0;
  const currentWeightUnit = formData.weightUnit;

  // Convert weight to grams for calorie calculations
  const currentWeightInGrams = currentWeightValue > 0 
    ? WeightConverter.toGrams(currentWeightValue, currentWeightUnit)
    : 0;

  // Calculate total calories for current meal (always use grams)
  const totalCalories = CalorieCalculator.calculateMealCalories(
    currentWeightInGrams,
    currentCaloriesPerGram
  );

  // Calculate today's total calories
  const todayTotal = me?.root?.mealEntries
    ? CalorieCalculator.calculateDailyTotal(
      [...me.root.mealEntries].filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      CalorieCalculator.getTodayAtMidnight()
    )
    : 0;

  // Handle data import (only for create mode)
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !me) {
      return;
    }

    // Clear any existing timeout
    if (importTimeoutRef.current) {
      clearTimeout(importTimeoutRef.current);
      importTimeoutRef.current = null;
    }

    // Clear any previous status messages and set importing state
    setImportStatus({
      isImporting: true,
      success: false,
      message: "Importing data...",
    });

    try {
      // Read file content
      const fileContent = await file.text();

      // Parse JSON data
      const jsonData = DataImporter.parseJsonFile(fileContent);

      // Import data
      const result = await DataImporter.importData(jsonData, me);

      setImportStatus({
        isImporting: false,
        success: true,
        message: `Imported ${result.mealCount} meals, ${result.weightCount} weights`,
      });

      // Clear success message after 5 seconds
      importTimeoutRef.current = setTimeout(() => {
        setImportStatus(prev => ({ ...prev, success: false, message: "" }));
        importTimeoutRef.current = null;
      }, 5000);

    } catch (error) {
      console.error("Import failed:", error);
      setImportStatus({
        isImporting: false,
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      // Clear error message after 8 seconds (longer timeout for actual errors)
      importTimeoutRef.current = setTimeout(() => {
        setImportStatus(prev => ({ ...prev, message: "" }));
        importTimeoutRef.current = null;
      }, 8000);
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    console.log("Submitting meal form:", formData);
    e.preventDefault();
    if (!me?.root) return;

    // Ensure required collections exist
    if (!me.root.mealEntries) {
      console.error("mealEntries collection is missing");
      return;
    }

    // Validate form with Zod
    const validationResult = mealFormSchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Partial<Record<keyof MealFormValues, string>> = {};
      validationResult.error.issues.forEach((issue) => {
        if (issue.path.length > 0) {
          const field = issue.path[0] as keyof MealFormValues;
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

      // Convert weight to grams for storage and calculations
      const weightInGrams = WeightConverter.toGrams(validatedData.weightValue, validatedData.weightUnit);

      // Calculate total calories (always use grams)
      const totalCalories = CalorieCalculator.calculateMealCalories(
        weightInGrams,
        validatedData.caloriesPerGram
      );

      // Save user's unit preference
      UnitPreferenceManager.setMealWeightUnit(me?.profile || undefined, validatedData.weightUnit);

      // Combine date and time to create ISO timestamp
      const combinedDateTime = DateTime.fromISO(`${validatedData.date}T${validatedData.time}`);
      const isoTimestamp = combinedDateTime.toISO();

      if (!isoTimestamp) {
        throw new Error("Invalid date/time combination");
      }

      let mealEntry: Loaded<typeof MealEntry>;

      if (mode === 'edit' && initialData) {
        // Update existing meal entry
        await withSyncErrorHandling(
          async () => {
            // Update the existing meal entry fields
            initialData.timestamp = isoTimestamp;
            initialData.foodName = validatedData.foodName;
            initialData.foodCategory = validatedData.foodCategory;
            initialData.caloriesPerGram = validatedData.caloriesPerGram;
            initialData.weightInGrams = weightInGrams; // Store in grams
            initialData.displayUnit = validatedData.weightUnit; // Store display unit
            initialData.notes = validatedData.notes || "";
            initialData.totalCalories = totalCalories;

            // Update food intelligence
            if (foodIntelligence) {
              FoodIntelligenceManager.updateFoodData(
                foodIntelligence,
                initialData
              );
            }

            return initialData;
          },
          'meal-update',
          updateSyncStatus
        )();

        mealEntry = initialData;
      } else {
        // Create new meal entry
        mealEntry = await withSyncErrorHandling(
          async () => {
            // Create meal entry using Jazz schema
            const newMealEntry = MealEntry.create({
              timestamp: isoTimestamp,
              foodName: validatedData.foodName,
              foodCategory: validatedData.foodCategory,
              caloriesPerGram: validatedData.caloriesPerGram,
              weightInGrams: weightInGrams, // Store in grams
              displayUnit: validatedData.weightUnit, // Store display unit
              notes: validatedData.notes || "",
              totalCalories,
            }, me.root!._owner);

            // Add to meal entries
            me.root?.mealEntries?.push(newMealEntry);

            // Update food intelligence
            if (foodIntelligence) {
              FoodIntelligenceManager.updateFoodData(
                foodIntelligence,
                newMealEntry
              );
            }

            return newMealEntry;
          },
          'meal-creation',
          updateSyncStatus
        )();
      }

      // Show success feedback
      setSubmitSuccess(true);

      // Call success callback
      onSuccess(mealEntry);

      // For create mode, reset form after success
      if (mode === 'create') {
        const preferredUnit = UnitPreferenceManager.getMealWeightUnit(me?.profile || undefined);
        setFormData({
          date: getCurrentDate(),
          time: getCurrentTime(),
          foodName: "",
          foodCategory: "",
          caloriesPerGram: 0,
          weightValue: 0,
          weightUnit: preferredUnit,
          notes: "",
        });
        setErrors({});
        setTimeout(() => setSubmitSuccess(false), 3000);
      }

    } catch (error) {
      console.error("Error saving meal:", error);
      SyncErrorHandler.handleSyncError(error, updateSyncStatus);

      // Set a user-friendly error message
      setErrors({
        foodName: "Failed to save meal. Please check your connection and try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    if (mode === 'edit' && initialData) {
      // Reset to initial data for edit mode
      setFormData(getInitialFormData());
    } else {
      // Clear form for create mode
      const preferredUnit = UnitPreferenceManager.getMealWeightUnit(me?.profile || undefined);
      setFormData({
        date: getCurrentDate(),
        time: getCurrentTime(),
        foodName: "",
        foodCategory: "",
        caloriesPerGram: 0,
        weightValue: 0,
        weightUnit: preferredUnit,
        notes: "",
      });
    }
    setErrors({});
    setSubmitSuccess(false);
  };

  const userName = me?.profile?.firstName || me?.profile?.name || "User";
  const defaultTitle = mode === 'edit' ? `Edit Meal Entry` : `Log Meal for ${userName}`;

  return (
    <Card className="max-w-5xl mx-auto gap-0 py-0">
      <CardHeader className="pb-2 sm:pb-4 pt-2 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg lg:text-xl truncate">
            {title || defaultTitle}
          </CardTitle>
          {showImport && mode === 'create' && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                disabled={importStatus.isImporting}
                className="flex items-center gap-1 text-xs touch-manipulation flex-shrink-0"
              >
                <Upload className="h-3 w-3 flex-shrink-0" />
                <span>Import</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-4 lg:p-6 pt-2 pb-4 sm:pb-6">
        {/* Import Status Alert */}
        {importStatus.message && (
          <Alert className={`py-1.5 ${
            importStatus.success
              ? "border-green-200 bg-green-50"
              : importStatus.isImporting
                ? "border-blue-200 bg-blue-50"
                : "border-red-200 bg-red-50"
          }`}>
            {importStatus.success ? (
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : importStatus.isImporting ? (
              <Loader2 className="h-4 w-4 text-blue-600 flex-shrink-0 animate-spin" />
            ) : (
              <Info className="h-4 w-4 text-red-600 flex-shrink-0" />
            )}
            <span className={`text-sm truncate ${
              importStatus.success
                ? "text-green-800"
                : importStatus.isImporting
                  ? "text-blue-800"
                  : "text-red-800"
            }`}>
              {importStatus.isImporting
                ? "Importing data..."
                : importStatus.message}
            </span>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-2.5" noValidate>
          {/* Date and Time - Stacked on mobile, side-by-side on larger screens */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-medium">Date</label>
              <DatePicker
                value={formData.date}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, date: value }));
                  validateField('date', value);
                }}
                error={!!errors.date}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-medium">Time</label>
              <TimePicker
                value={formData.time}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, time: value }));
                  validateField('time', value);
                }}
                placeholder="Select time"
                error={!!errors.time}
              />
              {errors.time && (
                <p className="text-xs text-destructive">{errors.time}</p>
              )}
            </div>
          </div>

          {/* Row 2: Food Name and Food Category */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-medium">Food Name</label>
              <Combobox
                value={formData.foodName}
                onValueChange={(value) => {
                  handleFoodSelection(value);
                  validateField('foodName', value);
                }}
                options={recentFoods}
                placeholder="Enter or select food name..."
                emptyText="No recent foods found."
              />
              {errors.foodName && (
                <p className="text-xs text-destructive">{errors.foodName}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-medium">Food Category</label>
              <Combobox
                value={formData.foodCategory}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, foodCategory: value }));
                  validateField('foodCategory', value);
                }}
                options={recentCategories}
                placeholder="Enter or select category..."
                emptyText="No recent categories found."
              />
              {errors.foodCategory && (
                <p className="text-xs text-destructive">{errors.foodCategory}</p>
              )}
            </div>
          </div>

          {/* Row 3: Weight and Calories per Gram */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-medium">Weight</label>
              <WeightInput
                value={formData.weightValue}
                unit={formData.weightUnit}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, weightValue: value }));
                  validateField('weightValue', value);
                }}
                onUnitChange={(unit) => {
                  // Ensure we only accept meal weight units
                  if (WeightConverter.isMealWeightUnit(unit)) {
                    setFormData(prev => ({ ...prev, weightUnit: unit }));
                    validateField('weightUnit', unit);
                  }
                }}
                availableUnits={WeightConverter.getMealWeightUnits()}
                placeholder="0.0"
                error={!!errors.weightValue || !!errors.weightUnit}
                inputMode="decimal"
                className="touch-manipulation min-h-[40px]"
                aria-label="Meal weight input"
              />
              {(errors.weightValue || errors.weightUnit) && (
                <p className="text-xs text-destructive">
                  {errors.weightValue || errors.weightUnit}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-medium">Calories per Gram</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.caloriesPerGram || ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, caloriesPerGram: value }));
                  validateField('caloriesPerGram', value);
                }}
                className={`${errors.caloriesPerGram ? "border-destructive focus-visible:ring-destructive" : ""} touch-manipulation min-h-[40px]`}
                inputMode="decimal"
              />
              {errors.caloriesPerGram && (
                <p className="text-xs text-destructive">{errors.caloriesPerGram}</p>
              )}
            </div>
          </div>

          {/* Notes Field */}
          <div>
            <label className="text-xs sm:text-sm font-medium">Notes (Optional)</label>
            <Textarea
              placeholder="Add notes..."
              value={formData.notes}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({ ...prev, notes: value }));
                validateField('notes', value);
              }}
              className={`${errors.notes ? "border-destructive focus-visible:ring-destructive" : ""} touch-manipulation min-h-[40px] resize-none`}
              rows={2}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes}</p>
            )}
          </div>

          {/* Compact Calorie Summary */}
          <div className="bg-muted/30 rounded-lg p-3 mb-1">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm sm:text-base font-semibold">{todayTotal.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
              <div>
                <div className={`text-sm sm:text-base font-semibold ${currentCaloriesPerGram > 0 && currentWeightValue !== 0
                  ? "text-foreground"
                  : "text-muted-foreground"
                  }`}>
                  {totalCalories.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">This Meal</div>
              </div>
              <div>
                <div className={`text-sm sm:text-base font-semibold ${totalCalories > 0 ? "text-primary" : "text-muted-foreground"
                  }`}>
                  {(todayTotal + totalCalories).toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">New Total</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={isSubmitting}
              className="flex-1 touch-manipulation"
              size="sm"
            >
              {mode === 'edit' ? 'Reset' : 'Clear'}
            </Button>
            {mode === 'edit' && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 touch-manipulation"
                size="sm"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 touch-manipulation"
              size="sm"
            >
              {isSubmitting
                ? (mode === 'edit' ? "Updating..." : "Logging...")
                : (mode === 'edit' ? "Update Meal" : "Log Meal")
              }
            </Button>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                {mode === 'edit' ? 'Meal updated successfully!' : 'Meal logged successfully!'}
              </span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
