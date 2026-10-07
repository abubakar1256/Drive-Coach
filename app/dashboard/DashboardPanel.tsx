"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationsPanel from "./NotificationsPanel";
import PartnershipPanel from "./PartnershipPanel";
import { useLocaleMessages } from "../../lib/useLocale";
import { useCurrentLocale, useSiteCopy } from "../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type DashboardData = {
  user: { email: string; displayName: string | null; createdAt: string };
  subscription: { status: string; plan: string; expiresAt: string | null };
  stats: { favoriteCount: number; sessionCount: number; completedSessions: number; averageProgress: number };
  favorites: Array<{ routeId: string; slug: string; name: string; centreName: string; city: string; durationMin: number | null; pointCount: number }>;
  sessions: Array<{ id: string; routeId: string; startedAt: string; completedAt: string | null; completionPct: number; route: { slug: string; name: string; centreName: string }; reflection?: { flaggedSpeeding?: boolean; missedRightOfWay?: boolean; observedSpeedKph?: number | null; speedLimitKph?: number | null } }>;
  recommendations: Array<{ skill: string; message: string }>;
};

export default function DashboardPanel() {
  const router = useRouter();
  const copy = useLocaleMessages();
  const locale = useCurrentLocale();
  const dashboardCopy = useSiteCopy().dashboard;
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    fetch(`${API}/me/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? (locale === "nl" ? "Je sessie is verlopen. Log opnieuw in." : "Your session has expired. Please log in again."));
        setData(payload as DashboardData);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : locale === "nl" ? "Je dashboard kon niet worden geladen." : "Unable to load your dashboard."))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="dashboard-state">{locale === "nl" ? "Je voorbereidingsruimte wordt geladen…" : "Loading your preparation space…"}</div>;
  if (error || !data) return <div className="dashboard-state dashboard-error"><strong>{error || (locale === "nl" ? "Dashboard niet beschikbaar" : "Dashboard unavailable")}</strong><Link className="button button-small" href="/auth/login">{locale === "nl" ? "Opnieuw inloggen" : "Log in again"} <span>↗</span></Link></div>;

  const firstName = data.user.displayName?.split(" ")[0] || "there";
  return <div className="dashboard-content">
    <div className="dashboard-welcome">{copy.prepareSpace}, <strong>{firstName}.</strong><span>{data.user.email}</span></div>
    <div className="dashboard-stats">
      <div><strong>{data.stats.favoriteCount}</strong><span>{copy.savedRoutes}</span></div>
      <div><strong>{data.stats.sessionCount}</strong><span>{copy.practiceSessions}</span></div>
      <div><strong>{data.stats.completedSessions}</strong><span>{copy.completedDrives}</span></div>
      <div><strong>{data.stats.averageProgress}%</strong><span>{copy.averageProgress}</span></div>
    </div>
    <div className="dashboard-grid">
      <section className="dashboard-card recommendation-card"><div className="dashboard-card-title"><div><span className="small-label">{copy.yourNextFocus.toUpperCase()}</span><h2>{dashboardCopy.smallHabits}</h2></div><span className="dashboard-icon">✦</span></div><div className="recommendation-list">{data.recommendations.map((item) => <article key={item.skill}><span>→</span><div><strong>{item.skill}</strong><p>{item.message}</p></div></article>)}</div></section>
      <section className="dashboard-card subscription-dashboard-card"><span className="small-label">{dashboardCopy.access}</span><h2>{data.subscription.plan}</h2><p>{data.subscription.status === "ACTIVE" && data.subscription.plan !== "Free" ? dashboardCopy.premiumActive : dashboardCopy.freeActive}</p><Link className="button button-small" href={data.subscription.plan === "Free" ? "/#pricing" : "/account"}>{data.subscription.plan === "Free" ? dashboardCopy.viewPlans : dashboardCopy.manageAccount} <span>↗</span></Link></section>
      <section className="dashboard-card dashboard-wide"><div className="dashboard-card-title"><div><span className="small-label">{copy.savedRoutes.toUpperCase()}</span><h2>{copy.savedRoutesTitle}</h2></div><Link href="/centres">{copy.browseAll} ↗</Link></div>{data.favorites.length ? <div className="saved-route-list">{data.favorites.map((favorite) => <Link className="saved-route" href={`/routes/${favorite.slug}`} key={favorite.routeId}><span className="saved-route-pin">↗</span><span><strong>{favorite.name}</strong><small>{favorite.centreName} · {favorite.pointCount} {dashboardCopy.attentionPoints}{favorite.durationMin ? ` · ${favorite.durationMin} min` : ""}</small></span><span className="saved-route-arrow">→</span></Link>)}</div> : <div className="empty-dashboard"><p>{dashboardCopy.noSaved}</p><Link href="/centres">{dashboardCopy.findCentre} ↗</Link></div>}</section>
      <section className="dashboard-card dashboard-wide"><div className="dashboard-card-title"><div><span className="small-label">{copy.practiceHistory.toUpperCase()}</span><h2>{copy.recentDrives}</h2></div><span className="history-caption">{dashboardCopy.reflect}</span></div>{data.sessions.length ? <div className="session-list">{data.sessions.map((session) => <div className="session-row" key={session.id}><div className="session-date">{new Date(session.startedAt).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" })}</div><div className="session-route"><strong>{session.route.name}</strong><small>{session.route.centreName}{session.reflection?.observedSpeedKph && session.reflection.speedLimitKph ? ` · ${session.reflection.observedSpeedKph}/${session.reflection.speedLimitKph} km/h noted` : session.reflection?.flaggedSpeeding ? (locale === "nl" ? " · focus op snelheid" : " · speed focus") : ""}</small></div><div className="session-progress"><span><i style={{ width: `${session.completionPct}%` }} /></span><small>{session.completionPct}%{session.completedAt ? ` · ${dashboardCopy.complete}` : ` · ${dashboardCopy.inProgress}`}</small></div><Link href={`/routes/${session.route.slug}`}>{locale === "nl" ? "Openen" : "Open"} →</Link></div>)}</div> : <div className="empty-dashboard"><p>{locale === "nl" ? "Je eerste oefenrit verschijnt hier." : "Your first practice drive will appear here."}</p><Link href="/centres">{locale === "nl" ? "Start een oefenrit" : "Start a session"} ↗</Link></div>}</section>
    </div>
    <NotificationsPanel />
    <PartnershipPanel />
  </div>;
}
