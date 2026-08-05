import { apiGet, apiPost, ensureCsrf, ApiError, silentRefresh } from "./api";
import {
  roleToPanel,
  setStoredAuthPanel,
  resolveClientAuthPanel,
  type AuthPanel,
} from "./auth-panel";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions?: string[];
}

export interface PortalAccount {
  id: string;
  whatsapp: string;
  customerId: string;
  personName?: string;
  companyName?: string;
  role: string;
  permissions?: string[];
}

export interface MeResponse {
  audience: "INTERNAL" | "PORTAL";
  id: string;
  email?: string;
  fullName?: string;
  role?: string;
  permissions?: string[];
  whatsapp?: string;
  customerId?: string;
  personName?: string;
  companyName?: string;
  panel?: AuthPanel | null;
  profileImage?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface PortalLoginCredentials {
  whatsapp: string;
  password: string;
}

export async function loginInternal(credentials: LoginCredentials) {
  const result = await apiPost<{ user: AuthUser; panel?: AuthPanel }>(
    "/auth/login",
    credentials
  );
  const panel = result.panel || roleToPanel(result.user.role);
  if (panel) setStoredAuthPanel(panel);
  return result;
}

export async function loginPortal(credentials: PortalLoginCredentials) {
  const result = await apiPost<{ account: PortalAccount; panel?: AuthPanel }>(
    "/auth/portal/login",
    credentials
  );
  setStoredAuthPanel("portal");
  return result;
}

export async function logout() {
  await ensureCsrf();
  const panel = resolveClientAuthPanel();
  const result = await apiPost<{ loggedOut: boolean }>("/auth/logout");
  // Keep other tabs’ panels; only clear this tab’s binding.
  if (panel) setStoredAuthPanel(null);
  return result;
}

/**
 * Returns the current session for this tab’s panel, or null when unauthenticated.
 */
export async function getMe(): Promise<MeResponse | null> {
  try {
    const me = await apiGet<MeResponse>("/auth/me");
    if (me?.panel) setStoredAuthPanel(me.panel);
    else if (me?.role) {
      const panel = roleToPanel(me.role);
      if (panel) setStoredAuthPanel(panel);
    }
    return me;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await silentRefresh();
      if (!refreshed) return null;
      try {
        const me = await apiGet<MeResponse>("/auth/me");
        if (me?.panel) setStoredAuthPanel(me.panel);
        else if (me?.role) {
          const panel = roleToPanel(me.role);
          if (panel) setStoredAuthPanel(panel);
        }
        return me;
      } catch {
        return null;
      }
    }
    throw err;
  }
}

export async function refreshSession() {
  const ok = await silentRefresh();
  if (!ok) throw new ApiError("نشست منقضی شده است", 401, "SESSION_INVALID");
  return { refreshed: true };
}

export function isInternalUser(me: MeResponse | null | undefined): me is MeResponse & {
  audience: "INTERNAL";
  fullName: string;
} {
  return !!me && me.audience === "INTERNAL";
}

export function isPortalUser(me: MeResponse | null | undefined): me is MeResponse & {
  audience: "PORTAL";
} {
  return !!me && me.audience === "PORTAL";
}

export function getDisplayName(me: MeResponse | null | undefined): string {
  if (!me) return "";
  if (me.audience === "INTERNAL") return me.fullName || me.email || "";
  return me.personName || me.companyName || me.whatsapp || "";
}
