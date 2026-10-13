"use client";

import { useEffect, useState } from "react";
import { useLocaleMessages } from "../../lib/useLocale";
import { authFetch } from "../../lib/clientSession";
import { useCurrentLocale } from "../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Notification = { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string };

export default function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const copy = useLocaleMessages();
  const locale = useCurrentLocale();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!window.sessionStorage.getItem("routepilot.accessToken")) return;
      try { const response = await authFetch(`${API}/me/notifications`); const payload = await response.json(); if (!response.ok) throw Error(payload.message ?? "Notifications unavailable"); if (!cancelled) { setItems(payload); setError(""); } }
      catch { if (!cancelled) setError("Unable to load notifications. Please retry."); }
    };
    void load(); const timer = window.setInterval(() => void load(), 60000);
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, []);

  async function markRead(id: string) {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    const response = await authFetch(`${API}/me/notifications/${id}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  return <section className="dashboard-card dashboard-wide notification-card"><div className="dashboard-card-title"><div><span className="small-label">{locale === "nl" ? "INBOX" : "INBOX"}</span><h2>{copy.usefulReminders}</h2></div><span className="history-caption">{items.filter((item) => !item.readAt).length} {copy.unread}</span></div>{error ? <p className="empty-dashboard">{error}</p> : items.length ? <div className="notification-list">{items.slice(0, 5).map((item) => <article className={`notification-row ${item.readAt ? "read" : ""}`} key={item.id}><span className="notification-dot" /><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" })}</small></div>{!item.readAt && <button type="button" onClick={() => void markRead(item.id)}>{locale === "nl" ? "Markeer als gelezen" : "Mark read"}</button>}</article>)}</div> : <div className="empty-dashboard"><p>{copy.noNotifications}</p></div>}</section>;
}
