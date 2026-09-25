import Link from "next/link";
import ContentNav from "../ContentNav";

export const metadata = { title: "Driving Test Preparation Guides | RoutePilot", description: "Practical preparation guides for route study, roundabouts, lane changes and calmer test days.", alternates: { canonical: "/blog" }, openGraph: { url: "/blog" } };

const guides = [
  { tag: "ROUTE STUDY", title: "How to study a test route without memorising every street", text: "Focus on decision points, signs and positioning so your preparation remains useful when traffic changes." },
  { tag: "ROUNDABOUTS", title: "A calmer way to approach difficult roundabouts", text: "Build a repeatable scan: signs, lane, mirrors, speed and exit. Practise the sequence before you practise the location." },
  { tag: "PRACTICE", title: "What to record after every practice drive", text: "Use a short reflection to separate route-following progress from a formal assessment of driving skill." },
];

export default function BlogPage() {
  return <main className="content-page"><ContentNav /><section className="content-hero shell"><p className="eyebrow"><span className="eyebrow-dot" /> RoutePilot guides</p><h1>Small lessons.<br /><em>Better drives.</em></h1><p>Clear, practical reading for the moments that deserve your attention before test day.</p></section><section className="content-body shell"><div className="guide-grid">{guides.map((guide) => <article className="content-card guide-card" key={guide.title}><span className="small-label">{guide.tag}</span><h2>{guide.title}</h2><p>{guide.text}</p><Link href="/#how-it-works">Explore preparation <span>↗</span></Link></article>)}</div></section></main>;
}
