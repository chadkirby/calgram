import * as React from "react"
import { ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  error?: boolean
}

export function TimePicker({
  value = "",
  onChange,
  placeholder = "Select time",
  className,
  disabled = false,
  error = false,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [hours, setHours] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [period, setPeriod] = React.useState("AM")

  // Parse initial value
  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":")
      const hour = parseInt(h || "0")
      const minute = m || "00"

      // Convert from 24-hour to 12-hour format
      if (hour === 0) {
        setHours("12")
        setPeriod("AM")
      } else if (hour <= 11) {
        setHours(hour.toString())
        setPeriod("AM")
      } else if (hour === 12) {
        setHours("12")
        setPeriod("PM")
      } else {
        setHours((hour - 12).toString())
        setPeriod("PM")
      }
      setMinutes(minute)
    } else {
      setHours("")
      setMinutes("")
      setPeriod("AM")
    }
  }, [value])

  // Update parent when hours, minutes, or period change
  const updateTime = React.useCallback((newHours: string, newMinutes: string, newPeriod: string) => {
    if (newHours && newMinutes && onChange) {
      let hour24 = parseInt(newHours)

      // Convert 12-hour to 24-hour format
      if (newPeriod === "AM") {
        if (hour24 === 12) hour24 = 0
      } else {
        if (hour24 !== 12) hour24 += 12
      }

      const formattedTime = `${hour24.toString().padStart(2, '0')}:${newMinutes.padStart(2, '0')}`
      onChange(formattedTime)
    }
  }, [onChange])

  const handleHoursChange = (newHours: string) => {
    // Validate hours (1-12) and ensure it's a valid number
    if (newHours === "") {
      setHours("")
      return
    }

    const numHours = Number(newHours)
    if (!isNaN(numHours) && numHours >= 1 && numHours <= 12 && newHours.length <= 2) {
      setHours(newHours)
      if (newHours && minutes) {
        updateTime(newHours, minutes, period)
      }
    }
  }

  const handleMinutesChange = (newMinutes: string) => {
    // Validate minutes (0-59) and ensure it's a valid number
    if (newMinutes === "") {
      setMinutes("")
      return
    }

    const numMinutes = Number(newMinutes)
    if (!isNaN(numMinutes) && numMinutes >= 0 && numMinutes <= 59 && newMinutes.length <= 2) {
      setMinutes(newMinutes)
      if (hours && newMinutes) {
        updateTime(hours, newMinutes, period)
      }
    }
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    if (hours && minutes) {
      updateTime(hours, minutes, newPeriod)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hours && minutes) {
      setOpen(false)
    }
  }

  const formatTimeForDisplay = (timeValue: string) => {
    if (!timeValue) return placeholder

    const [hours, minutes] = timeValue.split(':')
    const hour = parseInt(hours)
    const min = minutes || '00'

    // Convert to 12-hour format for display
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

    return `${displayHour}:${min} ${period}`
  }

  const displayTime = formatTimeForDisplay(value)
  const isTimeSelected = Boolean(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal min-h-[40px] text-base sm:text-sm touch-manipulation",
            !isTimeSelected && "text-muted-foreground",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          disabled={disabled}
        >
          <ClockIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{displayTime}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Manual time input */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Enter Time</div>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                placeholder="HH"
                value={hours}
                onChange={(e) => handleHoursChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-16 text-center"
                min="1"
                max="12"
              />
              <span className="text-sm font-medium">:</span>
              <Input
                type="number"
                placeholder="MM"
                value={minutes}
                onChange={(e) => handleMinutesChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-16 text-center"
                min="0"
                max="59"
              />
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="px-2 py-1 border border-input bg-background rounded-md text-sm"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
              {hours && minutes && (
                <Button
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-xs"
                >
                  Done
                </Button>
              )}
            </div>
          </div>

          {/* Current time button */}
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              const now = new Date()
              const currentHour24 = now.getHours()
              const currentMinute = now.getMinutes()

              // Convert to 12-hour format
              let currentHour12: number
              let currentPeriod: string

              if (currentHour24 === 0) {
                currentHour12 = 12
                currentPeriod = "AM"
              } else if (currentHour24 <= 11) {
                currentHour12 = currentHour24
                currentPeriod = "AM"
              } else if (currentHour24 === 12) {
                currentHour12 = 12
                currentPeriod = "PM"
              } else {
                currentHour12 = currentHour24 - 12
                currentPeriod = "PM"
              }

              const hourStr = currentHour12.toString()
              const minuteStr = currentMinute.toString()

              setHours(hourStr)
              setMinutes(minuteStr)
              setPeriod(currentPeriod)
              updateTime(hourStr, minuteStr, currentPeriod)
            }}
          >
            Use Current Time
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
