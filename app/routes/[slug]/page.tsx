import type { Metadata } from "next";
import Link from "next/link";
import { centres } from "../../../lib/data";
import { getRouteBySlug, routeToCentre } from "../../../lib/api";
import { googleMapsRouteUrl, routeDistanceKm, routeSequence } from "../../../lib/route-utils";
import RouteExperience from "../RouteExperience";
import AccountNavLink from "../../../app/AccountNavLink";
import PageViewTracker from "../../../app/PageViewTracker";
import LanguageSwitcher from "../../../app/LanguageSwitcher";
import LocalizedNavLinks, { LocalizedNavText } from "../../../app/LocalizedNavLinks";

function getRouteContext(slug: string) {
  const centre = centres.find((item) => slug.startsWith(item.slug));
  return centre ?? centres[0];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const route = await getRouteBySlug(params.slug);
  const name = route?.name ?? "Driving test route";
  const centre = route?.centre.name ?? "your test centre";
  const description = `Study ${name} around ${centre} with route points, warnings and preparation guidance.`;
  return { title: `${name} at ${centre} | Drive Coach`, description, alternates: { canonical: `/routes/${params.slug}` }, openGraph: { title: `${name} at ${centre}`, description, url: `/routes/${params.slug}` } };
}

export default async function RoutePage({ params }: { params: { slug: string } }) {
  const fallbackCentre = getRouteContext(params.slug);
  const apiRoute = await getRouteBySlug(params.slug);
  const centre = apiRoute ? routeToCentre(apiRoute, fallbackCentre) : fallbackCentre;
  const routeName = apiRoute?.name ?? "Route 04";
  const duration = apiRoute?.durationMin ?? 24;
  const routePoints = apiRoute?.points ?? centre.routePoints;
  const sequence = routeSequence(routePoints);
  const distanceKm = routeDistanceKm(routePoints);
  const googleMapsUrl = googleMapsRouteUrl(routePoints);
  return (
    <main>
      <PageViewTracker eventType="ROUTE_VIEW" centreSlug={centre.slug} routeSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/#how-it-works", label: "howItWorks" }, { href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing"><LocalizedNavText item="unlockFullAccess" /> <span>↗</span></Link></div><button className="menu-button" aria-label="Open navigation menu">☰</button></nav>
      <section className="route-detail shell"><Link className="back-link" href={`/centres/${centre.slug}`}>← {centre.name}</Link><div className="route-detail-head"><div><p className="eyebrow"><span className="eyebrow-dot" /> Route experience · {centre.area}</p><h1>{routeName}</h1><p className="route-meta">{distanceKm ? `${distanceKm} km` : `${routePoints.length} points`} <span>·</span> {duration} min <span>·</span> Updated recently</p></div><span className="route-access-pill">Preview mode</span></div><div className="route-sequence-panel"><div><span className="small-label">ROUTE SEQUENCE</span><p>{sequence || "Preview points will appear here when this route has been mapped."}</p></div>{googleMapsUrl && <a className="button button-small" href={googleMapsUrl} target="_blank" rel="noreferrer">Open in Google Maps <span>↗</span></a>}</div><RouteExperience centre={centre} routeId={apiRoute?.id} routeSlug={params.slug} /></section>
    </main>
  );
}
