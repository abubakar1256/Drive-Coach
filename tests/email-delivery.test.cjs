const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/email-delivery.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { emailDeliveryFailed } = loaded.exports;
test("legacy HTTP 201 success=true cannot hide deliveryConfigured=false", () => { assert.equal(emailDeliveryFailed({ success: true, deliveryConfigured: false }), true); });
test("explicit delivery failure is detected and accepted/unknown stays generic", () => {
  assert.equal(emailDeliveryFailed({ deliveryStatus: "failed" }), true);
  for (const value of [null, {}, {success: true}, {deliveryConfigured: true, deliveryStatus: "accepted"}]) assert.equal(emailDeliveryFailed(value), false);
});
test("verification and reset pages check delivery before displaying success", () => {
  for (const file of ["check-email/page.tsx", "forgot-password/page.tsx"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "../app/auth", file), "utf8");
    const successIndex = source.includes("setMessage(copy.auth.emailRequestAccepted)") ? source.indexOf("setMessage(copy.auth.emailRequestAccepted)") : source.indexOf("setMessage(payload.message");
    assert.ok(successIndex > source.indexOf("emailDeliveryFailed(payload)"));
    assert.match(source, /throw new Error\(copy.auth.emailDeliveryFailed\)/);
  }
});
test("registration carries the email failure warning without implying a failed account creation", () => {
  const form = fs.readFileSync(path.resolve(__dirname, "../app/auth/AuthForm.tsx"), "utf8");
  assert.match(form, /emailDeliveryFailed\(payload.emailVerification\)/); assert.match(form, /query.set\("delivery", "failed"\)/);
});

const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const copyFile = path.resolve(__dirname, "../lib/siteCopy.ts"), copies = new Module(copyFile, module);
copies._compile(ts.transpileModule(fs.readFileSync(copyFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, copyFile);
for (const locale of ["en", "nl"]) test(`${locale} verification page renders a failed delivery as red error, never green success`, () => {
  const file = path.resolve(__dirname, "../app/auth/check-email/page.tsx"), component = new Module(file, module);
  const copy = copies.exports.siteCopy[locale];
  const states = ["test@example.test", "", "", copy.auth.emailDeliveryFailed, false];
  component.paths = module.paths;
  component.require = id => {
    if (id === "react") return { ...React, useEffect: () => {}, useState: () => [states.shift(), () => {}] };
    if (id === "../../../lib/useLocale") return { useSiteCopy: () => copy };
    if (id === "../../../lib/email-delivery") return loaded.exports;
    if (id === "../../SiteFooter") return { __esModule: true, default: () => null };
    return require(id);
  };
  component._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const html = renderToStaticMarkup(React.createElement(component.exports.default));
  assert.match(html, /class="auth-message auth-error"/); assert.ok(html.includes(copy.auth.emailDeliveryFailed)); assert.doesNotMatch(html, /class="auth-message auth-success"/);
  assert.ok(!html.includes(locale === "en" ? "link we sent" : "die we hebben gestuurd"));
});
