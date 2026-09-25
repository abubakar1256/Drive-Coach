export const locales = ["en", "nl", "fr", "de"] as const;
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
const fr = { backHome: "Retour à l’accueil", prepareSpace: "Votre espace de préparation", keepMoving: "Continuez", confidence: "en toute confiance.", exploreRoutes: "Voir les itinéraires", savedRoutes: "Itinéraires enregistrés", practiceSessions: "Sessions de pratique", completedDrives: "Trajets terminés", averageProgress: "Progression moyenne", yourNextFocus: "Votre prochain objectif", access: "Accès", savedRoutesTitle: "Itinéraires prêts à pratiquer", browseAll: "Tout voir", practiceHistory: "Historique de pratique", recentDrives: "Vos trajets récents", usefulReminders: "Rappels utiles", unread: "non lus", noNotifications: "Aucune notification pour l’instant.", accountDetails: "Détails du compte", subscription: "Abonnement", security: "Sécurité", changePassword: "Changer le mot de passe", currentPassword: "Mot de passe actuel", newPassword: "Nouveau mot de passe", confirmPassword: "Confirmer le mot de passe", logOut: "Se déconnecter", premiumAccess: "Accès premium", createAccount: "Créer votre compte", welcomeBack: "Bon retour", emailAddress: "Adresse e-mail", password: "Mot de passe", forgotPassword: "Mot de passe oublié ?", login: "Se connecter", register: "Créer le compte" };
const de = { backHome: "Zur Startseite", prepareSpace: "Dein Vorbereitungsbereich", keepMoving: "Bleib dran", confidence: "mit Vertrauen.", exploreRoutes: "Routen ansehen", savedRoutes: "Gespeicherte Routen", practiceSessions: "Übungsfahrten", completedDrives: "Abgeschlossene Fahrten", averageProgress: "Durchschnittlicher Fortschritt", yourNextFocus: "Dein nächster Fokus", access: "Zugang", savedRoutesTitle: "Routen zum Üben", browseAll: "Alle ansehen", practiceHistory: "Übungsverlauf", recentDrives: "Deine letzten Fahrten", usefulReminders: "Nützliche Hinweise", unread: "ungelesen", noNotifications: "Noch keine Benachrichtigungen.", accountDetails: "Kontodaten", subscription: "Abonnement", security: "Sicherheit", changePassword: "Passwort ändern", currentPassword: "Aktuelles Passwort", newPassword: "Neues Passwort", confirmPassword: "Passwort bestätigen", logOut: "Abmelden", premiumAccess: "Premium-Zugang", createAccount: "Konto erstellen", welcomeBack: "Willkommen zurück", emailAddress: "E-Mail-Adresse", password: "Passwort", forgotPassword: "Passwort vergessen?", login: "Anmelden", register: "Konto erstellen" };

export type DirectoryMessages = {
  allCentres: string;
  whereTesting: string;
  searchCityCentre: string;
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
  en: { allCentres: "All centres", whereTesting: "Where are you testing?", searchCityCentre: "Search city or centre", allRegions: "All regions", centresFound: "centres found", clearFilters: "Clear filters", noCentresFound: "No centres found", tryDifferent: "Try a different city or clear the filters.", showAllCentres: "Show all centres", exploreCentre: "Explore centre", practiceRoutes: "practice routes" },
  nl: { allCentres: "Alle locaties", whereTesting: "Waar doe je examen?", searchCityCentre: "Zoek stad of locatie", allRegions: "Alle regio’s", centresFound: "locaties gevonden", clearFilters: "Filters wissen", noCentresFound: "Geen locaties gevonden", tryDifferent: "Probeer een andere stad of wis de filters.", showAllCentres: "Alle locaties tonen", exploreCentre: "Locatie bekijken", practiceRoutes: "oefenroutes" },
  fr: { allCentres: "Tous les centres", whereTesting: "Où passez-vous l’examen ?", searchCityCentre: "Rechercher une ville ou un centre", allRegions: "Toutes les régions", centresFound: "centres trouvés", clearFilters: "Effacer les filtres", noCentresFound: "Aucun centre trouvé", tryDifferent: "Essayez une autre ville ou effacez les filtres.", showAllCentres: "Afficher tous les centres", exploreCentre: "Explorer le centre", practiceRoutes: "itinéraires de pratique" },
  de: { allCentres: "Alle Zentren", whereTesting: "Wo machst du die Prüfung?", searchCityCentre: "Stadt oder Zentrum suchen", allRegions: "Alle Regionen", centresFound: "Zentren gefunden", clearFilters: "Filter löschen", noCentresFound: "Keine Zentren gefunden", tryDifferent: "Versuche eine andere Stadt oder lösche die Filter.", showAllCentres: "Alle Zentren anzeigen", exploreCentre: "Zentrum ansehen", practiceRoutes: "Übungsrouten" },
};

export const messages: Record<Locale, RoutePilotMessages> = {
  en: { language: "English", dashboard: "Dashboard", centres: "Test centres", pricing: "Pricing", account: "My account", explore: "Explore routes", copy: en },
  nl: { language: "Nederlands", dashboard: "Dashboard", centres: "Examenlocaties", pricing: "Prijzen", account: "Mijn account", explore: "Routes bekijken", copy: nl },
  fr: { language: "Français", dashboard: "Tableau de bord", centres: "Centres d’examen", pricing: "Tarifs", account: "Mon compte", explore: "Voir les itinéraires", copy: fr },
  de: { language: "Deutsch", dashboard: "Dashboard", centres: "Prüfungszentren", pricing: "Preise", account: "Mein Konto", explore: "Routen ansehen", copy: de },
};

export function isLocale(value: string | null): value is Locale { return Boolean(value && locales.includes(value as Locale)); }
