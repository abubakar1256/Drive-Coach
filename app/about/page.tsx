import ContentNav from "../ContentNav";

export const metadata = { title: "About Drive Coach | Driving Test Preparation", description: "Learn how Drive Coach helps learner drivers prepare with clearer route information.", alternates: { canonical: "/about" }, openGraph: { url: "/about" } };

export default function AboutPage() {
  return <main className="content-page"><ContentNav /><section className="content-hero shell"><p className="eyebrow"><span className="eyebrow-dot" /> About Drive Coach</p><h1>Prepare with<br /><em>more clarity.</em></h1><p>Drive Coach brings test-centre routes, key moments and practical preparation guidance together in one calm workspace.</p></section><section className="content-body shell content-two-column"><div><p className="eyebrow">Our approach</p><h2>Useful before<br />test day.</h2></div><div><p>We design around the moments learner drivers need to understand: where to position, when to slow down, which signs deserve attention and how to practise consistently.</p><p>Route information is preparation material, not a promise of an examiner route. Road layouts, signs and traffic conditions can change, so drivers must always follow current rules and examiner instructions.</p></div></section></main>;
}
