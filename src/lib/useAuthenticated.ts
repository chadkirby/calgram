import { useIsAuthenticated } from "jazz-tools/react";

/**
 * Centralized auth state for the UI and router.
 *
 * Behavior:
 * - In normal runtime, returns Jazz's useIsAuthenticated().
 * - In E2E, when VITE_E2E_BYPASS_AUTH === "true", always returns true.
 *
 * This avoids scattering import.meta.env checks across components and makes
 * the auth gate mockable/stubbable from a single place.
 */
export function useAuthenticated(): boolean {
  const real = useIsAuthenticated();
  const bypass = String(import.meta.env.VITE_E2E_BYPASS_AUTH || "") === "true";
  return bypass ? true : real;
}
