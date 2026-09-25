import type { Metadata } from "next";
import Link from "next/link";
import { centres } from "../../../lib/data";
import { getRouteBySlug, routeToCentre } from "../../../lib/api";
import RouteExperience from "../RouteExperience";
import AccountNavLink from "../../../app/AccountNavLink";
import PageViewTracker from "../../../app/PageViewTracker";
import LanguageSwitcher from "../../../app/LanguageSwitcher";

function getRouteContext(slug: string) {
  const centre = centres.find((item) => slug.startsWith(item.slug));
  return centre ?? centres[0];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const route = await getRouteBySlug(params.slug);
  const name = route?.name ?? "Driving test route";
  const centre = route?.centre.name ?? "your test centre";
  const description = `Study ${name} around ${centre} with route points, warnings and preparation guidance.`;
  return { title: `${name} at ${centre} | RoutePilot`, description, alternates: { canonical: `/routes/${params.slug}` }, openGraph: { title: `${name} at ${centre}`, description, url: `/routes/${params.slug}` } };
}

export default async function RoutePage({ params }: { params: { slug: string } }) {
  const fallbackCentre = getRouteContext(params.slug);
  const apiRoute = await getRouteBySlug(params.slug);
  const centre = apiRoute ? routeToCentre(apiRoute, fallbackCentre) : fallbackCentre;
  const routeName = apiRoute?.name ?? "Route 04";
  const duration = apiRoute?.durationMin ?? 24;
  return (
    <main>
      <PageViewTracker eventType="ROUTE_VIEW" centreSlug={centre.slug} routeSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></Link><div className="nav-links"><Link href="/#how-it-works">How it works</Link><Link href="/centres">Test centres</Link><Link href="/#pricing">Pricing</Link></div><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing">Unlock full access <span>↗</span></Link></div><button className="menu-button" aria-label="Open navigation menu">☰</button></nav>
      <section className="route-detail shell"><Link className="back-link" href={`/centres/${centre.slug}`}>← {centre.name}</Link><div className="route-detail-head"><div><p className="eyebrow"><span className="eyebrow-dot" /> Route experience · {centre.area}</p><h1>{routeName}</h1><p className="route-meta">{duration} min <span>·</span> {centre.routePoints.length} preview points <span>·</span> Updated recently</p></div><span className="route-access-pill">Preview mode</span></div><RouteExperience centre={centre} routeId={apiRoute?.id} routeSlug={params.slug} /></section>
    </main>
  );
}
