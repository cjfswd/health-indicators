import type { RequestHandler } from "@builder.io/qwik-city";
import { verifyGoogleToken, setSession } from "~/lib/auth";

/**
 * POST /api/auth/google/
 * Receives a Google ID token, verifies it, checks domain, and sets session cookie.
 */
export const onPost: RequestHandler = async ({ json, parseBody, cookie, env }) => {
  const body = (await parseBody()) as { credential?: string } | null;
  const idToken = body?.credential;

  if (!idToken) {
    json(400, { error: "Token não fornecido." });
    return;
  }

  const clientId = env.get("GOOGLE_CLIENT_ID") || import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const allowedDomain = env.get("ALLOWED_DOMAIN") || "healthmaiscuidados.com";

  const payload = await verifyGoogleToken(idToken, clientId);

  if (!payload) {
    json(401, { error: "Token inválido." });
    return;
  }

  // Check domain restriction
  if (allowedDomain && payload.hd !== allowedDomain) {
    json(403, {
      error: `Acesso restrito a contas @${allowedDomain}.`,
    });
    return;
  }

  setSession(cookie, {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });

  json(200, { success: true, email: payload.email, name: payload.name });
};
