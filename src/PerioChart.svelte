<script>
  import { moveTo, SITENAMES, store } from './chart.svelte.js';

  // ponytail: Open Dental data-chart rows - probing + dots, GM, auto-CAL, mobility, furcation
  const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);
  const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);

  const cal = (t, s) => (store.teeth[t][s] == null ? null : store.teeth[t][s] + store.rec[t][s]);
  const marks = (t) =>
    `${store.absent[t] ? '*' : ''}${store.mob[t] != null ? ` M${store.mob[t]}` : ''}${store.fur[t] ? ` F${['', 'I', 'II', 'III'][store.fur[t].grade]}` : ''}`;
</script>

{#snippet brow(t, s)}
  {@const v = store.teeth[t][s]}
  {@const sel = store.cur.t === t && store.cur.s === s}
  <button
    class="pd"
    class:sel
    class:miss={!!store.absent[t]}
    class:flag={v != null && v >= 4}
    onclick={() => moveTo(t, s)}
    title={`${t} ${SITENAMES[s]}${store.rec[t][s] ? `, rec ${store.rec[t][s]}` : ''}${store.sup[t][s] ? ', suppuration' : ''}`}
  >
    <span class="dots">
      {#if store.bleed[t][s]}<i class="dot bop"></i>{/if}
      {#if store.sup[t][s]}<i class="dot sup"></i>{/if}
    </span>
    <span>{v ?? '·'}</span>
  </button>
{/snippet}

{#snippet arch(label, teeth, sites)}
  <div class="archlabel">{label}</div>
  <div class="arch" style={`grid-template-columns: 64px repeat(${teeth.length}, 1fr)`}>
    <div class="rlabel">Tooth</div>
    {#each teeth as t (t)}
      <div class="thead" class:cur={store.cur.t === t} class:miss={!!store.absent[t]}>
        <b>{t}</b><span>{marks(t)}</span>
      </div>
    {/each}
    <div class="rlabel">PD</div>
    {#each teeth as t (t)}
      <div class="tgroup">
        {#each sites as s (s)}
          {@render brow(t, s)}
        {/each}
      </div>
    {/each}
    <div class="rlabel">GM</div>
    {#each teeth as t (t)}
      <div class="tgroup">
        {#each sites as s (s)}
          <div class="gm">{store.rec[t][s] || ''}</div>
        {/each}
      </div>
    {/each}
    <div class="rlabel">CAL</div>
    {#each teeth as t (t)}
      <div class="tgroup">
        {#each sites as s (s)}
          {@const c = cal(t, s)}
          <div class="cal" class:flag={c != null && c >= 4}>{c ?? '—'}</div>
        {/each}
      </div>
    {/each}
    <div class="rlabel">Mob</div>
    {#each teeth as t (t)}
      <div class="tgroup"><div class="mob">{store.mob[t] ?? ''}</div></div>
    {/each}
    <div class="rlabel">Furc</div>
    {#each teeth as t (t)}
      <div class="tgroup"><div class="mob">{store.fur[t]?.grade ?? ''}</div></div>
    {/each}
  </div>
{/snippet}

<div class="chart">
  {@render arch('Upper — facial', UPPER, [0, 1, 2])}
  {@render arch('Upper — lingual', UPPER, [3, 4, 5])}
  {@render arch('Lower — lingual', LOWER, [3, 4, 5])}
  {@render arch('Lower — facial', LOWER, [0, 1, 2])}
</div>

<style>
  .chart { display: flex; flex-direction: column; gap: 14px; margin: 12px 0; }
  .archlabel { font-size: 12px; color: #666; margin-bottom: -8px; }
  .arch { display: grid; gap: 2px; align-items: stretch; }
  .rlabel { font-size: 11px; color: #666; align-self: center; }
  .thead { text-align: center; font-size: 12px; padding: 2px; border-bottom: 2px solid #ccc; }
  .thead.cur { border-bottom-color: #333; background: #eee; }
  .thead span { color: #a00; font-size: 11px; }
  .tgroup { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .tgroup.miss { opacity: 0.45; }
  .pd {
    display: flex; flex-direction: column; align-items: center;
    min-width: 0; padding: 1px 0; font-size: 13px;
    background: #fff; border: 1px solid #ddd; cursor: pointer;
  }
  .pd.sel { outline: 2px solid #333; background: #f0f0f0; }
  .pd.flag { color: #c00; font-weight: bold; }
  .pd.miss { text-decoration: line-through; }
  .dots { display: flex; gap: 2px; height: 7px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .dot.bop { background: #c00; }
  .dot.sup { background: #e6a800; }
  .gm, .cal, .mob { text-align: center; font-size: 12px; padding: 1px 0; border: 1px solid #f0f0f0; }
  .cal { color: #666; font-style: italic; }
  .cal.flag { color: #c00; font-style: normal; font-weight: bold; }
</style>
