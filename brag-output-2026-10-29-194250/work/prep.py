"""Builds the timeline for the composition from the measured voiceover: scene times on the 120 BPM beat grid,
voice placement, approximate word times (for syncing visuals to what is said), subtitle cues, capture sizes and
element marks. Writes comp/timeline.js, vo/placement.json and ../brag.srt.
Usage: python work/prep.py   (venv with Pillow; reuses the walkthrough pipeline's subtitle splitter)"""
import json, math, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))
sys.path.insert(0, os.path.join(ROOT, "product-walkthrough/pipeline"))
from compose import two_lines, balanced_groups, wrap  # noqa: E402

BEAT = 0.5          # 120 BPM
LEAD = {"s01": 0.35}  # voice starts this long after its scene starts (default below)
TAIL = 0.35         # breathing room after the voice before the cut
MIN = {"s04": 4.0, "s10": 4.0}
HOLD = {"s12": 2.6}  # outro holds the lock-up after the last word

vo = json.load(open(os.path.join(HERE, "vo/audio/index.json")))
order = [x["id"] for x in json.load(open(os.path.join(HERE, "vo/narration.json")))]
scenes, t = [], 0.0
for sid in order:
    lead = LEAD.get(sid, 0.25)
    need = lead + vo[sid]["dur"] + TAIL + HOLD.get(sid, 0)
    dur = max(MIN.get(sid, 0), math.ceil(need / BEAT - 1e-6) * BEAT)
    scenes.append({"id": sid, "t0": round(t, 3), "t1": round(t + dur, 3), "vo": round(t + lead, 3)})
    t += dur
total = round(t, 3)

sent, words, cues = {}, {}, []
for s in scenes:
    a = vo[s["id"]]; base = s["vo"]
    sent[s["id"]] = [[round(base + c["start"], 3), round(base + c["end"], 3), c["text"]] for c in a["cues"]]
    ws = []
    for c0, c1, text in sent[s["id"]]:
        toks = text.split(); n = sum(len(w) + 1 for w in toks); acc = 0
        for w in toks:
            ws.append([w.strip(".,?!;:").lower(), round(c0 + (c1 - c0) * acc / n, 3)]); acc += len(w) + 1
        if two_lines(text): cues.append([c0, c1, "\n".join(two_lines(text))]); continue
        k = math.ceil(len(wrap(text)) / 2)
        while any(two_lines(g) is None for g in balanced_groups(text, k)): k += 1
        groups = balanced_groups(text, k); tot = sum(len(g) for g in groups); tt = c0
        for g in groups:
            d = (c1 - c0) * len(g) / tot; cues.append([round(tt, 3), round(tt + d, 3), "\n".join(two_lines(g))]); tt += d
    words[s["id"]] = ws

caps = os.path.join(HERE, "captures")
sizes = {f[:-4]: Image.open(os.path.join(caps, f)).size for f in sorted(os.listdir(caps)) if f.endswith(".png")}
marks = json.load(open(os.path.join(caps, "manifest.json")))["marks"]

TL = {"duration": total, "fps": 30, "beat": BEAT, "scenes": scenes, "sent": sent, "words": words, "cues": cues, "sizes": sizes, "marks": marks}
os.makedirs(os.path.join(HERE, "comp"), exist_ok=True)
with open(os.path.join(HERE, "comp/timeline.js"), "w") as f: f.write("window.TL = " + json.dumps(TL) + ";\n")
json.dump([{"wav": vo[s["id"]]["wav"], "t": s["vo"]} for s in scenes], open(os.path.join(HERE, "vo/placement.json"), "w"), indent=1)

def srt_time(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
with open(os.path.join(HERE, "../brag.srt"), "w") as f:
    for i, (a, b, txt) in enumerate(cues, 1): f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{txt}\n\n")

for s in scenes: print(f'{s["id"]}  {s["t0"]:6.2f}–{s["t1"]:6.2f}  ({s["t1"] - s["t0"]:.1f}s)  voice {vo[s["id"]]["dur"]:.2f}s')
print("total", total, "s,", len(cues), "subtitle cues,", len(sizes), "captures")
