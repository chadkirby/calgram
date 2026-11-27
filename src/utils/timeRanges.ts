/** Date-range choices for the trend and weight charts. `value` is the number of days. */
export const TIME_RANGE_OPTIONS = [
  { value: "7", label: "Last week" },
  { value: "30", label: "Last month" },
  { value: "90", label: "Last 3 months" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last year" },
] as const;

export const DEFAULT_TIME_RANGE = "30";
