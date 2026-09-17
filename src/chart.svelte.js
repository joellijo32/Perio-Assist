import { createState, parseInto, SITENAMES } from './perio.js';

export { SITENAMES };

// ponytail: one shared reactive store - components read it directly, no prop drilling

export const store = $state({
  ...createState(),
  transcript: [],
  status: 'Idle. Pick an engine and press Start.',
  latencyMs: null,
  listening: false,
});

let nextId = 1;

export function say(text, final) {
  store.transcript.unshift({ id: nextId++, text, final });
}

export function commit(text) {
  say(text, true);
  const r = parseInto(store, text);
  store.latencyMs = r.ms;
  if (r.hint) store.status = r.hint;
}

export function resetAll() {
  const fresh = createState();
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
  store.mob = fresh.mob;
  store.fur = fresh.fur;
  store.aspect = fresh.aspect;
  store.aspectSet = fresh.aspectSet;
  store.transcript = [];
  store.latencyMs = null;
}
