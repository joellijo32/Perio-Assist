import { createState, parseInto, SITENAMES } from './perio.js';
import { buildReport, downloadJson, reportFilename } from './export.js';

export { SITENAMES };

// ponytail: one shared reactive store - components read it directly, no prop drilling

export const store = $state({
  ...createState(),
  transcript: [],
  status: 'Idle. Pick an engine and press Start.',
  latencyMs: null,
  listening: false,
});

// ponytail: preview holds scratch teeth+bleed from the latest partial result -
//   cleared on commit/stop; no cursor or hist leaks into committed state
export const preview = $state({ teeth: null, bleed: null, cur: null });

let nextId = 1;

// ponytail: live-chart export only - saved-patient lookup lives on feature/client-db, not here
const EXPORT_KEYS = ['teeth', 'bleed', 'rec', 'sup', 'plaque', 'mob', 'fur', 'absent'];

export function exportActiveJson(liveName = '') {
  const chart = JSON.parse(JSON.stringify(Object.fromEntries(EXPORT_KEYS.map((k) => [k, store[k]]))));
  const done = Object.values(chart.teeth).filter((s) => s.some((v) => v !== null)).length;
  if (!done) { store.status = 'Nothing to export — chart first.'; return null; }
  const name = liveName.trim() || 'unsaved';
  const report = buildReport({ name, chart, id: null, updatedAt: null });
  const file = reportFilename(name);
  downloadJson(report, file);
  store.status = `Exported ${file}.`;
  return report;
}

export function say(text, final) {
  store.transcript.unshift({ id: nextId++, text, final });
}

export function previewPartial(text) {
  if (!text) { preview.teeth = null; preview.bleed = null; preview.cur = null; return; }
  // ponytail: JSON clone of the mutable arrays only - hist/groups omitted so clone stays cheap
  const scratch = {
    ...createState(),
    ...JSON.parse(JSON.stringify({
      teeth: store.teeth, bleed: store.bleed, rec: store.rec,
      sup: store.sup, absent: store.absent, mob: store.mob, fur: store.fur,
    })),
    cur: { ...store.cur }, aspect: store.aspect, aspectSet: store.aspectSet,
    overflowed: store.overflowed, last: [...store.last], hist: [], groups: [],
  };
  parseInto(scratch, text);
  preview.teeth = scratch.teeth;
  preview.bleed = scratch.bleed;
  preview.cur = scratch.cur;
}

export function commit(text) {
  preview.teeth = null; preview.bleed = null; preview.cur = null;
  say(text, true);
  const r = parseInto(store, text);
  store.latencyMs = r.ms;
  if (r.hint) store.status = r.hint;
}

// ponytail: click navigation mirrors the parser's explicit navs (cursor + aspect, no stale overflow)
export function moveTo(t, s) {
  store.cur = { t, s };
  store.aspect = s < 3 ? 'facial' : 'lingual';
  store.aspectSet = true;
  store.overflowed = false;
}

export function resetAll() {  const fresh = createState();
  store.teeth = fresh.teeth;
  store.bleed = fresh.bleed;
  store.cur = fresh.cur;
  store.overflowed = fresh.overflowed;
  store.last = fresh.last;
  store.hist = fresh.hist;
  store.groups = fresh.groups;
  store.absent = fresh.absent;
  store.status = 'Idle. Pick an engine and press Start.';
  store.rec = fresh.rec;
  store.sup = fresh.sup;
  store.plaque = fresh.plaque;
  store.mob = fresh.mob;
  store.fur = fresh.fur;
  store.aspect = fresh.aspect;
  store.aspectSet = fresh.aspectSet;
  store.transcript = [];
  store.latencyMs = null;
}
