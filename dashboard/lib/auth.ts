import { createHash } from "node:crypto";

export const AUTH_COOKIE_NAME = "hunt_dashboard_token";

export function getExpectedSecret(): string {
  return process.env.DASHBOARD_SECRET_KEY || "hunter2026";
}

export function generateTokenForSecret(secret: string): string {
  return createHash("sha256").update(`hunt-secret:${secret}`).digest("hex");
}

export function isValidSecret(secret: string): boolean {
  if (!secret) return false;
  return secret.trim() === getExpectedSecret().trim();
}

export function isValidToken(token: string): boolean {
  if (!token) return false;
  const expected = generateTokenForSecret(getExpectedSecret());
  return token === expected;
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((parts) => parts.length === 2)
      .map(([k, v]) => [decodeURIComponent(k!), decodeURIComponent(v!)])
  );
}

export function isRequestAuthenticated(requestHeaders: Headers): boolean {
  // If DASHBOARD_SECRET_KEY is explicitly set to empty or false, allow dev mode
  if (process.env.DASHBOARD_AUTH_DISABLED === "true") return true;

  const cookieHeader = requestHeaders.get("cookie");
  const cookies = parseCookies(cookieHeader);
  const token = cookies[AUTH_COOKIE_NAME];
  if (token && isValidToken(token)) return true;

  // Also check Bearer header or x-dashboard-key
  const authHeader = requestHeaders.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (isValidToken(bearerToken) || isValidSecret(bearerToken)) return true;
  }

  const customKey = requestHeaders.get("x-dashboard-key");
  if (customKey && isValidSecret(customKey)) return true;

  return false;
}
