export const locales = ["en", "nl"] as const;
export type Locale = (typeof locales)[number];

export type RoutePilotMessages = {
  language: string;
  dashboard: string;
  centres: string;
  pricing: string;
  account: string;
  explore: string;
  copy: {
    backHome: string;
    prepareSpace: string;
    keepMoving: string;
    confidence: string;
    exploreRoutes: string;
    savedRoutes: string;
    practiceSessions: string;
    completedDrives: string;
    averageProgress: string;
    yourNextFocus: string;
    access: string;
    savedRoutesTitle: string;
    browseAll: string;
    practiceHistory: string;
    recentDrives: string;
    usefulReminders: string;
    unread: string;
    noNotifications: string;
    accountDetails: string;
    subscription: string;
    security: string;
    changePassword: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    logOut: string;
    premiumAccess: string;
    createAccount: string;
    welcomeBack: string;
    emailAddress: string;
    password: string;
    forgotPassword: string;
    login: string;
    register: string;
  };
};

const en = {
  backHome: "Back to home", prepareSpace: "Your preparation space", keepMoving: "Keep moving", confidence: "with confidence.", exploreRoutes: "Explore routes", savedRoutes: "Saved routes", practiceSessions: "Practice sessions", completedDrives: "Completed drives", averageProgress: "Average progress", yourNextFocus: "Your next focus", access: "Access", savedRoutesTitle: "Routes ready to practise", browseAll: "Browse all", practiceHistory: "Practice history", recentDrives: "Your recent drives", usefulReminders: "Useful reminders", unread: "unread", noNotifications: "No notifications yet.", accountDetails: "Account details", subscription: "Subscription", security: "Security", changePassword: "Change password", currentPassword: "Current password", newPassword: "New password", confirmPassword: "Confirm password", logOut: "Log out", premiumAccess: "Premium access", createAccount: "Create your account", welcomeBack: "Welcome back", emailAddress: "Email address", password: "Password", forgotPassword: "Forgot password?", login: "Log in", register: "Create account",
};
const nl = { backHome: "Terug naar home", prepareSpace: "Jouw voorbereidingsruimte", keepMoving: "Blijf vooruitgaan", confidence: "met vertrouwen.", exploreRoutes: "Routes bekijken", savedRoutes: "Opgeslagen routes", practiceSessions: "Oefenritten", completedDrives: "Voltooide ritten", averageProgress: "Gemiddelde voortgang", yourNextFocus: "Jouw volgende focus", access: "Toegang", savedRoutesTitle: "Routes om te oefenen", browseAll: "Alles bekijken", practiceHistory: "Oefengeschiedenis", recentDrives: "Je recente ritten", usefulReminders: "Nuttige herinneringen", unread: "ongelezen", noNotifications: "Nog geen meldingen.", accountDetails: "Accountgegevens", subscription: "Abonnement", security: "Beveiliging", changePassword: "Wachtwoord wijzigen", currentPassword: "Huidig wachtwoord", newPassword: "Nieuw wachtwoord", confirmPassword: "Wachtwoord bevestigen", logOut: "Uitloggen", premiumAccess: "Premium toegang", createAccount: "Account aanmaken", welcomeBack: "Welkom terug", emailAddress: "E-mailadres", password: "Wachtwoord", forgotPassword: "Wachtwoord vergeten?", login: "Inloggen", register: "Account aanmaken" };

export type DirectoryMessages = {
  allCentres: string;
  whereTesting: string;
  searchCityCentre: string;
  provinceLabel: string;
  allRegions: string;
  centresFound: string;
  clearFilters: string;
  noCentresFound: string;
  tryDifferent: string;
  showAllCentres: string;
  exploreCentre: string;
  practiceRoutes: string;
};

export const directoryMessages: Record<Locale, DirectoryMessages> = {
  en: { allCentres: "All centres", whereTesting: "Where are you testing?", searchCityCentre: "Search city or centre", provinceLabel: "Province", allRegions: "All regions", centresFound: "centres found", clearFilters: "Clear filters", noCentresFound: "No centres found", tryDifferent: "Try a different city or clear the filters.", showAllCentres: "Show all centres", exploreCentre: "Explore centre", practiceRoutes: "practice routes" },
  nl: { allCentres: "Alle examencentra", whereTesting: "Waar doe je examen?", searchCityCentre: "Zoek stad of examencentrum", provinceLabel: "Provincies", allRegions: "Alle provincies", centresFound: "examencentra gevonden", clearFilters: "Filters wissen", noCentresFound: "Geen examencentra gevonden", tryDifferent: "Probeer een andere stad of wis de filters.", showAllCentres: "Alle examencentra tonen", exploreCentre: "Examencentrum bekijken", practiceRoutes: "oefenroutes" },
};

export const messages: Record<Locale, RoutePilotMessages> = {
  en: { language: "English", dashboard: "Dashboard", centres: "Test centres", pricing: "Pricing", account: "My account", explore: "Explore routes", copy: en },
  nl: { language: "Nederlands", dashboard: "Dashboard", centres: "Examenlocaties", pricing: "Prijzen", account: "Mijn account", explore: "Routes bekijken", copy: nl },
};

export function isLocale(value: string | null): value is Locale { return Boolean(value && locales.includes(value as Locale)); }
