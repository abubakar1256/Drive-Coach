"use client";

import { useEffect, useState } from "react";
import { homeCopy } from "../lib/homeCopy";
import { isLocale, type Locale } from "../lib/i18n";

export default function Faq() {
  const [open, setOpen] = useState(0);
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); }; sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync); }, []);
  const copy = homeCopy[locale].faq;
  const questions = copy.questions;
  return <section className="faq-section" id="faq"><div className="shell faq-layout"><div className="faq-list">{questions.map((item, index) => <article className={`faq-item ${open === index ? "is-open" : ""}`} key={item.question}><button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}><span>{item.question}</span><b>{open === index ? "−" : "+"}</b></button>{open === index && <p>{item.answer}</p>}</article>)}</div></div></section>;
}
