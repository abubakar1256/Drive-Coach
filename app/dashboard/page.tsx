import Link from "next/link";
import DashboardPanel from "./DashboardPanel";
import LanguageSwitcher from "../LanguageSwitcher";
import AccountNavLink from "../AccountNavLink";
import LocalizedNavLinks, { LocalizedNavText } from "../LocalizedNavLinks";
import SiteFooter from "../SiteFooter";
import { getServerLocale } from "../../lib/serverLocale";
import { siteCopy } from "../../lib/siteCopy";

export default function DashboardPage() {
  const copy = siteCopy[getServerLocale()].dashboard;
  return (
    <main className="dashboard-page">
      <nav className="nav shell inner-nav">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link>
        <LocalizedNavLinks items={[{ href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }, { href: "/account", label: "account" }]} />
        <div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/centres"><LocalizedNavText item="findRoute" /> <span>↗</span></Link></div>
        <button className="menu-button" aria-label={copy.title}>☰</button>
      </nav>
      <section className="shell dashboard-shell">
        <div className="dashboard-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}<br /><em>{copy.accent}</em></h1><p>{copy.description}</p></div><Link className="button" href="/centres">{copy.explore} <span>↗</span></Link></div>
        <DashboardPanel />
      </section>
      <SiteFooter />
    </main>
  );
}
