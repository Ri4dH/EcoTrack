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

interface RecyclingModalProps {
  visible: boolean;
  onSubmit: (material: string, count?: number, weight_g?: number) => void;
  onCancel: () => void;
}

const MATERIALS = [
  { value: "aluminum_can", label: "Aluminum Can" },
  { value: "plastic_pet_bottle", label: "Plastic (PET) Bottle" },
  { value: "glass_bottle", label: "Glass Bottle" },
  { value: "paper", label: "Paper" },
  { value: "cardboard", label: "Cardboard" },
  { value: "steel", label: "Steel" },
];

export default function RecyclingModal({
  visible,
  onSubmit,
  onCancel,
}: RecyclingModalProps) {
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [count, setCount] = useState<string>("");
  const [weightG, setWeightG] = useState<string>("");

  const handleSubmit = () => {
    if (!selectedMaterial) {
      Alert.alert("Missing Info", "Please select a material type");
      return;
    }

    const countNum = count ? parseInt(count, 10) : undefined;
    const weightNum = weightG ? parseFloat(weightG) : undefined;

    if (!countNum && !weightNum) {
      Alert.alert(
        "Missing Info",
        "Please enter either quantity (count) or weight"
      );
      return;
    }

    console.log("[RECYCLE] Submitting:", {
      material: selectedMaterial,
      count: countNum,
      weight_g: weightNum,
    });

    onSubmit(selectedMaterial, countNum, weightNum);

    // Reset form
    setSelectedMaterial("");
    setCount("");
    setWeightG("");
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
          <Text style={styles.title}>Log Recycling ♻️</Text>
          <Text style={styles.subtitle}>
            Select material and enter quantity or weight
          </Text>
        </View>

        {/* Material Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Material Type *</Text>
          <View style={styles.materialsContainer}>
            {MATERIALS.map((material) => (
              <Pressable
                key={material.value}
                style={[
                  styles.materialButton,
                  selectedMaterial === material.value &&
                    styles.materialButtonSelected,
                ]}
                onPress={() => setSelectedMaterial(material.value)}
              >
                <Text
                  style={[
                    styles.materialButtonText,
                    selectedMaterial === material.value &&
                      styles.materialButtonTextSelected,
                  ]}
                >
                  {material.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quantity Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Quantity (count)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 5"
            keyboardType="number-pad"
            value={count}
            onChangeText={(text) => {
              setCount(text);
              if (text) setWeightG(""); // Disable weight when count is entered
            }}
          />
        </View>

        {/* Weight Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Weight (grams)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 250"
            keyboardType="numeric"
            value={weightG}
            onChangeText={(text) => {
              setWeightG(text);
              if (text) setCount(""); // Disable count when weight is entered
            }}
          />
          <Text style={styles.hint}>
            Enter either quantity OR weight (not both)
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
    backgroundColor: "#f59e0b",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#fef3c7",
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
  materialsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  materialButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  materialButtonSelected: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  materialButtonText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  materialButtonTextSelected: {
    color: "#f59e0b",
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
    backgroundColor: "#f59e0b",
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
