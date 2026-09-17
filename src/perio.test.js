import { strict as assert } from 'node:assert';
import { createState, parseInto } from './perio.js';

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
parseInto(s, 'distal lingual');
assert.equal(s.cur.s, 5, 'two-word site');
parseInto(s, 'buccal');
assert.equal(s.cur.s, 1, 'bare site');
parseInto(s, 'm b');
assert.equal(s.cur.s, 0, 'letter pair');
// bare bleeding still flags the last filled site
parseInto(s, 'jump 14');
parseInto(s, '5');
parseInto(s, 'bleeding');
assert.equal(s.teeth[14][0], 5, 'depth kept');
assert.equal(s.bleed[14][0], true, 'bare bleed kept');
assert.equal(s.cur.s, 1, 'bare bleed no move');
console.log('perio.test ok');
