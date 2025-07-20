import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";

import { useAccount } from "jazz-tools/react";
import { JazzAccount, MealEntry } from "../schema";
import { CalorieCalculator } from "../utils/CalorieCalculator";
import { FoodIntelligenceManager } from "../utils/FoodIntelligenceManager";
import { DataImporter } from "../utils/DataImporter";
import { Info, Check, Upload } from "lucide-react";
import * as React from "react";
import { z } from "zod";

// Zod schema for form validation - focused on essential requirements only
const mealFormSchema = z.object({
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
    .nonnegative("Calories per gram cannot be negative"), // Allow 0 for water, etc.
  weightInGrams: z
    .number(), // Allow negative for "didn't eat all of it" use case
  notes: z
    .string()
    .optional()
    .default(""),
});

type MealFormValues = z.infer<typeof mealFormSchema>;

export function MealPage() {
  const { me } = useAccount(JazzAccount, {
    resolve: { profile: true, root: true },
  });

  const userName = me?.profile?.firstName || me?.profile?.name || "User";

  const [formData, setFormData] = React.useState<MealFormValues>({
    foodName: "",
    foodCategory: "",
    caloriesPerGram: 0,
    weightInGrams: 0,
    notes: "",
  });

  const [errors, setErrors] = React.useState<Partial<Record<keyof MealFormValues, string>>>({});

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
  const currentWeight = formData.weightInGrams || 0;

  // Calculate total calories for current meal
  const totalCalories = CalorieCalculator.calculateMealCalories(
    currentWeight,
    currentCaloriesPerGram
  );

  // Calculate today's total calories
  const todayTotal = me?.root?.mealEntries
    ? CalorieCalculator.calculateDailyTotal(
      [...me.root.mealEntries].filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      new Date()
    )
    : 0;

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

  // Handle data import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !me) {
      return;
    }

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
        message: `Successfully imported ${result.mealCount} meals and ${result.weightCount} weight entries!`,
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        setImportStatus(prev => ({ ...prev, success: false, message: "" }));
      }, 5000);

    } catch (error) {
      console.error("Import failed:", error);
      setImportStatus({
        isImporting: false,
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      // Clear error message after 5 seconds
      setTimeout(() => {
        setImportStatus(prev => ({ ...prev, message: "" }));
      }, 5000);
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

      // Calculate total calories
      const totalCalories = CalorieCalculator.calculateMealCalories(
        validatedData.weightInGrams,
        validatedData.caloriesPerGram
      );

      // Create meal entry using Jazz schema
      const mealEntry = MealEntry.create({
        timestamp: new Date(),
        foodName: validatedData.foodName,
        foodCategory: validatedData.foodCategory,
        caloriesPerGram: validatedData.caloriesPerGram,
        weightInGrams: validatedData.weightInGrams,
        notes: validatedData.notes || "",
        totalCalories,
      }, me.root._owner);

      // Add to meal entries
      me.root.mealEntries?.push(mealEntry);

      // Update food intelligence
      if (foodIntelligence) {
        FoodIntelligenceManager.updateFoodData(
          foodIntelligence,
          mealEntry
        );
      }

      // Reset form
      setFormData({
        foodName: "",
        foodCategory: "",
        caloriesPerGram: 0,
        weightInGrams: 0,
        notes: "",
      });
      setErrors({});

      // Show success feedback
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);

    } catch (error) {
      console.error("Error logging meal:", error);
      // You could add error handling/toast here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Log Meal for {userName}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                disabled={importStatus.isImporting}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {importStatus.isImporting ? "Importing..." : "Import Data"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Import Status Alert */}
          {importStatus.message && (
            <Alert className={importStatus.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              {importStatus.success ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Info className="h-4 w-4 text-red-600" />
              )}
              <AlertTitle className={importStatus.success ? "text-green-800" : "text-red-800"}>
                {importStatus.success ? "Import Successful!" : "Import Failed"}
              </AlertTitle>
              <AlertDescription className={importStatus.success ? "text-green-700" : "text-red-700"}>
                {importStatus.message}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Food Name</label>
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
                <p className="text-sm text-destructive">{errors.foodName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Food Category</label>
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
                <p className="text-sm text-destructive">{errors.foodCategory}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Weight (grams)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={formData.weightInGrams || ""}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setFormData(prev => ({ ...prev, weightInGrams: value }));
                    validateField('weightInGrams', value);
                  }}
                />
                {errors.weightInGrams && (
                  <p className="text-sm text-destructive">{errors.weightInGrams}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Calories per Gram</label>
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
                />
                {errors.caloriesPerGram && (
                  <p className="text-sm text-destructive">{errors.caloriesPerGram}</p>
                )}
              </div>
            </div>

            {/* Reactive calorie calculations */}
            {(currentCaloriesPerGram > 0 && currentWeight > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Total calories for this meal:</span>
                <Badge variant="secondary" className="text-base font-semibold">
                  {totalCalories.toFixed(1)} cal
                </Badge>
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Today's Total</AlertTitle>
              <AlertDescription>
                You have consumed {todayTotal.toFixed(1)} calories today.
                {totalCalories > 0 && (
                  <span className="block mt-1">
                    Adding this meal will bring your total to {(todayTotal + totalCalories).toFixed(1)} calories.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any additional notes about this meal..."
                value={formData.notes}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, notes: value }));
                  validateField('notes', value);
                }}
              />
            </div>

            {submitSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Success!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Meal logged successfully. Your food intelligence has been updated.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    foodName: "",
                    foodCategory: "",
                    caloriesPerGram: 0,
                    weightInGrams: 0,
                    notes: "",
                  });
                  setErrors({});
                  setSubmitSuccess(false);
                }}
                disabled={isSubmitting}
              >
                Clear
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Logging..." : "Log Meal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
