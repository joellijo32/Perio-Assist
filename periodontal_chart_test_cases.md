# Periodontal Chart — Text-to-Chart Conversion Test Cases

> All inputs are sample periodontist narrations. Expected outputs describe the structured chart data that should be extracted.  
> Tooth numbering uses the **Universal Numbering System** (1–32) unless stated otherwise.  
> Each tooth has **6 probe sites**: MB, B, DB (buccal row) and ML, L, DL (lingual row).

---

## Legend

| Abbreviation | Meaning |
|---|---|
| PD | Probing Depth (mm) |
| GM | Gingival Margin (positive = recession, negative = hyperplasia) |
| CAL | Clinical Attachment Level = PD + GM |
| BOP | Bleeding on Probing |
| Frc | Furcation involvement (I / II / III) |
| Mob | Mobility (0–3) |
| Imp | Implant |
| ✓ | Present / detected |
| — | Not present / not narrated |

---

## 1. Happy Path — Full-Mouth Single Quadrant

### TC-001 · Healthy quadrant, all teeth present, no pathology

**Input:**
```
Upper right: tooth 3, buccal 2-3-2, lingual 3-2-3, no bleeding.
Tooth 4, buccal 2-2-2, lingual 2-2-2, no bleeding.
Tooth 5, buccal 2-3-2, lingual 2-2-2, no bleeding.
```

**Expected output:**

| Tooth | MB | B | DB | ML | L | DL | BOP | Frc | Mob |
|---|---|---|---|---|---|---|---|---|---|
| 3 | 2 | 3 | 2 | 3 | 2 | 3 | — | — | 0 |
| 4 | 2 | 2 | 2 | 2 | 2 | 2 | — | — | 0 |
| 5 | 2 | 3 | 2 | 2 | 2 | 2 | — | — | 0 |

**Assertions:**
- All PD values in range [1–3].
- BOP flag = false for all sites.
- No furcation or mobility recorded.

---

### TC-002 · Mild periodontitis — scattered BOP, PD 4–5 mm

**Input:**
```
Tooth 14, buccal 4-5-4, lingual 4-4-3, bleeding on buccal.
Tooth 15, buccal 3-4-3, lingual 3-3-3, bleeding at distal buccal.
```

**Expected output:**

| Tooth | MB | B | DB | ML | L | DL | BOP sites |
|---|---|---|---|---|---|---|---|
| 14 | 4 | 5 | 4 | 4 | 4 | 3 | MB, B, DB |
| 15 | 3 | 4 | 3 | 3 | 3 | 3 | DB |

**Assertions:**
- BOP = true for entire buccal row of tooth 14 (narrated as "bleeding on buccal").
- BOP = true only at DB of tooth 15 (narrated as "distal buccal").
- PD 4–5 flagged as ≥ 4 mm (moderate pocket).

---

## 2. Missing Teeth

### TC-003 · Single missing tooth

**Input:**
```
Tooth 1, missing.
Tooth 2, buccal 2-2-2, lingual 2-2-2, no bleeding.
```

**Expected output:**
- Tooth 1: status = `MISSING`, all PD fields = null.
- Tooth 2: fully charted, all PD = 2, BOP = false.

**Assertions:**
- Chart renders a blank/crossed cell for tooth 1.
- No probing data carried over from adjacent tooth.

---

### TC-004 · Multiple consecutive missing teeth

**Input:**
```
Teeth 17, 18, and 32 are missing.
```

**Expected output:**
- Teeth 17, 18, 32: status = `MISSING`.
- All other teeth: status = `PRESENT` (default, un-charted).

---

### TC-005 · Missing tooth with drifting neighbour (note only)

**Input:**
```
Tooth 5 missing. Tooth 4 has drifted distally, buccal 3-3-4, lingual 3-3-3, no bleeding.
```

**Expected output:**
- Tooth 5: `MISSING`.
- Tooth 4: PD charted, `note = "drifted distally"`.

---

## 3. Implants

### TC-006 · Single implant, fully integrated

**Input:**
```
Tooth 19 is an implant. Buccal 3-3-3, lingual 3-3-3, no bleeding, no mobility.
```

**Expected output:**
- Tooth 19: status = `IMPLANT`, PD as narrated, BOP = false, Mob = 0.

**Assertions:**
- Implant flag renders distinct visual marker.
- Furcation field is not applicable (null).

---

### TC-007 · Implant with peri-implantitis signs

**Input:**
```
Tooth 30 implant, buccal 5-6-5, lingual 4-5-4, bleeding on probing buccal and lingual, suppuration noted at mid-buccal.
```

**Expected output:**
- Tooth 30: status = `IMPLANT`.
- BOP = true all 6 sites.
- Suppuration = true at B site.
- PD ≥ 5 flagged as peri-implant pocket.

---

## 4. Furcation Involvement

### TC-008 · Class I furcation, upper molar

**Input:**
```
Tooth 3, buccal 3-4-3, lingual 3-3-3, furcation class one on buccal, no bleeding.
```

**Expected output:**
- Tooth 3: Frc = `I` (buccal).

---

### TC-009 · Class II furcation, lower molar

**Input:**
```
Tooth 19, buccal 5-5-4, lingual 4-4-4, class two furcation on buccal, bleeding buccal.
```

**Expected output:**
- Tooth 19: Frc = `II` (buccal), BOP = true (MB, B, DB).

---

### TC-010 · Class III through-and-through furcation

**Input:**
```
Tooth 14, buccal 7-8-6, lingual 6-6-5, class three furcation, bleeding throughout, mobility two.
```

**Expected output:**
- Tooth 14: Frc = `III`, BOP = all 6 sites, Mob = 2.

**Assertions:**
- PD ≥ 6 flagged as severe pocket.
- Mobility 2 triggers clinical alert.

---

## 5. Recession & Clinical Attachment Level

### TC-011 · Visible recession, upper anterior

**Input:**
```
Tooth 8, buccal 2-2-2, lingual 2-2-2, recession 2mm at mid-buccal, no bleeding.
```

**Expected output:**
- Tooth 8: PD mid-B = 2, GM mid-B = +2 (recession), CAL mid-B = 4.
- BOP = false.

---

### TC-012 · Recession with BOP — Miller Class II

**Input:**
```
Tooth 6, buccal 3-3-3, lingual 2-2-2, recession 3mm buccal, bleeding on probing buccal.
Note: Miller class two recession.
```

**Expected output:**
- Tooth 6: GM buccal row = +3, CAL buccal = 6, BOP buccal = true.
- `recession_class = "Miller II"` stored as annotation.

---

### TC-013 · Gingival hyperplasia (negative margin)

**Input:**
```
Tooth 24, buccal 5-5-5, lingual 4-4-4, gingival overgrowth 2mm at all buccal sites, no bleeding.
```

**Expected output:**
- Tooth 24: GM buccal row = −2 (hyperplasia), PD = 5, CAL buccal = 3.

---

## 6. Mobility

### TC-014 · Mobility scale coverage

| Input fragment | Expected Mob value |
|---|---|
| `"no mobility"` | 0 |
| `"slight mobility"` / `"mobility one"` | 1 |
| `"moderate mobility"` / `"mobility two"` | 2 |
| `"severe mobility"` / `"mobility three"` | 3 |

**Assertion:** Parser maps all synonyms to integer 0–3.

---

### TC-015 · Mobility on multiple teeth

**Input:**
```
Tooth 24, 25, 26: mobility two, no probing recorded.
```

**Expected output:**
- Teeth 24, 25, 26: Mob = 2, PD = null (not narrated), BOP = null.

---

## 7. Notation Systems

### TC-016 · FDI notation input

**Input:**
```
Tooth 26 (FDI), buccal 3-3-3, lingual 2-2-2, no bleeding.
```
*(FDI 26 = Universal 12)*

**Expected output:**
- Chart tooth = 12, fully charted.

**Assertion:** If the app supports FDI notation, it maps to the correct Universal number.

---

### TC-017 · Palmer notation input

**Input:**
```
Upper-left 6, buccal 4-4-3, lingual 3-3-3, bleeding mid-buccal.
```
*(Palmer UL6 = Universal 14)*

**Expected output:**
- Chart tooth = 14, BOP = true at B site.

---

## 8. Full-Mouth Chart (All 4 Quadrants)

### TC-018 · Complete narration — healthy adult

**Input:** *(32-tooth narration, all readings 1–3, no BOP, no recession)*
```
Upper right: teeth 1 through 8, all buccal 2-2-2, lingual 2-2-2, no bleeding.
Upper left: teeth 9 through 16, all buccal 2-2-2, lingual 2-2-2, no bleeding.
Lower left: teeth 17 through 24, all buccal 2-2-2, lingual 2-2-2, no bleeding.
Lower right: teeth 25 through 32, all buccal 2-2-2, lingual 2-2-2, no bleeding.
```

**Expected output:**
- All 32 teeth present, all PD = 2, BOP = false everywhere.
- Summary: `total_BOP_sites = 0`, `max_PD = 2`, `mean_PD = 2.0`.

---

### TC-019 · Full-mouth with mixed pathology

**Input:**
```
Tooth 1: missing.
Tooth 2: buccal 3-3-3, lingual 3-3-3, no bleeding.
Tooth 3: buccal 4-5-4, lingual 4-4-3, bleeding buccal, furcation class one.
Tooth 14: buccal 6-7-6, lingual 5-5-5, bleeding all, furcation class two, mobility one.
Tooth 19: implant, buccal 3-3-3, lingual 3-3-3, no bleeding.
Tooth 30: buccal 2-3-2, lingual 2-2-2, no bleeding.
Remaining teeth: buccal 2-2-2, lingual 2-2-2, no bleeding.
```

**Expected output:**
- Tooth 1: `MISSING`.
- Tooth 3: Frc I, BOP buccal, PD max = 5.
- Tooth 14: Frc II, BOP all, Mob 1, PD max = 7 → severe pocket alert.
- Tooth 19: `IMPLANT`, healthy.
- Summary: `BOP% = (6+6)/(32−1)*12 × 100` (computed correctly).

---

## 9. Edge Cases & Error Handling

### TC-020 · PD value out of clinical range

**Input:**
```
Tooth 7, buccal 15-2-2, lingual 2-2-2, no bleeding.
```

**Expected behavior:** Parser raises a validation error or warning: `"PD 15mm at tooth 7 MB is outside expected range [1–12]"`. Chart should not silently accept it.

---

### TC-021 · Missing lingual readings

**Input:**
```
Tooth 8, buccal 2-3-2, no bleeding.
```

**Expected behavior:**
- MB = 2, B = 3, DB = 2.
- ML, L, DL = `null` (not narrated).
- No crash; partial charting allowed.

---

### TC-022 · Ambiguous BOP narration

**Input:**
```
Tooth 10, buccal 4-4-4, lingual 3-3-3, some bleeding.
```

**Expected behavior:**
- "some bleeding" → BOP = true, site(s) = `UNSPECIFIED`.
- Chart marks all sites as BOP or flags for manual review — whichever the app design specifies.

**Assertion:** Parser does not silently drop ambiguous BOP; it surfaces it.

---

### TC-023 · Completely empty input

**Input:** `""`

**Expected behavior:** Returns structured error: `{ "error": "empty_input", "message": "No narration provided." }`. No chart object created.

---

### TC-024 · Non-clinical freeform text

**Input:**
```
The patient was very anxious today and we had a good conversation about oral hygiene.
```

**Expected behavior:** Parser returns `{ "error": "no_clinical_data", "teeth_found": [] }` or equivalent. No PD values extracted from prose.

---

### TC-025 · Duplicate tooth narration

**Input:**
```
Tooth 9, buccal 2-2-2, lingual 2-2-2, no bleeding.
Tooth 9, buccal 3-3-3, lingual 3-3-3, bleeding.
```

**Expected behavior:**
- App either raises a conflict error or uses the **last** narration (document this contract).
- Must not silently average or merge the two readings.

---

### TC-026 · Teeth narrated out of order

**Input:**
```
Tooth 32, buccal 2-2-2, lingual 2-2-2, no bleeding.
Tooth 1, buccal 3-3-3, lingual 3-3-3, bleeding buccal.
Tooth 16, buccal 2-2-2, lingual 2-2-2, no bleeding.
```

**Expected output:** Chart sorted by tooth number (1 → 32) regardless of narration order.

---

### TC-027 · Tooth referred to by name, not number

**Input:**
```
Upper right first molar, buccal 4-4-4, lingual 3-3-3, bleeding buccal, furcation class one.
```
*(Upper right first molar = tooth 3)*

**Expected output:** Tooth 3 charted correctly.

**Assertion:** All common anatomical names map to correct Universal numbers.

---

### TC-028 · Mixed number formats in a single session

**Input:**
```
Tooth three, buccal 2-3-2, lingual 2-2-2, no bleeding.
Tooth #14, buccal 4-4-3, lingual 3-3-3, bleeding buccal.
```

**Expected output:**
- "Tooth three" → 3, charted.
- "Tooth #14" → 14, charted.

---

### TC-029 · Suppuration narration

**Input:**
```
Tooth 15, buccal 6-7-6, lingual 5-5-5, bleeding all sites, suppuration at mid-buccal and disto-lingual, mobility one.
```

**Expected output:**
- PD as narrated.
- BOP = all 6 sites.
- Suppuration = true at B and DL.
- Mob = 1.

---

### TC-030 · No BOP mentioned (should default to false, not null)

**Input:**
```
Tooth 22, buccal 2-2-2, lingual 2-2-2.
```

**Expected behavior:**
- BOP = false (not `null`), because BOP absence is the clinical default when not mentioned.
- Confirm the app contract: is unmentioned BOP treated as false or unknown?

---

## 10. Summary Statistics

### TC-031 · BOP percentage calculation

**Setup:** 32 teeth present, 6 sites each = 192 total sites. 24 sites bleed.

**Expected output:** `BOP% = 12.5%` (24/192).

**Assertion:** Denominator excludes missing teeth and implants if app design specifies; document the contract.

---

### TC-032 · Mean probing depth

**Setup:** 10 teeth, all PD = 3 except tooth 14 (PD values: 6,7,6,5,5,5).

**Expected output:** Mean PD computed per site across all present teeth.

**Assertion:** Nulls (un-narrated sites) excluded from the mean, not treated as 0.

---

### TC-033 · Periodontal classification output

**Input:** Full-mouth narration producing:
- 2 teeth with PD ≥ 6 mm
- BOP% = 35%
- No bone loss data

**Expected output:** App emits `classification = "Stage II, Grade B"` (or surfaces the inputs so the clinician classifies). Confirm whether classification is auto-generated or advisory.

---

## 11. Regression / Known-Bad Inputs

### TC-034 · Dash-separated vs space-separated probe readings

| Input variant | Should parse to |
|---|---|
| `"buccal 3-3-3"` | MB=3, B=3, DB=3 |
| `"buccal 3 3 3"` | MB=3, B=3, DB=3 |
| `"buccal 3,3,3"` | MB=3, B=3, DB=3 |
| `"buccal 3/3/3"` | MB=3, B=3, DB=3 |

**Assertion:** All four formats produce identical chart output.

---

### TC-035 · Leading/trailing whitespace and casing

**Input:**
```
  TOOTH 5 , Buccal 2-2-2 , Lingual 2-2-2 , No Bleeding.  
```

**Expected output:** Identical to clean input — parser is whitespace- and case-insensitive.

---

### TC-036 · Unicode / special characters in narration

**Input:**
```
Tooth 8, buccal 2–2–2, lingual 2–2–2, no bleeding.
```
*(En-dash `–` instead of hyphen `-`)*

**Expected behavior:** Parser normalises en-dash to hyphen; PD extracted correctly.

---

## 12. Multi-Session / Longitudinal

### TC-037 · Recall visit — comparison to baseline

**Session 1 input:** Tooth 14 PD = 5-6-5, BOP buccal.  
**Session 2 input:** Tooth 14 PD = 3-4-3, no bleeding.

**Expected output:**
- Delta PD: −2 / −2 / −2 (improvement).
- BOP resolved.
- App renders change indicators (arrows or colour) on recall chart.

---

### TC-038 · New tooth extraction between sessions

**Session 1:** Tooth 17 present, PD = 3-3-3 all.  
**Session 2:** Tooth 17 missing.

**Expected output:**
- Session 2 chart: tooth 17 = `MISSING`.
- Historical session 1 data retained, not overwritten.

---

*End of test cases — 38 total.*
