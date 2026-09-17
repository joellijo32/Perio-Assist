import { execFileSync } from 'node:child_process';
import { createState, parseInto } from '../src/perio.js';

// ponytail: generator emits mesial-to-distal, matching our cursor order 0..5
const OURS = ['MF', 'F', 'DF', 'ML', 'L', 'DL']; // our site index -> generator site code

const seed = Number(process.argv[2] ?? '1');
const patients = Number(process.argv[3] ?? '3');
const teeth = Number(process.argv[4] ?? '8');

let depths = 0, depthHit = 0, bleeds = 0, bleedHit = 0;
let recs = 0, recHit = 0, stats = 0, statHit = 0;
const misses = [];

for (let p = 0; p < patients; p++) {
  const { transcript, truth } = JSON.parse(
    execFileSync('python3', ['scripts/eval_gen.py', String(seed + p), String(teeth), '1'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }),
  );
  const state = createState();
  for (const chunk of transcript.toLowerCase().split('.')) {
    if (chunk.trim()) parseInto(state, chunk);
  }
  for (const [id, t] of Object.entries(truth)) {
    if (t.sites === null || t.sites === undefined) {
      stats++;
      if ((state.status ?? {})[id] === t.status) statHit++;
      else if (misses.length < 8) misses.push(`T${id}: status ${t.status}, got ${(state.status ?? {})[id] ?? 'PRESENT'}`);
      continue;
    }
    for (let s = 0; s < 6; s++) {
      const g = t.sites[OURS[s]];
      depths++;
      if (state.teeth[id]?.[s] === g.depth_mm) depthHit++;
      else if (misses.length < 8) misses.push(`T${id}[${s}]: depth ${g.depth_mm}, got ${state.teeth[id]?.[s]}`);
      bleeds++;
      if (!!state.bleed[id]?.[s] === g.bleeding) bleedHit++;
      else if (misses.length < 8) misses.push(`T${id}[${s}]: bleed ${g.bleeding}, got ${!!state.bleed[id]?.[s]}`);
      recs++;
      if ((state.rec?.[id]?.[s] ?? 0) === g.recession_mm) recHit++;
      else if (misses.length < 8) misses.push(`T${id}[${s}]: rec ${g.recession_mm}, got ${state.rec?.[id]?.[s] ?? 0}`);
    }
  }
}

const pct = (h, n) => (n ? ((100 * h) / n).toFixed(1) : 'n/a');
console.log(`patients=${patients} teeth~${teeth} seed=${seed}`);
console.log(`depth ${depthHit}/${depths} (${pct(depthHit, depths)}%)  bleed ${bleedHit}/${bleeds} (${pct(bleedHit, bleeds)}%)`);
console.log(`rec ${recHit}/${recs} (${pct(recHit, recs)}%)  status ${statHit}/${stats} (${pct(statHit, stats)}%)`);
for (const m of misses) console.log('  miss:', m);
