/**
 * Runtime configuration for EcoTrack
 *
 * IMPORTANT: Only EXPO_PUBLIC_* environment variables are available at runtime.
 * After editing .env, restart Expo with: npx expo start -c
 */

export const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL ?? "";
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Fetch.ai uAgent address for direct agent-to-agent communication
 * This is the address of the mailbox agent that can receive messages via the Fetch.ai network
 */
export const AGENT_ADDRESS = "agent1q058rynsc8c4wd7gtdlfz58gez0yx83vzalxt3s7d25zv49usuzg7t9cmsk";

// Log configuration on module load (dev only)
if (__DEV__) {
  console.log("[CONFIG] AGENT_URL:", AGENT_URL || "(not set)");
  console.log("[CONFIG] AGENT_ADDRESS:", AGENT_ADDRESS);
  console.log("[CONFIG] GOOGLE_MAPS_API_KEY:", GOOGLE_MAPS_API_KEY ? "***SET***" : "(not set)");
}

// Warn if critical config is missing
if (!AGENT_URL) {
  console.warn(
    "[CONFIG] ⚠️ EXPO_PUBLIC_AGENT_URL is not set at runtime. " +
    "Please set it in .env and restart Expo with: npx expo start -c"
  );
}

/**
 * Validate that the agent URL is properly configured
 * @returns true if valid, false otherwise
 */
export function isAgentUrlValid(): boolean {
  return AGENT_URL.startsWith("https://") || AGENT_URL.startsWith("http://");
}

/**
 * Get a user-friendly error message for configuration issues
 */
export function getConfigErrorMessage(): string | null {
  if (!AGENT_URL) {
    return "Agent URL not configured. Please set EXPO_PUBLIC_AGENT_URL in .env and restart Expo.";
  }

  if (!AGENT_URL.startsWith("https://") && !AGENT_URL.startsWith("http://")) {
    return `Invalid agent URL: "${AGENT_URL}". Must start with https:// or http://`;
  }

  return null;
}
