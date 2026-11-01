"use client";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/clientSession";
type Rights = { rightsHolder: string; licenseName: string; sourceUrl: string | null; verification: string };
export default function RouteMediaRights({ imageUrl, videoUrl }: { imageUrl?: string | null; videoUrl?: string | null }) {
  const [records,setRecords]=useState<Array<{id:string;rights:Rights|null}>>([]),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false;const abort=new AbortController();setRecords([]);
    const ids=[...new Set([imageUrl,videoUrl].map(u=>u?.match(/^\/api\/v1\/media\/([a-zA-Z0-9-]+)$/)?.[1]).filter(Boolean))] as string[];
    void Promise.all(ids.map(async id=>{const r=await authFetch(`${process.env.NEXT_PUBLIC_API_URL??"/api/v1"}/media/${id}/description`,{cache:"no-store",signal:abort.signal});if(!r.ok)throw Error();return r.json();})).then(rows=>{if(!cancelled)setRecords(rows);}).catch(()=>{});
    const changed=()=>{cancelled=true;abort.abort();setRecords([]);setRevision(n=>n+1);};window.addEventListener("routepilot-auth-change",changed);
    return()=>{cancelled=true;abort.abort();window.removeEventListener("routepilot-auth-change",changed);};
  },[imageUrl,videoUrl,revision]);
  return <details className="route-media-rights"><summary>Media attribution & context</summary>{records.length?records.map(r=><p key={r.id}>{r.rights?<>{r.rights.rightsHolder} · {r.rights.licenseName}{r.rights.sourceUrl&&<> · <a href={r.rights.sourceUrl} target="_blank" rel="noreferrer">Source / licence ↗</a></>}<br/><small>Rights declared by the uploader, not independently certified.</small></>:"Legacy asset: no usage-rights record is attached. Content editors should review its provenance."}</p>):<p>A readable usage-rights record is not available for this media.</p>}<p>Images/videos do not certify current traffic signs, access or road conditions. Review the current situation with your accompanying person.</p></details>;
}
