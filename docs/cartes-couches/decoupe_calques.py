# Sépare chaque carte d'origine en 2 calques alignés au pixel :
#  - cadre_<clé>.webp : l'image d'origine, fenêtre d'illustration rendue transparente (cadre, médaillons, volutes, parchemin intacts)
#  - illu_<clé>.jpg   : l'illustration seule (fenêtre + débord), coins sous les médaillons reconstruits
# Les coordonnées sont dans l'image 720 x 1024.
import cv2, numpy as np, json, os
os.makedirs('web/public/cards/calques', exist_ok=True)
SRC = 'web/public/cards/sources'  # images d'origine 720 x 1024 (avec bandeau) ; lancer depuis la racine du dépôt
# CON est un nom de périphérique réservé sous Windows : la carte Con le belliqueux est le fichier corbin.webp (comme web/src/cards.ts)
FICHIER = {'con': 'corbin'}
# fenêtre transparente (x0,y0,x1,y1), médaillons qui restent opaques (cx,cy,r), bas du gabarit personnage
T = {
 'suit':  dict(win=(116,104,602,911), meds=[(583,135,101)]),
 'pir':   dict(win=(96,98,624,690),  meds=[(119,119,86),(612,108,80)]),
 'cre':   dict(win=(136,116,594,894), meds=[(560,140,104)]),
}
C = {
 'suit-green':'suit','suit-yellow':'suit','suit-purple':'suit','suit-black':'suit',
 'rosie':'pir','rascal':'pir','juanita':'pir','harry':'pir','mary':'pir','tigress':'pir','con':'pir','bahij':'pir','mermaid0':'pir','mermaid1':'pir','sk':'pir',
 'kraken':'cre','whale':'cre','escape':'cre','davy':'cre','loot':'cre','plank':'cre','stingray':'cre','volley':'cre','wild':'cre',
}
# réglages propres à certaines cartes
OVR = {
 'whale': dict(win=(118,156,602,902), meds=[(560,160,106)]),
 'davy': dict(win=(140,136,580,880), meds=[(586,150,74)]), 'loot': dict(win=(140,134,584,886), meds=[(570,154,96)]),
 'plank': dict(win=(136,130,586,892), meds=[(560,160,98)]), 'stingray': dict(win=(132,126,590,894), meds=[(576,134,82)]),
 'volley': dict(win=(132,126,590,894), meds=[(576,144,82)]), 'wild': dict(win=(150,146,582,882), meds=[(586,118,78)]),
 'escape': dict(win=(136,116,592,894), meds=[(562,130,100)]),
 'mermaid0': dict(win=(96,98,624,690), meds=[(95,100,95),(625,100,92)]), 'mermaid1': dict(win=(96,98,624,690), meds=[(95,100,95),(625,100,92)]),
 'sk': dict(win=(96,98,624,690), meds=[(140,135,104),(605,105,82),(60,200,64),(665,160,62),(250,75,56)]),
 'bahij': dict(win=(96,98,624,690), meds=[(612,108,92)]),
}
info = {}
for k, tpl in C.items():
    cfg = dict(T[tpl]); cfg.update(OVR.get(k, {}))
    im = cv2.resize(cv2.imread(f'{SRC}/{FICHIER.get(k, k)}.webp', cv2.IMREAD_COLOR), (720, 1024), interpolation=cv2.INTER_AREA)
    x0, y0, x1, y1 = cfg['win']
    # --- calque cadre : alpha 0 dans la fenêtre, 255 ailleurs et sur les médaillons
    a = np.full((1024, 720), 255, np.uint8)
    cv2.rectangle(a, (x0, y0), (x1, y1), 0, -1)
    for cx, cy, r in cfg['meds']:
        cv2.circle(a, (cx, cy), r, 255, -1)
    a = cv2.GaussianBlur(a, (0, 0), 1.6)          # bord doux d'un pixel et demi, pas de crénelage
    frame = cv2.cvtColor(im, cv2.COLOR_BGR2BGRA); frame[..., 3] = a
    cv2.imwrite(f'web/public/cards/calques/cadre_{k}.webp', frame, [cv2.IMWRITE_WEBP_QUALITY, 92])
    # --- calque illustration : la fenêtre + 24 px de débord, médaillons reconstruits
    pad = 24
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(720, x1 + pad), min(1024, y1 + pad)
    crop = im[Y0:Y1, X0:X1].copy()
    m = np.zeros(crop.shape[:2], np.uint8)
    for cx, cy, r in cfg['meds']:
        cv2.circle(m, (cx - X0, cy - Y0), int(r * 1.25), 255, -1)
    # le débord hors fenêtre est du cadre : on le remplace par un prolongement de l'illustration
    inner = np.zeros_like(m); cv2.rectangle(inner, (x0 - X0 + 2, y0 - Y0 + 2), (x1 - X0 - 2, y1 - Y0 - 2), 255, -1)
    m[inner == 0] = 255
    small = cv2.resize(crop, None, fx=.5, fy=.5); sm = cv2.resize(m, None, fx=.5, fy=.5, interpolation=cv2.INTER_NEAREST)
    fill = cv2.resize(cv2.inpaint(small, sm, 25, cv2.INPAINT_NS), (crop.shape[1], crop.shape[0]))
    fill = cv2.GaussianBlur(fill, (0, 0), 4)
    mm = cv2.GaussianBlur(m, (0, 0), 8).astype(np.float32)[..., None] / 255
    art = (crop * (1 - mm) + fill * mm).astype(np.uint8)
    cv2.imwrite(f'web/public/cards/calques/illu_{k}.jpg', art, [cv2.IMWRITE_JPEG_QUALITY, 88])
    info[k] = dict(gabarit=tpl, fenetre=[x0, y0, x1, y1], illu=[X0, Y0, X1, Y1], medaillons=cfg['meds'])
json.dump(info, open('web/public/cards/calques/calques.json', 'w'), indent=1)
print(len(info), 'cartes')
