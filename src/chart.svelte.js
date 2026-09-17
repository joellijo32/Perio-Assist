import { createState, parseInto } from './perio.js';

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
  store.latencyMs = parseInto(store, text);
}

export function resetAll() {
  const fresh = createState();
  store.teeth = fresh.teeth;
  store.bleed = fresh.bleed;
  store.cur = fresh.cur;
  store.last = fresh.last;
  store.hist = fresh.hist;
  store.transcript = [];
  store.latencyMs = null;
}
