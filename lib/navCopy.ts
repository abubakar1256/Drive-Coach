import type { Locale } from "./i18n";

export type NavKey =
  | "howItWorks"
  | "testCentres"
  | "pricing"
  | "faq"
  | "guides"
  | "dashboard"
  | "account"
  | "logIn"
  | "viewPlans"
  | "findRoute"
  | "exploreRoutes"
  | "unlockFullAccess";

export const navCopy: Record<Locale, Record<NavKey, string>> = {
  en: {
    howItWorks: "How it works",
    testCentres: "Test centres",
    pricing: "Pricing",
    faq: "FAQ",
    guides: "Guides",
    dashboard: "Dashboard",
    account: "My account",
    logIn: "Log in",
    viewPlans: "View plans",
    findRoute: "Find a route",
    exploreRoutes: "Explore routes",
    unlockFullAccess: "Unlock full access",
  },
  nl: {
    howItWorks: "Hoe werkt het",
    testCentres: "Examencentra",
    pricing: "Prijzen",
    faq: "Veelgestelde vragen",
    guides: "Gidsen",
    dashboard: "Dashboard",
    account: "Mijn account",
    logIn: "Inloggen",
    viewPlans: "Bekijk plannen",
    findRoute: "Vind een route",
    exploreRoutes: "Routes bekijken",
    unlockFullAccess: "Ontgrendel volledige toegang",
  },
};

export function navLabel(locale: Locale, key: NavKey) {
  return navCopy[locale][key];
}
