import { readFileSync } from 'node:fs';
import { createState, parseInto } from '../../src/perio.js';

// ponytail: end-to-end score - hypothesis and reference each charted fresh, diff the charts
const results = JSON.parse(readFileSync(new URL('./results.json', import.meta.url)));

function chartOf(text) {
  const s = createState();
  parseInto(s, text);
  return s;
}

let match = 0, total = 0;
const misses = [];
for (const r of results) {
  if (r.profile !== 'clean') continue; // chart-match on clean only; noise covered by WER
  const a = chartOf(r.ref);
  const b = chartOf(r.hyp);
  const diffs = [];
  for (let t = 1; t <= 32; t++) {
    for (let i = 0; i < 6; i++) {
      if (a.teeth[t][i] !== b.teeth[t][i]) diffs.push(`T${t}[${i}] ${a.teeth[t][i]}->${b.teeth[t][i]}`);
      if (!!a.bleed[t][i] !== !!b.bleed[t][i]) diffs.push(`T${t}[${i}] bleed`);
    }
    if ((a.absent[t] ?? null) !== (b.absent[t] ?? null)) diffs.push(`T${t} status`);
  }
  total++;
  if (!diffs.length) match++;
  else if (misses.length < 10) misses.push(`${r.id}: ref=${JSON.stringify(r.ref)} hyp=${JSON.stringify(r.hyp)} :: ${diffs.slice(0, 4).join(', ')}`);
}
console.log(`chart-match ${match}/${total} = ${(100 * match) / total || 0}%`);
for (const m of misses) console.log('  miss:', m);
