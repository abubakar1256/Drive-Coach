"use client";

import { useState } from "react";

const checks = ["Adjust your seat, mirrors and head restraint.", "Fasten seat belts; check passengers are ready.", "Secure your phone. Set navigation before moving.", "Review signs, junctions and vulnerable road users on this route."];
export default function DrivePreparation({ active, feedback, paid }: { active: boolean; feedback: { status: string; distanceFromRouteM: number | null; speedKph?: number | null } | null; paid: boolean }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [voice, setVoice] = useState("");
  const status = feedback?.status === "possible_deviation" ? "Possible route deviation" : feedback?.status === "near_route" ? "GPS near saved route" : feedback?.status === "weak_signal" ? "Weak GPS signal" : "Waiting for reliable GPS";
  return <section className="drive-preparation" aria-label="Driving preparation and GPS feedback">
    <details open={!active}><summary><span>01 · PREPARE</span><strong>Ready, focused, safely parked</strong><small>{checked.length}/{checks.length} preparation checks</small></summary>
      <p>Preparation reminders—not a complete traffic-rule guide. Follow current signs and your instructor.</p>
      {checks.map(check => <label key={check}><input type="checkbox" checked={checked.includes(check)} disabled={active} onChange={e => setChecked(c => e.target.checked ? [...c, check] : c.filter(v => v !== check))} /><span>{check}</span></label>)}
      {paid && <button type="button" disabled={active} onClick={() => { if (!("speechSynthesis" in window)) { setVoice("Voice is unavailable in this browser."); return; } window.speechSynthesis.cancel(); const text = "Set up while safely parked. Follow current signs. Look ahead, check mirrors and blind spots before changing position, and give pedestrians and cyclists space. Do not interact with the screen while driving."; const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-GB"; window.speechSynthesis.speak(utterance); setVoice("Preparation reminder played. Route-specific hands-free guidance remains optional in Drive Coach Voice."); }}>Play preparation reminder ♪</button>}
      {voice && <small role="status">{voice}</small>}
    </details>
    {active && <div className={`drive-live-feedback ${feedback?.status === "possible_deviation" ? "is-caution" : ""}`}><span className="small-label">02 · GPS OBSERVATION</span><strong role="status">{status}</strong><div><span>Estimated speed</span><b>{feedback?.speedKph == null ? "—" : Math.round(feedback.speedKph)} km/h</b></div><small>Confidence: {feedback && feedback.status !== "weak_signal" ? "medium · GPS estimate" : "low · insufficient signal"}. {feedback?.distanceFromRouteM != null ? `${feedback.distanceFromRouteM} m from saved route. ` : ""}Not a confirmed driving mistake. Do not correct course unsafely.</small><p>No verified speed limits or calibrated motion sensors: overspeed, braking and acceleration are not assessed. Google Maps/backgrounding may interrupt recording.</p></div>}
  </section>;
}
