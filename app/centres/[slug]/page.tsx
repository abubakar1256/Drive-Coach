import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { centres, getCentre } from "../../../lib/data";
import { apiCentreToCentre, getCentreBySlug } from "../../../lib/api";
import AccountNavLink from "../../../app/AccountNavLink";
import PageViewTracker from "../../../app/PageViewTracker";
import LanguageSwitcher from "../../../app/LanguageSwitcher";
import MobileMenu from "../../../app/MobileMenu";
import LocalizedNavLinks, { LocalizedNavText } from "../../../app/LocalizedNavLinks";
import { googleMapsRouteUrl, routeDistanceKm, routeSequence } from "../../../lib/route-utils";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return centres.map((centre) => ({ slug: centre.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const fallback = getCentre(params.slug);
  const apiCentre = await getCentreBySlug(params.slug);
  const name = fallback?.name ?? apiCentre?.name ?? "Driving test centre";
  const description = fallback?.description ?? apiCentre?.description ?? `Explore practice routes and key driving points around ${name}.`;
  return { title: `${name} Driving Test Routes | Drive Coach`, description, alternates: { canonical: `/centres/${params.slug}` }, openGraph: { title: `${name} Driving Test Routes`, description, url: `/centres/${params.slug}` } };
}

export default async function CentrePage({ params }: { params: { slug: string } }) {
  const staticCentre = getCentre(params.slug);
  const apiCentre = await getCentreBySlug(params.slug);
  const centre = apiCentre ? apiCentreToCentre(apiCentre, staticCentre ?? centres[0]) : staticCentre ?? null;
  if (!centre) notFound();

  const availableRoutes = apiCentre?.routes?.length ? apiCentre.routes : [
    { slug: `${centre.slug}-route-04`, name: "Route 04", durationMin: 24, points: centre.routePoints },
    ...["Route 01", "Route 02", "Route 03"].map((name, index) => ({ slug: `${centre.slug}-route-${String(index + 1).padStart(2, "0")}`, name, durationMin: 24, points: centre.routePoints })),
  ];
  const featuredRoute = availableRoutes[0];
  const routeCards = availableRoutes.map((route, index) => ({
    ...route,
    isLocked: index > 0,
    distanceKm: routeDistanceKm(route.points) ?? routeDistanceKm(centre.routeCoordinates.map(([longitude, latitude]) => ({ longitude, latitude }))),
    sequence: routeSequence(route.points),
    googleMapsUrl: googleMapsRouteUrl(route.points) ?? googleMapsRouteUrl(centre.routeCoordinates.map(([longitude, latitude]) => ({ longitude, latitude }))),
  }));

  return (
    <main>
      <PageViewTracker eventType="CENTRE_VIEW" centreSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/#how-it-works", label: "howItWorks" }, { href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing"><LocalizedNavText item="viewPlans" /> <span>↗</span></Link></div><MobileMenu links={[{ href: "/#how-it-works", label: "How it works" }, { href: "/centres", label: "Test centres" }, { href: "/#pricing", label: "Pricing" }, { href: "/account", label: "My account" }]} /></nav>
      <section className="centre-detail-hero"><div className="shell"><Link className="back-link" href="/centres">← All test centres</Link><div className="centre-detail-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {centre.region}</p><h1>{centre.name}</h1><p>{centre.area}, {centre.city}</p></div><div className="centre-detail-stat"><strong>{routeCards.length}</strong><span>practice<br />routes</span></div></div></div></section>
      <section className="shell centre-detail-body"><div className="centre-detail-copy"><p className="eyebrow">Prepare with context</p><h2>Know what<br /><span>to expect.</span></h2><p>{centre.description}</p><div className="highlight-list">{centre.highlights.map((highlight) => <div key={highlight}><span>✓</span>{highlight}</div>)}</div><Link className="button" href={`/routes/${featuredRoute.slug}`}>Open first route <span>↗</span></Link></div><div className="centre-detail-map"><div className="map-panel-label"><span><i /> CENTRE OVERVIEW</span><strong>{centre.routes} routes</strong></div><div className="route-map large-map"><div className="map-grid" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-road road-four" /><div className="map-route" /><div className="map-point point-a"><span>A</span></div><div className="map-point point-b"><span>!</span></div><div className="map-point point-c"><span>↗</span></div><div className="map-legend"><i className="legend-route" /> Practice routes <i className="legend-alert" /> Key points</div><div className="map-control">+</div><div className="map-control map-control-minus">−</div></div></div></section>
      <section className="route-list-section"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">Choose your practice run</p><h2>Routes around {centre.name}</h2></div><span className="route-count">1 free route · {Math.max(routeCards.length - 1, 0)} premium routes</span></div><div className="reference-route-list">{routeCards.map((route) => <article className={`reference-route-card ${route.isLocked ? "is-locked" : "is-free"}`} key={route.slug}><div className="reference-route-icon" aria-hidden="true"><span /><span /></div><div className="reference-route-main"><div className="reference-route-title"><h3>{route.name}</h3><span className={`reference-route-badge ${route.isLocked ? "badge-locked" : "badge-free"}`}>{route.isLocked ? "Premium" : "Free"}</span></div><p className="reference-route-sequence">{route.sequence || "Route points are being prepared for this centre."}</p><div className="reference-route-meta"><span>⌁ {route.distanceKm ? `${route.distanceKm} km` : `${route.points.length} points`}</span><span>◷ {route.durationMin ?? 24} min</span></div></div><div className="reference-route-actions">{route.isLocked ? <Link className="route-action route-action-upgrade" href="/#pricing">Unlock route <span>↗</span></Link> : <>{route.googleMapsUrl && <a className="route-action route-action-maps" href={route.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps <span>↗</span></a>}<Link className="route-action route-action-primary" href={`/routes/${route.slug}`}>View route <span>→</span></Link></>}</div></article>)}</div><p className="route-list-note">Practice routes are designed to help you recognise likely road situations. Your official test route may be different.</p></div></section>
    </main>
  );
}
