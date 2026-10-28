# Cartes de personnages SANS bandeau : la fenêtre descend jusqu'au bas du cadre,
# le parchemin et ses morceaux sur les bords sont retirés du calque cadre.
import cv2, numpy as np, json
SRC = 'web/public/cards/sources'  # images d'origine ; lancer depuis la racine du dépôt, après decoupe_calques.py
# CON est un nom de périphérique réservé sous Windows : la carte Con le belliqueux est le fichier corbin.webp (comme web/src/cards.ts)
FICHIER = {'con': 'corbin'}
CARDS = {  # médaillon du bas (cx,cy,r), point focal horizontal de l'illustration (0..1)
 'rosie': ((595,885,100), .5), 'rascal': ((595,885,100), .5), 'juanita': ((595,885,100), .5), 'harry': ((595,885,100), .6),
 'mary': ((595,885,100), .5), 'tigress': ((595,885,100), .5), 'con': ((595,885,100), .45),
 'sk': ((588,905,98), .5), 'mermaid0': ((602,892,98), .5), 'mermaid1': ((602,892,98), .5), 'bahij': ((122,912,88), .47),
}
TOPMEDS = {'default': [(119,119,86),(612,108,80)], 'mermaid0': [(95,100,95),(625,100,92)], 'mermaid1': [(95,100,95),(625,100,92)],
 'sk': [(140,135,104),(605,105,82),(60,200,64),(665,160,62),(250,75,56)], 'bahij': [(612,108,92)]}
X0, Y0, X1, YT, YB = 96, 98, 624, 690, 925      # fenêtre : haut 98, ancien bas 690, nouveau bas 925
info = json.load(open('web/public/cards/calques/calques.json'))
def mirror_tile(strip, n):
    out = []; src = np.concatenate([strip, strip[::-1]], 0)
    while sum(s.shape[0] for s in out) < n: out.append(src)
    return np.concatenate(out, 0)[:n]
for k, (bm, fx) in CARDS.items():
    im = cv2.resize(cv2.imread(f'{SRC}/{FICHIER.get(k, k)}.webp'), (720, 1024), interpolation=cv2.INTER_AREA)
    orig = im.copy()
    # 1. bandes latérales : on remplace la zone du bandeau par la bande saine du dessus (miroir), fondu sur 24 px
    ys, ye = 560, YB + 2
    for (xa, xb) in [(0, X0 + 4), (X1 - 4, 720)]:
        src = orig[ys - 230:ys, xa:xb]
        fill = mirror_tile(src[::-1], ye - ys)
        a = np.ones((ye - ys, 1, 1), np.float32); a[:24, 0, 0] = np.linspace(0, 1, 24)
        im[ys:ye, xa:xb] = (orig[ys:ye, xa:xb] * (1 - a) + fill * a).astype(np.uint8)
    # 2. on remet le médaillon du bas par-dessus
    cx, cy, r = bm
    mm = np.zeros((1024, 720), np.uint8); cv2.circle(mm, (cx, cy), r, 255, -1)
    mmf = cv2.GaussianBlur(mm, (0, 0), 1.5).astype(np.float32)[..., None] / 255
    im = (im * (1 - mmf) + orig * mmf).astype(np.uint8)
    # 3. calque cadre : fenêtre transparente jusqu'au bas du cadre
    meds = TOPMEDS.get(k, TOPMEDS['default']) + [bm]
    a = np.full((1024, 720), 255, np.uint8); cv2.rectangle(a, (X0, Y0), (X1, YB), 0, -1)
    for (mx, my, mr) in meds: cv2.circle(a, (mx, my), mr, 255, -1)
    a = cv2.GaussianBlur(a, (0, 0), 1.6)
    fr = cv2.cvtColor(im, cv2.COLOR_BGR2BGRA); fr[..., 3] = a
    cv2.imwrite(f'web/public/cards/calques/cadre_{k}.webp', fr, [cv2.IMWRITE_WEBP_QUALITY, 92])
    # 4. illustration : la partie visible au-dessus de l'ancien bandeau, agrandie pour remplir la nouvelle fenêtre
    crop = orig[Y0:YT, X0:X1].copy()
    m = np.zeros(crop.shape[:2], np.uint8)
    for (mx, my, mr) in TOPMEDS.get(k, TOPMEDS['default']): cv2.circle(m, (mx - X0, my - Y0), int(mr * 1.25), 255, -1)
    if m.any():
        small = cv2.resize(crop, None, fx=.5, fy=.5); sm = cv2.resize(m, None, fx=.5, fy=.5, interpolation=cv2.INTER_NEAREST)
        f2 = cv2.GaussianBlur(cv2.resize(cv2.inpaint(small, sm, 25, cv2.INPAINT_NS), (crop.shape[1], crop.shape[0])), (0, 0), 4)
        mf = cv2.GaussianBlur(m, (0, 0), 8).astype(np.float32)[..., None] / 255
        crop = (crop * (1 - mf) + f2 * mf).astype(np.uint8)
    W, H = X1 - X0, YB - Y0
    s = H / crop.shape[0]; nw = int(crop.shape[1] * s + .5)
    big = cv2.resize(crop, (nw, H), interpolation=cv2.INTER_CUBIC)
    ox = int(np.clip(fx * nw - W / 2, 0, nw - W))
    art = big[:, ox:ox + W]
    art = cv2.resize(art, (W * 3 // 2, H * 3 // 2), interpolation=cv2.INTER_CUBIC)   # un peu plus de définition pour le zoom
    cv2.imwrite(f'web/public/cards/calques/illu_{k}.jpg', art, [cv2.IMWRITE_JPEG_QUALITY, 88])
    info[k] = dict(gabarit='pir', fenetre=[X0, Y0, X1, YB], illu=[X0, Y0, X1, YB], medaillons=meds, sans_bandeau=True)
json.dump(info, open('web/public/cards/calques/calques.json', 'w'), indent=1)
print('ok', len(CARDS))
