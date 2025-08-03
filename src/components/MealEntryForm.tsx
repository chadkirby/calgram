import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { WeightInput } from "@/components/WeightInput";
import { CalorieInput } from "@/components/CalorieInput";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";

import { JazzAccount, MealEntry } from "../schema";
import { CalorieCalculator } from "../utils/CalorieCalculator";
import { CalorieUnitConverter } from "../utils/CalorieUnitConverter";
import { FoodIntelligenceManager } from "../utils/FoodIntelligenceManager";
import { UnitPreferenceManager } from "../utils/UnitPreferenceManager";
import { WeightConverter } from "../utils/WeightConverter";
import { Check } from "lucide-react";
import * as React from "react";
import { z } from "zod";
import { DateTime } from "luxon";
import { type Loaded } from "jazz-tools";
import { FoodPredictor } from "../utils/FoodPredictor";

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
  caloriesPerDisplayValue: z
    .number()
    .nonnegative("Calories per unit cannot be negative"),
  calorieUnit: z.enum(['g', 'oz', 'lb', 'kg']),
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
    const preferredWeightUnit = UnitPreferenceManager.getMealWeightUnit(me?.profile || undefined);
    // Default calorie unit to grams
    const preferredCalorieUnit = 'g' as const;

    if (mode === 'edit' && initialData) {
      const dateTime = DateTime.fromISO(initialData.timestamp);

      // For edit mode, use the stored display unit or convert from grams to preferred unit
      const displayUnit = initialData.displayUnit || preferredWeightUnit;
      const weightValue = initialData.displayUnit
        ? WeightConverter.fromGrams(initialData.weightInGrams, displayUnit)
        : WeightConverter.fromGrams(initialData.weightInGrams, preferredWeightUnit);

      // For calories, use stored display unit or default to grams
      const calorieUnit = initialData.caloriesPerDisplayUnit || preferredCalorieUnit;
      const caloriesPerDisplayValue = CalorieUnitConverter.fromCaloriesPerGram(
        initialData.caloriesPerGram,
        calorieUnit
      );

      return {
        date: dateTime.toISODate() || getCurrentDate(),
        time: dateTime.toFormat('HH:mm'),
        foodName: initialData.foodName,
        foodCategory: initialData.foodCategory,
        caloriesPerDisplayValue: caloriesPerDisplayValue,
        calorieUnit: calorieUnit,
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
      caloriesPerDisplayValue: 0,
      calorieUnit: preferredCalorieUnit,
      weightValue: 0,
      weightUnit: preferredWeightUnit,
      notes: "",
    };
  };

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [formData, setFormData] = React.useState<MealFormValues>(getInitialFormData);
  const [errors, setErrors] = React.useState<Partial<Record<keyof MealFormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [prefilled, setPrefilled] = React.useState<{ foodName?: string; foodCategory?: string } | null>(null);

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

  // Mount-only prefill for create mode using FoodPredictor; never overwrite after user types
  React.useEffect(() => {
    if (mode !== 'create') return;
    if (!me?.root?.mealEntries) return;
    // Only prefill if fields are still empty
    if (formData.foodName?.trim() || formData.foodCategory?.trim()) return;

    const entries = [...me.root.mealEntries].filter((e): e is NonNullable<typeof e> => e != null);
    if (entries.length === 0) return;

    const prediction = FoodPredictor.getTopFoodPredictions(entries, new Date(), 4, 1)[0];
    if (!prediction) return;

    const predictedFood = prediction.foodName;
    const resolvedCategory = FoodPredictor.resolveCategoryForFood(
      foodIntelligence || undefined,
      predictedFood,
      prediction.entries
    ) || "";

    // If food intelligence has a lastUsedCPG for this food, prefill calories per display unit (keep current unit)
    let caloriesPerDisplayValue = formData.caloriesPerDisplayValue;
    if (foodIntelligence?.foodData?.[predictedFood]?.lastUsedCPG != null) {
      const cpg = foodIntelligence.foodData[predictedFood].lastUsedCPG;
      caloriesPerDisplayValue = CalorieUnitConverter.fromCaloriesPerGram(cpg, formData.calorieUnit);
    }

    setFormData(prev => ({
      ...prev,
      foodName: predictedFood,
      foodCategory: resolvedCategory,
      caloriesPerDisplayValue,
    }));
    setPrefilled({ foodName: predictedFood, foodCategory: resolvedCategory || undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, me?.root?.mealEntries, foodIntelligence]);

  // Handle food selection to auto-populate fields
  const handleFoodSelection = (foodName: string) => {
    // Always update the foodName in form data
    setFormData(prev => ({ ...prev, foodName }));

    // If we have food intelligence data, try to auto-populate other fields
    if (foodIntelligence) {
      const foodData = foodIntelligence.foodData?.[foodName];
      if (foodData) {
        // Convert stored calories per gram to display unit
        const caloriesPerDisplayValue = CalorieUnitConverter.fromCaloriesPerGram(
          foodData.lastUsedCPG,
          formData.calorieUnit
        );

        // Auto-populate calories and category from previous usage
        setFormData(prev => ({
          ...prev,
          foodName,
          caloriesPerDisplayValue: caloriesPerDisplayValue,
          foodCategory: foodData.lastUsedCategory,
        }));
      }
    }
  };

  // Get current values for reactive calculations
  const currentCaloriesPerDisplayValue = formData.caloriesPerDisplayValue || 0;
  const currentCalorieUnit = formData.calorieUnit;
  const currentWeightValue = formData.weightValue || 0;
  const currentWeightUnit = formData.weightUnit;

  // Convert calories per display unit to calories per gram for calculations
  const currentCaloriesPerGram = currentCaloriesPerDisplayValue > 0
    ? CalorieUnitConverter.toCaloriesPerGram(currentCaloriesPerDisplayValue, currentCalorieUnit)
    : 0;

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

      // Convert calories per display unit to calories per gram for storage
      const caloriesPerGram = CalorieUnitConverter.toCaloriesPerGram(
        validatedData.caloriesPerDisplayValue,
        validatedData.calorieUnit
      );

      // Calculate total calories (always use grams)
      const totalCalories = CalorieCalculator.calculateMealCalories(
        weightInGrams,
        caloriesPerGram
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
            initialData.caloriesPerGram = caloriesPerGram; // Store as calories per gram
            initialData.caloriesPerDisplayUnit = validatedData.calorieUnit; // Store display unit
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
              caloriesPerGram: caloriesPerGram, // Store as calories per gram
              caloriesPerDisplayUnit: validatedData.calorieUnit, // Store display unit
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
        const preferredWeightUnit = UnitPreferenceManager.getMealWeightUnit(me?.profile || undefined);
        const preferredCalorieUnit = 'g' as const;
        setFormData({
          date: getCurrentDate(),
          time: getCurrentTime(),
          foodName: "",
          foodCategory: "",
          caloriesPerDisplayValue: 0,
          calorieUnit: preferredCalorieUnit,
          weightValue: 0,
          weightUnit: preferredWeightUnit,
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
      const preferredWeightUnit = UnitPreferenceManager.getMealWeightUnit(me?.profile || undefined);
      const preferredCalorieUnit = 'g' as const;
      setFormData({
        date: getCurrentDate(),
        time: getCurrentTime(),
        foodName: "",
        foodCategory: "",
        caloriesPerDisplayValue: 0,
        calorieUnit: preferredCalorieUnit,
        weightValue: 0,
        weightUnit: preferredWeightUnit,
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
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-4 lg:p-6 pt-2 pb-4 sm:pb-6">

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
                  // If the user types/changes the food name manually, clear prefill hint
                  setPrefilled(null);
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
                  // If user changes category manually, also clear prefill hint
                  setPrefilled(null);
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
          {!errors.foodName && prefilled?.foodName && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Prediction based on recent meals</p>
          )}

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
              <label className="text-xs sm:text-sm font-medium">Calories per Unit</label>
              <CalorieInput
                value={formData.caloriesPerDisplayValue}
                unit={formData.calorieUnit}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, caloriesPerDisplayValue: value }));
                  validateField('caloriesPerDisplayValue', value);
                }}
                onUnitChange={(unit) => {
                  setFormData(prev => ({ ...prev, calorieUnit: unit }));
                  validateField('calorieUnit', unit);
                }}
                placeholder="0.00"
                error={!!errors.caloriesPerDisplayValue || !!errors.calorieUnit}
                inputMode="decimal"
                className="touch-manipulation min-h-[40px]"
                aria-label="Calorie density input"
              />
              {(errors.caloriesPerDisplayValue || errors.calorieUnit) && (
                <p className="text-xs text-destructive">
                  {errors.caloriesPerDisplayValue || errors.calorieUnit}
                </p>
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
                <div className={`text-sm sm:text-base font-semibold ${currentCaloriesPerDisplayValue > 0 && currentWeightValue !== 0
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
