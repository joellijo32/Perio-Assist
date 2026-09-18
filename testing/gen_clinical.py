import random
import json
from typing import List, Dict, Tuple, Any

# Clinical distributions & token libraries
NUMBER_WORDS = {
    1: ["1", "one"], 2: ["2", "two"], 3: ["3", "three"],
    4: ["4", "four"], 5: ["5", "five"], 6: ["6", "six"],
    7: ["7", "seven"], 8: ["8", "eight"], 9: ["9", "nine"]
}

# Probabilities weighted towards healthy adult gums with occasional pocketing
DEPTH_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8]
DEPTH_PROBS   = [0.10, 0.45, 0.30, 0.08, 0.04, 0.015, 0.01, 0.005]

SUP_RATE = 0.05  # per site; only emitted when depth >= 4

MOB_GRADES = [0, 1, 2, 3]
MOB_PROBS  = [0.82, 0.10, 0.06, 0.02]  # ~18% have some mobility
MOB_WORDS  = {1: ["mobility one", "slight mobility"], 2: ["mobility two"], 3: ["mobility three", "severe mobility"]}

SITES_ORDER = ["MF", "F", "DF", "ML", "L", "DL"]
SITE_NAMES = {
    "DF": "distal", "F": "facial", "MF": "mesial",
    "DL": "distal", "L": "lingual", "ML": "mesial"
}

BLEED_PHRASES = [
    "bleeding", "bleed", "bop", "bleeding on {site}", "drop on {site}", "blood"
]

# ponytail: every template restricted to src/grammar.json's closed vocab -
# "the/a/to/wait/that/positive" aren't decodable, so a reference containing them
# is unscoreable WER, not filler the recognizer politely ignores.
CORRECTION_TEMPLATES = [
    "undo {site} {val}",
    "correction {val} on {site}",
    "change last {val}",
    "make {val}",
]
# NOTE: no correction template may assert a clinical finding ("with bleeding",
# "no bleeding", ...). Templates must be finding-neutral so ground truth stays exact.

OPERATORY_NOISE = [
    "rinse please", "hand me the explorer", "open slightly wider", 
    "swallow for me", "turn slightly towards me", "suction"
]

def sample_depth() -> int:
    return random.choices(DEPTH_WEIGHTS, weights=DEPTH_PROBS, k=1)[0]

def format_number(n: int, as_word_prob: float = 0.4) -> str:
    choices = NUMBER_WORDS.get(n, [str(n)])
    return random.choice(choices) if random.random() < as_word_prob else str(n)

def generate_patient_chart(
    num_teeth: int = 16,
    start_tooth: int = 1,
    correction_rate: float = 0.15,
    noise_rate: float = 0.10,
    missing_rate: float = 0.05,
    explicit_prefix: bool = True,
    aspect_prob: float = 1.0,
) -> Tuple[str, Dict[str, Any]]:
    """
    Generates a full charting transcript alongside the ground-truth state JSON.
    explicit_prefix: only "tooth N" / "number N" announcements (bare numbers
        are indistinguishable from depth callouts, so evals skip them).
    aspect_prob: P(aspect announced per side); bare mesial/distal needs it.
    """
    transcript_segments: List[str] = []
    ground_truth: Dict[int, Dict[str, Any]] = {}

    for t_offset in range(num_teeth):
        tooth_id = start_tooth + t_offset
        if tooth_id > 32:
            break

        # Check for missing tooth / implant
        if random.random() < missing_rate:
            status = random.choice(["missing", "implant"])
            transcript_segments.append(f"tooth {tooth_id} is {status}")
            ground_truth[tooth_id] = {"status": status.upper(), "sites": None}
            continue

        ground_truth[tooth_id] = {"status": "PRESENT", "sites": {}, "mobility": 0}

        # Announce tooth (explicit only: bare numbers are ambiguous with depths)
        styles = [f"tooth {tooth_id}", f"number {tooth_id}"]
        if not explicit_prefix:
            styles.append(f"{tooth_id}")
        call_prefix = random.choice(styles)
        current_tooth_tokens = [call_prefix]

        # Process Facial (MF, F, DF) then Lingual (ML, L, DL), mesial to distal
        for aspect, sites in [("facial", ["MF", "F", "DF"]), ("lingual", ["ML", "L", "DL"])]:
            aspect_call = f"{aspect}:" if random.random() < aspect_prob else ""
            if aspect_call:
                current_tooth_tokens.append(aspect_call)

            for site_code in sites:
                depth = sample_depth()
                bleed = random.random() < (0.35 if depth >= 4 else 0.08)
                recession = random.choice([1, 2, 3]) if random.random() < 0.10 else 0

                site_word = SITE_NAMES[site_code]
                depth_str = format_number(depth)
                entry_phrase = depth_str

                # Apply synthetic verbal correction
                if random.random() < correction_rate:
                    corrected_depth = sample_depth()
                    template = random.choice(CORRECTION_TEMPLATES)
                    correction_phrase = template.format(site=site_word, val=format_number(corrected_depth))
                    entry_phrase += f"... {correction_phrase}"
                    depth = corrected_depth  # Update ground truth to the corrected value

                # Append bleeding indicators
                if bleed and random.random() < 0.8:
                    bleed_call = random.choice(BLEED_PHRASES).format(site=site_word)
                    entry_phrase += f", {bleed_call}"

                # Append recession indicators
                if recession > 0 and random.random() < 0.7:
                    entry_phrase += f", {format_number(recession)} millimeters recession"

                # Append suppuration (only plausible with deeper pockets)
                sup = depth >= 4 and random.random() < SUP_RATE
                if sup:
                    entry_phrase += f", suppuration at {site_word}"

                current_tooth_tokens.append(entry_phrase)

                # Store ground-truth state
                ground_truth[tooth_id]["sites"][site_code] = {
                    "depth_mm": depth,
                    "bleeding": bleed,
                    "recession_mm": recession,
                    "suppuration": sup,
                }

        # Mobility (per tooth, appended after both aspects to avoid depth interference)
        mob = random.choices(MOB_GRADES, weights=MOB_PROBS, k=1)[0]
        ground_truth[tooth_id]["mobility"] = mob
        if mob > 0:
            current_tooth_tokens.append(random.choice(MOB_WORDS[mob]))

        # Occasional operatory noise between teeth
        if random.random() < noise_rate:
            current_tooth_tokens.append(f"[{random.choice(OPERATORY_NOISE)}]")

        transcript_segments.append(" ".join(current_tooth_tokens) + ".")

    final_transcript = " ".join(transcript_segments)
    return final_transcript, ground_truth

if __name__ == "__main__":
    transcript, truth = generate_patient_chart(num_teeth=6, start_tooth=1)
    
    print("=== SYNTHETIC CLINICAL DICTATION TRANSCRIPT ===")
    print(transcript)
    print("\n=== GROUND-TRUTH JSON EVALUATION DATA (Sample Tooth) ===")
    print(json.dumps({1: truth[1]}, indent=2))