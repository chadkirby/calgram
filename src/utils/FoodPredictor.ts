import { DateTime } from "luxon";
import { type Loaded } from "jazz-tools";
import { FoodIntelligence, MealEntry } from "../schema";

export interface FoodScore {
  foodName: string; // display-cased food name
  score: number;
  entries: Loaded<typeof MealEntry>[];
}

/**
 * Normalize a food name for grouping (case-insensitive scoring groups).
 */
function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Choose a display casing for a normalized group.
 * Strategy: prefer the most recent casing among entries in the group.
 */
function chooseDisplayName(entries: Loaded<typeof MealEntry>[]): string {
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
  // Gaussian-like with variance factor tuned (denominator = 8 as per outline)
  return Math.exp(-(hoursDiff * hoursDiff) / 8);
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
function majorityCategory(entries: Loaded<typeof MealEntry>[]): string | null {
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
    entries: Loaded<typeof MealEntry>[],
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
    entries: Loaded<typeof MealEntry>[],
    currentTime: Date = new Date(),
    daysToConsider: number = 7,
    topN: number = 3
  ): FoodScore[] {
    if (!entries || entries.length === 0) return [];

    const currentDT = DateTime.fromJSDate(currentTime);
    const cutoff = currentDT.minus({ days: daysToConsider });

    // Filter to recent entries
    const recentEntries = entries.filter((e): e is Loaded<typeof MealEntry> => {
      if (!e) return false;
      const dt = DateTime.fromISO(e.timestamp);
      if (!dt.isValid) return false;
      return dt >= cutoff;
    });

    if (recentEntries.length === 0) return [];

    // Group by normalized food name
    const groupMap = new Map<string, Loaded<typeof MealEntry>[]>();
    for (const e of recentEntries) {
      const key = normalizeFoodName(e.foodName || "");
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
        const combinedScore = dayRecencyScore * 0.3 + timeOfDayScore * 0.7;
        totalScore += combinedScore;
      }
      // const frequencyBonus = Math.log(foodEntries.length + 1) * 0.5;
      // const finalScore = totalScore + frequencyBonus;

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
    groupedEntries: Loaded<typeof MealEntry>[]
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
