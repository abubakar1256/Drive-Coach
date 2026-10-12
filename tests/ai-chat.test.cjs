const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Compile only the pure helpers and renderer under test, without a new test
// framework or altering the application's TypeScript configuration.
function loadTs(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => name === "../lib/aiChat" ? chat : module.require(name);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const chat = loadTs("lib/aiChat.ts");
const Renderer = loadTs("app/ChatMessageContent.tsx").default;
const AccessGate = loadTs("app/AIChatAccessGate.tsx").default;
const copy = loadTs("lib/siteCopy.ts").siteCopy;

test("only explicit active Premium/Diamond entitlements unlock the frontend", () => {
  const now = Date.now();
  const paid = { plan: "Premium", status: "ACTIVE", expiresAt: new Date(now + 1000).toISOString(), features: { aiChat: true } };
  assert.equal(chat.canUseAIChat(paid, now), true);
  assert.equal(chat.canUseAIChat({ ...paid, plan: "Diamond", expiresAt: null }, now), true);
  for (const overrides of [{ plan: "Free" }, { plan: "Other" }, { status: "PENDING" }, { status: "REFUNDED" }, { features: { aiChat: false } }, { features: {} }, { expiresAt: new Date(now).toISOString() }, { expiresAt: "invalid" }, { expiresAt: undefined }]) {
    assert.equal(chat.canUseAIChat({ ...paid, ...overrides }, now), false);
  }
  assert.equal(chat.canUseAIChat({}), false);
});

test("English and Dutch locked screens offer plans and login, never a chat input", () => {
  for (const locale of ["en", "nl"]) {
    const html = renderToStaticMarkup(React.createElement(AccessGate, { status: "guest", copy: copy[locale].chatbot, loginHref: "/auth/login?next=%2Fcentres", onRetry() {}, onNavigate() {} }));
    assert.match(html, /href="\/#pricing"/);
    assert.match(html, /href="\/auth\/login\?next=%2Fcentres"/);
    assert.ok(html.includes(copy[locale].chatbot.lockedTitle));
    assert.ok(html.includes(copy[locale].chatbot.logIn));
    assert.ok(!html.includes("textarea"));
    const free = renderToStaticMarkup(React.createElement(AccessGate, { status: "locked", copy: copy[locale].chatbot, loginHref: "/auth/login", onRetry() {}, onNavigate() {} }));
    assert.ok(free.includes(copy[locale].chatbot.refreshAccess));
    assert.ok(!free.includes("href=\"/auth/login\""));
  }
});

test("access-check loading and failure do not unlock or send a user to buy again", () => {
  for (const status of ["checking", "unavailable"]) {
    const html = renderToStaticMarkup(React.createElement(AccessGate, { status, copy: copy.en.chatbot, loginHref: "/auth/login", onRetry() {}, onNavigate() {} }));
    assert.ok(!html.includes("textarea"));
    assert.ok(!html.includes("href=\"/#pricing\""));
    assert.match(html, status === "checking" ? /role="status"/ : /role="alert"/);
  }
});

test("100 exchanges stay within the API limit and retain the latest question", () => {
  const history = [{ role: "assistant", content: "Welcome", kind: "welcome" }];
  for (let i = 1; i <= 100; i++) {
    history.push({ role: "user", content: `Question ${i}` });
    const request = chat.buildChatHistory(history);
    assert.ok(request.length <= 19);
    assert.equal(request[0].role, "user");
    assert.deepEqual(request.at(-1), { role: "user", content: `Question ${i}` });
    assert.ok(!JSON.stringify(request).includes("Welcome"));
    history.push({ role: "assistant", content: `Answer ${i}` });
  }
  assert.equal(history.length, 201);
});

test("welcome text, failed questions and blank entries never contaminate model history", () => {
  assert.deepEqual(chat.buildChatHistory([
    { role: "assistant", content: "Welcome", kind: "welcome" },
    { role: "user", content: "Failed question", failed: true },
    { role: "assistant", content: "  " },
    { role: "user", content: "Retry the question" },
  ]), [{ role: "user", content: "Retry the question" }]);
  assert.deepEqual(chat.buildChatHistory([{ role: "assistant", content: "Welcome", kind: "welcome" }]), []);
});

test("long answers stay visible but cannot exceed the next request's validation limit", () => {
  const messages = [{ role: "user", content: "Explain in detail" }, { role: "assistant", content: "x".repeat(9000) }, { role: "user", content: "What next?" }];
  assert.equal(chat.buildChatHistory(messages)[1].content.length, 4000);
  assert.equal(messages[1].content.length, 9000);
});

test("bullet lists, numbered steps and bold labels render as readable content", () => {
  const html = renderToStaticMarkup(React.createElement(Renderer, {
    content: "Prepare safely.\n\n- **Mirrors:** Check before manoeuvring.\n- **Speed:** Observe signs.\n\n1. Stop safely.\n2. Reflect after the drive.\n\nYou are ready to practise.",
  }));
  assert.match(html, /<ul><li><strong>Mirrors:<\/strong>/);
  assert.match(html, /<ol><li>Stop safely\.<\/li>/);
  assert.match(html, /You are ready to practise/);
  assert.ok(!html.includes("**"));
});

test("provider HTML is escaped, never executed or linked", () => {
  const html = renderToStaticMarkup(React.createElement(Renderer, { content: '<img src=x onerror=alert(1)>\n**<script>bad</script>**' }));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;img/);
});

test("paragraphs retain line breaks and Dutch/Roman Urdu text", () => {
  const blocks = chat.parseChatBlocks("# Voorbereiding\r\nSpiegels controleren.\r\n\r\n- Gaari safely roko.\r\n- Phir reflection karo.");
  assert.equal(blocks[0].lines.join("\n"), "Voorbereiding\nSpiegels controleren.");
  assert.equal(blocks[1].lines[1], "Phir reflection karo.");
});

test("HTTP errors are mapped without exposing raw validation arrays or provider text", () => {
  assert.equal(chat.chatErrorCode({ message: ["validation failed"] }, 400), "AI_UNAVAILABLE");
  assert.equal(chat.chatErrorCode({}, 429), "CHAT_RATE_LIMITED");
  assert.equal(chat.chatErrorCode({}, 504), "AI_TIMEOUT");
  assert.equal(chat.chatErrorCode({}, 401), "SESSION_EXPIRED");
  assert.equal(chat.chatErrorCode({}, 403), "AI_PLAN_REQUIRED");
  assert.equal(chat.chatErrorCode({ code: "AI_INCOMPLETE" }, 503), "AI_INCOMPLETE");
});
