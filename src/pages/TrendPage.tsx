import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "jazz-tools/react";
import type { MealEntry, JazzAccount, WeightEntry } from "../schema";
import { TrendAnalyzer } from "../utils/TrendAnalyzer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TrendPageErrorFallback } from "@/components/PageErrorFallback";
import { NetworkErrorHandler, ConnectionStatus } from "@/components/NetworkErrorHandler";
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
import type { Loaded } from "jazz-tools";

function TrendPageContent() {
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
      me.root.mealEntries.filter((meal): meal is Loaded<typeof MealEntry> => meal != null),
      me.root.weightEntries.filter((weight): weight is Loaded<typeof WeightEntry> => weight != null),
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
      const isMobile = window.innerWidth < 640;

      return (
        <div className={`bg-white p-2 sm:p-4 border border-gray-300 rounded-lg shadow-lg ${
          isMobile ? 'max-w-[280px] text-xs' : 'max-w-xs text-sm'
        }`}>
          <p className={`font-semibold text-gray-900 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {fullDate ? fullDate.toLocaleDateString('en-US', {
              weekday: isMobile ? 'short' : 'long',
              year: isMobile ? '2-digit' : 'numeric',
              month: isMobile ? 'short' : 'long',
              day: 'numeric'
            }) : label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              if (entry.dataKey === 'calories' && entry.value > 0) {
                return (
                  <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
                    📊 {isMobile ? 'Cal:' : 'Daily Calories:'} <span className="font-medium">{entry.value} cal</span>
                  </p>
                );
              } else if (entry.dataKey === 'weight' && entry.value) {
                return (
                  <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
                    ⚖️ Weight: <span className="font-medium">{entry.value} lbs</span>
                  </p>
                );
              } else if (entry.dataKey === 'caloriesTrend' && entry.value) {
                return (
                  <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
                    📈 {isMobile ? 'Trend:' : 'Calorie Trend:'} <span className="font-medium">{Math.round(entry.value)} cal</span>
                  </p>
                );
              } else if (entry.dataKey === 'weightTrend' && entry.value) {
                return (
                  <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
                    📉 {isMobile ? 'W.Trend:' : 'Weight Trend:'} <span className="font-medium">{entry.value.toFixed(1)} lbs</span>
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
    <div className="space-y-4 sm:space-y-6">
      <ConnectionStatus />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Calorie Trend</CardTitle>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label htmlFor="time-range" className="text-sm font-medium">
                Time Range:
              </label>
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="w-full sm:w-48">
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
                <Badge variant="secondary" className="text-xs">
                  Avg: {summaryStats.avgCalories} cal/day
                </Badge>
                {summaryStats.avgWeight && (
                  <Badge variant="secondary" className="text-xs">
                    Avg Weight: {summaryStats.avgWeight} lbs
                  </Badge>
                )}
                {summaryStats.weightChange && (
                  <Badge variant={summaryStats.weightChange > 0 ? "destructive" : "default"} className="text-xs">
                    {summaryStats.weightChange > 0 ? '+' : ''}{summaryStats.weightChange} lbs
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div className="h-72 sm:h-96 lg:h-[500px] w-full min-h-[18rem] sm:min-h-[24rem] lg:min-h-[31rem]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-gray-600 text-sm sm:text-base">Loading trend data...</span>
              </div>
            ) : hasData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: window.innerWidth >= 1024 ? 40 : window.innerWidth >= 640 ? 30 : 15,
                    bottom: window.innerWidth >= 640 ? 20 : 50,
                    left: window.innerWidth >= 1024 ? 40 : window.innerWidth >= 640 ? 20 : 15,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: window.innerWidth >= 1024 ? 12 : window.innerWidth >= 640 ? 11 : 9 }}
                    interval={window.innerWidth >= 1024 ? "preserveStartEnd" : window.innerWidth >= 640 ? "preserveStartEnd" : Math.ceil(chartData.length / 4)}
                    angle={window.innerWidth >= 640 ? -45 : -90}
                    textAnchor="end"
                    height={window.innerWidth >= 640 ? 60 : 90}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    yAxisId="calories"
                    orientation="left"
                    tick={{ fontSize: window.innerWidth >= 1024 ? 12 : window.innerWidth >= 640 ? 11 : 9 }}
                    label={window.innerWidth >= 640 ? { value: 'Calories', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } } : undefined}
                    domain={['dataMin - 100', 'dataMax + 100']}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    width={window.innerWidth >= 640 ? 60 : 45}
                  />
                  <YAxis
                    yAxisId="weight"
                    orientation="right"
                    tick={{ fontSize: window.innerWidth >= 1024 ? 12 : window.innerWidth >= 640 ? 11 : 9 }}
                    label={window.innerWidth >= 640 ? { value: 'Weight (lbs)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } } : undefined}
                    domain={['dataMin - 5', 'dataMax + 5']}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    width={window.innerWidth >= 640 ? 60 : 45}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ strokeDasharray: '3 3' }}
                    animationDuration={150}
                  />
                  <Legend
                    wrapperStyle={{ 
                      paddingTop: '20px',
                      fontSize: window.innerWidth >= 1024 ? '14px' : window.innerWidth >= 640 ? '13px' : '11px'
                    }}
                    iconType="line"
                    layout={window.innerWidth >= 640 ? 'horizontal' : 'vertical'}
                    align={window.innerWidth >= 640 ? 'center' : 'left'}
                    verticalAlign={window.innerWidth >= 640 ? 'bottom' : 'middle'}
                  />
                  <Bar
                    yAxisId="calories"
                    dataKey="calories"
                    fill="#22c55e"
                    name={window.innerWidth >= 640 ? "Daily Calories" : "Calories"}
                    opacity={0.7}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={window.innerWidth >= 640 ? 40 : 20}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    stroke="#3b82f6"
                    strokeWidth={window.innerWidth >= 1024 ? 2.5 : window.innerWidth >= 640 ? 2 : 1.5}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: window.innerWidth >= 1024 ? 5 : window.innerWidth >= 640 ? 4 : 3 }}
                    activeDot={{ r: window.innerWidth >= 1024 ? 7 : window.innerWidth >= 640 ? 6 : 5, stroke: '#3b82f6', strokeWidth: 2 }}
                    name="Weight"
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="calories"
                    type="monotone"
                    dataKey="caloriesTrend"
                    stroke="#16a34a"
                    strokeWidth={window.innerWidth >= 1024 ? 3.5 : window.innerWidth >= 640 ? 3 : 2}
                    dot={false}
                    name={window.innerWidth >= 640 ? "Calorie Trend" : "Cal Trend"}
                    strokeDasharray="5 5"
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightTrend"
                    stroke="#1d4ed8"
                    strokeWidth={window.innerWidth >= 1024 ? 3.5 : window.innerWidth >= 640 ? 3 : 2}
                    dot={false}
                    name={window.innerWidth >= 640 ? "Weight Trend" : "W Trend"}
                    strokeDasharray="5 5"
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center space-y-2 p-4">
                  <p className="text-gray-500 text-base sm:text-lg">No data available</p>
                  <p className="text-gray-400 text-xs sm:text-sm">
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

export function TrendPage() {
  return (
    <ErrorBoundary fallback={TrendPageErrorFallback}>
      <NetworkErrorHandler>
        <TrendPageContent />
      </NetworkErrorHandler>
    </ErrorBoundary>
  );
}
