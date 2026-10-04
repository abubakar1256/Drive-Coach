import { PrismaClient, RouteStatus, UserRole } from "@prisma/client";
import { officialCentres as centres } from "../src/exam-centres/official-centres";

const prisma = new PrismaClient();

// Official passage-point names published by Autoveiligheid for the Alken exam centre.
// The source does not publish an exact Route 1 sequence or GPS coordinates, so those
// fields intentionally remain pending admin verification rather than being guessed.
const officialAlkenPassagePoints = [
  ["Alken", "Meerdegatstraat - Expressweg"],
  ["Hasselt", "Eugeen Leenlaan - Luikersteenweg"],
  ["Hasselt", "Sint-Truidersteenweg - Vorststraat"],
  ["Hasselt", "Lentestraat - Zomerstraat"],
  ["Hasselt", "De Geloesplein"],
  ["Hasselt", "Prins Bisschopssingel - Sint-Truidersteenweg"],
  ["Hasselt", "Boomkensstraat - Kruisherenlaan"],
  ["Hasselt", "Abelenstraat - Boomkensstraat"],
  ["Hasselt", "Slagerslaan - Boerenkrijgsstraat"],
  ["Hasselt", "Sint-Hubertusplein"],
  ["Hasselt", "Runkstersteenweg - Boerenkrijgsingel"],
  ["Hasselt", "Notelarenstraat - Jagersstraat"],
  ["Hasselt", "Sint-Martinusplein"],
  ["Hasselt", "Sint-Truidersteenweg - Overmerelaan"],
  ["Hasselt", "Sint-Truidersteenweg - De Berlaymontstraat"],
  ["Alken", "Meerdegatstraat - Kolmenstraat"],
  ["Hasselt", "Schoolstraat - Fonteinstraat"],
  ["Hasselt", "Groenmolenstraat - Stationsstraat"],
  ["Hasselt", "Kliniekstraat - Prins Bisschopssingel"],
  ["Hasselt", "Luikersteenweg - Daniëlstraat"],
  ["Hasselt", "Kolmenstraat - Groenmolenstraat"],
  ["Alken", "Meerdegatstraat - Steenweg"],
  ["Hasselt", "Pastorijstraat - Sint-Truidersteenweg"],
  ["Hasselt", "Graaf de Brigodestraat - Sint-Lambrechts-Herkstraat"],
  ["Hasselt", "Rode-Kruisstraat - Lindenhofstraat"],
  ["Hasselt", "Lindenhofstraat - Beukenhofstraat"],
  ["Hasselt", "Steenweg - Stationsstraat"],
  ["Hasselt", "Sint-Lambertusstraat - Sint-Truidersteenweg"],
  ["Hasselt", "Pastorijstraat - Graaf de Brigodestraat"],
  ["Hasselt", "Papenakkerstraat - Gravin de Stembierstraat"],
  ["Hasselt", "Sint-Truidersteenweg - Kruisherenlaan"],
  ["Hasselt", "Sint-Truidersteenweg - Biezenstraat"],
] as const;

const officialPassageSource = {
  sourceLabel: "Autoveiligheid officiële doorgangspunten",
  sourceUrl: "https://www.autoveiligheid.be/downloaden/doorgangspunten-1005",
  sourceRevision: "NGD-EC126-GN 01-11-2024 (1005)",
};

const practicePointOffsets = [
  { category: "start", title: "Leave the test centre", description: "Check mirrors and position before joining traffic", warning: null, latitude: 0, longitude: 0 },
  { category: "lane-change", title: "Lane change before junction", description: "Move over early and keep the junction clear", warning: "Check the mirror and blind spot before moving over", latitude: 0.0035, longitude: 0.0055 },
  { category: "roundabout", title: "Two-lane roundabout", description: "Choose the correct lane for the second exit", warning: "Signal only when leaving the roundabout", latitude: 0.001, longitude: 0.011 },
  { category: "speed-zone", title: "Residential speed zone", description: "Look for cyclists and changing speed limits", warning: "Read the next speed sign before the zone begins", latitude: -0.004, longitude: 0.007 },
] as const;

function buildPracticeRoutePoints(centre: (typeof centres)[number]) {
  const direction = centre.slug.length % 2 === 0 ? 1 : -1;
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

  return practicePointOffsets.map((point, index) => ({
    sequence: index + 1,
    category: point.category,
    title: point.title,
    description: point.description,
    warning: point.warning,
    latitude: round(centre.latitude + point.latitude * direction),
    longitude: round(centre.longitude + point.longitude * direction),
  }));
}

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

const expandedWeaknessCatalog = drivingSkills.flatMap(([skillCode, skillName]) => Array.from({ length: 10 }, (_, index) => [`${skillCode}_PATTERN_${String(index + 1).padStart(2, "0")}`, skillCode, `${skillName} practice pattern ${index + 1}`] as const));
const allWeaknesses = [...weaknessCatalog, ...expandedWeaknessCatalog] as const;

const verifiedTips = [
  ["TIP-SPD-01", "SPEED", "Controleer je snelheid.", "Check your speed."], ["TIP-SPD-04", "SPEED", "Pas je snelheid tijdig aan.", "Adjust your speed early."],
  ["TIP-PRI-01", "PRIORITY", "Controleer de voorrangssituatie.", "Check the priority situation."], ["TIP-PRI-03", "PRIORITY", "Voorrangssituatie nadert. Observeer tijdig.", "Priority situation ahead. Observe early."],
  ["TIP-OBS-01", "OBSERVATION", "Kijk verder vooruit.", "Look further ahead."], ["TIP-OBS-06", "OBSERVATION", "Controleer je dode hoek.", "Check your blind spot."],
  ["TIP-RND-03", "ROUNDABOUT", "Kies tijdig de juiste rijstrook.", "Choose the correct lane early."], ["TIP-RND-05", "ROUNDABOUT", "Controleer spiegels en dode hoek vóór je van rijstrook verandert.", "Check mirrors and blind spot before changing lanes."],
  ["TIP-RND-08", "ROUNDABOUT", "Controleer op fietsers.", "Check for cyclists."], ["TIP-LAN-03", "LANE_CHANGE", "Bereid je rijstrookwissel tijdig voor.", "Prepare your lane change early."],
  ["TIP-HAZ-01", "HAZARD", "Kijk verder vooruit naar mogelijke gevaren.", "Look further ahead for possible hazards."], ["TIP-SPC-01", "SPACE", "Bewaar voldoende volgafstand.", "Keep enough following distance."],
] as const;

const draftTips = drivingSkills.flatMap(([skillCode, skillName]) => Array.from({ length: 5 }, (_, index) => [`TIP-${skillCode}-${String(index + 1).padStart(2, "0")}`, skillCode, `${skillName}: oefen deze stap rustig en tijdig.`, `${skillName}: practise this step calmly and early.`] as const));
const tipCatalog = [...verifiedTips, ...draftTips] as const;
const frenchSkillNames: Record<string, string> = { SPEED: "Conscience de la vitesse", PRIORITY: "Priorité et droit de passage", OBSERVATION: "Observation", HAZARD: "Détection des dangers", POSITION: "Position sur la chaussée", LANE_CHANGE: "Changement de voie", JUNCTION: "Carrefours", ROUNDABOUT: "Ronds-points", TURNING: "Virages", SIGNS: "Panneaux et feux", VULNERABLE: "Usagers vulnérables", SPACE: "Distance et espace", MERGING: "Insertion et dépassement", SPECIAL: "Situations particulières", CONTROL: "Maîtrise du véhicule", MANOEUVRE: "Manœuvres" };
const frenchTipText: Record<string, string> = {
  "TIP-SPD-01": "Contrôlez votre vitesse.", "TIP-SPD-04": "Adaptez votre vitesse à temps.", "TIP-PRI-01": "Contrôlez la situation de priorité.", "TIP-PRI-03": "Une situation de priorité approche. Observez à temps.",
  "TIP-OBS-01": "Regardez plus loin devant.", "TIP-OBS-06": "Contrôlez votre angle mort.", "TIP-RND-03": "Choisissez la bonne voie à temps.", "TIP-RND-05": "Contrôlez les rétroviseurs et l’angle mort avant de changer de voie.",
  "TIP-RND-08": "Contrôlez la présence de cyclistes.", "TIP-LAN-03": "Préparez votre changement de voie à temps.", "TIP-HAZ-01": "Regardez plus loin pour repérer les dangers possibles.", "TIP-SPC-01": "Gardez une distance de sécurité suffisante."
};

async function main() {
  const skillIds = new Map<string, string>();
  for (const [index, [code, name]] of drivingSkills.entries()) {
    const skill = await prisma.drivingSkill.upsert({ where: { code }, update: { name, sortOrder: index, active: true }, create: { code, name, sortOrder: index, active: true } });
    skillIds.set(code, skill.id);
  }
  const weaknessIds = new Map<string, string>();
  for (const [code, skillCode, label] of allWeaknesses) {
    const skillId = skillIds.get(skillCode);
    if (!skillId) throw new Error(`Missing skill ${skillCode}`);
    const labelText = label ?? code;
    const weakness = await prisma.weakness.upsert({ where: { code }, update: { label: labelText, skillId }, create: { code, label: labelText, skillId } });
    weaknessIds.set(code, weakness.id);
  }
  const tipIds = new Map<string, string>();
  for (const [code, skillCode, voiceTextNl, voiceTextEn] of tipCatalog) {
    const skillId = skillIds.get(skillCode);
    if (!skillId) throw new Error(`Missing skill ${skillCode}`);
    const approved = verifiedTips.some(([verifiedCode]) => verifiedCode === code);
    const voiceTextFr = frenchTipText[code] ?? `${frenchSkillNames[skillCode] ?? skillCode} : entraînez cette étape calmement et à temps.`;
    const source = approved ? "FOD Mobilité / Wegcode" : null;
    const sourceReference = approved ? "https://mobilit.belgium.be/nl/weg/rijden/wegcode-verkeersregels-en-sancties/verkeersregels" : null;
    const tip = await prisma.verifiedTip.upsert({ where: { code }, update: { skillId, voiceTextNl, voiceTextFr, voiceTextEn, verified: approved, adminApproved: approved, verifiedAt: approved ? new Date() : null, triggerTypes: [skillCode], source, sourceReference, jurisdiction: "BE-FL", ruleVersion: "CURRENT_1975", validUntil: approved ? new Date("2027-05-31T23:59:59.999Z") : null }, create: { code, skillId, voiceTextNl, voiceTextFr, voiceTextEn, verified: approved, adminApproved: approved, verifiedAt: approved ? new Date() : null, triggerTypes: [skillCode], priority: 10, cooldownSeconds: 90, source, sourceReference, jurisdiction: "BE-FL", ruleVersion: "CURRENT_1975", validUntil: approved ? new Date("2027-05-31T23:59:59.999Z") : null } });
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
    const route = await prisma.route.upsert({ where: { slug: `${centre.slug}-route-04` }, update: { centreId: savedCentre.id, name: "Route 04", status: RouteStatus.PUBLISHED, durationMin: 24, verifiedAt: new Date(), sourceLabel: "Drive Coach centre-area practice preview", verificationStatus: "PRACTICE_PREVIEW" }, create: { centreId: savedCentre.id, slug: `${centre.slug}-route-04`, name: "Route 04", status: RouteStatus.PUBLISHED, durationMin: 24, verifiedAt: new Date(), sourceLabel: "Drive Coach centre-area practice preview", verificationStatus: "PRACTICE_PREVIEW" } });
    await prisma.routePoint.deleteMany({ where: { routeId: route.id } });
    const centreRoutePoints = buildPracticeRoutePoints(centre);
    await prisma.routePoint.createMany({ data: centreRoutePoints.map((point) => ({ ...point, routeId: route.id })) });
    const savedPoints = await prisma.routePoint.findMany({ where: { routeId: route.id }, orderBy: { sequence: "asc" } });
    await prisma.routePointFeature.deleteMany({ where: { routePointId: { in: savedPoints.map((point) => point.id) } } });
    const featureMap: Record<string, string[]> = { start: ["START"], "lane-change": ["LANE_SELECTION_REQUIRED", "MIRROR_CHECK"], roundabout: ["ROUNDABOUT", "MULTI_LANE", "LANE_SELECTION_REQUIRED", "CYCLIST_CONFLICT"], "speed-zone": ["SPEED_ZONE", "SIGN_CHANGE", "CYCLIST_CONFLICT"] };
    await prisma.routePointFeature.createMany({ data: savedPoints.flatMap((point) => (featureMap[point.category] ?? []).map((featureCode) => ({ routePointId: point.id, featureCode, complexity: point.category === "roundabout" ? "HIGH" : "MEDIUM", verified: true }))) });
    await prisma.routeSkillCoverage.deleteMany({ where: { routeId: route.id } });
    const coverageCodes = new Set<string>(savedPoints.flatMap((point) => point.category === "roundabout" ? ["ROUNDABOUT", "OBSERVATION", "POSITION", "VULNERABLE"] : point.category === "lane-change" ? ["LANE_CHANGE", "OBSERVATION", "POSITION"] : point.category === "speed-zone" ? ["SPEED", "SIGNS", "VULNERABLE"] : ["CONTROL", "OBSERVATION"]));
    await prisma.routeSkillCoverage.createMany({ data: [...coverageCodes].map((skillCode) => ({ routeId: route.id, skillId: skillIds.get(skillCode)!, coverageWeight: skillCode === "ROUNDABOUT" ? 3 : 1, verified: true })) });
  }

  const alken = await prisma.examCentre.upsert({
    where: { slug: "alken" },
    update: { name: "Alken", city: "Alken", area: null, region: "Limburg", latitude: 50.875, longitude: 5.307, isPublished: true },
    create: { slug: "alken", name: "Alken", city: "Alken", area: null, region: "Limburg", latitude: 50.875, longitude: 5.307, isPublished: true, description: "Official passage-point reference for the Alken driving-test area." },
  });
  await prisma.route.upsert({
    where: { slug: "alken-route-1" },
    update: { centreId: alken.id, sourceLabel: officialPassageSource.sourceLabel, sourceUrl: officialPassageSource.sourceUrl, verificationStatus: "PENDING_REVIEW" },
    create: { centreId: alken.id, slug: "alken-route-1", name: "Route 1", status: RouteStatus.DRAFT, durationMin: 24, sourceLabel: officialPassageSource.sourceLabel, sourceUrl: officialPassageSource.sourceUrl, verificationStatus: "PENDING_REVIEW" },
  });
  for (const [index, [municipality, junction]] of officialAlkenPassagePoints.entries()) {
    await prisma.officialPassagePoint.upsert({
      where: { centreId_sequence: { centreId: alken.id, sequence: index + 1 } },
      update: { municipality, junction, ...officialPassageSource },
      create: { centreId: alken.id, sequence: index + 1, municipality, junction, ...officialPassageSource, verificationStatus: "PENDING_REVIEW" },
    });
  }

  for (const plan of [
    { name: "1 day", durationHours: 24, priceCents: 295 },
    { name: "1 week", durationHours: 168, priceCents: 895 },
    { name: "1 month", durationHours: 720, priceCents: 1295 },
    { name: "3 months", durationHours: 2160, priceCents: 1395 },
  ]) await prisma.plan.upsert({ where: { name: plan.name }, update: { ...plan, isActive: true }, create: { ...plan, currency: "EUR", isActive: true } });

  console.log(`Seeded ${centres.length} centres, ${drivingSkills.length} skills, ${allWeaknesses.length} weaknesses, ${tipCatalog.length} tips (${verifiedTips.length} approved) and 4 access plans.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
