import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { DateTime } from "luxon"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  error?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  error = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert string date to Date object for the calendar
  const selectedDate = value ? DateTime.fromISO(value).toJSDate() : undefined

  // Handle date selection from calendar
  const handleSelect = (date: Date | undefined) => {
    if (date && onChange) {
      const isoDate = DateTime.fromJSDate(date).toISODate()
      if (isoDate) {
        onChange(isoDate)
      }
    }
    setOpen(false)
  }

  // Format display date
  const displayDate = selectedDate
    ? DateTime.fromJSDate(selectedDate).toLocaleString(DateTime.DATE_MED)
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal min-h-[40px] text-base sm:text-sm",
            !selectedDate && "text-muted-foreground",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{displayDate}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
