import Link from "next/link";
import { getCentres } from "../../lib/api";
import CentreDirectory from "./CentreDirectory";
import AccountNavLink from "../AccountNavLink";
import LanguageSwitcher from "../LanguageSwitcher";

export const dynamic = "force-dynamic";

export default async function CentresPage() {
  const listedCentres = await getCentres();
  return (
    <main>
      <nav className="nav shell inner-nav">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></Link>
        <div className="nav-links"><Link href="/#how-it-works">How it works</Link><Link href="/centres">Test centres</Link><Link href="/#pricing">Pricing</Link></div>
        <div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing">View plans <span>↗</span></Link></div>
        <button className="menu-button" aria-label="Open navigation menu">☰</button>
      </nav>

      <section className="directory-hero"><div className="shell directory-hero-inner"><div><p className="eyebrow"><span className="eyebrow-dot" /> Browse practice routes</p><h1>Find your<br /><em>test centre.</em></h1><p>Choose where you are taking your practical test and start exploring the roads that matter.</p></div><div className="directory-stat"><strong>{listedCentres.length}</strong><span>published centres<br />ready to explore</span></div></div></section>

      <section className="directory-content shell"><CentreDirectory centres={listedCentres} /></section>
    </main>
  );
}
