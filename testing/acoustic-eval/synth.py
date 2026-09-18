"""Synth charting utterances with Kokoro TTS + sox -> 16kHz mono wav fixtures.

Hackathon subset: 2 clear voices, natural speed only, for demo-quality audio.
"""
import os
import subprocess
import sys
import wave

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

BASE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(BASE, 'fixtures')
KOKORO_DIR = os.path.join(BASE, '.kokoro')
VOICES = ['af_heart', 'am_michael']  # clear US female / male
SPEED = 1.0  # natural pace, easily hearable
PAD_S = 0.3  # ponytail: leading/trailing silence - TTS starts instantly, clipping onsets biases WER

_kokoro = None


def kokoro():
    global _kokoro
    if _kokoro is None:
        _kokoro = Kokoro(
            os.path.join(KOKORO_DIR, 'kokoro-v1.0.onnx'),
            os.path.join(KOKORO_DIR, 'voices-v1.0.bin'),
        )
    return _kokoro


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


def tts_to_wav(text, voice, wav):
    samples, sr = kokoro().create(text, voice=voice, speed=SPEED, lang='en-us')
    tmp = wav + '.tmp.wav'
    sf.write(tmp, samples, sr)
    subprocess.run(
        ['sox', tmp, '-r', '16000', '-c', '1', '-e', 'signed-integer', '-b', '16', wav],
        check=True,
    )
    os.remove(tmp)
    pad_wav(wav)


def synth(regen=False, utterances=None, fix=FIX):
    os.makedirs(fix, exist_ok=True)
    for uid, text in (utterances or load_utterances()):
        for voice in VOICES:
            wav = os.path.join(fix, f'{uid}.{voice}.wav')
            if os.path.exists(wav) and not regen:
                continue
            tts_to_wav(text, voice, wav)
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
