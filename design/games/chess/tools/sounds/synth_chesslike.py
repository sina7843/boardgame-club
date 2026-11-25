"""BGV chess sounds, set "chesslike": synthesized from scratch; no chess.com audio file or sample is
included or used as source material.

The parameters were tuned to measurements of chess.com's default sound theme taken in the browser on
2026-11-24: length, attack, 10 ms envelope, spectral centroid, octave-band balance of the first 30 ms,
resonance ranges and relative loudness. Resonance frequencies are shifted about 4-6 % from the
measured peaks, so the sounds share the character, not the exact pitches.

Usage: py -X utf8 synth_chesslike.py <out_dir>
"""
import subprocess, sys, wave
from pathlib import Path
import numpy as np

FF = r"E:/Apps/Softdeluxe/Free Download Manager/ffmpeg.exe"
SR = 44100
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def db(x):
    return 10 ** (x / 20)


def knock(modes, length, burst_ms=1.5, noise_hp=0.0, noise_db=-18, bright=0.0):
    """Wood-like knock: a short noise burst plus damped sinusoid modes.
    modes: list of (freq Hz, level dB, decay tau ms)."""
    t = t_axis(length)
    y = np.zeros_like(t)
    for f, lv, tau in modes:
        ph = rng.uniform(0, 2 * np.pi)
        y += db(lv) * np.sin(2 * np.pi * f * t + ph) * np.exp(-t / (tau / 1000))
    # contact transient: very short decaying noise, optionally brightened
    n = rng.standard_normal(len(t)) * np.exp(-t / (burst_ms / 1000))
    if noise_hp:
        n = np.diff(n, prepend=0) * noise_hp + n * (1 - noise_hp)
    y += db(noise_db) * n * np.abs(y).max() / (np.abs(n).max() + 1e-9)
    if bright:
        y += bright * np.diff(y, prepend=0) * 6
    # 1 ms attack ramp to avoid a hard click
    a = int(0.001 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return y


def place(parts, length):
    out = np.zeros(int(length * SR))
    for start, sig, gain in parts:
        s = int(start * SR)
        e = min(len(out), s + len(sig))
        out[s:e] += sig[: e - s] * db(gain)
    return out


def tone(freqs, length, attack=0.005, release=0.012, tau=None):
    t = t_axis(length)
    y = sum(db(lv) * np.sin(2 * np.pi * f * t) for f, lv in freqs)
    env = np.ones_like(t)
    a, r = int(attack * SR), int(release * SR)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    if tau:
        env *= np.exp(-t / tau)
    return y * env


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    w = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * w, len(x))


# ---- events -------------------------------------------------------------------------------
def click(length, lo, hi, tau_ms, level_db, ref):
    """Band-limited noise contact transient, level relative to the peak of `ref`."""
    t = t_axis(length)
    n = bandpass(rng.standard_normal(len(t)), lo, hi) * np.exp(-t / (tau_ms / 1000))
    return db(level_db) * n * np.abs(ref).max() / (np.abs(n).max() + 1e-9)


def wood(modes, length, clicks, tail=None):
    y = knock(modes, length, noise_db=-60)
    out = y.copy()
    for lo, hi, tau, lv in clicks:
        out += click(length, lo, hi, tau, lv, y)
    if tail:
        out += knock(tail, length, noise_db=-60) * np.abs(y).max()
    a = int(0.0008 * SR)
    out[:a] *= np.linspace(0, 1, a)
    return out


def move_self():
    return wood([(490, 0, 6), (975, -2, 7), (210, -6, 9), (745, -5, 7), (1395, -6, 5), (365, -7, 8)], 0.16,
                [(900, 2500, 2.5, -3), (150, 600, 4, -15)], tail=[(250, -40, 45)])


def move_opponent():
    # same wood, a touch lower and duller so the two sides are told apart
    return wood([(468, 0, 6), (940, -2, 7), (338, -5, 8), (650, -6, 7), (1335, -7, 5), (200, -6, 9)], 0.16,
                [(850, 2400, 2.5, -4), (150, 600, 4, -15)], tail=[(240, -42, 45)])


def capture():
    y = wood([(1310, 0, 10), (1430, -2, 9), (1530, -1, 8), (1060, -5, 11), (945, -5, 10), (650, -5, 12),
              (490, -5, 14), (190, -12, 12), (260, -14, 12)], 0.30,
             [(2000, 10000, 2.5, 3), (120, 500, 5, -14)], tail=[(490, -36, 60), (315, -40, 50)])
    return y


def castle():
    body = [(195, -3, 9), (250, 0, 9), (330, -6, 8), (440, -4, 8), (645, -3, 7), (820, -6, 6), (1260, -8, 5)]
    clk = [(600, 2500, 3.0, 1), (120, 400, 4, -14)]
    hit = wood(body, 0.20, clk)
    tap = wood(body, 0.10, clk)
    return place([(0.0, tap, -16), (0.03, tap, -15), (0.09, hit, 0)], 0.30)


def move_check():
    hit = wood([(1090, 0, 11), (925, -1, 12), (990, -1, 14), (690, -3, 12), (1305, -4, 10), (1530, -5, 12),
                (360, -10, 10), (105, -16, 12), (2750, -6, 8), (3500, -8, 6), (5200, -12, 5)], 0.20,
               [(4000, 12000, 2.5, 5), (1000, 3000, 3, -2), (200, 700, 4, -14)], tail=[(700, -32, 50)])
    pre = wood([(1090, 0, 4), (2750, -4, 3)], 0.03, [(3000, 12000, 1.5, 0)])
    # the reference reaches its peak about 10 ms after the first contact
    return place([(0.0, pre, -12), (0.008, hit, 0)], 0.22)


def promote():
    ring = wood([(545, 0, 10), (770, -1, 9), (1130, -1, 8), (995, -3, 9), (1310, -3, 8), (388, -3, 11),
                 (200, -4, 10), (1700, -4, 7), (1510, -4, 7)], 0.22,
                [(900, 2200, 3.0, 2), (2000, 4000, 2.0, -10), (150, 500, 5, -8)], tail=[(545, -32, 50)])
    ring = ring / np.abs(ring).max()
    swish = bandpass(rng.standard_normal(int(0.045 * SR)), 700, 2500)
    swish = swish / (np.abs(swish).max() + 1e-9)
    # a light first touch, a quiet slide, then the piece lands about 50 ms later
    return place([(0.0, ring[:int(0.02 * SR)], -14), (0.006, swish, -28), (0.05, ring, 0)], 0.30)


def two_blips(f0, cluster, tau_ms):
    def blip():
        t = t_axis(0.06)
        y = sum(db(lv) * np.sin(2 * np.pi * f * t) for f, lv in [(f0, 0)] + cluster)
        y *= np.exp(-t / (tau_ms / 1000))
        a = int(0.0015 * SR)
        y[:a] *= np.linspace(0, 1, a)
        return y
    b = blip()
    return place([(0.0, b, 0), (0.12, b, -1)], 0.22)


def game_start():
    return two_blips(388, [(776, -20), (550, -22), (147, -30)], 4.0)


def game_end():
    # beating cluster around 600-700 Hz, very short, like a soft double knock
    return two_blips(615, [(648, -1), (690, -1), (735, -3), (910, -20), (975, -26)], 2.6)


def notify():
    return tone([(272, 0), (398, -5), (600, -9), (157, -30)], 0.11, attack=0.006, release=0.014)


def premove():
    return wood([(590, 0, 9), (205, -1, 11), (465, -2, 11), (1220, -2, 8), (970, -4, 12), (340, -4, 10)], 0.12,
                [(800, 3000, 2.0, -6)], tail=[(260, -40, 40)])


def illegal():
    # periodic low buzz: the reference repeats every ~16 ms (62 Hz); ours is 59 Hz.
    # Harmonics with random phases spread the energy evenly over each period (no envelope dips).
    t = t_axis(0.30)
    f0 = 59.0
    buzz = sum((1 / k ** 0.7) * np.sin(2 * np.pi * f0 * k * t + rng.uniform(0, 2 * np.pi)) for k in range(2, 30))
    y = bandpass(buzz, 180, 1400)
    env = np.minimum(t / 0.014, 1) ** 1.5 * np.exp(-np.maximum(t - 0.03, 0) / 0.032)
    return y * env


def low_time():
    def tick():
        t = t_axis(0.05)
        y = sum(db(lv) * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / tau)
                for f, lv, tau in [(12800, 0, 0.006), (12650, -1, 0.006), (13700, -2, 0.005), (14300, -4, 0.004),
                                   (9450, -7, 0.008)])
        n = bandpass(rng.standard_normal(len(t)), 7000, 16000) * np.exp(-t / 0.002)
        return y + 0.4 * n * np.abs(y).max() / (np.abs(n).max() + 1e-9)
    k = tick()
    return place([(s, k, g) for s, g in [(0.0, -1), (0.09, 0), (0.185, 0), (0.28, -2), (0.38, -2)]], 0.48)


EVENTS = {
    'move-self': move_self, 'move-opponent': move_opponent, 'capture': capture, 'castle': castle,
    'move-check': move_check, 'promote': promote, 'game-start': game_start, 'game-end': game_end,
    'low-time': low_time, 'illegal': illegal, 'premove': premove, 'notify': notify,
}
# loudest-10 ms RMS (dBFS), relative levels taken from the measured reference
TARGET10 = {'move-self': -20, 'move-opponent': -23, 'capture': -20, 'castle': -19, 'move-check': -19,
            'promote': -21, 'game-start': -15, 'game-end': -16, 'low-time': -18, 'illegal': -14,
            'premove': -27, 'notify': -21}


def loudest10(x):
    w = int(0.01 * SR)
    sq = np.convolve(x.astype(np.float64) ** 2, np.ones(w) / w, mode='valid')
    return 10 * np.log10(sq.max() + 1e-15)


def finish(x, name):
    x = x - np.mean(x)
    x = x * db(TARGET10[name] - loudest10(x))
    lim = db(-1)
    p = np.abs(x).max()
    if p > lim:
        x = np.tanh(x / lim * 0.9) * lim / np.tanh(0.9) if p > lim * 1.5 else x * lim / p
    fade = int(0.008 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def write(out, name, y):
    out.mkdir(parents=True, exist_ok=True)
    wav = out / f'{name}.wav'
    with wave.open(str(wav), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k', str(out / f'{name}.mp3')], check=True)
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'vorbis', '-strict', '-2', '-ac', '2', '-b:a', '112k', str(out / f'{name}.ogg')], check=True)
    return wav


def features(x):
    pk = np.abs(x).max()
    on = int(np.argmax(np.abs(x) >= pk * 0.03))
    idx = np.nonzero(np.abs(x) >= pk * 0.003)[0]
    dur = (idx[-1] - on) / SR
    x = np.pad(x, (0, int(0.2 * SR)))
    w = int(0.01 * SR)
    env = [int(round(10 * np.log10(np.mean(x[on + i * w:on + (i + 1) * w] ** 2) + 1e-12))) for i in range(12)]
    x = np.pad(x, (0, int(0.2 * SR)))
    seg = x[on:on + 4096]
    seg = np.pad(seg, (0, 4096 - len(seg))) * np.hanning(4096)
    m = np.abs(np.fft.rfft(seg)); f = np.fft.rfftfreq(4096, 1 / SR)
    return dur, int((f * m).sum() / m.sum()), round(20 * np.log10(pk), 1), env


if __name__ == '__main__':
    out = Path(sys.argv[1])
    keep_wav = len(sys.argv) > 2
    for name, fn in EVENTS.items():
        y = finish(fn(), name)
        wav = write(out, name, y)
        d, c, p, env = features(y)
        print(f'{name:14s} dur {d:.3f}s  centroid {c:5d}  peak {p:5.1f}  env10ms {env}')
        if not keep_wav:
            wav.unlink()
