"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { accessTokenKey, authFetch, SessionExpiredError } from "../lib/clientSession";
import { activePlan, type AccessPlan } from "../lib/plan-access";
import { useCurrentLocale } from "../lib/useLocale";

type State = { subscription: AccessPlan | null; state: "loading" | "ready" | "signed-out" | "error" };
const Context = createContext<State>({ subscription: null, state: "loading" });

export function PlanAccessProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<State>({ subscription: null, state: "loading" });
  useEffect(() => {
    let generation = 0;
    let disposed = false;
    const sync = async () => {
      const request = ++generation;
      if (!sessionStorage.getItem(accessTokenKey)) { setValue({ subscription: null, state: "signed-out" }); return; }
      // Do not retain another session's plan while validating a changed login.
      setValue({ subscription: null, state: "loading" });
      try {
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/me/subscription`, { cache: "no-store" });
        if (!response.ok) throw new Error("Plan unavailable");
        const subscription = await response.json() as AccessPlan;
        if (!disposed && request === generation) setValue({ subscription, state: "ready" });
      } catch (error) {
        if (!disposed && request === generation) setValue({ subscription: null, state: error instanceof SessionExpiredError ? "signed-out" : "error" });
      }
    };
    void sync();
    const listener = () => { void sync(); };
    const timer = window.setInterval(listener, 60000);
    window.addEventListener("routepilot-auth-change", listener);
    window.addEventListener("focus", listener);
    return () => { disposed = true; ++generation; clearInterval(timer); window.removeEventListener("routepilot-auth-change", listener); window.removeEventListener("focus", listener); };
  }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePlanAccess() {
  const value = useContext(Context);
  return { ...value, plan: activePlan(value.subscription) };
}

export default function PlanAccessLink({ unlock = false }: { unlock?: boolean }) {
  const { state, plan } = usePlanAccess();
  const nl = useCurrentLocale() === "nl";
  const paid = plan !== "Free";
  const uncertain = state === "loading" || state === "error";
  const label = paid ? `${plan} ${nl ? "actief" : "active"}` : uncertain ? (nl ? "Mijn toegang" : "My access") : unlock ? (nl ? "Volledige toegang ontgrendelen" : "Unlock full access") : (nl ? "Bekijk pakketten" : "View plans");
  return <Link className="button button-small" href={paid || uncertain ? "/account" : "/#pricing"}>{label} <span>↗</span></Link>;
}
