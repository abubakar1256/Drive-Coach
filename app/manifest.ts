import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "RoutePilot", short_name: "RoutePilot", description: "Prepare for your driving test with verified routes and calm practice guidance.", start_url: "/", display: "standalone", orientation: "portrait-primary", background_color: "#f4f8f4", theme_color: "#106d56", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}
