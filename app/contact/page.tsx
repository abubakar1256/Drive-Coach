import Link from "next/link";
import ContentNav from "../ContentNav";
import SiteFooter from "../SiteFooter";
import { getServerLocale } from "../../lib/serverLocale";
import { siteCopy } from "../../lib/siteCopy";

export const metadata = { title: "Contact Drive Coach", description: "Contact Drive Coach support about routes, accounts and access.", alternates: { canonical: "/contact" }, openGraph: { url: "/contact" } };

export default function ContactPage() {
  const copy = siteCopy[getServerLocale()].contact;
  return <main className="content-page"><ContentNav /><section className="content-hero shell"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}<br /><em>{copy.accent}</em></h1><p>{copy.intro}</p></section><section className="content-body shell contact-grid"><article className="content-card"><span className="small-label">{copy.support}</span><h2>{copy.supportTitle}</h2><p>{copy.supportText}</p><a className="button" href="mailto:hello@drivecoach.local">{copy.email} <span>↗</span></a></article><article className="content-card"><span className="small-label">{copy.quickLinks}</span><h2>{copy.quickTitle}</h2><p>{copy.quickText}</p><div className="content-links"><Link href="/#faq">{copy.faq} <span>↗</span></Link><Link href="/centres">{copy.centres} <span>↗</span></Link></div></article></section><SiteFooter /></main>;
}
