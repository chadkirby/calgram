import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  TimePicker,
  TimePickerColumns,
  TimePickerContent,
  TimePickerFooter,
  TimePickerTrigger,
} from "@/components/reui/time-picker";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { WeightInput } from "@/components/WeightInput";
import { CalorieInput } from "@/components/CalorieInput";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SyncErrorHandler, withSyncErrorHandling } from "@/utils/SyncErrorHandler";

import { useDb } from "jazz-tools/react";
import { app } from "../../jazz/jazz.generated";
import { useAccount } from "@/lib/account";
import { toMeal, useMeals, type Meal } from "@/lib/data";
import { CalorieCalculator } from "../utils/CalorieCalculator";
import { CalorieUnitConverter } from "../utils/CalorieUnitConverter";
import { deriveFoodIntelligence } from "../utils/foodIntelligence";
import { UnitPreferenceManager } from "../utils/UnitPreferenceManager";
import { WeightConverter } from "../utils/WeightConverter";
import { Sparkles } from "lucide-react";
import * as React from "react";
import { z } from "zod";
import { DateTime } from "luxon";
import { FoodPredictor } from "../utils/FoodPredictor";

// Enhanced Zod schema for comprehensive form validation
const mealFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  foodName: z.string().min(1, "Food name is required").trim(),
  foodCategory: z.string().min(1, "Food category is required").trim(),
  caloriesPerDisplayValue: z.number().nonnegative("Calories per unit cannot be negative"),
  calorieUnit: z.enum(["g", "oz", "lb", "kg"]),
  weightValue: z.number(), // Weight in display unit (allow negative for discarded food)
  weightUnit: z.enum(["g", "oz", "lb", "kg"]),
  notes: z.string().optional().default(""),
});

type MealFormValues = z.infer<typeof mealFormSchema>;

/** Calories to one decimal place, for the readout. */
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

// Get current date in YYYY-MM-DD format for default (timezone-aware)
function getCurrentDate() {
  return DateTime.now().toISODate();
}

// Get current time in HH:MM format for default
function getCurrentTime() {
  return DateTime.now().toFormat("HH:mm");
}

interface MealEntryFormProps {
  mode: "create" | "edit";
  initialData?: Meal;
  onSuccess: (meal: Meal) => void;
  onCancel: () => void;
  showImport?: boolean; // Only show import on create mode
  title?: string; // Custom title for the form
  defaultDate?: string; // Default date for create mode (YYYY-MM-DD format)
}

export function MealEntryForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
  title,
  defaultDate,
}: MealEntryFormProps) {
  const { updateSyncStatus } = useNetworkStatus();
  const db = useDb();
  const { profile, saveProfile } = useAccount();
  const mealEntries = useMeals();

  // Parse initial data for edit mode
  const getInitialFormData = (): MealFormValues => {
    // Get user's preferred meal weight unit
    const preferredWeightUnit = UnitPreferenceManager.getMealWeightUnit(profile);
    // Default calorie unit to grams
    const preferredCalorieUnit = "g" as const;

    if (mode === "edit" && initialData) {
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
        calorieUnit,
      );

      return {
        date: dateTime.toISODate() || getCurrentDate(),
        time: dateTime.toFormat("HH:mm"),
        foodName: initialData.foodName,
        foodCategory: initialData.foodCategory,
        caloriesPerDisplayValue: caloriesPerDisplayValue,
        calorieUnit: calorieUnit,
        // Thrown-out food is stored as negative grams; the field shows the amount, the switch the sign.
        weightValue: Math.abs(weightValue),
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
  // Thrown out: food weighed after it was taken away, logged as negative grams and calories.
  const initiallyThrownOut = mode === "edit" && !!initialData && initialData.weightInGrams < 0;
  const [thrownOut, setThrownOut] = React.useState(initiallyThrownOut);
  const sign = thrownOut ? -1 : 1;
  const [errors, setErrors] = React.useState<Partial<Record<keyof MealFormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [prefilled, setPrefilled] = React.useState<{
    foodName?: string;
    foodCategory?: string;
  } | null>(null);

  // Real-time validation helper
  const validateField = (field: keyof MealFormValues, value: any) => {
    try {
      const fieldSchema = mealFormSchema.shape[field];
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

  // Food suggestions, derived from the meals themselves (KTD11)
  const foodIntelligence = React.useMemo(
    () => (mealEntries ? deriveFoodIntelligence(mealEntries) : undefined),
    [mealEntries],
  );
  const recentFoods = foodIntelligence?.recentFoods ?? [];
  const recentCategories = foodIntelligence?.recentCategories ?? [];

  // Prefill for create mode using FoodPredictor; never overwrite after user types.
  // Runs during render on mount and whenever mode, the meal entries list or food intelligence
  // change (the tracker is updated before any bail-out so each change is consumed once).
  const [prevPrefillDeps, setPrevPrefillDeps] = React.useState<{
    mode: typeof mode;
    mealEntries: typeof mealEntries;
    foodIntelligence: typeof foodIntelligence;
  } | null>(null);
  if (
    prevPrefillDeps === null ||
    prevPrefillDeps.mode !== mode ||
    prevPrefillDeps.mealEntries !== mealEntries ||
    prevPrefillDeps.foodIntelligence !== foodIntelligence
  ) {
    setPrevPrefillDeps({ mode, mealEntries, foodIntelligence });
    applyPrediction();
  }

  function applyPrediction() {
    if (mode !== "create") return;
    if (!mealEntries) return;
    // Only prefill if fields are still empty
    if (formData.foodName?.trim() || formData.foodCategory?.trim()) return;

    if (mealEntries.length === 0) return;

    const prediction = FoodPredictor.getTopFoodPredictions(mealEntries, new Date(), 4, 1)[0];
    if (!prediction) return;

    const predictedFood = prediction.foodName;
    const resolvedCategory =
      FoodPredictor.resolveCategoryForFood(foodIntelligence, predictedFood, prediction.entries) ||
      "";

    // If food intelligence has a lastUsedCPG for this food, prefill calories per display unit (keep current unit)
    let caloriesPerDisplayValue = formData.caloriesPerDisplayValue;
    if (foodIntelligence?.foodData?.[predictedFood]?.lastUsedCPG != null) {
      const cpg = foodIntelligence.foodData[predictedFood].lastUsedCPG;
      caloriesPerDisplayValue = CalorieUnitConverter.fromCaloriesPerGram(cpg, formData.calorieUnit);
    }

    setFormData((prev) => ({
      ...prev,
      foodName: predictedFood,
      foodCategory: resolvedCategory,
      caloriesPerDisplayValue,
    }));
    setPrefilled({ foodName: predictedFood, foodCategory: resolvedCategory || undefined });
  }

  // Handle food selection to auto-populate fields
  const handleFoodSelection = (foodName: string) => {
    // Always update the foodName in form data
    setFormData((prev) => ({ ...prev, foodName }));

    // If we have food intelligence data, try to auto-populate other fields
    if (foodIntelligence) {
      const foodData = foodIntelligence.foodData?.[foodName];
      if (foodData) {
        // Convert stored calories per gram to display unit
        const caloriesPerDisplayValue = CalorieUnitConverter.fromCaloriesPerGram(
          foodData.lastUsedCPG,
          formData.calorieUnit,
        );

        // Auto-populate calories and category from previous usage
        setFormData((prev) => ({
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
  const currentCaloriesPerGram =
    currentCaloriesPerDisplayValue > 0
      ? CalorieUnitConverter.toCaloriesPerGram(currentCaloriesPerDisplayValue, currentCalorieUnit)
      : 0;

  // Convert weight to grams for calorie calculations
  const currentWeightInGrams =
    currentWeightValue > 0 ? WeightConverter.toGrams(currentWeightValue, currentWeightUnit) : 0;

  // Calculate total calories for current meal (always use grams)
  const totalCalories = CalorieCalculator.calculateMealCalories(
    currentWeightInGrams,
    currentCaloriesPerGram,
  );

  // The day this meal lands on, before this meal: in edit mode the meal's saved calories are
  // already in that day's total, so they come out first.
  const formDay = DateTime.fromISO(formData.date);
  const dayTotalBefore =
    CalorieCalculator.calculateDailyTotal(mealEntries, formDay.toISO() ?? "") -
    (mode === "edit" &&
    initialData &&
    DateTime.fromISO(initialData.timestamp).hasSame(formDay, "day")
      ? initialData.totalCalories
      : 0);
  const dayLabel = formDay.hasSame(DateTime.now(), "day")
    ? "Today"
    : formDay.toLocaleString({ month: "short", day: "numeric" });
  const [timeOpen, setTimeOpen] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    console.log("Submitting meal form:", formData);
    e.preventDefault();

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

    try {
      const validatedData = validationResult.data;

      // Convert weight to grams for storage and calculations (the field is always positive)
      const gramsWeighed = WeightConverter.toGrams(
        Math.abs(validatedData.weightValue),
        validatedData.weightUnit,
      );

      // Convert calories per display unit to calories per gram for storage
      const caloriesPerGram = CalorieUnitConverter.toCaloriesPerGram(
        validatedData.caloriesPerDisplayValue,
        validatedData.calorieUnit,
      );

      // Calculate total calories (always use grams); thrown-out food counts against the day
      const weightInGrams = sign * gramsWeighed;
      const mealTotalCalories =
        sign * CalorieCalculator.calculateMealCalories(gramsWeighed, caloriesPerGram);

      // Save user's unit preference
      if (profile?.mealWeightUnit !== validatedData.weightUnit) {
        saveProfile({ mealWeightUnit: validatedData.weightUnit });
      }

      // Combine date and time to create ISO timestamp. An edit that leaves both alone keeps the
      // meal's own timestamp, seconds and offset included, instead of rebuilding it from HH:mm.
      const original =
        mode === "edit" && initialData ? DateTime.fromISO(initialData.timestamp) : null;
      const timeUnchanged =
        !!original &&
        original.toISODate() === validatedData.date &&
        original.toFormat("HH:mm") === validatedData.time;
      const isoTimestamp = timeUnchanged
        ? initialData!.timestamp
        : DateTime.fromISO(`${validatedData.date}T${validatedData.time}`).toISO();

      if (!isoTimestamp) {
        throw new Error("Invalid date/time combination");
      }

      // Timestamps are stored exactly as built here (KTD10).
      const fields = {
        timestamp: isoTimestamp,
        foodName: validatedData.foodName,
        foodCategory: validatedData.foodCategory,
        caloriesPerGram: caloriesPerGram, // Store as calories per gram
        caloriesPerDisplayUnit: validatedData.calorieUnit, // Store display unit
        weightInGrams: weightInGrams, // Store in grams
        displayUnit: validatedData.weightUnit, // Store display unit
        notes: validatedData.notes || "",
        totalCalories: mealTotalCalories,
      };

      const mealEntry = await withSyncErrorHandling(
        async (): Promise<Meal> => {
          if (mode === "edit" && initialData) {
            db.update(app.mealEntries, initialData.id, fields);
            return { ...initialData, ...fields };
          }
          return toMeal(db.insert(app.mealEntries, fields).value);
        },
        mode === "edit" ? "meal-update" : "meal-creation",
        updateSyncStatus,
      )();

      // Call success callback
      onSuccess(mealEntry);

      // For create mode, reset form after success
      if (mode === "create") {
        const preferredWeightUnit = UnitPreferenceManager.getMealWeightUnit(profile);
        const preferredCalorieUnit = "g" as const;
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
        setThrownOut(false);
        setErrors({});
      }
    } catch (error) {
      console.error("Error saving meal:", error);
      SyncErrorHandler.handleSyncError(error, updateSyncStatus);

      // Set a user-friendly error message
      setErrors({
        foodName: "Failed to save meal. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    if (mode === "edit" && initialData) {
      // Reset to initial data for edit mode
      setFormData(getInitialFormData());
    } else {
      // Clear form for create mode
      const preferredWeightUnit = UnitPreferenceManager.getMealWeightUnit(profile);
      const preferredCalorieUnit = "g" as const;
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
    setThrownOut(initiallyThrownOut);
    setErrors({});
  };

  const notesId = React.useId();

  const userName = profile?.firstName || profile?.name || "User";
  const defaultTitle = mode === "edit" ? `Edit Meal Entry` : `Log a meal for ${userName}`;

  const rowLabel = "w-20 shrink-0 text-muted-foreground";
  const rowControl =
    "h-auto min-h-14 flex-1 min-w-0 justify-between rounded-none border-0 bg-transparent px-0 has-[>svg]:px-0 text-base font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent";

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <DialogHeader className="px-5 pt-5 pb-2 text-left">
        <DialogTitle className="pr-8 text-xl tracking-tight">{title || defaultTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          Enter the weight from the scale, then check the food, calories and time.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {/* Scale readout */}
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-muted/60 p-4">
          <WeightInput
            value={formData.weightValue}
            unit={formData.weightUnit}
            onValueChange={(value) => {
              setFormData((prev) => ({ ...prev, weightValue: value }));
              validateField("weightValue", value);
            }}
            onUnitChange={(unit) => {
              // Ensure we only accept meal weight units
              if (WeightConverter.isMealWeightUnit(unit)) {
                setFormData((prev) => ({ ...prev, weightUnit: unit }));
                validateField("weightUnit", unit);
              }
            }}
            availableUnits={WeightConverter.getMealWeightUnits()}
            placeholder="0"
            error={!!errors.weightValue || !!errors.weightUnit}
            inputMode="decimal"
            className="w-full max-w-[300px] rounded-xl border-2 bg-background pr-2 focus-within:ring-[3px] focus-within:ring-ring/40 focus-within:ring-offset-0"
            inputClassName="h-24 pl-16 text-center focus:placeholder:text-transparent text-[56px] font-bold leading-none tracking-tight tabular-nums md:text-[56px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Meal weight input"
          />
          {(errors.weightValue || errors.weightUnit) && (
            <p className="text-sm text-destructive">{errors.weightValue || errors.weightUnit}</p>
          )}
          <p className="text-center tabular-nums" aria-live="polite">
            {totalCalories > 0 ? (
              <>
                <span className="text-xl font-bold">
                  {thrownOut ? "−" : "+"}
                  {fmt(totalCalories)} cal
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {dayLabel} {fmt(dayTotalBefore)} → {fmt(dayTotalBefore + sign * totalCalories)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {dayLabel} so far: {fmt(dayTotalBefore)} cal
              </span>
            )}
          </p>
          <Tabs
            value={thrownOut ? "thrown-out" : "eaten"}
            onValueChange={(value) => setThrownOut(value === "thrown-out")}
          >
            <TabsList aria-label="Eaten or thrown out">
              <TabsTrigger value="eaten" className="px-4">
                Eaten
              </TabsTrigger>
              <TabsTrigger value="thrown-out" className="px-4">
                Thrown out
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        {/* Everything else, as short rows */}
        <div className="mt-4 divide-y rounded-xl border bg-card">
          <fieldset className="flex min-w-0 items-center gap-3 px-4">
            <legend className="sr-only">Food Name</legend>
            <span className={rowLabel} aria-hidden="true">
              Food
            </span>
            <Combobox
              value={formData.foodName}
              onValueChange={(value) => {
                handleFoodSelection(value);
                // If the user types/changes the food name manually, clear prefill hint
                setPrefilled(null);
                validateField("foodName", value);
              }}
              options={recentFoods}
              placeholder="Choose a food"
              emptyText="No recent foods found."
              className={cn(rowControl, !formData.foodName && "font-normal text-muted-foreground")}
            />
            {prefilled?.foodName && (
              <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </fieldset>
          {errors.foodName && (
            <p className="px-4 py-2 text-sm text-destructive">{errors.foodName}</p>
          )}

          <fieldset className="flex min-w-0 items-center gap-3 px-4">
            <legend className="sr-only">Food Category</legend>
            <span className={rowLabel} aria-hidden="true">
              Category
            </span>
            <Combobox
              value={formData.foodCategory}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, foodCategory: value }));
                // If user changes category manually, also clear prefill hint
                setPrefilled(null);
                validateField("foodCategory", value);
              }}
              options={recentCategories}
              placeholder="Choose a category"
              emptyText="No recent categories found."
              className={cn(
                rowControl,
                !formData.foodCategory && "font-normal text-muted-foreground",
                errors.foodCategory && "text-destructive",
              )}
            />
          </fieldset>
          {errors.foodCategory && (
            <p className="px-4 py-2 text-sm text-destructive">{errors.foodCategory}</p>
          )}

          <fieldset className="flex min-w-0 items-center gap-3 px-4 py-2">
            <legend className="sr-only">Calories per Unit</legend>
            <span className={rowLabel} aria-hidden="true">
              Calories
            </span>
            <CalorieInput
              value={formData.caloriesPerDisplayValue}
              unit={formData.calorieUnit}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, caloriesPerDisplayValue: value }));
                validateField("caloriesPerDisplayValue", value);
              }}
              onUnitChange={(unit) => {
                setFormData((prev) => ({ ...prev, calorieUnit: unit }));
                validateField("calorieUnit", unit);
              }}
              placeholder="0.00"
              error={!!errors.caloriesPerDisplayValue || !!errors.calorieUnit}
              inputMode="decimal"
              className="min-w-0 flex-1 touch-manipulation border-0 bg-transparent shadow-none dark:bg-transparent [&_input]:pl-0 [&_input]:text-base [&_input]:font-medium"
              aria-label="Calorie density input"
            />
          </fieldset>
          {(errors.caloriesPerDisplayValue || errors.calorieUnit) && (
            <p className="px-4 py-2 text-sm text-destructive">
              {errors.caloriesPerDisplayValue || errors.calorieUnit}
            </p>
          )}

          <fieldset className="flex min-w-0 items-center gap-3 px-4">
            <legend className="sr-only">Time</legend>
            <span className={rowLabel} aria-hidden="true">
              Time
            </span>
            <TimePicker
              value={formData.time}
              onValueChange={(value) => {
                // Time is required: there is no Clear, so a value always comes back.
                if (!value) return;
                setFormData((prev) => ({ ...prev, time: value }));
                validateField("time", value);
              }}
              open={timeOpen}
              onOpenChange={setTimeOpen}
              hourCycle={24}
              minuteStep={15}
              invalid={!!errors.time}
              aria-label="Time"
            >
              <TimePickerTrigger className={cn(rowControl, "tabular-nums")} />
              <TimePickerContent align="end">
                <TimePickerColumns />
                <TimePickerFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // The exact time, not rounded to the 15-minute steps.
                      setFormData((prev) => ({ ...prev, time: getCurrentTime() }));
                      setTimeOpen(false);
                    }}
                  >
                    Now
                  </Button>
                  <Button type="button" size="sm" onClick={() => setTimeOpen(false)}>
                    Done
                  </Button>
                </TimePickerFooter>
              </TimePickerContent>
            </TimePicker>
          </fieldset>

          <fieldset className="flex min-w-0 items-center gap-3 px-4">
            <legend className="sr-only">Date</legend>
            <span className={rowLabel} aria-hidden="true">
              Date
            </span>
            <DatePicker
              value={formData.date}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, date: value }));
                validateField("date", value);
              }}
              error={!!errors.date}
              className={cn(rowControl, "justify-start [&_svg]:hidden")}
            />
          </fieldset>
          {(errors.date || errors.time) && (
            <p className="px-4 py-2 text-sm text-destructive">{errors.date || errors.time}</p>
          )}

          <div className="flex min-w-0 items-start gap-3 px-4 py-2">
            <label htmlFor={notesId} className={cn(rowLabel, "py-2")}>
              Note
            </label>
            <Textarea
              id={notesId}
              placeholder="Add a note"
              value={formData.notes}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => ({ ...prev, notes: value }));
                validateField("notes", value);
              }}
              className="min-h-10 flex-1 resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
              rows={1}
            />
          </div>
        </div>

        {prefilled?.foodName && !errors.foodName && (
          <p className="mt-3 flex items-center gap-1.5 px-1 text-sm text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" /> Filled in from {userName}’s recent
            meals
          </p>
        )}
      </div>

      <div
        className="flex items-center gap-2 border-t bg-background px-4 pt-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={handleClear}
          disabled={isSubmitting}
          className="h-12 px-4 touch-manipulation"
        >
          {mode === "edit" ? "Reset" : "Clear"}
        </Button>
        {mode === "edit" && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-12 px-4 touch-manipulation"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 flex-1 text-base touch-manipulation"
        >
          {isSubmitting
            ? mode === "edit"
              ? "Updating..."
              : "Logging..."
            : mode === "edit"
              ? "Update Meal"
              : thrownOut
                ? "Log Thrown Out"
                : "Log Meal"}
        </Button>
      </div>
    </form>
  );
}

/** DialogContent classes that make the meal form a sheet from the bottom on phones. */
export const mealSheetClassName = cn(
  "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
  "max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0",
  "max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100",
  "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom max-sm:duration-300",
);
