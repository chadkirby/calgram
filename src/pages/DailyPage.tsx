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
import type { JazzAccount, MealEntry } from "../schema";
import { CalorieCalculator } from "../utils/CalorieCalculator";
import { type Loaded } from "jazz-tools";

export function DailyPage() {
  const { me } = useAccount<typeof JazzAccount>();
  const [selectedDate, setSelectedDate] = useState(CalorieCalculator.getTodayAtMidnight());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filter meal entries by selected date
  const filteredMealEntries = me?.root?.mealEntries?.filter((meal): meal is Loaded<typeof MealEntry> =>
    meal != null && CalorieCalculator.isSameDay(new Date(meal.timestamp), selectedDate)
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
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  // Handle direct date selection
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    if (!isNaN(newDate.getTime())) {
      // Set to midnight for consistent comparison
      newDate.setHours(0, 0, 0, 0);
      setSelectedDate(newDate);
      setShowDatePicker(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format date for input value (YYYY-MM-DD)
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Check if selected date is today
  const isToday = CalorieCalculator.isSameDay(selectedDate, new Date());

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

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Calorie Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Date Navigation Section */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousDay}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Day
            </Button>

            <div className="text-center">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{formatDate(selectedDate)}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="p-1"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
              {isToday && (
                <Badge variant="secondary" className="mt-1">Today</Badge>
              )}
              {showDatePicker && (
                <div className="mt-2">
                  <Input
                    type="date"
                    value={formatDateForInput(selectedDate)}
                    onChange={handleDateChange}
                    className="w-auto mx-auto"
                  />
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextDay}
              className="flex items-center gap-2"
            >
              Next Day
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{dailyCalories.toFixed(1)}</div>
                  <p className="text-sm text-muted-foreground">Total Calories</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{mealCount}</div>
                  <p className="text-sm text-muted-foreground">Meals Logged</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown Pie Chart */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Calories by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <p>No meals logged for this date</p>
                      <p className="text-sm mt-1">Add some meals to see the category breakdown</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meal Entry List */}
            <Card>
              <CardHeader>
                <CardTitle>Meal Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredMealEntries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Food Details</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Calories</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMealEntries.map((meal) => (
                        <TableRow key={meal.id}>
                          <TableCell className="font-medium">
                            {formatTime(new Date(meal.timestamp))}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{meal.foodName}</div>
                              <div className="text-sm text-muted-foreground">
                                {meal.weightInGrams}g × {meal.caloriesPerGram} cal/g
                              </div>
                              {meal.notes && (
                                <div className="text-sm text-muted-foreground italic mt-1">
                                  {meal.notes}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{meal.foodCategory}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {meal.totalCalories.toFixed(1)} cal
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Meal Entry</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this meal entry for "{meal.foodName}"?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMeal(meal.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div>
                      <p>No meals logged for {formatDate(selectedDate)}</p>
                      <p className="text-sm mt-1">
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
