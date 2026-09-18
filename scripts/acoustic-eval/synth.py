"""Synth charting utterances with macOS TTS -> 16kHz mono wav fixtures."""
import os
import subprocess
import sys
import wave

import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(BASE, 'fixtures')
VOICES = ['Eddy', 'Daniel', 'Aman']  # US, GB, IN
RATES = {'normal': 175, 'fast': 215}
PAD_S = 0.3  # ponytail: leading/trailing silence - TTS starts instantly, clipping onsets biases WER


def load_utterances():
    out = []
    with open(os.path.join(BASE, 'utterances.txt')) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            uid, text = [p.strip() for p in line.split('|', 1)]
            out.append((uid, text))
    return out


def pad_wav(path):
    with wave.open(path, 'rb') as w:
        params, frames = w.getparams(), w.readframes(w.getnframes())
    x = np.frombuffer(frames, dtype=np.int16)
    pad = np.zeros(int(16000 * PAD_S), dtype=np.int16)
    y = np.concatenate([pad, x, pad])
    with wave.open(path, 'wb') as w:
        w.setparams(params)
        w.writeframes(y.tobytes())


def synth(regen=False):
    os.makedirs(FIX, exist_ok=True)
    for uid, text in load_utterances():
        for voice in VOICES:
            for rname, rate in RATES.items():
                wav = os.path.join(FIX, f'{uid}.{voice}.{rname}.wav')
                if os.path.exists(wav) and not regen:
                    continue
                aiff = wav + '.aiff'
                subprocess.run(['say', '-v', voice, '-r', str(rate), '-o', aiff, text], check=True)
                subprocess.run(
                    ['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav],
                    check=True,
                )
                os.remove(aiff)
                pad_wav(wav)
                print('synth', os.path.basename(wav))


if __name__ == '__main__':
    if '--repad' in sys.argv:  # one-shot: pad existing fixtures in place
        n = 0
        for f in sorted(os.listdir(FIX)):
            if f.endswith('.wav'):
                pad_wav(os.path.join(FIX, f))
                n += 1
        print(f'padded {n} fixtures')
    else:
        synth(regen='--regen' in sys.argv)
        print('fixtures ok')
