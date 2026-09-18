import { strict as assert } from 'node:assert';
import { createState, parseInto } from '../src/perio.js';

// ponytail: one runnable check for the branchy bit - fails if the parser breaks
const s = createState();
parseInto(s, 'three two three');
assert.equal(s.teeth[1].slice(0, 3).join(), '3,2,3', 'triplet');
parseInto(s, 'repeat');
assert.equal(s.teeth[1].slice(3).join(), '3,2,3', 'repeat');
parseInto(s, 'jump 24');
assert.equal(s.cur.t, 24, 'jump');
parseInto(s, 'four bleeding');
assert.equal(s.teeth[24][0], 4, 'depth');
assert.equal(s.bleed[24][0], true, 'bleed');
// voice-realistic navigation: words, filler "to", composites
for (const [cmd, tooth] of [
  ['go 12', 12],
  ['go twelve', 12],
  ['go to 12', 12],
  ['go to tooth 24', 24],
  ['jump twenty four', 24],
  ['go fifteen', 15],
  ['jump thirty two', 32],
]) {
  parseInto(s, cmd);
  assert.equal(s.cur.t, tooth, cmd);
}
// site anatomy: codes, full names, fillers, pairs, bare selection
parseInto(s, 'jump 12 bleeding MB');
assert.equal(s.cur.t, 12, 'site jump tooth');
assert.equal(s.cur.s, 0, 'site jump site');
assert.equal(s.bleed[12][0], true, 'site jump bleed');
parseInto(s, 'jump 13');
parseInto(s, 'bleeding at mesiobuccal');
assert.equal(s.bleed[13][0], true, 'full name bleed');
assert.equal(s.cur.s, 0, 'full name selects');
parseInto(s, 'jump 12 db');
assert.deepEqual(s.cur, { t: 12, s: 2 }, 'jump db');
parseInto(s, 'distal buccal');
assert.equal(s.cur.s, 2, 'two-word site');
parseInto(s, 'buccal');
assert.equal(s.cur.s, 0, 'bare buccal parks at row start');
parseInto(s, 'm b');
assert.equal(s.cur.s, 0, 'letter pair');
// bare bleeding still flags the last filled site
parseInto(s, 'jump 14');
parseInto(s, '5');
parseInto(s, 'bleeding');
assert.equal(s.teeth[14][0], 5, 'depth kept');
assert.equal(s.bleed[14][0], true, 'bare bleed kept');
assert.equal(s.cur.s, 1, 'bare bleed no move');
assert.equal(s.cur.s, 1, 'bare bleed no move');
// undo reverts a whole utterance (triplet) and parks the cursor at its start
parseInto(s, 'jump 20');
parseInto(s, '3 2 3');
parseInto(s, 'undo');
assert.equal(s.teeth[20].every((v) => v === null), true, 'undo triplet');
assert.deepEqual(s.cur, { t: 20, s: 0 }, 'undo cursor');
// undo reverts bleed flags too
parseInto(s, 'jump 21');
parseInto(s, 'bleeding MB');
parseInto(s, 'undo');
assert.equal(s.bleed[21][0], false, 'undo bleed');
assert.deepEqual(s.cur, { t: 21, s: 0 }, 'undo bleed cursor');
// clear then undo: group bookkeeping stays consistent
parseInto(s, 'jump 22');
parseInto(s, '4 5 6');
parseInto(s, 'clear');
assert.equal(s.teeth[22][2], null, 'clear tip');
parseInto(s, 'undo');
assert.equal(s.teeth[22].every((v) => v === null), true, 'undo after clear');
assert.deepEqual(s.cur, { t: 22, s: 0 }, 'undo after clear cursor');
// same-breath "3 2 3 undo" reverts its own writes, older groups untouched
parseInto(s, 'jump 23');
parseInto(s, '1 1 1');
parseInto(s, '3 2 3 undo');
assert.equal(s.teeth[23].slice(0, 3).join(), '1,1,1', 'older group kept');
assert.equal(s.teeth[23].slice(3).every((v) => v === null), true, 'own writes reverted');
parseInto(s, 'undo');
assert.equal(s.teeth[23].every((v) => v === null), true, 'older group undoable');
// corrections patch in place, cursor stays for the flow
parseInto(s, 'jump 25');
parseInto(s, '3 2 3');
parseInto(s, 'change last to 5');
assert.equal(s.teeth[25][2], 5, 'change last');
assert.deepEqual(s.cur, { t: 25, s: 3 }, 'change keeps cursor');
parseInto(s, 'make the mesial a 1');
assert.equal(s.teeth[25][0], 1, 'site correction');
assert.deepEqual(s.cur, { t: 25, s: 3 }, 'site correction keeps cursor');
parseInto(s, 'undo');
assert.equal(s.teeth[25][0], 3, 'undo correction restores prev');
parseInto(s, 'undo');
assert.equal(s.teeth[25][2], 3, 'undo change restores prev');
parseInto(s, 'jump 26');
parseInto(s, '4');
parseInto(s, 'wait make that 6');
assert.equal(s.teeth[26][0], 6, 'wait make that');
parseInto(s, 'jump 27');
parseInto(s, 'lingual');
parseInto(s, '3 4 5');
parseInto(s, 'correction 2 on distal');
assert.equal(s.teeth[27][5], 2, 'correction on site');
assert.deepEqual(s.cur, { t: 28, s: 0 }, 'correction keeps cursor');
// missing teeth are flagged and skipped
// marked teeth land (implants carry charting); sequential flow skips them via advance/next
parseInto(s, 'tooth 28 is missing');
assert.equal(s.absent[28], 'MISSING', 'missing status');
assert.deepEqual(s.cur, { t: 28, s: 0 }, 'missing lands');
parseInto(s, '3 2 3');
parseInto(s, 'next');
assert.deepEqual(s.cur, { t: 29, s: 0 }, 'sequential flow continues past');
// recession stores on the site just called, never as a depth
parseInto(s, 'jump 30');
parseInto(s, '4 2 millimeters recession');
assert.equal(s.teeth[30][0], 4, 'depth before recession');
assert.equal(s.teeth[30][1], null, 'recession not a depth');
assert.equal(s.rec[30][0], 2, 'recession stored');
parseInto(s, 'undo');
assert.equal(s.rec[30][0], 0, 'undo recession');
assert.equal(s.teeth[30][0], null, 'undo recession utterance');
// bare mesial/distal resolve within announced aspect
parseInto(s, 'jump 31');
parseInto(s, 'lingual');
parseInto(s, 'mesial');
assert.equal(s.cur.s, 3, 'mesial in lingual');
// recession after a correction targets the patched site, not cursor-1
parseInto(s, 'jump 29');
parseInto(s, '3 2');
parseInto(s, 'change last to 5 1 millimeters recession');
assert.equal(s.teeth[29][1], 5, 'corrected depth kept');
assert.equal(s.rec[29][1], 1, 'recession follows patch');
// lone mesial/distal with no announced side asks instead of guessing
const s2 = createState();
const r = parseInto(s2, 'mesial');
assert.equal(s2.cur.s, 0, 'ambiguous mesial ignored');
assert.match(r.hint, /mesial/, 'hint names the word');
assert.equal(parseInto(s2, '3 2 3').hint, null, 'no hint on plain input');
parseInto(s2, 'lingual');
parseInto(s2, 'mesial');
assert.equal(s2.cur.s, 3, 'mesial resolves once lingual announced');
// app wiring: a UI status string on the same object must not affect navigation (was: 1->32)
const s3 = createState();
s3.status = 'Listening: speak triplets like "three two three".';
parseInto(s3, '3 2 3');
assert.deepEqual(s3.cur, { t: 1, s: 3 }, 'status string ignored by advance');
// narrative dialect: negation, rows, lists, grades, names, hints
const n = createState();
parseInto(n, 'tooth 3 buccal 2-3-2 lingual 3-2-3 no bleeding');
assert.deepEqual(n.teeth[3], [2, 3, 2, 3, 2, 3], 'row triplets');
assert.equal(n.bleed[3].every((b) => !b), true, 'negation holds');
parseInto(n, 'tooth 14 buccal 4-5-4 bleeding on buccal');
assert.deepEqual(n.bleed[14].slice(0, 3), [true, true, true], 'row flag');
parseInto(n, 'tooth 15 bleeding all');
assert.equal(n.bleed[15].every(Boolean), true, 'all flag');
parseInto(n, 'teeth 17, 18 and 32 are missing');
assert.deepEqual([n.absent[17], n.absent[18], n.absent[32]], ['MISSING', 'MISSING', 'MISSING'], 'list status');
parseInto(n, 'tooth 19 mobility two');
assert.equal(n.mob[19], 2, 'mobility store');
parseInto(n, 'tooth 23 slight mobility');
assert.equal(n.mob[23], 1, 'mobility adjective');
parseInto(n, 'tooth 20 furcation class two on lingual');
assert.deepEqual(n.fur[20], { grade: 2, side: 'lingual' }, 'furcation store');
parseInto(n, 'tooth 21 recession 2mm at mid-buccal');
assert.equal(n.rec[21][1], 2, 'recession LED');
parseInto(n, 'tooth 22 suppuration at mid-buccal and disto-lingual');
assert.deepEqual([n.sup[22][1], n.sup[22][5]], [true, true], 'suppuration chain');
parseInto(n, 'upper right first molar');
assert.equal(n.cur.t, 3, 'tooth name');
parseInto(n, 'upper left 6');
assert.equal(n.cur.t, 14, 'palmer');
parseInto(n, 'tooth 26 (FDI)');
assert.equal(n.cur.t, 14, 'fdi');
parseInto(n, 'tooth 10 mid buccal');
assert.equal(n.cur.s, 1, 'mid-buccal selects B');
parseInto(n, 'tooth 24 Miller class two');
assert.equal(n.teeth[24].every((v) => v === null), true, 'class never a depth');
parseInto(n, 'tooth 25 gingival overgrowth 2mm');
assert.equal(n.teeth[25].every((v) => v === null), true, 'overgrowth never a depth');
assert.equal(parseInto(n, 'tooth 7 buccal 15-2-2').hint?.length > 0, true, 'range hint');
assert.equal(parseInto(createState(), '').hint, 'empty input', 'empty hint');
assert.match(parseInto(createState(), 'hello world').hint ?? '', /no clinical data/, 'prose hint');
// site-targeted dictation binds immediately - trailing value must not spill to next tooth
const b = createState();
parseInto(b, 'B 1 DB 2 ML 3 L 4 DL 5 MB 6');
assert.deepEqual(b.teeth[1], [6, 1, 2, 3, 4, 5], 'site-value pairs stay on tooth 1');
assert.deepEqual(b.teeth[2], [null, null, null, null, null, null], 'no spill onto tooth 2');
// undo restores tooth status, not just readings
const u = createState();
parseInto(u, 'tooth 28 is missing');
assert.equal(u.absent[28], 'MISSING', 'marked');
parseInto(u, 'undo');
assert.equal(u.absent[28], undefined, 'undo unmarks');
parseInto(u, 'jump 27');
parseInto(u, 'missing');
assert.equal(u.absent[27], 'MISSING', 'bare marked');
parseInto(u, 'undo');
assert.equal(u.absent[27], undefined, 'bare undo unmarks');
// lone value names its site: "5 B 3 B" replaces within B, MB untouched
const c = createState();
parseInto(c, 'jump 12');
parseInto(c, '5 B 3 B');
assert.equal(c.teeth[12][0], null, 'MB untouched');
assert.equal(c.teeth[12][1], 3, 'B replaced, not adjoined');
// multi-value buffers stay sequential past a site word, explicit bind wins
const d = createState();
parseInto(d, 'jump 13');
parseInto(d, '3 2 B 4');
assert.deepEqual(d.teeth[13].slice(0, 2), [3, 4], 'triplet flow kept, B corrected to 4');
// lgraph mishears "furcation" as facial/suppuration - grades never follow those words, so repair
const f = createState();
parseInto(f, 'tooth 3 facial class two on buccal');
assert.deepEqual(f.fur[3], { grade: 2, side: 'buccal' }, 'facial+class repair');
assert.equal(f.sup[3].every((v) => !v), true, 'no suppuration set');
parseInto(f, 'tooth 4 suppuration class one on lingual');
assert.deepEqual(f.fur[4], { grade: 1, side: 'lingual' }, 'suppuration+class repair');
assert.equal(f.sup[4].every((v) => !v), true, 'repair sets no suppuration');
// plain rows + real suppuration untouched by the repair
parseInto(f, 'tooth 5 buccal 2-3-2');
assert.deepEqual(f.teeth[5].slice(0, 3), [2, 3, 2], 'row triplet intact');
parseInto(f, 'tooth 6 suppuration noted at mid-buccal');
assert.equal(f.sup[6][1], true, 'real suppuration intact');
// observed live mishearing: "furcation" -> "vocation" (verified on user recording, both models)
parseInto(f, 'tooth 5 vocation class three on lingual');
assert.deepEqual(f.fur[5], { grade: 3, side: 'lingual' }, 'vocation alias');
console.log('perio.test ok');
