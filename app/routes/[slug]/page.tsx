import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { centres } from "../../../lib/data";
import { getRouteBySlug, getCentreBySlug, routeToCentre } from "../../../lib/api";
import { routeProgression } from "../../../lib/route-progression";
import RouteExperience from "../RouteExperience";
import PlanAccessLink from "../../PlanAccess";
import AccountNavLink from "../../../app/AccountNavLink";
import PageViewTracker from "../../../app/PageViewTracker";
import LanguageSwitcher from "../../../app/LanguageSwitcher";
import LocalizedNavLinks from "../../../app/LocalizedNavLinks";
import SiteFooter from "../../../app/SiteFooter";
import { getServerLocale } from "../../../lib/serverLocale";
import { siteCopy } from "../../../lib/siteCopy";
import { localizeCentre } from "../../../lib/localizeContent";
import MobileMenu from "../../../app/MobileMenu";

function getRouteContext(slug: string) {
  const centre = centres.find((item) => slug.startsWith(item.slug));
  return centre ?? centres[0];
}

function fallbackRouteName(slug: string) {
  const routeSuffix = slug.match(/-route-(.+)$/i)?.[1];
  return routeSuffix ? `Route ${routeSuffix.toUpperCase()}` : "Route 04";
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const route = await getRouteBySlug(params.slug);
  const name = route?.name ?? fallbackRouteName(params.slug);
  const centre = route?.centre.name ?? "your test centre";
  const description = `Study ${name} around ${centre} with route points, warnings and preparation guidance.`;
  return { title: `${name} at ${centre} | Drive Coach`, description, alternates: { canonical: `/routes/${params.slug}` }, openGraph: { title: `${name} at ${centre}`, description, url: `/routes/${params.slug}` } };
}

export default async function RoutePage({ params }: { params: { slug: string } }) {
  const fallbackCentre = getRouteContext(params.slug);
  const apiRoute = await getRouteBySlug(params.slug);
  if (!apiRoute) notFound();
  const locale = getServerLocale();
  const centre = localizeCentre(apiRoute ? routeToCentre(apiRoute, fallbackCentre) : fallbackCentre, locale);
  const catalogue = await getCentreBySlug(apiRoute.centre.slug);
  const steps = (catalogue?.routes ?? []).map(route => ({ slug: route.slug, label: route.label ?? route.name, isFree: route.isFree === true }));
  const progression = routeProgression(steps, params.slug);
  const routeName = progression.current?.label ?? apiRoute.name;


  const copy = siteCopy[locale].route;
  return (
    <main>
      <PageViewTracker eventType="ROUTE_VIEW" centreSlug={centre.slug} routeSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/#how-it-works", label: "howItWorks" }, { href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><PlanAccessLink unlock /></div><MobileMenu links={[{ href: "/#how-it-works", label: "How it works" }, { href: "/centres", label: "Test centres" }, { href: "/#pricing", label: "Pricing" }, { href: "/account", label: "My account" }]} /></nav>
      <section className="route-detail shell"><Link className="back-link" href={`/centres/${centre.slug}`}>← {centre.name}</Link><div className="route-detail-head"><div><p className="eyebrow"><span className="eyebrow-dot" /> {copy.routeExperience} · {centre.area}</p><h1>{routeName}</h1></div></div>{apiRoute.sourceLabel && <p className="route-list-note">{apiRoute.sourceLabel}</p>}<RouteExperience key={params.slug} centre={centre} routeId={apiRoute.id} initialDriving={apiRoute.driving} routeSlug={params.slug} routeLabel={routeName} nextRoute={progression.next} /></section>
      <SiteFooter />
    </main>
  );
}
