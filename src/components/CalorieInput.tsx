import { UnitInput } from "@/components/UnitInput";
import { type CalorieUnit } from "@/schema";
import { CalorieUnitConverter } from "@/utils/CalorieUnitConverter";

// Unit display configuration for calorie units
const CALORIE_UNIT_CONFIGS = [
  { value: 'g' as const, label: 'cal/g', fullName: 'calories per gram' },
  { value: 'oz' as const, label: 'cal/oz', fullName: 'calories per ounce' },
  { value: 'lb' as const, label: 'cal/lb', fullName: 'calories per pound' },
  { value: 'kg' as const, label: 'cal/kg', fullName: 'calories per kilogram' },
];

interface CalorieInputProps {
  value: number;
  unit: CalorieUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: CalorieUnit) => void;
  availableUnits?: CalorieUnit[];
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

export function CalorieInput({
  value,
  unit,
  onValueChange,
  onUnitChange,
  availableUnits = CalorieUnitConverter.getSupportedUnits(),
  placeholder = "0.00",
  className,
  disabled = false,
  error = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  inputMode = "decimal",
  step = "0.01",
  min,
  max,
}: CalorieInputProps) {
  // Filter unit configs to only include available units
  const filteredUnits = CALORIE_UNIT_CONFIGS.filter(config => 
    availableUnits.includes(config.value)
  );

  // Calorie conversion function
  const convertCalories = (value: number, fromUnit: CalorieUnit, toUnit: CalorieUnit): number => {
    // Convert current value from current unit to calories per gram, then to new unit
    const caloriesPerGram = CalorieUnitConverter.toCaloriesPerGram(value, fromUnit);
    return CalorieUnitConverter.fromCaloriesPerGram(caloriesPerGram, toUnit);
  };

  return (
    <UnitInput
      value={value}
      unit={unit}
      onValueChange={onValueChange}
      onUnitChange={onUnitChange}
      units={filteredUnits}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      error={error}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      inputMode={inputMode}
      step={step}
      min={min}
      max={max}
      labelSuffix="calorie unit"
      convertValue={convertCalories}
    />
  );
}

// Helper function to get appropriate step value for a unit
export function getStepForCalorieUnit(unit: CalorieUnit): string {
  switch (unit) {
    case 'g':
      return "0.01";
    case 'oz':
      return "0.1";
    case 'lb':
      return "1";
    case 'kg':
      return "10";
    default:
      return "0.01";
  }
}

// Helper function to get appropriate placeholder for a unit
export function getPlaceholderForCalorieUnit(unit: CalorieUnit): string {
  switch (unit) {
    case 'g':
      return "0.00";
    case 'oz':
      return "0.0";
    case 'lb':
      return "0";
    case 'kg':
      return "0";
    default:
      return "0.00";
  }
}