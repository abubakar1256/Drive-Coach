"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";
import { navLabel, type NavKey } from "../lib/navCopy";

type MenuLink = { href: string; label: string };

function navKeyForLink(link: MenuLink): NavKey | null {
  if (link.href.includes("#how-it-works")) return "howItWorks";
  if (link.href === "/centres" || link.href === "#centres") return "testCentres";
  if (link.href.includes("#pricing")) return "pricing";
  if (link.href.includes("#faq")) return "faq";
  if (link.href === "/blog") return "guides";
  if (link.href === "/dashboard") return "dashboard";
  if (link.href === "/account") return "account";
  if (link.href === "/auth/login") return "logIn";
  return null;
}

export default function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const menuId = "mobile-navigation-menu";

  useEffect(() => {
    const sync = () => {
      setSignedIn(Boolean(window.sessionStorage.getItem("routepilot.accessToken")));
      const stored = window.localStorage.getItem("routepilot.locale");
      if (isLocale(stored)) setLocale(stored);
    };
    sync();
    window.addEventListener("routepilot-locale-change", sync);
    window.addEventListener("routepilot-auth-change", sync);
    return () => {
      window.removeEventListener("routepilot-locale-change", sync);
      window.removeEventListener("routepilot-auth-change", sync);
    };
  }, []);

  async function logout() {
    const refreshToken = window.sessionStorage.getItem("routepilot.refreshToken");
    if (refreshToken) await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    window.sessionStorage.removeItem("routepilot.accessToken");
    window.sessionStorage.removeItem("routepilot.refreshToken");
    window.sessionStorage.removeItem("routepilot.user");
    window.dispatchEvent(new Event("routepilot-auth-change"));
    setOpen(false);
    window.location.assign("/");
  }

  const translatedLinks = links.map((link) => {
    const key = navKeyForLink(link);
    return key ? { ...link, label: navLabel(locale, key) } : link;
  });
  const visibleLinks = signedIn ? translatedLinks.map((link) => link.href === "/auth/login" ? { href: "/account", label: navLabel(locale, "account") } : link) : translatedLinks;

  return (
    <div className="mobile-menu">
      <button className="menu-button" type="button" aria-label={open ? (locale === "nl" ? "Navigatiemenu sluiten" : "Close navigation menu") : (locale === "nl" ? "Navigatiemenu openen" : "Open navigation menu")} aria-controls={menuId} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "×" : "☰"}
      </button>
      {open && (
        <div className="mobile-menu-panel" id={menuId}>
          {visibleLinks.map((link) => <a href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
          {signedIn && <button className="mobile-menu-logout" type="button" onClick={() => void logout()}>{locale === "nl" ? "Uitloggen" : "Log out"}</button>}
        </div>
      )}
    </div>
  );
}
