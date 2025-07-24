import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  value = "",
  onValueChange,
  options,
  placeholder = "Select option...",
  emptyText = "No option found.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onValueChange?.(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onValueChange?.(newValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      // Allow Tab to close the dropdown and move focus naturally
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    // If user starts typing while the trigger has focus, open the dropdown
    if (!open && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setOpen(true);
    }
  };

  const handleTriggerPaste = () => {
    // If user pastes while the trigger has focus, open the dropdown
    if (!open) {
      setOpen(true);
    }
  };

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between touch-manipulation min-h-[44px] sm:min-h-[40px]", className)}
          disabled={disabled}
          onKeyDown={handleTriggerKeyDown}
          onPaste={handleTriggerPaste}
        >
          <span className="truncate text-left text-sm sm:text-base">
            {inputValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full p-0 max-w-[90vw] sm:max-w-none" 
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={inputValue}
            onValueChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="text-sm sm:text-base"
          />
          <CommandList className="max-h-[40vh] sm:max-h-[300px]">
            <CommandEmpty className="text-sm sm:text-base py-6">{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                  className="text-sm sm:text-base py-3 sm:py-2 touch-manipulation"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
