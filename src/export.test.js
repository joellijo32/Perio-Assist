import { strict as assert } from 'node:assert';
import { createState, parseInto } from './perio.js';
import { buildReport, reportFilename } from './export.js';

// ponytail: one runnable check for the branchy bit - fails if the report breaks
const s = createState();
parseInto(s, 'tooth 3 buccal 2-3-2 lingual 3-2-3 no bleeding');
parseInto(s, 'tooth 1 missing');
parseInto(s, 'tooth 14 buccal 4-5-4 lingual 4-4-4 bleeding on buccal');
parseInto(s, 'tooth 8 buccal 2-2-2 lingual 2-2-2 recession 2 millimeters at mid-buccal');
const chart = JSON.parse(JSON.stringify({ teeth: s.teeth, bleed: s.bleed, rec: s.rec, sup: s.sup, plaque: s.plaque, mob: s.mob, fur: s.fur, absent: s.absent }));
const r = buildReport({ name: 'Anil Kumar', chart, id: 'p1', updatedAt: 1 });

assert.equal(r.patient.name, 'Anil Kumar');
assert.deepEqual(r.summary.missing, [1]);
assert.equal(r.derived.cal[3][1], 3, 'CAL = PD + rec');
assert.equal(r.derived.cal[8][1], 4, 'CAL includes recession');
assert.equal(r.summary.bop.hit, 3, 'BOP counts buccal row only');
assert.equal(r.summary.maxPD, 5);
assert.equal(r.summary.sitesGTE4, 6, 'PD>=4 count');
assert.equal(r.summary.sitesProbed, 18, 'nulls + missing excluded');
assert.equal(reportFilename('Anil Kumar', new Date('2026-09-18T00:00:00Z')), 'perio-anil-kumar-2026-09-18.json');
assert.equal(reportFilename('  ', new Date('2026-09-18T00:00:00Z')), 'perio-unsaved-2026-09-18.json');
console.log('export.test ok');
