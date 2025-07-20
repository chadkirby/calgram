import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, WeightEntry } from "../schema";
import { Check } from "lucide-react";
import * as React from "react";
import { z } from "zod";

// Zod schema for weight form validation
const weightFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  weightValue: z
    .number()
    .positive("Weight must be a positive number")
    .min(0.1, "Weight must be at least 0.1")
    .max(1000, "Weight must be less than 1000"),
  notes: z
    .string()
    .optional()
    .default(""),
});

type WeightFormValues = z.infer<typeof weightFormSchema>;

export function WeightPage() {
  const { me } = useAccount(JazzAccount, {
    resolve: { profile: true, root: true },
  });

  const userName = me?.profile?.firstName || me?.profile?.name || "User";

  // Get current date in YYYY-MM-DD format for default
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = React.useState<WeightFormValues>({
    date: getCurrentDate(),
    weightValue: 0,
    notes: "",
  });

  const [errors, setErrors] = React.useState<Partial<Record<keyof WeightFormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

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
    if (!me?.root) return;

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

      // Create weight entry using Jazz schema
      const weightEntry = WeightEntry.create({
        timestamp: new Date(validatedData.date),
        weightValue: validatedData.weightValue,
        notes: validatedData.notes || "",
      }, me.root._owner);

      // Add to weight entries
      me.root.weightEntries?.push(weightEntry);

      // Reset form
      setFormData({
        date: getCurrentDate(),
        weightValue: 0,
        notes: "",
      });
      setErrors({});

      // Show success feedback
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);

    } catch (error) {
      console.error("Error recording weight:", error);
      // Set a general error message
      setErrors({ weightValue: "Failed to record weight. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Record Weight for {userName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, date: value }));
                  validateField('date', value);
                }}
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
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, notes: value }));
                  validateField('notes', value);
                }}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">{errors.notes}</p>
              )}
            </div>

            {submitSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Success!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Weight recorded successfully.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    date: getCurrentDate(),
                    weightValue: 0,
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
                {isSubmitting ? "Recording..." : "Record Weight"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}