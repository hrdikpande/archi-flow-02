"""Contact sheets for checking a recording: one tile per step showing the step's final frame with
camera (blue), highlight (orange) and cursor (red) drawn on top. Usage: python3 preview.py BUILD [chapter ...]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
B = sys.argv[1]; only = sys.argv[2:]
tl = json.load(open(os.path.join(B, 'timeline.json')))
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 18)
out = os.path.join(B, 'preview'); os.makedirs(out, exist_ok=True)
for ch in tl['chapters']:
    if only and ch['id'] not in only: continue
    tiles = []; cur = None; cursor = None; cam = None; hl = None
    for st in ch['steps']:
        hl = None
        for e in st['events']:
            if e['k'] == 'shot': cur = e['f']
            elif e['k'] == 'move': cursor = (e['x'], e['y'])
            elif e['k'] == 'cam': cam = e.get('rect')
            elif e['k'] == 'hl': hl = e['rect']
        if not cur: continue
        im = Image.open(os.path.join(B, 'frames', cur)).convert('RGB').resize((960, 540))
        d = ImageDraw.Draw(im); s = 960 / 1440
        if cam: d.rectangle([cam['x']*s, cam['y']*s, (cam['x']+cam['w'])*s, (cam['y']+cam['h'])*s], outline=(30,120,255), width=3)
        if hl: d.rectangle([hl['x']*s-3, hl['y']*s-3, (hl['x']+hl['w'])*s+3, (hl['y']+hl['h'])*s+3], outline=(255,140,0), width=3)
        if cursor: d.ellipse([cursor[0]*s-7, cursor[1]*s-7, cursor[0]*s+7, cursor[1]*s+7], outline=(230,0,0), width=3)
        d.rectangle([0, 0, 960, 30], fill=(0,0,0)); d.text((8, 4), f"{st['id']}  {st['say'][:80]}", fill=(255,255,255), font=font)
        tiles.append(im)
    for gi in range(0, len(tiles), 4):
        g = Image.new('RGB', (1920, 1080), 'white')
        for k, t in enumerate(tiles[gi:gi+4]): g.paste(t, ((k % 2) * 960, (k // 2) * 540))
        g.save(os.path.join(out, f"{ch['id']}_{gi//4}.jpg"), quality=85)
    print(ch['id'], len(tiles), 'tiles')
