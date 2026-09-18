import { readFileSync } from 'node:fs';
import { createState, parseInto } from '../../src/perio.js';

// ponytail: end-to-end score - hypothesis and reference each charted fresh, diff the charts
const resultsFile = process.argv[2] || 'results.json';
const results = JSON.parse(readFileSync(new URL(`./${resultsFile}`, import.meta.url)));

function chartOf(text) {
  const s = createState();
  parseInto(s, text);
  return s;
}

const byProfile = {};
for (const r of results) {
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
  const p = byProfile[r.profile] ?? (byProfile[r.profile] = { match: 0, total: 0, misses: [] });
  p.total++;
  if (!diffs.length) p.match++;
  else if (p.misses.length < 10) p.misses.push(`${r.id}: ref=${JSON.stringify(r.ref)} hyp=${JSON.stringify(r.hyp)} :: ${diffs.slice(0, 4).join(', ')}`);
}
for (const [profile, p] of Object.entries(byProfile)) {
  console.log(`chart-match [${profile}] ${p.match}/${p.total} = ${(100 * p.match) / p.total || 0}%`);
  for (const m of p.misses) console.log('  miss:', m);
}
