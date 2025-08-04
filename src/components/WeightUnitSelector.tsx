import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    type MealWeightUnit,
    type BodyWeightUnit,
    mealWeightUnits,
    bodyWeightUnits
} from "@/schema";

// Combined weight unit type
export type WeightUnit = MealWeightUnit | BodyWeightUnit;

// Unit display labels
const UNIT_LABELS: Record<WeightUnit, string> = {
    g: 'g',
    oz: 'oz',
    lb: 'lb',
    kg: 'kg',
    lbs: 'lbs',
};

// Unit full names for accessibility
const UNIT_FULL_NAMES: Record<WeightUnit, string> = {
    g: 'grams',
    oz: 'ounces',
    lb: 'pounds',
    kg: 'kilograms',
    lbs: 'pounds',
};

interface WeightUnitSelectorProps {
    value: WeightUnit;
    onChange: (unit: WeightUnit) => void;
    units: WeightUnit[];
    compact?: boolean;
    className?: string;
    disabled?: boolean;
    'aria-label'?: string;
}

export function WeightUnitSelector({
    value,
    onChange,
    units,
    compact = true,
    className,
    disabled = false,
    'aria-label': ariaLabel,
}: WeightUnitSelectorProps) {
    // Generate accessible label
    const accessibleLabel = ariaLabel || `Select weight unit, currently ${UNIT_FULL_NAMES[value]}`;

    return (
        <Select
            value={value}
            onValueChange={(newValue) => onChange(newValue as WeightUnit)}
            disabled={disabled}
        >
            <SelectTrigger
                className={cn(
                    // Base styling to match existing form elements
                    "border-input bg-transparent text-sm",
                    // Compact mode styling - minimal width and padding
                    compact && [
                        "w-fit min-w-[50px] max-w-[75px]",
                        "px-1.5 py-1.5",
                        "h-8 sm:h-9", // Slightly smaller on mobile
                        "text-xs sm:text-sm",
                    ],
                    // Non-compact mode styling
                    !compact && [
                        "w-full min-w-[80px]",
                        "px-3 py-2",
                        "h-9",
                    ],
                    // Focus and interaction states
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "hover:bg-accent/50",
                    "transition-colors",
                    // Touch-friendly sizing on mobile
                    "touch-manipulation",
                    className
                )}
                size={compact ? "sm" : "default"}
                aria-label={accessibleLabel}
            >
                <SelectValue>
                    <span className="font-medium">
                        {UNIT_LABELS[value]}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent
                className={cn(
                    // Ensure dropdown is properly sized
                    "min-w-[80px]",
                    // Position close to trigger for compact mode
                    compact && "w-[var(--radix-select-trigger-width)]"
                )}
                align="center"
                side="bottom"
                sideOffset={4}
            >
                {units.map((unit) => (
                    <SelectItem
                        key={unit}
                        value={unit}
                        className={cn(
                            "cursor-pointer",
                            "focus:bg-accent focus:text-accent-foreground",
                            "text-sm",
                            // Touch-friendly padding on mobile
                            "py-2 px-3",
                        )}
                    >
                        {compact ? (
                            // Compact mode: show only abbreviation
                            <span className="font-medium">{UNIT_LABELS[unit]}</span>
                        ) : (
                            // Non-compact mode: show both abbreviation and full name
                            <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{UNIT_LABELS[unit]}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                    {UNIT_FULL_NAMES[unit]}
                                </span>
                            </div>
                        )}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

// Helper function to check if a unit is valid for meal weights
export function isMealWeightUnit(unit: WeightUnit): unit is MealWeightUnit {
    return mealWeightUnits.includes(unit as MealWeightUnit);
}

// Helper function to check if a unit is valid for body weights
export function isBodyWeightUnit(unit: WeightUnit): unit is BodyWeightUnit {
    return bodyWeightUnits.includes(unit as BodyWeightUnit);
}