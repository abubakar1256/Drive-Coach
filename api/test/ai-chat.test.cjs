require("reflect-metadata");
const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const { ForbiddenException, Logger, ValidationPipe } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { JwtService } = require("@nestjs/jwt");
const { plainToInstance } = require("class-transformer");
const { validate } = require("class-validator");
const { AiChatService } = require("../dist/src/ai-chat/ai-chat.service");
const { AiChatDto } = require("../dist/src/ai-chat/dto/ai-chat.dto");
const { AiChatModule } = require("../dist/src/ai-chat/ai-chat.module");
const { RoutesService } = require("../dist/src/routes/routes.service");
const { PrismaService } = require("../dist/src/prisma.service");
const { OptionalJwtAuthGuard } = require("../dist/src/auth/auth.guard");

Logger.overrideLogger(false);
const originalFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
let calls;
let routes;
let service;

function answerPayload(text = "A complete practice checklist. Finish with a reflection.", finishReason = "STOP", extraParts = []) {
  return { candidates: [{ finishReason, content: { parts: [...extraParts, { text }] } }] };
}

function mockProvider(...replies) {
  global.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply?.body ?? reply), { status: reply?.status ?? 200, headers: { "Content-Type": "application/json" } });
  };
}

const question = (context = {}) => ({ messages: [{ role: "user", content: "Give me a complete practice checklist." }], context });
const route = (preview = true) => ({
  name: "Test route 1", slug: "test-route-1", durationMin: 30, verificationStatus: "UNVERIFIED",
  centre: { name: "Test Centre", city: "Test City", area: "North" },
  access: { preview, premium: !preview },
  points: [{ id: "public-point", sequence: 1, category: "roundabout", title: "Visible roundabout", description: "Prepare your lane early.", warning: "Observe cyclists." }],
});

beforeEach(() => {
  process.env.GEMINI_API_KEY = "fake-test-key-not-a-credential";
  process.env.GEMINI_MODEL = "gemini-3-flash-preview";
  calls = [];
  routes = { getBySlug: async () => null, getAccessibleBySlug: async () => { throw new ForbiddenException(); } };
  service = new AiChatService(routes);
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel;
});

test("complete answers use sufficient tokens, low thinking and a secret-free URL", async () => {
  mockProvider(answerPayload("Complete answer.", "STOP", [{ text: "Private thoughts", thought: true }]));
  assert.deepEqual(await service.answer(question(), "guest"), { message: "Complete answer." });
  assert.equal(calls[0].body.generationConfig.maxOutputTokens, 4096);
  assert.equal(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.ok(!calls[0].url.includes(process.env.GEMINI_API_KEY));
  assert.equal(calls[0].options.headers["x-goog-api-key"], process.env.GEMINI_API_KEY);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.match(calls[0].body.system_instruction.parts[0].text, /Answer every part/);
});

test("MAX_TOKENS triggers one full regeneration, not concatenated fragments", async () => {
  mockProvider(answerPayload("Introduction.\n- **", "MAX_TOKENS"), answerPayload("Complete checklist with all requested topics."));
  const response = await service.answer(question(), "guest");
  assert.equal(response.message, "Complete checklist with all requested topics.");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.generationConfig.maxOutputTokens, 8192);
  assert.deepEqual(calls[1].body.contents, calls[0].body.contents);
});

test("empty output is regenerated instead of shown as a successful reply", async () => {
  mockProvider({ candidates: [{ finishReason: "STOP", content: { parts: [] } }] }, answerPayload("Completed on retry."));
  assert.equal((await service.answer(question(), "guest")).message, "Completed on retry.");
  assert.equal(calls.length, 2);
});

test("malformed provider payloads are retried without an unhandled server error", async () => {
  mockProvider({ candidates: [{ finishReason: "STOP", content: { parts: null } }] }, answerPayload("Recovered from malformed output."));
  assert.equal((await service.answer(question(), "guest")).message, "Recovered from malformed output.");
  assert.equal(calls.length, 2);
});

test("unfinished Markdown is regenerated even when the provider reports STOP", async () => {
  mockProvider(answerPayload("Start with **mirrors"), answerPayload("Check your mirrors before manoeuvring."));
  assert.equal((await service.answer(question(), "guest")).message, "Check your mirrors before manoeuvring.");
  assert.equal(calls.length, 2);
});

test("repeated incomplete responses return a retryable error, never a broken answer", async () => {
  mockProvider(answerPayload("Partial", "MAX_TOKENS"));
  await assert.rejects(service.answer(question(), "guest"), (error) => error.getResponse().code === "AI_INCOMPLETE");
  assert.equal(calls.length, 2);
});

test("transient provider failure retries once", async () => {
  mockProvider({ status: 503, body: {} }, answerPayload("Provider recovered."));
  assert.equal((await service.answer(question(), "guest")).message, "Provider recovered.");
  assert.equal(calls.length, 2);
});

test("network failure retries once", async () => {
  mockProvider(new TypeError("fetch failed"), answerPayload("Network recovered."));
  assert.equal((await service.answer(question(), "guest")).message, "Network recovered.");
});

test("quota exhaustion is reported without another quota-consuming retry", async () => {
  mockProvider({ status: 429, body: { error: { message: "Sensitive provider detail" } } });
  await assert.rejects(service.answer(question(), "guest"), (error) => error.getStatus() === 429 && error.getResponse().code === "AI_PROVIDER_RATE_LIMIT" && !JSON.stringify(error.getResponse()).includes("Sensitive"));
  assert.equal(calls.length, 1);
});

test("safety-blocked output is not bypassed by retrying", async () => {
  mockProvider(answerPayload("Unsafe fragment", "SAFETY"));
  await assert.rejects(service.answer(question(), "guest"), (error) => error.getResponse().code === "AI_BLOCKED");
  assert.equal(calls.length, 1);
});

test("timeouts have a distinct error and do not retry beyond the deadline", async () => {
  const error = new Error("timeout"); error.name = "TimeoutError";
  mockProvider(error);
  await assert.rejects(service.answer(question(), "guest"), (caught) => caught.getStatus() === 504 && caught.getResponse().code === "AI_TIMEOUT");
  assert.equal(calls.length, 1);
});

test("Gemini 2.5 uses a supported thinking budget rather than Gemini 3 levels", async () => {
  process.env.GEMINI_MODEL = "gemini-2.5-flash";
  mockProvider(answerPayload());
  await service.answer(question(), "guest");
  assert.deepEqual(calls[0].body.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
});

test("missing key reports configuration failure before any provider call", async () => {
  delete process.env.GEMINI_API_KEY;
  mockProvider(answerPayload());
  await assert.rejects(service.answer(question(), "guest"), (error) => error.getResponse().code === "AI_NOT_CONFIGURED");
  assert.equal(calls.length, 0);
});

test("guests get server-resolved preview points and forged client notes are ignored", async () => {
  routes.getBySlug = async (slug) => { assert.equal(slug, "test-route-1"); return route(); };
  routes.getAccessibleBySlug = async () => assert.fail("A guest must not access the full route");
  mockProvider(answerPayload());
  await service.answer(question({ page: "/routes/test-route-1", selectedPointId: "public-point", forgedRoute: "Secret street at 999 km/h" }), "guest");
  const prompt = calls[0].body.system_instruction.parts[0].text;
  assert.match(prompt, /Visible roundabout/);
  assert.match(prompt, /Observe cyclists/);
  assert.match(prompt, /preview only/);
  assert.match(prompt, /"selected":true/);
  assert.ok(!prompt.includes("999 km/h"));
  assert.ok(!prompt.includes("latitude"));
});

test("authenticated free users fall back to preview without disclosing hidden points", async () => {
  routes.getAccessibleBySlug = async (userId) => { assert.equal(userId, "free-user"); throw new ForbiddenException(); };
  routes.getBySlug = async () => route();
  mockProvider(answerPayload());
  await service.answer(question({ page: "/routes/test-route-1", selectedPointId: "hidden-point" }), "guest", "free-user");
  const prompt = calls[0].body.system_instruction.parts[0].text;
  assert.match(prompt, /preview only/);
  assert.ok(!prompt.includes("hidden-point"));
});

test("authorized users get full-route warnings", async () => {
  routes.getAccessibleBySlug = async (userId) => { assert.equal(userId, "premium-user"); const full = route(false); full.points.push({ id: "premium-point", sequence: 4, category: "junction", title: "Full route junction", warning: "Prepare your observation." }); return full; };
  routes.getBySlug = async () => assert.fail("Preview fallback should not be used");
  mockProvider(answerPayload());
  await service.answer(question({ page: "/routes/test-route-1" }), "guest", "premium-user");
  assert.match(calls[0].body.system_instruction.parts[0].text, /Full route junction/);
  assert.match(calls[0].body.system_instruction.parts[0].text, /full route access/);
});

test("database failure still permits general guidance without guessing road facts", async () => {
  routes.getBySlug = async () => { throw new Error("Database unavailable"); };
  mockProvider(answerPayload());
  await service.answer(question({ page: "/routes/test-route-1" }), "guest");
  assert.match(calls[0].body.system_instruction.parts[0].text, /Route data could not be loaded/);
});

test("invalid route paths are not queried or treated as trustworthy context", async () => {
  routes.getBySlug = async () => assert.fail("Invalid route must not be queried");
  mockProvider(answerPayload());
  await service.answer(question({ page: "/routes/%2Fsecrets" }), "guest");
  assert.match(calls[0].body.system_instruction.parts[0].text, /No valid route identifier/);
});

test("DTO rejects empty, blank and oversized conversations", async () => {
  for (const messages of [[], [{ role: "user", content: "   " }], Array.from({ length: 21 }, () => ({ role: "user", content: "question" }))]) {
    const errors = await validate(plainToInstance(AiChatDto, { messages }));
    assert.ok(errors.length > 0);
  }
  assert.equal((await validate(plainToInstance(AiChatDto, question()))).length, 0);
});

test("chat rate limit is explicit and applied once per user question", async () => {
  mockProvider(answerPayload());
  for (let i = 0; i < 20; i++) await service.answer(question(), "same-client");
  await assert.rejects(service.answer(question(), "same-client"), (error) => error.getStatus() === 429 && error.getResponse().code === "CHAT_RATE_LIMITED");
  assert.equal(calls.length, 20);
});

test("optional auth accepts guests, rejects invalid supplied tokens and verifies valid users", () => {
  const guard = new OptionalJwtAuthGuard(new JwtService({ secret: "test-signing-secret" }));
  const jwt = new JwtService({ secret: "test-signing-secret" });
  const { JWT_ACCESS_SECRET } = require("../dist/src/auth/auth.service");
  const token = jwt.sign({ sub: "verified-user" }, { secret: JWT_ACCESS_SECRET, expiresIn: "15m" });
  const context = (request) => ({ switchToHttp: () => ({ getRequest: () => request }) });
  assert.equal(guard.canActivate(context({ headers: {} })), true);
  assert.throws(() => guard.canActivate(context({ headers: { authorization: "Bearer invalid" } })), /Invalid or expired/);
  const request = { headers: { authorization: `Bearer ${token}` } };
  assert.equal(guard.canActivate(context(request)), true);
  assert.equal(request.user.sub, "verified-user");
});

test("real Nest module wiring and validation accept the 11th chat question", async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AiChatModule] })
    .overrideProvider(PrismaService).useValue({})
    .overrideProvider(RoutesService).useValue(routes)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(0, "127.0.0.1");
  try {
    mockProvider(answerPayload());
    const url = `${await app.getUrl()}/api/v1/ai/chat`;
    const messages = [];
    for (let i = 1; i <= 12; i++) {
      messages.push({ role: "user", content: `Question ${i}` });
      const response = await originalFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: messages.slice(-19) }) });
      assert.equal(response.status, 201, `Question ${i}`);
      assert.ok((await response.json()).message);
      messages.push({ role: "assistant", content: "Complete answer." });
    }
    const invalid = await originalFetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer invalid" }, body: JSON.stringify(question()) });
    assert.equal(invalid.status, 401);
  } finally { await app.close(); }
});
