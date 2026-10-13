"use client";
import { useState } from "react";
import { authFetch } from "../../lib/clientSession";
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export default function PointMediaUpload({ pointId, refresh }: { pointId: string; refresh: () => Promise<void> }) {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  return <label>Upload an owned/licensed image or video (max 15 MB)<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 15 * 1024 * 1024) { setMessage("File exceeds 15 MB."); return; } setBusy(true); try { const form = new FormData(); form.set("file", file); form.set("routePointId", pointId); const r = await authFetch(`${API}/admin/media/upload-file`, { method: "POST", body: form }); const p = await r.json(); if (!r.ok) throw Error(p.message); const saved = await authFetch(`${API}/admin/points/${pointId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(file.type.startsWith("video/") ? { videoUrl: p.publicUrl } : { imageUrl: p.publicUrl }) }); if (!saved.ok) throw Error("Uploaded; linking to point failed. Retry using the returned media URL."); setMessage("Media linked. Route returned to draft for review."); await refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); event.target.value = ""; } }} /><small role="status">{message}</small></label>;
}
