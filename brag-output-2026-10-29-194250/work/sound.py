"""Original soundtrack for the brag video, written as one piece: 120 BPM in D major (Bm–G–D–A), with drums, bass,
pad and pluck arpeggio on one beat grid counted from frame 0, and effects tuned to the key and timed from the
composition's events (scene cuts, simulated clicks). The voice is placed from vo/placement.json and the music
ducks under it. numpy only: additive synthesis, FFT filtering, FFT convolution reverb.
Usage: python work/sound.py  ->  work/audio/mix.wav (48 kHz stereo, float), work/audio/music.wav"""
import json, os, subprocess
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.loads(open(os.path.join(HERE, "comp/timeline.js")).read()[len("window.TL = "):].rstrip().rstrip(";"))
EV = json.load(open(os.path.join(HERE, "events.json")))
DUR = TL["duration"]; N = int((DUR + 0.5) * SR)
BEAT, BAR = 0.5, 2.0
rng = np.random.default_rng(7)
SC = {s["id"]: s for s in TL["scenes"]}
GROOVE0, GROOVE1 = SC["s03"]["t0"], SC["s12"]["t0"]          # full groove under the feature scenes
LOCK = TL["sent"]["s12"][1][0] - 0.2 + 0.15                     # outro lock-up lands here

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def st(n): return np.arange(n) / SR
def place(buf, x, t0, gain=1.0):
    i = int(round(t0 * SR));
    if i >= len(buf): return
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), len(buf) - i); buf[i:i + n] += gain * x[:n]
def fft_filter(x, lo=None, hi=None, slope=1.0):
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** (4 * slope))
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (4 * slope))
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=len(x), axis=0)
def env(n, a, r, hold=None):
    t = st(n); e = np.minimum(1, t / max(a, 1e-4))
    if hold is not None: e *= np.where(t > hold, np.exp(-(t - hold) / r), 1)
    else: e *= np.exp(-t / r)
    return e
def saw(f, n, kmax=None, roll=1.15, phase=0.0):
    t = st(n); y = np.zeros(n); K = int(min(kmax or 40, 7000 / f))
    for k in range(1, K + 1): y += np.sin(2 * np.pi * k * f * t + phase * k) / k ** roll
    return y
def stereo(m, pan=0.0): return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], axis=1)

PROG = [[59, 62, 66, 71], [55, 59, 62, 67], [57, 62, 66, 69], [57, 61, 64, 69]]   # Bm, G, D, A
ROOT = [35, 31, 38, 33]                                                              # B1, G1, D2, A1
DMAJ = [57, 62, 66, 69, 74]
def chord_at(bar, t):
    if t >= LOCK - 0.05: return DMAJ, 38
    return PROG[bar % 4], ROOT[bar % 4]

pad = np.zeros((N, 2)); bass = np.zeros(N); arp = np.zeros((N, 2)); drums = np.zeros((N, 2)); sfx = np.zeros((N, 2))

# ---- pad: detuned additive saws, slow attack, one chord per bar; resolves to D at the lock-up
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    t0 = b * BAR
    notes, _ = chord_at(b, t0 + 0.01)
    if LOCK - 0.05 > t0 and LOCK - 0.05 < t0 + BAR: dur = LOCK - t0          # cut the bar short at the resolve
    else: dur = BAR
    if t0 >= LOCK - 0.05: continue
    n = int((dur + 1.2) * SR)
    for i, m in enumerate(notes):
        for d, pan in ((-0.07, -0.6), (0.0, 0.0), (0.07, 0.6)):
            y = saw(mtof(m + d * 0.1), n, kmax=24, roll=1.35, phase=i + d * 10) * env(n, 0.35 if t0 > 0 else 0.7, 0.6, hold=dur)
            place(pad, stereo(y, pan), t0, 0.08 if t0 < SC["s02"]["t0"] else 0.06)
n = int((DUR - LOCK + 0.5) * SR)
for i, m in enumerate(DMAJ):
    for d, pan in ((-0.07, -0.6), (0.0, 0.0), (0.07, 0.6)):
        y = saw(mtof(m + d * 0.1), n, kmax=24, roll=1.35, phase=i) * env(n, 0.25, 1.6, hold=DUR - LOCK - 1.6)
        place(pad, stereo(y, pan), LOCK, 0.095)
pad = fft_filter(pad, lo=110, hi=2600)

# ---- bass: long notes in the reveal, eighth-note pulse under the groove
for b in range(bars):
    t0 = b * BAR
    if t0 < SC["s02"]["t0"] or t0 >= LOCK - 0.05: continue
    _, r = chord_at(b, t0 + 0.01); f = mtof(r + 12)
    if t0 < GROOVE0:
        n = int(BAR * SR); y = (np.sin(2 * np.pi * f * st(n)) + 0.35 * np.sin(4 * np.pi * f * st(n))) * env(n, 0.05, 0.4, hold=BAR - 0.3); place(bass, y, t0, 0.5)
    elif t0 < GROOVE1:
        for k in range(4 * 2):
            tk = t0 + k * 0.25; n = int(0.24 * SR); tt = st(n)
            y = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)) * env(n, 0.004, 0.09, hold=0.12)
            place(bass, y, tk, 0.55 if k % 2 == 0 else 0.4)
n = int((DUR - LOCK + 0.3) * SR); f = mtof(38 + 12)
place(bass, (np.sin(2 * np.pi * f * st(n)) + 0.3 * np.sin(4 * np.pi * f * st(n))) * env(n, 0.02, 1.4, hold=0.4), LOCK, 0.5)

# ---- pluck arpeggio: chord tones an octave up, eighths, with a dotted-eighth ping-pong echo
def pluck(f, n): tt = st(n); return (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(4 * np.pi * f * tt) * np.exp(-tt / 0.05) + 0.2 * np.sin(6 * np.pi * f * tt) * np.exp(-tt / 0.03)) * env(n, 0.003, 0.16)
step = 0.25
for i in range(int(DUR / step)):
    t = i * step
    if t < 0.5 or t > DUR - 0.7: continue
    b = int(t // BAR); notes, _ = chord_at(b, t)
    seq = [notes[0], notes[2], notes[1], notes[3]] if len(notes) > 3 else notes
    m = seq[i % len(seq)] + 12
    g = 0.11 if (t < GROOVE0 or t >= GROOVE1) else 0.13
    if t < SC["s02"]["t0"]: g *= min(1, 0.35 + (t - 0.5) / 2.5)   # fades in through the hook
    if t >= LOCK: g *= 0.8
    y = pluck(mtof(m), int(0.5 * SR))
    pan = -0.35 if i % 2 else 0.35
    place(arp, stereo(y, pan), t, g)
    place(arp, stereo(y, -pan), t + 0.375, g * 0.35)
    place(arp, stereo(y, pan), t + 0.75, g * 0.14)
arp = fft_filter(arp, lo=250, hi=5200)

# ---- drums (groove section only): kick 4-on-the-floor, offbeat hats, soft clap on 2 and 4
def kick(): n = int(0.35 * SR); tt = st(n); f = 45 + 75 * np.exp(-tt / 0.035); ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-tt / 0.16) + 0.12 * rng.standard_normal(n) * np.exp(-tt / 0.004)
def hat(d=0.035): n = int(0.12 * SR); x = rng.standard_normal(n) * np.exp(-st(n) / d); return x
def clap():
    n = int(0.35 * SR); x = np.zeros(n)
    for k, o in enumerate((0, 0.011, 0.022)): s = rng.standard_normal(n - int(o * SR)) * np.exp(-st(n - int(o * SR)) / (0.012 if k < 2 else 0.11)); x[int(o * SR):] += s
    return x
K, Hh, Ho, C = kick(), hat(), hat(0.11), clap()
hats = np.zeros(N); claps = np.zeros(N); kicks = np.zeros(N)
nb = int(DUR / BEAT)
for i in range(nb):
    t = i * BEAT
    if not (GROOVE0 <= t < GROOVE1): continue
    place(kicks, K, t, 0.9)
    place(hats, Hh, t + 0.25, 0.22 if i % 2 else 0.18)
    place(hats, Hh, t + 0.125, 0.06); place(hats, Hh, t + 0.375, 0.07)
    if i % 2 == 1: place(claps, C, t, 0.32)
    if t >= SC["s11"]["t0"]: place(hats, Ho, t + 0.25, 0.08)
for t in np.arange(SC["s02"]["t0"] + 3.0, GROOVE0, BEAT): place(kicks, K, t, 0.35)   # soft heartbeat into the groove
hats = fft_filter(hats, lo=6500); claps = fft_filter(claps, lo=900, hi=7000)
drums = stereo(kicks, 0) + stereo(hats, 0.25) + stereo(claps, -0.1)

# ---- effects, in the key and on the grid: air whoosh into each cut, a tuned tick on clicks, booms on the two reveals
wn = int(0.55 * SR); w = rng.standard_normal(wn); tw = st(wn); w *= np.where(tw < 0.45, (tw / 0.45) ** 2.2, np.exp(-(tw - 0.45) / 0.05))
w = fft_filter(w, lo=700, hi=5500)
for i, c in enumerate(EV["cuts"][1:]): place(sfx, stereo(w, -0.4 if i % 2 else 0.4), c - 0.45, 0.10)
tn = int(0.12 * SR); tk = (np.sin(2 * np.pi * mtof(86) * st(tn)) + 0.3 * np.sin(2 * np.pi * mtof(93) * st(tn))) * env(tn, 0.001, 0.022)   # D6 + A6
for c in EV["clicks"]: place(sfx, stereo(tk, 0.15), c, 0.11)
def boom(): n = int(2.2 * SR); tt = st(n); f = mtof(38) * (1 + 0.6 * np.exp(-tt / 0.06)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.7)
for tb in (SC["s02"]["t0"], LOCK): place(sfx, stereo(boom(), 0), tb, 0.5)
rn = int(1.6 * SR); rz = rng.standard_normal(rn) * (st(rn) / 1.6) ** 3; rz = fft_filter(rz, lo=1500, hi=9000)
place(sfx, stereo(rz, 0), SC["s02"]["t0"] - 1.6, 0.07)

# ---- space: one shared convolution reverb (stereo IR of decaying noise)
irn = int(2.0 * SR); ir = rng.standard_normal((irn, 2)) * np.exp(-st(irn) / 0.45)[:, None]; ir = fft_filter(ir, lo=200, hi=6000); ir /= np.sqrt((ir ** 2).sum())
def reverb(x):
    L = len(x) + irn; nf = 1 << (L - 1).bit_length()
    out = np.fft.irfft(np.fft.rfft(x, nf, axis=0) * np.fft.rfft(ir, nf, axis=0), nf, axis=0)[:len(x)]
    return out
send = 0.35 * pad + 0.5 * arp + 0.35 * sfx + stereo(claps, 0) * 0.25
wet = reverb(send)

# ---- sidechain pump on pad, bass and arp under the groove
pump = np.ones(N); tt = st(N)
for i in range(nb):
    t = i * BEAT
    if GROOVE0 <= t < GROOVE1:
        a = int(t * SR); b = min(N, a + int(0.45 * SR)); pump[a:b] = np.minimum(pump[a:b], 1 - 0.35 * np.exp(-(tt[a:b] - t) / 0.13))
music = (pad + arp) * pump[:, None] + stereo(bass * pump, 0) + drums + wet * 0.55
music_stems = music.copy()
music += sfx

# ---- voice, and ducking the music under it
vo = np.zeros(N)
for p in json.load(open(os.path.join(HERE, "vo/placement.json"))):
    tmp = os.path.join(HERE, "audio", "vo48.wav"); os.makedirs(os.path.dirname(tmp), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", p["wav"], "-ar", str(SR), "-ac", "1", "-af", "aresample=resampler=soxr", tmp], check=True)
    v, _ = sf.read(tmp, dtype="float64"); place(vo, v, p["t"])
vo = fft_filter(vo, lo=85)                                            # nothing useful in speech below ~85 Hz
fr = int(0.01 * SR); nfr = N // fr
rms = np.sqrt((vo[: nfr * fr].reshape(nfr, fr) ** 2).mean(axis=1))
envv = np.zeros(nfr); e = 0.0
for i in range(nfr):
    a = 0.35 if rms[i] > e else 0.03                     # ~30 ms attack, ~330 ms release
    e += a * (rms[i] - e); envv[i] = e
duck = 1 - 0.58 * np.clip(envv / (envv.max() * 0.25 + 1e-9), 0, 1)
duck = np.interp(np.arange(N), np.arange(nfr) * fr, duck)

def norm(x, rms_db):
    r = np.sqrt((x ** 2).mean()); return x * (10 ** (rms_db / 20) / max(r, 1e-9))
music = norm(fft_filter(music, lo=30), -21.5) * duck[:, None]
voiced = np.abs(vo) > 1e-4
vo *= 10 ** (-16.5 / 20) / np.sqrt((vo[voiced] ** 2).mean())        # speech ~8 dB over the music bed, more while ducked
mix = music + stereo(vo, 0) * np.sqrt(2)
fade = np.ones(N); fl = int(1.2 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 2; mix *= fade[:, None]
mix = mix[: int(DUR * SR)]
# Look-ahead peak limiter: gain from the 3 ms-ahead peak, held and smoothed, so transients never clip.
pk = np.abs(mix).max(axis=1); w = int(0.003 * SR)
ahead = np.maximum.reduce([np.roll(pk, -k) for k in range(0, w, 8)])
g = np.minimum(1.0, 0.7 / np.maximum(ahead, 1e-9))
gs = np.minimum.reduce([np.roll(g, k) for k in range(0, int(0.01 * SR), 16)])          # hold ~10 ms
kern = np.ones(int(0.004 * SR)) / int(0.004 * SR); gs = np.convolve(gs, kern, mode="same")
mix *= gs[:, None]
peak = np.abs(mix).max(); mix *= 0.89 / peak
os.makedirs(os.path.join(HERE, "audio"), exist_ok=True)
sf.write(os.path.join(HERE, "audio/mix.wav"), mix.astype(np.float32), SR, subtype="FLOAT")
sf.write(os.path.join(HERE, "audio/music.wav"), (norm(music_stems, -20)[: int(DUR * SR)] * 0.9).astype(np.float32), SR, subtype="FLOAT")
print(f"mix {len(mix) / SR:.2f}s, peak before trim {peak:.2f}, lock-up {LOCK:.2f}s, groove {GROOVE0}–{GROOVE1}s")
