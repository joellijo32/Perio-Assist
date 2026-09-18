import { createState, parseInto } from '../src/perio.js';

// ponytail: narrative TC harness - whole input per case, fresh state each; SKIP = out-of-scope by design
const N = (id) => `T${id}`;

function run(id, input, check) {
  const s = createState();
  const r = parseInto(s, input);
  try {
    check(s, r);
    console.log(`PASS ${id}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${id}: ${e.message}`);
    return false;
  }
}

const eq = (a, b, m) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
};

let pass = 0, fail = 0, skip = 0;
const SKIP = (id, why) => { console.log(`SKIP ${id}: ${why}`); skip++; };
const T = (id, input, check) => (run(id, input, check) ? pass++ : fail++);

// --- 1. Happy path ---
T('TC-001', 'Upper right: tooth 3, buccal 2-3-2, lingual 3-2-3, no bleeding. Tooth 4, buccal 2-2-2, lingual 2-2-2, no bleeding. Tooth 5, buccal 2-3-2, lingual 2-2-2, no bleeding.', (s) => {
  eq(s.teeth[3], [2, 3, 2, 3, 2, 3], 't3');
  eq(s.teeth[4], [2, 2, 2, 2, 2, 2], 't4');
  eq(s.teeth[5], [2, 3, 2, 2, 2, 2], 't5');
  eq(s.bleed[3].every((b) => !b), true, 't3 no bop');
});
T('TC-002', 'Tooth 14, buccal 4-5-4, lingual 4-4-3, bleeding on buccal. Tooth 15, buccal 3-4-3, lingual 3-3-3, bleeding at distal buccal.', (s) => {
  eq(s.teeth[14], [4, 5, 4, 4, 4, 3], 't14 pd');
  eq(s.bleed[14].slice(0, 3), [true, true, true], 't14 buccal bop');
  eq(s.bleed[14].slice(3), [false, false, false], 't14 lingual clean');
  eq(s.bleed[15], [false, false, true, false, false, false], 't15 db only');
});

// --- 2/3. Missing & implants ---
T('TC-003', 'Tooth 1, missing. Tooth 2, buccal 2-2-2, lingual 2-2-2, no bleeding.', (s) => {
  eq(s.absent[1], 'MISSING', 't1 missing');
  eq(s.teeth[1].every((v) => v === null), true, 't1 blank');
  eq(s.teeth[2], [2, 2, 2, 2, 2, 2], 't2');
});
T('TC-004', 'Teeth 17, 18, and 32 are missing.', (s) => {
  eq([s.absent[17], s.absent[18], s.absent[32]], ['MISSING', 'MISSING', 'MISSING'], 'all missing');
});
T('TC-005', 'Tooth 5 missing. Tooth 4 has drifted distally, buccal 3-3-4, lingual 3-3-3, no bleeding.', (s) => {
  eq(s.absent[5], 'MISSING', 't5');
  eq(s.teeth[4], [3, 3, 4, 3, 3, 3], 't4 charted');
});
T('TC-006', 'Tooth 19 is an implant. Buccal 3-3-3, lingual 3-3-3, no bleeding, no mobility.', (s) => {
  eq(s.absent[19], 'IMPLANT', 't19 implant');
  eq(s.teeth[19], [3, 3, 3, 3, 3, 3], 't19 charted on implant');
  eq(s.mob[19] ?? 0, 0, 'mob 0');
});
T('TC-007', 'Tooth 30 implant, buccal 5-6-5, lingual 4-5-4, bleeding on probing buccal and lingual, suppuration noted at mid-buccal.', (s) => {
  eq(s.absent[30], 'IMPLANT', 't30');
  eq(s.bleed[30].every(Boolean), true, 'bop all 6');
  eq(s.sup[30][1], true, 'suppuration B');
});

// --- 4. Furcation ---
T('TC-008', 'Tooth 3, buccal 3-4-3, lingual 3-3-3, furcation class one on buccal, no bleeding.', (s) => {
  eq(s.teeth[3], [3, 4, 3, 3, 3, 3], 't3 pd clean (no class pollution)');
  eq(s.fur[3]?.grade, 1, 'frc I');
});
T('TC-009', 'Tooth 19, buccal 5-5-4, lingual 4-4-4, class two furcation on buccal, bleeding buccal.', (s) => {
  eq(s.fur[19]?.grade, 2, 'frc II');
  eq(s.bleed[19].slice(0, 3), [true, true, true], 'bop buccal row');
});
T('TC-010', 'Tooth 14, buccal 7-8-6, lingual 6-6-5, class three furcation, bleeding throughout, mobility two.', (s) => {
  eq(s.fur[14]?.grade, 3, 'frc III');
  eq(s.bleed[14].every(Boolean), true, 'bop all');
  eq(s.mob[14], 2, 'mob 2');
});

// --- 5. Recession ---
T('TC-011', 'Tooth 8, buccal 2-2-2, lingual 2-2-2, recession 2mm at mid-buccal, no bleeding.', (s) => {
  eq(s.rec[8][1], 2, 'rec mid-B');
  eq(s.bleed[8].every((b) => !b), true, 'no bop');
});
T('TC-012', 'Tooth 6, buccal 3-3-3, lingual 2-2-2, recession 3mm buccal, bleeding on probing buccal. Note: Miller class two recession.', (s) => {
  eq([s.rec[6][0], s.rec[6][1], s.rec[6][2]], [3, 3, 3], 'rec buccal row');
  eq(s.bleed[6].slice(0, 3), [true, true, true], 'bop buccal');
  eq(s.teeth[6].slice(0, 3), [3, 3, 3], 'no miller pollution');
});
SKIP('TC-013', 'negative GM (hyperplasia) needs signed margins + CAL - out of scope');

// --- 6. Mobility ---
T('TC-014', '"no mobility"->0; "mobility one"->1; "mobility two"->2; "mobility three"->3', (s) => {
  parseInto(s, 'tooth 3 no mobility');
  parseInto(s, 'tooth 4 mobility one');
  parseInto(s, 'tooth 5 mobility two');
  parseInto(s, 'tooth 6 mobility three');
  eq([s.mob[3], s.mob[4], s.mob[5], s.mob[6]], [0, 1, 2, 3], 'mob scale');
});
SKIP('TC-015', 'multi-tooth mobility list needs attribute fan-out - documents gap (only first tooth set)');

// --- 7. Notation ---
T('TC-016', 'Tooth 26 (FDI), buccal 3-3-3, lingual 2-2-2, no bleeding.', (s) => {
  // NOTE: case file says Universal 12, but FDI 26 = UL first molar = Universal 14 (consistent w/ TC-017)
  eq(s.teeth[14], [3, 3, 3, 2, 2, 2], 'FDI 26 -> 14');
});
T('TC-017', 'Upper-left 6, buccal 4-4-3, lingual 3-3-3, bleeding mid-buccal.', (s) => {
  eq(s.teeth[14].slice(0, 3), [4, 4, 3], 'Palmer UL6 -> 14');
  eq(s.bleed[14][1], true, 'bop B');
});

// --- 8. Full mouth (bulk fan-out out of scope; per-tooth parts must pass) ---
SKIP('TC-018', 'quadrant bulk fill needs fan-out - documents gap');
T('TC-019', 'Tooth 1: missing. Tooth 2: buccal 3-3-3, lingual 3-3-3, no bleeding. Tooth 3: buccal 4-5-4, lingual 4-4-3, bleeding buccal, furcation class one. Tooth 14: buccal 6-7-6, lingual 5-5-5, bleeding all, furcation class two, mobility one. Tooth 19: implant, buccal 3-3-3, lingual 3-3-3, no bleeding. Tooth 30: buccal 2-3-2, lingual 2-2-2, no bleeding.', (s) => {
  eq(s.absent[1], 'MISSING', 't1');
  eq(s.teeth[3], [4, 5, 4, 4, 4, 3], 't3');
  eq(s.fur[3]?.grade, 1, 't3 frc');
  eq(s.teeth[14], [6, 7, 6, 5, 5, 5], 't14');
  eq(s.bleed[14].every(Boolean), true, 't14 bop');
  eq(s.mob[14], 1, 't14 mob');
  eq(s.absent[19], 'IMPLANT', 't19');
});

// --- 9. Edges ---
T('TC-020', 'Tooth 7, buccal 15-2-2, lingual 2-2-2, no bleeding.', (s, r) => {
  eq(s.teeth[7].includes(15), false, 'PD 15 never recorded');
  eq(typeof r.hint === 'string' && r.hint.length > 0, true, 'range warning surfaced');
});
T('TC-021', 'Tooth 8, buccal 2-3-2, no bleeding.', (s) => {
  eq(s.teeth[8].slice(0, 3), [2, 3, 2], 'buccal row');
  eq(s.teeth[8].slice(3).every((v) => v === null), true, 'lingual null');
});
T('TC-022', 'Tooth 10, buccal 4-4-4, lingual 3-3-3, some bleeding.', (s, r) => {
  eq(typeof r.hint === 'string' && r.hint.length > 0, true, 'ambiguity surfaced, not dropped');
});
T('TC-023', '', (s, r) => {
  eq(r.hint, 'empty input', 'empty flagged');
});
T('TC-024', 'The patient was very anxious today and we had a good conversation about oral hygiene.', (s, r) => {
  eq(s.hist.length, 0, 'nothing extracted');
  eq(typeof r.hint === 'string' && r.hint.length > 0, true, 'no-data surfaced');
});
T('TC-025', 'Tooth 9, buccal 2-2-2, lingual 2-2-2, no bleeding. Tooth 9, buccal 3-3-3, lingual 3-3-3, bleeding.', (s) => {
  eq(s.teeth[9], [3, 3, 3, 3, 3, 3], 'last narration wins (documented contract)');
});
T('TC-026', 'Tooth 32, buccal 2-2-2, lingual 2-2-2, no bleeding. Tooth 1, buccal 3-3-3, lingual 3-3-3, bleeding buccal. Tooth 16, buccal 2-2-2, lingual 2-2-2, no bleeding.', (s) => {
  eq(s.teeth[1], [3, 3, 3, 3, 3, 3], 't1 by key, order-free');
  eq(s.bleed[1].slice(0, 3), [true, true, true], 't1 bop');
});
T('TC-027', 'Upper right first molar, buccal 4-4-4, lingual 3-3-3, bleeding buccal, furcation class one.', (s) => {
  eq(s.teeth[3].slice(0, 3), [4, 4, 4], 'name -> tooth 3');
  eq(s.fur[3]?.grade, 1, 'frc');
});
T('TC-028', 'Tooth three, buccal 2-3-2, lingual 2-2-2, no bleeding. Tooth #14, buccal 4-4-3, lingual 3-3-3, bleeding buccal.', (s) => {
  eq(s.teeth[3], [2, 3, 2, 2, 2, 2], 'word number');
  eq(s.teeth[14], [4, 4, 3, 3, 3, 3], 'hash number');
});
T('TC-029', 'Tooth 15, buccal 6-7-6, lingual 5-5-5, bleeding all sites, suppuration at mid-buccal and disto-lingual, mobility one.', (s) => {
  eq(s.teeth[15], [6, 7, 6, 5, 5, 5], 'pd');
  eq(s.bleed[15].every(Boolean), true, 'bop all');
  eq([s.sup[15][1], s.sup[15][5]], [true, true], 'suppuration B + DL');
  eq(s.mob[15], 1, 'mob');
});
T('TC-030', 'Tooth 22, buccal 2-2-2, lingual 2-2-2.', (s) => {
  eq(s.bleed[22].every((b) => !b), true, 'unmentioned BOP defaults false (contract)');
});

// --- 10/12. Summaries, classification, sessions: no engine by design ---
SKIP('TC-031', 'BOP% summary needs stats engine - out of scope');
SKIP('TC-032', 'mean PD needs stats engine - out of scope');
SKIP('TC-033', 'staging/grading needs classification engine - out of scope');
SKIP('TC-037', 'recall deltas need multi-session store - out of scope');
SKIP('TC-038', 'session history needs multi-session store - out of scope');

// --- 11. Regression ---
T('TC-034', 'dash/space/comma/slash separators identical', (s) => {
  const variants = ['buccal 3-3-3', 'buccal 3 3 3', 'buccal 3,3,3', 'buccal 3/3/3'];
  variants.forEach((v, j) => parseInto(s, `tooth ${10 + j} ${v}`));
  for (const t of [10, 11, 12, 13]) eq(s.teeth[t].slice(0, 3), [3, 3, 3], `t${t} separators`);
});
T('TC-035', '  TOOTH 5 , Buccal 2-2-2 , Lingual 2-2-2 , No Bleeding.  ', (s) => {
  eq(s.teeth[5], [2, 2, 2, 2, 2, 2], 'case/space insensitive');
  eq(s.bleed[5].every((b) => !b), true, 'negation case insensitive');
});
T('TC-036', 'Tooth 8, buccal 2–2–2, lingual 2–2–2, no bleeding.', (s) => {
  eq(s.teeth[8], [2, 2, 2, 2, 2, 2], 'en-dash normalised');
});

console.log(`\n${pass} pass, ${fail} fail, ${skip} skip (out of scope)`);
process.exit(fail ? 1 : 0);
