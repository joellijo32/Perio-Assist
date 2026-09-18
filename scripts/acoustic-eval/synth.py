"""Synth charting utterances with macOS TTS -> 16kHz mono wav fixtures."""
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(BASE, 'fixtures')
VOICES = ['Eddy', 'Daniel', 'Aman']  # US, GB, IN
RATES = {'normal': 175, 'fast': 215}


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
                print('synth', os.path.basename(wav))


if __name__ == '__main__':
    synth(regen='--regen' in sys.argv)
    print('fixtures ok')
