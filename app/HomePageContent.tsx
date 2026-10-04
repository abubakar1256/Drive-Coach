"use client";

import { useEffect, useState } from "react";
import AccountNavLink from "./AccountNavLink";
import Faq from "./Faq";
import HomeCentreSection from "./HomeCentreSection";
import HowItWorks from "./HowItWorks";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import PricingPlans from "./PricingPlans";
import { homeCopy } from "../lib/homeCopy";
import { isLocale, type Locale } from "../lib/i18n";

function Arrow() { return <span aria-hidden="true">↗</span>; }

function getCopy(locale: Locale) { return homeCopy[locale]; }

export default function HomePageContent() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); }; sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync); }, []);
  const copy = getCopy(locale);
  return <>
    <nav className="nav shell">
      <a className="brand" href="#top" aria-label="Drive Coach home"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></a>
      <div className="nav-links"><a href="#how-it-works">{copy.nav.howItWorks}</a><a href="#centres">{copy.nav.testCentres}</a><a href="#pricing">{copy.nav.pricing}</a><a href="#faq">{copy.nav.faq}</a></div>
      <div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><a className="button button-small" href="/centres">{copy.nav.startPractising} <Arrow /></a></div>
      <MobileMenu links={[{ href: "#how-it-works", label: copy.nav.howItWorks }, { href: "#centres", label: copy.nav.testCentres }, { href: "#pricing", label: copy.nav.pricing }, { href: "#faq", label: copy.nav.faq }, { href: "/account", label: copy.nav.myAccount }]} />
    </nav>

    <section className="hero" id="top"><div className="hero-glow glow-one" /><div className="hero-glow glow-two" /><div className="shell hero-inner"><div className="hero-copy"><h1>{copy.hero.title}<br /><em>{copy.hero.accent}</em></h1><p className="hero-text">{copy.hero.description}</p><div className="hero-actions"><a className="button" href="/centres">{copy.hero.findCentre} <Arrow /></a><a className="text-link" href="#how-it-works">{copy.hero.seeHow} <span>↓</span></a></div><div className="hero-proof"><div className="avatar-stack"><span>JD</span><span>MS</span><span>AK</span><b>+</b></div><div><strong>4.9/5</strong><span>{copy.hero.proof}</span></div></div></div><div className="hero-visual"><div className="hero-road-scene" aria-hidden="true"><div className="scene-sun" /><div className="scene-hills" /><div className="scene-ground" /><div className="scene-road"><i /><b /><span /></div><div className="scene-car">●</div><div className="scene-pin scene-pin-one">!</div><div className="scene-pin scene-pin-two">↗</div></div><div className="coach-panel" role="img" aria-label="Drive Coach practice coaching dashboard"><div className="coach-panel-top"><span className="coach-live"><i /> {copy.coachPanel.badge}</span><span className="coach-dots">•••</span></div><div className="coach-panel-heading"><span className="coach-avatar">DC</span><div className="coach-heading-copy"><span className="coach-kicker">{copy.coachPanel.title}</span><h2>{copy.routeCard.centre}</h2></div><span className="coach-duration">{copy.routeCard.time}</span></div><div className="coach-progress-meta"><span>{copy.coachPanel.progress}</span><strong>68%</strong></div><div className="coach-progress-track"><span /></div><div className="coach-tip"><span className="coach-tip-icon">!</span><div><small>{copy.coachPanel.tipLabel}</small><strong>{copy.coachPanel.tip}</strong></div></div><div className="coach-metrics"><div><span className="coach-metric-icon coach-metric-icon-score">◔</span><div><small>{copy.coachPanel.scoreLabel}</small><strong>{copy.coachPanel.score}</strong></div></div><div><span className="coach-metric-icon coach-metric-icon-focus">↗</span><div><small>{copy.coachPanel.focusLabel}</small><strong>{copy.coachPanel.focus}</strong></div></div></div><div className="coach-plan"><div><small>{copy.coachPanel.planLabel}</small><strong>{copy.coachPanel.plan}</strong></div><span>→</span></div></div><div className="coach-floating coach-floating-top"><span className="coach-floating-icon">✦</span><div><strong>{copy.coachPanel.badge}</strong><span>{copy.coachPanel.plan}</span></div></div><div className="coach-floating coach-floating-bottom"><span className="coach-floating-icon coach-floating-icon-green">✓</span><div><strong>{copy.routeCard.saved}</strong><span>{copy.routeCard.centre} · Route 04</span></div></div></div></div></section>

    <section className="trust-strip"><div className="shell trust-inner"><span>{copy.trust.label}</span><div className="trust-stats"><strong>180+</strong><span>{copy.trust.practiceRoutes}</span><strong>30+</strong><span>{copy.trust.testCentres}</span><strong>4.9/5</strong><span>{copy.trust.rated}</span><strong>24/7</strong><span>{copy.trust.access}</span></div></div></section>
    <section className="stats-section"><div className="shell stats-grid"><div><strong>180<span>+</span></strong><small>{copy.stats.verifiedRoutes}</small></div><div><strong>30<span>+</span></strong><small>{copy.stats.BelgianCentres}</small></div><div><strong>4.9<span>/5</span></strong><small>{copy.stats.learnerRating}</small></div><div><strong>24<span>/7</span></strong><small>{copy.stats.accessToPrepare}</small></div></div></section>
    <section className="section shell" id="how-it-works"><HowItWorks /></section>
    <HomeCentreSection />
    <PricingPlans />
    <section className="testimonials-section"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">{copy.testimonials.eyebrow}</p><h2>{copy.testimonials.title}<br /><span>{copy.testimonials.accent}</span></h2></div><p className="section-side-copy">{copy.testimonials.sideCopy}</p></div><div className="testimonial-grid">{copy.testimonials.quotes.map((quote, index) => <article className={`testimonial-card ${index === 0 ? "testimonial-featured" : ""}`} key={quote}><div className="stars">★★★★★</div><blockquote>“{quote}”</blockquote><div className="testimonial-person"><span className={`person-avatar ${index === 0 ? "avatar-orange" : index === 1 ? "avatar-blue" : "avatar-green"}`}>{["LS", "TV", "EM"][index]}</span><div><strong>{["Laura S.", "Thomas V.", "Emma M."][index]}</strong><small>{copy.testimonials.passed[index]}</small></div></div></article>)}</div></div></section>
    <Faq />
    <section className="final-cta"><div className="shell final-cta-inner"><div><p className="eyebrow">{copy.cta.eyebrow}</p><h2>{copy.cta.title}<br /><em>{copy.cta.accent}</em></h2></div><a className="button button-light" href="#centres">{copy.cta.button} <Arrow /></a></div></section>
    <footer className="footer"><div className="shell footer-top"><a className="brand" href="#top"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></a><div className="footer-links"><a href="#how-it-works">{copy.footer.howItWorks}</a><a href="#centres">{copy.footer.testCentres}</a><a href="#pricing">{copy.footer.pricing}</a><a href="#faq">{copy.footer.faq}</a></div><div className="language">{copy.footer.language} <span>⌄</span></div></div><div className="shell footer-bottom"><span>{copy.footer.copyright}</span><span>{copy.footer.note}</span></div></footer>
  </>;
}
