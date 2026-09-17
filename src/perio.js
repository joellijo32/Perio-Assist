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
  b: 1, be: 1, buccal: 1, facial: 1,
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
function toSite(toks, i, aspect = 'facial') {
  let j = i;
  while (SITE_FILLER.has(toks[j])) j++;
  if (toks[j] in SITES) return [SITES[toks[j]], j + 1];
  if (toks[j] in SITE_PAIRS && toks[j + 1] in SITE_PAIRS[toks[j]]) {
    // ponytail: "distal lingual:" is descriptor + aspect switch, not distolingual - buccal never starts an aspect
    const aspectSwitch =
      (toks[j] === 'mesial' || toks[j] === 'distal') &&
      (toks[j + 1] === 'lingual' || toks[j + 1] === 'facial');
    if (!aspectSwitch) return [SITE_PAIRS[toks[j]][toks[j + 1]], j + 2];
  }
  if (toks[j] === 'mesial') return [aspect === 'facial' ? 0 : 3, j + 1];
  if (toks[j] === 'distal') return [aspect === 'facial' ? 2 : 5, j + 1];
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
    rec: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, Array(6).fill(0)])),
    // ponytail: tooth map, NOT the UI message - store.status is a string, indexing it marches 1->32
    absent: {},
    aspect: 'facial',
    aspectSet: false,
    cur: { t: 1, s: 0 },
    last: [],
    hist: [],
    groups: [], // hist-entry counts per utterance, for undo
  };
}

function skipAbsent(state) {
  while (state.absent[state.cur.t] && state.cur.t < 32) { state.cur.t++; state.cur.s = 0; }
}

function advance(state, n = 1) {
  for (let k = 0; k < n; k++) {
    state.cur.s++;
    if (state.cur.s > 5) {
      state.cur.s = 0;
      state.cur.t = Math.min(32, state.cur.t + 1);
    }
    skipAbsent(state);
  }
}

// ponytail: one restore path for clear + undo - hist kinds stay in one place
function restore(state, h, moveCursor = true) {
  if (!h) return;
  if (h.kind === 'bleed') state.bleed[h.t][h.s] = false;
  else if (h.kind === 'rec') state.rec[h.t][h.s] = h.prev ?? 0;
  else state.teeth[h.t][h.s] = h.prev ?? null;
  if (moveCursor) state.cur = { t: h.t, s: h.s };
}

// ponytail: corrections patch in place (cursor stays, flow continues) - prev keeps undo exact
function lastDepth(state) {
  for (let k = state.hist.length - 1; k >= 0; k--) {
    if (state.hist[k].kind === 'depth') return state.hist[k];
  }
  return null;
}

function patchDepth(state, t, s, v) {
  if (t == null || v == null || v < 0 || v > 12) return false;
  state.hist.push({ t, s, kind: 'depth', prev: state.teeth[t][s] });
  state.teeth[t][s] = v;
  // ponytail: patching the parked site means re-dictation - flow continues past it
  if (state.cur.t === t && state.cur.s === s) advance(state);
  return true;
}

const FILLER = new Set(['is', 'a', 'the', 'that', 'with', 'wait', 'positive', 'please']);

function skipFiller(toks, j) {
  while (FILLER.has(toks[j])) j++;
  return j;
}

function shrinkGroup(state) {
  const g = state.groups;
  if (!g.length) return;
  g[g.length - 1]--;
  if (!g[g.length - 1]) g.pop();
}

/** Parse a transcript chunk into chart state. Returns { ms, hint }. */
export function parseInto(state, text) {
  const t0 = performance.now();
  const mark = state.hist.length;
  let hint = null;
  // ponytail: punctuation -> space ("twenty-four" stays two words, "facial:" matches)
  const toks = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let nums = [];
  const flush = () => {
    if (!nums.length) return;
    state.last = [...nums];
    for (const v of nums) {
      state.hist.push({ ...state.cur, kind: 'depth', prev: null });
      state.teeth[state.cur.t][state.cur.s] = v;
      advance(state);
    }
    nums = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (w in NUMWORDS || /^\d+$/.test(w)) {
      // recession belongs to the site just touched (depth, patch, or bleed) - not blindly cursor-1
      if (String(toks[i + 1]).startsWith('millimeter') && toks[i + 2] === 'recession') {
        flush();
        const h = state.hist[state.hist.length - 1];
        const s = h && h.t === state.cur.t ? h.s : Math.max(0, state.cur.s - 1);
        state.rec[state.cur.t][s] = NUMWORDS[w] ?? +w;
        state.hist.push({ t: state.cur.t, s, kind: 'rec', prev: 0 });
        i += 2;
        continue;
      }
      const v = NUMWORDS[w] ?? +w;
      if (v >= 0 && v <= 12) nums.push(v);
      continue;
    }
    // "facial:" / "lingual:" set context for bare mesial/distal; cursor stays so flow continues
    if (w === 'facial' || w === 'lingual') { state.aspect = w; state.aspectSet = true; continue; }
    const bare = toSite(toks, i, state.aspect);
    if (bare) {
      // ponytail: lone mesial/distal with no announced side is a guess - ask instead of charting wrong
      const lone = (toks[i] === 'mesial' || toks[i] === 'distal') && bare[1] === i + 1;
      if (lone && !state.aspectSet) hint ??= `${toks[i]} - facial or lingual?`;
      else { flush(); state.cur.s = bare[0]; i = bare[1] - 1; }
      continue;
    }
    if (w === 'make') {
      flush(); // "make that 5" / "make the mesial a 5"
      let j = skipFiller(toks, i + 1);
      if (toks[j] === 'that') j++;
      j = skipFiller(toks, j);
      const site = toSite(toks, j, state.aspect);
      let k = site ? site[1] : j;
      k = skipFiller(toks, k);
      const tgt = site ? { t: state.cur.t, s: site[0] } : lastDepth(state);
      if (tgt && patchDepth(state, tgt.t, tgt.s, toNum(toks[k]))) i = k;
      continue;
    }
    if (w === 'change') {
      flush(); // "change last to 5"
      let j = skipFiller(toks, i + 1);
      if (toks[j] === 'last') j++;
      if (toks[j] === 'to') j++;
      const h = lastDepth(state);
      if (h && patchDepth(state, h.t, h.s, toNum(toks[j]))) i = j;
      continue;
    }
    if (w === 'correction') {
      flush(); // "correction, 5 on mesial" (site optional -> last depth)
      const j = skipFiller(toks, i + 1);
      const site = toSite(toks, j + 1, state.aspect);
      const k = site ? site[1] : j + 1;
      const tgt = site ? { t: state.cur.t, s: site[0] } : lastDepth(state);
      if (tgt && patchDepth(state, tgt.t, tgt.s, toNum(toks[j]))) i = k - 1;
      continue;
    }
    if (w === 'repeat') { flush(); nums = [...state.last]; continue; }
    if (w === 'jump' || w === 'go') {
      flush();
      const r = resolveTooth(toks, i + 1);
      if (r) {
        state.cur = { t: r[0], s: 0 };
        i = r[1] - 1;
        const site = toSite(toks, i + 1, state.aspect); // "jump 12 MB"
        if (site) { state.cur.s = site[0]; i = site[1] - 1; }
      }
      continue;
    }
    if (w === 'tooth' || w === 'number') {
      flush();
      const r = resolveTooth(toks, i + 1); // never a depth, even bare ("tooth 12")
      if (!r) continue;
      state.cur = { t: r[0], s: 0 };
      state.aspect = 'facial';
      state.aspectSet = false;
      let k = skipFiller(toks, r[1]); // "tooth 5 is missing"
      if (toks[k] === 'missing' || toks[k] === 'implant') {
        state.absent[r[0]] = toks[k].toUpperCase();
        i = k;
        skipAbsent(state);
      } else i = r[1] - 1;
      continue;
    }
    if (w === 'missing' || w === 'implant') {
      flush();
      state.absent[state.cur.t] = w.toUpperCase();
      skipAbsent(state);
      continue;
    }
    if (w === 'next') { flush(); state.cur = { t: Math.min(32, state.cur.t + 1), s: 0 }; skipAbsent(state); continue; }
    if (w === 'back') { flush(); state.cur = { t: Math.max(1, state.cur.t - 1), s: 0 }; continue; }
    if (w === 'skip' || w === 'miss') { flush(); advance(state, 6 - (state.cur.s % 6) || 6); continue; }
    if (w === 'bleeding' || w === 'blood' || w === 'bop' || w === 'bleed' || w === 'drop') {
      flush();
      const site = toSite(toks, i + 1, state.aspect); // "bleeding MB", "bleeding at mesiobuccal"
      if (site) {
        // ponytail: flag in place, cursor stays - bare site words navigate, conditions don't
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
  return { ms: performance.now() - t0, hint };
}
