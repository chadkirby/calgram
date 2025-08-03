import { DateTime } from "luxon";
import { type Loaded } from "jazz-tools";
import { FoodIntelligence, MealEntry } from "../schema";

export type PredictionEntry = Pick<Loaded<typeof MealEntry>, 'timestamp' | 'foodName' | 'foodCategory'>;

export interface FoodScore {
  foodName: string; // display-cased food name
  score: number;
  entries: PredictionEntry[];
}

/**
 * Normalize a food name for grouping (case-insensitive scoring groups).
 */
function normalizeFoodName(name: string): string {
  return name?.trim().toLowerCase() || "";
}

/**
 * Choose a display casing for a normalized group.
 * Strategy: prefer the most recent casing among entries in the group.
 */
function chooseDisplayName(entries: PredictionEntry[]): string {
  if (entries.length === 0) return "";
  // entries contain ISO timestamps; pick the max
  const mostRecent = entries.reduce((acc, cur) => {
    const accMs = DateTime.fromISO(acc.timestamp).toMillis();
    const curMs = DateTime.fromISO(cur.timestamp).toMillis();
    return curMs > accMs ? cur : acc;
  }, entries[0]);
  return mostRecent.foodName;
}

/**
 * Return time of day as minutes since midnight (0-1439), using Luxon.
 */
export function getTimeOfDay(date: Date | DateTime): number {
  const dt = date instanceof DateTime ? date : DateTime.fromJSDate(date);
  return dt.hour * 60 + dt.minute;
}

/**
 * Exponential decay - more recent days get higher scores
 * Score ranges from ~1.0 (today) downwards with decay
 * Uses Luxon for date math.
 */
export function calculateDayRecencyScore(entryDate: Date | DateTime, currentDate: Date | DateTime): number {
  const entry = entryDate instanceof DateTime ? entryDate : DateTime.fromJSDate(entryDate);
  const current = currentDate instanceof DateTime ? currentDate : DateTime.fromJSDate(currentDate);
  const daysDiff = current.diff(entry, "days").days;
  return Math.exp(-daysDiff * 0.3);
}

/**
 * Gaussian-like decay - foods eaten at similar times get higher scores
 * Score ranges from 1.0 (same time) to ~0.1 (12 hours away)
 * Uses Luxon for time-of-day extraction.
 */
export function calculateTimeOfDayScore(entryDate: Date | DateTime, currentTimeOfDay: number): number {
  const entryTimeOfDay = getTimeOfDay(entryDate);

  // Calculate time difference in minutes (handling day wrap-around)
  let timeDiff = Math.abs(currentTimeOfDay - entryTimeOfDay);
  if (timeDiff > 12 * 60) {
    timeDiff = 24 * 60 - timeDiff;
  }

  const hoursDiff = timeDiff / 60;

  // Stronger exponential falloff: exp(-lambda * |hoursDiff|)
  // Tunable lambda chosen to penalize > ~45-60 min deltas aggressively.
  const lambda = 1.2; // at 1h => ~0.30, 2h => ~0.09, 3h => ~0.03
  return Math.exp(-lambda * Math.abs(hoursDiff));
}

/**
 * Utility to coerce ISO string to Luxon DateTime safely.
 */
function isoToDateTime(iso: string): DateTime {
  return DateTime.fromISO(iso);
}

/**
 * Calculates majority category among provided entries (ties broken by most recent)
 */
function majorityCategory(entries: PredictionEntry[]): string | null {
  if (!entries.length) return null;
  const counts = new Map<string, number>();
  for (const e of entries) {
    const cat = e.foodCategory || "";
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  let best: { cat: string; count: number } | null = null;
  for (const [cat, count] of counts) {
    if (!best || count > best.count) {
      best = { cat, count };
    }
  }
  if (best) return best.cat;

  // fallback to most recent category
  const mostRecent = entries.reduce((acc, cur) => {
    const accMs = DateTime.fromISO(acc.timestamp).toMillis();
    const curMs = DateTime.fromISO(cur.timestamp).toMillis();
    return curMs > accMs ? cur : acc;
  }, entries[0]);
  return mostRecent.foodCategory || null;
}

export class FoodPredictor {
  /**
   * Predict the most likely food name, using case-insensitive grouping for scoring,
   * preserving original display casing from the most recent entry in the group.
   *
   * Returns null if no recent entries within window.
   */
  static predictMostLikelyFood(
    entries: PredictionEntry[],
    currentTime: Date = new Date(),
    daysToConsider: number = 7
  ): string | null {
    const scores = this.getTopFoodPredictions(entries, currentTime, daysToConsider, 1);
    return scores.length > 0 ? scores[0].foodName : null;
  }

  /**
   * Get top N predictions with scores and grouped entries.
   */
  static getTopFoodPredictions(
    entries: PredictionEntry[],
    currentTime: Date = new Date(),
    daysToConsider: number = 7,
    topN: number = 3
  ): FoodScore[] {
    if (!entries || entries.length === 0) return [];

    const currentDT = DateTime.fromJSDate(currentTime);
    const startOfCurrentDay = currentDT.startOf('day');
    const cutoff = currentDT.minus({ days: daysToConsider });

    // Filter to recent entries
    let recentEntries: PredictionEntry[] = [];
    const todayEntries: PredictionEntry[] = [];
    for (const e of entries) {
      if (!e) continue;
      const dt = DateTime.fromISO(e.timestamp);
      if (!dt.isValid) continue;
      // Only include entries within the window AND not today AND not in the future
      if (dt >= cutoff && dt < startOfCurrentDay) {
        recentEntries.push(e);
      } else if (dt >= startOfCurrentDay && dt <= currentDT) {
        todayEntries.push(e);
      }
    }

    if (recentEntries.length === 0) return [];

    // make sure today entries are sorted by timestamp (newest first)
    todayEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const lastEntryFromToday = todayEntries[0];
    if (lastEntryFromToday) {
      // If we have an entry from today, then remove items with the same
      // food name from recent entries because we don't want to predict
      // the same food item that was just eaten
      const todayFoodName = normalizeFoodName(lastEntryFromToday.foodName);
      recentEntries = recentEntries.filter(e => normalizeFoodName(e.foodName) !== todayFoodName);
    }

    // Group by normalized food name
    const groupMap = new Map<string, PredictionEntry[]>();
    for (const e of recentEntries) {
      const key = normalizeFoodName(e.foodName);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(e);
    }

    const currentTimeOfDay = getTimeOfDay(currentDT);

    // Score each group
    const foodScores: FoodScore[] = [];
    for (const [, foodEntries] of groupMap) {
      let totalScore = 0;
      for (const e of foodEntries) {
        const entryDT = isoToDateTime(e.timestamp);
        const dayRecencyScore = calculateDayRecencyScore(entryDT, currentDT);
        const timeOfDayScore = calculateTimeOfDayScore(entryDT, currentTimeOfDay);
        const combinedScore = dayRecencyScore * 0.3 + timeOfDayScore;
        // if (/stick|pup cup/i.test(e.foodName)) console.log(`Scoring entry: ${e.foodName} | Day Delta: ${currentDT.diff(entryDT, "days").days.toFixed(2)} | Day Recency: ${dayRecencyScore.toFixed(2)} | Time Delta: ${currentTimeOfDay - getTimeOfDay(entryDT)} | Time of Day: ${timeOfDayScore.toFixed(2)} | Combined: ${combinedScore.toFixed(2)} | Total: ${(totalScore + combinedScore).toFixed(2)}`);
        totalScore += combinedScore;
      }

      const displayName = chooseDisplayName(foodEntries);

      foodScores.push({
        foodName: displayName,
        score: totalScore,
        entries: foodEntries,
      });
    }

    return foodScores.sort((a, b) => b.score - a.score).slice(0, topN);
  }

  /**
   * Resolve preferred category for a given predicted food name.
   * Prefers FoodIntelligence lastUsedCategory; falls back to majority category in the group.
   */
  static resolveCategoryForFood(
    intelligence: Loaded<typeof FoodIntelligence> | undefined,
    predictedFoodDisplayName: string,
    groupedEntries: PredictionEntry[]
  ): string | null {
    if (intelligence?.foodData) {
      const md = intelligence.foodData[predictedFoodDisplayName];
      if (md && md.lastUsedCategory) {
        return md.lastUsedCategory;
      }
    }
    return majorityCategory(groupedEntries);
  }
}
