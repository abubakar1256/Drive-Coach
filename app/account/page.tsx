import Link from "next/link";
import AccountPanel from "./AccountPanel";
import BillingPanel from "./BillingPanel";
import LanguageSwitcher from "../LanguageSwitcher";

export default function AccountPage() {
  return <main className="account-page"><nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><div className="nav-links"><Link href="/dashboard">Dashboard</Link><Link href="/#how-it-works">How it works</Link><Link href="/centres">Test centres</Link><Link href="/#pricing">Pricing</Link></div><div className="nav-actions"><LanguageSwitcher /><Link className="login-link" href="/dashboard">My dashboard</Link></div><button className="menu-button" aria-label="Open navigation menu">☰</button></nav><section className="shell account-shell"><div className="account-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Your Drive Coach space</p><h1>My account</h1><p>Keep your details, access and preparation plans in one place.</p></div><span className="account-status-pill">Account active</span></div><AccountPanel /><BillingPanel /></section></main>;
}
