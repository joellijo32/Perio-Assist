// ponytail: spoken action summaries - pure mapping, unit-tested here, voiced by the App
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

/** Short spoken summary of a parse result, or null when silence is better. */
export function feedbackText(r) {
  if (!r || r.stop) return null;
  if (r.undone) return 'undone';
  const kinds = [...new Set(r.kinds ?? [])].filter((k) => KIND_PHRASE[k]);
  if (!kinds.length) return null;
  return kinds.slice(0, 2).map((k) => KIND_PHRASE[k]).join(', ');
}
