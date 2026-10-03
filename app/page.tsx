import Faq from "./Faq";
import AccountNavLink from "./AccountNavLink";
import PageViewTracker from "./PageViewTracker";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import HowItWorks from "./HowItWorks";
import PricingPlans from "./PricingPlans";
import HomeCentreSection from "./HomeCentreSection";

export const metadata = { alternates: { canonical: "/" }, openGraph: { url: "/" } };

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Are the routes free to discover?", acceptedAnswer: { "@type": "Answer", text: "Yes. You can browse centres and preview routes publicly. A time-based access plan unlocks the complete preparation experience." } },
    { "@type": "Question", name: "Which access periods are available?", acceptedAnswer: { "@type": "Answer", text: "RoutePilot is designed around 1 day, 1 week, 1 month and 3 month access periods." } },
    { "@type": "Question", name: "Are the routes official examiner routes?", acceptedAnswer: { "@type": "Answer", text: "Routes are preparation guides and can change. Always follow current signs, road rules and examiner instructions." } },
  ],
};

const websiteJsonLd = { "@context": "https://schema.org", "@type": "WebSite", name: "RoutePilot", url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", description: "Driving-test route preparation with interactive maps and practical guidance." };

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function RouteMap() {
  return (
    <div className="route-map" aria-label="Preview of a practice route map">
      <div className="map-grid" />
      <div className="map-road road-one" />
      <div className="map-road road-two" />
      <div className="map-road road-three" />
      <div className="map-road road-four" />
      <div className="map-route" />
      <div className="map-point point-a"><span>A</span></div>
      <div className="map-point point-b"><span>!</span></div>
      <div className="map-point point-c"><span>↗</span></div>
      <div className="map-legend"><i className="legend-route" /> Test route <i className="legend-alert" /> Attention point</div>
      <div className="map-control">+</div>
      <div className="map-control map-control-minus">−</div>
    </div>
  );
}

export default function Home() {
  return (
    <main><PageViewTracker eventType="PAGE_VIEW" /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <nav className="nav shell">
        <a className="brand" href="#top" aria-label="RoutePilot home">
          <span className="brand-mark"><span /></span>
          <span>Route<span className="brand-accent">Pilot</span></span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#centres">Test centres</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <LanguageSwitcher />
          <AccountNavLink />
          <a className="button button-small" href="/centres">Start practising <Arrow /></a>
        </div>
        <MobileMenu links={[{ href: "#how-it-works", label: "How it works" }, { href: "#centres", label: "Test centres" }, { href: "#pricing", label: "Pricing" }, { href: "#faq", label: "FAQ" }, { href: "/account", label: "My account" }]} />
      </nav>

      <section className="hero" id="top">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <div className="shell hero-inner">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> Built for calmer test days</p>
            <h1>Know the road.<br /><em>Drive with confidence.</em></h1>
            <p className="hero-text">Explore real practice routes, spot the tricky moments and prepare for your driving test before test day arrives.</p>
            <div className="hero-actions">
              <a className="button" href="/centres">Find my test centre <Arrow /></a>
              <a className="text-link" href="#how-it-works">See how it works <span>↓</span></a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack"><span>JD</span><span>MS</span><span>AK</span><b>+</b></div>
              <div><strong>4.9/5</strong><span>Loved by learner drivers</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-road-scene" aria-hidden="true"><div className="scene-sun" /><div className="scene-hills" /><div className="scene-ground" /><div className="scene-road"><i /><b /><span /></div><div className="scene-car">●</div><div className="scene-pin scene-pin-one">!</div><div className="scene-pin scene-pin-two">↗</div></div>
            <div className="route-card">
              <div className="route-card-top"><span className="status-pill"><i /> Live route preview</span><span className="more">•••</span></div>
              <div className="route-card-heading"><div><span className="small-label">BRUSSELS SOUTH</span><h2>Route 04 <span>↗</span></h2></div><span className="route-time">24 min</span></div>
              <RouteMap />
              <div className="route-card-bottom"><div><span className="small-label">PREPARATION</span><strong>7 key points</strong></div><a href="#route-preview">Open route <Arrow /></a></div>
            </div>
            <div className="floating-note note-top"><span className="note-icon">!</span><div><strong>Attention point</strong><span>Change lane early</span></div></div>
            <div className="floating-note note-bottom"><span className="check-icon">✓</span><div><strong>Route saved</strong><span>Brussels South · Route 04</span></div></div>
          </div>
        </div>
      </section>

      <section className="trust-strip"><div className="shell trust-inner"><span>TRUSTED BY LEARNER DRIVERS</span><div className="trust-stats"><strong>180+</strong><span>practice routes</span><strong>30+</strong><span>test centres</span><strong>4.9/5</strong><span>rated by learners</span><strong>24/7</strong><span>access</span></div></div></section>

      <section className="stats-section"><div className="shell stats-grid"><div><strong>180<span>+</span></strong><small>verified practice routes</small></div><div><strong>30<span>+</span></strong><small>Belgian test centres</small></div><div><strong>4.9<span>/5</span></strong><small>learner rating</small></div><div><strong>24<span>/7</span></strong><small>access to prepare</small></div></div></section>

      <section className="section shell" id="how-it-works">
        <HowItWorks />
      </section>

      <HomeCentreSection />

      <section className="section shell route-preview" id="route-preview">
        <div className="preview-copy"><p className="eyebrow">See the details that matter</p><h2>Your route,<br /><span>made clearer.</span></h2><p>Every route brings the important moments together in one calm, visual overview. No clutter. No second guessing.</p><ul className="check-list"><li><span>✓</span> Ordered route points and start/finish markers</li><li><span>✓</span> Warnings for lanes, signs and complex junctions</li><li><span>✓</span> Photos, videos and practical driving tips</li></ul><a className="button button-dark" href="#centres">Explore a sample route <Arrow /></a></div><div className="preview-panel"><div className="preview-panel-head"><div><span className="small-label">EXAM CENTRE · BRUSSELS SOUTH</span><h3>Route 04 <span className="soft-badge">7 points</span></h3></div><span className="panel-menu">•••</span></div><RouteMap /><div className="point-list"><div className="point-row"><b>01</b><span className="point-dot mint-dot" /><div><strong>Start at test centre</strong><small>Check mirrors before leaving</small></div><span>›</span></div><div className="point-row active"><b>02</b><span className="point-dot coral-dot" /><div><strong>Lane change</strong><small>Move over before the junction</small></div><span>›</span></div><div className="point-row"><b>03</b><span className="point-dot blue-dot" /><div><strong>Roundabout</strong><small>Watch the second exit</small></div><span>›</span></div></div></div>
      </section>

      <PricingPlans />

      <section className="testimonials-section"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">Learners feel ready sooner</p><h2>Less stress.<br /><span>More confidence.</span></h2></div><p className="section-side-copy">Real preparation is knowing what is coming before the first turn.</p></div><div className="testimonial-grid"><article className="testimonial-card testimonial-featured"><div className="stars">★★★★★</div><blockquote>“I knew the difficult junctions before my first practice drive. That changed everything.”</blockquote><div className="testimonial-person"><span className="person-avatar avatar-orange">LS</span><div><strong>Laura S.</strong><small>Passed first time · Brussels</small></div></div></article><article className="testimonial-card"><div className="stars">★★★★★</div><blockquote>“The route points made it easy to focus on the moments that actually matter.”</blockquote><div className="testimonial-person"><span className="person-avatar avatar-blue">TV</span><div><strong>Thomas V.</strong><small>Passed first time · Antwerp</small></div></div></article><article className="testimonial-card"><div className="stars">★★★★★</div><blockquote>“It gave me a calm plan instead of another list of streets to memorise.”</blockquote><div className="testimonial-person"><span className="person-avatar avatar-green">EM</span><div><strong>Emma M.</strong><small>Passed first time · Ghent</small></div></div></article></div></div></section>

      <Faq />

      <section className="final-cta"><div className="shell final-cta-inner"><div><p className="eyebrow">Your next drive can feel different</p><h2>Turn unfamiliar roads<br /><em>into familiar ground.</em></h2></div><a className="button button-light" href="#centres">Find my test centre <Arrow /></a></div></section>

      <footer className="footer"><div className="shell footer-top"><a className="brand" href="#top"><span className="brand-mark"><span /></span><span>Route<span className="brand-accent">Pilot</span></span></a><div className="footer-links"><a href="#how-it-works">How it works</a><a href="#centres">Test centres</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div><div className="language">EN <span>⌄</span></div></div><div className="shell footer-bottom"><span>© 2026 RoutePilot. Prepare well. Drive calmly.</span><span>Built for safer, more confident test preparation.</span></div></footer>
    </main>
  );
}
