import dayjs from "dayjs";
import { get, ref } from "firebase/database";
import { db } from "../../firebaseConfig";

/**
 * Action stored in Firebase
 */
export interface EcoActionRecord {
  action: string;
  distance_km?: number; // Legacy field for backwards compatibility
  distance_mi?: number; // New field using US customary units
  co2_saved_kg: number; // Legacy: stored in kilograms
  co2_saved_lb?: number; // Preferred: stored in pounds if available
  message: string;
  ts: number;
}

/**
 * Badge definition
 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  threshold: number; // CO2 threshold in lb (pounds)
  earned: boolean;
}
const KG_TO_LB = 2.20462;
const actionCo2Lb = (a: EcoActionRecord): number =>
  typeof a.co2_saved_lb === "number"
    ? a.co2_saved_lb
    : (a.co2_saved_kg || 0) * KG_TO_LB;

/**
 * User statistics
 */
export interface UserStats {
  totalCo2Saved: number;
  todayCo2Saved: number;
  streak: number;
  level: number;
  badges: Badge[];
}

/**
 * Badge definitions with thresholds
 */
const BADGE_DEFINITIONS: Omit<Badge, "earned">[] = [
  {
    id: "starter",
    name: "Eco Starter",
    description: "Save your first 1 lb of CO₂",
    icon: "🌱",
    threshold: 1,
  },
  {
    id: "committed",
    name: "Eco Committed",
    description: "Save 5 lb of CO₂",
    icon: "🌿",
    threshold: 5,
  },
  {
    id: "champion",
    name: "Eco Champion",
    description: "Save 10 lb of CO₂",
    icon: "🏆",
    threshold: 10,
  },
  {
    id: "hero",
    name: "Eco Hero",
    description: "Save 25 lb of CO₂",
    icon: "⭐",
    threshold: 25,
  },
  {
    id: "legend",
    name: "Eco Legend",
    description: "Save 50 lb of CO₂",
    icon: "👑",
    threshold: 50,
  },
  {
    id: "guardian",
    name: "Planet Guardian",
    description: "Save 100 lb of CO₂",
    icon: "🌍",
    threshold: 100,
  },
];

/**
 * Calculate level based on total CO2 saved
 * Level = floor(totalCo2 / 5) + 1
 */
export function calculateLevel(totalCo2Saved: number): number {
  return Math.floor(totalCo2Saved / 5) + 1;
}

/**
 * Calculate streak (consecutive days with at least one action)
 */
export function calculateStreak(actions: EcoActionRecord[]): number {
  if (actions.length === 0) return 0;

  // Sort actions by timestamp (most recent first)
  const sortedActions = [...actions].sort((a, b) => b.ts - a.ts);

  // Get unique days with actions
  const activeDays = new Set<string>();
  sortedActions.forEach((action) => {
    const day = dayjs(action.ts).format("YYYY-MM-DD");
    activeDays.add(day);
  });

  const sortedDays = Array.from(activeDays).sort().reverse();
  if (sortedDays.length === 0) return 0;

  // Check if user was active today or yesterday (to maintain streak)
  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  let currentDay = dayjs(sortedDays[0]);

  for (let i = 1; i < sortedDays.length; i++) {
    const previousDay = dayjs(sortedDays[i]);
    const dayDiff = currentDay.diff(previousDay, "day");

    if (dayDiff === 1) {
      streak++;
      currentDay = previousDay;
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

/**
 * Calculate today's CO2 saved
 */
export function calculateTodayCo2(actions: EcoActionRecord[]): number {
  const today = dayjs().format("YYYY-MM-DD");
  return actions
    .filter((action) => {
      const actionDay = dayjs(action.ts).format("YYYY-MM-DD");
      return actionDay === today;
    })
    .reduce((sum, action) => sum + actionCo2Lb(action), 0);
}

/**
 * Calculate total CO2 saved
 */
export function calculateTotalCo2(actions: EcoActionRecord[]): number {
  return actions.reduce((sum, action) => sum + actionCo2Lb(action), 0);
}

/**
 * Calculate badges based on total CO2 saved
 */
export function calculateBadges(totalCo2Saved: number): Badge[] {
  return BADGE_DEFINITIONS.map((badge) => ({
    ...badge,
    earned: totalCo2Saved >= badge.threshold,
  }));
}

/**
 * Fetch all actions for a user and calculate statistics
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    const actionsRef = ref(db, `users/${userId}/actions`);
    const snapshot = await get(actionsRef);

    const actions: EcoActionRecord[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        actions.push(childSnapshot.val() as EcoActionRecord);
      });
    }

    const totalCo2Saved = calculateTotalCo2(actions);
    const todayCo2Saved = calculateTodayCo2(actions);
    const streak = calculateStreak(actions);
    const level = calculateLevel(totalCo2Saved);
    const badges = calculateBadges(totalCo2Saved);

    return {
      totalCo2Saved,
      todayCo2Saved,
      streak,
      level,
      badges,
    };
  } catch (error) {
    console.error("Failed to fetch user stats:", error);
    return {
      totalCo2Saved: 0,
      todayCo2Saved: 0,
      streak: 0,
      level: 1,
      badges: calculateBadges(0),
    };
  }
}

/**
 * Get the last N actions for display
 */
export async function getRecentActions(
  userId: string,
  limit: number = 5
): Promise<EcoActionRecord[]> {
  try {
    const actionsRef = ref(db, `users/${userId}/actions`);
    const snapshot = await get(actionsRef);

    const actions: EcoActionRecord[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        actions.push(childSnapshot.val() as EcoActionRecord);
      });
    }

    // Sort by timestamp (most recent first) and limit
    return actions
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch recent actions:", error);
    return [];
  }
}
