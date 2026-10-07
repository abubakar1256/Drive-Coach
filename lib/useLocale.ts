"use client";

import { useEffect, useState } from "react";
import { directoryMessages, isLocale, messages, type DirectoryMessages, type Locale, type RoutePilotMessages } from "./i18n";
import { siteCopy, type SiteCopy } from "./siteCopy";

export function useLocaleMessages(): RoutePilotMessages["copy"] & DirectoryMessages {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const sync = () => { const value = window.localStorage.getItem("routepilot.locale"); if (isLocale(value)) setLocale(value); };
    sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);
  return { ...messages[locale].copy, ...directoryMessages[locale] };
}

export function useSiteCopy(): SiteCopy {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const sync = () => { const value = window.localStorage.getItem("routepilot.locale"); if (isLocale(value)) setLocale(value); };
    sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);
  return siteCopy[locale];
}

export function useCurrentLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const sync = () => { const value = window.localStorage.getItem("routepilot.locale"); if (isLocale(value)) setLocale(value); };
    sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);
  return locale;
}
