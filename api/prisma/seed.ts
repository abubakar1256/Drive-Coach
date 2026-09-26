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

const drivingSkills = [
  ["SPEED", "Speed awareness"], ["PRIORITY", "Priority and right of way"], ["OBSERVATION", "Observation"], ["HAZARD", "Hazard recognition"],
  ["POSITION", "Road position"], ["LANE_CHANGE", "Lane changes"], ["JUNCTION", "Junctions"], ["ROUNDABOUT", "Roundabouts"],
  ["TURNING", "Turning"], ["SIGNS", "Signs and lights"], ["VULNERABLE", "Vulnerable road users"], ["SPACE", "Space and distance"],
  ["MERGING", "Merging and overtaking"], ["SPECIAL", "Special situations"], ["CONTROL", "Vehicle control"], ["MANOEUVRE", "Manoeuvres"],
] as const;

const weaknessCatalog = [
  ["SPEED_TOO_FAST_ZONE", "SPEED", "Speed too high for the zone"], ["SPEED_LATE_SIGN", "SPEED", "Late speed-limit recognition"], ["SPEED_APPROACH", "SPEED", "Speed not settled before a junction"],
  ["PRIORITY_RIGHT_UNCERTAIN", "PRIORITY", "Uncertain priority from the right"], ["PRIORITY_STOP_APPROACH", "PRIORITY", "Late approach to a STOP situation"], ["PRIORITY_MANOEUVRE", "PRIORITY", "Priority during a manoeuvre"],
  ["OBS_LOOK_AHEAD", "OBSERVATION", "Not looking far enough ahead"], ["OBS_MIRRORS", "OBSERVATION", "Mirror checks need consistency"], ["OBS_BLIND_SPOT", "OBSERVATION", "Blind-spot check"], ["OBS_CYCLIST", "OBSERVATION", "Cyclist observation"],
  ["HAZARD_LATE_REACTION", "HAZARD", "Late response to a developing hazard"], ["HAZARD_LIMITED_VISIBILITY", "HAZARD", "Limited visibility anticipation"],
  ["POSITION_LANE_KEEPING", "POSITION", "Lane position"], ["POSITION_WRONG_LANE", "POSITION", "Choosing the wrong lane"],
  ["LANE_CHANGE_MIRROR", "LANE_CHANGE", "Mirror check before a lane change"], ["LANE_CHANGE_BLIND_SPOT", "LANE_CHANGE", "Blind spot before a lane change"], ["LANE_CHANGE_SIGNAL", "LANE_CHANGE", "Late indicator before a lane change"],
  ["JUNCTION_APPROACH_SPEED", "JUNCTION", "Approach speed at a junction"], ["JUNCTION_OBSERVATION", "JUNCTION", "Observation at a junction"],
  ["ROUNDABOUT_WRONG_LANE", "ROUNDABOUT", "Wrong lane at a roundabout"], ["ROUNDABOUT_LATE_LANE_SELECTION", "ROUNDABOUT", "Late lane selection at a roundabout"], ["ROUNDABOUT_EXIT_PREPARATION", "ROUNDABOUT", "Late exit preparation"], ["ROUNDABOUT_CYCLIST_OBSERVATION", "ROUNDABOUT", "Cyclist observation at a roundabout"],
  ["TURNING_POSITION", "TURNING", "Position before turning"], ["TURNING_VULNERABLE_USERS", "TURNING", "Vulnerable users while turning"],
  ["SIGNS_MISSED", "SIGNS", "Missing a sign or road marking"], ["SIGNS_LIGHTS", "SIGNS", "Traffic-light observation"],
  ["VULNERABLE_CYCLIST", "VULNERABLE", "Cyclist awareness"], ["VULNERABLE_PEDESTRIAN", "VULNERABLE", "Pedestrian awareness"],
  ["SPACE_FOLLOWING_DISTANCE", "SPACE", "Following distance"], ["SPACE_SIDE_DISTANCE", "SPACE", "Side clearance"],
  ["MERGING_SAFE_GAP", "MERGING", "Finding a safe gap"], ["MERGING_MIRROR", "MERGING", "Mirror check while merging"],
  ["SPECIAL_WORKS", "SPECIAL", "Temporary road works"], ["SPECIAL_SCHOOL_ZONE", "SPECIAL", "School-zone awareness"],
  ["CONTROL_SMOOTH_BRAKING", "CONTROL", "Smooth braking"], ["CONTROL_STEERING", "CONTROL", "Steering control"],
  ["MANOEUVRE_PARKING", "MANOEUVRE", "Parking manoeuvre"], ["MANOEUVRE_REVERSE", "MANOEUVRE", "Reversing manoeuvre"],
] as const;

const verifiedTips = [
  ["TIP-SPD-01", "SPEED", "Controleer je snelheid.", "Check your speed."], ["TIP-SPD-04", "SPEED", "Pas je snelheid tijdig aan.", "Adjust your speed early."],
  ["TIP-PRI-01", "PRIORITY", "Controleer de voorrangssituatie.", "Check the priority situation."], ["TIP-PRI-03", "PRIORITY", "Voorrangssituatie nadert. Observeer tijdig.", "Priority situation ahead. Observe early."],
  ["TIP-OBS-01", "OBSERVATION", "Kijk verder vooruit.", "Look further ahead."], ["TIP-OBS-06", "OBSERVATION", "Controleer je dode hoek.", "Check your blind spot."],
  ["TIP-RND-03", "ROUNDABOUT", "Kies tijdig de juiste rijstrook.", "Choose the correct lane early."], ["TIP-RND-05", "ROUNDABOUT", "Controleer spiegels en dode hoek vóór je van rijstrook verandert.", "Check mirrors and blind spot before changing lanes."],
  ["TIP-RND-08", "ROUNDABOUT", "Controleer op fietsers.", "Check for cyclists."], ["TIP-LAN-03", "LANE_CHANGE", "Bereid je rijstrookwissel tijdig voor.", "Prepare your lane change early."],
  ["TIP-HAZ-01", "HAZARD", "Kijk verder vooruit naar mogelijke gevaren.", "Look further ahead for possible hazards."], ["TIP-SPC-01", "SPACE", "Bewaar voldoende volgafstand.", "Keep enough following distance."],
] as const;

async function main() {
  const skillIds = new Map<string, string>();
  for (const [index, [code, name]] of drivingSkills.entries()) {
    const skill = await prisma.drivingSkill.upsert({ where: { code }, update: { name, sortOrder: index, active: true }, create: { code, name, sortOrder: index, active: true } });
    skillIds.set(code, skill.id);
  }
  const weaknessIds = new Map<string, string>();
  for (const [code, skillCode, label] of weaknessCatalog) {
    const skillId = skillIds.get(skillCode);
    if (!skillId) throw new Error(`Missing skill ${skillCode}`);
    const labelText = label ?? code;
    const weakness = await prisma.weakness.upsert({ where: { code }, update: { label: labelText, skillId }, create: { code, label: labelText, skillId } });
    weaknessIds.set(code, weakness.id);
  }
  const tipIds = new Map<string, string>();
  for (const [code, skillCode, voiceTextNl, voiceTextEn] of verifiedTips) {
    const skillId = skillIds.get(skillCode);
    if (!skillId) throw new Error(`Missing skill ${skillCode}`);
    const tip = await prisma.verifiedTip.upsert({ where: { code }, update: { skillId, voiceTextNl, voiceTextEn, verified: true, adminApproved: true, verifiedAt: new Date(), triggerTypes: [skillCode] }, create: { code, skillId, voiceTextNl, voiceTextEn, verified: true, adminApproved: true, verifiedAt: new Date(), triggerTypes: [skillCode], priority: 10, cooldownSeconds: 90 } });
    tipIds.set(code, tip.id);
  }
  const tipLinks: Array<[string, string]> = [
    ["SPEED_TOO_FAST_ZONE", "TIP-SPD-04"], ["SPEED_LATE_SIGN", "TIP-SPD-01"], ["SPEED_APPROACH", "TIP-SPD-04"],
    ["PRIORITY_RIGHT_UNCERTAIN", "TIP-PRI-01"], ["PRIORITY_STOP_APPROACH", "TIP-PRI-03"], ["OBS_LOOK_AHEAD", "TIP-OBS-01"], ["OBS_BLIND_SPOT", "TIP-OBS-06"], ["OBS_CYCLIST", "TIP-RND-08"],
    ["ROUNDABOUT_WRONG_LANE", "TIP-RND-03"], ["ROUNDABOUT_LATE_LANE_SELECTION", "TIP-RND-03"], ["ROUNDABOUT_EXIT_PREPARATION", "TIP-RND-05"], ["ROUNDABOUT_CYCLIST_OBSERVATION", "TIP-RND-08"],
    ["LANE_CHANGE_MIRROR", "TIP-RND-05"], ["LANE_CHANGE_BLIND_SPOT", "TIP-RND-05"], ["LANE_CHANGE_SIGNAL", "TIP-LAN-03"], ["HAZARD_LATE_REACTION", "TIP-HAZ-01"], ["SPACE_FOLLOWING_DISTANCE", "TIP-SPC-01"],
  ];
  for (const [weaknessCode, tipCode] of tipLinks) if (weaknessIds.get(weaknessCode) && tipIds.get(tipCode)) await prisma.weaknessTip.upsert({ where: { weaknessId_tipId: { weaknessId: weaknessIds.get(weaknessCode)!, tipId: tipIds.get(tipCode)! } }, update: {}, create: { weaknessId: weaknessIds.get(weaknessCode)!, tipId: tipIds.get(tipCode)! } });

  for (const centre of centres) {
    const savedCentre = await prisma.examCentre.upsert({ where: { slug: centre.slug }, update: { ...centre, isPublished: true }, create: { ...centre, isPublished: true } });
    const route = await prisma.route.upsert({ where: { slug: `${centre.slug}-route-04` }, update: { centreId: savedCentre.id, name: "Route 04", status: RouteStatus.PUBLISHED, durationMin: 24, verifiedAt: new Date() }, create: { centreId: savedCentre.id, slug: `${centre.slug}-route-04`, name: "Route 04", status: RouteStatus.PUBLISHED, durationMin: 24, verifiedAt: new Date() } });
    await prisma.routePoint.deleteMany({ where: { routeId: route.id } });
    await prisma.routePoint.createMany({ data: routePoints.map((point) => ({ ...point, routeId: route.id })) });
    const savedPoints = await prisma.routePoint.findMany({ where: { routeId: route.id }, orderBy: { sequence: "asc" } });
    await prisma.routePointFeature.deleteMany({ where: { routePointId: { in: savedPoints.map((point) => point.id) } } });
    const featureMap: Record<string, string[]> = { start: ["START"], "lane-change": ["LANE_SELECTION_REQUIRED", "MIRROR_CHECK"], roundabout: ["ROUNDABOUT", "MULTI_LANE", "LANE_SELECTION_REQUIRED", "CYCLIST_CONFLICT"], "speed-zone": ["SPEED_ZONE", "SIGN_CHANGE", "CYCLIST_CONFLICT"] };
    await prisma.routePointFeature.createMany({ data: savedPoints.flatMap((point) => (featureMap[point.category] ?? []).map((featureCode) => ({ routePointId: point.id, featureCode, complexity: point.category === "roundabout" ? "HIGH" : "MEDIUM", verified: true }))) });
    await prisma.routeSkillCoverage.deleteMany({ where: { routeId: route.id } });
    const coverageCodes = new Set<string>(savedPoints.flatMap((point) => point.category === "roundabout" ? ["ROUNDABOUT", "OBSERVATION", "POSITION", "VULNERABLE"] : point.category === "lane-change" ? ["LANE_CHANGE", "OBSERVATION", "POSITION"] : point.category === "speed-zone" ? ["SPEED", "SIGNS", "VULNERABLE"] : ["CONTROL", "OBSERVATION"]));
    await prisma.routeSkillCoverage.createMany({ data: [...coverageCodes].map((skillCode) => ({ routeId: route.id, skillId: skillIds.get(skillCode)!, coverageWeight: skillCode === "ROUNDABOUT" ? 3 : 1, verified: true })) });
  }

  for (const plan of [
    { name: "1 day", durationHours: 24, priceCents: 295 },
    { name: "1 week", durationHours: 168, priceCents: 895 },
    { name: "1 month", durationHours: 720, priceCents: 1295 },
    { name: "3 months", durationHours: 2160, priceCents: 1395 },
  ]) await prisma.plan.upsert({ where: { name: plan.name }, update: { ...plan, isActive: true }, create: { ...plan, currency: "EUR", isActive: true } });

  console.log(`Seeded ${centres.length} centres, ${drivingSkills.length} skills, ${weaknessCatalog.length} weaknesses, verified tips and 4 access plans.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
