"use client";
import Link from "next/link";
import type { PracticeStatus } from "../../lib/usePracticeStatus";
import { useCurrentLocale } from "../../lib/useLocale";
import "./practice-learning.css";
export default function PracticeStatusBadge({ item, accessible = false }: { item?: PracticeStatus; accessible?: boolean }) {
  const nl = useCurrentLocale() === "nl";
  if (!item) return null;
  return <div className="practice-status-badge"><span className={item.completedDrives ? "was-completed" : ""}>{item.completedDrives ? `✓ ${nl ? "Eerder voltooid" : "Completed before"}` : item.activeSessionId ? `◌ ${nl ? "Oefening actief" : "Practice in progress"}` : (nl ? "Eerdere oefening opgeslagen" : "Previous practice saved")}</span><small>{item.attempts} {nl ? "pogingen" : "attempts"} · {item.completedDrives} {nl ? "volledige routes" : "confirmed full routes"}</small>{item.completedAt && <Link href={`/practice/${encodeURIComponent(item.sessionId)}`}>{item.hasReflection || item.hasChecklist ? (nl ? "Bekijk feedback" : "View feedback") : (nl ? "Voeg reflectie toe" : "Add a reflection")} →</Link>}{accessible && <Link href={item.activeSessionId ? `/routes/${item.slug}#practice-controls` : `/routes/${item.slug}?repeatSessionId=${encodeURIComponent(item.sessionId)}#practice-controls`}>{item.activeSessionId ? (nl ? "Hervatten" : "Resume practice") : (nl ? "Zelfde versie herhalen" : "Repeat saved version")} ↗</Link>}</div>;
}
