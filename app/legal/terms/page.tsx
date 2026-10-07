import ContentNav from "../../../app/ContentNav";
import SiteFooter from "../../../app/SiteFooter";
import { getServerLocale } from "../../../lib/serverLocale";
import { legalCopy } from "../../../lib/legalCopy";

export const metadata = { title: "Terms of Service | Drive Coach", description: "Terms for using Drive Coach route-preparation content and subscription access.", alternates: { canonical: "/legal/terms" }, openGraph: { url: "/legal/terms" } };

export default function TermsPage() {
  const copy = legalCopy[getServerLocale()].terms;
  return <main className="content-page"><ContentNav /><section className="content-hero shell legal-hero"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}<br /><em>{copy.accent}</em></h1><p>{copy.intro}</p><div className="legal-meta"><span>{copy.updated}</span><span>{copy.scope}</span></div></section><article className="shell legal-body privacy-body"><div className="legal-intro-card"><span className="legal-card-icon">→</span><div><strong>{copy.introLabel}</strong><p>{copy.introText}</p></div></div>{copy.sections.map((section) => <div className="legal-section" key={section.number}><span className="legal-section-number">{section.number}</span><div><h2>{section.title}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</div></div>)}<div className="legal-contact-card"><div><span className="small-label">{copy.contactLabel}</span><h2>{copy.contactTitle}</h2><p>{copy.contactText}</p></div><a className="button" href="mailto:hello@drivecoach.local">{copy.contactButton} <span>↗</span></a></div></article><SiteFooter /></main>;
}
