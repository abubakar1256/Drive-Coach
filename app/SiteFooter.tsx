"use client";

import Link from "next/link";
import { useSiteCopy } from "../lib/useLocale";

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  const copy = useSiteCopy();
  return <footer className={`site-footer ${compact ? "site-footer-compact" : ""}`}>
    <div className="shell site-footer-main">
      <Link className="brand site-footer-brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link>
      <p>{copy.footer.description}</p>
      <div className="site-footer-links"><Link href="/centres">{copy.footer.testCentres}</Link><Link href="/blog">{copy.footer.guides}</Link><Link href="/contact">{copy.footer.contact}</Link><Link href="/legal/privacy">{copy.footer.privacy}</Link><Link href="/legal/terms">{copy.footer.terms}</Link></div>
    </div>
    <div className="shell site-footer-bottom"><span>{copy.footer.copyright}</span><span>{copy.footer.tagline}</span></div>
  </footer>;
}
