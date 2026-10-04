export type OfficialCentre = {
  slug: string;
  name: string;
  city: string;
  area: string;
  region: string;
  latitude: number;
  longitude: number;
  description: string;
};

// Official practical driving-test centre directory. Coordinates are centre-area
// map anchors for browsing; they are not route geometry or official passage points.
export const officialCentres: OfficialCentre[] = [
  { slug: "brussels-south", name: "Anderlecht", city: "Brussels", area: "Anderlecht", region: "Brussels", latitude: 50.8382, longitude: 4.3047, description: "Official driving-test centre in Anderlecht, Brussels." },
  { slug: "brussels-schaerbeek", name: "Schaerbeek–Evere", city: "Brussels", area: "Schaerbeek / Evere", region: "Brussels", latitude: 50.8765, longitude: 4.3900, description: "Official driving-test centre serving Schaerbeek and Evere." },
  { slug: "antwerp-north", name: "Deurne", city: "Antwerp", area: "Deurne", region: "Antwerp", latitude: 51.2238, longitude: 4.4567, description: "Official driving-test centre in Deurne." },
  { slug: "antwerp-geel", name: "Geel", city: "Geel", area: "Geel", region: "Antwerp", latitude: 51.1604, longitude: 4.9893, description: "Official driving-test centre in Geel." },
  { slug: "antwerp-kontich", name: "Kontich", city: "Kontich", area: "Kontich", region: "Antwerp", latitude: 51.1320, longitude: 4.4520, description: "Official driving-test centre in Kontich." },
  { slug: "alken", name: "Alken", city: "Alken", area: "Alken", region: "Limburg", latitude: 50.8750, longitude: 5.3070, description: "Official driving-test centre in Alken." },
  { slug: "bree", name: "Bree", city: "Bree", area: "Bree", region: "Limburg", latitude: 51.1410, longitude: 5.5980, description: "Official driving-test centre in Bree." },
  { slug: "haasrode", name: "Haasrode", city: "Haasrode", area: "Haasrode", region: "Flemish Brabant", latitude: 50.8460, longitude: 4.7330, description: "Official driving-test centre in Haasrode." },
  { slug: "asse-mollem", name: "Asse–Mollem", city: "Asse", area: "Mollem", region: "Flemish Brabant", latitude: 50.9080, longitude: 4.2120, description: "Official driving-test centre in Asse–Mollem." },
  { slug: "brugge", name: "Brugge", city: "Brugge", area: "Brugge", region: "West Flanders", latitude: 51.2300, longitude: 3.2240, description: "Official driving-test centre in Brugge." },
  { slug: "oostende", name: "Oostende", city: "Oostende", area: "Oostende", region: "West Flanders", latitude: 51.1990, longitude: 2.9250, description: "Official driving-test centre in Oostende." },
  { slug: "roeselare", name: "Roeselare", city: "Roeselare", area: "Roeselare", region: "West Flanders", latitude: 50.9450, longitude: 3.1250, description: "Official driving-test centre in Roeselare." },
  { slug: "wevelgem", name: "Wevelgem", city: "Wevelgem", area: "Wevelgem", region: "West Flanders", latitude: 50.8060, longitude: 3.1640, description: "Official driving-test centre in Wevelgem." },
  { slug: "sint-denijs-westrem", name: "Sint-Denijs-Westrem", city: "Ghent", area: "Sint-Denijs-Westrem", region: "East Flanders", latitude: 51.0275, longitude: 3.6956, description: "Official driving-test centre in Sint-Denijs-Westrem." },
  { slug: "erembodegem", name: "Erembodegem", city: "Aalst", area: "Erembodegem", region: "East Flanders", latitude: 50.9190, longitude: 4.0430, description: "Official driving-test centre in Erembodegem." },
  { slug: "sint-niklaas", name: "Sint-Niklaas", city: "Sint-Niklaas", area: "Sint-Niklaas", region: "East Flanders", latitude: 51.1640, longitude: 4.1430, description: "Official driving-test centre in Sint-Niklaas." },
  { slug: "eeklo", name: "Eeklo", city: "Eeklo", area: "Eeklo", region: "East Flanders", latitude: 51.1840, longitude: 3.5680, description: "Official driving-test centre in Eeklo." },
  { slug: "brakel", name: "Brakel", city: "Brakel", area: "Brakel", region: "East Flanders", latitude: 50.8010, longitude: 3.7640, description: "Official driving-test centre in Brakel." },
  { slug: "louvain-la-neuve", name: "Louvain-la-Neuve", city: "Ottignies-Louvain-la-Neuve", area: "Louvain-la-Neuve", region: "Walloon Brabant", latitude: 50.6680, longitude: 4.5680, description: "Official driving-test centre in Louvain-la-Neuve." },
  { slug: "braine-le-comte", name: "Braine-le-Comte", city: "Braine-le-Comte", area: "Braine-le-Comte", region: "Hainaut", latitude: 50.6090, longitude: 4.1390, description: "Official driving-test centre in Braine-le-Comte." },
  { slug: "charleroi-couillet", name: "Charleroi–Couillet", city: "Charleroi", area: "Couillet", region: "Hainaut", latitude: 50.3920, longitude: 4.4440, description: "Official driving-test centre in Couillet, Charleroi." },
  { slug: "mons-cuesmes", name: "Mons–Cuesmes", city: "Mons", area: "Cuesmes", region: "Hainaut", latitude: 50.4310, longitude: 3.9460, description: "Official driving-test centre in Cuesmes, Mons." },
  { slug: "lobbes", name: "Lobbes", city: "Lobbes", area: "Lobbes", region: "Hainaut", latitude: 50.3500, longitude: 4.2670, description: "Official driving-test centre in Lobbes." },
  { slug: "tournai-marquain", name: "Tournai–Marquain", city: "Tournai", area: "Marquain", region: "Hainaut", latitude: 50.6260, longitude: 3.3280, description: "Official driving-test centre in Marquain, Tournai." },
  { slug: "liege-wandre", name: "Liège–Wandre", city: "Liège", area: "Wandre", region: "Liège", latitude: 50.6620, longitude: 5.6280, description: "Official driving-test centre in Wandre, Liège." },
  { slug: "huy-tihange", name: "Huy–Tihange", city: "Huy", area: "Tihange", region: "Liège", latitude: 50.5320, longitude: 5.2360, description: "Official driving-test centre in Tihange, Huy." },
  { slug: "eupen-lontzen", name: "Eupen–Lontzen", city: "Eupen", area: "Lontzen", region: "Liège", latitude: 50.6810, longitude: 6.0070, description: "Official driving-test centre in Lontzen, serving Eupen." },
  { slug: "namur-suarlee", name: "Namur–Suarlée", city: "Namur", area: "Suarlée", region: "Namur", latitude: 50.4990, longitude: 4.8060, description: "Official driving-test centre in Suarlée, Namur." },
  { slug: "couvin-mariembourg", name: "Couvin–Mariembourg", city: "Couvin", area: "Mariembourg", region: "Namur", latitude: 50.0940, longitude: 4.5400, description: "Official driving-test centre in Mariembourg, Couvin." },
  { slug: "marche-en-famenne", name: "Marche-en-Famenne", city: "Marche-en-Famenne", area: "Marche-en-Famenne", region: "Luxembourg", latitude: 50.2260, longitude: 5.3440, description: "Official driving-test centre in Marche-en-Famenne." },
  { slug: "bastogne", name: "Bastogne", city: "Bastogne", area: "Bastogne", region: "Luxembourg", latitude: 50.0000, longitude: 5.7200, description: "Official driving-test centre in Bastogne." },
  { slug: "arlon-weyler", name: "Arlon–Weyler", city: "Arlon", area: "Weyler", region: "Luxembourg", latitude: 49.6740, longitude: 5.8170, description: "Official driving-test centre in Weyler, Arlon." },
];
