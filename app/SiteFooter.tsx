import Link from "next/link";

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  return <footer className={`site-footer ${compact ? "site-footer-compact" : ""}`}>
    <div className="shell site-footer-main">
      <Link className="brand site-footer-brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link>
      <p>Clear route preparation for calmer, more confident test days.</p>
      <div className="site-footer-links"><Link href="/centres">Test centres</Link><Link href="/blog">Guides</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></div>
    </div>
    <div className="shell site-footer-bottom"><span>© 2026 Drive Coach</span><span>Practice with attention. Follow the road in front of you.</span></div>
  </footer>;
}
