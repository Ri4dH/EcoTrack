// --- Unit normalization: convert any "X kg" in agent messages to pounds ---
const KG_TO_LB = 2.20462;
function normalizeMessageToUSCS(msg: string, fallbackKg: number): string {
  if (!msg || typeof msg !== "string") return msg;
  // Replace any "<number> kg" (case-insensitive) with converted pounds
  const replaced = msg.replace(/(\d+(?:\.\d+)?)\s*kg\b/gi, (_m, num) => {
    const kg = parseFloat(num);
    const lb = isNaN(kg) ? fallbackKg * KG_TO_LB : kg * KG_TO_LB;
    return `${lb.toFixed(2)} lb`;
  });
  // If the message still contains a bare "kg" without a number, replace unit label
  return replaced.replace(/\bkg\b/gi, "lb");
}
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { push, ref } from "firebase/database";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";
import { getCo2Savings } from "../../src/lib/agentClient";
import { AGENT_URL, getConfigErrorMessage } from "../../src/lib/config";
import {
  EcoActionRecord,
  getRecentActions,
  getUserStats,
  UserStats,
} from "../../src/lib/gamification";
import { getUserId } from "../../src/lib/user";
import DistancePicker from "../modals/DistancePicker";

type ActionType = "bike" | "walk" | "recycled" | "vegetarian";

export default function Tracker() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActions, setRecentActions] = useState<EcoActionRecord[]>([]);
  const [showDistancePicker, setShowDistancePicker] = useState(false);
  const [currentActionType, setCurrentActionType] = useState<ActionType | null>(
    null
  );

  const configError = getConfigErrorMessage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = getUserId();
      const [userStats, actions] = await Promise.all([
        getUserStats(userId),
        getRecentActions(userId, 5),
      ]);
      setStats(userStats);
      setRecentActions(actions);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleActionPress = (actionType: ActionType) => {
    if (actionType === "bike" || actionType === "walk") {
      setCurrentActionType(actionType);
      setShowDistancePicker(true);
    } else {
      logAction(actionType, 0);
    }
  };

  const handleDistanceConfirm = (distance: number) => {
    setShowDistancePicker(false);
    if (currentActionType) {
      logAction(currentActionType, distance);
    }
    setCurrentActionType(null);
  };

  const handleDistanceCancel = () => {
    setShowDistancePicker(false);
    setCurrentActionType(null);
  };

  const logAction = async (actionType: ActionType, distance: number) => {
    try {
      setLoading(true);

      const userId = getUserId();

      // Map action type to agent action format
      const agentAction =
        actionType === "bike"
          ? "bike_trip"
          : actionType === "walk"
            ? "walk_trip"
            : actionType === "recycled"
              ? "recycled"
              : "ate_vegetarian";

      // Call the agent to calculate CO2 savings (ASI:One)
      console.log("[TRACKER] Calling agent for CO₂ calculation...");
      const agentResponse = await getCo2Savings({
        user_id: userId,
        action: agentAction,
        distance_mi: distance,
      });

      console.log("[TRACKER] Agent response:", agentResponse);

      // Ensure the agent returned a numeric kg value; convert once to lb for display + storage
      const co2Kg = Number(agentResponse.co2_saved_kg);
      if (!Number.isFinite(co2Kg)) {
        throw new Error(
          "Agent did not return a valid CO₂ value. This action will NOT be saved to protect data integrity."
        );
      }
      const co2SavedLb = co2Kg * KG_TO_LB;

      const normalizedMsg = normalizeMessageToUSCS(
        agentResponse.message,
        co2Kg
      );


      // Verify agent metadata (confirms ASI:One was used)
      const engine = agentResponse.agent_meta?.engine;
      if (engine === "asi_one") {
        console.log(`[TRACKER] ✓ Confirmed: Calculation by ${engine}`);
        console.log(`[TRACKER] Model: ${agentResponse.agent_meta?.model}`);
      } else {
        console.warn("[TRACKER] ⚠️  Warning: agent_meta.engine not 'asi_one'");
      }

      // Save to Firebase - only happens if we passed the guard above
      await push(ref(db, `users/${userId}/actions`), {
        action: agentAction,
        distance_mi: distance,
        // store both for backward compatibility; UI reads lb preferentially
        co2_saved_kg: co2Kg,
        co2_saved_lb: co2SavedLb,
        message: agentResponse.message,
        agent_engine: engine || "unknown",
        ts: Date.now(),
      });

      console.log("[TRACKER] ✓ Saved to Firebase");

      // Show success message with engine confirmation
      const engineInfo = engine === "asi_one" ? " (verified AI calculation)" : "";
      const successMessage = `${normalizedMsg}\n\nYou saved ${co2SavedLb.toFixed(2)} lb CO₂!${engineInfo}`;

      Alert.alert("Success! 🌱", successMessage, [
        {
          text: "Share",
          onPress: () => shareWin(co2SavedLb, actionType),
        },
        { text: "OK", style: "default" },
      ]);

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error("[TRACKER] Failed to log action:", error);

      // Check if error has backend details
      const errorDetails = error?.response?.data?.detail;
      let errorMessage = "Failed to log action. Please try again.";
      let errorHint = "";

      if (errorDetails) {
        // Backend returned structured error
        if (typeof errorDetails === "object") {
          errorMessage = errorDetails.error || errorMessage;
          errorHint = errorDetails.hint || "";

          console.error("[TRACKER] Backend error:", errorDetails.error);
          console.error("[TRACKER] Details:", errorDetails.details);
          if (errorHint) console.error("[TRACKER] Hint:", errorHint);
        }
      }

      // Show user-friendly error
      const fullMessage = errorHint
        ? `${errorMessage}\n\n${errorHint}`
        : error?.message || errorMessage;

      Alert.alert(
        "❌ Cannot Calculate CO₂",
        fullMessage,
        [{ text: "OK", style: "cancel" }]
      );

      // DO NOT write to Firebase on error - this is critical!
      console.log("[TRACKER] ✗ Action NOT saved (no valid CO₂ value)");
    } finally {
      setLoading(false);
    }
  };

  const shareWin = async (co2SavedLb: number, actionType: ActionType) => {
    const actionEmoji =
      actionType === "bike"
        ? "🚴"
        : actionType === "walk"
          ? "🚶"
          : actionType === "recycled"
            ? "♻️"
            : "🥗";

    const message = `${actionEmoji} Just logged an eco-friendly action with EcoTrack and saved ${co2SavedLb.toFixed(
      2
    )} lb CO₂! Every action counts for our planet. 🌍✨`;

    try {
      await Share.share({
        message,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatActionName = (action: string): string => {
    switch (action) {
      case "bike_trip":
        return "Biked";
      case "walk_trip":
        return "Walked";
      case "recycled":
        return "Recycled";
      case "ate_vegetarian":
        return "Ate Vegetarian";
      default:
        return action;
    }
  };

  const getActionIcon = (action: string): string => {
    switch (action) {
      case "bike_trip":
        return "🚴";
      case "walk_trip":
        return "🚶";
      case "recycled":
        return "♻️";
      case "ate_vegetarian":
        return "🥗";
      default:
        return "🌱";
    }
  };

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading your eco stats...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>EcoTrack</Text>
          <Text style={styles.subtitle}>Your Carbon Companion 🌍</Text>
        </View>

        {/* Diagnostic Banner (dev mode) */}
        {__DEV__ && (
          <Pressable
            style={[
              styles.diagnosticBanner,
              configError && styles.diagnosticBannerError,
            ]}
            onPress={() => router.push("../dev/diagnostics" as any)}
          >
            <Text style={styles.diagnosticTitle}>
              {configError ? "⚠️ Configuration Issue" : "🔧 Agent Status"}
            </Text>
            <Text
              style={styles.diagnosticUrl}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {configError || `Connected: ${AGENT_URL}`}
            </Text>
            <Text style={styles.diagnosticHint}>Tap to test connectivity →</Text>
          </Pressable>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.todayCo2Saved.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>lb CO₂ Today</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak 🔥</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>Level {stats.level}</Text>
            <Text style={styles.statLabel}>
              {stats.totalCo2Saved.toFixed(1)} lb total
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Log Your Actions</Text>

          <View style={styles.actionGrid}>
            <Pressable
              style={[styles.actionButton, styles.bikeButton]}
              onPress={() => handleActionPress("bike")}
              disabled={loading}
            >
              <Text style={styles.actionIcon}>🚴</Text>
              <Text style={styles.actionText}>Bike Trip</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, styles.walkButton]}
              onPress={() => handleActionPress("walk")}
              disabled={loading}
            >
              <Text style={styles.actionIcon}>🚶</Text>
              <Text style={styles.actionText}>Walk Trip</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, styles.recycleButton]}
              onPress={() => handleActionPress("recycled")}
              disabled={loading}
            >
              <Text style={styles.actionIcon}>♻️</Text>
              <Text style={styles.actionText}>Recycled</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, styles.veganButton]}
              onPress={() => handleActionPress("vegetarian")}
              disabled={loading}
            >
              <Text style={styles.actionIcon}>🥗</Text>
              <Text style={styles.actionText}>Ate Vegetarian</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Actions */}
        {recentActions.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Recent Actions</Text>
            {recentActions.map((action, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyIconContainer}>
                  <Text style={styles.historyIcon}>
                    {getActionIcon(action.action)}
                  </Text>
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>
                    {formatActionName(action.action)}
                    {action.distance_mi && action.distance_mi > 0
                      ? ` (${action.distance_mi.toFixed(1)} mi)`
                      : action.distance_km && action.distance_km > 0
                        ? ` (${(action.distance_km * 0.621371).toFixed(1)} mi)`
                        : ""}
                  </Text>
                  <Text style={styles.historyTime}>
                    {dayjs(action.ts).format("MMM D, h:mm A")}
                  </Text>
                </View>
                <View style={styles.historyCo2}>
                  <Text style={styles.historyCo2Value}>
                    {(
                      (typeof (action as any).co2_saved_lb === "number"
                        ? (action as any).co2_saved_lb
                        : action.co2_saved_kg * KG_TO_LB) || 0
                    ).toFixed(2)}
                  </Text>
                  <Text style={styles.historyCo2Label}>lb CO₂</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingOverlayText}>
              Calculating CO₂ savings...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Distance Picker Modal */}
      <DistancePicker
        visible={showDistancePicker}
        mode={currentActionType === "bike" ? "bicycling" : "walking"}
        onConfirm={handleDistanceConfirm}
        onCancel={handleDistanceCancel}
      />
    </>
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
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#16a34a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    width: "48%",
    aspectRatio: 1.2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bikeButton: {
    backgroundColor: "#3b82f6",
  },
  walkButton: {
    backgroundColor: "#8b5cf6",
  },
  recycleButton: {
    backgroundColor: "#f59e0b",
  },
  veganButton: {
    backgroundColor: "#10b981",
  },
  actionIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  historyContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 24,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  historyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  historyIcon: {
    fontSize: 24,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 14,
    color: "#64748b",
  },
  historyCo2: {
    alignItems: "flex-end",
  },
  historyCo2Value: {
    fontSize: 18,
    fontWeight: "700",
    color: "#16a34a",
  },
  historyCo2Label: {
    fontSize: 12,
    color: "#64748b",
  },
  loadingOverlay: {
    padding: 24,
    alignItems: "center",
  },
  loadingOverlayText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  diagnosticBanner: {
    margin: 16,
    marginTop: 0,
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  diagnosticBannerError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
  },
  diagnosticTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 4,
  },
  diagnosticUrl: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#0c4a6e",
    marginBottom: 4,
  },
  diagnosticHint: {
    fontSize: 10,
    color: "#64748b",
    fontStyle: "italic",
  },
});
