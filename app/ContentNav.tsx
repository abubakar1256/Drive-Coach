import Link from "next/link";
import AccountNavLink from "./AccountNavLink";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import LocalizedNavLinks from "./LocalizedNavLinks";

export default function ContentNav() {
  return <nav className="nav shell inner-nav content-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/centres", label: "testCentres" }, { href: "/blog", label: "guides" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /></div><MobileMenu links={[{ href: "/centres", label: "Test centres" }, { href: "/blog", label: "Guides" }, { href: "/#pricing", label: "Pricing" }, { href: "/auth/login", label: "Log in" }]} /></nav>;
}
