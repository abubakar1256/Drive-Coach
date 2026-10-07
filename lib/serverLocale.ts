import { cookies } from "next/headers";
import { isLocale, type Locale } from "./i18n";

export function getServerLocale(): Locale {
  const value = cookies().get("routepilot.locale")?.value ?? null;
  return isLocale(value) ? value : "en";
}
