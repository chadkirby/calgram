import * as React from "react";
import { Input } from "@/components/ui/input";
import { WeightUnitSelector, type WeightUnit } from "@/components/WeightUnitSelector";
import { WeightConverter } from "@/utils/WeightConverter";
import { cn } from "@/lib/utils";

interface WeightInputProps {
  value: number;
  unit: WeightUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: WeightUnit) => void;
  availableUnits: WeightUnit[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  inputMode?: "decimal" | "numeric";
  step?: string;
  min?: number;
  max?: number;
}

export function WeightInput({
  value,
  unit,
  onValueChange,
  onUnitChange,
  availableUnits,
  placeholder = "0.0",
  className,
  disabled = false,
  error = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  inputMode = "decimal",
  step = "0.1",
  min,
  max,
}: WeightInputProps) {
  // Track the displayed value separately from the prop value to handle conversion smoothly
  const [displayValue, setDisplayValue] = React.useState<string>("");
  const [isConverting, setIsConverting] = React.useState(false);

  // Update display value when value or unit changes from parent
  React.useEffect(() => {
    if (!isConverting) {
      setDisplayValue(value > 0 ? value.toString() : "");
    }
  }, [value, unit, isConverting]);

  // Handle input value changes
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Parse and validate the input
    const numericValue = parseFloat(inputValue);
    if (inputValue === "" || inputValue === "0") {
      onValueChange(0);
    } else if (!isNaN(numericValue) && numericValue >= 0) {
      onValueChange(numericValue);
    }
  };

  // Handle unit changes with automatic value conversion
  const handleUnitChange = (newUnit: WeightUnit) => {
    if (newUnit === unit || value <= 0) {
      onUnitChange(newUnit);
      return;
    }

    try {
      setIsConverting(true);
      
      // Convert the current value to the new unit
      const convertedValue = WeightConverter.convert(value, unit, newUnit);
      
      // Update both the unit and the converted value
      onUnitChange(newUnit);
      onValueChange(convertedValue);
      
      // Update display value to show converted amount
      setDisplayValue(convertedValue.toString());
      
    } catch (error) {
      console.error("Error converting weight units:", error);
      // If conversion fails, just change the unit without converting the value
      onUnitChange(newUnit);
    } finally {
      // Reset converting flag after a brief delay to allow for smooth updates
      setTimeout(() => setIsConverting(false), 100);
    }
  };

  // Only use explicit min/max props if provided, no arbitrary range validation
  const effectiveMin = min !== undefined ? min : 0;
  const effectiveMax = max !== undefined ? max : Number.MAX_SAFE_INTEGER;

  // Only show validation errors for explicit prop-based validation
  const showRangeError = false; // Remove arbitrary range validation

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Weight Input Field */}
      <Input
        type="number"
        step={step}
        min={effectiveMin}
        max={effectiveMax}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleValueChange}
        disabled={disabled}
        inputMode={inputMode}
        aria-label={ariaLabel || `Weight input in ${unit}`}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error || showRangeError}
        className={cn(
          // Base styling
          "pr-20", // Make room for unit selector (increased for lbs)
          // Error states
          (error || showRangeError) && [
            "border-destructive",
            "focus-visible:ring-destructive",
            "aria-invalid:border-destructive",
            "aria-invalid:ring-destructive/20"
          ],
          // Mobile optimization
          "touch-manipulation",
          "min-h-[40px]",
          // Ensure proper focus behavior
          "focus-visible:z-10"
        )}
      />

      {/* Unit Selector - Positioned as suffix */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20">
        <WeightUnitSelector
          value={unit}
          onChange={handleUnitChange}
          units={availableUnits}
          compact={true}
          disabled={disabled}
          className={cn(
            // Ensure it fits within the input
            "border-0 bg-transparent shadow-none",
            // Maintain proper sizing
            "h-7 min-w-[45px] max-w-[70px]",
            // Focus styling to work with input
            "focus-visible:ring-1 focus-visible:ring-ring",
            // Ensure proper layering
            "relative z-10"
          )}
          aria-label={`Select weight unit, currently ${unit}`}
        />
      </div>
    </div>
  );
}

// Helper function to get appropriate step value for a unit
export function getStepForUnit(unit: WeightUnit): string {
  switch (unit) {
    case 'g':
      return "0.1";
    case 'oz':
      return "0.01";
    case 'lb':
    case 'lbs':
      return "0.1";
    case 'kg':
      return "0.01";
    default:
      return "0.1";
  }
}

// Helper function to get appropriate placeholder for a unit
export function getPlaceholderForUnit(unit: WeightUnit): string {
  switch (unit) {
    case 'g':
      return "0.0g";
    case 'oz':
      return "0.00oz";
    case 'lb':
      return "0.0lb";
    case 'lbs':
      return "0.0lbs";
    case 'kg':
      return "0.00kg";
    default:
      return "0.0";
  }
}