import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { centres, getCentre } from "../../../lib/data";
import { apiCentreToCentre, getCentreBySlug } from "../../../lib/api";
import AccountNavLink from "../../../app/AccountNavLink";
import PageViewTracker from "../../../app/PageViewTracker";
import LanguageSwitcher from "../../../app/LanguageSwitcher";
import MobileMenu from "../../../app/MobileMenu";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return centres.map((centre) => ({ slug: centre.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const fallback = getCentre(params.slug);
  const apiCentre = fallback ? null : await getCentreBySlug(params.slug);
  const name = fallback?.name ?? apiCentre?.name ?? "Driving test centre";
  const description = fallback?.description ?? apiCentre?.description ?? `Explore practice routes and key driving points around ${name}.`;
  return { title: `${name} Driving Test Routes | RoutePilot`, description, alternates: { canonical: `/centres/${params.slug}` }, openGraph: { title: `${name} Driving Test Routes`, description, url: `/centres/${params.slug}` } };
}

export default async function CentrePage({ params }: { params: { slug: string } }) {
  const staticCentre = getCentre(params.slug);
  const apiCentre = staticCentre ? null : await getCentreBySlug(params.slug);
  const centre = staticCentre ?? (apiCentre ? apiCentreToCentre(apiCentre) : null);
  if (!centre) notFound();

  const availableRoutes = apiCentre?.routes?.length ? apiCentre.routes : [
    { slug: `${centre.slug}-route-04`, name: "Route 04", durationMin: 24, points: centre.routePoints },
    ...["Route 01", "Route 02", "Route 03"].map((name, index) => ({ slug: `${centre.slug}-route-${String(index + 1).padStart(2, "0")}`, name, durationMin: 24, points: centre.routePoints })),
  ];
  const featuredRoute = availableRoutes[0];

  return (
    <main>
      <PageViewTracker eventType="CENTRE_VIEW" centreSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></Link><div className="nav-links"><Link href="/#how-it-works">How it works</Link><Link href="/centres">Test centres</Link><Link href="/#pricing">Pricing</Link></div><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing">View plans <span>↗</span></Link></div><MobileMenu links={[{ href: "/#how-it-works", label: "How it works" }, { href: "/centres", label: "Test centres" }, { href: "/#pricing", label: "Pricing" }, { href: "/account", label: "My account" }]} /></nav>
      <section className="centre-detail-hero"><div className="shell"><Link className="back-link" href="/centres">← All test centres</Link><div className="centre-detail-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {centre.region}</p><h1>{centre.name}</h1><p>{centre.area}, {centre.city}</p></div><div className="centre-detail-stat"><strong>{centre.routes}</strong><span>practice<br />routes</span></div></div></div></section>
      <section className="shell centre-detail-body"><div className="centre-detail-copy"><p className="eyebrow">Prepare with context</p><h2>Know what<br /><span>to expect.</span></h2><p>{centre.description}</p><div className="highlight-list">{centre.highlights.map((highlight) => <div key={highlight}><span>✓</span>{highlight}</div>)}</div><Link className="button" href={`/routes/${featuredRoute.slug}`}>Open first route <span>↗</span></Link></div><div className="centre-detail-map"><div className="map-panel-label"><span><i /> CENTRE OVERVIEW</span><strong>{centre.routes} routes</strong></div><div className="route-map large-map"><div className="map-grid" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-road road-four" /><div className="map-route" /><div className="map-point point-a"><span>A</span></div><div className="map-point point-b"><span>!</span></div><div className="map-point point-c"><span>↗</span></div><div className="map-legend"><i className="legend-route" /> Practice routes <i className="legend-alert" /> Key points</div><div className="map-control">+</div><div className="map-control map-control-minus">−</div></div></div></section>
      <section className="route-list-section"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">Choose your practice run</p><h2>Available routes</h2></div><span className="route-count">{centre.routes} routes · updated recently</span></div><div className="route-list-card">{availableRoutes.map((route, index) => <Link className={`route-list-row ${index === 0 ? "route-list-row-featured" : ""}`} href={`/routes/${route.slug}`} key={route.slug}><div className={`route-index ${index ? "muted-index" : ""}`}>{String(index + 1).padStart(2, "0")}</div><div>{index === 0 && <span className="small-label">RECOMMENDED START</span>}<h3>{route.name} <span>↗</span></h3><p>{route.points.length} key points · approximately {route.durationMin ?? 24} min</p></div>{index === 0 ? <div className="route-list-badge">Preview route <span>→</span></div> : <span className="route-list-arrow">↗</span>}</Link>)}</div></div></section>
    </main>
  );
}
