import Link from "next/link";
import { getCentres } from "../../lib/api";
import CentreDirectory from "./CentreDirectory";
import AccountNavLink from "../AccountNavLink";
import LanguageSwitcher from "../LanguageSwitcher";
import MobileMenu from "../MobileMenu";
import DirectoryHero from "./DirectoryHero";

export const dynamic = "force-dynamic";

export default async function CentresPage() {
  const listedCentres = await getCentres();
  return (
    <main>
      <nav className="nav shell inner-nav">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></Link>
        <div className="nav-links"><Link href="/#how-it-works">How it works</Link><Link href="/centres">Test centres</Link><Link href="/#pricing">Pricing</Link></div>
        <div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing">View plans <span>↗</span></Link></div>
        <MobileMenu links={[{ href: "/#how-it-works", label: "How it works" }, { href: "/centres", label: "Test centres" }, { href: "/#pricing", label: "Pricing" }, { href: "/account", label: "My account" }]} />
      </nav>

      <DirectoryHero count={listedCentres.length} />

      <section className="directory-content shell"><CentreDirectory centres={listedCentres} /></section>
    </main>
  );
}
