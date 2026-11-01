"use client";
import Link from "next/link";
import { usePracticeStatus } from "../../lib/usePracticeStatus";
import PracticeStatusBadge from "../practice/PracticeStatusBadge";
export default function PracticeJourney() {
  const { items, loading, error, refresh } = usePracticeStatus();
  return <section className="practice-journey" aria-labelledby="practice-journey-heading"><header><div><span className="small-label">PRACTISE · REFLECT · RETURN</span><h2 id="practice-journey-heading">Your route learning journal</h2><p>A new attempt keeps your previous reports. Full-route completion measures route following, not driving ability.</p></div><Link className="button button-muted" href="/centres">Choose a route ↗</Link></header>{loading ? <p role="status">Loading your practice history…</p> : error ? <p role="status">Practice history unavailable. <button onClick={refresh}>Retry</button></p> : !items.length ? <p>Start your first practice to build a journal. GPS is optional; a drive without GPS can still have a useful reflection.</p> : <div className="practice-journal-grid">{items.map(item => <article key={item.routeId}><h3>{item.name}</h3><small>{new Date(item.startedAt).toLocaleDateString()}</small><PracticeStatusBadge item={item} /><Link href={`/routes/${item.slug}#practice-controls`}>Open route & check current access →</Link></article>)}</div>}</section>;
}
