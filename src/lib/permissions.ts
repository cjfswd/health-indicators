/**
 * Permission helpers for role-based feature gating.
 *
 * Admin email has access to:
 * - Auditoria page
 * - Delete actions (patients, events)
 */

const ADMIN_EMAIL = "ti@healthmaiscuidados.com";

export function isAdmin(email: string | null | undefined): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export { ADMIN_EMAIL };
