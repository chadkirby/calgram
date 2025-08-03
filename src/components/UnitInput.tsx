import * as React from "react";
import { Input } from "@/components/ui/input";
import { UnitSelector } from "@/components/UnitSelector";
import { cn } from "@/lib/utils";

interface UnitConfig<T extends string> {
    value: T;
    label: string;
    fullName: string;
}

interface UnitInputProps<T extends string> {
  value: number;
  unit: T;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: T) => void;
  units: UnitConfig<T>[];
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
  labelSuffix?: string; // e.g., "weight unit" or "calorie unit"
  convertValue?: (value: number, fromUnit: T, toUnit: T) => number; // Optional conversion function
}

export function UnitInput<T extends string>({
  value,
  unit,
  onValueChange,
  onUnitChange,
  units,
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
  labelSuffix = "unit",
  convertValue,
}: UnitInputProps<T>) {
  // Track the displayed value separately from the prop value to handle conversion smoothly
  const [displayValue, setDisplayValue] = React.useState<string>("");
  const [isConverting, setIsConverting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  // Update display value when value or unit changes from parent
  React.useEffect(() => {
    // Only update from props when not actively editing and not converting
    if (!isConverting && !isEditing) {
      setDisplayValue(value > 0 ? roundForDisplay(value) : "");
    }
  }, [value, unit, isConverting, isEditing]);

  // Handle input value changes
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // While editing, preserve raw input without rounding so users can type freely
    setDisplayValue(inputValue);

    // Parse and validate the input
    const numericValue = parseFloat(inputValue);
    if (inputValue === "" || inputValue === "0") {
      onValueChange(0);
    } else if (!isNaN(numericValue) && numericValue >= 0) {
      onValueChange(numericValue);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // On blur (at-rest), apply rounding to what is displayed
    const numericValue = parseFloat(displayValue);
    if (displayValue === "" || isNaN(numericValue)) {
      setDisplayValue("");
      return;
    }
    setDisplayValue(numericValue > 0 ? roundForDisplay(numericValue) : "");
  };

  // Handle unit changes with optional automatic value conversion
  const handleUnitChange = (newUnit: T) => {
    if (newUnit === unit || value <= 0 || !convertValue) {
      onUnitChange(newUnit);
      return;
    }

    try {
      setIsConverting(true);

      // Convert the current value to the new unit
      const convertedValue = convertValue(value, unit, newUnit);

      // Update both the unit and the converted value
      onUnitChange(newUnit);
      onValueChange(convertedValue);

      // Update display value to show converted amount, but only rounded once conversion completes
      setDisplayValue(roundForDisplay(convertedValue));

    } catch (error) {
      console.error(`Error converting ${labelSuffix}s:`, error);
      // If conversion fails, just change the unit without converting the value
      onUnitChange(newUnit);
    } finally {
      // Reset converting flag after a brief delay to allow for smooth updates
      setTimeout(() => setIsConverting(false), 100);
    }
  };

  function roundForDisplay(value: number): string {
    if (value < 1) return value.toFixed(3);
    if (value < 10) return value.toFixed(2);
    if (value < 100) return value.toFixed(1);
    return value.toFixed(0);
  }

  // Only use explicit min/max props if provided, no arbitrary range validation
  const effectiveMin = min !== undefined ? min : 0;
  const effectiveMax = max !== undefined ? max : Number.MAX_SAFE_INTEGER;

  // Find current unit config for aria-label
  const currentUnitConfig = units.find(u => u.value === unit);
  const unitLabel = currentUnitConfig?.fullName || unit;

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Input Field */}
      <Input
        type="number"
        step={step}
        min={effectiveMin}
        max={effectiveMax}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleValueChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        inputMode={inputMode}
        aria-label={ariaLabel || `${labelSuffix} input in ${unitLabel}`}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error}
        className={cn(
          // Base styling
          "pr-20", // Make room for unit selector
          // Error states
          error && [
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
        <UnitSelector
          value={unit}
          onChange={handleUnitChange}
          units={units}
          compact={true}
          disabled={disabled}
          labelSuffix={labelSuffix}
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
        />
      </div>
    </div>
  );
}
