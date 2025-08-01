import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, type WeightEntry } from "../schema";
import { TrendAnalyzer } from "../utils/TrendAnalyzer";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import type { Loaded } from "jazz-tools";

// Animation constants
const CHART_ANIMATION_DURATION = 200;
const TOOLTIP_ANIMATION_DURATION = 150;

interface WeightChartProps {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  isLoading?: boolean;
}

export function WeightChart({ timeRange, onTimeRangeChange, isLoading = false }: WeightChartProps) {
  const { me } = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        weightEntries: { $each: true },
      }
    },
  });

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 640);

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const timeRangeOptions = [
    { value: "7", label: "Last 7 days" },
    { value: "14", label: "Last 14 days" },
    { value: "30", label: "Last 30 days" },
    { value: "60", label: "Last 60 days" },
    { value: "90", label: "Last 90 days" },
  ];

  // Prepare chart data using TrendAnalyzer with unit conversion
  const { chartData, summaryStats, weightAxisConfig, hasData, axisLabel } = useMemo(() => {
    if (!me?.root?.weightEntries) {
      return { 
        chartData: [], 
        summaryStats: null, 
        weightAxisConfig: { min: 0, max: 20, tickInterval: 2 }, 
        hasData: false,
        axisLabel: 'Weight (lbs)'
      };
    }

    const days = parseInt(timeRange);
    const weightData = TrendAnalyzer.prepareWeightData(
      me.root.weightEntries.filter((weight): weight is Loaded<typeof WeightEntry> => weight != null),
      me.profile,
      days
    );

    const axisLabel = TrendAnalyzer.getWeightAxisLabel(me.profile);

    if (weightData.length === 0) {
      return { 
        chartData: [], 
        summaryStats: null, 
        weightAxisConfig: { min: 0, max: 20, tickInterval: 2 }, 
        hasData: false,
        axisLabel
      };
    }

    // Calculate trend lines using LOWESS
    const weightValues = weightData.map(point => point.weight || 0);
    const weightTrend = TrendAnalyzer.calculateLOWESSTrend(weightValues, 0.3);

    const stats: {
        totalDays: number;
        avgWeight: number;
        minWeight: number;
        maxWeight: number;
        weightChange?: number;
    } = {
      totalDays: weightData.length,
      avgWeight: Math.round((weightValues.reduce((sum, val) => sum + val, 0) / weightValues.length) * 10) / 10,
      minWeight: Math.min(...weightValues),
      maxWeight: Math.max(...weightValues),
    };

    if (weightValues.length > 1) {
      stats.weightChange = Math.round((weightValues[weightValues.length - 1] - weightValues[0]) * 10) / 10;
    }

    const weightAxisConfig = TrendAnalyzer.calculateWeightAxisConfig(weightData);

    // Format data for Recharts
    const formattedData = weightData.map((point, index) => ({
      date: point.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      fullDate: point.date,
      weight: point.weight,
      weightTrend: weightTrend[index],
    }));

    return {
      chartData: formattedData,
      summaryStats: stats,
      weightAxisConfig,
      hasData: true,
      axisLabel
    };
  }, [me?.root?.weightEntries, me?.profile, timeRange]);

  // Custom tooltip component with enhanced information and unit-aware display
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      const fullDate = dataPoint?.fullDate;
      const isMobile = windowWidth < 640;

      return (
        <div className={`bg-white p-2 sm:p-4 border border-gray-300 rounded-lg shadow-lg ${isMobile ? 'max-w-[280px] text-xs' : 'max-w-xs text-sm'
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
              if (entry.dataKey === 'weight' && entry.value) {
                const formattedWeight = TrendAnalyzer.formatWeightTooltip(entry.value, me?.profile);
                return (
                  <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
                    ⚖️ Weight: <span className="font-medium">{formattedWeight}</span>
                  </p>
                );
              } else if (entry.dataKey === 'weightTrend' && entry.value) {
                const formattedTrend = TrendAnalyzer.formatWeightTooltip(entry.value, me?.profile);
                return (
                  <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
                    📉 {isMobile ? 'Trend:' : 'Weight Trend:'} <span className="font-medium">{formattedTrend}</span>
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
    <Card className="pt-3 sm:pt-6 pb-0">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
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

          {/* Summary statistics with unit-aware display */}
          {summaryStats && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                Avg: {TrendAnalyzer.formatWeightTooltip(summaryStats.avgWeight, me?.profile)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Min: {TrendAnalyzer.formatWeightTooltip(summaryStats.minWeight, me?.profile)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Max: {TrendAnalyzer.formatWeightTooltip(summaryStats.maxWeight, me?.profile)}
              </Badge>
              {summaryStats.weightChange && (
                <Badge variant={summaryStats.weightChange > 0 ? "destructive" : "default"} className="text-xs">
                  Δ: {summaryStats.weightChange > 0 ? '+' : ''}{TrendAnalyzer.formatWeightTooltip(Math.abs(summaryStats.weightChange), me?.profile)}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2 sm:pt-6 pb-0">
        <div className="h-56 sm:h-96 lg:h-[500px] w-full min-h-[14rem] sm:min-h-[24rem] lg:min-h-[31rem]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2 text-gray-600 text-sm sm:text-base">Loading weight data...</span>
            </div>
          ) : hasData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{
                  top: 10,
                  right: windowWidth >= 1024 ? 60 : windowWidth >= 640 ? 50 : 25,
                  bottom: windowWidth >= 640 ? 15 : 5,
                  left: windowWidth >= 1024 ? 30 : windowWidth >= 640 ? 15 : 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: windowWidth >= 1024 ? 12 : windowWidth >= 640 ? 11 : 8 }}
                  interval={windowWidth >= 1024 ? "preserveStartEnd" : windowWidth >= 640 ? "preserveStartEnd" : windowWidth >= 300 ? Math.ceil(chartData.length / 12) : Math.ceil(chartData.length / 4)}
                  angle={windowWidth >= 640 ? -45 : -45}
                  textAnchor="end"
                  height={windowWidth >= 640 ? 45 : 35}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: windowWidth >= 1024 ? 12 : windowWidth >= 640 ? 11 : 8 }}
                  label={windowWidth >= 640 ? { value: axisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } } : undefined}
                  domain={[weightAxisConfig?.min || 0, weightAxisConfig?.max || 20]}
                  ticks={weightAxisConfig ? Array.from({ length: Math.floor((weightAxisConfig.max - weightAxisConfig.min) / weightAxisConfig.tickInterval) + 1 }, (_, i) => weightAxisConfig.min + i * weightAxisConfig.tickInterval) : undefined}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                  width={windowWidth >= 640 ? 45 : 25}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ strokeDasharray: '3 3' }}
                  animationDuration={TOOLTIP_ANIMATION_DURATION}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: windowWidth >= 1024 ? '14px' : windowWidth >= 640 ? '13px' : '10px'
                  }}
                  iconType="line"
                  layout={windowWidth >= 640 ? 'horizontal' : 'horizontal'}
                  align="center"
                  verticalAlign="bottom"
                  height={windowWidth >= 640 ? 30 : 20}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={windowWidth >= 1024 ? 2.5 : windowWidth >= 640 ? 2 : 1.5}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: windowWidth >= 1024 ? 5 : windowWidth >= 640 ? 4 : 3 }}
                  activeDot={{ r: windowWidth >= 1024 ? 7 : windowWidth >= 640 ? 6 : 5, stroke: '#3b82f6', strokeWidth: 2 }}
                  name="Weight"
                  connectNulls={false}
                  animationDuration={CHART_ANIMATION_DURATION}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="weightTrend"
                  stroke="#1d4ed8"
                  strokeWidth={windowWidth >= 1024 ? 3.5 : windowWidth >= 640 ? 3 : 2}
                  dot={false}
                  name={windowWidth >= 640 ? "Weight Trend" : "W Trend"}
                  strokeDasharray="5 5"
                  connectNulls={true}
                  animationDuration={CHART_ANIMATION_DURATION}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center space-y-2 p-4">
                <p className="text-gray-500 text-base sm:text-lg">No weight data available</p>
                <p className="text-gray-400 text-xs sm:text-sm">
                  Start recording weight entries to see your trends
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
