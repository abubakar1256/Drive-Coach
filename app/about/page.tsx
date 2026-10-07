import ContentNav from "../ContentNav";
import SiteFooter from "../SiteFooter";
import { getServerLocale } from "../../lib/serverLocale";
import { siteCopy } from "../../lib/siteCopy";

export const metadata = { title: "About Drive Coach | Driving Test Preparation", description: "Learn how Drive Coach helps learner drivers prepare with clearer route information.", alternates: { canonical: "/about" }, openGraph: { url: "/about" } };

export default function AboutPage() {
  const copy = siteCopy[getServerLocale()].about;
  return <main className="content-page"><ContentNav /><section className="content-hero shell"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}<br /><em>{copy.accent}</em></h1><p>{copy.intro}</p></section><section className="content-body shell content-two-column"><div><p className="eyebrow">{copy.approach}</p><h2>{copy.approachTitle}</h2></div><div><p>{copy.bodyOne}</p><p>{copy.bodyTwo}</p></div></section><SiteFooter /></main>;
}
