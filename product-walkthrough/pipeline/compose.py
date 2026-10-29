"""Compositor: turns BUILD/timeline.json (recorded keyframes and events) plus BUILD/audio/index.json
(narration) into the final MP4. Steps are paced by their narration: actions start with the voice,
and a step ends when both its actions and its narration are done.

  python compose.py BUILD plan            -> BUILD/schedule.json (times for every event)
  python compose.py BUILD render [N]      -> BUILD/parts/chNN.mp4, N worker processes (default 3)
  python compose.py BUILD mux OUT.mp4     -> narration mix, subtitles, chapter marks, final file
  python compose.py BUILD all OUT.mp4     -> all three
BURN_SUBS=1 draws the subtitles into the picture (open captions) and turns the soft track off by default;
WT_TITLE sets the file's title metadata.
"""
import bisect, json, math, os, subprocess, sys
from concurrent.futures import ProcessPoolExecutor
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FPS = 30
W, H = 1920, 1080
VW, VH = 1440, 810            # CSS viewport of the recording
SRC_SCALE = 2                 # keyframes are 2880x1620
FONT_DIR = "/usr/share/fonts/opentype/inter"
ACCENT = (245, 158, 11)       # highlight ring (amber), distinct from the product's blue
RIPPLE = (11, 95, 165)

TRANS = {"fade": 0.55, "cut": 0.16, "none": 0.0}

# ---------------------------------------------------------------- planning
def ease(t):  # ease-in-out cubic
    t = max(0.0, min(1.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - pow(-2 * t + 2, 3) / 2

def cam_rect(e):
    """Target camera rect (CSS px) for a zoom event, 16:9, clamped to the viewport."""
    r = e.get("rect")
    if not r: return [0, 0, VW, VH]
    pad = e.get("pad", 28); mx = e.get("max", 1.6)
    x, y, w, h = r["x"] - pad, r["y"] - pad, r["w"] + 2 * pad, r["h"] + 2 * pad
    zoom = min(VW / w, VH / h, mx)
    if zoom < 1.08: return [0, 0, VW, VH]
    cw, ch = VW / zoom, VH / zoom
    cx = x + w / 2; cy = y + h / 2
    left = cx - cw / 2
    top = (y + 8 - (pad - 8) * 0) if e.get("anchor") == "top" else cy - ch / 2
    if e.get("anchor") == "top": top = r["y"] - min(pad, 24)
    left = max(0, min(VW - cw, left)); top = max(0, min(VH - ch, top))
    return [round(left, 2), round(top, 2), round(cw, 2), round(ch, 2)]

def plan(B):
    tl = json.load(open(os.path.join(B, "timeline.json")))
    au = json.load(open(os.path.join(B, "audio", "index.json")))
    S = {"bases": [], "cams": [], "moves": [], "clicks": [], "hls": [], "lts": [], "voice": [], "subs": [], "chapters": [], "steps": []}
    t = 0.0
    cam = [0, 0, VW, VH]; cam_free = 0.0
    cursor = [VW * 0.62, VH * 0.55]
    for ci, ch in enumerate(tl["chapters"]):
        S["chapters"].append({"t": round(t, 3), "num": ch["num"], "title": ch["title"], "id": ch["id"]})
        if cam != [0, 0, VW, VH]:  # every chapter opens on a full-frame card: reset the camera under it
            S["cams"].append({"t": round(max(t, cam_free), 3), "d": 0.01, "a": cam, "b": [0, 0, VW, VH]})
            cam = [0, 0, VW, VH]; cam_free = t
        for st in ch["steps"]:
            a = au.get(st["id"], {"dur": 0, "wav": None, "cues": []})
            t0 = t
            lead = st.get("lead") if st.get("lead") is not None else 0.35
            v0 = t0 + lead
            if a.get("wav"): S["voice"].append({"t": round(v0, 3), "wav": a["wav"]})
            for c in a.get("cues", []): S["subs"].append({"t0": round(v0 + c["start"], 3), "t1": round(v0 + c["end"], 3), "text": c["text"]})
            ct = t0
            hl_open = None
            for e in st["events"]:
                k = e["k"]
                if k == "shot":
                    tr = e.get("trans", "fade")
                    d = TRANS.get(tr, 0.3)
                    S["bases"].append({"t": round(ct, 3), "f": e["f"], "trans": tr, "td": d, "card": bool(e.get("card"))})
                    ct += d if tr != "none" else e.get("dur", 0.06)
                elif k == "move":
                    dist = math.hypot(e["x"] - cursor[0], e["y"] - cursor[1])
                    if dist < 2: continue
                    d = max(0.42, min(0.95, 0.38 + dist / 1500))
                    S["moves"].append({"t": round(ct, 3), "d": d, "a": list(cursor), "b": [e["x"], e["y"]]})
                    cursor = [e["x"], e["y"]]; ct += d
                elif k == "click":
                    S["clicks"].append({"t": round(ct, 3), "x": e["x"], "y": e["y"]}); ct += 0.24
                elif k == "cam":
                    target = cam_rect(e)
                    if target != cam:
                        start = max(ct, cam_free)
                        S["cams"].append({"t": round(start, 3), "d": 0.9, "a": cam, "b": target})
                        cam = target; cam_free = start + 0.9
                        ct = max(ct, start + 0.25)
                elif k == "hl":
                    if hl_open: hl_open["t1"] = round(ct, 3)
                    r = e["rect"]; p = e.get("pad", 6)
                    hl_open = {"t0": round(ct + 0.1, 3), "t1": None, "r": [r["x"] - p, r["y"] - p, r["w"] + 2 * p, r["h"] + 2 * p]}
                    S["hls"].append(hl_open)
                elif k == "hloff":
                    if hl_open: hl_open["t1"] = round(ct, 3); hl_open = None
                elif k == "pause":
                    ct += e["s"]
                elif k == "lt":
                    S["lts"].append({"t0": round(ct + 0.2, 3), "t1": round(ct + 4.9, 3), "title": e["title"], "sub": e["sub"]})
            gap = st.get("gap") if st.get("gap") is not None else 0.55
            end = max(ct + 0.7, v0 + a["dur"] + gap, t0 + (st.get("minDur") or 0))
            if hl_open and hl_open["t1"] is None: hl_open["t1"] = round(end - 0.15, 3)
            S["steps"].append({"id": st["id"], "t0": round(t0, 3), "t1": round(end, 3), "say": st["say"]})
            t = end
        t += 0.25
    S["duration"] = round(t + 1.2, 3)
    # Cursor is hidden while a card is on screen.
    json.dump(S, open(os.path.join(B, "schedule.json"), "w"), indent=0)
    print(f"planned {len(S['steps'])} steps, {len(S['bases'])} keyframes, duration {S['duration'] / 60:.2f} min")
    return S

# ---------------------------------------------------------------- drawing helpers
def cursor_sprite():
    s = 4; h = 30 * s
    pts = [(0, 0), (0, 22), (5.2, 17.2), (8.6, 25.2), (12.2, 23.6), (8.8, 15.8), (15.6, 15.6)]
    img = Image.new("RGBA", (22 * s, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    P = [(x * s + 2 * s, y * s + 2 * s) for x, y in pts]
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0)); ImageDraw.Draw(shadow).polygon([(x + 1.5 * s, y + 2 * s) for x, y in P], fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.2 * s))
    img = Image.alpha_composite(img, shadow); d = ImageDraw.Draw(img)
    d.polygon(P, fill=(255, 255, 255, 255)); d.line(P + [P[0]], fill=(255, 255, 255, 255), width=int(3.2 * s))
    inner = [(x * s + 2 * s, y * s + 2 * s) for x, y in [(1.6, 3.6), (1.6, 18.2), (5.6, 14.4), (9.2, 22.6), (10.6, 21.9), (7.1, 13.9), (12.2, 13.8)]]
    d.polygon(inner, fill=(18, 24, 33, 255))
    return img.resize((22, 30), Image.LANCZOS)

def font(size, bold=False):
    return ImageFont.truetype(os.path.join(FONT_DIR, "Inter-SemiBold.otf" if bold else "Inter-Regular.otf"), size)

BURN_SUBS = os.environ.get("BURN_SUBS", "0") == "1"   # draw subtitles into the picture (open captions)

@lru_cache(maxsize=256)
def subtitle_image(text):
    f = font(34, True)
    lines = text.split("\n")
    lh = 46; pad_x, pad_y = 22, 10
    w = int(max(f.getlength(l) for l in lines)) + 2 * pad_x
    h = lh * len(lines) + 2 * pad_y
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 10, fill=(10, 16, 24, 205))
    for i, l in enumerate(lines):
        lw = f.getlength(l)
        d.text(((w - lw) / 2, pad_y + i * lh + 4), l, font=f, fill=(255, 255, 255, 255))
    return img

@lru_cache(maxsize=64)
def lower_third(title, sub):
    f1, f2 = font(30, True), font(22)
    w = int(max(f1.getlength(title), f2.getlength(sub))) + 64
    h = 92
    img = Image.new("RGBA", (w + 20, h + 20), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([10, 14, w + 10, h + 14], 14, fill=(0, 0, 0, 90))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, w + 10, h + 10], 14, fill=(13, 27, 42, 236))
    d.rounded_rectangle([10, 10, 17, h + 10], 3, fill=(90, 167, 232, 255))
    d.text((40, 22), title, font=f1, fill=(255, 255, 255, 255))
    d.text((40, 60), sub, font=f2, fill=(185, 199, 216, 255))
    return img

# ---------------------------------------------------------------- frame state
class Track:
    def __init__(self, S, B):
        self.S = S; self.B = B
        self.bases = S["bases"]; self.cams = S["cams"]; self.moves = S["moves"]
        self.btimes = [b["t"] for b in self.bases]
    def base_at(self, t):
        import bisect
        i = bisect.bisect_right(self.btimes, t) - 1
        if i < 0: return None, None, 1.0, True
        b = self.bases[i]
        if b["trans"] != "none" and b["td"] > 0 and t - b["t"] < b["td"] and i > 0:
            return self.bases[i - 1], b, ease((t - b["t"]) / b["td"]), b["card"] or self.bases[i - 1]["card"]
        return None, b, 1.0, b["card"]
    def cam_at(self, t):
        cur = [0, 0, VW, VH]
        for c in self.cams:
            if t < c["t"]: break
            if t < c["t"] + c["d"]:
                k = ease((t - c["t"]) / c["d"])
                return [c["a"][j] + (c["b"][j] - c["a"][j]) * k for j in range(4)]
            cur = c["b"]
        return cur
    def cursor_at(self, t):
        pos = None
        for m in self.moves:
            if t < m["t"]:
                if pos is None: pos = m["a"]
                break
            if t < m["t"] + m["d"]:
                k = ease((t - m["t"]) / m["d"])
                return [m["a"][0] + (m["b"][0] - m["a"][0]) * k, m["a"][1] + (m["b"][1] - m["a"][1]) * k]
            pos = m["b"]
        return pos or [VW * 0.62, VH * 0.55]

class Renderer:
    def __init__(self, B, S):
        self.B = B; self.T = Track(S, B); self.S = S
        self.cur = cursor_sprite()
        self._img = {}; self._scaled = {}
        self.cues = subtitle_cues(S) if BURN_SUBS else []
        self.cue_t = [c[0] for c in self.cues]
    def src(self, f):
        if f not in self._img:
            if len(self._img) > 6: self._img.pop(next(iter(self._img)))
            self._img[f] = Image.open(os.path.join(self.B, "frames", f)).convert("RGB")
        return self._img[f]
    def view(self, f, cam):
        key = (f, tuple(round(v, 1) for v in cam))
        if key not in self._scaled:
            if len(self._scaled) > 8: self._scaled.pop(next(iter(self._scaled)))
            box = tuple(v * SRC_SCALE for v in (cam[0], cam[1], cam[0] + cam[2], cam[1] + cam[3]))
            self._scaled[key] = self.src(f).resize((W, H), Image.LANCZOS if cam == [0, 0, VW, VH] else Image.BICUBIC, box=box)
        return self._scaled[key]
    def frame(self, t):
        prev, b, k, card = self.T.base_at(t)
        if b is None: return Image.new("RGB", (W, H), (13, 27, 42))
        cam = self.T.cam_at(t)
        camc = [0, 0, VW, VH] if b["card"] else cam
        img = self.view(b["f"], camc)
        if prev is not None and k < 1:
            pc = [0, 0, VW, VH] if prev["card"] else cam
            img = Image.blend(self.view(prev["f"], pc), img, k)
        else:
            img = img.copy()
        sx = W / cam[2]; sy = H / cam[3]
        to_out = lambda x, y: ((x - cam[0]) * sx, (y - cam[1]) * sy)
        on_app = not b["card"]
        d = ImageDraw.Draw(img, "RGBA")
        if on_app:
            for h in self.S["hls"]:
                if h["t0"] <= t <= h["t1"]:
                    a = min(1, (t - h["t0"]) / 0.25, (h["t1"] - t) / 0.25)
                    x0, y0 = to_out(h["r"][0], h["r"][1]); x1, y1 = to_out(h["r"][0] + h["r"][2], h["r"][1] + h["r"][3])
                    d.rounded_rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], 10, outline=ACCENT + (int(70 * a),), width=9)
                    d.rounded_rectangle([x0, y0, x1, y1], 8, outline=ACCENT + (int(255 * a),), width=4)
            for c in self.S["clicks"]:
                if c["t"] <= t <= c["t"] + 0.5:
                    p = (t - c["t"]) / 0.5; r = 8 + 26 * ease(p)
                    cx, cy = to_out(c["x"], c["y"])
                    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=RIPPLE + (int(200 * (1 - p)),), width=4)
                    if p < 0.35: d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=RIPPLE + (int(110 * (1 - p / 0.35)),))
            cx, cy = to_out(*self.T.cursor_at(t))
            if -40 < cx < W and -40 < cy < H: img.paste(self.cur, (int(cx) - 2, int(cy) - 2), self.cur)
        for L in self.S["lts"]:
            if L["t0"] <= t <= L["t1"] and on_app:
                a = min(1, (t - L["t0"]) / 0.35, (L["t1"] - t) / 0.35)
                lt = lower_third(L["title"], L["sub"])
                if a < 1:
                    lt = lt.copy(); lt.putalpha(lt.getchannel("A").point(lambda v: int(v * a)))
                img.paste(lt, (34, H - lt.height - (170 if BURN_SUBS else 30) + int((1 - a) * 14)), lt)
        if self.cues:
            i = bisect.bisect_right(self.cue_t, t) - 1
            if i >= 0 and t <= self.cues[i][1]:
                sub = subtitle_image(self.cues[i][2])
                img.paste(sub, ((W - sub.width) // 2, H - sub.height - 30), sub)
        return img

def render_part(args):
    B, idx, t0, t1 = args
    S = json.load(open(os.path.join(B, "schedule.json")))
    R = Renderer(B, S)
    os.makedirs(os.path.join(B, "parts"), exist_ok=True)
    out = os.path.join(B, "parts", f"ch{idx:02d}.mp4")
    f0, f1 = round(t0 * FPS), round(t1 * FPS)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", os.environ.get("X264_PRESET", "slower"), "-crf", os.environ.get("X264_CRF", "29"), "-tune", os.environ.get("X264_TUNE", "animation"),
           "-x264-params", "keyint=300:min-keyint=15:scenecut=40", "-pix_fmt", "yuv420p", "-threads", "2", "-r", str(FPS), out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    last_key = None; last_bytes = None
    for fi in range(f0, f1):
        t = fi / FPS
        img = R.frame(t)
        p.stdin.write(img.tobytes())
    p.stdin.close(); p.wait()
    return out, f1 - f0

def render(B, workers=3):
    S = json.load(open(os.path.join(B, "schedule.json")))
    chs = S["chapters"]; parts = []
    for i, c in enumerate(chs):
        t0 = c["t"]; t1 = chs[i + 1]["t"] if i + 1 < len(chs) else S["duration"]
        parts.append((B, i, t0, t1))
    only = os.environ.get("ONLY_PARTS")
    todo = [p for p in parts if not only or str(p[1]) in only.split(",")]
    with ProcessPoolExecutor(max_workers=workers) as ex:
        for out, n in ex.map(render_part, sorted(todo, key=lambda p: -(p[3] - p[2]))):
            print("rendered", os.path.basename(out), n, "frames", flush=True)
    with open(os.path.join(B, "parts", "list.txt"), "w") as f:
        for i in range(len(parts)): f.write(f"file 'ch{i:02d}.mp4'\n")

# ---------------------------------------------------------------- audio, subtitles, chapters, mux
def click_sound(sr):
    n = int(0.03 * sr); t = np.arange(n) / sr
    s = (np.random.RandomState(7).randn(n) * np.exp(-t * 260) * 0.5 + np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 400) * 0.6)
    return (s * 0.10).astype(np.float32)

def srt_time(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def wrap(text, width=64):
    words = text.split(); lines = [""]
    for w in words:
        if len(lines[-1]) + len(w) + 1 > width and lines[-1]: lines.append(w)
        else: lines[-1] = (lines[-1] + " " + w).strip()
    return lines

def subtitle_cues(S):
    cues = []
    for s in S["subs"]:
        lines = wrap(s["text"])
        if len(lines) <= 2: cues.append((s["t0"], s["t1"], "\n".join(lines))); continue
        # Split long sentences into two-line cues, timed by character share.
        chunks = ["\n".join(lines[i:i + 2]) for i in range(0, len(lines), 2)]
        total = sum(len(c) for c in chunks); t = s["t0"]
        for c in chunks:
            d = (s["t1"] - s["t0"]) * len(c) / total; cues.append((t, t + d, c)); t += d
    return cues

def mux(B, out):
    import soundfile as sf
    S = json.load(open(os.path.join(B, "schedule.json")))
    sr = 24000; n = int((S["duration"] + 1) * sr)
    mix = np.zeros(n, np.float32)
    for v in S["voice"]:
        a, r = sf.read(v["wav"], dtype="float32"); i = int(v["t"] * sr); mix[i:i + len(a)] += a[: n - i]
    ck = click_sound(sr)
    for c in S["clicks"]:
        i = int(c["t"] * sr); mix[i:i + len(ck)] += ck[: n - i]
    peak = np.max(np.abs(mix)) or 1; mix = mix / peak * 0.89
    wav = os.path.join(B, "narration-mix.wav"); sf.write(wav, mix, sr)
    cues = subtitle_cues(S)
    srt = os.path.join(B, "captions.srt")
    with open(srt, "w") as f:
        for i, (a, b, txt) in enumerate(cues, 1): f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{txt}\n\n")
    meta = os.path.join(B, "chapters.ffmeta")
    with open(meta, "w") as f:
        f.write(f";FFMETADATA1\ntitle={os.environ.get('WT_TITLE', 'DrawingOps · complete product walkthrough')}\nartist=LatentIQ\ncomment=Recorded in the interactive DrawingOps prototype with fictional data.\n")
        ch = S["chapters"]
        for i, c in enumerate(ch):
            end = ch[i + 1]["t"] if i + 1 < len(ch) else S["duration"]
            f.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(c['t'] * 1000)}\nEND={int(end * 1000)}\ntitle={c['num']} {c['title']}\n")
    video = os.path.join(B, "video-only.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(B, "parts", "list.txt"), "-c", "copy", video], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", wav, "-i", srt, "-i", meta,
                    "-map", "0:v", "-map", "1:a", "-map", "2:s", "-map_metadata", "3", "-map_chapters", "3",
                    "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=24000,alimiter=limit=0.84:level=false", "-c:a", "aac", "-b:a", os.environ.get("AUDIO_BITRATE", "48k"), "-ar", "24000", "-ac", "1",
                    "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:a:0", "language=eng",
                    # with burned-in subtitles the soft track stays available but off, so players never show captions twice
                    *(["-disposition:s:0", "0"] if BURN_SUBS else []),
                    "-movflags", "+faststart", "-shortest", out], check=True)
    print("wrote", out)

if __name__ == "__main__":
    B = sys.argv[1]; cmd = sys.argv[2]
    if cmd in ("plan", "all"): plan(B)
    if cmd == "render": render(B, int(sys.argv[3]) if len(sys.argv) > 3 else 3)
    if cmd == "all": render(B, int(os.environ.get("WORKERS", "3")))
    if cmd in ("mux", "all"): mux(B, sys.argv[3] if cmd == "mux" else sys.argv[3])
