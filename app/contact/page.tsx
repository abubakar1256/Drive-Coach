import Link from "next/link";
import ContentNav from "../ContentNav";

export const metadata = { title: "Contact RoutePilot", description: "Contact RoutePilot support about routes, accounts and access.", alternates: { canonical: "/contact" }, openGraph: { url: "/contact" } };

export default function ContactPage() {
  return <main className="content-page"><ContentNav /><section className="content-hero shell"><p className="eyebrow"><span className="eyebrow-dot" /> Contact</p><h1>We are here to<br /><em>help you prepare.</em></h1><p>Send us a question about an account, a route or your access period and we will point you in the right direction.</p></section><section className="content-body shell contact-grid"><article className="content-card"><span className="small-label">SUPPORT</span><h2>Talk to RoutePilot</h2><p>For support and route-content questions, email our team. Include the centre and route name so we can investigate quickly.</p><a className="button" href="mailto:hello@routepilot.local">Email support <span>↗</span></a></article><article className="content-card"><span className="small-label">QUICK LINKS</span><h2>Find your answer</h2><p>Browse the frequently asked questions or open the centre directory to start preparing.</p><div className="content-links"><Link href="/#faq">Read the FAQ <span>↗</span></Link><Link href="/centres">Browse test centres <span>↗</span></Link></div></article></section></main>;
}
