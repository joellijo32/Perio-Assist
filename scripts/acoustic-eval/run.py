"""Decode fixtures with Vosk (same model + grammar as the app) and score.

Profiles: clean | suction (10dB + bursts) | harsh (5dB). Seeded, deterministic.
Metrics: WER overall, WER on digits, chart-match (hypothesis through parseInto
vs reference through parseInto). Writes results.json for chartmatch.js.
"""
import json
import os
import tarfile
import wave

import numpy as np
from vosk import KaldiRecognizer, Model

BASE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(BASE, 'fixtures')
MODEL_TAR = os.path.join(BASE, '..', '..', 'public', 'model.tar.gz')
MODEL_DIR = os.path.join(BASE, 'models', 'active')


def ensure_model():
    # ponytail: one model source (setup.sh) - extract on first run, harness never ships models
    if os.path.isdir(MODEL_DIR) and os.listdir(MODEL_DIR):
        return MODEL_DIR
    if not os.path.exists(MODEL_TAR):
        print('missing public/model.tar.gz - run ./scripts/setup.sh first')
        raise SystemExit(1)
    with tarfile.open(MODEL_TAR) as t:
        top = t.getnames()[0].split('/')[0]
        t.extractall(os.path.join(BASE, 'models'))
    os.rename(os.path.join(BASE, 'models', top), MODEL_DIR)
    return MODEL_DIR
PROFILES = {
    'clean': None,
    'suction': {'snr_db': 10, 'bursts': True},
    'harsh': {'snr_db': 5, 'bursts': False},
}

with open(os.path.join(BASE, '..', '..', 'src', 'grammar.json')) as f:
    GRAMMAR = json.dumps(json.load(f))

DIGITS = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12,
}


def read_wav(path):
    with wave.open(path, 'rb') as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)


def add_noise(x, snr_db, bursts, rng):
    if snr_db is None:
        return x
    noise = rng.standard_normal(len(x))
    if bursts:  # handpiece-like: 0.4s on / 0.6s off
        gate = (np.arange(len(x)) % 16000) < 6400
        noise = noise * np.where(gate, 1.0, 0.15)
    sig_pow = np.mean(x**2) + 1e-9
    noise = noise * np.sqrt(sig_pow / (np.mean(noise**2) * 10 ** (snr_db / 10)))
    y = np.clip(x + noise, -32768, 32767)
    return y.astype(np.float32)


def normtoks(toks):
    out = []
    i = 0
    while i < len(toks):
        if toks[i] == 'em' and i + 1 < len(toks) and toks[i + 1] == 'bee':
            out.append('mb')
            i += 2
            continue
        t = toks[i]
        out.append(str(DIGITS[t]) if t in DIGITS else t)
        i += 1
    return out


def norm_text(s):
    return normtoks(s.lower().split())


def wer(ref, hyp):
    r, h = norm_text(ref), norm_text(hyp)
    if not r:
        return 0, 0
    prev = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        cur = [i]
        for j in range(1, len(h) + 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] != h[j - 1])))
        prev = cur
    return prev[len(h)], len(r)


def is_digit_tok(t):
    return t in DIGITS or t.isdigit()


def main():
    model = Model(ensure_model())
    rec = KaldiRecognizer(model, 16000, GRAMMAR)
    rng = np.random.default_rng(7)
    results = []
    tot_e = tot_n = dig_e = dig_n = 0
    per_profile = {}
    for fname in sorted(os.listdir(FIX)):
        if not fname.endswith('.wav'):
            continue
        uid = fname.split('.')[0]
        with open(os.path.join(BASE, 'utterances.txt')) as f:
            ref = next(l.split('|', 1)[1].strip() for l in f if l.startswith(uid + ' |'))
        x = read_wav(os.path.join(FIX, fname))
        for pname, prof in PROFILES.items():
            y = add_noise(x, rng=rng, **prof) if prof else x
            rec.Reset()
            data = y.astype(np.int16).tobytes()
            for off in range(0, len(data), 6400):
                rec.AcceptWaveform(data[off : off + 6400])
            hyp = json.loads(rec.FinalResult()).get('text', '')
            e, n = wer(ref, hyp)
            r, h = norm_text(ref), norm_text(hyp)
            de = dn = 0
            for a, b in zip(r, h):
                if is_digit_tok(a):
                    dn += 1
                    de += a != b
            dn += sum(1 for a in r[len(h) :] if is_digit_tok(a))
            de += sum(1 for a in r[len(h) :] if is_digit_tok(a))
            dn += sum(1 for b in h[len(r) :] if is_digit_tok(b))
            de += sum(1 for b in h[len(r) :] if is_digit_tok(b))
            tot_e += e
            tot_n += n
            dig_e += de
            dig_n += dn
            pe, pn, pde, pdn = per_profile.setdefault(pname, [0, 0, 0, 0])
            per_profile[pname] = [pe + e, pn + n, pde + de, pdn + dn]
            results.append({'id': fname, 'profile': pname, 'ref': ref, 'hyp': hyp})
    with open(os.path.join(BASE, 'results.json'), 'w') as f:
        json.dump(results, f)
    print(f'overall WER {tot_e}/{tot_n} = {100 * tot_e / max(tot_n, 1):.1f}%   digits {dig_e}/{dig_n} = {100 * dig_e / max(dig_n, 1):.1f}%')
    for pname, (pe, pn, pde, pdn) in per_profile.items():
        print(f'  {pname:8s} WER {pe}/{pn} = {100 * pe / max(pn, 1):.1f}%   digits {pde}/{pdn} = {100 * pde / max(pdn, 1):.1f}%')


if __name__ == '__main__':
    main()
