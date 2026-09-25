import Link from "next/link";
import DashboardPanel from "./DashboardPanel";
import LanguageSwitcher from "../LanguageSwitcher";

export default function DashboardPage() {
  return (
    <main className="dashboard-page">
      <nav className="nav shell inner-nav">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></Link>
        <div className="nav-links"><Link href="/centres">Test centres</Link><Link href="/#pricing">Pricing</Link><Link href="/account">My account</Link></div>
        <div className="nav-actions"><LanguageSwitcher /><Link className="button button-small" href="/centres">Find a route <span>↗</span></Link></div>
        <button className="menu-button" aria-label="Open navigation menu">☰</button>
      </nav>
      <section className="shell dashboard-shell">
        <div className="dashboard-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Your preparation space</p><h1>Keep moving<br /><em>with confidence.</em></h1><p>Track the routes you have practised and focus on the skills that need another calm repetition.</p></div><Link className="button" href="/centres">Explore routes <span>↗</span></Link></div>
        <DashboardPanel />
      </section>
    </main>
  );
}
