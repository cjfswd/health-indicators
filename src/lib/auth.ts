/**
 * Auth utilities for Google Sign-In.
 *
 * Uses Google Identity Services (GSI) on the client and
 * verifies the ID token server-side via Google's tokeninfo endpoint.
 *
 * Session is stored as a JSON cookie: { email, name, picture }.
 */

export interface UserSession {
  email: string;
  name: string;
  picture: string;
}

const COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Verify a Google ID token by calling Google's tokeninfo endpoint.
 * Returns the decoded payload or null if invalid.
 */
export async function verifyGoogleToken(
  idToken: string,
  clientId: string
): Promise<{ email: string; name: string; picture: string; hd?: string } | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return null;

    const payload = await res.json();

    // Verify audience matches our client ID
    if (payload.aud !== clientId) return null;

    return {
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture || "",
      hd: payload.hd, // hosted domain (e.g. "healthmaiscuidados.com")
    };
  } catch {
    return null;
  }
}

/**
 * Read user session from the cookie.
 */
export function getSession(cookie: any): UserSession | null {
  const raw = cookie.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed.email && parsed.name) return parsed as UserSession;
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie.
 */
export function setSession(cookie: any, user: UserSession): void {
  cookie.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(user)), {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false, // needs to be readable for logout redirect
    sameSite: "lax",
  });
}

/**
 * Clear the session cookie.
 */
export function clearSession(cookie: any): void {
  cookie.delete(COOKIE_NAME, { path: "/" });
}
