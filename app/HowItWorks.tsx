"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";

type DetailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "action"; text: string; href: string };

type HowItWorksCopy = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  intro: string;
  readMore: string;
  readLess: string;
  cards: { number: string; title: string; detail: DetailBlock[] }[];
};

const copy: Record<Locale, HowItWorksCopy> = {
  en: {
    eyebrow: "How does Drive Coach work?",
    title: "From practice",
    titleAccent: "to personal guidance",
    intro: "Drive Coach helps you prepare for your practical driving test with focus. Choose where you want to practise, get support while driving, and use your own feedback or your instructor's feedback to tailor your next practice drives better and better to you.",
    readMore: "Read more",
    readLess: "Read less",
    cards: [
      { number: "01", title: "Choose your test centre", detail: [
        { kind: "paragraph", text: "Select your test centre and discover the available practice routes and important traffic situations nearby." },
        { kind: "paragraph", text: "This helps you become familiar with roundabouts, junctions, lanes, priority situations, speed zones and other attention points around your test centre." },
        { kind: "action", text: "Choose your test centre →", href: "#centres" },
      ] },
      { number: "02", title: "Choose how you want to practise", detail: [
        { kind: "subheading", text: "Around your test centre" },
        { kind: "paragraph", text: "Practise routes around your test centre, with available passage points and important traffic situations." },
        { kind: "paragraph", text: "Passage points are locations that may be included in the route during the practical test. Drive Coach includes them in realistic practice routes." },
        { kind: "paragraph", text: "Your actual test route may be different." },
        { kind: "subheading", text: "Practise locally" },
        { kind: "paragraph", text: "Practise practical-test routes in your own region and train close to home on roundabouts, priority situations, junctions, lanes and other important traffic situations." },
        { kind: "action", text: "Choose a route →", href: "#route-preview" },
      ] },
      { number: "03", title: "Attention points while driving", detail: [
        { kind: "subheading", text: "Drive Coach comes with you" },
        { kind: "paragraph", text: "During your practice drive, you receive short spoken tips and attention points at relevant moments." },
        { kind: "paragraph", text: "These can cover speed, bends, roundabouts, priority, junctions, lane choice, mirrors and blind spots, cyclists, pedestrians, traffic lights and special traffic situations." },
        { kind: "paragraph", text: "The AI takes your personal attention points into account and decides which tips are most relevant to you, without unnecessarily distracting you while driving." },
        { kind: "paragraph", text: "Would you rather drive completely independently? You can switch spoken guidance off at any time." },
      ] },
      { number: "04", title: "Self-reflection & feedback", detail: [
        { kind: "subheading", text: "Tell Drive Coach what you want to work on" },
        { kind: "paragraph", text: "After your practice drive, you can complete a short self-reflection. Simply indicate what went well and where you still found things difficult, such as speed, priority, roundabouts, lane choice, mirrors or other traffic situations." },
        { kind: "paragraph", text: "Are you driving with an instructor or supervisor? Their feedback can be added too." },
        { kind: "paragraph", text: "The AI processes this information to understand your attention points better and suggest routes and guidance that fit what you want to practise." },
        { kind: "paragraph", text: "Self-reflection is optional and can be switched off, but it is strongly recommended. The more relevant feedback you provide, the better Drive Coach can tailor your next practice drives to your attention points." },
      ] },
    ],
  },
  nl: {
    eyebrow: "Hoe werkt Drive Coach?",
    title: "Van oefenen",
    titleAccent: "naar persoonlijke begeleiding",
    intro: "Drive Coach helpt je om je gericht voor te bereiden op je praktijkexamen. Kies waar je wilt oefenen, krijg ondersteuning tijdens het rijden en gebruik je eigen feedback of die van je instructeur om je volgende oefenritten steeds beter op jou af te stemmen.",
    readMore: "Meer lezen",
    readLess: "Minder lezen",
    cards: [
      { number: "01", title: "Kies je examencentrum", detail: [
        { kind: "paragraph", text: "Selecteer jouw examencentrum en ontdek de beschikbare oefenroutes en belangrijke verkeerssituaties in de omgeving." },
        { kind: "paragraph", text: "Zo raak je vertrouwd met rotondes, kruispunten, rijstroken, voorrangssituaties, snelheidszones en andere aandachtspunten rond jouw examencentrum." },
        { kind: "action", text: "Kies je examencentrum →", href: "#centres" },
      ] },
      { number: "02", title: "Kies hoe je wilt oefenen", detail: [
        { kind: "subheading", text: "Rond je examencentrum" },
        { kind: "paragraph", text: "Oefen routes in de omgeving van jouw examencentrum, met beschikbare doorgangspunten en belangrijke verkeerssituaties." },
        { kind: "paragraph", text: "Doorgangspunten zijn locaties die tijdens het praktijkexamen in de route kunnen worden opgenomen. Drive Coach verwerkt ze in realistische oefenroutes." },
        { kind: "paragraph", text: "Je echte examenroute kan verschillen." },
        { kind: "subheading", text: "Lokaal oefenen" },
        { kind: "paragraph", text: "Oefen praktijkexamenroutes in je eigen regio en train dicht bij huis op rotondes, voorrang, kruispunten, rijstroken en andere belangrijke verkeerssituaties." },
        { kind: "action", text: "Kies een route →", href: "#route-preview" },
      ] },
      { number: "03", title: "Aandachtspunten tijdens het rijden", detail: [
        { kind: "subheading", text: "Drive Coach rijdt met je mee" },
        { kind: "paragraph", text: "Tijdens je oefenrit krijg je op relevante momenten korte gesproken tips en aandachtspunten." },
        { kind: "paragraph", text: "Denk aan snelheid, bochten, rotondes, voorrang, kruispunten, rijstrookkeuze, spiegels en dode hoek, fietsers, voetgangers, verkeerslichten en bijzondere verkeerssituaties." },
        { kind: "paragraph", text: "De AI houdt rekening met jouw persoonlijke aandachtspunten en bepaalt welke tips voor jou het meest relevant zijn, zonder je tijdens het rijden onnodig af te leiden." },
        { kind: "paragraph", text: "Wil je liever volledig zelfstandig rijden? Je kunt de gesproken begeleiding op ieder moment uitschakelen." },
      ] },
      { number: "04", title: "Zelfreflectie & feedback", detail: [
        { kind: "subheading", text: "Vertel Drive Coach waar je aan wilt werken" },
        { kind: "paragraph", text: "Na je oefenrit kun je een korte zelfreflectie invullen. Geef eenvoudig aan wat goed ging en waar je nog moeite mee had, zoals snelheid, voorrang, rotondes, rijstrookkeuze, spiegels of andere verkeerssituaties." },
        { kind: "paragraph", text: "Rij je met een rijinstructeur of begeleider? Dan kan ook hun feedback worden toegevoegd." },
        { kind: "paragraph", text: "De AI verwerkt deze informatie om jouw aandachtspunten beter te begrijpen en routes en begeleiding voor te stellen die beter aansluiten bij wat jij wilt oefenen." },
        { kind: "paragraph", text: "De zelfreflectie is optioneel en kan worden uitgeschakeld, maar wordt sterk aangeraden. Hoe meer relevante feedback je geeft, hoe beter Drive Coach je volgende oefenritten op jouw aandachtspunten kan afstemmen." },
      ] },
    ],
  },
};

function DetailContent({ blocks }: { blocks: DetailBlock[] }) {
  return <div className="feature-detail">{blocks.map((block, index) => {
    if (block.kind === "subheading") return <p className="feature-detail-subheading" key={`${block.kind}-${index}`}>{block.text}</p>;
    if (block.kind === "action") return <a className="feature-detail-action" href={block.href} key={`${block.kind}-${index}`}>{block.text}</a>;
    return <p key={`${block.kind}-${index}`}>{block.text}</p>;
  })}</div>;
}

export default function HowItWorks() {
  const [locale, setLocale] = useState<Locale>("en");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); };
    sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);

  const active = copy[locale];
  return <div className="how-it-works-content"><div className="section-intro"><p className="eyebrow">{active.eyebrow}</p><h2>{active.title}<br /><span>{active.titleAccent}</span></h2><p>{active.intro}</p></div><div className="feature-grid feature-grid-four">{active.cards.map((card, index) => <article className={`feature-card ${open === index ? "is-expanded" : ""}`} key={card.number}><span className="feature-number">{card.number}</span><h3>{card.title}</h3>{open === index && <DetailContent blocks={card.detail} />}<button type="button" className="feature-read-more" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>{open === index ? active.readLess : active.readMore} <span>{open === index ? "↑" : "↗"}</span></button></article>)}</div></div>;
}
