<script>
  import { onDestroy } from 'svelte';
  import { commit, previewPartial, resetAll, say, SITENAMES, store } from './chart.svelte.js';
  import { createRecognizer } from './recognizer.js';
  import PerioChart from './PerioChart.svelte';

  let engine = $state('vosk');
  let draft = $state('');

  const teethDone = $derived(
    Object.values(store.teeth).filter((sites) => sites.some((v) => v !== null)).length,
  );

  // ponytail: summary stats are pure derivations - no stats engine until one is needed
  const bop = $derived.by(() => {
    let hit = 0,
      total = 0;
    for (const t of Object.keys(store.teeth)) {
      if (store.absent[t]) continue;
      for (let s = 0; s < 6; s++) {
        if (store.teeth[t][s] == null) continue;
        total++;
        if (store.bleed[t][s]) hit++;
      }
    }
    return { hit, total, pct: total ? Math.round((100 * hit) / total) : 0 };
  });

  const pi = $derived.by(() => {
    let hit = 0,
      total = 0;
    for (const t of Object.keys(store.teeth)) {
      if (store.absent[t]) continue;
      for (let s = 0; s < 6; s++) {
        if (store.teeth[t][s] == null) continue;
        total++;
        if (store.plaque[t][s]) hit++;
      }
    }
    return { hit, total, pct: total ? Math.round((100 * hit) / total) : 0 };
  });

  const maxPD = $derived.by(() => {
    let m = 0;
    for (const t of Object.keys(store.teeth)) {
      if (store.absent[t]) continue;
      for (const v of store.teeth[t]) if (v != null && v > m) m = v;
    }
    return m;
  });

  const recognizer = createRecognizer({
    onPartial: (text) => { say(text, false); previewPartial(text); },
    onFinal: (text) => commit(text),
    onStatus: (text) => (store.status = text),
    onStop: (text) => {
      store.listening = false;
      store.status = text;
    },
  });

  async function toggle() {
    if (store.listening) {
      recognizer.stop();
      store.listening = false;
      store.status = 'Stopped.';
      return;
    }
    store.listening = await recognizer.start(engine);
  }

  function submitDraft() {
    if (!draft.trim()) return;
    commit(draft.trim());
    draft = '';
  }

  onDestroy(() => recognizer.stop());
</script>

<main>
  <h1>Voice Perio</h1>
  <div class="controls">
    <button onclick={toggle}>{store.listening ? 'Stop' : 'Start'}</button>
    Vosk on-device
    <button onclick={resetAll} disabled={store.listening}>Reset</button>
    <span>{store.status}</span>
  </div>
  <div class="meta">
    <span>Tooth {store.cur.t} · {SITENAMES[store.cur.s]} ({store.cur.s + 1}/6)</span>
    <span>{teethDone}/32 teeth</span>
    <span>BOP {bop.pct}% ({bop.hit}/{bop.total})</span>
    <span>PI {pi.pct}% ({pi.hit}/{pi.total})</span>
    <span>max PD {maxPD}</span>
    {#if store.latencyMs !== null}<span>{store.latencyMs.toFixed(0)}ms parse+render</span>{/if}
  </div>

  <div class="legend">MB mesiobuccal · B buccal · DB distobuccal · ML mesiolingual · L lingual · DL distolingual · red dot = bleeding · yellow dot = suppuration · blue dot = plaque · * = missing/implant · M = mobility · F = furcation · click a cell to move the cursor</div>
  <PerioChart />

  <input
    bind:value={draft}
    onkeydown={(e) => e.key === 'Enter' && submitDraft()}
    placeholder='type e.g. "3 2 3 bleeding repeat jump 24" + Enter'
  />
  <div id="tx">
    {#each store.transcript as line (line.id)}
      <div class:i={!line.final}>{line.text}</div>
    {/each}
  </div>
</main>

<style>
  main { font-family: system-ui; margin: 16px; max-width: 1200px; }
  button, select { padding: 8px 12px; }
  .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .meta { display: flex; gap: 16px; margin: 8px 0; flex-wrap: wrap; }
  input { width: 100%; padding: 8px; box-sizing: border-box; }
  #tx { border: 1px solid #ddd; min-height: 60px; padding: 8px; margin-top: 8px; }
  .i { opacity: 0.5; font-style: italic; }
</style>
