const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file), result = new Module(filename, module);
  result.paths = module.paths;
  result.require = id => mocks[id] ?? require(id);
  result._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return result.exports;
}
const helpers = load('lib/route-progression.ts');
const steps = ['A', 'B', 'C', 'D'].map((letter, i) => ({ slug: `alken-${letter.toLowerCase()}`, label: `Route ${letter}`, isFree: i === 0 }));
test('all published routes progress in catalogue order, never wrap or cross centres', () => {
  for (let i = 0; i < steps.length; i++) assert.deepEqual(helpers.routeProgression(steps, steps[i].slug), { current: steps[i], next: steps[i + 1] ?? null });
  assert.deepEqual(helpers.routeProgression(steps, 'another-centre-a'), {current: null, next: null});
  assert.deepEqual(helpers.routeProgression([], 'unknown'), {current: null, next: null});
});
test('only backend COMPLETED counts; ended/forged percentage/unknown does not', () => {
  for (const value of [null, {}, {completionKind: 'ENDED'}, {completionPct: 100}, {completionKind: 'ENDED_EARLY'}]) assert.equal(helpers.confirmedRouteCompletion(value), false);
  assert.equal(helpers.confirmedRouteCompletion({completionKind: 'COMPLETED'}), true);
});
test('Free and Premium at another centre must buy; eligible Premium/Diamond may open next', () => {
  assert.deepEqual(helpers.nextRouteAction(steps[1], 'alken', false), {unlocked: false, href: '/#pricing'});
  assert.deepEqual(helpers.nextRouteAction(steps[1], 'alken', true), {unlocked: true, href: '/routes/alken-b'});
});
function prompt(paidCentreAccess, completed = true, nextRoute = steps[1]) {
  const component = load('app/routes/NextRoutePrompt.tsx', {
    '../../lib/useLocale': {useCurrentLocale: () => 'en'},
    '../../lib/route-progression': helpers,
    'next/link': {__esModule: true, default: props => React.createElement('a', props)},
  }).default;
  return renderToStaticMarkup(React.createElement(component, {routeLabel: 'Route A', nextRoute, centreSlug: 'alken', paidCentreAccess, completed}));
}
test('completed free route explicitly offers purchase, never a link to locked B', () => {
  const html = prompt(false);
  assert.match(html, /Route A · Completed/); assert.match(html, /Route B is locked/);
  assert.match(html, /Buy a plan to unlock Route B/); assert.match(html, /href="\/#pricing"/);
  assert.doesNotMatch(html, /href="\/routes\/alken-b"/);
});
test('eligible next route opens only its own slug; completion is not claimed before confirmed', () => {
  assert.match(prompt(true), /href="\/routes\/alken-b"/);
  assert.match(prompt(true), /safely parked/);
  assert.doesNotMatch(prompt(false, false), /Completed/);
  assert.match(prompt(true, true, null), /last published route/);
  assert.doesNotMatch(prompt(true, true, null), /href="\/routes/);
});
test('Google parts are labelled as the selected route, not alternative routes', () => {
  const utils = load('lib/route-utils.ts');
  const component = load('app/routes/GoogleMapsLinks.tsx', {'../../lib/useLocale': {useCurrentLocale: () => 'en'}}).default;
  const sections = utils.googleMapsRouteSections(Array.from({length: 25}, (_, i) => ({latitude: 50 + i / 1000, longitude: 5})));
  const html = renderToStaticMarkup(React.createElement(component, {sections, routeLabel: 'Route A'}));
  assert.match(html, /Route A · Section 6\/6/);
  assert.match(html, /parts of Route A only, not other routes/);
  assert.doesNotMatch(html, /Route B/);
});
test('route conversion never combines centre fallback routes or stale geometry', () => {
  const {routeToCentre} = load('lib/api.ts', {'./data': {}, './clientSession': {}});
  const fallback = {routeCoordinates: [[99, 99]], roadGeometry: [[99, 99]], routePoints: [{title: 'other route'}]};
  const route = slug => ({slug, centre: {slug: 'alken', _count: {routes: 4}}, points: [{id: slug, sequence: 1, longitude: slug === 'a' ? 5 : 6, latitude: 50}], driving: {coordinates: [[slug === 'a' ? 5 : 6, 50]]}});
  const a = routeToCentre(route('a'), fallback), b = routeToCentre(route('b'), a);
  assert.deepEqual(a.roadGeometry, [[5, 50]]); assert.deepEqual(b.roadGeometry, [[6, 50]]);
  assert.deepEqual(b.routeCoordinates, [[6, 50]]); assert.equal(b.routePoints[0].id, 'b');
});

test('actual practice handlers retain confirmed next-step after reflection, but never on partial ends', async () => {
  const previousWindow = global.window;
  global.window = {sessionStorage: {getItem: () => 'test-token'}};
  try {
    for (const kind of ['COMPLETED', 'ENDED']) {
      const states = []; let cursor = 0;
      const promptComponent = () => null;
      const component = load('app/routes/PracticeControls.tsx', {
        'react': {...React, useEffect: () => {}, useRef: () => ({current: null}), useState: initial => {
          const i = cursor++;
          if (!(i in states)) states[i] = i === 3 ? 'fixture-session' : initial;
          return [states[i], value => {states[i] = typeof value === 'function' ? value(states[i]) : value;}];
        }},
        'next/navigation': {useRouter: () => ({push: () => {}})},
        '../../lib/clientSession': {authFetch: async () => ({ok: true, json: async () => ({completionKind: kind, completionPct: kind === 'COMPLETED' ? 100 : 40})})},
        '../../lib/i18n': {isLocale: () => true},
        '../../lib/useLocale': {useSiteCopy: () => ({route: {completePractice: 'End practice', finishError: 'Error'}})},
        '../../lib/route-progression': helpers,
        './GoogleMapsLinks': {__esModule: true, default: () => null},
        './NextRoutePrompt': {__esModule: true, default: promptComponent},
      }).default;
      function render() {cursor = 0; return component({routeLabel: 'Route A', nextRoute: steps[1], centreSlug: 'alken', paidCentreAccess: false, routeId: 'a', routeSlug: 'alken-a', practiceReady: true});}
      function nodes(tree) {return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];}
      const end = nodes(render()).find(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children[0] === 'End practice');
      await end.props.onClick();
      // Click handlers deliberately launch an async task; flush its response parsing.
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(nodes(render()).find(node => node.type === promptComponent).props.completed, kind === 'COMPLETED');
      const skip = nodes(render()).find(node => node.type === 'button' && node.props.children === 'Skip');
      skip.props.onClick();
      assert.equal(nodes(render()).find(node => node.type === promptComponent).props.completed, kind === 'COMPLETED');
    }
  } finally {global.window = previousWindow;}
});
