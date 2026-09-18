"""Long-clip suite: ~90s dictation sessions -> fixtures_long/. Reuses synth.py's TTS/sox/pad."""
import os
import sys

from synth import BASE, synth

if __name__ == '__main__':
    with open(os.path.join(BASE, 'utterances_long.txt')) as f:
        utterances = [
            tuple(p.strip() for p in line.split('|', 1))
            for line in f
            if line.strip() and not line.startswith('#')
        ]
    synth(regen='--regen' in sys.argv, utterances=utterances, fix=os.path.join(BASE, 'fixtures_long'))
    print('long fixtures ok')
