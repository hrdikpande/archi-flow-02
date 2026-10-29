"""Narration: one WAV per step from BUILD/narration.json, using Kokoro-82M (Apache-2.0) offline via
kokoro-onnx. Each step is synthesised sentence by sentence so subtitles get exact timings.

Model files (see README): KOKORO_MODEL (model_quantized.onnx, from the kokoro-q8-shards npm
package) and KOKORO_VOICES (voices.npz built from the kokoro-js npm package's voices/*.bin).
Usage: python tts.py BUILD [--voice af_heart] [--speed 1.0]"""
import hashlib, json, os, re, sys
import numpy as np
import soundfile as sf

BUILD = sys.argv[1]
VOICE = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else "af_heart"
SPEED = float(sys.argv[sys.argv.index("--speed") + 1]) if "--speed" in sys.argv else 1.0
MODEL = os.environ.get("KOKORO_MODEL", "kokoro-q8.onnx")
VOICES = os.environ.get("KOKORO_VOICES", "voices.npz")
CACHE = os.environ.get("TTS_CACHE", os.path.join(BUILD, "tts-cache"))
SR = 24000
GAP = 0.30  # seconds between sentences

# Pronunciation fixes, applied to the spoken text only (subtitles keep the written form).
WORDS = [
    (r"\bDrawingOps\b", "Drawing Ops"), (r"\bMEP\b", "M E P"), (r"\bM E P\b", "M E P"),
    (r"\bRFIs\b", "R F I's"), (r"\bRFI\b", "R F I"), (r"\bBCF\b", "B C F"), (r"\bQC\b", "Q C"), (r"\bGFC\b", "G F C"),
    (r"\bCSV\b", "C S V"), (r"\bPDFs\b", "P D Fs"), (r"\bICU\b", "I C U"), (r"\bOT\b", "O T"), (r"\bSSO\b", "S S O"),
    (r"\bLatentIQ\b", "Latent I Q"), (r"scan_0042", "scan underscore zero zero four two"), (r"\bHEPA\b", "hepa"), (r"\bOPD\b", "O P D"), (r"\bISO 19650\b", "I S O nineteen six fifty"), (r"\bJSON\b", "Jason"),
    (r"\bSunita\b", "Suneeta"), (r"\bAsha\b", "Aasha"), (r"\bPrasad\b", "Prasaad"), (r"\bMysuru\b", "Mysooru"),
    (r"\bJayanagar\b", "Jaya-nagar"), (r"\blakh\b", "laakh"), (r"\bIyer\b", "Eye-er"), (r"\bNavjeevan\b", "Nav-jeevan"),
    (r"\bKoramangala\b", "Kora-mungala"), (r"\bWIP\b", "work in progress"), (r"\be\.g\.", "for example"),
    (r"\bvs\.?\b", "versus"), (r"\bDL\b", "discipline lead"), (r"\bPL\b", "project lead"), (r"\bDC\b", "document controller"),
]
DIG = "zero one two three four five six seven eight nine".split()
TEENS = "ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def two(n):
    if n < 10: return DIG[n]
    if n < 20: return TEENS[n - 10]
    return TENS[n // 10] + ("" if n % 10 == 0 else " " + DIG[n % 10])
def sheet_no(m):
    letter, num = m.group(1), m.group(2)
    letter = {"A": "Ay"}.get(letter, letter)
    a, rest = int(num[0]), int(num[1:])
    tail = ("oh " + DIG[rest]) if rest < 10 else two(rest)
    return f"{letter} {DIG[a]} {tail}"
def normalise(t):
    t = re.sub(r"\b([A-Z])-(\d{3})\b", sheet_no, t)
    t = re.sub(r"₹\s?([\d,]+)", lambda m: rupees(m.group(1)), t)
    for a, b in WORDS: t = re.sub(a, b, t)
    t = t.replace("…", "...").replace("–", ", ").replace("—", ", ")
    return t
def rupees(s):
    n = int(s.replace(",", ""))
    if n >= 10000000 and n % 100000 == 0: return f"{n / 10000000:g} crore rupees"
    if n >= 100000: return f"{n / 100000:g} laakh rupees"
    return f"{n:,} rupees"

def sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“])", text.strip())
    return [p.strip() for p in parts if p.strip()]

def main():
    from kokoro_onnx import Kokoro
    os.makedirs(CACHE, exist_ok=True)
    out_dir = os.path.join(BUILD, "audio"); os.makedirs(out_dir, exist_ok=True)
    items = json.load(open(os.path.join(BUILD, "narration.json")))
    k = None
    index = {}
    for it in items:
        sents = sentences(it["say"])
        cues, chunks, t = [], [], 0.0
        for s in sents:
            spoken = normalise(s)
            key = hashlib.sha1(f"{VOICE}|{SPEED}|{spoken}".encode()).hexdigest()[:20]
            cp = os.path.join(CACHE, key + ".wav")
            if not os.path.exists(cp):
                if k is None: k = Kokoro(MODEL, VOICES)
                audio, sr = k.create(spoken, voice=VOICE, speed=SPEED, lang="en-us")
                assert sr == SR
                audio = np.asarray(audio, dtype=np.float32)
                nz = np.where(np.abs(audio) > 0.004)[0]
                if len(nz): audio = audio[max(0, nz[0] - 240): nz[-1] + 1200]
                sf.write(cp, audio, SR)
            a, _ = sf.read(cp, dtype="float32")
            if chunks: chunks.append(np.zeros(int(GAP * SR), np.float32)); t += GAP
            cues.append({"text": s, "start": round(t, 3), "end": round(t + len(a) / SR, 3)})
            chunks.append(a); t += len(a) / SR
        wav = os.path.join(out_dir, it["id"] + ".wav")
        if chunks: sf.write(wav, np.concatenate(chunks), SR)
        index[it["id"]] = {"wav": wav if chunks else None, "dur": round(t, 3), "cues": cues}
        print(f"{it['id']:16} {t:6.2f}s  {len(sents)} sentences")
    json.dump(index, open(os.path.join(BUILD, "audio", "index.json"), "w"), indent=1)
    print("total narration", round(sum(v["dur"] for v in index.values()) / 60, 2), "min")

if __name__ == "__main__":
    main()
