"use client";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/clientSession";
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export default function PointMediaUpload({ pointId, refresh }: { pointId: string; refresh: () => Promise<void> }) {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState("OWNED"), [holder, setHolder] = useState(""), [licence, setLicence] = useState(""), [source, setSource] = useState(""), [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (!file) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => { setFile(null); setConfirmed(false); setMessage(""); }, [pointId]);
  async function upload() {
    if (!file || busy || !confirmed || !holder.trim() || !licence.trim()) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file); form.set("routePointId", pointId); form.set("rightsType", kind); form.set("rightsHolder", holder); form.set("licenseName", licence); form.set("permissionConfirmed", "true"); if (source.trim()) form.set("sourceUrl", source.trim());
      const r = await authFetch(`${API}/admin/media/upload-file`, { method: "POST", body: form }); const p = await r.json(); if (!r.ok) throw Error(Array.isArray(p.message) ? p.message.join(". ") : p.message);
      const saved = await authFetch(`${API}/admin/points/${pointId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(file.type.startsWith("video/") ? {videoUrl:p.publicUrl} : {imageUrl:p.publicUrl}) });
      if (!saved.ok) throw Error(`Upload saved with its rights record; linking failed. Asset reference: ${p.publicUrl}. Do not upload a duplicate; link this reference after review.`);
      setMessage("Media and rights record saved. Route returned to draft for content review."); setFile(null); setConfirmed(false); await refresh();
    } catch(e) { setMessage(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }
  return <fieldset className="media-rights-editor" disabled={busy}><legend>Point photo / video & usage rights</legend><p>Attach relevant difficult-point media that you own or have permission to publish. Do not upload competitor recordings or identifiable people without the necessary rights.</p><label>Image/video · maximum 15 MB<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={e => { const f=e.target.files?.[0]; if (!f) return; if (f.size>15*1024*1024) {setMessage("File exceeds 15 MB.");return;} setFile(f);setMessage(""); }} /></label>{preview && (file?.type.startsWith("video/") ? <video controls playsInline preload="metadata" src={preview} style={{maxWidth:"100%"}} /> : <img src={preview} alt="Selected point media preview" style={{maxWidth:"100%",maxHeight:250}} />)}<label>Usage basis<select value={kind} onChange={e=>{setKind(e.target.value);setConfirmed(false);}}><option value="OWNED">Our original media</option><option value="LICENSED">Third-party media with a licence</option></select></label><label>Rights holder<input maxLength={180} value={holder} onChange={e=>setHolder(e.target.value)} /></label><label>Licence or publication permission<input maxLength={180} value={licence} onChange={e=>setLicence(e.target.value)} placeholder="Original project media / licence name and version" /></label><label>Public source / licence reference {kind==="LICENSED"?"(required)":"(optional)"}<input type="url" maxLength={1000} value={source} onChange={e=>setSource(e.target.value)} placeholder="https://…" /></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />I confirm that these rights cover publication and the intended use in this platform.</label><button type="button" disabled={!file || !confirmed || !holder.trim() || !licence.trim() || (kind==="LICENSED"&&!source.trim())} onClick={()=>void upload()}>{busy?"Saving…":"Upload and link reviewed media"}</button><small role="status">{message}</small></fieldset>;
}
