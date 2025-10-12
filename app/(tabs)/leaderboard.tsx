import { get, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";
import { getUserId } from "../../src/lib/user";

const KG_TO_LB = 2.20462;
const asLb = (e: any): number => {
  // Prefer explicit lb if present, otherwise convert from kg, else 0
  const lb = typeof e?.total_co2_saved_lb === "number"
    ? e.total_co2_saved_lb
    : typeof e?.total_co2_saved_kg === "number"
      ? e.total_co2_saved_kg * KG_TO_LB
      : 0;
  return Number.isFinite(lb) ? lb : 0;
};
const formatLb = (e: any): string => asLb(e).toFixed(1);

interface LeaderboardEntry {
  name: string;
  total_co2_saved_lb: number;
  isCurrentUser?: boolean;
  isDemoUser?: boolean;
}

// Demo users for display purposes (hardcoded placeholders)
const DEMO_USERS: LeaderboardEntry[] = [
  { name: "Bob", total_co2_saved_lb: 12, isDemoUser: true },
];

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const userId = getUserId();
      const actionsRef = ref(db, `users/${userId}/actions`);
      const snapshot = await get(actionsRef);

      let userTotalKg = 0;
      if (snapshot.exists()) {
        const actions = snapshot.val();
        Object.values(actions).forEach((action: any) => {
          if (typeof action.co2_saved_kg === "number") {
            userTotalKg += action.co2_saved_kg;
          }
        });
      }

      console.log("[LEADERBOARD] User total CO₂ saved (kg):", userTotalKg);

      // Convert kg to lb
      const userTotalLb = userTotalKg * 2.20462;

      // Create current user entry
      const currentUserEntry: LeaderboardEntry = {
        name: "You",
        total_co2_saved_lb: userTotalLb,
        isCurrentUser: true,
      };

      // Combine with demo users
      const allEntriesRaw = [currentUserEntry, ...DEMO_USERS];

      // Normalize all entries to guarantee total_co2_saved_lb is a number
      const allEntries = allEntriesRaw.map((e) => ({
        ...e,
        total_co2_saved_lb: asLb(e),
      }));

      // Sort by total saved (descending)
      allEntries.sort((a, b) => asLb(b) - asLb(a));

      setLeaderboard(allEntries);
    } catch (error) {
      console.error("[LEADERBOARD] Failed to load:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard 🏆</Text>
        <Text style={styles.subtitle}>Top CO₂ Savers</Text>
      </View>

      {/* Leaderboard List */}
      <View style={styles.listContainer}>
        {leaderboard.map((entry, index) => (
          <View
            key={index}
            style={[
              styles.entryCard,
              entry.isCurrentUser && styles.currentUserCard,
            ]}
          >
            <View style={styles.rankContainer}>
              <Text
                style={[
                  styles.rankText,
                  entry.isCurrentUser && styles.currentUserText,
                ]}
              >
                #{index + 1}
              </Text>
            </View>

            <View style={styles.entryContent}>
              <Text
                style={[
                  styles.nameText,
                  entry.isCurrentUser && styles.currentUserText,
                ]}
              >
                {entry.name}
                {entry.isCurrentUser && " 🌟"}
              </Text>
              {entry.isDemoUser && (
                <Text style={styles.demoLabel}>Sample</Text>
              )}
            </View>

            <View style={styles.co2Container}>
              <Text
                style={[
                  styles.co2Value,
                  entry.isCurrentUser && styles.currentUserText,
                ]}
              >
                {formatLb(entry)}
              </Text>
              <Text
                style={[
                  styles.co2Label,
                  entry.isCurrentUser && styles.currentUserText,
                ]}
              >
                lb CO₂
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footerText}>
        Keep logging eco-friendly actions to climb the leaderboard! 🌱
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0fdf4",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: "#16a34a",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#dcfce7",
  },
  listContainer: {
    padding: 16,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentUserCard: {
    backgroundColor: "#dcfce7",
    borderWidth: 2,
    borderColor: "#16a34a",
  },
  rankContainer: {
    width: 40,
    alignItems: "center",
  },
  rankText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#64748b",
  },
  currentUserText: {
    color: "#16a34a",
  },
  entryContent: {
    flex: 1,
    marginLeft: 12,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  demoLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  co2Container: {
    alignItems: "flex-end",
  },
  co2Value: {
    fontSize: 24,
    fontWeight: "700",
    color: "#16a34a",
  },
  co2Label: {
    fontSize: 12,
    color: "#64748b",
  },
  footerText: {
    textAlign: "center",
    fontSize: 14,
    color: "#64748b",
    padding: 24,
  },
});
