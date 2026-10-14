import "reflect-metadata";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DrivingRouteService } from "../src/routes/driving-route.service";

type BundleRoute = { centreSlug: string; variant: number; checkedAt: string; points: Array<{ latitude: number; longitude: number; bearing?: number; name: string }> };
// Explicit command only: never run as an automatic side effect of seeding.
// Existing route records, including instructor edits, are never overwritten.
async function main() {
  const publish = process.argv.includes("--publish");
  const prisma = new PrismaClient(), driving = new DrivingRouteService();
  try {
    const bundle = JSON.parse(await readFile(join(__dirname, "../prisma/data/road-practice-loops.json"), "utf8")) as { routes: BundleRoute[] };
    for (const item of bundle.routes) {
      const slug = `${item.centreSlug}-road-practice-loop-01`;
      if (await prisma.route.findUnique({ where: { slug } })) { console.log(`${item.centreSlug}: existing route preserved`); continue; }
      const centre = await prisma.examCentre.findUnique({ where: { slug: item.centreSlug } });
      if (!centre) { console.log(`${item.centreSlug}: centre missing; skipped`); continue; }
      const checked = await driving.requireValid(item.points);
      if (checked.durationSec! > 3600) throw new Error(`${item.centreSlug}: no longer within 24–60 minute policy`);
      const fingerprint = createHash("sha256").update(JSON.stringify(item.points)).digest("hex");
      await prisma.$transaction(async tx => {
        // Serialize concurrent imports; check again under the lock.
        await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))", slug);
        if (await tx.route.findUnique({ where: { slug } })) return;
        const route = await tx.route.create({ data: {
          centreId: centre.id, slug, name: "Road-network practice loop 1",
          status: publish ? "PUBLISHED" : "DRAFT", verificationStatus: "ROAD_VALIDATED",
          durationMin: Math.ceil(checked.durationSec! / 60), verifiedAt: new Date(), reviewedBy: "ROAD_ROUTING_ENGINE",
          sourceLabel: "Road-network practice loop — not an official examiner route or instructor approval",
          sourceUrl: "https://docs.mapbox.com/api/navigation/directions/",
          points: { create: item.points.map((p, i) => ({ sequence: i + 1, latitude: p.latitude, longitude: p.longitude, bearing: p.bearing,
            category: i === 0 ? "start" : i === item.points.length - 1 ? "finish" : "waypoint",
            title: i === 0 ? "Mapped practice meeting point" : i === item.points.length - 1 ? "Return to practice meeting point" : `Road waypoint ${i + 1}`,
            description: "Practice on mapped drivable roads. Follow current signs and instructor guidance. This is not a confirmed exam-centre entrance.",
          })) },
        } });
        await tx.auditLog.create({ data: { action: "ROAD_CONTENT_IMPORTED", entity: "Route", entityId: route.id, metadata: { fingerprint, durationSec: checked.durationSec, originallyCheckedAt: item.checkedAt, published: publish, instructorApproved: false } } });
      });
      console.log(`${item.centreSlug}: ${publish ? "published" : "draft"}, ${Math.ceil(checked.durationSec! / 60)} min`);
    }
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Road import stopped; check database migration, route validation and configuration. Existing routes were preserved."); process.exitCode = 1; });
