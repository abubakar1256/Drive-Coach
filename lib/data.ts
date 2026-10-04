export type RoutePoint = {
  id?: string;
  number: string;
  title: string;
  detail: string;
  tone: "mint" | "coral" | "blue";
  latitude?: number;
  longitude?: number;
  category?: string;
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

const featuredCentres: Centre[] = [
  {
    slug: "brussels-south",
    name: "Anderlecht",
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
    name: "Deurne",
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
    name: "Sint-Denijs-Westrem",
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

const additionalCentres: Centre[] = [
  { slug: "brussels-schaerbeek", name: "Schaerbeek–Evere", city: "Brussels", area: "Schaerbeek / Evere", routes: 0, region: "Brussels", description: "Official driving-test centre serving Schaerbeek and Evere.", highlights: ["Urban junctions", "Lane positioning", "Priority situations"], routePoints: [], routeCoordinates: [[4.3900, 50.8765]] },
  { slug: "antwerp-geel", name: "Geel", city: "Geel", area: "Geel", routes: 0, region: "Antwerp", description: "Official driving-test centre in Geel.", highlights: ["Urban roads", "Roundabouts", "Speed-zone changes"], routePoints: [], routeCoordinates: [[4.9893, 51.1604]] },
  { slug: "antwerp-kontich", name: "Kontich", city: "Kontich", area: "Kontich", routes: 0, region: "Antwerp", description: "Official driving-test centre in Kontich.", highlights: ["Busy junctions", "Lane positioning", "Priority situations"], routePoints: [], routeCoordinates: [[4.4520, 51.1320]] },
  { slug: "alken", name: "Alken", city: "Alken", area: "Alken", routes: 0, region: "Limburg", description: "Official driving-test centre in Alken.", highlights: ["Official passage points", "Roundabouts", "Speed-zone changes"], routePoints: [], routeCoordinates: [[5.3070, 50.8750]] },
  { slug: "bree", name: "Bree", city: "Bree", area: "Bree", routes: 0, region: "Limburg", description: "Official driving-test centre in Bree.", highlights: ["Residential roads", "Priority situations", "Open-road observation"], routePoints: [], routeCoordinates: [[5.5980, 51.1410]] },
  { slug: "haasrode", name: "Haasrode", city: "Haasrode", area: "Haasrode", routes: 0, region: "Flemish Brabant", description: "Official driving-test centre in Haasrode.", highlights: ["Lane choice", "Roundabouts", "Changing speed zones"], routePoints: [], routeCoordinates: [[4.7330, 50.8460]] },
  { slug: "asse-mollem", name: "Asse–Mollem", city: "Asse", area: "Mollem", routes: 0, region: "Flemish Brabant", description: "Official driving-test centre in Asse–Mollem.", highlights: ["Rural transitions", "Junctions", "Speed awareness"], routePoints: [], routeCoordinates: [[4.2120, 50.9080]] },
  { slug: "brugge", name: "Brugge", city: "Brugge", area: "Brugge", routes: 0, region: "West Flanders", description: "Official driving-test centre in Brugge.", highlights: ["Urban junctions", "Cyclist observation", "Lane choice"], routePoints: [], routeCoordinates: [[3.2240, 51.2300]] },
  { slug: "oostende", name: "Oostende", city: "Oostende", area: "Oostende", routes: 0, region: "West Flanders", description: "Official driving-test centre in Oostende.", highlights: ["Urban roads", "Cyclist observation", "Priority situations"], routePoints: [], routeCoordinates: [[2.9250, 51.1990]] },
  { slug: "roeselare", name: "Roeselare", city: "Roeselare", area: "Roeselare", routes: 0, region: "West Flanders", description: "Official driving-test centre in Roeselare.", highlights: ["Roundabouts", "Lane positioning", "Speed zones"], routePoints: [], routeCoordinates: [[3.1250, 50.9450]] },
  { slug: "wevelgem", name: "Wevelgem", city: "Wevelgem", area: "Wevelgem", routes: 0, region: "West Flanders", description: "Official driving-test centre in Wevelgem.", highlights: ["Junctions", "Priority situations", "Open-road observation"], routePoints: [], routeCoordinates: [[3.1640, 50.8060]] },
  { slug: "erembodegem", name: "Erembodegem", city: "Aalst", area: "Erembodegem", routes: 0, region: "East Flanders", description: "Official driving-test centre in Erembodegem.", highlights: ["Urban roads", "Roundabouts", "Lane choice"], routePoints: [], routeCoordinates: [[4.0430, 50.9190]] },
  { slug: "sint-niklaas", name: "Sint-Niklaas", city: "Sint-Niklaas", area: "Sint-Niklaas", routes: 0, region: "East Flanders", description: "Official driving-test centre in Sint-Niklaas.", highlights: ["Urban junctions", "Cyclist observation", "Priority situations"], routePoints: [], routeCoordinates: [[4.1430, 51.1640]] },
  { slug: "eeklo", name: "Eeklo", city: "Eeklo", area: "Eeklo", routes: 0, region: "East Flanders", description: "Official driving-test centre in Eeklo.", highlights: ["Changing speed zones", "Junctions", "Open-road observation"], routePoints: [], routeCoordinates: [[3.5680, 51.1840]] },
  { slug: "brakel", name: "Brakel", city: "Brakel", area: "Brakel", routes: 0, region: "East Flanders", description: "Official driving-test centre in Brakel.", highlights: ["Rural roads", "Priority situations", "Speed awareness"], routePoints: [], routeCoordinates: [[3.7640, 50.8010]] },
  { slug: "louvain-la-neuve", name: "Louvain-la-Neuve", city: "Ottignies-Louvain-la-Neuve", area: "Louvain-la-Neuve", routes: 0, region: "Walloon Brabant", description: "Official driving-test centre in Louvain-la-Neuve.", highlights: ["Urban junctions", "Roundabouts", "Lane positioning"], routePoints: [], routeCoordinates: [[4.5680, 50.6680]] },
  { slug: "braine-le-comte", name: "Braine-le-Comte", city: "Braine-le-Comte", area: "Braine-le-Comte", routes: 0, region: "Hainaut", description: "Official driving-test centre in Braine-le-Comte.", highlights: ["Junctions", "Priority situations", "Speed zones"], routePoints: [], routeCoordinates: [[4.1390, 50.6090]] },
  { slug: "charleroi-couillet", name: "Charleroi–Couillet", city: "Charleroi", area: "Couillet", routes: 0, region: "Hainaut", description: "Official driving-test centre in Couillet, Charleroi.", highlights: ["Busy urban roads", "Lane changes", "Junction observation"], routePoints: [], routeCoordinates: [[4.4440, 50.3920]] },
  { slug: "mons-cuesmes", name: "Mons–Cuesmes", city: "Mons", area: "Cuesmes", routes: 0, region: "Hainaut", description: "Official driving-test centre in Cuesmes, Mons.", highlights: ["Urban junctions", "Roundabouts", "Priority situations"], routePoints: [], routeCoordinates: [[3.9460, 50.4310]] },
  { slug: "lobbes", name: "Lobbes", city: "Lobbes", area: "Lobbes", routes: 0, region: "Hainaut", description: "Official driving-test centre in Lobbes.", highlights: ["Rural transitions", "Speed awareness", "Priority situations"], routePoints: [], routeCoordinates: [[4.2670, 50.3500]] },
  { slug: "tournai-marquain", name: "Tournai–Marquain", city: "Tournai", area: "Marquain", routes: 0, region: "Hainaut", description: "Official driving-test centre in Marquain, Tournai.", highlights: ["Junctions", "Lane choice", "Roundabouts"], routePoints: [], routeCoordinates: [[3.3280, 50.6260]] },
  { slug: "liege-wandre", name: "Liège–Wandre", city: "Liège", area: "Wandre", routes: 0, region: "Liège", description: "Official driving-test centre in Wandre, Liège.", highlights: ["Urban junctions", "Lane positioning", "Priority situations"], routePoints: [], routeCoordinates: [[5.6280, 50.6620]] },
  { slug: "huy-tihange", name: "Huy–Tihange", city: "Huy", area: "Tihange", routes: 0, region: "Liège", description: "Official driving-test centre in Tihange, Huy.", highlights: ["Junctions", "Speed zones", "Open-road observation"], routePoints: [], routeCoordinates: [[5.2360, 50.5320]] },
  { slug: "eupen-lontzen", name: "Eupen–Lontzen", city: "Eupen", area: "Lontzen", routes: 0, region: "Liège", description: "Official driving-test centre in Lontzen, serving Eupen.", highlights: ["Priority situations", "Rural roads", "Speed awareness"], routePoints: [], routeCoordinates: [[6.0070, 50.6810]] },
  { slug: "namur-suarlee", name: "Namur–Suarlée", city: "Namur", area: "Suarlée", routes: 0, region: "Namur", description: "Official driving-test centre in Suarlée, Namur.", highlights: ["Urban junctions", "Roundabouts", "Lane choice"], routePoints: [], routeCoordinates: [[4.8060, 50.4990]] },
  { slug: "couvin-mariembourg", name: "Couvin–Mariembourg", city: "Couvin", area: "Mariembourg", routes: 0, region: "Namur", description: "Official driving-test centre in Mariembourg, Couvin.", highlights: ["Rural transitions", "Priority situations", "Speed zones"], routePoints: [], routeCoordinates: [[4.5400, 50.0940]] },
  { slug: "marche-en-famenne", name: "Marche-en-Famenne", city: "Marche-en-Famenne", area: "Marche-en-Famenne", routes: 0, region: "Luxembourg", description: "Official driving-test centre in Marche-en-Famenne.", highlights: ["Rural roads", "Junctions", "Speed awareness"], routePoints: [], routeCoordinates: [[5.3440, 50.2260]] },
  { slug: "bastogne", name: "Bastogne", city: "Bastogne", area: "Bastogne", routes: 0, region: "Luxembourg", description: "Official driving-test centre in Bastogne.", highlights: ["Rural roads", "Priority situations", "Open-road observation"], routePoints: [], routeCoordinates: [[5.7200, 50.0000]] },
  { slug: "arlon-weyler", name: "Arlon–Weyler", city: "Arlon", area: "Weyler", routes: 0, region: "Luxembourg", description: "Official driving-test centre in Weyler, Arlon.", highlights: ["Urban junctions", "Lane choice", "Roundabouts"], routePoints: [], routeCoordinates: [[5.8170, 49.6740]] },
];

export const centres: Centre[] = [...featuredCentres, ...additionalCentres];

export function getCentre(slug: string) {
  return centres.find((centre) => centre.slug === slug);
}
