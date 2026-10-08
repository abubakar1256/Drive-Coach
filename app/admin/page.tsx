import Link from "next/link";
import AdminRouteEditor from "./AdminRouteEditor";
import AdminReports from "./AdminReports";
import SiteFooter from "../SiteFooter";
import LanguageSwitcher from "../LanguageSwitcher";
import { getServerLocale } from "../../lib/serverLocale";
import MobileMenu from "../MobileMenu";

export default function AdminPage() {
  const nl = getServerLocale() === "nl";
  return (
    <main className="admin-page">
      <nav className="nav shell inner-nav">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link>
        <div className="nav-actions"><LanguageSwitcher /><div className="nav-links"><Link href="/centres">{nl ? "Website bekijken" : "View website"}</Link><Link href="/auth/login">{nl ? "Inloggen" : "Log in"}</Link></div><MobileMenu links={[{ href: "/centres", label: "View website" }, { href: "/auth/login", label: "Log in" }]} /></div>
      </nav>
      <section className="shell admin-shell">
        <div className="admin-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {nl ? "Contentbeheer" : "Content operations"}</p><h1>{nl ? "Routecontrole" : "Route control room"}</h1><p>{nl ? "Beheer gepubliceerde routes en de punten waarop bestuurders moeten letten." : "Manage published routes and the points drivers need to watch."}</p></div><span className="admin-badge">{nl ? "Alleen admin" : "Admin only"}</span></div>
        <AdminRouteEditor />
        <AdminReports />
      </section>
      <SiteFooter />
    </main>
  );
}
