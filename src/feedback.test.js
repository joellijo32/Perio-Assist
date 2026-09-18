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
console.log('feedback.test ok');
