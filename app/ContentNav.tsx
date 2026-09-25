import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";

export default function ContentNav() {
  return <nav className="nav shell inner-nav content-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></Link><div className="nav-links"><Link href="/centres">Test centres</Link><Link href="/blog">Guides</Link><Link href="/#pricing">Pricing</Link></div><div className="nav-actions"><LanguageSwitcher /><Link className="login-link" href="/auth/login">Log in</Link></div></nav>;
}
