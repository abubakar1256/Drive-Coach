import type { Metadata } from "next";
import CentreRouteCatalog from "../CentreRouteCatalog";
import CentreOverviewMap from "../CentreOverviewMap";
import Link from "next/link";
import { notFound } from "next/navigation";
import { centres, getCentre } from "../../../lib/data";
import { apiCentreToCentre, getCentreBySlug } from "../../../lib/api";
import AccountNavLink from "../../../app/AccountNavLink";
import PageViewTracker from "../../../app/PageViewTracker";
import LanguageSwitcher from "../../../app/LanguageSwitcher";
import MobileMenu from "../../../app/MobileMenu";
import LocalizedNavLinks, { LocalizedNavText } from "../../../app/LocalizedNavLinks";
import { belgianRegionLabel } from "../../../lib/belgianRegions";
import { localizeCentre } from "../../../lib/localizeContent";
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

  // Never manufacture seven identical routes when no real route is published.
  const availableRoutes = apiCentre?.routes ?? [];
  const featuredRoute = availableRoutes[0];
  const routeCards = availableRoutes;
  const copy = siteCopy[locale].route;

  return (
    <main>
      <PageViewTracker eventType="CENTRE_VIEW" centreSlug={params.slug} />
      <nav className="nav shell inner-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><LocalizedNavLinks items={[{ href: "/#how-it-works", label: "howItWorks" }, { href: "/centres", label: "testCentres" }, { href: "/#pricing", label: "pricing" }]} /><div className="nav-actions"><LanguageSwitcher /><AccountNavLink /><Link className="button button-small" href="/#pricing"><LocalizedNavText item="viewPlans" /> <span>↗</span></Link></div><MobileMenu links={[{ href: "/#how-it-works", label: "How it works" }, { href: "/centres", label: "Test centres" }, { href: "/#pricing", label: "Pricing" }, { href: "/account", label: "My account" }]} /></nav>
      <section className="centre-detail-hero"><div className="shell"><Link className="back-link" href="/centres">← {copy.allCentres}</Link><div className="centre-detail-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {belgianRegionLabel(centre.region, locale)}</p><h1>{centre.name}</h1><p>{centre.area}, {centre.city}</p></div><div className="centre-detail-stat"><strong>{routeCards.length}</strong><span>{copy.practiceRoutes}</span></div></div></div></section>
      <section className="shell centre-detail-body"><div className="centre-detail-copy"><p className="eyebrow">{locale === "nl" ? "Bereid je voor met context" : "Prepare with context"}</p><h2>{locale === "nl" ? <>Weet wat<br /><span>je kunt verwachten.</span></> : <>Know what<br /><span>to expect.</span></>}</h2><p>{centre.description}</p><div className="highlight-list">{centre.highlights.map((highlight) => <div key={highlight}><span>✓</span>{highlight}</div>)}</div>{featuredRoute && <Link className="button" href={`/routes/${featuredRoute.slug}`}>{locale === "nl" ? "Eerste route openen" : "Open first route"} <span>↗</span></Link>}</div><div className="centre-detail-map"><div className="map-panel-label"><span><i /> {locale === "nl" ? "CENTRUMOVERZICHT" : "CENTRE OVERVIEW"}</span><strong>{centre.routes} {copy.practiceRoutes}</strong></div><CentreOverviewMap centre={centre} /></div></section>
      <CentreRouteCatalog initialCentre={apiCentre ?? { slug: centre.slug, name: centre.name, city: centre.city, area: centre.area, region: centre.region, description: centre.description, latitude: null, longitude: null, isPublished: true, routes: [] }} />
      <SiteFooter />
    </main>
  );
}
