import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { calculateDistance, Coordinate } from "../../src/lib/distance";

interface DistancePickerProps {
  visible: boolean;
  mode: "walking" | "bicycling";
  onConfirm: (distance: number) => void;
  onCancel: () => void;
}

export default function DistancePicker({
  visible,
  mode,
  onConfirm,
  onCancel,
}: DistancePickerProps) {
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [startPoint, setStartPoint] = useState<Coordinate | null>(null);
  const [endPoint, setEndPoint] = useState<Coordinate | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [pickingStart, setPickingStart] = useState(true);

  useEffect(() => {
    if (visible) {
      requestLocationPermission();
    } else {
      // Reset state when modal closes
      setStartPoint(null);
      setEndPoint(null);
      setDistance(null);
      setPickingStart(true);
    }
  }, [visible]);

  useEffect(() => {
    if (startPoint && endPoint) {
      calculateDistanceAsync();
    }
  }, [startPoint, endPoint]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is needed to measure distance."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    }
  };

  const calculateDistanceAsync = async () => {
    if (!startPoint || !endPoint) return;

    setCalculating(true);
    try {
      const dist = await calculateDistance(startPoint, endPoint, mode);
      setDistance(dist);
    } catch (error) {
      console.error("Error calculating distance:", error);
      Alert.alert("Error", "Failed to calculate distance. Please try again.");
    } finally {
      setCalculating(false);
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    if (pickingStart) {
      setStartPoint({ latitude, longitude });
      setPickingStart(false);
      setEndPoint(null);
      setDistance(null);
    } else {
      setEndPoint({ latitude, longitude });
    }
  };

  const handleConfirm = () => {
    if (distance !== null) {
      onConfirm(distance);
    }
  };

  const handleReset = () => {
    setStartPoint(null);
    setEndPoint(null);
    setDistance(null);
    setPickingStart(true);
  };

  if (!userLocation) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Measure Distance</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Map */}
        <MapView
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          {startPoint && (
            <Marker
              coordinate={startPoint}
              pinColor="green"
              title="Start"
              description="Starting point"
            />
          )}
          {endPoint && (
            <Marker
              coordinate={endPoint}
              pinColor="red"
              title="End"
              description="Ending point"
            />
          )}
        </MapView>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionRow}>
            <View
              style={[
                styles.indicator,
                { backgroundColor: pickingStart ? "#16a34a" : "#94a3b8" },
              ]}
            />
            <Text style={styles.instructionText}>
              {pickingStart ? "Tap to set START point" : "Start point set"}
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <View
              style={[
                styles.indicator,
                { backgroundColor: !pickingStart ? "#dc2626" : "#94a3b8" },
              ]}
            />
            <Text style={styles.instructionText}>
              {!pickingStart && !endPoint
                ? "Tap to set END point"
                : endPoint
                  ? "End point set"
                  : "Waiting..."}
            </Text>
          </View>
        </View>

        {/* Distance Display */}
        {calculating && (
          <View style={styles.distanceContainer}>
            <ActivityIndicator size="small" color="#16a34a" />
            <Text style={styles.distanceText}>Calculating distance...</Text>
          </View>
        )}

        {distance !== null && !calculating && (
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceLabel}>Distance:</Text>
            <Text style={styles.distanceValue}>{distance.toFixed(2)} mi</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={handleReset}
            style={[styles.button, styles.resetButton]}
            disabled={!startPoint && !endPoint}
          >
            <Text style={styles.buttonText}>Reset</Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            style={[
              styles.button,
              styles.confirmButton,
              (!distance || calculating) && styles.buttonDisabled,
            ]}
            disabled={!distance || calculating}
          >
            <Text style={styles.buttonText}>
              Confirm {distance ? `${distance.toFixed(2)} mi` : ""}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.5,
  },
  instructionsContainer: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  instructionText: {
    fontSize: 14,
    color: "#334155",
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#ecfdf5",
  },
  distanceLabel: {
    fontSize: 16,
    color: "#064e3b",
    marginRight: 8,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#16a34a",
  },
  distanceText: {
    fontSize: 16,
    color: "#064e3b",
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButton: {
    backgroundColor: "#f1f5f9",
  },
  confirmButton: {
    backgroundColor: "#16a34a",
  },
  buttonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
