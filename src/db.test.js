import { strict as assert } from 'node:assert';
import { remove, search, upsert } from './db.js';

// ponytail: one runnable check for the branchy bit - fails if the db breaks
let list = [];
upsert(list, 'Anil Kumar', { teeth: 1 });
assert.equal(list.length, 1);
upsert(list, 'anil kumar', { teeth: 2 });
assert.equal(list.length, 1, 'case-insensitive overwrite');
assert.equal(search(list, 'ani').length, 1);
assert.equal(search(list, 'zzz').length, 0);
assert.equal(search(list, '  ').length, 1, 'blank query returns all');
remove(list, list[0].id);
assert.equal(list.length, 0);
console.log('db.test ok');
