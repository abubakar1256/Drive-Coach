"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { accessTokenKey, authFetch, SessionExpiredError } from "./clientSession";
import { canUseAIChat, type ChatEntitlements } from "./aiChat";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type AccessState = { status: "checking" | "guest" | "locked" | "allowed" | "unavailable"; expiresAt?: string | null };

export function useAIChatAccess(open: boolean) {
  const [access, setAccess] = useState<AccessState>({ status: "checking" });
  const requestVersion = useRef(0);

  const checkAccess = useCallback(async (showLoading = true) => {
    const version = ++requestVersion.current;
    if (!window.sessionStorage.getItem(accessTokenKey)) { setAccess({ status: "guest" }); return; }
    if (showLoading) setAccess({ status: "checking" });
    try {
      const response = await authFetch(`${API}/me/entitlements`, { cache: "no-store" });
      if (!response.ok) throw new Error("Access check failed");
      const payload = await response.json() as ChatEntitlements | null;
      if (version !== requestVersion.current) return;
      setAccess({ status: payload && canUseAIChat(payload) ? "allowed" : "locked", expiresAt: payload?.expiresAt });
    } catch (error) {
      if (version !== requestVersion.current) return;
      setAccess({ status: error instanceof SessionExpiredError ? "guest" : "unavailable" });
    }
  }, []);

  useEffect(() => {
    if (!open) { ++requestVersion.current; setAccess({ status: "checking" }); return; }
    void checkAccess();
    const authChanged = () => void checkAccess();
    const refresh = () => void checkAccess(false);
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("routepilot-auth-change", authChanged);
    window.addEventListener("focus", refresh);
    return () => {
      ++requestVersion.current;
      window.clearInterval(interval);
      window.removeEventListener("routepilot-auth-change", authChanged);
      window.removeEventListener("focus", refresh);
    };
  }, [open, checkAccess]);

  useEffect(() => {
    if (!open || access.status !== "allowed" || !access.expiresAt) return;
    const timeout = window.setTimeout(() => { setAccess({ status: "checking" }); void checkAccess(); },
      Math.min(Math.max(0, Date.parse(access.expiresAt) - Date.now()), 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [open, access.status, access.expiresAt, checkAccess]);

  return { access, checkAccess };
}
