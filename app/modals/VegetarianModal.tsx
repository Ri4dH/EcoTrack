import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface VegetarianModalProps {
  visible: boolean;
  onSubmit: (meat: string, portion_g: number) => void;
  onCancel: () => void;
}

const MEAT_TYPES = [
  { value: "beef", label: "Beef 🥩" },
  { value: "pork", label: "Pork 🐷" },
  { value: "chicken", label: "Chicken 🐔" },
  { value: "unknown_meat", label: "Unknown Meat" },
];

const PORTION_SIZES = [
  { value: 100, label: "Small (100g)" },
  { value: 150, label: "Medium (150g)" },
  { value: 250, label: "Large (250g)" },
];

export default function VegetarianModal({
  visible,
  onSubmit,
  onCancel,
}: VegetarianModalProps) {
  const [selectedMeat, setSelectedMeat] = useState<string>("");
  const [selectedPortion, setSelectedPortion] = useState<number | null>(null);
  const [customPortion, setCustomPortion] = useState<string>("");

  const handleSubmit = () => {
    if (!selectedMeat) {
      Alert.alert("Missing Info", "Please select the meat type you avoided");
      return;
    }

    const portionG = customPortion
      ? parseFloat(customPortion)
      : selectedPortion;

    if (!portionG || portionG <= 0) {
      Alert.alert("Missing Info", "Please select or enter a portion size");
      return;
    }

    console.log("[DIET] Submitting:", {
      meat: selectedMeat,
      portion_g: portionG,
    });

    onSubmit(selectedMeat, portionG);

    // Reset form
    setSelectedMeat("");
    setSelectedPortion(null);
    setCustomPortion("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Ate Vegetarian 🥗</Text>
          <Text style={styles.subtitle}>
            Which meat did you avoid and how much?
          </Text>
        </View>

        {/* Meat Type Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Meat Type Avoided *</Text>
          <View style={styles.optionsContainer}>
            {MEAT_TYPES.map((meat) => (
              <Pressable
                key={meat.value}
                style={[
                  styles.optionButton,
                  selectedMeat === meat.value && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedMeat(meat.value)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selectedMeat === meat.value &&
                      styles.optionButtonTextSelected,
                  ]}
                >
                  {meat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Portion Size Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Portion Size *</Text>
          <View style={styles.portionsContainer}>
            {PORTION_SIZES.map((portion) => (
              <Pressable
                key={portion.value}
                style={[
                  styles.portionButton,
                  selectedPortion === portion.value &&
                    !customPortion &&
                    styles.portionButtonSelected,
                ]}
                onPress={() => {
                  setSelectedPortion(portion.value);
                  setCustomPortion(""); // Clear custom when preset selected
                }}
              >
                <Text
                  style={[
                    styles.portionButtonText,
                    selectedPortion === portion.value &&
                      !customPortion &&
                      styles.portionButtonTextSelected,
                  ]}
                >
                  {portion.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Custom Portion Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Custom Portion (grams)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 200"
            keyboardType="numeric"
            value={customPortion}
            onChangeText={(text) => {
              setCustomPortion(text);
              if (text) setSelectedPortion(null); // Clear preset when custom entered
            }}
          />
          <Text style={styles.hint}>
            Or enter a custom portion size if needed
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.submitButton]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#10b981",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#d1fae5",
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  optionButtonSelected: {
    backgroundColor: "#d1fae5",
    borderColor: "#10b981",
  },
  optionButtonText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  optionButtonTextSelected: {
    color: "#10b981",
    fontWeight: "600",
  },
  portionsContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  portionButton: {
    flex: 1,
    minWidth: "30%",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  portionButtonSelected: {
    backgroundColor: "#d1fae5",
    borderColor: "#10b981",
  },
  portionButtonText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  portionButtonTextSelected: {
    color: "#10b981",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
  },
  buttonContainer: {
    padding: 24,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#10b981",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
  },
  cancelButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
});
