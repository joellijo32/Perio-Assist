<script>
  import { commit, moveTo, preview, SITENAMES, store } from './chart.svelte.js';

  // ponytail: Open Dental data-chart rows - probing + dots, GM, auto-CAL, mobility, furcation
  const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);
  const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);

  // ponytail: one editor at a time - click selects, click again (or Enter) types; PD cells only
  let editing = $state(null);
  let draftVal = $state('');

  function focusSelect(el) {
    el.focus();
    el.select();
  }

  function cellClick(t, s) {
    if (store.cur.t === t && store.cur.s === s && !editing && !isMissing(t)) {
      draftVal = store.teeth[t][s] ?? '';
      editing = { t, s };
    } else {
      editing = null;
      moveTo(t, s);
    }
  }

  function commitCell() {
    if (!editing) return;
    const { t, s } = editing;
    const raw = draftVal.trim();
    editing = null;
    const v = Number(raw);
    if (raw === '' || !Number.isInteger(v) || v < 0 || v > 12) {
      if (raw !== '') store.status = `PD ${raw}mm outside range 0-12`;
      return;
    }
    // ponytail: typed input rides the voice path (move + commit) - undo/history free
    moveTo(t, s);
    commit(String(v));
  }

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
  {@const ed = editing && editing.t === t && editing.s === s}
  {#if ed}
    <input
      class="pd ed"
      bind:value={draftVal}
      inputmode="numeric"
      maxlength="2"
      aria-label={`Probing depth tooth ${t} ${SITENAMES[s]}`}
      use:focusSelect
      onkeydown={(e) => {
        if (e.key === 'Enter') commitCell();
        else if (e.key === 'Escape') editing = null;
        e.stopPropagation();
      }}
      onblur={() => (editing = null)}
      onclick={(e) => e.stopPropagation()}
    />
  {:else}
  <button
    class="pd"
    class:sel
    class:miss={missing}
    class:flag={!missing && v != null && v >= 4}
    class:pre={diffVal || diffBleed}
    onclick={() => cellClick(t, s)}
    title={`${t} ${SITENAMES[s]}${store.rec[t][s] ? `, rec ${store.rec[t][s]}` : ''}${store.sup[t][s] ? ', suppuration' : ''}${store.plaque[t][s] ? ', plaque' : ''}`}
  >
    <span class="dots">
      {#if !missing && (diffBleed ? pb : store.bleed[t][s])}<i class="dot bop" class:faded={diffBleed && !store.bleed[t][s]}></i>{/if}
      {#if !missing && store.sup[t][s]}<i class="dot sup"></i>{/if}
      {#if !missing && store.plaque[t][s]}<i class="dot pi"></i>{/if}
    </span>
    <span class:faded={diffVal}>{missing ? '' : (diffVal ? (pv ?? '·') : (v ?? '·'))}</span>
  </button>
  {/if}
{/snippet}

{#snippet arch(jaw, teeth, first, second)}
  <div class="arch">
    <div class="labcol">
      <div class="labhead">{jaw}</div>
      <div class="rlabel">{first.name} PD</div>
      <div class="rlabel">GM</div>
      <div class="rlabel">CAL</div>
      <div class="rlabel">{second.name} PD</div>
      <div class="rlabel">GM</div>
      <div class="rlabel">CAL</div>
      <div class="rlabel">Mob</div>
      <div class="rlabel">Furc</div>
    </div>
    {#each teeth as t (t)}
      {@const cls = tint(t)}
      {@const missing = isMissing(t)}
      <div class="tcol">
        <div class="thead" class:cur={store.cur.t === t} class:miss={missing}>
          <b>{t}</b><span>{marks(t)}</span>
        </div>
        <div class="tgroup" class:miss={missing}>
          {#each first.sites as s (s)}
            {@render brow(t, s)}
          {/each}
        </div>
        <div class="tgroup" class:miss={missing}>
          {#each first.sites as s (s)}
            <div class="gm">{missing ? '' : store.rec[t][s] || ''}</div>
          {/each}
        </div>
        <div class="tgroup" class:miss={missing}>
          {#each first.sites as s (s)}
            {@const c = missing ? null : cal(t, s)}
            <div class="cal" class:flag={c != null && c >= 4}>{c ?? (missing ? '' : '—')}</div>
          {/each}
        </div>
        <div class="tgroup" class:miss={missing}>
          {#each second.sites as s (s)}
            {@render brow(t, s)}
          {/each}
        </div>
        <div class="tgroup" class:miss={missing}>
          {#each second.sites as s (s)}
            <div class="gm">{missing ? '' : store.rec[t][s] || ''}</div>
          {/each}
        </div>
        <div class="tgroup" class:miss={missing}>
          {#each second.sites as s (s)}
            {@const c = missing ? null : cal(t, s)}
            <div class="cal" class:flag={c != null && c >= 4}>{c ?? (missing ? '' : '—')}</div>
          {/each}
        </div>
        <div class="tgroup" class:miss={missing}><div class="mob">{missing ? '' : store.mob[t] ?? ''}</div></div>
        <div class="tgroup" class:miss={missing}><div class="mob">{missing ? '' : store.fur[t]?.grade ?? ''}</div></div>
        {#if cls}<div class="tint {cls}" aria-hidden="true"></div>{/if}
        {#if missing}<div class="strike" aria-hidden="true"></div>{/if}
      </div>
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
    grid-template-columns: 76px repeat(16, minmax(0, 1fr));
    grid-template-rows: repeat(9, auto);
  }
  .arch > * { min-height: 0; }
  /* ponytail: tooth-major columns via subgrid - overlay lives inside its column, alignment can't drift */
  .labcol, .tcol { grid-row: 1 / -1; display: grid; grid-template-rows: subgrid; gap: 2px; min-width: 0; }
  .tcol { position: relative; }
  .labhead {
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #1b2c1a; letter-spacing: 0.06em;
    background: #eff9d2; border-radius: 6px;
    font-family: Geist, Inter, Manrope, system-ui, sans-serif;
  }
  .rlabel { font-size: 11px; color: #52525b; align-self: center; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .thead { text-align: center; font-size: 15px; padding: 3px 1px; border-bottom: 3px solid #314131; min-width: 0; font-family: Geist, Inter, Manrope, system-ui, sans-serif; }
  .thead.cur { border-bottom-color: #84bd00; background: #dff5a6; border-radius: 6px 6px 0 0; }
  .thead.miss { opacity: 0.45; }
  /* ponytail: overlay is absolutely positioned inside its own tooth column - no grid math to get wrong */
  .tint { position: absolute; inset: 0; pointer-events: none; z-index: 10; border-radius: 8px; }
  .strike {
    position: absolute; inset: 0; pointer-events: none; z-index: 10;
    background: linear-gradient(to top right, transparent calc(50% - 1px), #888 calc(50% - 1px), #888 calc(50% + 1px), transparent calc(50% + 1px));
  }
  .tint.st-implant { background: rgba(230, 168, 0, 0.38); }
  .tint.st-peri { background: rgba(204, 0, 0, 0.3); }
  .tint.st-recovered { background: rgba(46, 125, 50, 0.32); }
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
  .pd.ed { width: 100%; box-sizing: border-box; text-align: center; outline: 2px solid #84bd00; }
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
  /* ponytail: mobile keeps full chart density and scrolls instead - desktop rules above are untouched */
  @media (max-width: 720px) {
    .arch { overflow-x: auto; }
    .tcol { min-width: 68px; }
    .labcol { position: sticky; left: 0; z-index: 5; background: #fff; }
    .pd { min-height: 34px; font-size: 16px; }
  }
</style>
