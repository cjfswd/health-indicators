import type { RequestHandler } from "@builder.io/qwik-city";
import { clearSession } from "~/lib/auth";

/**
 * POST /api/auth/logout/
 * Clears the session cookie and redirects to login.
 */
export const onPost: RequestHandler = async ({ cookie, redirect }) => {
  clearSession(cookie);
  throw redirect(302, "/login/");
};
