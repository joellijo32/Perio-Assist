import { strict as assert } from 'node:assert';
import { feedbackText } from './feedback.js';

assert.equal(feedbackText({ kinds: ['depth'] }), 'recorded');
assert.equal(feedbackText({ kinds: ['depth', 'bleed'] }), 'recorded, bleeding marked');
assert.equal(feedbackText({ kinds: ['bleed', 'sup', 'plaque', 'rec'] }), 'bleeding marked, suppuration marked');
assert.equal(feedbackText({ kinds: ['mob'] }), 'mobility noted');
assert.equal(feedbackText({ kinds: ['fur'] }), 'furcation noted');
assert.equal(feedbackText({ kinds: ['absent'] }), 'tooth marked');
assert.equal(feedbackText({ undone: true, kinds: ['depth'] }), 'undone');
assert.equal(feedbackText({ kinds: [] }), null);
assert.equal(feedbackText({ kinds: [], hint: 'no clinical data found' }), null);
assert.equal(feedbackText({ stop: true, kinds: ['depth'] }), null);
assert.equal(feedbackText(null), null);
// content echo: grouped depths with tooth + side, site phrases for findings
const D = (t, s, v) => ({ kind: 'depth', t, s, v });
assert.equal(
  feedbackText({ said: [D(12, 0, 1), D(12, 1, 2), D(12, 2, 3)] }),
  '1 2 3 on tooth 12 buccal',
);
assert.equal(
  feedbackText({ said: [{ kind: 'bleed', t: 14, s: 0 }] }),
  'bleeding on mesiobuccal',
);
assert.equal(
  feedbackText({ said: [D(12, 0, 3), D(12, 0, 5)] }),
  '5 on tooth 12 buccal',
);
assert.equal(
  feedbackText({ said: [D(12, 5, 1), D(13, 0, 2)] }),
  '1 on tooth 12 lingual, 2 on tooth 13 buccal',
);
assert.equal(
  feedbackText({ said: [{ kind: 'mob', t: 14, s: 0, v: 2 }] }),
  'mobility 2 on tooth 14',
);
assert.equal(
  feedbackText({ said: [{ kind: 'absent', t: 5, s: 0, v: 'MISSING' }] }),
  'tooth 5 marked missing',
);
assert.equal(feedbackText({ cleared: true, said: [D(14, 0, 3)] }), 'tooth cleared');
console.log('feedback.test ok');
