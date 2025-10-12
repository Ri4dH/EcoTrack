import { auth } from "../../firebaseConfig";

/**
 * Get the current user ID
 * For now, this uses Firebase anonymous auth.
 * Falls back to a demo user if no auth is available.
 *
 * @returns The current user ID
 */
export function getUserId(): string {
  const uid = auth.currentUser?.uid;
  if (uid) {
    return uid;
  }

  // Fallback for cases where auth hasn't initialized yet
  // In production, you might want to throw an error instead
  console.warn("No authenticated user found, using demo-user");
  return "demo-user";
}

/**
 * Check if a user is authenticated
 * @returns True if a user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!auth.currentUser;
}
