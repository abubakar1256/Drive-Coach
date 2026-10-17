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
  for (const subscription of [null, {status: "FREE", plan: "Free"}, {status: "REFUNDED", plan: "Premium"}, {status: "ACTIVE", plan: "Unknown"}]) assert.equal(activePlan(subscription, now), "Free");
});
test("active Premium/admin unlimited access includes both paid plans", () => {
  const plan = activePlan({status: "ACTIVE", plan: "Premium", expiresAt: null}, now);
  for (const request of ["Free", "Basic", "Premium"]) assert.equal(includesPlan(plan, request), true);
});
test("Basic is current but Premium remains a legitimate upgrade", () => {
  const plan = activePlan({status: "ACTIVE", plan: "Basic", expiresAt: "2026-10-15T00:00:00Z"}, now);
  assert.equal(plan, "Basic"); assert.equal(includesPlan(plan, "Basic"), true); assert.equal(includesPlan(plan, "Premium"), false);
});
test("expired, future and malformed periods cannot display active paid access", () => {
  for (const dates of [{expiresAt: "2026-10-14T00:00:00Z"}, {expiresAt: "invalid"}, {startsAt: "2026-10-15T00:00:00Z"}, {startsAt: "invalid"}]) assert.equal(activePlan({status: "ACTIVE", plan: "Premium", expiresAt: null, ...dates}, now), "Free");
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
test("actual header renders active Premium/Basic without purchase prompts", () => {
  for (const plan of ["Basic", "Premium"]) {
    const html = renderAccessLink({status: "ACTIVE", plan, expiresAt: null});
    assert.match(html, new RegExp(`${plan} active`)); assert.match(html, /href="\/account"/); assert.doesNotMatch(html, /Unlock full access/);
  }
});
test("signed-out header offers access; loading/errors do not pretend a paid user is free", () => {
  assert.match(renderAccessLink(null, "signed-out"), /Unlock full access/);
  for (const state of ["loading", "error"]) { const html = renderAccessLink(null, state); assert.match(html, /My access/); assert.doesNotMatch(html, /Unlock full access/); }
});
test("Dutch header recognizes Premium with the same account destination", () => {
  assert.match(renderAccessLink({status: "ACTIVE", plan: "Premium", expiresAt: null}, "ready", "nl"), /Premium actief/);
});

function renderBilling(plan) {
  const copyFile = path.resolve(__dirname, "../lib/siteCopy.ts"), copyModule = new Module(copyFile, module);
  copyModule._compile(ts.transpileModule(fs.readFileSync(copyFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, copyFile);
  const file = path.resolve(__dirname, "../app/account/BillingPanel.tsx"), component = new Module(file, module);
  const plans = ["Basic", "Premium"].map((name, index) => ({id: String(index), name, durationHours: 24, priceCents: index ? 300 : 200, currency: "EUR", purchasable: true}));
  const states = [[], "", null, null, false, plans, [], [], "", "", 24];
  component.paths = module.paths;
  component.require = id => {
    if (id === "react") return {...React, useEffect: () => {}, useState: () => [states.shift(), () => {}]};
    if (id === "../PlanAccess") return {usePlanAccess: () => ({plan, state: "ready"})};
    if (id === "../../lib/useLocale") return {useCurrentLocale: () => "en", useSiteCopy: () => copyModule.exports.siteCopy.en};
    if (id === "../../lib/clientSession") return {};
    if (id === "../../lib/plan-access") return loaded.exports;
    if (id === "../../lib/plan-offers") { const f = path.resolve(__dirname, "../lib/plan-offers.ts"), m = new Module(f, module); m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f); return m.exports; }
    return require(id);
  };
  component._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText, file);
  return renderToStaticMarkup(React.createElement(component.exports.default));
}
test("Free billing shows neutral heading and no current paid plan", () => {
  const html = renderBilling("Free");
  assert.match(html, /<h2>Plans &amp; billing<\/h2>/);
  assert.doesNotMatch(html, />Active<|>Included<|· Manage access/);
  assert.equal((html.match(/>Choose plan<\/button>/g) ?? []).length, 2);
});
test("Premium billing includes Basic and disables both duplicate purchase actions", () => {
  const html = renderBilling("Premium");
  assert.match(html, /Premium · Manage access/);
  assert.match(html, /disabled="">Included<\/button>/); assert.match(html, /disabled="">Active<\/button>/);
  assert.doesNotMatch(html, />Choose plan<\/button>/);
});
test("Basic billing keeps only the Premium upgrade available", () => {
  const html = renderBilling("Basic");
  assert.match(html, /Basic · Manage access/); assert.match(html, /disabled="">Active<\/button>/);
  assert.equal((html.match(/>Choose plan<\/button>/g) ?? []).length, 1);
});
