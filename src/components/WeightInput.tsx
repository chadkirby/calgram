import { UnitInput } from "@/components/UnitInput";
import { type WeightUnit } from "@/components/WeightUnitSelector";
import { WeightConverter } from "@/utils/WeightConverter";

// Unit display configuration for weight units
const WEIGHT_UNIT_CONFIGS = [
  { value: 'g' as const, label: 'g', fullName: 'grams' },
  { value: 'oz' as const, label: 'oz', fullName: 'ounces' },
  { value: 'lb' as const, label: 'lb', fullName: 'pounds' },
  { value: 'lbs' as const, label: 'lbs', fullName: 'pounds' },
  { value: 'kg' as const, label: 'kg', fullName: 'kilograms' },
];

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
  // Filter unit configs to only include available units
  const filteredUnits = WEIGHT_UNIT_CONFIGS.filter(config => 
    availableUnits.includes(config.value)
  );

  // Weight conversion function
  const convertWeight = (value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number => {
    return WeightConverter.convert(value, fromUnit, toUnit);
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
      labelSuffix="weight unit"
      convertValue={convertWeight}
    />
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