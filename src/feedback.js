// ponytail: spoken action summaries - pure mapping, unit-tested here, voiced by the App
import { SITEWORDS } from './perio.js';

const KIND_PHRASE = {
  depth: 'recorded',
  bleed: 'bleeding marked',
  sup: 'suppuration marked',
  plaque: 'plaque marked',
  rec: 'recession marked',
  mob: 'mobility noted',
  fur: 'furcation noted',
  absent: 'tooth marked',
};

const rowWord = (s) => (s < 3 ? 'buccal' : 'lingual');

function single(e) {
  const site = SITEWORDS[e.s] ?? `site ${e.s + 1}`;
  switch (e.kind) {
    case 'bleed': return `bleeding on ${site}`;
    case 'sup': return `suppuration on ${site}`;
    case 'plaque': return `plaque on ${site}`;
    case 'rec': return `recession ${e.v} on ${site}`;
    case 'mob': return `mobility ${e.v} on tooth ${e.t}`;
    case 'fur': return `furcation ${e.v}${e.side ? ` ${e.side}` : ''} on tooth ${e.t}`;
    case 'absent': return `tooth ${e.t} marked ${String(e.v).toLowerCase()}`;
    default: return null;
  }
}

/** Short spoken summary of a parse result, or null when silence is better. */
export function feedbackText(r) {
  if (!r || r.stop) return null;
  if (r.cleared) return 'tooth cleared';
  if (r.undone) return 'undone';
  const said = r.said ?? [];
  if (said.length) {
    // ponytail: superseded same-site depths resolve to the winner ("3 change last to 5" says 5)
    const seen = new Set();
    const fresh = [];
    for (let i = said.length - 1; i >= 0; i--) {
      const e = said[i];
      const key = e.kind === 'depth' ? `d${e.t}:${e.s}` : `k${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.unshift(e);
    }
    const parts = [];
    let run = null;
    const flushRun = () => {
      if (run && run.vals.length) parts.push(`${run.vals.join(' ')} on tooth ${run.t} ${rowWord(run.s0)}`);
      run = null;
    };
    for (const e of fresh) {
      if (e.kind === 'depth' && e.v != null) {
        if (!run || run.t !== e.t) {
          flushRun();
          run = { t: e.t, vals: [], s0: e.s };
        }
        run.vals.push(e.v);
      } else {
        flushRun();
        const p = single(e);
        if (p) parts.push(p);
      }
    }
    flushRun();
    if (parts.length) return parts.slice(0, 4).join(', ');
    return null;
  }
  // ponytail: no said detail (older callers) - generic kind phrases keep working
  const kinds = [...new Set(r.kinds ?? [])].filter((k) => KIND_PHRASE[k]);
  if (!kinds.length) return null;
  return kinds.slice(0, 2).map((k) => KIND_PHRASE[k]).join(', ');
}
