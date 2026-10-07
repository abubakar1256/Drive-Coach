import Link from "next/link";
import ContentNav from "../ContentNav";
import SiteFooter from "../SiteFooter";
import { getServerLocale } from "../../lib/serverLocale";
import { siteCopy } from "../../lib/siteCopy";

export const metadata = { title: "Driving Test Preparation Guides | Drive Coach", description: "Practical preparation guides for route study, roundabouts, lane changes and calmer test days.", alternates: { canonical: "/blog" }, openGraph: { url: "/blog" } };

export default function BlogPage() {
  const copy = siteCopy[getServerLocale()].blog;
  return <main className="content-page"><ContentNav /><section className="content-hero shell"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}<br /><em>{copy.accent}</em></h1><p>{copy.intro}</p></section><section className="content-body shell"><div className="guide-grid">{copy.guides.map((guide) => <article className="content-card guide-card" key={guide.title}><span className="small-label">{guide.tag}</span><h2>{guide.title}</h2><p>{guide.text}</p><Link href="/#how-it-works">{copy.explore} <span>↗</span></Link></article>)}</div></section><SiteFooter /></main>;
}
