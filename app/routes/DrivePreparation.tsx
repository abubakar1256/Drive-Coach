"use client";

import { useState } from "react";
import { useCurrentLocale } from "../../lib/useLocale";

const checks = [
  { en: "Adjust your seat, mirrors and head restraint.", nl: "Stel je stoel, spiegels en hoofdsteun af." },
  { en: "Fasten seat belts; check passengers are ready.", nl: "Doe je gordel om en controleer of je passagiers klaar zijn." },
  { en: "Secure your phone. Set navigation before moving.", nl: "Zet je telefoon vast. Stel de navigatie in voor vertrek." },
  { en: "Review signs, junctions and vulnerable road users on this route.", nl: "Bekijk de verkeersborden en kruispunten en let op kwetsbare weggebruikers." },
];

export default function DrivePreparation({ active, feedback, paid }: { active: boolean; feedback: { status: string; distanceFromRouteM: number | null; speedKph?: number | null } | null; paid: boolean }) {
  const locale = useCurrentLocale();
  const nl = locale === "nl";
  const [checked, setChecked] = useState<number[]>([]);
  const [voice, setVoice] = useState<"played" | "unavailable">();
  const status = feedback?.status === "possible_deviation"
    ? (nl ? "Mogelijke routeafwijking" : "Possible route deviation")
    : feedback?.status === "near_route"
      ? (nl ? "GPS-positie nabij de opgeslagen route" : "GPS near saved route")
      : feedback?.status === "weak_signal"
        ? (nl ? "Zwak GPS-signaal" : "Weak GPS signal")
        : (nl ? "Wachten op betrouwbare GPS" : "Waiting for reliable GPS");

  function playReminder() {
    if (!("speechSynthesis" in window)) {
      setVoice("unavailable");
      return;
    }
    const text = nl
      ? "Stel alles in terwijl je veilig geparkeerd staat. Volg de actuele verkeersborden. Kijk vooruit, controleer je spiegels en dode hoeken als je van positie verandert en geef voetgangers en fietsers ruimte. Bedien je scherm niet tijdens het rijden."
      : "Set up while safely parked. Follow current signs. Look ahead, check mirrors and blind spots before changing position, and give pedestrians and cyclists space. Do not interact with the screen while driving.";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = nl ? "nl-BE" : "en-GB";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setVoice("played");
  }

  return <section className="drive-preparation" aria-label={nl ? "Voorbereiding en GPS-feedback" : "Driving preparation and GPS feedback"}>
    <details open={!active}>
      <summary>
        <span>{nl ? "01 · VOORBEREIDEN" : "01 · PREPARE"}</span>
        <strong>{nl ? "Veilig geparkeerd klaar voor vertrek" : "Ready, focused, safely parked"}</strong>
        <small>{checked.length}/{checks.length} {nl ? "voorbereidingspunten" : "preparation checks"}</small>
      </summary>
      <p>{nl ? "Volg de actuele verkeersborden en de aanwijzingen van je begeleider." : "Follow current signs and your instructor."}</p>
      {checks.map((check, index) => <label key={check.en}>
        <input type="checkbox" checked={checked.includes(index)} disabled={active}
          onChange={e => {
            const isChecked = e.target.checked;
            setChecked(current => isChecked ? [...current, index] : current.filter(value => value !== index));
          }} />
        <span>{check[locale]}</span>
      </label>)}
      {paid && <button type="button" disabled={active} onClick={playReminder}>{nl ? "Luister naar de voorbereiding" : "Play preparation reminder"} ♪</button>}
      {voice && <small role="status">{voice === "played"
        ? (nl ? "Voorbereidingsherinnering afgespeeld." : "Preparation reminder played.")
        : (nl ? "Gesproken begeleiding is niet beschikbaar in deze browser." : "Voice is unavailable in this browser.")}</small>}
    </details>
    {active && <div className={`drive-live-feedback ${feedback?.status === "possible_deviation" ? "is-caution" : ""}`}>
      <span className="small-label">{nl ? "02 · GPS-OBSERVATIE" : "02 · GPS OBSERVATION"}</span>
      <strong role="status">{status}</strong>
      <div><span>{nl ? "Geschatte snelheid" : "Estimated speed"}</span><b>{feedback?.speedKph == null ? "—" : Math.round(feedback.speedKph)} km/h</b></div>
      <small>{nl ? "Betrouwbaarheid" : "Confidence"}: {feedback && feedback.status !== "weak_signal"
        ? (nl ? "gemiddeld · GPS-schatting" : "medium · GPS estimate")
        : (nl ? "laag · onvoldoende signaal" : "low · insufficient signal")}. {feedback?.distanceFromRouteM != null
        ? (nl ? `${feedback.distanceFromRouteM} m van de opgeslagen route. ` : `${feedback.distanceFromRouteM} m from saved route. `)
        : ""}{nl ? "Dit bevestigt geen rijfout. Corrigeer je route alleen als dat veilig kan." : "Not a confirmed driving mistake. Correct your course only when safe."}</small>
      <p>{nl
        ? "Snelheidsovertredingen, remmen en optrekken worden niet beoordeeld. Wisselen naar Google Maps kan de registratie pauzeren."
        : "There is no verified speed limit or calibrated motion data, so overspeed, braking and acceleration are not assessed. Switching to Google Maps may pause recording."}</p>
    </div>}
  </section>;
}
