"use client";

import { useEffect } from "react";
import { clearClientSession, loginRedirectPath, validateClientSession } from "../lib/clientSession";

function isProtectedPath(pathname: string) {
  return pathname === "/account" || pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/routes");
}

export default function SessionWatcher() {
  useEffect(() => {
    let running = false;
    const check = async () => {
      if (running || !window.sessionStorage.getItem("routepilot.accessToken")) return;
      running = true;
      const valid = await validateClientSession();
      running = false;
      if (valid !== false) return;
      clearClientSession();
      if (isProtectedPath(window.location.pathname) && !window.location.pathname.startsWith("/auth/")) window.location.assign(loginRedirectPath());
    };
    void check();
    const interval = window.setInterval(() => void check(), 60_000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", check); };
  }, []);
  return null;
}
