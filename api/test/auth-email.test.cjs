require("reflect-metadata");
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { sendAuthEmail, emailFailureReason } = require("../dist/src/auth/auth-email");
const { AuthService } = require("../dist/src/auth/auth.service");
const variables = ["NODE_ENV", "BREVO_API_KEY", "BREVO_FROM_EMAIL", "BREVO_FROM_NAME", "RESEND_API_KEY", "RESEND_FROM_EMAIL"];
let saved, originalFetch, logs, logger;
beforeEach(() => {
  saved = Object.fromEntries(variables.map(key => [key, process.env[key]])); originalFetch = global.fetch;
  for (const key of variables) delete process.env[key];
  process.env.NODE_ENV = "production";
  logs = []; logger = { error: line => logs.push(line), log: line => logs.push(line) };
  global.fetch = async () => { throw Error("Unexpected real email request"); };
});
afterEach(() => { global.fetch = originalFetch; for (const key of variables) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
function brevo() { process.env.BREVO_API_KEY = " secret-test-key "; process.env.BREVO_FROM_EMAIL = "Drive Coach <sender@example.test>"; }
const email = "recipient@example.test", link = "https://example.test/auth/verify-email?token=private-token";
test("missing email configuration fails with a safe diagnostic", async () => {
  assert.equal(await sendAuthEmail(email, "Verify", link, logger), false);
  assert.deepEqual(logs, ["AUTH_EMAIL provider=none reason=NOT_CONFIGURED"]);
});
test("Brevo rejects a request: log status/category, never raw provider data", async () => {
  brevo();
  global.fetch = async (url, init) => {
    assert.equal(init.headers["api-key"], "secret-test-key"); assert.ok(init.signal);
    assert.deepEqual(JSON.parse(init.body).sender, { name: "Drive Coach", email: "sender@example.test" });
    return { ok: false, status: 401, json: async () => ({ code: "unauthorized", message: `Invalid key secret-test-key; ${email}; ${link}` }) };
  };
  assert.equal(await sendAuthEmail(email, "Verify", link, logger), false);
  assert.deepEqual(logs, ["AUTH_EMAIL provider=brevo status=401 reason=INVALID_API_KEY"]);
  for (const secret of [email, link, "secret-test-key", "private-token"]) assert.ok(!logs.join().includes(secret));
});
test("provider acceptance requires a message ID and does not claim delivery", async () => {
  brevo(); global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(body.html, undefined);
    assert.ok(body.htmlContent.includes(link));
    assert.deepEqual(body.to, [{ email }]);
    return { ok: true, status: 201, json: async () => ({ messageId: "accepted-id" }) };
  };
  assert.equal(await sendAuthEmail(email, "Verify", link, logger), true);
  assert.match(logs[0], /result=ACCEPTED/); assert.doesNotMatch(logs[0], /DELIVERED/);
});
test("malformed successful provider response fails closed", async () => {
  brevo(); global.fetch = async () => ({ ok: true, status: 201, json: async () => ({}) });
  assert.equal(await sendAuthEmail(email, "Verify", link, logger), false); assert.match(logs[0], /INVALID_PROVIDER_RESPONSE/);
});
test("network and timeout failures never log exception secrets", async () => {
  brevo();
  for (const name of ["Error", "TimeoutError"]) {
    logs.length = 0;
    global.fetch = async () => { const error = Error(link); error.name = name; throw error; };
    assert.equal(await sendAuthEmail(email, "Verify", link, logger), false);
    assert.match(logs[0], name === "TimeoutError" ? /REQUEST_TIMEOUT/ : /NETWORK_ERROR/); assert.ok(!logs[0].includes(link));
  }
});
test("Resend follows the same acceptance and privacy policy", async () => {
  process.env.RESEND_API_KEY = "test-resend-key"; process.env.RESEND_FROM_EMAIL = "sender@example.test";
  global.fetch = async (url, init) => { assert.equal(url, "https://api.resend.com/emails"); assert.equal(init.headers.Authorization, "Bearer test-resend-key"); const body = JSON.parse(init.body); assert.ok(body.html.includes(link)); assert.equal(body.htmlContent, undefined); return { ok: true, status: 200, json: async () => ({ id: "opaque-id" }) }; };
  assert.equal(await sendAuthEmail(email, "Verify", link, logger), true); assert.match(logs[0], /provider=resend/);
});
test("safe failure codes distinguish sender, IP, quota and account restrictions", () => {
  for (const [status, message, expected] of [[403, "Unauthorized IP address", "IP_NOT_AUTHORIZED"], [400, "sender is not verified", "SENDER_NOT_APPROVED"], [403, "sending account not activated", "SENDING_ACCOUNT_INACTIVE"], [429, "", "QUOTA_OR_RATE_LIMIT"], [503, "", "PROVIDER_UNAVAILABLE"]]) assert.equal(emailFailureReason(status, { message }), expected);
});
test("failed resend returns failure, not a success message or development token", async () => {
  const service = new AuthService({ user: { findUnique: async () => ({ id: "u", email, emailVerifiedAt: null }) }, $executeRawUnsafe: async () => 1 }, {});
  service.logger = logger;
  const result = await service.resendVerification({ email });
  assert.equal(result.success, false); assert.equal(result.deliveryConfigured, false); assert.equal(result.code, "EMAIL_DELIVERY_UNAVAILABLE"); assert.equal(result.deliveryStatus, "failed"); assert.equal(result.developmentToken, undefined);
});
test("unknown and verified accounts retain a generic non-enumerating response", async () => {
  for (const user of [null, { id: "u", email, emailVerifiedAt: new Date() }]) {
    const service = new AuthService({ user: { findUnique: async () => user } }, {}); service.logger = logger;
    const result = await service.resendVerification({ email });
    assert.equal(result.success, true); assert.equal(result.deliveryConfigured, undefined); assert.match(result.message, /If an unverified account exists/);
  }
  assert.equal(logs.length, 0);
});
test("failed reset-email request is also reported honestly", async () => {
  const service = new AuthService({ $queryRawUnsafe: async () => [{id: "u"}], $executeRawUnsafe: async () => 1 }, {}); service.logger = logger;
  assert.equal((await service.forgotPassword({ email })).success, false);
});
test("registration persists unverified account but explicitly reports email failure", async () => {
  const user = { id: "u", email, displayName: "Test", role: "LEARNER", createdAt: new Date(), emailVerifiedAt: null };
  const service = new AuthService({ user: { findUnique: async () => null, create: async args => { assert.match(args.data.passwordHash, /^\$2/); return user; } }, $executeRawUnsafe: async () => 1 }, {}); service.logger = logger;
  const result = await service.register({ email, password: "test-password-only" });
  assert.equal(result.user.id, "u"); assert.equal(result.emailVerification.required, true); assert.equal(result.emailVerification.deliveryStatus, "failed"); assert.equal(result.emailVerification.developmentToken, undefined);
});
