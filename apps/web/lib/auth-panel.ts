/**
 * Panel-scoped auth identity for concurrent Manager / Editor / Portal sessions.
 * sessionStorage is per-tab, so each tab keeps its own panel binding.
 */

export type AuthPanel =
  | "manager"
  | "editor"
  | "sales"
  | "narrator"
  | "portal";

export const AUTH_PANEL_HEADER = "X-APEX-Panel";
export const AUTH_PANEL_STORAGE_KEY = "apex_auth_panel";

const PANELS: AuthPanel[] = [
  "manager",
  "editor",
  "sales",
  "narrator",
  "portal",
];

export function isAuthPanel(value: unknown): value is AuthPanel {
  return typeof value === "string" && PANELS.includes(value as AuthPanel);
}

/** Map role code → cookie/panel namespace. */
export function roleToPanel(role: string | null | undefined): AuthPanel | null {
  switch (String(role || "").toUpperCase()) {
    case "ADMIN":
    case "MANAGER":
    case "FINANCE":
      return "manager";
    case "EDITOR":
      return "editor";
    case "SALES":
      return "sales";
    case "NARRATOR":
      return "narrator";
    case "CUSTOMER":
      return "portal";
    default:
      return null;
  }
}

/**
 * Infer panel from URL when unambiguous.
 * Shared routes (/projects, /crm, …) return null — use sessionStorage / markers.
 */
export function panelFromPathname(pathname: string | null | undefined): AuthPanel | null {
  if (!pathname) return null;
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return "portal";
  if (
    pathname.startsWith("/manager") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/settings")
  ) {
    return "manager";
  }
  if (pathname.startsWith("/editor")) return "editor";
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/narrator")) return "narrator";
  return null;
}

export function getStoredAuthPanel(): AuthPanel | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(AUTH_PANEL_STORAGE_KEY);
    return isAuthPanel(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredAuthPanel(panel: AuthPanel | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!panel) {
      window.sessionStorage.removeItem(AUTH_PANEL_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(AUTH_PANEL_STORAGE_KEY, panel);
  } catch {
    /* private mode / blocked storage */
  }
}

/** Panels that currently have a session marker cookie (set by API on login/refresh). */
export function listMarkedAuthPanels(): AuthPanel[] {
  if (typeof document === "undefined") return [];
  return PANELS.filter((panel) =>
    document.cookie.split(";").some((part) => {
      const [name] = part.trim().split("=");
      return name === `apex_has_${panel}`;
    }),
  );
}

/**
 * Active panel for this tab’s API calls.
 * Prefer unambiguous path → per-tab sessionStorage → single marked cookie.
 */
export function resolveClientAuthPanel(
  pathname?: string | null,
): AuthPanel | null {
  const fromPath = panelFromPathname(
    pathname ??
      (typeof window !== "undefined" ? window.location.pathname : null),
  );
  if (fromPath) return fromPath;

  const stored = getStoredAuthPanel();
  if (stored) return stored;

  const marked = listMarkedAuthPanels();
  if (marked.length === 1) return marked[0];
  return null;
}
