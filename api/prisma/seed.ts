import { PrismaClient, RouteStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const centres = [
  { slug: "brussels-south", name: "Brussels South", city: "Brussels", area: "Anderlecht", region: "Brussels", latitude: 50.8382, longitude: 4.3047, description: "Practice the roads around Brussels South with clear guidance for junctions and lane changes." },
  { slug: "antwerp-north", name: "Antwerp North", city: "Antwerp", area: "Deurne", region: "Antwerp", latitude: 51.2238, longitude: 4.4567, description: "Build confidence around tram corridors, multi-lane crossings and residential roads." },
  { slug: "ghent-east", name: "Ghent East", city: "Ghent", area: "Sint-Denijs-Westrem", region: "East Flanders", latitude: 51.0275, longitude: 3.6956, description: "Prepare for compact roundabouts, changing speed zones and open-road observation." },
];

const routePoints = [
  { sequence: 1, category: "start", title: "Leave the test centre", description: "Check mirrors and position before joining traffic", warning: null, latitude: 50.8382, longitude: 4.3047 },
  { sequence: 2, category: "lane-change", title: "Lane change before junction", description: "Move over early and keep the junction clear", warning: "Check the mirror and blind spot before moving over", latitude: 50.8371, longitude: 4.3104 },
  { sequence: 3, category: "roundabout", title: "Two-lane roundabout", description: "Choose the correct lane for the second exit", warning: "Signal only when leaving the roundabout", latitude: 50.8404, longitude: 4.3185 },
  { sequence: 4, category: "speed-zone", title: "Residential speed zone", description: "Look for cyclists and changing speed limits", warning: "Read the next speed sign before the zone begins", latitude: 50.8355, longitude: 4.3257 },
];

async function main() {
  for (const centre of centres) {
    const savedCentre = await prisma.examCentre.upsert({ where: { slug: centre.slug }, update: { ...centre, isPublished: true }, create: { ...centre, isPublished: true } });
    const route = await prisma.route.upsert({ where: { slug: `${centre.slug}-route-04` }, update: { centreId: savedCentre.id, name: "Route 04", status: RouteStatus.PUBLISHED, durationMin: 24, verifiedAt: new Date() }, create: { centreId: savedCentre.id, slug: `${centre.slug}-route-04`, name: "Route 04", status: RouteStatus.PUBLISHED, durationMin: 24, verifiedAt: new Date() } });
    await prisma.routePoint.deleteMany({ where: { routeId: route.id } });
    await prisma.routePoint.createMany({ data: routePoints.map((point) => ({ ...point, routeId: route.id })) });
  }

  for (const plan of [
    { name: "1 day", durationHours: 24, priceCents: 295 },
    { name: "1 week", durationHours: 168, priceCents: 895 },
    { name: "1 month", durationHours: 720, priceCents: 1295 },
    { name: "3 months", durationHours: 2160, priceCents: 1395 },
  ]) await prisma.plan.upsert({ where: { name: plan.name }, update: { ...plan, isActive: true }, create: { ...plan, currency: "EUR", isActive: true } });

  console.log(`Seeded ${centres.length} centres and 4 access plans.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
