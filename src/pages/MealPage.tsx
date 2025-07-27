import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MealPageErrorFallback } from "@/components/PageErrorFallback";
import { NetworkErrorHandler, ConnectionStatus } from "@/components/NetworkErrorHandler";
import { MealEntryForm } from "@/components/MealEntryForm";

import { useAccount } from "jazz-tools/react";
import { JazzAccount, MealEntry } from "../schema";
import { type Loaded } from "jazz-tools";

function MealPageContent() {
  const { me } = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        mealEntries: { $each: true },  // Load each meal entry for today's total calculation
        weightEntries: { $each: true },
        foodIntelligence: {  // Load foodIntelligence for auto-completion
          recentFoods: { $each: true },
          recentCategories: { $each: true },
          foodData: { $each: true }
        }
      }
    },
  });

  // Add loading state
  if (!me?.root) {
    return (
      <div className="space-y-6">
        <div className="max-w-2xl mx-auto p-6 text-center">
          Loading your calorie tracker...
        </div>
      </div>
    );
  }

  // Check if required collections are missing
  if (!me.root.mealEntries || !me.root.foodIntelligence) {
    return (
      <div className="space-y-6">
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p>Setting up your calorie tracker...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please refresh the page if this takes more than a few seconds.
          </p>
        </div>
      </div>
    );
  }

  const handleMealSuccess = (meal: Loaded<typeof MealEntry>) => {
    // Meal was successfully created/updated
    console.log("Meal logged successfully:", meal);
  };

  const handleMealCancel = () => {
    // This won't be called in create mode, but required for the interface
    console.log("Meal creation cancelled");
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <ConnectionStatus />
      <MealEntryForm
        mode="create"
        onSuccess={handleMealSuccess}
        onCancel={handleMealCancel}
        me={me}
        showImport={true}
      />
    </div>
  );
}

export function MealPage() {
  return (
    <ErrorBoundary fallback={MealPageErrorFallback}>
      <NetworkErrorHandler>
        <MealPageContent />
      </NetworkErrorHandler>
    </ErrorBoundary>
  );
}
