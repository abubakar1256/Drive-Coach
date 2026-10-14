const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/plan-access.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { activePlan, includesPlan } = loaded.exports;
const now = Date.parse("2026-10-14T00:00:00Z");
test("unknown/free/revoked accounts do not claim paid access", () => {
  for (const subscription of [null, {status: "FREE", plan: "Free"}, {status: "REFUNDED", plan: "Diamond"}, {status: "ACTIVE", plan: "Unknown"}]) assert.equal(activePlan(subscription, now), "Free");
});
test("active Diamond/admin unlimited access includes both paid plans", () => {
  const plan = activePlan({status: "ACTIVE", plan: "Diamond", expiresAt: null}, now);
  for (const request of ["Free", "Premium", "Diamond"]) assert.equal(includesPlan(plan, request), true);
});
test("Premium is current but Diamond remains a legitimate upgrade", () => {
  const plan = activePlan({status: "ACTIVE", plan: "Premium", expiresAt: "2026-10-15T00:00:00Z"}, now);
  assert.equal(plan, "Premium"); assert.equal(includesPlan(plan, "Premium"), true); assert.equal(includesPlan(plan, "Diamond"), false);
});
test("expired, future and malformed periods cannot display active paid access", () => {
  for (const dates of [{expiresAt: "2026-10-14T00:00:00Z"}, {expiresAt: "invalid"}, {startsAt: "2026-10-15T00:00:00Z"}, {startsAt: "invalid"}]) assert.equal(activePlan({status: "ACTIVE", plan: "Diamond", expiresAt: null, ...dates}, now), "Free");
});
test("all centre and route purchase headers use the shared plan component", () => {
  for (const file of ["app/routes/[slug]/page.tsx", "app/centres/[slug]/page.tsx", "app/centres/page.tsx"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.match(source, /<PlanAccessLink/); assert.doesNotMatch(source, /LocalizedNavText item="(?:unlockFullAccess|viewPlans)"/);
  }
});

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function renderAccessLink(subscription, state = "ready", locale = "en") {
  const file = path.resolve(__dirname, "../app/PlanAccess.tsx");
  const component = new Module(file, module);
  component.paths = module.paths;
  component.require = id => {
    if (id === "react") return { ...React, useContext: () => ({ subscription, state }) };
    if (id === "../lib/plan-access") return loaded.exports;
    if (id === "../lib/useLocale") return { useCurrentLocale: () => locale };
    if (id === "../lib/clientSession") return {};
    return require(id);
  };
  component._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  return renderToStaticMarkup(React.createElement(component.exports.default, { unlock: true }));
}
test("actual header renders active Diamond/Premium without purchase prompts", () => {
  for (const plan of ["Premium", "Diamond"]) {
    const html = renderAccessLink({status: "ACTIVE", plan, expiresAt: null});
    assert.match(html, new RegExp(`${plan} active`)); assert.match(html, /href="\/account"/); assert.doesNotMatch(html, /Unlock full access/);
  }
});
test("signed-out header offers access; loading/errors do not pretend a paid user is free", () => {
  assert.match(renderAccessLink(null, "signed-out"), /Unlock full access/);
  for (const state of ["loading", "error"]) { const html = renderAccessLink(null, state); assert.match(html, /My access/); assert.doesNotMatch(html, /Unlock full access/); }
});
test("Dutch header recognizes Diamond with the same account destination", () => {
  assert.match(renderAccessLink({status: "ACTIVE", plan: "Diamond", expiresAt: null}, "ready", "nl"), /Diamond actief/);
});
