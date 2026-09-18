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
const SITE_FILLER = new Set(['at', 'on', 'probing', 'noted']);
const SITE_PAIRS = {
  mesial: { buccal: 0, lingual: 3 },
  distal: { buccal: 2, lingual: 5 },
  mesio: { buccal: 0, lingual: 3 },
  disto: { buccal: 2, lingual: 5 },
  m: { b: 0, l: 3 },
  d: { b: 2, l: 5 },
};
// ponytail: row words address whole rows ("bleeding on buccal"); mid- words address mid sites
const ROWS = { buccal: [0, 1, 2], facial: [0, 1, 2], lingual: [3, 4, 5] };
const ALLWORDS = new Set(['all', 'throughout']);
const MOB_ADJ = { slight: 1, moderate: 2, severe: 3 };
const SIDEWORDS = new Set(['buccal', 'facial', 'lingual', 'mesial', 'distal', 'mb', 'b', 'db', 'ml', 'l', 'dl']);

/** Resolve a site at toks[i], skipping at/on. Returns [index, nextI] or null; never consumes on miss. */
function toSite(toks, i, aspect = 'facial') {
  let j = i;
  while (SITE_FILLER.has(toks[j])) j++;
  if (toks[j] in SITES) return [SITES[toks[j]], j + 1];
  if (toks[j] === 'mid' || toks[j] === 'middle') {
    if (toks[j + 1] === 'buccal' || toks[j + 1] === 'facial') return [1, j + 2];
    if (toks[j + 1] === 'lingual') return [4, j + 2];
    return null;
  }
  if (toks[j] in SITE_PAIRS && toks[j + 1] in SITE_PAIRS[toks[j]]) {
    // ponytail: "distal lingual:" is descriptor + aspect switch, not distolingual - buccal never starts an aspect
    // (mesio/disto compounds always pair: they never appear as bare descriptors)
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

// ponytail: FDI->Universal and Palmer/quadrant->Universal live beside the parser, not in it
function fdiToUni(n) {
  if (n >= 11 && n <= 18) return 19 - n;
  if (n >= 21 && n <= 28) return n - 12;
  if (n >= 31 && n <= 38) return 55 - n;
  if (n >= 41 && n <= 48) return n - 16;
  return null;
}

function palmerToUni(quad, p) {
  if (p < 1 || p > 8) return null;
  if (quad === 'ur') return 9 - p;
  if (quad === 'ul') return 8 + p;
  if (quad === 'll') return 25 - p;
  if (quad === 'lr') return 24 + p;
  return null;
}

const TOOTH_TYPES = {
  central: 0, lateral: 1, canine: 2, cuspid: 2, incisor: 0,
  premolar: 3, bicuspid: 3, molar: 5,
};
const ORDINALS = { first: 1, second: 2, third: 3, wisdom: 3 };

function quadToothToUni(quad, ord, type) {
  const base = { ur: 8, ul: 9, ll: 24, lr: 25 }[quad];
  const dir = quad === 'ur' || quad === 'll' ? -1 : 1;
  if (base == null || type == null) return null;
  let idx = TOOTH_TYPES[type];
  if (idx == null) return null;
  if (ord != null && (type === 'premolar' || type === 'bicuspid' || type === 'molar')) idx += ord - 1;
  if (idx < 0 || idx > 7) return null;
  return base + dir * idx;
}

// ponytail: one status writer - present clears, the rest mark; undo restores via prev
function markAbsent(state, ids, word) {
  for (const t of ids) {
    if (word === 'present') {
      if (state.absent[t] == null) continue;
      state.hist.push({ t, s: 0, kind: 'absent', prev: state.absent[t] });
      delete state.absent[t];
    } else {
      state.hist.push({ t, s: 0, kind: 'absent', prev: state.absent[t] ?? null });
      state.absent[t] = word.toUpperCase();
    }
  }
}

const TOOTH_GROUPS = {
  wisdom: [1, 16, 17, 32],
  upper: Array.from({ length: 16 }, (_, i) => i + 1),
  lower: Array.from({ length: 16 }, (_, i) => i + 17),
};

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
    sup: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, Array(6).fill(false)])),
    mob: {},
    fur: {},    // ponytail: tooth map, NOT the UI message - store.status is a string, indexing it marches 1->32
    absent: {},
    aspect: 'facial',
    aspectSet: false,
    cur: { t: 1, s: 0 },
    overflowed: false, // ponytail: set on tooth wrap only - trailing findings use it, navigation clears it
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
      state.overflowed = true;
      skipAbsent(state); // ponytail: skip only on arrival - an explicitly landed tooth fills normally
    }
  }
}

// ponytail: trailing findings ("...lingual 4-4-3, bleeding on buccal") belong to the finished tooth
// - same breath: pending triplet just completed it (cursor sits at next row start)
// - later breath: overflow flag + last write on the previous tooth (explicit nav clears the flag)
function condTooth(state, hadPending) {
  const h = state.hist[state.hist.length - 1];
  if (hadPending && state.cur.s === 0 && h && h.t === state.cur.t - 1) return h.t;
  if (!hadPending && state.overflowed && h && h.t !== state.cur.t) return h.t;
  return state.cur.t;
}

// ponytail: one restore path for clear + undo - hist kinds stay in one place
function restore(state, h, moveCursor = true) {
  if (!h) return;
  if (h.kind === 'bleed') state.bleed[h.t][h.s] = false;
  else if (h.kind === 'rec') state.rec[h.t][h.s] = h.prev ?? 0;
  else if (h.kind === 'sup') state.sup[h.t][h.s] = false;
  else if (h.kind === 'absent') {
    if (h.prev == null) delete state.absent[h.t];
    else state.absent[h.t] = h.prev;
  } else state.teeth[h.t][h.s] = h.prev ?? null;
  if (moveCursor) state.cur = { t: h.t, s: h.s };
}

// ponytail: recession target shared by both phrasings ("2mm recession" and "recession 2mm")
function recTarget(state) {
  const h = state.hist[state.hist.length - 1];
  return h && h.t === state.cur.t ? h.s : Math.max(0, state.cur.s - 1);
}

function storeRec(state, t, s, v) {
  state.hist.push({ t, s, kind: 'rec', prev: state.rec[t][s] });
  state.rec[t][s] = v;
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

const FILLER = new Set(['is', 'a', 'the', 'that', 'with', 'wait', 'positive', 'please', 'are']);

// ponytail: observed mishearing - "[unk]" under grammar, "vocation" open-vocab (v/f onset + -cation tail)
const isFurc = (w) => w === 'furcation' || w === 'vocation';
const NEG_SET = new Set(['bleeding', 'bleed', 'blood', 'bop', 'drop', 'mobility', 'suppuration']);

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
  // ponytail: attached units split first ("2mm" -> depth 2 + ignored unit)
  const toks = text
    .toLowerCase()
    .replace(/(\d+)mm\b/g, '$1 millimeter ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!toks.length) return { ms: performance.now() - t0, hint: 'empty input' };
  const cur0 = `${state.cur.t}:${state.cur.s}`;
  const ctx0 = `${state.aspect}${state.aspectSet}${Object.keys(state.absent).length}`;
  let negated = false;
  let stored = false; // mob/fur writes leave no hist trace
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
        const hadPending = nums.length > 0;
        flush();
        const t = condTooth(state, hadPending);
        const s = recTarget(state);
        storeRec(state, t, s, NUMWORDS[w] ?? +w);
        i += 2;
        continue;
      }
      const v = NUMWORDS[w] ?? +w;
      if (v >= 0 && v <= 12) nums.push(v);
      else if (v > 12) hint ??= v <= 32 ? `${v} is not a depth (0-12) - say "jump ${v}" to go there` : `PD ${v}mm outside range 0-12`;
      continue;
    }
    if (w === 'no' || w === 'not' || w === 'without') {
      // ponytail: explicit negative - consumes the finding, never flags ("no bleeding")
      negated = true;
      const hadPending = nums.length > 0;
      const j = skipFiller(toks, i + 1);
      if (NEG_SET.has(toks[j])) {
        if (toks[j] === 'mobility') state.mob[condTooth(state, hadPending)] = 0;
        i = j;
      }
      continue;
    }
    // ponytail: row words park at row start ("buccal 2-3-2", "lingual 3-2-3") - say it, you're there
    {
      let j = i;
      while (SITE_FILLER.has(toks[j])) j++;
      const row = toks[j] === 'buccal' || toks[j] === 'facial' ? [0, 'facial']
        : toks[j] === 'lingual' ? [3, 'lingual'] : null;
      if (row) {
        const hadPending = nums.length > 0;
        flush();
        // ponytail: lgraph hears "furcation" as facial/suppuration ("facial class two") -
        // rows never take grades, but plain depths ("buccal 2-3-2") must pass through untouched
        let k = skipFiller(toks, j + 1);
        if (toks[k] === 'class') {
          const kk = skipFiller(toks, k + 1);
          const g = toNum(toks[kk]);
          if (g >= 1 && g <= 3) {
            let m = skipFiller(toks, kk + 1);
            if (toks[m] === 'on' || toks[m] === 'at') m = skipFiller(toks, m + 1);
            const side = SIDEWORDS.has(toks[m]) ? toks[m] : null;
            state.fur[condTooth(state, hadPending)] = { grade: g, side };
            stored = true;
            i = (side ? m + 1 : kk + 1) - 1;
            continue;
          }
        }
        state.aspect = row[1];
        state.aspectSet = true;
        state.cur.s = row[0];
        state.overflowed = false;
        i = j;
        continue;
      }
    }
    const bare = toSite(toks, i, state.aspect);
    if (bare) {
      // ponytail: lone mesial/distal with no announced side is a guess - ask instead of charting wrong
      const lone = (toks[i] === 'mesial' || toks[i] === 'distal') && bare[1] === i + 1;
      if (lone && !state.aspectSet) {
        hint ??= `${toks[i]} - facial or lingual?`;
        continue;
      }
      if (nums.length === 1) {
        // ponytail: "5 B" names the value's site ("five... B") - multi-value buffers stay sequential
        const v = nums.pop();
        state.hist.push({ t: state.cur.t, s: bare[0], kind: 'depth', prev: state.teeth[state.cur.t][bare[0]] });
        state.teeth[state.cur.t][bare[0]] = v;
        state.last = [v];
      } else flush();
      // ponytail: backtrack ("DL 5 MB 6") - fresh wrap + hole behind means same tooth, not next
      if (
        state.overflowed &&
        state.cur.s === 0 &&
        state.cur.t > 1 &&
        state.teeth[state.cur.t]?.every((v) => v === null) &&
        state.teeth[state.cur.t - 1]?.[bare[0]] == null
      ) {
        state.cur.t--;
      }
      state.cur.s = bare[0];
      state.overflowed = false;
      // ponytail: "MB 6" binds now - a buffered trailing value would spill past tooth end
      const bv = toNum(toks[bare[1]]);
      if (bv != null && bv >= 0 && bv <= 12) {
        patchDepth(state, state.cur.t, bare[0], bv);
        state.last = [bv];
        i = bare[1];
        continue;
      }
      i = bare[1] - 1;
      continue;
    }
    if (w === 'make') {
      const hadPending = nums.length > 0;
      flush(); // "make that 5" / "make the mesial a 5"
      let j = skipFiller(toks, i + 1);
      if (toks[j] === 'that') j++;
      j = skipFiller(toks, j);
      const site = toSite(toks, j, state.aspect);
      let k = site ? site[1] : j;
      k = skipFiller(toks, k);
      const tgt = site ? { t: condTooth(state, hadPending), s: site[0] } : lastDepth(state);
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
      const hadPending = nums.length > 0;
      flush(); // "correction, 5 on mesial" (site optional -> last depth)
      const j = skipFiller(toks, i + 1);
      const site = toSite(toks, j + 1, state.aspect);
      const k = site ? site[1] : j + 1;
      const tgt = site ? { t: condTooth(state, hadPending), s: site[0] } : lastDepth(state);
      if (tgt && patchDepth(state, tgt.t, tgt.s, toNum(toks[j]))) i = k - 1;
      continue;
    }
    if (w === 'recession') {
      const hadPending = nums.length > 0;
      flush(); // "recession 2mm at mid-buccal" / "recession 3mm buccal" (whole row)
      const t = condTooth(state, hadPending);
      let j = skipFiller(toks, i + 1);
      const v = toNum(toks[j]);
      if (v == null || v > 12) continue;
      j++;
      if (toks[j] === 'millimeter' || toks[j] === 'millimeters') j++;
      j = skipFiller(toks, j);
      if (toks[j] in ROWS) {
        for (const s of ROWS[toks[j]]) storeRec(state, t, s, v);
        i = j;
      } else {
        const site = toSite(toks, j, state.aspect);
        const s = site ? site[0] : recTarget(state);
        storeRec(state, t, s, v);
        i = (site ? site[1] : j) - 1;
      }
      continue;
    }
    if (w === 'overgrowth' || w === 'hyperplasia') {
      // ponytail: negative GM needs signed margins + CAL - consume quietly, say so once
      let j = skipFiller(toks, i + 1);
      if (toNum(toks[j]) != null) j++;
      if (toks[j] === 'millimeter' || toks[j] === 'millimeters') j++;
      i = j - 1;
      hint ??= 'gingival overgrowth noted but GM is not charted yet';
      continue;
    }
    if (w === 'class') {
      // ponytail: grades are never depths - "class two furcation on buccal" owned here, Miller-style just consumed
      const hadPending = nums.length > 0;
      flush();
      const j = skipFiller(toks, i + 1);
      const v = toNum(toks[j]);
      if (v == null) continue;
      const fwd = toks.slice(j + 1, j + 4);
      const fi = fwd.findIndex(isFurc);
      if (fi >= 0) {
        let k = j + 1 + fi + 1;
        k = skipFiller(toks, k);
        if (toks[k] === 'on' || toks[k] === 'at') k = skipFiller(toks, k + 1);
        const side = SIDEWORDS.has(toks[k]) ? toks[k] : null;
        if (v >= 1 && v <= 3) {
          const t = condTooth(state, hadPending);
          state.fur[t] = { grade: v, side };
          stored = true;
        }
        i = (side ? k + 1 : j + 1) - 1;
        continue;
      }
      i = j;
      continue;
    }
    if (isFurc(w)) {
      const hadPending = nums.length > 0;
      flush(); // "furcation class one on buccal" (or "vocation ...")
      const t = condTooth(state, hadPending);
      let j = skipFiller(toks, i + 1);
      if (toks[j] === 'class') j = skipFiller(toks, j + 1);
      const v = toNum(toks[j]);
      if (v == null || v < 1 || v > 3) { hint ??= 'furcation grade not heard'; continue; }
      let k = skipFiller(toks, j + 1);
      if (toks[k] === 'on' || toks[k] === 'at') k = skipFiller(toks, k + 1);
      const side = toks[k] in ROWS || (toks[k] && toks[k] in SITES) ||
        toks[k] === 'mesial' || toks[k] === 'distal' ? toks[k] : null;
      state.fur[t] = { grade: v, side };
      stored = true;
      i = (side ? k + 1 : j + 1) - 1;
      continue;
    }
    if (w === 'mobility') {
      // ponytail: per-tooth grade - "mobility two" sets it, adjectives map ("slight" -> 1)
      const hadPending = nums.length > 0;
      const j = skipFiller(toks, i + 1);
      const v = toNum(toks[j]) ?? MOB_ADJ[toks[i - 1]];
      if (v != null && v <= 3) {
        state.mob[condTooth(state, hadPending)] = v;
        stored = true;
        if (toNum(toks[j]) != null) i = j;
      } else hint ??= 'mobility mentioned but no grade heard';
      continue;
    }
    if (w === 'suppuration' || w === 'pus') {
      const hadPending = nums.length > 0;
      flush();
      const t = condTooth(state, hadPending);
      // ponytail: lgraph hears "furcation" as "suppuration" ("suppuration class two") -
      // suppuration never takes a grade, plain depths ("suppuration noted, 2 3 4") pass through
      let j = skipFiller(toks, i + 1);
      if (toks[j] === 'class') {
        const kk = skipFiller(toks, j + 1);
        const g = toNum(toks[kk]);
        if (g >= 1 && g <= 3) {
          let m = skipFiller(toks, kk + 1);
          if (toks[m] === 'on' || toks[m] === 'at') m = skipFiller(toks, m + 1);
          const side = SIDEWORDS.has(toks[m]) ? toks[m] : null;
          state.fur[t] = { grade: g, side };
          stored = true;
          i = (side ? m + 1 : kk + 1) - 1;
          continue;
        }
      }
      const site = toSite(toks, i + 1, state.aspect);
      const first = site ? site[0] : Math.max(0, state.cur.s - 1);
      state.sup[t][first] = true;
      state.hist.push({ t, s: first, kind: 'sup' });
      let k = site ? site[1] : i + 1;
      for (;;) {
        const kk = skipFiller(toks, k);
        if (toks[kk] !== 'and') break;
        const s2 = toSite(toks, kk + 1, state.aspect);
        if (!s2) break;
        state.sup[t][s2[0]] = true;
        state.hist.push({ t, s: s2[0], kind: 'sup' });
        k = s2[1];
      }
      i = k - 1;
      continue;
    }
    if (w === 'repeat') { flush(); nums = [...state.last]; continue; }
    if (w === 'jump' || w === 'go') {
      flush();
      const r = resolveTooth(toks, i + 1);
      if (r) {
        state.cur = { t: r[0], s: 0 };
        state.overflowed = false;
        i = r[1] - 1;
        let j = i + 1;
        while (SITE_FILLER.has(toks[j])) j++;
        if (toks[j] in ROWS) { state.cur.s = ROWS[toks[j]][0]; i = j; continue; }
        const site = toSite(toks, i + 1, state.aspect); // "jump 12 MB"
        if (site) { state.cur.s = site[0]; i = site[1] - 1; }
      }
      continue;
    }
    if (w === 'tooth' || w === 'teeth' || w === 'number') {
      flush();
      const r = resolveTooth(toks, i + 1); // never a depth, even bare ("tooth 12")
      if (!r) continue;
      let n = r[0];
      let k = r[1];
      // ponytail: "(FDI)" converts near the number, else Universal stands
      if (toks.slice(Math.max(0, i - 2), k + 2).includes('fdi')) {
        const u = fdiToUni(n);
        if (u) n = u;
      }
      const listed = [n];
      // ponytail: "teeth 1 through 8" lands on the first, end consumed silently
      {
        const kk = skipFiller(toks, k);
        if (toks[kk] === 'through' || toks[kk] === 'thru') {
          const e = toNum(toks[kk + 1]);
          if (e >= 1 && e <= 32) k = kk + 2;
        }
      }
      // ponytail: "17, 18 and 32" is tentative - kept only with a list terminator, else rewinds to depths
      {
        let kk = k;
        const tmp = [];
        for (;;) {
          const j2 = skipFiller(toks, kk);
          if (toks[j2] === 'and') { kk = j2 + 1; continue; }
          const m = toNum(toks[j2]);
          if (m >= 1 && m <= 32) { tmp.push(m); kk = j2 + 1; continue; }
          break;
        }
        const tk = skipFiller(toks, kk);
        if (tmp.length && ['missing', 'implant', 'present', 'mobility', 'are', 'is'].includes(toks[tk])) {
          listed.push(...tmp);
          k = kk;
        }
      }
      state.cur = { t: n, s: 0 };
      state.overflowed = false;
      state.aspect = 'facial';
      state.aspectSet = false;
      k = skipFiller(toks, k); // "tooth 5 is missing" / "are missing"
      if (toks[k] === 'missing' || toks[k] === 'implant' || toks[k] === 'present') {
        markAbsent(state, listed, toks[k]);
        i = k;
        // ponytail: land, don't skip - implants carry charting; sequential flow skips via advance/next
      } else i = k - 1;
      continue;
    }
    if (w === 'all') {
      // ponytail: bulk status ("all wisdom teeth missing") - no status word, no consume
      let j = skipFiller(toks, i + 1);
      let ids = null;
      if (toks[j] === 'teeth') {
        ids = TOOTH_GROUPS.upper.concat(TOOTH_GROUPS.lower);
        j++;
      } else if (toks[j] in TOOTH_GROUPS && toks[j + 1] === 'teeth') {
        ids = TOOTH_GROUPS[toks[j]];
        j += 2;
      }
      if (ids) {
        const k = skipFiller(toks, j);
        if (toks[k] === 'missing' || toks[k] === 'implant' || toks[k] === 'present') {
          flush();
          markAbsent(state, ids, toks[k]);
          i = k;
          continue;
        }
      }
      continue; // bare "all" ("all buccal 2-2-2") - nothing to do, rest flows normally
    }
    if (w === 'missing' || w === 'implant') {
      flush();
      state.hist.push({ t: state.cur.t, s: 0, kind: 'absent', prev: state.absent[state.cur.t] ?? null });
      state.absent[state.cur.t] = w.toUpperCase();
      continue;
    }
    if (w === 'upper' || w === 'lower') {
      // ponytail: quadrant words only navigate with a number or tooth name after them - headers ignored
      const j = skipFiller(toks, i + 1);
      if (toks[j] !== 'left' && toks[j] !== 'right') continue;
      const quad = w[0] + toks[j][0]; // ur | ul | ll | lr
      const k = skipFiller(toks, j + 1);
      const p = toNum(toks[k]);
      if (p >= 1 && p <= 8) {
        const u = palmerToUni(quad, p); // "upper left 6" -> 14
      if (u) {
        flush();
        state.cur = { t: u, s: 0 };
        state.overflowed = false;
          state.aspect = 'facial';
          state.aspectSet = false;
          i = k;
        }
        continue;
      }
      const ord = ORDINALS[toks[k]];
      let kk = ord != null ? k + 1 : k;
      let type = toks[kk] in TOOTH_TYPES ? toks[kk] : null;
      if (type) kk++;
      else if (toks[kk] === 'wisdom' || (ord === 3 && toks[kk] === 'tooth')) { type = 'molar'; kk++; }
      // ponytail: central/lateral/canine occur once per quadrant - premolar/molar need their ordinal
      const needsOrd = type === 'premolar' || type === 'bicuspid' || type === 'molar';
      const u = type && (ord != null || !needsOrd) ? quadToothToUni(quad, ord ?? 1, type) : null;
      if (u) { // "upper right first molar" -> 3
        flush();
        state.cur = { t: u, s: 0 };
        state.overflowed = false;
        state.aspect = 'facial';
        state.aspectSet = false;
        i = kk - 1;
      }
      continue;
    }
    if (w === 'next') { flush(); state.cur = { t: Math.min(32, state.cur.t + 1), s: 0 }; state.overflowed = false; skipAbsent(state); continue; }
    if (w === 'back') { flush(); state.cur = { t: Math.max(1, state.cur.t - 1), s: 0 }; state.overflowed = false; continue; }
    if (w === 'skip' || w === 'miss') { flush(); advance(state, 6 - (state.cur.s % 6) || 6); continue; }
    if (w === 'bleeding' || w === 'blood' || w === 'bop' || w === 'bleed' || w === 'drop') {
      const hadPending = nums.length > 0;
      flush();
      const t = condTooth(state, hadPending);
      // ponytail: scope words first ("bleeding on buccal" = whole row, "bleeding all" = all six)
      let j = i + 1;
      while (SITE_FILLER.has(toks[j])) j++;
      const flag = (s) => {
        state.bleed[t][s] = true;
        state.hist.push({ t, s, kind: 'bleed' });
      };
      if (ALLWORDS.has(toks[j])) {
        for (let s = 0; s < 6; s++) flag(s);
        i = j;
        continue;
      }
      // ponytail: "buccal" always names the row; facial/lingual name a row only trailing
      // a finished tooth, else the mid site (chairside F/L descriptors)
      if (toks[j] === 'buccal' || ((toks[j] === 'facial' || toks[j] === 'lingual') && t !== state.cur.t)) {
        for (const s of ROWS[toks[j]]) flag(s);
        for (;;) {
          // ponytail: chained rows ("buccal and lingual") - single sites fall through to bare navigation
          const kk = skipFiller(toks, j + 1);
          if (toks[kk] !== 'and') break;
          const k2 = skipFiller(toks, kk + 1);
          if (!(toks[k2] in ROWS)) break;
          for (const s of ROWS[toks[k2]]) flag(s);
          j = k2;
        }
        i = j;
        continue;
      }
      if (toks[i - 1] === 'some' || toks[i - 1] === 'any') hint ??= 'bleeding site unspecified - verify';
      const site = toSite(toks, i + 1, state.aspect); // "bleeding MB", "bleeding at mesiobuccal"
      if (site) {
        // ponytail: flag in place, cursor stays - bare site words navigate, conditions don't
        flag(site[0]);
        i = site[1] - 1;
      } else {
        flag(Math.max(0, state.cur.s - 1));
      }
      continue;
    }
    if (w === 'clear' || w === 'scratch') {
      flush();
      const own = state.hist.length > mark;
      restore(state, state.hist.pop());
      state.overflowed = false;
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
      if (earliest) { state.cur = { t: earliest.t, s: earliest.s }; state.overflowed = false; }
      continue;
    }
  }
  flush();
  const added = state.hist.length - mark;
  if (added > 0) state.groups.push(added);
  // ponytail: non-empty input that changed nothing is either navigation (cur moved) or prose
  if (
    added <= 0 &&
    !stored &&
    `${state.cur.t}:${state.cur.s}` === cur0 &&
    `${state.aspect}${state.aspectSet}${Object.keys(state.absent).length}` === ctx0 &&
    !negated
  ) {
    hint ??= 'no clinical data found';
  }
  return { ms: performance.now() - t0, hint };
}
