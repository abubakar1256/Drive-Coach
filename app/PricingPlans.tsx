"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";

type Plan = { name: string; subtitle: string; price: string; access: string; features: string[]; featured?: boolean; action: string };

const plans: Record<Locale, { eyebrow: string; title: string; titleAccent: string; intro: string; compare: string; plans: Plan[] }> = {
  en: { eyebrow: "Simple access, no surprises", title: "Choose your", titleAccent: "preparation plan.", intro: "Start free, focus on one exam centre, or practise across Belgium with the complete Drive Coach experience.", compare: "Choose a plan", plans: [
    { name: "Free", subtitle: "Perfect to discover Drive Coach", price: "€0", access: "Free access", features: ["View all exam centres", "1 free route", "Interactive map"], action: "Start for free" },
    { name: "Premium", subtitle: "Everything for preparation at one exam centre", price: "€14.99", access: "90 days access", featured: true, features: ["All routes for 1 chosen exam centre", "Passage points & attention points", "Interactive route guidance", "AI spoken tips while driving", "Self-reflection & instructor feedback", "Personal route recommendations", "Personal attention points & guidance"], action: "Choose Premium" },
    { name: "💎 Diamond", subtitle: "The complete Drive Coach experience", price: "€19.99", access: "90 days access", features: ["All routes for all exam centres", "Passage points & attention points", "Interactive route guidance", "AI spoken tips while driving", "Self-reflection & instructor feedback", "Personal route recommendations", "Personal attention points & guidance", "Local practical-exam practice routes"], action: "Choose Diamond" },
  ] },
  nl: { eyebrow: "DUIDELIJKE TOEGANG, ZONDER VERRASSINGEN", title: "Kies jouw", titleAccent: "voorbereidingsplan.", intro: "Start gratis, focus op één examencentrum of oefen in heel België met de volledige Drive Coach-ervaring.", compare: "Kies een pakket", plans: [
    { name: "Gratis", subtitle: "Perfect om Drive Coach te ontdekken", price: "€0", access: "Gratis toegang", features: ["Alle examencentra bekijken", "1 gratis route", "Interactieve kaart"], action: "Start gratis" },
    { name: "Premium", subtitle: "Alles voor je voorbereiding bij één examencentrum", price: "€14,99", access: "90 dagen toegang", featured: true, features: ["Alle routes van 1 gekozen examencentrum", "Doorgangspunten & aandachtspunten", "Interactieve routebegeleiding", "AI gesproken tips tijdens het rijden", "Zelfreflectie & feedback instructeur", "Persoonlijke route-aanbevelingen", "Persoonlijke aandachtspunten & begeleiding"], action: "Kies Premium" },
    { name: "💎 Diamond", subtitle: "De meest complete Drive Coach-ervaring", price: "€19,99", access: "90 dagen toegang", features: ["Alle routes van alle examencentra", "Doorgangspunten & aandachtspunten", "Interactieve routebegeleiding", "AI gesproken tips tijdens het rijden", "Zelfreflectie & feedback instructeur", "Persoonlijke route-aanbevelingen", "Persoonlijke aandachtspunten & begeleiding", "Lokale praktijkexamen-oefenroutes"], action: "Kies Diamond" },
  ] },
  fr: { eyebrow: "UN ACCÈS SIMPLE", title: "Choisissez votre", titleAccent: "formule.", intro: "Commencez gratuitement ou débloquez toute l’expérience Drive Coach.", compare: "Choisir", plans: [
    { name: "Gratuit", subtitle: "Pour découvrir Drive Coach", price: "€0", access: "Accès gratuit", features: ["Voir tous les centres", "1 itinéraire gratuit", "Carte interactive"], action: "Commencer" },
    { name: "Premium", subtitle: "Préparation dans un centre", price: "€14,99", access: "90 jours", featured: true, features: ["Tous les itinéraires d’un centre", "Points de passage et d’attention", "Guidance interactive", "Conseils vocaux IA", "Auto-évaluation et feedback"], action: "Choisir Premium" },
    { name: "💎 Diamond", subtitle: "L’expérience complète", price: "€19,99", access: "90 jours", features: ["Tous les centres", "Guidance interactive", "Conseils vocaux IA", "Recommandations personnalisées", "Itinéraires locaux"], action: "Choisir Diamond" },
  ] },
  de: { eyebrow: "EINFACHER ZUGANG", title: "Wähle deinen", titleAccent: "Vorbereitungsplan.", intro: "Starte kostenlos oder schalte die komplette Drive Coach-Erfahrung frei.", compare: "Plan wählen", plans: [
    { name: "Kostenlos", subtitle: "Drive Coach entdecken", price: "€0", access: "Kostenloser Zugang", features: ["Alle Prüfungszentren ansehen", "1 kostenlose Route", "Interaktive Karte"], action: "Kostenlos starten" },
    { name: "Premium", subtitle: "Vorbereitung bei einem Zentrum", price: "€14,99", access: "90 Tage Zugang", featured: true, features: ["Alle Routen eines Zentrums", "Passage- und Aufmerksamkeitspunkte", "Interaktive Routenführung", "KI-Sprachtipps", "Selbstreflexion und Feedback"], action: "Premium wählen" },
    { name: "💎 Diamond", subtitle: "Die komplette Erfahrung", price: "€19,99", access: "90 Tage Zugang", features: ["Alle Routen aller Zentren", "Interaktive Routenführung", "KI-Sprachtipps", "Persönliche Empfehlungen", "Lokale Übungsrouten"], action: "Diamond wählen" },
  ] },
};

export default function PricingPlans() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); }; sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync); }, []);
  const active = plans[locale];
  return <section className="pricing-section" id="pricing"><div className="shell"><div className="pricing-heading"><div><p className="eyebrow">{active.eyebrow}</p><h2>{active.title}<br /><span>{active.titleAccent}</span></h2></div><p>{active.intro}</p></div><div className="plans-grid">{active.plans.map((plan) => <article className={`plan-card ${plan.featured ? "plan-card-featured" : ""}`} key={plan.name}>{plan.featured && <span className="plan-tag">MOST POPULAR</span>}<h3>{plan.name}</h3><p className="plan-subtitle">{plan.subtitle}</p><div className="plan-price"><strong>{plan.price}</strong><small>{plan.access}</small></div><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><a className={`button button-full ${plan.featured ? "" : "button-outline"}`} href="/auth/register">{plan.action} <span>↗</span></a></article>)}</div></div></section>;
}
