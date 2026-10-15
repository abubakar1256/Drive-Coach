"use client";

import { useEffect, useRef } from "react";
import { useCurrentLocale } from "../../lib/useLocale";

export default function GpsConsentDialog({ open, routeLabel, starting, onEnable, onWithoutGps, onClose }: { open: boolean; routeLabel: string; starting: boolean; onEnable: () => void; onWithoutGps: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const nl = useCurrentLocale() === "nl";
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); else if (!open && dialog.open) dialog.close(); }, [open]);
  return <dialog ref={ref} className="gps-consent-dialog" aria-labelledby="gps-consent-heading" aria-describedby="gps-consent-description" onCancel={onClose}>
    <div className="gps-consent-top"><span className="gps-consent-icon" aria-hidden="true">⌖</span><button type="button" className="gps-dialog-close" aria-label={nl ? "Sluiten" : "Close"} onClick={onClose}>×</button></div>
    <span className="small-label">{routeLabel} · {nl ? "KLAAR VOOR VERTREK" : "READY WHEN YOU ARE"}</span>
    <h2 id="gps-consent-heading">{nl ? "Je route. Je live positie." : "Your route. Your live position."}</h2>
    <p id="gps-consent-description">{nl ? "Schakel locatie in om jezelf op de kaart te zien en je routevoortgang bij te houden. Je browser vraagt hierna om locatietoestemming." : "Enable location to see yourself on the map and record your route progress. Your browser will ask for location permission next."}</p>
    <div className="gps-consent-privacy"><span aria-hidden="true">◎</span><p>{nl ? "Je precieze locatie wordt tijdens GPS-tracking naar Drive Coach verzonden en opgeslagen voor deze oefensessie. Je kunt tracking op elk moment stoppen." : "While GPS tracking is on, your precise location is sent to Drive Coach and stored for this practice session. You can stop tracking at any time."}</p></div>
    <p>{nl ? "Ook afwijkende of onnauwkeurige GPS-punten kunnen worden bewaard om signaalkwaliteit en mogelijke routeafwijkingen in je privéritverslag te tonen. Dit bewijst geen rijfouten." : "Off-route and low-accuracy samples may also be stored to explain GPS quality and possible route deviations in your private after-drive report. This does not prove driving mistakes."}</p>
    <button type="button" className="gps-consent-enable" onClick={onEnable}>{nl ? "Locatie inschakelen en doorgaan" : "Enable location & continue"}<span aria-hidden="true">↗</span></button>
    <button type="button" className="gps-consent-skip" onClick={onWithoutGps}>{starting ? (nl ? "Oefenen zonder GPS" : "Practise without GPS") : (nl ? "GPS uit laten" : "Keep GPS off")}</button>
    <small>{nl ? "Stel alles in terwijl je veilig geparkeerd staat. Zonder GPS wordt geen routevoltooiing gemeten." : "Set up while safely parked. Without GPS, route completion cannot be measured."}</small>
  </dialog>;
}
