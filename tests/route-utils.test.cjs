const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/route-utils.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { googleMapsRouteUrl, googleMapsNavigationUrl, googleMapsRouteSections } = loaded.exports;
const points = Array.from({ length: 5 }, (_, i) => ({ latitude: 50 + i / 100, longitude: 5 + i / 100 }));
for (const makeUrl of [googleMapsRouteUrl, googleMapsNavigationUrl]) {
  test(`${makeUrl.name} preserves fixed origin and full ordered driving waypoints`, () => { const url = new URL(makeUrl(points)); assert.equal(url.searchParams.get("travelmode"), "driving"); assert.equal(url.searchParams.get("origin"), "50,5"); assert.equal(url.searchParams.get("waypoints").split("|").length, 3); assert.equal(url.searchParams.get("destination"), "50.04,5.04"); });
  test(`${makeUrl.name} refuses unsupported or incomplete routes instead of truncating`, () => { assert.equal(makeUrl([...points, points[0]]), null); assert.equal(makeUrl([points[0], { title: "missing" }, points[1]]), null); assert.equal(makeUrl([points[0]]), null); });
}

test("Google Maps sections cover every ordered leg with shared boundaries", () => {
  for (const count of [2, 5, 6, 9, 25, 60]) {
    const route = Array.from({ length: count }, (_, i) => ({ latitude: 50 + i / 1000, longitude: 5 + i / 1000 }));
    const sections = googleMapsRouteSections(route);
    assert.equal(sections.length, Math.ceil((count - 1) / 4));
    const actual = [];
    for (const [i, section] of sections.entries()) {
      const url = new URL(section.url);
      const coords = [url.searchParams.get("origin"), ...(url.searchParams.get("waypoints")?.split("|") || []), url.searchParams.get("destination")];
      assert.ok(coords.length <= 5);
      assert.equal(new URL(section.navigationUrl).searchParams.get("dir_action"), "navigate");
      assert.equal(url.searchParams.get("travelmode"), "driving");
      assert.equal(section.firstPoint, i * 4 + 1);
      if (i) assert.equal(section.firstPoint, sections[i - 1].lastPoint);
      actual.push(...(i ? coords.slice(1) : coords));
    }
    assert.deepEqual(actual, route.map(p => `${p.latitude},${p.longitude}`));
  }
});

test("Google Maps sections fail closed rather than skip invalid points", () => {
  for (const route of [[], [points[0]], [points[0], {}, points[1]], [points[0], { latitude: NaN, longitude: 5 }], [points[0], { latitude: 91, longitude: 5 }]]) assert.deepEqual(googleMapsRouteSections(route), []);
});

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function renderGoogleLinks(locale, sections, navigation = false) {
  const componentFile = path.resolve(__dirname, "../app/routes/GoogleMapsLinks.tsx");
  const componentModule = new Module(componentFile, module);
  componentModule.paths = module.paths;
  componentModule.require = id => id === "../../lib/useLocale" ? { useCurrentLocale: () => locale } : require(id);
  componentModule._compile(ts.transpileModule(fs.readFileSync(componentFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, componentFile);
  return renderToStaticMarkup(React.createElement(componentModule.exports.default, { sections, navigation }));
}
test("Long route UI exposes every section and the Google Maps action", () => {
  const sections = googleMapsRouteSections(Array.from({ length: 25 }, (_, i) => ({ latitude: 50 + i / 1000, longitude: 5 })));
  const html = renderGoogleLinks("en", sections);
  assert.match(html, /Open in Google Maps/);
  assert.match(html, /Section 6\/6/);
  assert.match(html, /points 21–25/);
  assert.match(html, /safely parked/);
  assert.match(html, /full checked route stays on the Mapbox map/);
});
test("Dutch and navigation links use localized labels and navigation URLs", () => {
  const sections = googleMapsRouteSections(points);
  assert.match(renderGoogleLinks("nl", sections), /Openen in Google Maps/);
  assert.match(renderGoogleLinks("en", sections, true), /dir_action=navigate/);
  assert.match(renderGoogleLinks("nl", sections, true), /Navigeren met Google Maps/);
  assert.equal(renderGoogleLinks("en", []), "");
});
