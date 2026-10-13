"use client";
import { useCurrentLocale } from "../../lib/useLocale";

// Deliberately schematic, not imagery or evidence of the selected street.
export default function DrivingIllustration() {
  const nl = useCurrentLocale() === "nl";
  return <figure style={{ margin: 0, padding: 16, border: "1px solid #dce9df", borderRadius: 16, background: "#f4faf5" }}>
    <svg viewBox="0 0 480 260" role="img" aria-label={nl ? "Algemeen schema: kijk rondom de auto" : "Generic diagram: observe around the vehicle"} style={{ display: "block", width: "100%" }}>
      <rect width="480" height="260" rx="16" fill="#e6f3e9" />
      <path d="M155 0H325V260H155Z" fill="#49665e" />
      <path d="M240 0V60M240 205V260" stroke="#fff4cb" strokeWidth="5" strokeDasharray="14 14" />
      <path d="M213 143L70 40M268 143L410 40M210 165L83 222M270 165L397 222" stroke="#168264" strokeWidth="3" strokeDasharray="7 7" />
      <circle cx="240" cy="146" r="85" fill="none" stroke="#6dbb99" strokeWidth="2" />
      <rect x="212" y="100" width="56" height="98" rx="14" fill="#ff8a22" stroke="#fff" strokeWidth="3" />
      <rect x="220" y="115" width="40" height="28" rx="6" fill="#153e33" />
      <rect x="220" y="163" width="40" height="17" rx="4" fill="#153e33" />
      <circle cx="70" cy="40" r="14" fill="#fff" /><circle cx="410" cy="40" r="14" fill="#fff" />
      <circle cx="83" cy="222" r="14" fill="#fff" /><circle cx="397" cy="222" r="14" fill="#fff" />
      <text x="240" y="28" textAnchor="middle" fill="#fff" fontSize="14" fontFamily="sans-serif">{nl ? "KIJK VOORUIT" : "LOOK AHEAD"}</text>
    </svg>
    <figcaption style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: "#536e61" }}>{nl ? "Algemene oefenillustratie — geen foto van deze locatie. Controleer spiegels en dode hoeken wanneer nodig. Volg actuele borden en je instructeur." : "Generic practice illustration — not a photo of this location. Check mirrors and blind spots when needed. Follow current signs and your instructor."}</figcaption>
  </figure>;
}
