const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/route-utils.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { googleMapsNavigationUrl, routeNavigationLinks } = loaded.exports;
const points = Array.from({ length: 5 }, (_, i) => ({ latitude: 50 + i / 100, longitude: 5 + i / 100 }));
test('one loop has the same start/finish and an ordered initial direction, not 25 routes',()=>{
  const route=[{latitude:50,longitude:5},{latitude:50.01,longitude:5},{latitude:50.01,longitude:5.01},{latitude:50,longitude:5}];
  assert.deepEqual(loaded.exports.routeLoopSummary(route),{closed:true,direction:'N'});
  assert.equal(loaded.exports.routeLoopSummary(route.slice(0,-1)).closed,false);
  assert.equal(loaded.exports.routeLoopSummary([...route.slice(0,-1),{latitude:50.0002,longitude:5}]).closed,false);
  assert.equal(loaded.exports.routeLoopSummary([{latitude:50,longitude:5},{}]).closed,false);
});
test("one Google Maps directions link reaches the real finish and uses ordered waypoints", () => {
  for (const count of [2, 5, 6, 25, 60]) {
    const route = Array.from({ length: count }, (_, index) => ({
      latitude: 50 + index / 1000, longitude: 5 + index / 1000,
    }));
    const coords = route.map(({ latitude, longitude }) => `${latitude},${longitude}`);
    const url = new URL(googleMapsNavigationUrl(route));
    assert.equal(url.origin + url.pathname, "https://www.google.com/maps/dir/");
    assert.equal(url.searchParams.get("api"), "1");
    assert.equal(url.searchParams.get("travelmode"), "driving");
    assert.equal(url.searchParams.get("dir_action"), "navigate");
    assert.equal(url.searchParams.get("origin"), coords[0]);
    assert.equal(url.searchParams.get("destination"), coords.at(-1));
    const waypoints = url.searchParams.get("waypoints")?.split("|") ?? [];
    assert.equal(waypoints.length, Math.min(3, count - 2));
    const indexes = waypoints.map(point => coords.indexOf(point));
    indexes.forEach((index, slot) => assert.ok(index > (indexes[slot - 1] ?? 0) && index < count - 1));
    if (count === 25) assert.ok(indexes.at(-1) > 12);
  }
});

test("a route returning to its starting point keeps both endpoints and intermediate anchors", () => {
  const url = new URL(googleMapsNavigationUrl([...points, points[0]]));
  assert.equal(url.searchParams.get("origin"), url.searchParams.get("destination"));
  assert.equal(url.searchParams.get("waypoints").split("|").length, 3);
});

test("invalid routes have no navigation links", () => {
  for (const route of [[], [points[0]], [points[0], points[0]], [points[0], {}, points[1]], [points[0], { latitude: NaN, longitude: 5 }], [points[0], { latitude: 91, longitude: 5 }]]) {
    assert.equal(routeNavigationLinks(route), null);
  }
});

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function renderGoogleLinks(locale, links) {
  const componentFile = path.resolve(__dirname, "../app/routes/GoogleMapsLinks.tsx");
  const componentModule = new Module(componentFile, module);
  componentModule.paths = module.paths;
  componentModule.require = id => id === "../../lib/useLocale" ? { useCurrentLocale: () => locale } : id === "../../lib/route-utils" ? loaded.exports : require(id);
  componentModule._compile(ts.transpileModule(fs.readFileSync(componentFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, componentFile);
  return renderToStaticMarkup(React.createElement(componentModule.exports.default, { links, routeLabel: "Route A" }));
}
test("route navigation shows a single directions action in English and Dutch", () => {
  const links = routeNavigationLinks(Array.from({ length: 25 }, (_, index) => ({ latitude: 50 + index / 1000, longitude: 5 })));
  const html = renderGoogleLinks("en", links);
  assert.equal([...html.matchAll(/href="https:\/\/www\.google\.com\/maps\/dir\//g)].length, 1);
  assert.match(html, /Get directions in Google Maps/);
  assert.match(html, /dir_action=navigate/);
  assert.doesNotMatch(html, /<select|Part 1|Full loop|target="_blank"/);
  assert.match(renderGoogleLinks("nl", links), /Routebeschrijving in Google Maps/);
  assert.equal(renderGoogleLinks("en", null), "");
});
