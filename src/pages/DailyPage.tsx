import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Calendar, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DailyPageErrorFallback } from "@/components/PageErrorFallback";
import { NetworkErrorHandler, ConnectionStatus } from "@/components/NetworkErrorHandler";
import { JazzAccount, type MealEntry } from "../schema";
import { CalorieCalculator } from "../utils/CalorieCalculator";
import { type Loaded } from "jazz-tools";

function DailyPageContent() {
  const { me } = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        mealEntries: { $each: true },
        weightEntries: { $each: true },
      }
    },
  });
  const [selectedDate, setSelectedDate] = useState(CalorieCalculator.getTodayAtMidnight());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filter meal entries by selected date
  const filteredMealEntries = me?.root?.mealEntries?.filter((meal): meal is Loaded<typeof MealEntry> =>
    meal != null && CalorieCalculator.isSameDay(meal.timestamp, selectedDate)
  ) || [];

  // Calculate daily totals for the selected date
  const dailyCalories = me?.root?.mealEntries
    ? CalorieCalculator.calculateDailyTotal(
      me.root.mealEntries.filter((meal): meal is Loaded<typeof MealEntry> => meal != null),
      selectedDate
    )
    : 0;

  // Count meals for the selected date
  const mealCount = filteredMealEntries.length;

  // Date navigation handlers
  const goToPreviousDay = () => {
    setSelectedDate(CalorieCalculator.addDays(selectedDate, -1));
  };

  const goToNextDay = () => {
    setSelectedDate(CalorieCalculator.addDays(selectedDate, 1));
  };

  // Handle direct date selection
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = event.target.value;
    if (dateValue) {
      setSelectedDate(CalorieCalculator.createIsoFromDateInput(dateValue));
      setShowDatePicker(false);
    }
  };

  // Check if selected date is today
  const isToday = CalorieCalculator.isSameDay(selectedDate, CalorieCalculator.getTodayAtMidnight());

  // Calculate category breakdown for pie chart
  const categoryBreakdown = me?.root?.mealEntries
    ? CalorieCalculator.calculateCategoryBreakdown(
      me.root.mealEntries.filter((meal): meal is Loaded<typeof MealEntry> => meal != null),
      selectedDate
    )
    : {};

  // Prepare pie chart data
  const pieChartData = Object.entries(categoryBreakdown).map(([category, calories]) => ({
    name: category,
    value: calories,
    percentage: dailyCalories > 0 ? ((calories / dailyCalories) * 100).toFixed(1) : '0'
  }));

  // Color palette for pie chart
  const COLORS = [
    '#8884d8', // Purple
    '#82ca9d', // Green
    '#ffc658', // Yellow
    '#ff7c7c', // Red
    '#8dd1e1', // Light Blue
    '#d084d0', // Pink
    '#ffb347', // Orange
    '#87ceeb', // Sky Blue
    '#dda0dd', // Plum
    '#98fb98', // Pale Green
  ];

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-2 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value.toFixed(1)} calories ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Handle meal deletion
  const handleDeleteMeal = (mealId: string) => {
    if (!me?.root?.mealEntries) return;

    // Find the index of the meal to delete
    const mealIndex = me.root.mealEntries.findIndex((meal) => meal != null && meal.id === mealId);
    if (mealIndex !== -1) {
      // Remove the meal from the list
      me.root.mealEntries.splice(mealIndex, 1);
    }
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <ConnectionStatus />
      <Card className="gap-0 py-0">
        <CardHeader className="pb-2 sm:pb-4 pt-3 sm:pt-4">
          <CardTitle className="text-base sm:text-lg lg:text-xl">Daily Calorie Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 pb-3 sm:pb-4">
          {/* Compact Date Navigation */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousDay}
              className="p-2 touch-manipulation"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center flex-1 min-w-0">
              <div className="flex items-center justify-center gap-1">
                <h3 className="text-sm sm:text-base font-semibold truncate">
                  {CalorieCalculator.formatDateForDisplay(selectedDate)}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="p-1 touch-manipulation"
                >
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                {isToday && (
                  <Badge variant="secondary" className="text-xs ml-1">Today</Badge>
                )}
              </div>
              {showDatePicker && (
                <div className="mt-2">
                  <Input
                    type="date"
                    value={CalorieCalculator.formatDateForInput(selectedDate)}
                    onChange={handleDateChange}
                    className="w-auto mx-auto touch-manipulation min-h-[44px] sm:min-h-[40px] max-w-[200px]"
                  />
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextDay}
              className="p-2 touch-manipulation"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Category Breakdown Pie Chart with Summary */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="!gap-0">
              <CardHeader className="pb-1 sm:pb-2 text-center">
                <CardTitle className="text-base sm:text-lg mb-3">Calories by Category</CardTitle>
                <div className="flex justify-center gap-6 sm:gap-8">
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-primary">{dailyCalories.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Total Calories</p>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-primary">{mealCount}</div>
                    <p className="text-xs text-muted-foreground">Meals Logged</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex justify-center pt-1 sm:pt-2">
                {pieChartData.length > 0 ? (
                  <div className="h-64 sm:h-80 lg:h-96 w-full max-w-md sm:max-w-lg lg:max-w-xl">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => {
                            const isMobile = window.innerWidth < 640;
                            const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
                            if (isMobile) return `${percentage}%`;
                            if (isTablet) return `${name.length > 8 ? name.substring(0, 8) + '...' : name} (${percentage}%)`;
                            return `${name} (${percentage}%)`;
                          }}
                          outerRadius={window.innerWidth >= 1024 ? 120 : window.innerWidth >= 640 ? 100 : 80}
                          innerRadius={window.innerWidth >= 640 ? 25 : 20}
                          fill="#8884d8"
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={300}
                          fontSize={window.innerWidth >= 640 ? 12 : 10}
                        >
                          {pieChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          wrapperStyle={{
                            fontSize: window.innerWidth >= 1024 ? '14px' : window.innerWidth >= 640 ? '13px' : '11px',
                            paddingTop: '10px'
                          }}
                          layout={window.innerWidth >= 640 ? 'horizontal' : 'vertical'}
                          align="center"
                          verticalAlign="bottom"
                          iconSize={window.innerWidth >= 640 ? 14 : 12}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 sm:h-80 lg:h-96 flex items-center justify-center text-muted-foreground w-full">
                    <div className="text-center p-4">
                      <p className="text-sm sm:text-base">No meals logged for this date</p>
                      <p className="text-xs sm:text-sm mt-1">Add some meals to see the category breakdown</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meal Entry List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Meal Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredMealEntries.length > 0 ? (
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="min-w-full inline-block align-middle">
                      <Table className="min-w-[600px] sm:min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm">Time</TableHead>
                            <TableHead className="min-w-[180px] sm:min-w-[200px] text-xs sm:text-sm">Food Details</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Category</TableHead>
                            <TableHead className="text-right min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm">Calories</TableHead>
                            <TableHead className="w-[40px] sm:w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMealEntries.map((meal) => (
                            <TableRow key={meal.id} className="touch-manipulation">
                              <TableCell className="font-medium text-xs sm:text-sm py-3 sm:py-4">
                                {CalorieCalculator.formatTimeForDisplay(meal.timestamp)}
                              </TableCell>
                              <TableCell className="py-3 sm:py-4">
                                <div>
                                  <div className="font-medium text-xs sm:text-sm leading-tight">{meal.foodName}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {meal.weightInGrams}g × {meal.caloriesPerGram} cal/g
                                  </div>
                                  <div className="sm:hidden mt-2">
                                    <Badge variant="secondary" className="text-xs px-2 py-1">{meal.foodCategory}</Badge>
                                  </div>
                                  {meal.notes && (
                                    <div className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
                                      {meal.notes}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell py-3 sm:py-4">
                                <Badge variant="secondary" className="text-xs sm:text-sm">{meal.foodCategory}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-xs sm:text-sm py-3 sm:py-4">
                                <div className="whitespace-nowrap">
                                  {meal.totalCalories.toFixed(1)} cal
                                </div>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-destructive hover:text-destructive touch-manipulation"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-[90vw] sm:max-w-lg mx-4">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-base sm:text-lg">Delete Meal Entry</AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm sm:text-base">
                                        Are you sure you want to delete this meal entry for "{meal.foodName}"?
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                                      <AlertDialogCancel className="w-full sm:w-auto touch-manipulation">Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteMeal(meal.id)}
                                        className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-manipulation"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="p-4">
                      <p className="text-sm sm:text-base">No meals logged for {CalorieCalculator.formatDateForDisplay(selectedDate)}</p>
                      <p className="text-xs sm:text-sm mt-1">
                        {isToday ? "Start logging meals to see them here" : "No meals were logged on this date"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DailyPage() {
  return (
    <ErrorBoundary fallback={DailyPageErrorFallback}>
      <NetworkErrorHandler>
        <DailyPageContent />
      </NetworkErrorHandler>
    </ErrorBoundary>
  );
}
