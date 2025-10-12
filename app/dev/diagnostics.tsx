import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { AGENT_URL, getConfigErrorMessage } from "../../src/lib/config";
import { testAgentHealth } from "../../src/lib/agentClient";

export default function Diagnostics() {
  const router = useRouter();
  const [healthResult, setHealthResult] = useState<string>("");
  const [postResult, setPostResult] = useState<string>("");
  const [asiResult, setAsiResult] = useState<string>("");
  const [testing, setTesting] = useState<{
    health: boolean;
    post: boolean;
    asi: boolean;
  }>({
    health: false,
    post: false,
    asi: false,
  });

  const configError = getConfigErrorMessage();

  const testAsiConfig = async () => {
    setTesting({ ...testing, asi: true });
    setAsiResult("Checking ASI:One config...");

    try {
      if (!AGENT_URL) {
        throw new Error("Agent URL not configured");
      }

      const endpoint = `${AGENT_URL.replace(/\/+$/, "")}/debug/asi`;

      console.log("[DIAGNOSTICS] Testing:", endpoint);

      const response = await fetch(endpoint);
      const data = await response.json();

      console.log("[DIAGNOSTICS] ASI Config:", data);

      if (!response.ok) {
        setAsiResult(`❌ HTTP ${response.status}\n\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      const status = data.has_key ? "✅" : "❌";
      setAsiResult(
        `${status} ASI:One Configuration\n\n` +
        `URL: ${data.ASI_ONE_URL}\n` +
        `Model: ${data.ASI_ONE_MODEL}\n` +
        `API Key: ${data.has_key ? data.key_prefix : "NOT SET"}\n\n` +
        (data.has_key
          ? "✓ ASI:One is configured\n✓ CO₂ calculations will use AI"
          : "⚠️  ASI_ONE_KEY not set\n⚠️  Backend will return errors")
      );
    } catch (error: any) {
      console.error("[DIAGNOSTICS] ASI Error:", error);
      setAsiResult(`❌ Error: ${error?.message || "Unknown error"}`);
    } finally {
      setTesting({ ...testing, asi: false });
    }
  };

  const testHealth = async () => {
    setTesting({ ...testing, health: true });
    setHealthResult("Testing...");

    try {
      const result = await testAgentHealth();
      setHealthResult(result.message);
    } catch (error) {
      setHealthResult(`❌ Error: ${error instanceof Error ? error.message : "Unknown"}`);
    } finally {
      setTesting({ ...testing, health: false });
    }
  };

  const testPost = async () => {
    setTesting({ ...testing, post: true });
    setPostResult("Testing POST /co2/savings...");

    try {
      if (!AGENT_URL) {
        throw new Error("Agent URL not configured");
      }

      const endpoint = `${AGENT_URL.replace(/\/+$/, "")}/co2/savings`;
      const payload = {
        user_id: "diagnostics",
        action: "bike_trip",
        distance_km: 1,
      };

      console.log("[DIAGNOSTICS] Testing:", endpoint);
      console.log("[DIAGNOSTICS] Payload:", JSON.stringify(payload));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("[DIAGNOSTICS] Response:", response.status, responseText);

      if (!response.ok) {
        setPostResult(
          `❌ HTTP ${response.status}\n\n${responseText.substring(0, 200)}`
        );
        return;
      }

      try {
        const data = JSON.parse(responseText);
        const co2SavedLb = data.co2_saved_kg * 2.20462;
        setPostResult(
          `✅ Success (${response.status})\n\n` +
          `CO₂ Saved: ${co2SavedLb.toFixed(2)} lb\n` +
          `Message: ${data.message}`
        );
      } catch (e) {
        setPostResult(`✅ HTTP ${response.status}\n\n${responseText}`);
      }
    } catch (error: any) {
      console.error("[DIAGNOSTICS] Error:", error);
      setPostResult(`❌ Error: ${error?.message || "Unknown error"}`);
    } finally {
      setTesting({ ...testing, post: false });
    }
  };

  const copyToClipboard = (text: string) => {
    Alert.alert("Info", `URL: ${text}\n\nCopy this manually if needed.`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Agent Diagnostics</Text>
      </View>

      {/* Configuration Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuration</Text>

        <View style={styles.infoBox}>
          <Text style={styles.label}>AGENT_URL:</Text>
          <Pressable onPress={() => copyToClipboard(AGENT_URL)}>
            <Text
              style={[
                styles.value,
                !AGENT_URL && styles.errorText,
              ]}
              selectable
            >
              {AGENT_URL || "(not set)"}
            </Text>
          </Pressable>
        </View>

        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {configError}</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.helpText}>
            Expected format:{"\n"}
            https://abc123.ngrok-free.dev
          </Text>
          <Text style={styles.helpText}>
            {"\n"}After editing .env, restart Expo:{"\n"}
            npx expo start -c
          </Text>
        </View>
      </View>

      {/* Health Check Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GET /health</Text>

        <View style={styles.buttonContainer}>
          <Button
            title={testing.health ? "Testing..." : "Test GET /health"}
            onPress={testHealth}
            disabled={testing.health || !AGENT_URL}
          />
        </View>

        {testing.health && <ActivityIndicator style={styles.loader} />}

        {healthResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText} selectable>
              {healthResult}
            </Text>
          </View>
        )}

        <Text style={styles.helpText}>
          This tests if the agent is reachable and responding.
        </Text>
      </View>

      {/* ASI:One Config Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GET /debug/asi (ASI:One Config)</Text>

        <View style={styles.buttonContainer}>
          <Button
            title={testing.asi ? "Checking..." : "Check ASI:One Configuration"}
            onPress={testAsiConfig}
            disabled={testing.asi || !AGENT_URL}
          />
        </View>

        {testing.asi && <ActivityIndicator style={styles.loader} />}

        {asiResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText} selectable>
              {asiResult}
            </Text>
          </View>
        )}

        <Text style={styles.helpText}>
          Checks if ASI:One AI is configured on the backend for CO₂ calculations.
        </Text>
      </View>

      {/* POST Test Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>POST /co2/savings</Text>

        <View style={styles.buttonContainer}>
          <Button
            title={testing.post ? "Testing..." : "Test POST /co2/savings"}
            onPress={testPost}
            disabled={testing.post || !AGENT_URL}
          />
        </View>

        {testing.post && <ActivityIndicator style={styles.loader} />}

        {postResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText} selectable>
              {postResult}
            </Text>
          </View>
        )}

        <Text style={styles.helpText}>
          This tests the CO₂ calculation endpoint with a sample bike trip.
          Should show agent_meta.engine = "asi_one" if ASI:One is working.
        </Text>
      </View>

      {/* Troubleshooting Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Troubleshooting</Text>

        <View style={styles.infoBox}>
          <Text style={styles.helpText}>
            ✓ Verify FastAPI is running:{"\n"}
            uvicorn eco_advisor_agent:app --reload --port 8000
          </Text>

          <Text style={[styles.helpText, { marginTop: 12 }]}>
            ✓ Verify ngrok tunnel is active:{"\n"}
            ngrok http 8000{"\n"}
            Check: http://127.0.0.1:4040
          </Text>

          <Text style={[styles.helpText, { marginTop: 12 }]}>
            ✓ URL must start with https:// (iOS requires it)
          </Text>

          <Text style={[styles.helpText, { marginTop: 12 }]}>
            ✓ Test from terminal:{"\n"}
            curl https://YOUR_URL/health
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: "#3b82f6",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: "#1e293b",
    fontFamily: "monospace",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  helpText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  loader: {
    marginVertical: 12,
  },
  resultBox: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  resultText: {
    fontSize: 13,
    fontFamily: "monospace",
    color: "#334155",
  },
});
