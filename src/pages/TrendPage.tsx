import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "jazz-tools/react";
import type { MealEntry, JazzAccount, WeightEntry } from "../schema";
import { TrendAnalyzer } from "../utils/TrendAnalyzer";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { co } from "jazz-tools";

export function TrendPage() {
  const { me } = useAccount<typeof JazzAccount>();
  const [timeRange, setTimeRange] = useState("30");
  const [isLoading, setIsLoading] = useState(false);

  const timeRangeOptions = [
    { value: "7", label: "Last 7 days" },
    { value: "14", label: "Last 14 days" },
    { value: "30", label: "Last 30 days" },
    { value: "60", label: "Last 60 days" },
    { value: "90", label: "Last 90 days" },
  ];

  // Prepare chart data using TrendAnalyzer
  const { chartData, summaryStats, hasData } = useMemo(() => {
    if (!me?.root?.mealEntries || !me?.root?.weightEntries) {
      return { chartData: [], summaryStats: null, hasData: false };
    }

    const days = parseInt(timeRange);
    const combinedData = TrendAnalyzer.prepareCombinedData(
      me.root.mealEntries.filter((meal): meal is co.loaded<typeof MealEntry> => meal != null),
      me.root.weightEntries.filter((weight): weight is co.loaded<typeof WeightEntry> => weight != null),
      days
    );

    if (combinedData.length === 0) {
      return { chartData: [], summaryStats: null, hasData: false };
    }

    // Calculate trend lines using LOWESS
    const trendLines = TrendAnalyzer.calculateTrendLines(combinedData);
    const stats = TrendAnalyzer.getSummaryStats(combinedData);

    // Format data for Recharts
    const formattedData = combinedData.map((point, index) => ({
      date: point.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      fullDate: point.date,
      calories: point.calories || 0,
      weight: point.weight,
      caloriesTrend: trendLines.caloriesTrend[index],
      weightTrend: trendLines.weightTrend[index],
    }));

    return {
      chartData: formattedData,
      summaryStats: stats,
      hasData: true
    };
  }, [me?.root?.mealEntries, me?.root?.weightEntries, timeRange]);

  // Handle time range change with loading state
  const handleTimeRangeChange = (value: string) => {
    setIsLoading(true);
    setTimeRange(value);
    // Simulate brief loading for better UX
    setTimeout(() => setIsLoading(false), 200);
  };

  // Custom tooltip component with enhanced information
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      const fullDate = dataPoint?.fullDate;

      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg max-w-xs">
          <p className="font-semibold text-gray-900 mb-2">
            {fullDate ? fullDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              if (entry.dataKey === 'calories' && entry.value > 0) {
                return (
                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                    📊 Daily Calories: <span className="font-medium">{entry.value} cal</span>
                  </p>
                );
              } else if (entry.dataKey === 'weight' && entry.value) {
                return (
                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                    ⚖️ Weight: <span className="font-medium">{entry.value} lbs</span>
                  </p>
                );
              } else if (entry.dataKey === 'caloriesTrend' && entry.value) {
                return (
                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                    📈 Calorie Trend: <span className="font-medium">{Math.round(entry.value)} cal</span>
                  </p>
                );
              } else if (entry.dataKey === 'weightTrend' && entry.value) {
                return (
                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                    📉 Weight Trend: <span className="font-medium">{entry.value.toFixed(1)} lbs</span>
                  </p>
                );
              }
              return null;
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calorie Trend</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="time-range" className="text-sm font-medium">
                Time Range:
              </label>
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary statistics */}
            {summaryStats && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Avg: {summaryStats.avgCalories} cal/day
                </Badge>
                {summaryStats.avgWeight && (
                  <Badge variant="secondary">
                    Avg Weight: {summaryStats.avgWeight} lbs
                  </Badge>
                )}
                {summaryStats.weightChange && (
                  <Badge variant={summaryStats.weightChange > 0 ? "destructive" : "default"}>
                    {summaryStats.weightChange > 0 ? '+' : ''}{summaryStats.weightChange} lbs
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full min-h-[24rem]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-gray-600">Loading trend data...</span>
              </div>
            ) : hasData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: 30,
                    bottom: 20,
                    left: 20,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    yAxisId="calories"
                    orientation="left"
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Calories', angle: -90, position: 'insideLeft' }}
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  <YAxis
                    yAxisId="weight"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Weight (lbs)', angle: 90, position: 'insideRight' }}
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ strokeDasharray: '3 3' }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Bar
                    yAxisId="calories"
                    dataKey="calories"
                    fill="#22c55e"
                    name="Daily Calories"
                    opacity={0.7}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                    name="Weight"
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="calories"
                    type="monotone"
                    dataKey="caloriesTrend"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={false}
                    name="Calorie Trend"
                    strokeDasharray="5 5"
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightTrend"
                    stroke="#1d4ed8"
                    strokeWidth={3}
                    dot={false}
                    name="Weight Trend"
                    strokeDasharray="5 5"
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center space-y-2">
                  <p className="text-gray-500 text-lg">No data available</p>
                  <p className="text-gray-400 text-sm">
                    Start logging meals and weight entries to see your trends
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
