// ponytail: pure framework-free chart logic - testable in node, wrapped with $state in chart.svelte.js
export const NUMWORDS = {
  zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3,
  four: 4, for: 4, fore: 4, five: 5, six: 6, seven: 7, ate: 8, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
};

// ponytail: site codes + spoken anatomy - letter pairs cover split STT ("m b")
export const SITES = {
  mb: 0, mesiobuccal: 0,
  b: 1, be: 1, buccal: 1,
  db: 2, distobuccal: 2,
  ml: 3, mesiolingual: 3,
  l: 4, ell: 4, lingual: 4,
  dl: 5, distolingual: 5,
};
export const SITENAMES = ['MB', 'B', 'DB', 'ML', 'L', 'DL'];
const SITE_FILLER = new Set(['at', 'on']);
const SITE_PAIRS = {
  mesial: { buccal: 0, lingual: 3 },
  distal: { buccal: 2, lingual: 5 },
  m: { b: 0, l: 3 },
  d: { b: 2, l: 5 },
};

/** Resolve a site at toks[i], skipping at/on. Returns [index, nextI] or null; never consumes on miss. */
function toSite(toks, i) {
  let j = i;
  while (SITE_FILLER.has(toks[j])) j++;
  if (toks[j] in SITES) return [SITES[toks[j]], j + 1];
  if (toks[j] in SITE_PAIRS && toks[j + 1] in SITE_PAIRS[toks[j]]) {
    return [SITE_PAIRS[toks[j]][toks[j + 1]], j + 2];
  }
  return null;
}

// ponytail: spoken tooth numbers ("twenty four") - depths stay capped at 12 by the caller
function toNum(t) {
  if (t == null) return undefined;
  return /^\d+$/.test(t) ? +t : NUMWORDS[t];
}

// ponytail: one tooth resolver for jump + announcements - composites included
function resolveTooth(toks, i) {
  let j = i;
  while (toks[j] === 'to' || toks[j] === 'tooth') j++; // "go to 12"
  let n = toNum(toks[j]);
  const u = toNum(toks[j + 1]);
  if ((toks[j] === 'twenty' || toks[j] === 'thirty') && u >= 0 && u <= 9) {
    n += u;
    j++;
  }
  return n >= 1 && n <= 32 ? [n, j + 1] : null;
}

export function createState() {
  return {
    teeth: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, Array(6).fill(null)])),
    bleed: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, Array(6).fill(false)])),
    cur: { t: 1, s: 0 },
    last: [],
    hist: [],
    groups: [], // hist-entry counts per utterance, for undo
  };
}

function advance(state, n = 1) {
  for (let k = 0; k < n; k++) {
    state.cur.s++;
    if (state.cur.s > 5) {
      state.cur.s = 0;
      state.cur.t = Math.min(32, state.cur.t + 1);
    }
  }
}

// ponytail: one restore path for clear + undo - hist kinds stay in one place
function restore(state, h, moveCursor = true) {
  if (!h) return;
  if (h.kind === 'bleed') state.bleed[h.t][h.s] = false;
  else state.teeth[h.t][h.s] = null;
  if (moveCursor) state.cur = { t: h.t, s: h.s };
}

function shrinkGroup(state) {
  const g = state.groups;
  if (!g.length) return;
  g[g.length - 1]--;
  if (!g[g.length - 1]) g.pop();
}

/** Parse a transcript chunk into chart state. Returns ms spent. */
export function parseInto(state, text) {
  const t0 = performance.now();
  const mark = state.hist.length;
  // ponytail: punctuation -> space ("twenty-four" stays two words, "facial:" matches)
  const toks = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let nums = [];
  const flush = () => {
    if (!nums.length) return;
    state.last = [...nums];
    for (const v of nums) {
      state.hist.push({ ...state.cur, kind: 'depth' });
      state.teeth[state.cur.t][state.cur.s] = v;
      advance(state);
    }
    nums = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (w in NUMWORDS || /^\d+$/.test(w)) {
      // "2 millimeters recession" is recession, not a depth (stored in step 3)
      if (String(toks[i + 1]).startsWith('millimeter') && toks[i + 2] === 'recession') { i += 2; continue; }
      const v = NUMWORDS[w] ?? +w;
      if (v >= 0 && v <= 12) nums.push(v);
      continue;
    }
    const bare = toSite(toks, i);
    if (bare) { flush(); state.cur.s = bare[0]; i = bare[1] - 1; continue; }
    if (w === 'repeat') { flush(); nums = [...state.last]; continue; }
    if (w === 'jump' || w === 'go') {
      flush();
      const r = resolveTooth(toks, i + 1);
      if (r) {
        state.cur = { t: r[0], s: 0 };
        i = r[1] - 1;
        const site = toSite(toks, i + 1); // "jump 12 MB"
        if (site) { state.cur.s = site[0]; i = site[1] - 1; }
      }
      continue;
    }
    if (w === 'tooth' || w === 'number') {
      flush();
      const r = resolveTooth(toks, i + 1); // never a depth, even bare ("tooth 12")
      if (r) { state.cur = { t: r[0], s: 0 }; i = r[1] - 1; }
      continue;
    }
    if (w === 'next') { flush(); state.cur = { t: Math.min(32, state.cur.t + 1), s: 0 }; continue; }
    if (w === 'back') { flush(); state.cur = { t: Math.max(1, state.cur.t - 1), s: 0 }; continue; }
    if (w === 'skip' || w === 'miss') { flush(); advance(state, 6 - (state.cur.s % 6) || 6); continue; }
    if (w === 'bleeding' || w === 'blood' || w === 'bop' || w === 'bleed' || w === 'drop') {
      flush();
      const site = toSite(toks, i + 1); // "bleeding MB", "bleeding at mesiobuccal"
      if (site) {
        state.cur.s = site[0];
        state.bleed[state.cur.t][site[0]] = true;
        state.hist.push({ t: state.cur.t, s: site[0], kind: 'bleed' });
        i = site[1] - 1;
      } else {
        const s = Math.max(0, state.cur.s - 1);
        state.bleed[state.cur.t][s] = true;
        state.hist.push({ t: state.cur.t, s, kind: 'bleed' });
      }
      continue;
    }
    if (w === 'clear' || w === 'scratch') {
      flush();
      const own = state.hist.length > mark;
      restore(state, state.hist.pop());
      if (!own) shrinkGroup(state);
      continue;
    }
    if (w === 'undo') {
      flush();
      let n = state.hist.length - mark; // own utterance first, else last group
      if (n <= 0) n = state.groups.pop() ?? 0;
      let earliest = null;
      while (n-- > 0) {
        const h = state.hist.pop();
        if (!h) break;
        earliest = h;
        restore(state, h, false);
      }
      if (earliest) state.cur = { t: earliest.t, s: earliest.s };
      continue;
    }
  }
  flush();
  const added = state.hist.length - mark;
  if (added > 0) state.groups.push(added);
  return performance.now() - t0;
}
