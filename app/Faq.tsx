"use client";

import { useState } from "react";

const questions = [
  { question: "Are the routes free to discover?", answer: "Yes. You can browse centres and preview routes publicly. A time-based access plan unlocks the complete preparation experience, including every point, warning and media item." },
  { question: "Which access periods are available?", answer: "RoutePilot is designed around focused preparation: 1 day, 1 week, 1 month and 3 months. Choose the period that matches your exam date." },
  { question: "Can I practise more than one test centre?", answer: "Your access plan will show exactly what is included. The product is built so plans can cover one centre or multiple centres as the business model grows." },
  { question: "Are the routes official examiner routes?", answer: "Routes are preparation guides and can change because of roadworks, traffic and local conditions. Always follow current signs, road rules and examiner instructions." },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return <section className="faq-section" id="faq"><div className="shell faq-layout"><div className="faq-intro"><p className="eyebrow">Questions, answered</p><h2>Ready when<br /><span>you are.</span></h2><p>Everything you need to know before choosing your first route.</p><a className="text-link" href="mailto:hello@routepilot.local">Still have a question <span>↗</span></a></div><div className="faq-list">{questions.map((item, index) => <article className={`faq-item ${open === index ? "is-open" : ""}`} key={item.question}><button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}><span>{item.question}</span><b>{open === index ? "−" : "+"}</b></button>{open === index && <p>{item.answer}</p>}</article>)}</div></div></section>;
}
