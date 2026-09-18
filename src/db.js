// ponytail: localStorage ceiling ~5MB (~2000 charts); upgrade to IndexedDB when multi-visit history matters
const KEY = 'perio.patients.v1';
const CHART_KEYS = ['teeth', 'bleed', 'rec', 'sup', 'plaque', 'mob', 'fur', 'absent'];

const mem = (globalThis.__perio_mem ??= {});
function backend() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch { /* private mode */ }
  return {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
}

export function loadAll() {
  try {
    const raw = backend().getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function saveAll(list) {
  try {
    backend().setItem(KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

export function search(list, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((p) => p.name.toLowerCase().includes(needle));
}

export function upsert(list, name, chart) {
  const clean = name.trim();
  const key = clean.toLowerCase();
  const now = Date.now();
  const i = list.findIndex((p) => p.name.toLowerCase() === key);
  if (i >= 0) {
    list[i] = { ...list[i], chart, updatedAt: now };
    return list[i];
  }
  const rec = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), name: clean, updatedAt: now, chart };
  list.push(rec);
  return rec;
}

export function remove(list, id) {
  const i = list.findIndex((p) => p.id === id);
  if (i >= 0) list.splice(i, 1);
}

export function snapshot(store) {
  return JSON.parse(JSON.stringify(Object.fromEntries(CHART_KEYS.map((k) => [k, store[k]]))));
}

export function restore(store, chart) {
  for (const k of CHART_KEYS) store[k] = JSON.parse(JSON.stringify(chart[k]));
}
