// Local-only browser QA: exercises the real chatbot/controller against a fake
// provider and route fixture. No production API calls or database writes.
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { ForbiddenException, Logger, ValidationPipe } = require("@nestjs/common");
const { AiChatModule } = require("../dist/src/ai-chat/ai-chat.module");
const { PrismaService } = require("../dist/src/prisma.service");
const { RoutesService } = require("../dist/src/routes/routes.service");
const { BillingService } = require("../dist/src/billing/billing.service");
const { AuthService, JWT_ACCESS_SECRET } = require("../dist/src/auth/auth.service");
const { JwtService } = require("@nestjs/jwt");

Logger.overrideLogger(false);
process.env.GEMINI_API_KEY = "local-mock-key";
process.env.GEMINI_MODEL = "gemini-3-flash-preview";
const attempts = new Map();
const expiryByUser = new Map();
// Local fake logins only: premium/diamond/free/expired/expiring@local.test.
const entitlement = (userId) => {
  const expiresAt = expiryByUser.get(userId) ?? (userId === "expired" ? new Date(Date.now() - 1000).toISOString() : new Date(Date.now() + 86_400_000).toISOString());
  const active = ["premium", "diamond", "expiring"].includes(userId) && Date.parse(expiresAt) > Date.now();
  return { plan: active ? userId === "diamond" ? "Diamond" : "Premium" : "Free", status: active ? "ACTIVE" : "FREE", expiresAt, features: { aiChat: active } };
};
const mockUser = (id) => ({ id, email: `${id}@local.test`, displayName: "Local QA learner", role: "LEARNER", emailVerified: true, subscription: { status: entitlement(id).status, planName: entitlement(id).plan, expiresAt: entitlement(id).expiresAt } });

global.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  const question = body.contents.at(-1).parts[0].text;
  if (question.includes("[quota-test]")) return new Response("{}", { status: 429 });
  const attempt = (attempts.get(question) ?? 0) + 1;
  attempts.set(question, attempt);
  const nl = /Nederlands|oefenrit|voorbereiding|spiegels/.test(question);
  const text = attempt === 1 ? "Checklist:\n- **" : nl
    ? "Dit is een volledige oefenchecklist (lokale testgegevens):\n\n- **Voorbereiding:** Plan een rustige oefenrit en bespreek je aandachtspunten met je begeleider.\n- **Spiegels en observatie:** Controleer vóór elke manoeuvre je omgeving.\n- **Snelheid:** Let op de actuele verkeersborden en pas je snelheid aan de omstandigheden aan.\n- **Rijstrookkeuze:** Bereid je positie tijdig voor.\n- **Rotondes:** Bestudeer de borden, kijk goed en bereid je uitrit voor.\n- **Zelfreflectie:** Stop veilig en noteer wat goed ging en wat je verder wilt oefenen.\n\n**Samenvatting:** Bespreek je volgende oefendoel met je begeleider. Lees of verstuur geen chatberichten tijdens het rijden."
    : "Here is a complete practice checklist (local test data):\n\n- **Preparation:** Plan a calm practice drive and discuss your focus points with your instructor.\n- **Mirrors and observation:** Check your surroundings before manoeuvring.\n- **Speed:** Follow current signs and adjust to the conditions.\n- **Lane choice:** Prepare your position early.\n- **Roundabouts:** Read the signs, observe carefully and prepare your exit.\n- **Self-reflection:** Stop safely, then record what went well and what needs practice.\n\n**Summary:** Agree on one next practice goal with your instructor. Do not read or send chat messages while driving.";
  return new Response(JSON.stringify({ candidates: [{ finishReason: attempt === 1 ? "MAX_TOKENS" : "STOP", content: { parts: [{ text }] } }] }), { headers: { "Content-Type": "application/json" } });
};

const centre = { slug: "brussels-south", name: "Anderlecht", city: "Brussels", area: "Anderlecht", region: "Brussels", description: "Local route fixture", isPublished: true, latitude: 50.83, longitude: 4.30, _count: { routes: 1 } };
const route = { id: "test-route", slug: "brussels-south-route-04", name: "Local QA route", durationMin: 30, distanceKm: 8, status: "PUBLISHED", verificationStatus: "UNVERIFIED", centre, access: { premium: false, preview: true }, points: [
  { id: "test-point-1", sequence: 1, category: "roundabout", title: "Local test roundabout", description: "Prepare your lane early.", warning: "Observe cyclists.", latitude: 50.83, longitude: 4.30 },
  { id: "test-point-2", sequence: 2, category: "junction", title: "Local test junction", description: "Check your surroundings.", warning: "Read the current signs.", latitude: 50.84, longitude: 4.31 },
] };

async function main() {
  const moduleRef = await Test.createTestingModule({ imports: [AiChatModule] })
    .overrideProvider(PrismaService).useValue({})
    .overrideProvider(RoutesService).useValue({ list: async () => [route], getBySlug: async () => route, points: async () => route.points, getAccessibleBySlug: async () => { throw new ForbiddenException(); } })
    .overrideProvider(BillingService).useValue({ entitlements: async (id) => entitlement(id) })
    .overrideProvider(AuthService).useValue({
      me: async (id) => mockUser(id),
      login: async ({ email }) => {
        const id = email.split("@")[0];
        if (id === "expiring") expiryByUser.set(id, new Date(Date.now() + 15_000).toISOString());
        return { accessToken: new JwtService().sign({ sub: id }, { secret: JWT_ACCESS_SECRET, expiresIn: "15m" }), refreshToken: "local-mock-refresh", user: mockUser(id) };
      },
      logout: async () => ({ ok: true }),
    })
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(4607, "127.0.0.1");
  console.log("Local mock chatbot API ready at http://127.0.0.1:4607/api/v1");
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
