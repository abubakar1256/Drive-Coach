// Explicit remote review decisions, not a geocoding approval algorithm. These
// rows were read against the printed labels, government topology and OSM ways.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
require('reflect-metadata');
const { passageSourceCatalog } = require('../dist/src/exam-centres/passage-source-catalog');
const { passageFingerprint } = require('../dist/src/exam-centres/official-passage-catalog');
const { sharedGovernmentNode } = require('./review-remaining-junction-evidence.cjs');
const root = path.resolve(__dirname, '../../output/chatbot-audit/phase-two-remaining');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
// Out-of-town proposals without an operator-specified municipality, incomplete
// labels, single-road representatives and ambiguous side-names stay pending.
const decisions = {
  'sint-denijs-westrem': [34],
  eeklo: [2,12,14,17,18,28,30,32,37,39,47,53,66,70,81,82,85,86,91,92],
  brakel: [20,24,26],
  erembodegem: [8,69,70,89,94],
  'sint-niklaas': [13,22,27,28,32,38,39,40,43,45,46,54],
  'asse-mollem': [3,8,9,13,14,19,21],
  brugge: [4,6,9,13,36,40,41,44,45,53,55],
  oostende: [2,3,5,6,7,8,9,15,18,19,20,23,25,28,29,31,32,33,35,36,45,48,52,53],
  roeselare: [4,5,14,15,18,20,21,25,29,30,33,34,41,42,45,49,50,53,54,57,60],
  wevelgem: [1,2,3,11,12,16,19,37,38,39,40,46,48],
};
function prepare() {
  const bytes = fs.readFileSync(path.join(root, 'strict-junction-worksheet.json'));
  const worksheet = JSON.parse(bytes), rows = [];
  for (const [slug, sequences] of Object.entries(decisions)) {
    const centre = worksheet.centres.find(c => c.slug === slug), source = passageSourceCatalog.find(s => s.slug === slug);
    if (!centre || !source || source.sourceUrl !== centre.sourceUrl) throw Error('Reviewed source changed');
    for (const sequence of sequences) {
      const point = centre.points.find(p => p.sequence === sequence), original = source.points.find(p => p.sequence === sequence);
      if (!point || !original || original.duplicateOfSequence !== null || original.junction !== point.junction || point.candidates.length !== 1) throw Error('Printed review identity changed');
      const cache = JSON.parse(fs.readFileSync(path.join(root, 'government', sha(point.government.url) + '.json')));
      if (sha(JSON.stringify(cache.data)) !== point.government.sha256 || cache.url !== point.government.url || cache.data.type !== 'FeatureCollection' || cache.data.links?.some(l => l.rel === 'next')) throw Error('Government evidence changed/incomplete');
      const chosen = sharedGovernmentNode(point, cache.data);
      if (!chosen || sha(JSON.stringify(chosen)) !== sha(JSON.stringify(point.reviewProposal))) throw Error('Shared topology changed');
      const names = [...new Set(chosen.roads.flatMap(r => [r.properties.LSTRNM,r.properties.RSTRNM]))].filter(n => n && n !== 'nvt');
      const towns = [...new Set(chosen.roads.flatMap(r => [r.properties.LGEMEENTE,r.properties.RGEMEENTE]))].filter(n => n && n !== 'ng');
      rows.push({slug, sequence, junction: original.junction, latitude: chosen.latitude, longitude: chosen.longitude,
        sourceFingerprint: passageFingerprint({...original, sourceUrl: source.sourceUrl, sourceRevision: source.sourceRevision}),
        government: {url: cache.url, checkedAt: cache.checkedAt, sha256: point.government.sha256, ids: chosen.roads.map(r => r.id)},
        osmNodeId: chosen.osmNodeId,
        notes: `Remote map/register review 2026-10-20. Complete printed junction label matched to shared government road endpoints and an independent ground-level OSM shared node. Roads: ${names.join(' / ')}; register municipality: ${towns.join(' / ')}. Evidence ${point.government.sha256}; ${cache.url}; https://www.openstreetmap.org/node/${chosen.osmNodeId}. Public/in-use register classification TGBEP=1, STATUS=4. Printed source text preserved. Not an on-site/instructor assessment, prescribed exam itinerary, parking permission, current-turn permission or road-safety guarantee; follow current signs. © OpenStreetMap contributors / ODbL; Wegenregister / Digitaal Vlaanderen.`});
    }
  }
  if (rows.length !== 117) throw Error('Expected exactly 117 explicitly selected reviews');
  const sources = require('../prisma/data/walloon-passage-sources-2026.json').sources;
  return {kind: 'ADDITIONAL_OPERATOR_SOURCE_REVIEW_V1', reviewedAt: new Date().toISOString(), worksheetSha256: sha(bytes),
    officialExamItinerary: false, instructorApproved: false, sourceCatalogueSha256: sha(JSON.stringify(passageSourceCatalog)),
    sources: sources.map(s => ({slug:s.slug, sourceUrl:s.sourceUrl, sourceSha256:s.sourceSha256, fingerprints:s.points.map(p => passageFingerprint({...p,sourceUrl:s.sourceUrl,sourceRevision:s.sourceRevision}))})), rows};
}
if (require.main === module) {
  if (process.argv[2] !== '--confirm-explicit-remote-review') throw Error('Explicit remote review confirmation required');
  const manifest = prepare(), file = path.join(root, 'additional-reviewed-release.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({file, sha256: sha(fs.readFileSync(file)), sourceBundles: manifest.sources.length, reviewedLocations: manifest.rows.length, databaseChanged: false}));
}
module.exports = {decisions, prepare, sha, root};
