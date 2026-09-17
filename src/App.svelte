<script>
  import { onDestroy } from 'svelte';
  import { commit, resetAll, say, SITENAMES, store } from './chart.svelte.js';
  import { createRecognizer } from './recognizer.js';

  let engine = $state('web');
  let draft = $state('');

  const teethDone = $derived(
    Object.values(store.teeth).filter((sites) => sites.some((v) => v !== null)).length,
  );

  const recognizer = createRecognizer({
    onPartial: (text) => say(text, false),
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

  function cellClass(v, bled, rec) {
    return `s${v >= 6 ? ' g6' : v >= 4 ? ' g4' : ''}${bled ? ' bleed' : ''}${rec > 0 ? ' rc' : ''}`;
  }

  onDestroy(() => recognizer.stop());
</script>

<main>
  <h1>Voice Perio</h1>
  <div class="controls">
    <button onclick={toggle}>{store.listening ? 'Stop' : 'Start'}</button>
    <select bind:value={engine} disabled={store.listening}>
      <option value="web">Web Speech (cloud)</option>
      <option value="vosk">Vosk on-device</option>
    </select>
    <button onclick={resetAll} disabled={store.listening}>Reset</button>
    <span>{store.status}</span>
  </div>
  <div class="meta">
    <span>Tooth {store.cur.t} · {SITENAMES[store.cur.s]} ({store.cur.s + 1}/6)</span>
    <span>{teethDone}/32 teeth</span>
    {#if store.latencyMs !== null}<span>{store.latencyMs.toFixed(0)}ms parse+render</span>{/if}
  </div>

  <div class="legend">MB mesiobuccal · B buccal · DB distobuccal · ML mesiolingual · L lingual · DL distolingual · dotted top = recession · * = missing/implant</div>
  <div id="grid">
    {#each Object.entries(store.teeth) as [t, sites] (t)}
      <div class="t" class:cur={+t === store.cur.t} class:miss={!!store.absent[t]}>
        <b>{t}{store.absent[t] ? '*' : ''}</b><br />
        {#each sites as v, s (s)}
          <span
            class={cellClass(v, store.bleed[t][s], store.rec[t][s])}
            title={`${t} ${SITENAMES[s]}${store.rec[t][s] ? `, rec ${store.rec[t][s]}` : ''}`}
          >{v ?? '.'}</span>
        {/each}
      </div>
    {/each}
  </div>

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
  .meta { display: flex; gap: 16px; margin: 8px 0; }
  #grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin: 12px 0; }
  .t { border: 1px solid #ccc; padding: 4px; font-size: 12px; }
  .t.cur { outline: 2px solid blue; }
  .s { display: inline-block; width: 18px; text-align: center; margin: 1px; background: #eee; }
  .s.bleed { border-bottom: 3px solid red; }
  .s.rc { border-top: 2px dotted #1976d2; }
  .t.miss { opacity: 0.45; }
  .g4 { background: #ffeb3b; }
  .g6 { background: #ef9a9a; }
  input { width: 100%; padding: 8px; box-sizing: border-box; }
  #tx { border: 1px solid #ddd; min-height: 60px; padding: 8px; margin-top: 8px; }
  .i { opacity: 0.5; font-style: italic; }
</style>
