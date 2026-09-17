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

export function createState() {
  return {
    teeth: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, Array(6).fill(null)])),
    bleed: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, Array(6).fill(false)])),
    cur: { t: 1, s: 0 },
    last: [],
    hist: [],
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

/** Parse a transcript chunk into chart state. Returns ms spent. */
export function parseInto(state, text) {
  const t0 = performance.now();
  const toks = text.toLowerCase().replace(/tooth /g, '').split(/\s+/);
  let nums = [];
  const flush = () => {
    if (!nums.length) return;
    state.last = [...nums];
    for (const v of nums) {
      state.hist.push({ ...state.cur });
      state.teeth[state.cur.t][state.cur.s] = v;
      advance(state);
    }
    nums = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (w in NUMWORDS || /^\d+$/.test(w)) {
      const v = NUMWORDS[w] ?? +w;
      if (v >= 0 && v <= 12) nums.push(v);
      continue;
    }
    const bare = toSite(toks, i);
    if (bare) { flush(); state.cur.s = bare[0]; i = bare[1] - 1; continue; }
    if (w === 'repeat') { flush(); nums = [...state.last]; continue; }
    if (w === 'jump' || w === 'go') {
      flush();
      let j = i + 1;
      while (toks[j] === 'to' || toks[j] === 'tooth') j++; // "go to 12"
      let n = toNum(toks[j]);
      const u = toNum(toks[j + 1]);
      if ((toks[j] === 'twenty' || toks[j] === 'thirty') && u >= 0 && u <= 9) {
        n = n + u;
        j++;
      }
      if (n >= 1 && n <= 32) {
        state.cur = { t: n, s: 0 };
        i = j;
        const site = toSite(toks, i + 1); // "jump 12 MB"
        if (site) { state.cur.s = site[0]; i = site[1] - 1; }
      }
      continue;
    }
    if (w === 'next') { flush(); state.cur = { t: Math.min(32, state.cur.t + 1), s: 0 }; continue; }
    if (w === 'back') { flush(); state.cur = { t: Math.max(1, state.cur.t - 1), s: 0 }; continue; }
    if (w === 'skip' || w === 'miss') { flush(); advance(state, 6 - (state.cur.s % 6) || 6); continue; }
    if (w === 'bleeding' || w === 'blood' || w === 'bop') {
      flush();
      const site = toSite(toks, i + 1); // "bleeding MB", "bleeding at mesiobuccal"
      if (site) {
        state.cur.s = site[0];
        state.bleed[state.cur.t][site[0]] = true;
        i = site[1] - 1;
      } else {
        state.bleed[state.cur.t][Math.max(0, state.cur.s - 1)] = true;
      }
      continue;
    }
    if (w === 'clear' || w === 'scratch') {
      flush();
      const h = state.hist.pop();
      if (h) { state.teeth[h.t][h.s] = null; state.cur = { ...h }; }
    }
  }
  flush();
  return performance.now() - t0;
}
