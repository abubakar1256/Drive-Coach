const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/route-utils.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { googleMapsRouteUrl, googleMapsNavigationUrl } = loaded.exports;
const points = Array.from({ length: 5 }, (_, i) => ({ latitude: 50 + i / 100, longitude: 5 + i / 100 }));
for (const makeUrl of [googleMapsRouteUrl, googleMapsNavigationUrl]) {
  test(`${makeUrl.name} preserves fixed origin and full ordered driving waypoints`, () => { const url = new URL(makeUrl(points)); assert.equal(url.searchParams.get("travelmode"), "driving"); assert.equal(url.searchParams.get("origin"), "50,5"); assert.equal(url.searchParams.get("waypoints").split("|").length, 3); assert.equal(url.searchParams.get("destination"), "50.04,5.04"); });
  test(`${makeUrl.name} refuses unsupported or incomplete routes instead of truncating`, () => { assert.equal(makeUrl([...points, points[0]]), null); assert.equal(makeUrl([points[0], { title: "missing" }, points[1]]), null); assert.equal(makeUrl([points[0]]), null); });
}
