"""One-off: build utterances_long.txt - same 12 criteria, ~90s dictation sessions.

Each target phrase (from utterances.txt) gets embedded inside a realistic
full-mouth dictation session built from gen_clinical.generate_patient_chart,
so the long clips test sustained-dictation accuracy, not just isolated words.
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from gen_clinical import generate_patient_chart  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
TARGET_WORDS = 250  # ~90s at kokoro's ~2.8 words/sec

CRITERIA = [
    ('t01', 'three two three'),
    ('t02', 'four five four bleeding'),
    ('t04', 'twelve eleven ten'),
    ('t05', 'm b six'),
    ('t10', 'repeat'),
    ('t13', 'undo'),
    ('t20', 'tooth twenty eight is missing'),
    ('t22', 'mobility two'),
    ('t26', 'suppuration at mid buccal'),
    ('t27', 'furcation class two on buccal'),
    ('t38', 'missing'),
    ('t40', 'seven eight six'),
]


def filler(min_words, start_tooth):
    text, tooth = '', start_tooth
    while len(text.split()) < min_words:
        seg, _ = generate_patient_chart(num_teeth=1, start_tooth=((tooth - 1) % 32) + 1, noise_rate=0.0)
        text = f'{text} {seg}'.strip()
        tooth += 1
    return text


def build(uid, phrase, seed):
    random.seed(seed)
    half = TARGET_WORDS // 2
    before = filler(half, 1)
    after = filler(TARGET_WORDS - len(before.split()), 17)
    return f'{before} {phrase}. {after}'


def main():
    lines = [
        '# id | ~90s dictation session (long-clip suite); target phrase embedded mid-session',
    ]
    for i, (uid, phrase) in enumerate(CRITERIA):
        text = build(uid, phrase, seed=i)
        lines.append(f'{uid} | {text}')
        print(uid, len(text.split()), 'words')
    with open(os.path.join(BASE, 'utterances_long.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'wrote {len(CRITERIA)} long utterances')


if __name__ == '__main__':
    main()
