import axios, { AxiosError } from "axios";
import { get, ref } from "firebase/database";
import { db } from "../../firebaseConfig";
import { AGENT_ADDRESS, AGENT_URL } from "./config";

// Re-export AGENT_ADDRESS for convenience
export { AGENT_ADDRESS };

/**
 * Action types supported by the eco advisor agent
 */
export type EcoAction = "bike_trip" | "walk_trip" | "recycled" | "ate_vegetarian";

/**
 * Material recycled
 */
export interface RecycledMaterial {
  type: string;
  count?: number;
  weight_g?: number;
}

/**
 * Counterfactual meat for vegetarian meal
 */
export interface Counterfactual {
  meat: string;
  portion_g: number;
}

/**
 * Request payload for CO2 savings calculation
 */
export interface Co2SavingsRequest {
  user_id: string;
  action: EcoAction;
  distance_mi?: number;
  materials?: RecycledMaterial[];
  counterfactual?: Counterfactual;
}

/**
 * Response from the eco advisor agent
 */
export interface Co2SavingsResponse {
  user_id: string;
  action: string;
  co2_saved_kg: number;
  message: string;
  agent_meta?: {
    engine: string;
    model: string;
    timestamp: number;
  };
}

/**
 * Convert miles to kilometers for the agent backend, which expects km.
 * Keep UI in miles but send km to the agent.
 */
const milesToKm = (mi: number) => mi * 1.60934;

/**
 * Get the agent URL from environment or Firebase config
 */
async function getAgentUrl(): Promise<string> {
  // First try environment variable (from config)
  if (AGENT_URL && (AGENT_URL.startsWith("https://") || AGENT_URL.startsWith("http://"))) {
    return AGENT_URL.replace(/\/+$/, ""); // Remove trailing slashes
  }

  // Fallback: try to load from Firebase config
  try {
    console.log("[AGENT_CLIENT] No valid env URL, trying Firebase /config/agent_url");
    const configRef = ref(db, "/config/agent_url");
    const snapshot = await get(configRef);
    if (snapshot.exists()) {
      const fbUrl = snapshot.val() as string;
      console.log("[AGENT_CLIENT] Loaded agent URL from Firebase:", fbUrl);
      return fbUrl.replace(/\/+$/, "");
    }
  } catch (error) {
    console.warn("[AGENT_CLIENT] Failed to load agent URL from Firebase:", error);
  }

  throw new Error(
    "Agent URL not configured. Please set EXPO_PUBLIC_AGENT_URL in .env (must start with https://) " +
    "or set /config/agent_url in Firebase. Restart Expo with: npx expo start -c"
  );
}

/**
 * Call the eco advisor agent to calculate CO2 savings
 * @param request - The request payload with user_id, action, and optional distance
 * @returns The agent's response with CO2 savings and message
 * @throws Error if the agent call fails
 */
export async function getCo2Savings(
  request: Co2SavingsRequest
): Promise<Co2SavingsResponse> {
  try {
    const agentUrl = await getAgentUrl();
    const endpoint = `${agentUrl}/co2/savings`;
    const distanceKm =
      typeof request.distance_mi === "number" && !Number.isNaN(request.distance_mi)
        ? milesToKm(request.distance_mi)
        : undefined;

    const payload: any = {
      user_id: request.user_id,
      action: request.action,
      materials: request.materials,
      counterfactual: request.counterfactual,
    };
    if (typeof request.distance_mi === "number" && !Number.isNaN(request.distance_mi)) {
      payload.distance_mi = request.distance_mi;        // forward-compat
    }
    if (typeof distanceKm === "number") {
      payload.distance_km = distanceKm;                // required by current agent
    }

    console.log("[AGENT_CLIENT] Calling:", endpoint);
    console.log("[AGENT_CLIENT] Payload:", JSON.stringify(payload));

    const response = await axios.post<Co2SavingsResponse>(
      endpoint,
      payload,
      {
        timeout: 10000, // 10 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[AGENT_CLIENT] Success:", response.status, response.data);
    return response.data;
  } catch (error) {
    console.error("[AGENT_CLIENT] Error:", error);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Timeout
      if (axiosError.code === "ECONNABORTED" || axiosError.message.includes("timeout")) {
        throw new Error(
          "Request timed out after 10 seconds. " +
          "Please check:\n1. Agent is running (uvicorn eco_advisor_agent:app)\n" +
          "2. ngrok tunnel is active\n" +
          "3. Network connection is stable"
        );
      }

      // Server responded with error status
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;

        // Check if backend returned structured error
        if (data?.detail && typeof data.detail === "object") {
          const errorDetail = data.detail;
          const errorMsg = errorDetail.error || "AGENT_ERROR";
          const details = errorDetail.details || "No details provided";
          const hint = errorDetail.hint || "";

          console.error("[AGENT_CLIENT] Backend error:", errorMsg);
          console.error("[AGENT_CLIENT] Details:", details);
          if (hint) console.error("[AGENT_CLIENT] Hint:", hint);

          // Create enhanced error with backend details attached
          const error = new Error(errorMsg) as any;
          error.response = { data: { detail: errorDetail } };
          throw error;
        }

        if (status === 502 || status === 503) {
          throw new Error(
            `Agent server unreachable (${status} Bad Gateway). ` +
            "Please verify:\n1. FastAPI is running on port 8000\n" +
            "2. ngrok is forwarding to localhost:8000"
          );
        }

        if (status === 404) {
          throw new Error(
            "Endpoint not found (404). " +
            "Verify agent URL is correct and includes the base domain only (no /co2/savings)"
          );
        }

        throw new Error(
          `Agent returned error ${status}: ${data?.message || data?.detail || "Unknown error"}`
        );
      }

      // Request made but no response (network error)
      if (axiosError.request) {
        throw new Error(
          "Cannot reach the agent. Please check:\n" +
          "1. EXPO_PUBLIC_AGENT_URL is set to your ngrok HTTPS URL\n" +
          "2. ngrok tunnel is running (check http://127.0.0.1:4040)\n" +
          "3. URL starts with https:// (iOS requires HTTPS)\n" +
          "4. Network connection is available"
        );
      }
    }

    // Generic error
    throw new Error(
      `Failed to calculate CO2 savings: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Test agent connectivity with a health check
 * @returns true if agent is reachable, false otherwise
 */
export async function testAgentHealth(): Promise<{ success: boolean; message: string }> {
  try {
    const agentUrl = await getAgentUrl();
    const endpoint = `${agentUrl}/health`;

    console.log("[AGENT_CLIENT] Testing health:", endpoint);

    const response = await axios.get(endpoint, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200 && response.data?.status === "ok") {
      return {
        success: true,
        message: `✅ Agent is healthy (${response.status})`,
      };
    }

    return {
      success: false,
      message: `⚠️ Unexpected response: ${JSON.stringify(response.data)}`,
    };
  } catch (error) {
    console.error("[AGENT_CLIENT] Health check failed:", error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
        return {
          success: false,
          message: `❌ Server error: ${error.response.status}`,
        };
      }
      if (error.request) {
        return {
          success: false,
          message: "❌ Cannot reach agent. Check ngrok URL and network.",
        };
      }
    }

    return {
      success: false,
      message: `❌ ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
