// ponytail: Blob+anchor covers single-file export; upgrade to File System Access / StreamSaver when reports exceed ~50MB
import { SITENAMES } from './perio.js';

export function reportFilename(name, date = new Date()) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unsaved';
  return `perio-${slug}-${date.toISOString().slice(0, 10)}.json`;
}

export function buildReport({ name, chart, id = null, updatedAt = null, exportedAt = new Date().toISOString() }) {
  const cal = {};
  const perTooth = {};
  const missing = [];
  const implants = [];
  const bleedingSites = [];
  const suppurationSites = [];
  const plaqueSites = [];
  let teethDone = 0;
  let bopHit = 0, bopTotal = 0, piHit = 0, piTotal = 0;
  let maxPD = 0, pdSum = 0, pdN = 0, calSum = 0, calN = 0;
  let sitesGTE4 = 0, sitesGTE6 = 0, sitesProbed = 0;

  for (let t = 1; t <= 32; t++) {
    if (chart.absent[t] === 'MISSING') missing.push(t);
    if (chart.absent[t] === 'IMPLANT') implants.push(t);
    const sites = chart.teeth[t];
    if (sites.some((v) => v !== null)) teethDone++;
    cal[t] = [];
    let toothMax = 0, toothBop = 0;
    for (let s = 0; s < 6; s++) {
      const v = sites[s];
      const gm = chart.rec[t][s] ?? 0;
      const c = v == null ? null : v + gm;
      cal[t].push(c);
      if (chart.absent[t]) continue;
      if (v == null) continue;
      sitesProbed++;
      toothMax = Math.max(toothMax, v);
      maxPD = Math.max(maxPD, v);
      pdSum += v; pdN++;
      if (c != null) { calSum += c; calN++; }
      if (v >= 4) sitesGTE4++;
      if (v >= 6) sitesGTE6++;
      bopTotal++; piTotal++;
      const label = `${t}-${SITENAMES[s]}`;
      if (chart.bleed[t][s]) { bopHit++; toothBop++; bleedingSites.push(label); }
      if (chart.plaque[t][s]) { piHit++; plaqueSites.push(label); }
      if (chart.sup[t][s]) suppurationSites.push(label);
    }
    perTooth[t] = { maxPD: toothMax, bopCount: toothBop };
  }

  return {
    schema: 'perio.report/v1',
    app: 'voice-perio',
    exportedAt,
    patient: { id, name, updatedAt },
    chart: JSON.parse(JSON.stringify(chart)),
    derived: { cal, perTooth },
    summary: {
      teethDone,
      teethPresent: 32 - missing.length,
      missing,
      implants,
      bop: { hit: bopHit, total: bopTotal, pct: bopTotal ? Math.round((100 * bopHit) / bopTotal) : 0 },
      pi: { hit: piHit, total: piTotal, pct: piTotal ? Math.round((100 * piHit) / piTotal) : 0 },
      maxPD,
      meanPD: pdN ? Math.round((pdSum / pdN) * 10) / 10 : 0,
      meanCAL: calN ? Math.round((calSum / calN) * 10) / 10 : 0,
      sitesGTE4,
      sitesGTE6,
      sitesProbed,
      bleedingSites,
      suppurationSites,
      plaqueSites,
      mobility: JSON.parse(JSON.stringify(chart.mob)),
      furcation: JSON.parse(JSON.stringify(chart.fur)),
    },
  };
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
