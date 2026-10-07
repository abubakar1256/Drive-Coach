import Link from "next/link";
import AccountPanel from "./AccountPanel";
import BillingPanel from "./BillingPanel";
import AccountNavLink from "../AccountNavLink";
import LanguageSwitcher from "../LanguageSwitcher";
import LocalizedNavLinks from "../LocalizedNavLinks";
import SiteFooter from "../SiteFooter";
import { getServerLocale } from "../../lib/serverLocale";
import { siteCopy } from "../../lib/siteCopy";

export default function AccountPage() {
  const copy = siteCopy[getServerLocale()].account;
  return <main className="account-page"><nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/dashboard", label: "dashboard" }, { href: "/#how-it-works", label: "howItWorks" }, { href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /></div><button className="menu-button" aria-label={copy.title}>☰</button></nav><section className="shell account-shell"><div className="account-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.description}</p></div><span className="account-status-pill">{copy.active}</span></div><AccountPanel /><BillingPanel /></section><SiteFooter /></main>;
}
