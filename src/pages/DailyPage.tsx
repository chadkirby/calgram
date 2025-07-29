import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar, Trash2, Edit, Plus } from "lucide-react";
import { MealEntryForm } from "@/components/MealEntryForm";
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
        foodIntelligence: {  // Load foodIntelligence for the edit form
          recentFoods: { $each: true },
          recentCategories: { $each: true },
          foodData: { $each: true }
        }
      }
    },
  });
  const [selectedDate, setSelectedDate] = useState(CalorieCalculator.getTodayAtMidnight());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Loaded<typeof MealEntry> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddMealDialogOpen, setIsAddMealDialogOpen] = useState(false);

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

  // Handle closing date picker on blur, enter, or escape
  const handleDatePickerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      setShowDatePicker(false);
    }
  };

  const handleDatePickerBlur = () => {
    setShowDatePicker(false);
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

  // Handle meal editing
  const handleEditMeal = (meal: Loaded<typeof MealEntry>) => {
    setEditingMeal(meal);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = (updatedMeal: Loaded<typeof MealEntry>) => {
    // Meal was successfully updated
    console.log("Meal updated successfully:", updatedMeal);
    setIsEditDialogOpen(false);
    setEditingMeal(null);
  };

  const handleEditCancel = () => {
    setIsEditDialogOpen(false);
    setEditingMeal(null);
  };

  // Handle adding new meal
  const handleAddMeal = () => {
    setIsAddMealDialogOpen(true);
  };

  const handleAddMealSuccess = (newMeal: Loaded<typeof MealEntry>) => {
    // Meal was successfully created
    console.log("Meal created successfully:", newMeal);
    setIsAddMealDialogOpen(false);
  };

  const handleAddMealCancel = () => {
    setIsAddMealDialogOpen(false);
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <ConnectionStatus />
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg lg:text-xl">Daily Calories</CardTitle>
        </CardHeader>
        <CardContent>
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
              {showDatePicker ? (
                <div className="flex items-center justify-center">
                  <Input
                    type="date"
                    value={CalorieCalculator.formatDateForInput(selectedDate)}
                    onChange={handleDateChange}
                    onKeyDown={handleDatePickerKeyDown}
                    onBlur={handleDatePickerBlur}
                    className="w-auto mx-auto touch-manipulation text-sm sm:text-base font-semibold bg-transparent border border-border/30 shadow-none px-3 py-1 h-auto text-center focus:ring-0 focus:border-border/60 rounded-md"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <h3 className={`text-sm sm:text-base font-semibold truncate ${isToday ? 'sm:border-none border border-primary/30 rounded px-2 py-0.5' : ''}`}>
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
                    <Badge variant="secondary" className="text-xs ml-1 hidden sm:inline-flex">Today</Badge>
                  )}
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
            <Card>
              <CardHeader className="text-center">
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
              <CardContent className="flex justify-center">
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
                  <div className="h-36 sm:h-48 lg:h-64 flex items-center justify-center text-muted-foreground w-full">
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">Meal Entries</CardTitle>
                  <Button
                    onClick={handleAddMeal}
                    size="sm"
                    className="touch-manipulation"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Meal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMealEntries.length > 0 ? (
                  <div className="space-y-3">
                    {filteredMealEntries.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors touch-manipulation"
                      >
                        {/* Left side - Time (fixed width) */}
                        <div className="flex-shrink-0 text-xs sm:text-sm font-medium text-muted-foreground min-w-[60px]">
                          {CalorieCalculator.formatTimeForDisplay(meal.timestamp)}
                        </div>

                        {/* Main content - flows like a paragraph */}
                        <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-3 gap-y-1">
                          <div className="text-xs sm:text-sm text-muted-foreground">{meal.foodCategory}</div>
                          <div className="font-medium text-xs sm:text-sm">{meal.foodName}</div>
                          <div className="text-xs sm:text-sm">
                            {meal.weightInGrams}g
                          </div>
                          <div className="text-xs sm:text-sm font-medium">
                            {meal.totalCalories.toFixed(1)} cal
                          </div>
                          {meal.notes && (
                            <div className="text-xs text-muted-foreground italic basis-full line-clamp-2">
                              {meal.notes}
                            </div>
                          )}
                        </div>

                        {/* Right side - Edit and Delete buttons (fixed position) */}
                        <div className="flex-shrink-0 flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMeal(meal)}
                            className="h-8 w-7 sm:h-9 sm:w-8 p-0 text-muted-foreground hover:text-foreground touch-manipulation"
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-7 sm:h-9 sm:w-8 p-0 text-destructive hover:text-destructive touch-manipulation"
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
                        </div>
                      </div>
                    ))}
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

      {/* Edit Meal Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Meal Entry</DialogTitle>
          </DialogHeader>
          {editingMeal && me && (
            <MealEntryForm
              mode="edit"
              initialData={editingMeal}
              onSuccess={handleEditSuccess}
              onCancel={handleEditCancel}
              me={me}
              showImport={false}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Meal Dialog */}
      <Dialog open={isAddMealDialogOpen} onOpenChange={setIsAddMealDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Meal Entry</DialogTitle>
          </DialogHeader>
          {me && (
            <MealEntryForm
              mode="create"
              onSuccess={handleAddMealSuccess}
              onCancel={handleAddMealCancel}
              me={me}
              showImport={false}
              defaultDate={CalorieCalculator.formatDateForInput(selectedDate)}
            />
          )}
        </DialogContent>
      </Dialog>
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
