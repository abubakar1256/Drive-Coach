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

function HeroScene() {
  return <div className="drive-scene" role="img" aria-label="Animated driving practice scene with a learner car following a winding navigation route">
    <svg className="drive-scene-art" viewBox="0 0 700 560" aria-hidden="true">
      <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dff4e4" /><stop offset=".58" stopColor="#b9ddb0" /><stop offset="1" stopColor="#f2dfaa" /></linearGradient>
        <linearGradient id="scene-ground" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9acb91" /><stop offset="1" stopColor="#6da773" /></linearGradient>
        <linearGradient id="scene-road" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#454c58" /><stop offset="1" stopColor="#29363f" /></linearGradient>
        <linearGradient id="scene-car" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff8b74" /><stop offset="1" stopColor="#dc4f4c" /></linearGradient>
        <filter id="scene-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id="scene-soft-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="5" /></filter>
        <path id="scene-route" d="M520-35 C365 62 313 128 379 188 C432 237 611 229 622 318 C634 411 421 425 253 463 C163 484 88 521 26 600" />
        <g id="scene-tree">
          <ellipse cx="0" cy="7" rx="32" ry="10" fill="#3b704f" opacity=".2" filter="url(#scene-soft-shadow)" />
          <path d="M-5 11 L-3-28 L8-28 L11 11Z" fill="#936b4b" />
          <ellipse cx="2" cy="-45" rx="27" ry="35" fill="#78ad72" />
          <ellipse cx="-18" cy="-27" rx="19" ry="25" fill="#8fc57f" />
          <ellipse cx="22" cy="-24" rx="18" ry="24" fill="#609e68" />
        </g>
      </defs>
      <rect width="700" height="560" rx="32" fill="url(#scene-sky)" />
      <circle cx="560" cy="90" r="62" fill="#ffe5a1" opacity=".7" />
      <path d="M0 240 C105 170 175 212 270 174 C376 132 452 191 540 165 C613 144 661 157 700 132V560H0Z" fill="#8dbd83" opacity=".75" />
      <path d="M0 315 C107 251 210 282 306 240 C418 192 520 259 700 205V560H0Z" fill="url(#scene-ground)" />
      <path d="M520-35 C365 62 313 128 379 188 C432 237 611 229 622 318 C634 411 421 425 253 463 C163 484 88 521 26 600" fill="none" stroke="#46604e" strokeWidth="142" opacity=".22" filter="url(#scene-shadow)" />
      <path d="M520-35 C365 62 313 128 379 188 C432 237 611 229 622 318 C634 411 421 425 253 463 C163 484 88 521 26 600" fill="none" stroke="#f1f3e7" strokeWidth="130" strokeLinecap="round" />
      <path d="M520-35 C365 62 313 128 379 188 C432 237 611 229 622 318 C634 411 421 425 253 463 C163 484 88 521 26 600" fill="none" stroke="url(#scene-road)" strokeWidth="114" strokeLinecap="round" />
      <path className="scene-route-flow" d="M520-35 C365 62 313 128 379 188 C432 237 611 229 622 318 C634 411 421 425 253 463 C163 484 88 521 26 600" fill="none" stroke="#f5edcf" strokeWidth="5" strokeDasharray="27 31" strokeLinecap="round" opacity=".95" />
      <use href="#scene-tree" transform="translate(85 160) scale(.82)" />
      <use href="#scene-tree" transform="translate(170 245) scale(.62)" />
      <use href="#scene-tree" transform="translate(615 145) scale(.86)" />
      <use href="#scene-tree" transform="translate(653 340) scale(.72)" />
      <use href="#scene-tree" transform="translate(112 420) scale(1.08)" />
      <use href="#scene-tree" transform="translate(575 485) scale(.78)" />
      <path d="M205 220 l-11-20 m11 20 10-22 m-10 22 18-10 M87 355 l-13-24 m13 24 12-26 m-12 26 20-13 M620 405 l-12-23 m12 23 14-25" stroke="#558e5d" strokeWidth="5" strokeLinecap="round" opacity=".8" />
      <g className="scene-car-animated">
        <g transform="rotate(180) translate(7 0) scale(.72)">
          <ellipse cx="7" cy="62" rx="91" ry="24" fill="#203e32" opacity=".35" filter="url(#scene-soft-shadow)" />
          <path d="M-68 38 C-67 14-51 1-30-3 L-13-39 C-8-50 5-55 26-51 L53-40 C67-34 76-18 79 4 L84 32 C82 50 69 59 49 61 L-43 60 C-59 59-68 51-68 38Z" fill="url(#scene-car)" stroke="#c34848" strokeWidth="3" />
          <path d="M-20-5 L-7-33 C-4-40 5-43 19-40 L43-32 C53-27 58-17 61-5Z" fill="#30465c" stroke="#f9aa8e" strokeWidth="3" />
          <path d="M-9-30 L7-34 L3-7 L-21-7Z M12-35 L38-29 C45-25 49-17 52-7 L8-7Z" fill="#a8c1c7" opacity=".82" />
          <path d="M-66 24 L-78 19 C-85 16-86 9-81 5 L-68 6Z M81 22 L91 17 C97 14 98 7 93 4 L82 7Z" fill="#e6635b" />
          <ellipse cx="-40" cy="57" rx="15" ry="22" fill="#29343d" /><ellipse cx="-40" cy="57" rx="7" ry="11" fill="#b8c7c9" />
          <ellipse cx="52" cy="54" rx="15" ry="22" fill="#29343d" /><ellipse cx="52" cy="54" rx="7" ry="11" fill="#b8c7c9" />
          <path d="M-55 19 L-33 16 M61 15 L76 12" stroke="#ffe0ab" strokeWidth="6" strokeLinecap="round" />
          <path d="M-12-10 C3-15 29-14 49-9" stroke="#fff2d3" strokeWidth="3" strokeLinecap="round" opacity=".8" />
        </g>
        <animateMotion dur="18s" repeatCount="indefinite" rotate="auto-reverse" keyPoints=".13;.87" keyTimes="0;1" calcMode="linear"><mpath href="#scene-route" /></animateMotion>
      </g>
      <g transform="translate(235 338)">
        <circle r="17" fill="#f47d65" stroke="#fff8e9" strokeWidth="6" />
        <path d="M0-7v8" stroke="#fff8e9" strokeWidth="3" strokeLinecap="round" /><circle cy="7" r="2" fill="#fff8e9" />
      </g>
      <g className="scene-nav-pulse" transform="translate(580 228)">
        <circle r="13" fill="#0f6a53" stroke="#ecf8e9" strokeWidth="5" />
        <path d="M-5 1 L-1 5 6-5" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
    <div className="scene-caption"><span className="scene-caption-dot" /> <span>Practice with confidence</span></div>
  </div>;
}

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

    <section className="hero" id="top"><div className="hero-glow glow-one" /><div className="hero-glow glow-two" /><div className="shell hero-inner"><div className="hero-copy"><h1>{copy.hero.title}<br /><em>{copy.hero.accent}</em></h1><p className="hero-text">{copy.hero.description}</p><div className="hero-actions"><a className="button" href="/centres">{copy.hero.findCentre} <Arrow /></a><a className="text-link" href="#how-it-works">{copy.hero.seeHow} <span>↓</span></a></div><div className="hero-proof"><div className="avatar-stack"><span>JD</span><span>MS</span><span>AK</span><b>+</b></div><div><strong>4.9/5</strong><span>{copy.hero.proof}</span></div></div></div><div className="hero-visual"><HeroScene /></div></div></section>

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
