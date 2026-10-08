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
import { belgianRegionLabel } from "../../../lib/belgianRegions";
import { localizeCentre, localizeText } from "../../../lib/localizeContent";
import SiteFooter from "../../../app/SiteFooter";
import { getServerLocale } from "../../../lib/serverLocale";
import { siteCopy } from "../../../lib/siteCopy";

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
  const rawCentre = apiCentre ? apiCentreToCentre(apiCentre, staticCentre ?? centres[0]) : staticCentre ?? null;
  if (!rawCentre) notFound();
  const locale = getServerLocale();
  const centre = localizeCentre(rawCentre, locale);

  // Keep the centre experience useful while a centre's routes are still being
  // entered in the database. The reference journey presents seven routes per
  // centre, with the first route available and the remaining routes reserved
  // for premium access.
  const fallbackRouteNames = ["A", "B", "C", "D", "E", "F", "G"];
  const availableRoutes = apiCentre?.routes?.length ? apiCentre.routes : fallbackRouteNames.map((letter, index) => ({
    slug: `${centre.slug}-route-${letter.toLowerCase()}`,
    name: `Route ${letter}`,
    durationMin: index === 0 ? 23 : 22,
    points: centre.routePoints,
  }));
  const featuredRoute = availableRoutes[0];
  const routeCards = availableRoutes.map((route, index) => ({
    ...route,
    isLocked: index > 0,
    distanceKm: routeDistanceKm(route.points) ?? routeDistanceKm(centre.routeCoordinates.map(([longitude, latitude]) => ({ longitude, latitude }))),
    sequence: routeSequence(route.points),
    googleMapsUrl: googleMapsRouteUrl(route.points) ?? googleMapsRouteUrl(centre.routeCoordinates.map(([longitude, latitude]) => ({ longitude, latitude }))),
  }));
  const copy = siteCopy[locale].route;

  return (
    <main>
      <PageViewTracker eventType="CENTRE_VIEW" centreSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/#how-it-works", label: "howItWorks" }, { href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing"><LocalizedNavText item="viewPlans" /> <span>↗</span></Link></div><MobileMenu links={[{ href: "/#how-it-works", label: "How it works" }, { href: "/centres", label: "Test centres" }, { href: "/#pricing", label: "Pricing" }, { href: "/account", label: "My account" }]} /></nav>
      <section className="centre-detail-hero"><div className="shell"><Link className="back-link" href="/centres">← {copy.allCentres}</Link><div className="centre-detail-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {belgianRegionLabel(centre.region, locale)}</p><h1>{centre.name}</h1><p>{centre.area}, {centre.city}</p></div><div className="centre-detail-stat"><strong>{routeCards.length}</strong><span>{copy.practiceRoutes}</span></div></div></div></section>
      <section className="shell centre-detail-body"><div className="centre-detail-copy"><p className="eyebrow">{locale === "nl" ? "Bereid je voor met context" : "Prepare with context"}</p><h2>{locale === "nl" ? <>Weet wat<br /><span>je kunt verwachten.</span></> : <>Know what<br /><span>to expect.</span></>}</h2><p>{centre.description}</p><div className="highlight-list">{centre.highlights.map((highlight) => <div key={highlight}><span>✓</span>{highlight}</div>)}</div><Link className="button" href={`/routes/${featuredRoute.slug}`}>{locale === "nl" ? "Eerste route openen" : "Open first route"} <span>↗</span></Link></div><div className="centre-detail-map"><div className="map-panel-label"><span><i /> {locale === "nl" ? "CENTRUMOVERZICHT" : "CENTRE OVERVIEW"}</span><strong>{centre.routes} {copy.practiceRoutes}</strong></div><div className="route-map large-map"><div className="map-grid" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-road road-four" /><div className="map-route" /><div className="map-point point-a"><span>A</span></div><div className="map-point point-b"><span>!</span></div><div className="map-point point-c"><span>↗</span></div><div className="map-legend"><i className="legend-route" /> {copy.practiceRoutes} <i className="legend-alert" /> {copy.keyPoints}</div><div className="map-control">+</div><div className="map-control map-control-minus">−</div></div></div></section>
      <section className="route-list-section"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">{copy.chooseRun}</p><h2>{copy.around} {centre.name}</h2></div><span className="route-count">1 {copy.freeRoute} · {Math.max(routeCards.length - 1, 0)} {copy.premiumRoutes}</span></div><div className="reference-route-list">{routeCards.map((route) => <article className={`reference-route-card ${route.isLocked ? "is-locked" : "is-free"}`} key={route.slug}><div className="reference-route-icon" aria-hidden="true"><span /><span /></div><div className="reference-route-main"><div className="reference-route-title"><h3>{route.name}</h3><span className={`reference-route-badge ${route.isLocked ? "badge-locked" : "badge-free"}`}>{route.isLocked ? "Premium" : locale === "nl" ? "Gratis" : "Free"}</span></div><p className="reference-route-sequence">{localizeText(route.sequence || copy.routePreparing, locale)}</p><div className="reference-route-meta"><span>⌁ {route.distanceKm ? `${route.distanceKm} km` : `${route.points.length} ${locale === "nl" ? "punten" : "points"}`}</span><span>◷ {route.durationMin ?? 24} {locale === "nl" ? "min" : "min"}</span></div></div><div className="reference-route-actions">{route.isLocked ? <Link className="route-action route-action-upgrade" href="/#pricing">{copy.unlockRoute} <span>↗</span></Link> : <>{route.googleMapsUrl && <a className="route-action route-action-maps" href={route.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps <span>↗</span></a>}<Link className="route-action route-action-primary" href={`/routes/${route.slug}`}>{copy.viewRoute} <span>→</span></Link></>}</div></article>)}</div><p className="route-list-note">{copy.disclaimer}</p></div></section>
      <SiteFooter />
    </main>
  );
}
