import type { Metadata } from "next";
import "./globals.css";
import "./centres.css";
import "./route-experience.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "./auth.css";
import "./admin.css";
import "./modern.css";
import "./landing.css";
import "./account.css";
import "./dashboard.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import InstallAppPrompt from "./InstallAppPrompt";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "RoutePilot | Know the road before test day",
  description: "Practice real driving test routes with clear guidance and confidence.",
  openGraph: {
    type: "website",
    siteName: "RoutePilot",
    title: "RoutePilot | Know the road before test day",
    description: "Explore driving-test routes, key points and practical preparation guidance.",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "RoutePilot | Know the road before test day", description: "Prepare for your driving test with clear route guidance." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ServiceWorkerRegister /><InstallAppPrompt />{children}</body>
    </html>
  );
}
