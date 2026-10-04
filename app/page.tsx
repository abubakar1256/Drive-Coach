import PageViewTracker from "./PageViewTracker";
import HomePageContent from "./HomePageContent";

export const metadata = { alternates: { canonical: "/" }, openGraph: { url: "/" } };

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Are the routes free to discover?", acceptedAnswer: { "@type": "Answer", text: "Yes. You can browse centres and preview routes publicly. A time-based access plan unlocks the complete preparation experience." } },
    { "@type": "Question", name: "Which access periods are available?", acceptedAnswer: { "@type": "Answer", text: "Drive Coach is designed around 1 day, 1 week, 1 month and 3 month access periods." } },
    { "@type": "Question", name: "Are the routes official examiner routes?", acceptedAnswer: { "@type": "Answer", text: "Routes are preparation guides and can change. Always follow current signs, road rules and examiner instructions." } },
  ],
};

const websiteJsonLd = { "@context": "https://schema.org", "@type": "WebSite", name: "Drive Coach", url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", description: "Driving-test route preparation with interactive maps and practical guidance." };

export default function Home() {
  return (
    <main><PageViewTracker eventType="PAGE_VIEW" /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} /><HomePageContent /></main>
  );
}
