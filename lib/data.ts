export type RoutePoint = {
  number: string;
  title: string;
  detail: string;
  tone: "mint" | "coral" | "blue";
};

export type Centre = {
  slug: string;
  name: string;
  city: string;
  area: string;
  routes: number;
  region: string;
  description: string;
  highlights: string[];
  routePoints: RoutePoint[];
  routeCoordinates: [number, number][];
};

export const centres: Centre[] = [
  {
    slug: "brussels-south",
    name: "Brussels South",
    city: "Brussels",
    area: "Anderlecht",
    routes: 12,
    region: "Brussels",
    description: "Prepare for the roads around Brussels South with a clear view of the junctions and lane changes that deserve your attention.",
    highlights: ["Busy urban junctions", "Early lane positioning", "School and 30 km/h zones"],
    routeCoordinates: [[4.3047, 50.8382], [4.3104, 50.8371], [4.3185, 50.8404], [4.3257, 50.8355], [4.3193, 50.8298], [4.3079, 50.8321]],
    routePoints: [
      { number: "01", title: "Leave the test centre", detail: "Check mirrors and position before joining traffic", tone: "mint" },
      { number: "02", title: "Lane change before junction", detail: "Move over early and keep the junction clear", tone: "coral" },
      { number: "03", title: "Two-lane roundabout", detail: "Choose the correct lane for the second exit", tone: "blue" },
      { number: "04", title: "Residential speed zone", detail: "Look for cyclists and changing speed limits", tone: "mint" },
    ],
  },
  {
    slug: "antwerp-north",
    name: "Antwerp North",
    city: "Antwerp",
    area: "Deurne",
    routes: 9,
    region: "Antwerp",
    description: "Build confidence on the mix of residential streets, tram corridors and larger city junctions around Antwerp North.",
    highlights: ["Tram corridors", "Multi-lane crossings", "Residential priority roads"],
    routeCoordinates: [[4.4567, 51.2238], [4.4621, 51.2262], [4.4712, 51.2243], [4.4752, 51.2178], [4.4661, 51.2148], [4.4567, 51.2191]],
    routePoints: [
      { number: "01", title: "Start on the main road", detail: "Scan for cyclists before moving off", tone: "mint" },
      { number: "02", title: "Tram crossing", detail: "Read the lights and keep the tracks clear", tone: "coral" },
      { number: "03", title: "Traffic light sequence", detail: "Stay in lane and anticipate the next light", tone: "blue" },
    ],
  },
  {
    slug: "ghent-east",
    name: "Ghent East",
    city: "Ghent",
    area: "Sint-Denijs-Westrem",
    routes: 8,
    region: "East Flanders",
    description: "Practise the calm, precise driving style needed for Ghent East, from roundabouts to changing speed zones.",
    highlights: ["Compact roundabouts", "Changing speed zones", "Open-road observation"],
    routeCoordinates: [[3.6956, 51.0275], [3.7041, 51.0284], [3.7115, 51.0237], [3.7082, 51.0166], [3.6983, 51.0182], [3.6929, 51.0239]],
    routePoints: [
      { number: "01", title: "Test centre exit", detail: "Take time to read the first signs", tone: "mint" },
      { number: "02", title: "Compact roundabout", detail: "Signal only when leaving the roundabout", tone: "coral" },
      { number: "03", title: "Open-road transition", detail: "Adjust speed before the built-up area", tone: "blue" },
    ],
  },
];

export function getCentre(slug: string) {
  return centres.find((centre) => centre.slug === slug);
}
