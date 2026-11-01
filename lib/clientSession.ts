export const accessTokenKey = "routepilot.accessToken";
export const refreshTokenKey = "routepilot.refreshToken";
export const userKey = "routepilot.user";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
let refreshPromise: Promise<string | null> | null = null;

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please log in again.");
    this.name = "SessionExpiredError";
  }
}

function notifyAuthChange() {
  window.dispatchEvent(new Event("routepilot-auth-change"));
}

function currentOwner() {
  try { const user = JSON.parse(window.sessionStorage.getItem(userKey) ?? "null"); return typeof user?.id === "string" ? user.id : null; }
  catch { return null; }
}

export function clearClientSession() {
  window.sessionStorage.removeItem(accessTokenKey);
  window.sessionStorage.removeItem(refreshTokenKey);
  window.sessionStorage.removeItem(userKey);
  notifyAuthChange();
}

export async function refreshClientSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshClientSessionInternal();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshClientSessionInternal() {
  const refreshToken = window.sessionStorage.getItem(refreshTokenKey);
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const payload = await response.json().catch(() => null);
    // A late refresh from an old login must not replace or clear a newer login.
    if (window.sessionStorage.getItem(refreshTokenKey) !== refreshToken) return null;
    if (!response.ok || !payload?.accessToken) {
      clearClientSession();
      return null;
    }
    window.sessionStorage.setItem(accessTokenKey, payload.accessToken as string);
    if (payload.refreshToken) window.sessionStorage.setItem(refreshTokenKey, payload.refreshToken as string);
    // Rotating credentials for the same account is not an account change: do
    // not tear down a consented drive or erase an unsaved feedback checklist.
    window.dispatchEvent(new Event("routepilot-session-refresh"));
    return payload.accessToken as string;
  } catch {
    return null;
  }
}

function withBearer(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const owner = currentOwner();
  let token = window.sessionStorage.getItem(accessTokenKey);
  if (!token) throw new SessionExpiredError();
  let response = await fetch(input, withBearer(init, token));
  if (currentOwner() !== owner) throw new SessionExpiredError();
  if (response.status !== 401) return response;
  token = await refreshClientSession();
  if (!token || currentOwner() !== owner) throw new SessionExpiredError();
  response = await fetch(input, withBearer(init, token));
  if (currentOwner() !== owner) throw new SessionExpiredError();
  if (response.status === 401) {
    clearClientSession();
    throw new SessionExpiredError();
  }
  return response;
}

export async function validateClientSession(): Promise<boolean | null> {
  if (!window.sessionStorage.getItem(accessTokenKey)) return false;
  try {
    const response = await authFetch(`${API}/auth/me`);
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload) window.sessionStorage.setItem(userKey, JSON.stringify(payload));
      return true;
    }
    return null;
  } catch (error) {
    if (error instanceof SessionExpiredError) return false;
    return null;
  }
}

export function loginRedirectPath() {
  return `/auth/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
}
