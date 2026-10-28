# Masques d'effets des variantes. Lancer depuis la racine du dépôt, après decoupe_calques.py puis sans_bandeau.py.
# marge_<clé>.png : TOUTE la bordure blanche (parchemin clair relié au bord), pour Patinée, Étain, Nacre, Holo, Signée.
# foil_<clé>.png  : là où l'holo brille = le fond seulement (ciel, mer, jungle), jamais le personnage.
# fond_<clé>.png  : le fond (1 - sujet), pour la parallaxe, l'ondulation et les particules de la Vivante.
# marge_<clé>.png : masque de toute la bordure blanche (zone parchemin clair reliée au bord de la carte)
import cv2, numpy as np, json
from rembg import remove, new_session   # pip install rembg onnxruntime (modèle isnet-general-use, téléchargé au 1er lancement)
from PIL import Image
info = json.load(open('web/public/cards/calques/calques.json'))
for k in info:
    src = cv2.imread(f'web/public/cards/calques/cadre_{k}.webp', cv2.IMREAD_UNCHANGED)
    bgr = src[..., :3]; hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    pale = ((hsv[..., 2] > 200) & (hsv[..., 1] < 55)).astype(np.uint8) * 255
    x0,y0,x1,y1 = info[k]['fenetre']; tr = src[..., 3] < 128; tr[y0:y1, x0:x1] = False; pale[tr] = 255; pale[y0:y1, x0:x1][src[y0:y1, x0:x1, 3] < 128] = 0
    # composante reliée au bord
    ff = pale.copy(); h, w = ff.shape; mask = np.zeros((h + 2, w + 2), np.uint8)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 2), (w // 2, h - 3), (2, h // 2), (w - 3, h // 2)]:
        if ff[seed[1], seed[0]] == 255: cv2.floodFill(ff, mask, seed, 128)
    marge = (ff == 128).astype(np.uint8) * 255
    marge = cv2.morphologyEx(marge, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    marge = cv2.GaussianBlur(marge, (0, 0), 1.2)
    out = np.zeros((1024, 720, 4), np.uint8); out[..., :3] = 255; out[..., 3] = marge
    cv2.imwrite(f'web/public/cards/calques/marge_{k}.png', cv2.resize(out, (360, 512), interpolation=cv2.INTER_AREA))

S = new_session('isnet-general-use')
for k in info:
    il = Image.open(f'web/public/cards/calques/illu_{k}.jpg').convert('RGB')
    sub = np.array(remove(il, session=S, only_mask=True)).astype(np.float32) / 255
    sub = cv2.dilate(sub, np.ones((9, 9), np.uint8)); sub = cv2.GaussianBlur(sub, (0, 0), 6)
    bg = 1 - np.clip(sub * 1.2, 0, 1)
    if bg.mean() < .12: bg = np.maximum(bg, .35)            # scène sans fond identifiable : holo léger partout
    g = cv2.cvtColor(np.array(il), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    hi = np.clip((g - .25) / .55, 0, 1)
    crest = np.abs(cv2.Laplacian(cv2.GaussianBlur(g, (0, 0), 1.4), cv2.CV_32F)); crest = np.clip(crest * 9, 0, 1)
    foil = np.clip(bg * (.35 + .65 * hi) + bg * crest * .5, 0, 1)
    w2 = 300; h2 = int(il.height * w2 / il.width)
    for name, m in (('foil', foil), ('fond', bg)):
        o = np.zeros((h2, w2, 4), np.uint8); o[..., :3] = 255
        o[..., 3] = cv2.resize((m * 255).astype(np.uint8), (w2, h2), interpolation=cv2.INTER_AREA)
        cv2.imwrite(f'web/public/cards/calques/{name}_{k}.png', o)
    print(k, round(float(bg.mean()), 2))
