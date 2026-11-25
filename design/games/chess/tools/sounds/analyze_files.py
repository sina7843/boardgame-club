"""Measure shipped sound files (decoded mp3/ogg) with the same features used on the reference.
Usage: py -X utf8 -I analyze_files.py <dir> [mp3|ogg]"""
import subprocess, sys
from pathlib import Path
import numpy as np

FF = r"E:/Apps/Softdeluxe/Free Download Manager/ffmpeg.exe"
SR = 44100
BANDS = [(63, 125), (125, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]
OFFSET = {'castle': 0.088, 'promote': 0.05}


def decode(f):
    out = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', str(f), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64)


def feats(x, name):
    pk = np.abs(x).max()
    on = int(np.argmax(np.abs(x) >= pk * 0.03))
    idx = np.nonzero(np.abs(x) >= pk * 0.003)[0]
    dur = (idx[-1] - on) / SR
    xp = np.pad(x, (0, SR))
    w = int(0.01 * SR)
    env = [int(round(10 * np.log10(np.mean(xp[on + i * w:on + (i + 1) * w] ** 2) + 1e-12))) for i in range(12)]
    n = 4096
    seg = xp[on:on + n] * (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n) / n))
    m = np.abs(np.fft.rfft(seg))[: n // 2]; f = np.arange(n // 2) * SR / n
    cen = int((f * m).sum() / m.sum())
    # octave bands of first 30 ms (main hit for castle/promote), same windowing as the browser script
    st = on + int(OFFSET.get(name, 0) * SR)
    n2 = 2048
    s2 = np.zeros(n2); s2[:1323] = xp[st:st + 1323]
    s2 *= 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n2) / n2)
    p = np.abs(np.fft.rfft(s2)) ** 2; df = SR / n2
    e = [p[int(np.ceil(lo / df)):int(np.ceil(hi / df))].sum() for lo, hi in BANDS]
    mx = max(e)
    ob = [int(round(10 * np.log10(v / mx + 1e-12))) for v in e]
    return dur, cen, round(20 * np.log10(pk), 1), env, ob


if __name__ == '__main__':
    d = Path(sys.argv[1]); ext = sys.argv[2] if len(sys.argv) > 2 else 'mp3'
    for f in sorted(d.glob(f'*.{ext}')):
        dur, cen, pk, env, ob = feats(decode(f), f.stem)
        print(f'{f.stem:14s} dur {dur:.3f} cen {cen:5d} pk {pk:5.1f} env {env[:8]} oct {ob}')
