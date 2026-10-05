import sys; sys.path.insert(0, '.')
from lib import *

A = Anim('../../final/whale.png', frames=120, fps=24)
def circ(c, r, b=8):
    m = np.zeros((H, W), np.float32); cv2.circle(m, c, r, 1.0, -1); return cv2.GaussianBlur(m, (b * 2 + 1, b * 2 + 1), b / 2)
med = circ((556, 165), 111, 2)
WIN = window_rect('baleine')
keep = WIN * (1 - med)
A.set_frame(keep, window=WIN)

# la baleine : elle surgit (léger élan) et ouvre la gueule
whale_zone = soft_poly([(205, 300), (300, 225), (400, 230), (470, 330), (470, 430), (420, 560), (410, 690), (220, 690), (200, 520)], 0)
# seulement le corps blanc de la baleine bouge : le ciel autour reste net
# silhouette détourée une fois (GrabCut, voir whale_mask.npy)
whale = np.load('whale_mask.npy').astype(np.float32)
whale = cv2.GaussianBlur(cv2.dilate(whale, np.ones((5, 5), np.uint8)), (11, 11), 3)
jaw = soft_poly([(372, 360), (470, 340), (470, 395), (430, 432), (372, 432)], 6) * whale
A.sway((376, 425), ramp_from((376, 425), jaw, 1), -4, 1, 0)
A.bob((310, 690), whale, dy=6, rot=1.0, cycles=1, phase=.25)
# gerbe d'écume au pied
foam = soft_poly([(200, 630), (440, 630), (440, 710), (200, 710)], 16)
A.flow(foam, amp=1.2, lx=45, cycles=3, axis='y')
A.flicker(foam, amp=.12, seed=4)

# navires qui tanguent, chaloupe et marins
shipL = soft_poly([(145, 478), (300, 478), (318, 752), (145, 752)], 12) * (1 - whale)
shipR = soft_poly([(428, 505), (585, 505), (585, 748), (428, 748)], 12)
boat = soft_poly([(178, 765), (362, 765), (362, 865), (178, 865)], 10)
A.bob((230, 745), shipL, dy=3.5, rot=1.6, cycles=1, phase=0)
A.bob((505, 742), shipR, dy=3.5, rot=1.6, cycles=1, phase=.45)
A.bob((270, 850), boat, dy=4, rot=2.2, cycles=2, phase=.1)
# le marin qui fait signe (bras levé en haut à droite de la chaloupe)
arm = soft_poly([(328, 755), (352, 755), (352, 790), (328, 790)], 6)
A.curl((333, 792), ramp_from((333, 792), arm, 1), 10, 80, 3, 0)

# mer qui houle
sea = soft_poly([(120, 690), (598, 690), (598, 906), (120, 906)], 24) * (1 - np.clip(shipL + shipR + boat, 0, 1))
A.water(sea, amp=3, lx=70, ly=28, cycles=(2, 3))
# nuages qui ondulent lentement
sky = soft_poly([(120, 152), (598, 152), (598, 470), (120, 470)], 30) * (1 - whale)


# soleil qui pulse, reflets qui scintillent sur l'eau
A.glow((186, 455), 60, (255, 200, 110), (.15, .45), 1, 0)
A.glow((388, 612), 70, (255, 190, 90), (.15, .45), 1, .5)
hsv = cv2.cvtColor(A.src[..., :3], cv2.COLOR_BGR2HSV)
gm = ((hsv[..., 2] > 225) & (hsv[..., 1] > 80)).astype(np.uint8) * (sea > .5).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(gm)
pts = [tuple(map(int, cen[i])) for i in range(1, n) if st[i, 4] > 3]
rng = np.random.default_rng(3); rng.shuffle(pts)
for i, p in enumerate(pts[:18]):
    A.glow(p, 6, (255, 240, 200), (0, .55), 2, i / 18)

# --- effets en plus ---
rngb = np.random.default_rng(21)
# gerbes d'eau projetées au pied de la baleine (arcs paraboliques, en boucle)
spray = [(rngb.uniform(215, 430), rngb.uniform(-1, 1), rngb.uniform(120, 260), rngb.uniform(0, 1), rngb.uniform(1.5, 3.2)) for _ in range(70)]
# eau qui ruisselle le long du corps
stream = [(rngb.uniform(235, 470), rngb.uniform(260, 600), rngb.uniform(0, 1)) for _ in range(40)]
def water_fx(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x0, dirx, hgt, p, r in spray:
        u = (t * 2 + p) % 1
        x = x0 + dirx * 90 * u
        y = 672 - hgt * (4 * u * (1 - u))
        cv2.circle(lay, (int(x), int(y)), int(r), .85 * (1 - u * .5), -1, cv2.LINE_AA)
    for x0, y0, p in stream:
        u = (t * 3 + p) % 1
        y = y0 + u * 70
        cv2.line(lay, (int(x0), int(y)), (int(x0), int(y + 7)), .6 * (1 - u), 2, cv2.LINE_AA)
    lay = cv2.GaussianBlur(lay, (3, 3), .8) * keep
    img[..., :3] = img[..., :3] + lay[..., None] * (np.array([235, 245, 255], np.float32) - img[..., :3])
    return img
A.add_post(water_fx)
# brume d'écume qui pulse au pied
mist = soft_ellipse((315, 670), (150, 38), 0, 30)
def mist_fx(img, t, *_):
    a = .35 + .25 * math.sin(2 * math.pi * 2 * t)
    img[..., :3] = img[..., :3] + (mist * a * keep)[..., None] * (np.array([225, 238, 255], np.float32) - img[..., :3]) * .6
    return img
A.add_post(mist_fx)
# rayons du soleil qui tournent lentement
ang = np.arctan2(YY - 455, XX - 186); dist = np.sqrt((XX - 186) ** 2 + (YY - 455) ** 2)
fall = np.clip(1 - dist / 330, 0, 1) ** 2 * keep * (1 - np.clip(whale * 1.4, 0, 1))
def rays_fx(img, t, *_):
    r = (.5 + .5 * np.cos(ang * 12 + 2 * math.pi * t)) ** 4
    img[..., :3] = img[..., :3] + (r * fall)[..., None] * np.array([120, 200, 255], np.float32) * .35
    return img
A.add_post(rays_fx)
# mouettes qui traversent le ciel
gulls = [(0.0, 205, 1.0), (.4, 175, .8), (.7, 240, .9)]
def gulls_fx(img, t, *_):
    for p, y0, s_ in gulls:
        u = (t + p) % 1
        x = 600 - u * 470
        y = y0 + 10 * math.sin(2 * math.pi * u * 2)
        fl = 5 * math.sin(2 * math.pi * t * 10 + p * 7)
        w = 13 * s_
        pts = np.array([(x - w, y - fl), (x - w * .45, y - 4 - fl * .3), (x, y), (x + w * .45, y - 4 - fl * .3), (x + w, y - fl)], np.int32)
        if keep[int(y), int(np.clip(x, 0, 719))] > .5:
            cv2.polylines(img, [pts], False, (40, 30, 45, 255), 2, cv2.LINE_AA)
    return img
A.add_post(gulls_fx)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        fr = [A.frame(i) for i in (0, 30, 60, 90)]
        cv2.imwrite('ba_t.jpg', np.hstack([f[200:880, 120:600, :3] for f in fr]))
        print(len(pts))
    else:
        print(A.render('out/baleine'))
