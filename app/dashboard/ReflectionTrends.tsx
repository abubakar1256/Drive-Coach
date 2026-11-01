import Link from "next/link";
import { useCurrentLocale } from "../../lib/useLocale";

export type ReflectionTrend = {
  sessionCount: number; windowDays: number; recentSessionCount: number; previousSessionCount: number;
  selectedLevel: string; suggestedLevel: string | null; reason: string; limitation: string;
  skills: Array<{ code: string; status: string; recentDifficultySessions: number; previousDifficultySessions: number; recentGoodSessions: number; assessedSessions: number; basis: string[] }>;
};
const names: Record<string, [string, string]> = {
  speed: ["Speed awareness", "Snelheidsbewustzijn"], priority: ["Priority", "Voorrang"], roundabouts: ["Roundabouts", "Rotondes"],
  junctions: ["Junctions", "Kruispunten"], lanes: ["Lane choice", "Rijstrookkeuze"], observation: ["Observation", "Observeren"],
  parking: ["Manoeuvres", "Manoeuvres"], vulnerable: ["Vulnerable road users", "Kwetsbare weggebruikers"], merging: ["Merging", "Invoegen"],
  control: ["Vehicle control", "Voertuigbeheersing"], signs: ["Signs and signals", "Borden en signalen"], space: ["Space and distance", "Ruimte en afstand"],
};
export default function ReflectionTrends({ trend }: { trend: ReflectionTrend | null | undefined }) {
  const nl = useCurrentLocale() === "nl";
  if (!trend) return null;
  const level = (value: string) => ({ BEGINNER: nl ? "Beginner" : "Beginner", INTERMEDIATE: nl ? "Gemiddeld" : "Intermediate", DIFFICULT: nl ? "Uitdagend" : "Difficult" }[value] ?? value);
  return <section className="reflection-trends" aria-labelledby="reflection-trends-heading">
    <header><div><span className="small-label">{nl ? "JOUW GERAPPORTEERDE ERVARING" : "YOUR REPORTED EXPERIENCE"}</span><h3 id="reflection-trends-heading">{nl ? "Patronen in je oefenritten" : "Patterns across your practice drives"}</h3></div><span>{trend.sessionCount}/12 {nl ? "ritten · laatste 90 dagen" : "drives · last 90 days"}</span></header>
    <p>{nl ? "Zelfreflecties en feedback van je begeleider blijven herkenbaar. Een ontbrekende moeilijkheid telt niet als een goede beoordeling." : "Self-reflections and supervisor feedback stay labelled. An unreported difficulty does not count as a positive assessment."}</p>
    {trend.skills.length ? <div className="reflection-trend-grid">{trend.skills.map(skill => <article key={skill.code}>
      <strong>{names[skill.code]?.[nl ? 1 : 0] ?? skill.code}</strong>
      <span>{skill.recentDifficultySessions}/{trend.recentSessionCount} {nl ? "recente ritten: oefenpunt" : "recent drives: reported difficulty"}</span>
      <small>{nl ? "Vorige periode" : "Previous window"}: {skill.previousDifficultySessions}/{trend.previousSessionCount} · {nl ? "expliciet goed, recent" : "explicitly positive, recent"}: {skill.recentGoodSessions}</small>
      <b>{skill.status === "RECURRING" ? (nl ? "Terugkerend oefenpunt" : "Recurring preparation focus") : skill.status === "REPORTED_IMPROVEMENT" ? (nl ? "Gerapporteerde verbetering" : "Reported improvement") : skill.status === "REPORTED_FOCUS" ? (nl ? "Gerapporteerd oefenpunt" : "Reported preparation focus") : (nl ? "Onvoldoende bewijs voor een trend" : "Not enough evidence for a trend")}</b>
      <small>{skill.basis.map(b => b === "INSTRUCTOR_REPORTED" ? (nl ? "begeleider-gerapporteerd" : "instructor-reported") : (nl ? "zelf-gerapporteerd" : "self-reported")).join(" + ")}</small>
    </article>)}</div> : <p>{nl ? "Bewaar na je rit een reflectie of checklist om patronen op te bouwen." : "Save an after-drive reflection or checklist to start building patterns."}</p>}
    <div className="reflection-level-suggestion"><strong>{nl ? "Gekozen niveau" : "Chosen level"}: {level(trend.selectedLevel)}</strong>
      {trend.suggestedLevel ? <><p>{nl ? "Suggestie voor oefenbelasting" : "Suggested practice workload"}: <b>{level(trend.suggestedLevel)}</b></p><p>{nl ? "Gebaseerd op herhaalde gemelde moeilijkheden of expliciete positieve checklists. Bespreek de keuze met je begeleider." : trend.reason}</p><Link href="#preparation-profile-heading">{nl ? "Niveau zelf aanpassen" : "Review your level choice"} →</Link></> : <p>{nl ? "Nog onvoldoende expliciete feedback om een ander niveau voor te stellen." : "There is not enough explicit feedback to suggest a different workload."}</p>}
      <small>{nl ? "Deze suggestie verandert je niveau of toegang niet. Geen beoordeling van rijvaardigheid of voorspelling van je examenresultaat." : trend.limitation}</small>
    </div>
  </section>;
}
