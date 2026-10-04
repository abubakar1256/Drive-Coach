"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";

type HowItWorksCopy = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  intro: string;
  readMore: string;
  readLess: string;
  cards: { number: string; title: string; summary: string; detail: string }[];
};

const copy: Record<Locale, HowItWorksCopy> = {
  en: {
    eyebrow: "A simpler way to prepare", title: "Less guessing.", titleAccent: "More knowing.", intro: "Good preparation is not about memorising every street. It is about knowing where to focus your attention.", readMore: "Read more", readLess: "Read less",
    cards: [
      { number: "01", title: "Choose your test centre", summary: "Start with the centre where you will take your practical test.", detail: "Select your exam centre and discover available practice routes and important traffic situations nearby: roundabouts, junctions, lanes, priority situations, speed zones and other attention points." },
      { number: "02", title: "Choose how you want to practise", summary: "Practise around your centre or in your own region.", detail: "Around your centre, practise realistic routes with passage points and important traffic situations. With local practice, train close to home on roundabouts, priority, junctions, lanes and other driving situations. Your real exam route may differ." },
      { number: "03", title: "Attention points while driving", summary: "Drive with short, relevant tips when they matter.", detail: "During your practice drive, Drive Coach can give short spoken tips about speed, bends, roundabouts, priority, lane choice, mirrors, blind spots, cyclists, pedestrians, traffic lights and special situations. You can switch voice guidance off at any time." },
      { number: "04", title: "Self-reflection & feedback", summary: "Tell Drive Coach what you want to improve.", detail: "After your drive, share what went well and what was difficult. Instructor feedback can be added too. The AI uses this information to understand your attention points and suggest practice routes and guidance that fit your next drive." },
    ],
  },
  nl: {
    eyebrow: "ZO BEREID JE JE VOOR", title: "Minder twijfelen.", titleAccent: "Meer weten.", intro: "Een goede voorbereiding draait niet om het uit het hoofd leren van elke straat. Het gaat erom dat je weet waar je extra aandacht aan moet geven.", readMore: "Meer lezen", readLess: "Minder lezen",
    cards: [
      { number: "01", title: "Kies je examencentrum", summary: "Begin bij het examencentrum waar jij je praktijkexamen wilt afleggen.", detail: "Selecteer jouw examencentrum en ontdek de beschikbare oefenroutes en belangrijke verkeerssituaties in de omgeving. Zo raak je vertrouwd met rotondes, kruispunten, rijstroken, voorrangssituaties, snelheidszones en andere aandachtspunten." },
      { number: "02", title: "Kies hoe je wilt oefenen", summary: "Oefen rond je examencentrum of lokaal in je eigen regio.", detail: "Rond je examencentrum oefen je routes met doorgangspunten en belangrijke verkeerssituaties. Lokaal oefenen helpt je om dicht bij huis te trainen op rotondes, voorrang, kruispunten, rijstroken en andere situaties. Je echte examenroute kan verschillen." },
      { number: "03", title: "Aandachtspunten tijdens het rijden", summary: "Drive Coach rijdt met je mee.", detail: "Tijdens je oefenrit krijg je op relevante momenten korte gesproken tips over snelheid, bochten, rotondes, voorrang, rijstrookkeuze, spiegels, dode hoek, fietsers, voetgangers, verkeerslichten en bijzondere verkeerssituaties. Je kunt de gesproken begeleiding op ieder moment uitschakelen." },
      { number: "04", title: "Zelfreflectie & feedback", summary: "Vertel Drive Coach waar je aan wilt werken.", detail: "Na je oefenrit kun je aangeven wat goed ging en waar je nog moeite mee had. Feedback van je rijinstructeur of begeleider kan ook worden toegevoegd. De AI verwerkt deze informatie om je volgende oefenritten beter op jouw aandachtspunten af te stemmen." },
    ],
  },
};

export default function HowItWorks() {
  const [locale, setLocale] = useState<Locale>("en");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); };
    sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);

  const active = copy[locale];
  return <div className="how-it-works-content"><div className="section-intro"><p className="eyebrow">{active.eyebrow}</p><h2>{active.title}<br /><span>{active.titleAccent}</span></h2><p>{active.intro}</p></div><div className="feature-grid feature-grid-four">{active.cards.map((card, index) => <article className={`feature-card ${open === index ? "is-expanded" : ""}`} key={card.number}><span className="feature-number">{card.number}</span><h3>{card.title}</h3><p>{open === index ? card.detail : card.summary}</p><button type="button" className="feature-read-more" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>{open === index ? active.readLess : active.readMore} <span>{open === index ? "↑" : "↗"}</span></button></article>)}</div></div>;
}
