/**
 * Temporary local-only login. Remove this file and /api/dev-session before production.
 * Credentials are checked only on the server (see /api/dev-session).
 */

export const TEMP_DEV_EMAIL = "demo@wheeler.local";

/** Temporary password — server-validated; also shown on login for local use only. */
export const TEMP_DEV_PASSWORD = "WheelerDemo2026!";

/** HttpOnly cookie name */
export const TEMP_DEV_SESSION_COOKIE = "wheeler_temp_dev";

/** Opaque session marker (not a secret auth token; still replace for prod). */
export const TEMP_DEV_SESSION_TOKEN = "wheeler-dev-temp-v1";

export function tempDevLoginValid(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === TEMP_DEV_EMAIL.toLowerCase() &&
    password === TEMP_DEV_PASSWORD
  );
}

export function tempDevSessionValid(cookieValue: string | undefined): boolean {
  return cookieValue === TEMP_DEV_SESSION_TOKEN;
}
