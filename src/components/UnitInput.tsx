/**
 * UnitInput
 *
 * Layout overview:
 * - This component renders a "composite input": a single bordered wrapper that visually
 *   looks like one input, but internally it contains two children in a grid:
 *     1) The numeric Input (left column, flexing to fill available space)
 *     2) The UnitSelector (right column, intrinsic width)
 *
 * Why grid:
 * - We use CSS Grid with columns [1fr auto] so the Input consumes the remaining width
 *   while the UnitSelector only takes the space it needs. This eliminates the need for
 *   absolute positioning and hardcoded right padding (e.g., pr-20).
 *
 * Focus and states:
 * - The outer wrapper owns border, background, rounding, and the unified focus ring via
 *   Tailwind `focus-within:*` utilities. When either the Input or UnitSelector is focused,
 *   the wrapper shows the ring, making the control feel cohesive.
 * - Error and disabled visuals are applied on the wrapper for consistency. We still forward
 *   aria-invalid to the Input for accessibility tooling.
 *
 * Spacing (important for compactness):
 * - The Input intentionally has asymmetric horizontal padding:
 *     - Left: pl-2 (8px) — small but readable left breathing room
 *     - Right: pr-0 — maximize visible digits; the UnitSelector cell provides its own
 *       small left padding so the number doesn’t collide with the dropdown.
 * - The UnitSelector’s container uses `pl-1 pr-1` to create a subtle gap between the
 *   number and the dropdown trigger without wasting horizontal space.
 *
 * Mobile, side-by-side layouts:
 * - The combination of grid and `min-w-0` on the Input allows the text field to shrink
 *   properly without overflow. This preserves compact side-by-side rows on small screens
 *   while avoiding unusable gaps.
 */
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
    // When entering edit mode, show the un-rounded full value
    if (value > 0) {
      setDisplayValue(value.toString());
    }
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

  // Layout notes:
  // - Composite input wrapper renders a single control visually, containing:
  //   left: number Input (flexible) and right: UnitSelector (intrinsic width).
  // - Grid columns [1fr auto] allocate remaining space to the Input and minimal space to the selector.
  // - Wrapper owns the chrome (border/bg/radius) and the unified focus ring (focus-within:*).
  // - Error/disabled states are applied to the wrapper; aria-invalid is also passed to the Input.
  // - Spacing: Input uses pl-2 (left padding) and pr-0; selector container adds pl-1 to prevent collision.
  return (
    <div
      className={cn(
        // Composite input wrapper (visual single input)
        "grid grid-cols-[1fr_auto] items-center rounded-md border bg-background",
        // Unify focus for both child elements
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        // Error/disabled styling applied here for consistency
        error && [
          "border-destructive",
          "focus-within:ring-destructive/40",
        ],
        disabled && "opacity-60 pointer-events-none",
        className
      )}
      aria-invalid={error || undefined}
    >
      {/* Left cell: numeric input (borderless; wrapper provides chrome) */}
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
          // Wrapper owns border/shadow/focus
          "border-0 bg-transparent shadow-none",
          "focus-visible:outline-none focus-visible:ring-0",
          // Spacing: pl-2 (8px) per visual preference, pr-0 to maximize digits
          "pl-2 pr-0 py-2",
          // Sizing and shrink behavior
          "min-h-[40px] w-full min-w-0",
          // Touch ergonomics
          "touch-manipulation"
        )}
      />

      {/* Right cell: Unit selector in flow; shrink-wrap width */}
      <div
        // Left padding keeps a small gap between number text and dropdown trigger
        className="pl-1 pr-1"
      >
        <UnitSelector
          value={unit}
          onChange={handleUnitChange}
          units={units}
          compact={true}
          disabled={disabled}
          labelSuffix={labelSuffix}
          className={cn(
            // Integrate with wrapper; no extra chrome here
            "border-0 bg-transparent shadow-none",
            // Compact sizing to minimize horizontal footprint
            "h-7 min-w-[45px] max-w-[70px]",
            // The wrapper shows the ring; suppress local ring to avoid double visuals
            "focus-visible:ring-0"
          )}
        />
      </div>
    </div>
  );
}
