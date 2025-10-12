import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Badge, getUserStats, UserStats } from "../../src/lib/gamification";
import { getUserId } from "../../src/lib/user";


export default function Explore() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = getUserId();
      const userStats = await getUserStats(userId);
      setStats(userStats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading your achievements...</Text>
      </View>
    );
  }

  const earnedBadges = stats?.badges.filter((b) => b.earned) || [];
  const lockedBadges = stats?.badges.filter((b) => !b.earned) || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Achievements</Text>
        <Text style={styles.subtitle}>
          Track your eco-friendly journey 🌟
        </Text>
      </View>

      {/* Level Card */}
      {stats && (
        <View style={styles.levelCard}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelNumber}>{stats.level}</Text>
          </View>
          <View style={styles.levelInfo}>
            <Text style={styles.levelTitle}>Level {stats.level}</Text>
            <Text style={styles.levelDescription}>
              {`You've saved ${stats.totalCo2Saved.toFixed(2)} lb of CO₂`}
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${((stats.totalCo2Saved % 5) / 5) * 100
                      }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {(5 - (stats.totalCo2Saved % 5)).toFixed(2)} lb to Level{" "}
              {stats.level + 1}
            </Text>
          </View>
        </View>
      )}

      {/* Earned Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Earned Badges ({earnedBadges.length})
        </Text>
        {earnedBadges.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>No badges yet!</Text>
            <Text style={styles.emptySubtext}>
              Start logging eco-friendly actions to earn badges
            </Text>
          </View>
        ) : (
          <View style={styles.badgeGrid}>
            {earnedBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </View>
        )}
      </View>

      {/* Locked Badges */}
      {lockedBadges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Locked Badges ({lockedBadges.length})
          </Text>
          <View style={styles.badgeGrid}>
            {lockedBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </View>
        </View>
      )}

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How to Earn Badges</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>🚴</Text>
          <Text style={styles.infoText}>
            Log eco-friendly actions like biking, walking, recycling, and eating
            vegetarian meals
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>📊</Text>
          <Text style={styles.infoText}>
            Accumulate CO₂ savings to unlock badges and level up
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>🔥</Text>
          <Text style={styles.infoText}>
            Maintain daily streaks by logging at least one action each day
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

interface BadgeCardProps {
  badge: Badge;
}

function BadgeCard({ badge }: BadgeCardProps) {
  return (
    <View
      style={[
        styles.badgeCard,
        !badge.earned && styles.badgeCardLocked,
      ]}
    >
      <View
        style={[
          styles.badgeIconContainer,
          !badge.earned && styles.badgeIconContainerLocked,
        ]}
      >
        <Text style={styles.badgeIcon}>{badge.icon}</Text>
        {badge.earned && <View style={styles.earnedIndicator} />}
      </View>
      <Text
        style={[
          styles.badgeName,
          !badge.earned && styles.badgeNameLocked,
        ]}
      >
        {badge.name}
      </Text>
      <Text
        style={[
          styles.badgeDescription,
          !badge.earned && styles.badgeDescriptionLocked,
        ]}
      >
        {badge.description}
      </Text>
      {!badge.earned && (
        <View style={styles.thresholdContainer}>
          <Text style={styles.thresholdText}>
            {badge.threshold.toFixed(1)} lb CO₂ required
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
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
  levelCard: {
    flexDirection: "row",
    margin: 16,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  levelNumber: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
  },
  levelInfo: {
    flex: 1,
    justifyContent: "center",
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#16a34a",
  },
  progressText: {
    fontSize: 12,
    color: "#64748b",
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeCardLocked: {
    backgroundColor: "#f8fafc",
    opacity: 0.7,
  },
  badgeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  badgeIconContainerLocked: {
    backgroundColor: "#e2e8f0",
  },
  badgeIcon: {
    fontSize: 32,
  },
  earnedIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 4,
  },
  badgeNameLocked: {
    color: "#64748b",
  },
  badgeDescription: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  badgeDescriptionLocked: {
    color: "#94a3b8",
  },
  thresholdContainer: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
  },
  thresholdText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  infoSection: {
    margin: 16,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
});
