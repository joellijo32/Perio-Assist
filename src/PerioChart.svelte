<script>
  import { moveTo, preview, SITENAMES, store } from './chart.svelte.js';

  // ponytail: Open Dental data-chart rows - probing + dots, GM, auto-CAL, mobility, furcation
  const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);
  const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);

  const cal = (t, s) => (store.teeth[t][s] == null ? null : store.teeth[t][s] + store.rec[t][s]);
  // ponytail: MISSING blanks the column visually; stored values are kept so present/undo restores them
  const isMissing = (t) => store.absent[t] === 'MISSING';
  // ponytail: implant-health tints - color carries meaning, same translucency as missing
  const tint = (t) =>
    store.absent[t] === 'IMPLANT' ? 'st-implant'
    : store.absent[t] === 'PERIIMPLANTITIS' ? 'st-peri'
    : store.absent[t] === 'RECOVERED' ? 'st-recovered' : '';
  const marks = (t) =>
    `${store.absent[t] ? '*' : ''}${store.mob[t] != null ? ` M${store.mob[t]}` : ''}${store.fur[t] ? ` F${['', 'I', 'II', 'III'][store.fur[t].grade]}` : ''}`;
</script>

{#snippet brow(t, s)}
  {@const missing = isMissing(t)}
  {@const v = missing ? null : store.teeth[t][s]}
  {@const pv = missing ? undefined : preview.teeth?.[t]?.[s]}
  {@const pb = missing ? undefined : preview.bleed?.[t]?.[s]}
  {@const diffVal = pv !== undefined && pv !== v}
  {@const diffBleed = pb !== undefined && pb !== store.bleed[t][s]}
  {@const sel = store.cur.t === t && store.cur.s === s}
  <button
    class="pd"
    class:sel
    class:miss={missing}
    class:flag={!missing && v != null && v >= 4}
    class:pre={diffVal || diffBleed}
    onclick={() => moveTo(t, s)}
    title={`${t} ${SITENAMES[s]}${store.rec[t][s] ? `, rec ${store.rec[t][s]}` : ''}${store.sup[t][s] ? ', suppuration' : ''}${store.plaque[t][s] ? ', plaque' : ''}`}
  >
    <span class="dots">
      {#if !missing && (diffBleed ? pb : store.bleed[t][s])}<i class="dot bop" class:faded={diffBleed && !store.bleed[t][s]}></i>{/if}
      {#if !missing && store.sup[t][s]}<i class="dot sup"></i>{/if}
      {#if !missing && store.plaque[t][s]}<i class="dot pi"></i>{/if}
    </span>
    <span class:faded={diffVal}>{missing ? '' : (diffVal ? (pv ?? '·') : (v ?? '·'))}</span>
  </button>
{/snippet}

{#snippet block(name, teeth, sites)}
  <div class="aspect" style="grid-row: span 3">{name}</div>
  <div class="rlabel">PD</div>
  {#each teeth as t (t)}
    <div class="tgroup {tint(t)}" class:miss={isMissing(t)}>
      {#each sites as s (s)}
        {@render brow(t, s)}
      {/each}
    </div>
  {/each}
  <div class="rlabel">GM</div>
  {#each teeth as t (t)}
    <div class="tgroup {tint(t)}" class:miss={isMissing(t)}>
      {#each sites as s (s)}
        <div class="gm">{isMissing(t) ? '' : store.rec[t][s] || ''}</div>
      {/each}
    </div>
  {/each}
  <div class="rlabel">CAL</div>
  {#each teeth as t (t)}
    <div class="tgroup {tint(t)}" class:miss={isMissing(t)}>
      {#each sites as s (s)}
        {@const c = isMissing(t) ? null : cal(t, s)}
        <div class="cal" class:flag={c != null && c >= 4}>{c ?? (isMissing(t) ? '' : '—')}</div>
      {/each}
    </div>
  {/each}
{/snippet}

{#snippet arch(jaw, teeth, first, second)}
  <div class="arch" style="grid-template-columns: 30px 30px 38px repeat({teeth.length}, minmax(0, 1fr))">
    <div class="jaw" style="grid-row: span 9">{jaw}</div>
    <div class="corner">Tooth</div>
    {#each teeth as t (t)}
      <div class="thead {tint(t)}" class:cur={store.cur.t === t} class:miss={isMissing(t)}>
        <b>{t}</b><span>{marks(t)}</span>
      </div>
    {/each}
    {@render block(first.name, teeth, first.sites)}
    {@render block(second.name, teeth, second.sites)}
    <div class="rlabel span2">Mob</div>
    {#each teeth as t (t)}
      <div class="tgroup {tint(t)}" class:miss={isMissing(t)}><div class="mob">{isMissing(t) ? '' : store.mob[t] ?? ''}</div></div>
    {/each}
    <div class="rlabel span2">Furc</div>
    {#each teeth as t (t)}
      <div class="tgroup {tint(t)}" class:miss={isMissing(t)}><div class="mob">{isMissing(t) ? '' : store.fur[t]?.grade ?? ''}</div></div>
    {/each}
  </div>
{/snippet}

<div class="chart">
  {@render arch('Upper', UPPER, { name: 'Facial', sites: [0, 1, 2] }, { name: 'Lingual', sites: [3, 4, 5] })}
  {@render arch('Lower', LOWER, { name: 'Lingual', sites: [3, 4, 5] }, { name: 'Facial', sites: [0, 1, 2] })}
</div>

<style>
  .chart { display: flex; flex-direction: column; gap: 8px; margin: 0; flex: 1; min-height: 0; }
  .arch {
    display: grid; gap: 2px; align-items: stretch; background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 12px; padding: 8px; min-height: 0; flex: 1;
    box-shadow: 0 7px 24px rgba(0, 0, 0, 0.07);
  }
  .arch > * { min-height: 0; }
  .jaw, .aspect {
    writing-mode: vertical-rl; transform: rotate(180deg);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #1b2c1a; letter-spacing: 0.06em;
    background: #eff9d2; border-radius: 6px;
    font-family: Geist, Inter, Manrope, system-ui, sans-serif;
  }
  .jaw { background: #1b2c1a; color: #d1f380; }
  .corner { grid-column: span 2; font-size: 11px; color: #52525b; font-weight: 700; align-self: center; text-align: center; text-transform: uppercase; letter-spacing: 0.06em; }
  .rlabel { font-size: 11px; color: #52525b; align-self: center; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .rlabel.span2 { grid-column: span 2; }
  .thead { text-align: center; font-size: 15px; padding: 3px 1px; border-bottom: 3px solid #314131; min-width: 0; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .thead.cur { border-bottom-color: #84bd00; background: #dff5a6; border-radius: 6px 6px 0 0; }
  .thead.miss { opacity: 0.45; }
  .st-implant { opacity: 0.55; background: rgba(230, 168, 0, 0.28); border-radius: 6px; }
  .st-peri { opacity: 0.55; background: rgba(204, 0, 0, 0.2); border-radius: 6px; }
  .st-recovered { opacity: 0.55; background: rgba(46, 125, 50, 0.25); border-radius: 6px; }
  .thead span { color: #a00; font-size: 12px; }
  .tgroup { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; min-width: 0; }
  .tgroup.miss { opacity: 0.45; }
  .pd {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-width: 0; min-height: 0; padding: 1px 0; font-size: 15px; font-weight: 600; line-height: 1.25;
    background: #fff; border: 1px solid rgba(0, 0, 0, 0.22); border-radius: 6px; cursor: pointer; color: #18181b; overflow: hidden;
  }
  .pd.sel { outline: 2px solid #84bd00; background: #eff9d2; }
  .pd.flag { color: #c00; font-weight: bold; }
  .pd.miss { text-decoration: line-through; }
  .dots { display: flex; gap: 3px; height: 7px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .dot.bop { background: #c00; }
  .dot.sup { background: #e6a800; }
  .dot.pi { background: #1976d2; }
  .gm, .cal, .mob { text-align: center; font-size: 12px; font-weight: 600; line-height: 1.4; padding: 1px 0; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 6px; min-width: 0; min-height: 0; overflow: hidden; color: #18181b; background: #fafaf9; }
  .cal { color: #666; font-style: italic; }
  .cal.flag { color: #c00; font-style: normal; font-weight: bold; }
  .pd.pre { border-color: #6af; background: #f0f8ff; opacity: 0.5; font-style: italic; font-weight: 100; }
  .faded { opacity: 0.5; font-style: italic; font-weight: 100; }
</style>
