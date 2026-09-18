<script>
  import { onDestroy } from 'svelte';
  import { commit, exportActiveJson, previewPartial, resetAll, say, SITENAMES, store } from './chart.svelte.js';
  import { createRecognizer } from './recognizer.js';
  import PerioChart from './PerioChart.svelte';

  let engine = $state('vosk');
  let draft = $state('');
  let name = $state('');
  let showLog = $state(false);

  const teethDone = $derived(
    Object.values(store.teeth).filter((sites) => sites.some((v) => v !== null)).length,
  );

  // ponytail: summary stats are pure derivations - no stats engine until one is needed
  const bop = $derived.by(() => {
    let hit = 0,
      total = 0;
    for (const t of Object.keys(store.teeth)) {
      if (store.absent[t] === 'MISSING') continue;
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
      if (store.absent[t] === 'MISSING') continue;
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
      if (store.absent[t] === 'MISSING') continue;
      for (const v of store.teeth[t]) if (v != null && v > m) m = v;
    }
    return m;
  });

  // ponytail: WebAudio blips, no assets/deps, offline-safe - created on Start click so autoplay policy is met
  let actx = null;
  function tone(freq, delay, dur) {
    const t = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function chime(kind) {
    try {
      actx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      if (kind === 'ready') { tone(660, 0, 0.12); tone(880, 0.12, 0.18); }
      else if (kind === 'stop') { tone(660, 0, 0.12); tone(440, 0.12, 0.18); }
      else if (kind === 'insert') tone(990, 0, 0.09);
      else if (kind === 'undo') tone(330, 0, 0.14);
      else if (kind === 'puzzled') { tone(220, 0, 0.16); tone(196, 0.16, 0.24); }
    } catch { /* audio unavailable - status text still updates */ }
  }
  function commitAndChime(text) {
    const r = commit(text);
    if (r.stop && store.listening) { toggle(); return; } // voice "stop" - toggle chimes itself
    if (r.undone) chime('undo');
    else if (r.added > 0 || r.stored) chime('insert');
    else if (r.hint) chime('puzzled');
  }

  const recognizer = createRecognizer({
    onPartial: (text) => { say(text, false); previewPartial(text); },
    onFinal: (text) => commitAndChime(text),
    onStatus: (text) => (store.status = text),
    onStop: (text) => {
      chime('stop');
      store.listening = false;
      store.status = text;
    },
  });

  async function toggle() {
    if (store.listening) {
      recognizer.stop();
      store.listening = false;
      store.status = 'Stopped.';
      if (engine === 'vosk') chime('stop'); // web fires onStop instead - chimes there
      return;
    }
    store.listening = await recognizer.start(engine);
    if (store.listening) chime('ready');
  }

  function submitDraft() {
    if (!draft.trim()) return;
    commitAndChime(draft.trim());
    draft = '';
  }

  // ponytail: global Space toggles listening - typing and native button activation are left alone
  function handleSpace(e) {
    if (e.code !== 'Space' || e.repeat) return;
    const el = e.target;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable) return;
    if (el instanceof HTMLElement && (el.tagName === 'BUTTON' || el.tagName === 'SELECT' || el.tagName === 'A')) return;
    e.preventDefault();
    toggle();
  }

  onDestroy(() => recognizer.stop());
</script>

<svelte:window onkeydown={handleSpace} />

<div class="page">
  <header class="hero">
    <div class="brand">
        <span class="logo">PerioVoice.</span>
        <span class="subtitle">Automatic Perio Charting</span>
    </div>
    <div
      class="promptbox clickable"
      onclick={() => toggle()}
      role="button"
      tabindex="0"
      onkeydown={(e) => { if (e.key === 'Enter') toggle(); }}
    >
      {#if store.listening}
        <button class="stopbtn" onclick={(e) => { e.stopPropagation(); toggle(); }}>Stop</button>
      {/if}
      <div class="prompttext">
        {#if store.listening}
          {#if store.transcript.length}
            <p class="prompt live" class:hypo={!store.transcript[0].final}>{store.transcript[0].text}</p>
          {:else}
            <p class="prompt live">Listening...</p>
          {/if}
        {:else}
          <p class="prompt">Start?</p>
        {/if}
        <p class="sub">{store.listening ? 'Listening...' : store.status}</p>
      </div>
    </div>
    <div class="right">
        <button class="logbtn" onclick={() => (showLog = true)}>Logs</button>
    </div>
  </header>

  <main class="backdrop">
    <div class="midrow">
      <div class="leftcol">
          <button class="ghost" onclick={resetAll} disabled={store.listening}>Reset</button>
          <input class="name" bind:value={name} placeholder="Client name" />
          <button class="ghost" onclick={() => exportActiveJson(name)}>Export</button>
          <span class="cursor">Tooth {store.cur.t} · {SITENAMES[store.cur.s]} ({store.cur.s + 1}/6)</span>
        <div class="stats">
          <span><b>{teethDone}/32</b> teeth</span>
          <span>BOP <b>{bop.pct}%</b> ({bop.hit}/{bop.total})</span>
          <span>PI <b>{pi.pct}%</b> ({pi.hit}/{pi.total})</span>
          <span>max PD <b>{maxPD}</b></span>
          {#if store.latencyMs !== null}<span>{store.latencyMs.toFixed(0)}ms parse+render</span>{/if}
        </div>
      </div>
      <aside class="legend">
        <span class="lgroup"><b>Findings</b> <i class="sw bop"></i> bleeding <i class="sw sup"></i> suppuration <i class="sw pi"></i> plaque</span>
        <span class="lgroup"><b>Implant</b> <i class="sw st-implant"></i> implant <i class="sw st-peri"></i> peri-implantitis <i class="sw st-recovered"></i> recovered</span>
      </aside>
    </div>
    <div class="chartwrap"><PerioChart /></div>
  </main>

  {#if showLog}
    <!-- ponytail: native dialog skipped - one conditional div, no focus-trap lib until needed -->
    <div class="overlay" onclick={(e) => e.target === e.currentTarget && (showLog = false)}>
      <div class="dialog">
        <div class="dhead"><b>Type-in & voice log</b><button class="ghost" onclick={() => (showLog = false)}>Close</button></div>
        <input
          bind:value={draft}
          onkeydown={(e) => { if (e.key === 'Enter') submitDraft(); if (e.key === 'Escape') showLog = false; }}
          placeholder='type e.g. "3 2 3 bleeding repeat jump 24" + Enter'
        />
        <div id="tx">
          {#each store.transcript as line (line.id)}
            <div class:i={!line.final}>{line.text}</div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ponytail: vendored woff2 in public/fonts - no CDN, works offline after first load */
  @font-face { font-family: 'Geist'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/geist-sans-latin-400-normal.woff2') format('woff2'); }
  @font-face { font-family: 'Geist'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/geist-sans-latin-500-normal.woff2') format('woff2'); }
  @font-face { font-family: 'Geist'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/geist-sans-latin-600-normal.woff2') format('woff2'); }
  @font-face { font-family: 'Geist'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/geist-sans-latin-700-normal.woff2') format('woff2'); }
  :global(body) { margin: 0; background: #1b2c1a; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .page { height: 100vh; display: flex; flex-direction: column; background: #1b2c1a;  overflow: hidden; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .hero { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 4px 16px 6px; flex: none; }
  .promptbox {
    flex: 1; min-width: 0; min-height: 131px; max-width: 60%;
    box-sizing: border-box; background: #314131; border: 1px solid #5a685a;
    border-radius: 12px; display: flex; flex-direction: row;
    align-items: center; justify-content: center; padding: 12px 20px;
  }
  .promptbox.clickable { cursor: pointer; }
  .stopbtn {
    flex: none; background: none; border: 1px solid rgba(from #d1f380 r g b / 0.2); color: #d1f380;
    border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 400; cursor: pointer;
  }
  .prompttext { flex: 1; min-width: 0; }
  .prompt { margin: 0; font-size: 36px; font-weight: 700; color: #fff; text-align: center; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .prompt .dim { color: rgba(255, 255, 255, 0.7); }
  .prompt .lime { color: #d1f380; }
  .prompt.live { font-size: 20px; font-weight: 600; }
  .prompt.hypo, .i { opacity: 0.5; font-style: italic; font-weight: 100; }
  .sub { margin: 6px 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.6); text-align: center; }
  .brand {display: flex; flex-direction: column; gap: 0.25rem;}
  .logo { font-size: 36px; font-weight: 200; color: white; white-space: nowrap; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .subtitle {font-size: 0.8rem; text-transform: uppercase; font-weight: 500; color: #84bd00}
  .right { height: 100%; display: flex; align-items: flex-end; justify-content: center; }
  .logbtn {
    background: rgba(100, 100, 100, 0.2); color: white; border: none; border-radius: 8px;
    padding: 0.5rem 1.2rem; font-size: 14px; cursor: pointer; white-space: nowrap;
    font-weight: 300;
    font-family: Geist, Inter, Manrope, system-ui, sans-serif;
    font-size: 1rem;
  }
  .backdrop {
    background: #f6f4f1; border-radius: 12px 12px 0 0;
    box-shadow: 0 -4px 4px 0 rgba(0, 0, 0, 0.25);
    padding: 8px 16px 10px; width: 100%; margin: 0 auto; box-sizing: border-box;
    flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;
  }
  .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; flex: none; }
  .ghost { background: #fff; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 8px; padding: 6px 14px; cursor: pointer; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06); font-weight: 500; }
  .eng, .cursor { font-size: 12px; color: #3f3f46; }
  .stats { display: contents; font-size: 13px; color: #3f3f46; }
  .midrow { display: flex; gap: 12px; align-items: flex-start; flex: none; }
  .leftcol { flex: 1; min-width: 0; align-self: center; display: flex; gap: 1rem; align-items: center; }
  .legend { flex: none; width: 210px; display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #3f3f46; }
  .lgroup { background: #fff; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 10px; padding: 6px 10px; line-height: 1.45; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); }
  .lgroup b { display: block; color: #27272a; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
  .lgroup.hint { background: none; border: none; padding: 0 2px; color: #5a685a; font-style: italic; }
  .sw { display: inline-block; width: 9px; height: 9px; border-radius: 50%; vertical-align: baseline; }
  .sw.bop { background: #c00; }
  .sw.sup { background: #e6a800; }
  .sw.pi { background: #1976d2; }
  .sw.st-implant { background: rgba(230, 168, 0, 0.85); border-radius: 2px; }
  .sw.st-peri { background: rgba(204, 0, 0, 0.85); border-radius: 2px; }
  .sw.st-recovered { background: rgba(46, 125, 50, 0.85); border-radius: 2px; }
  .chartwrap { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; margin-top: 6px; overflow-y: auto; }
  .overlay {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55);
    display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; box-sizing: border-box;
  }
  .dialog { background: #fff; border-radius: 16px; padding: 20px; width: min(640px, 94vw); max-height: 84vh; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25); }
  .dhead { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .dialog input { width: 100%; padding: 10px 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.14); font-size: 15px; }
  #tx { background: #f6f4f1; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 10px; min-height: 120px; max-height: 50vh; overflow: auto; padding: 8px 10px; font-size: 14px; }
  .i { opacity: 0.5; font-style: italic; font-weight: 100; }
  @media (max-width: 900px) { .brand { display: none; } .prompt { font-size: 28px; } .midrow { flex-wrap: wrap; } .legend { width: 100%; } }
  input.name { width: 130px; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.14); font-size: 13px; }
</style>
