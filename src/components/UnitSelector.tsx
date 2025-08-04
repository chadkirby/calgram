import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface UnitConfig<T extends string> {
    value: T;
    label: string;
    fullName: string;
}

interface UnitSelectorProps<T extends string> {
    value: T;
    onChange: (unit: T) => void;
    units: UnitConfig<T>[];
    compact?: boolean;
    className?: string;
    disabled?: boolean;
    'aria-label'?: string;
    labelSuffix?: string; // e.g., "weight unit" or "calorie unit"
}

export function UnitSelector<T extends string>({
    value,
    onChange,
    units,
    compact = true,
    className,
    disabled = false,
    'aria-label': ariaLabel,
    labelSuffix = "unit",
}: UnitSelectorProps<T>) {
    // Find the current unit config
    const currentUnit = units.find(unit => unit.value === value);

    // Generate accessible label
    const accessibleLabel = ariaLabel || `Select ${labelSuffix}, currently ${currentUnit?.fullName || value}`;

    return (
        <Select
            value={value}
            onValueChange={(newValue) => onChange(newValue as T)}
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
                        {currentUnit?.label || value}
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
                        key={unit.value}
                        value={unit.value}
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
                            <span className="font-medium">{unit.label}</span>
                        ) : (
                            // Non-compact mode: show both abbreviation and full name
                            <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{unit.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                    {unit.fullName}
                                </span>
                            </div>
                        )}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
