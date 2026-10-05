import sys; sys.path.insert(0, '.')
from lib import *

A = Anim('../../final/davy.png', frames=120, fps=24)
def circ(c, r, b=8):
    m = np.zeros((H, W), np.float32); cv2.circle(m, c, r, 1.0, -1); return cv2.GaussianBlur(m, (b * 2 + 1, b * 2 + 1), b / 2)
WIN = window_rect('fosse')
keep = WIN.copy()
keep *= (1 - circ((582, 150), 85, 2)) * (1 - circ((130, 130), 75, 2)) * (1 - circ((130, 880), 75, 2)) * (1 - circ((590, 880), 75, 2))
A.set_frame(keep, window=WIN)

# le noyé flotte : il monte et descend doucement
body = soft_poly([(230, 300), (480, 300), (490, 840), (225, 840)], 24)
A.bob((360, 840), body, dy=4, rot=.6, cycles=1, phase=0)
# cheveux qui se soulèvent dans l'eau
hair = soft_poly([(312, 312), (408, 312), (412, 410), (395, 410), (392, 360), (330, 360), (325, 410), (305, 410)], 10)
A.curl((360, 330), ramp_from((360, 330), hair, 1), 5, 120, 1, .2)
# les mains ne se déforment pas : elles suivent seulement le corps
hands = np.clip(soft_poly([(232, 595), (305, 595), (305, 695), (232, 695)], 10) + soft_poly([(425, 585), (485, 585), (485, 675), (425, 675)], 10), 0, 1)
# bas du manteau en lambeaux qui ondule
hem = soft_poly([(232, 560), (488, 560), (495, 835), (228, 835)], 18) * np.clip((YY - 560) / 270, 0, 1) * (1 - hands)
def hemwave(t):
    dx = 6 * np.sin(2 * math.pi * (YY / 130 - t * 2)) * hem
    return dx, dx * 0
A.warps.append(hemwave)
# pans du manteau sur les côtés
for pts, root, amp, ph in [([(232, 430), (292, 430), (292, 650), (232, 650)], (270, 420), 3, 0),
                           ([(428, 430), (478, 430), (478, 650), (428, 650)], (450, 420), -3, .5)]:
    m = soft_poly(pts, 10) * (1 - hands)
    A.curl(root, ramp_from(root, m, 1), amp * 1.3, 200, 1, ph)

# poissons qui passent, algues
for pts, dx, ph in [([(148, 355), (205, 355), (205, 445), (148, 445)], 10, 0),
                    ([(148, 515), (205, 515), (205, 565), (148, 565)], 8, .3),
                    ([(505, 505), (578, 505), (578, 605), (505, 605)], -10, .6)]:
    A.bob((0, 0), soft_poly(pts, 10), dx=dx, dy=2, cycles=1, phase=ph)
for pts, root, amp, ph in [([(145, 715), (245, 715), (245, 800), (145, 800)], (195, 800), 8, .1),
                           ([(480, 630), (578, 630), (578, 790), (480, 790)], (530, 790), 7, .45)]:
    m = soft_poly(pts, 12)
    A.curl(root, ramp_from(root, m, 1.2), amp, 200, 1, ph)
# eau trouble partout ailleurs
bg = keep * (1 - body)
A.flow(bg, amp=1.6, ly=110, cycles=1, axis='x')

# lumière qui tombe de la surface, yeux qui s'allument
A.flicker(soft_poly([(220, 142), (500, 142), (470, 300), (250, 300)], 40), amp=.15, seed=2, warped=False)
for c in [(354, 371), (375, 374)]:
    A.glow(c, 11, (120, 255, 150), (.05, .7), 1, .55)
    A.glow(c, 3, (230, 255, 230), (.0, .9), 1, .55)

# halo spectral autour du noyé, qui pulse
aura = cv2.GaussianBlur(soft_poly([(240, 315), (470, 315), (488, 840), (228, 840)], 0), (0, 0), 28)
aura = np.clip(aura * 1.6 - soft_poly([(262, 330), (450, 330), (465, 820), (250, 820)], 30) * 1.1, 0, 1)
def ghost(img, t, mx, my):
    a = .35 + .3 * math.sin(2 * math.pi * (t + .55))
    m = cv2.remap(aura, mx, my, cv2.INTER_LINEAR)
    img[..., :3] = img[..., :3] + (m * a)[..., None] * np.array([110, 255, 120], np.float32) * .55
    return img
A.add_post(ghost)
# rayons de lumière qui balaient lentement le fond depuis la surface
top = np.clip(1 - (YY - 148) / 520, 0, 1) ** 1.5 * keep
def shafts(img, t, *_):
    b = (.5 + .5 * np.sin(2 * math.pi * ((XX + (YY - 148) * .35) / 110 - t))) ** 6
    img[..., :3] = img[..., :3] + (b * top)[..., None] * np.array([150, 255, 170], np.float32) * .16
    return img
A.add_post(shafts)
# particules en suspension qui dérivent
rngp = np.random.default_rng(11)
motes = [(rngp.uniform(155, 565), rngp.uniform(155, 855), rngp.uniform(0, 1), rngp.uniform(.6, 1.6)) for _ in range(45)]
def drift(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x, y, p, s in motes:
        yy = 155 + ((y - 155 - t * 120 * s) % 700)
        xx = x + 8 * math.sin(2 * math.pi * (t + p))
        lay[int(yy), int(xx)] = .5 + .5 * math.sin(2 * math.pi * (2 * t + p))
    lay = cv2.GaussianBlur(lay, (7, 7), 1.4) * 9 * keep
    img[..., :3] = img[..., :3] + lay[..., None] * np.array([170, 255, 190], np.float32) * .7
    return img
A.add_post(drift)
# pièces qui brillent
hsv = cv2.cvtColor(A.src[..., :3], cv2.COLOR_BGR2HSV)
gm = ((hsv[..., 2] > 200) & (hsv[..., 1] > 60) & (hsv[..., 0] > 15) & (hsv[..., 0] < 40)).astype(np.uint8) * (soft_poly([(190, 790), (500, 790), (500, 866), (190, 866)], 0) > .5).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(gm)
pts = [tuple(map(int, cen[i])) for i in range(1, n) if st[i, 4] > 3]
rng = np.random.default_rng(5); rng.shuffle(pts)
for i, p in enumerate(pts[:8]):
    A.glow(p, 7, (255, 240, 170), (0, .7), 1, i / 8)

# bulles : quelques-unes s'échappent de sa bouche, d'autres montent du fond
bub = [(362, 402, rng.uniform(0, 1), 3, 1, 260) for _ in range(3)] + \
      [(rng.uniform(160, 560), 860, rng.uniform(0, 1), rng.uniform(2, 4), rng.integers(1, 3), 680) for _ in range(16)]
def bubbles(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x, y0, p, r, k, rise in bub:
        u = (p + t * k) % 1
        y = y0 - u * rise
        xx = x + 5 * math.sin(2 * math.pi * (u * 2 + p))
        cv2.circle(lay, (int(xx), int(y)), int(r), .5 * (1 - u * .6), 1, cv2.LINE_AA)
    lay *= keep
    img[..., :3] = img[..., :3] + lay[..., None] * (255 - img[..., :3]) * .8
    return img
A.add_post(bubbles)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        fr = [A.frame(i) for i in (0, 30, 60, 90)]
        cv2.imwrite('fo_t.jpg', np.hstack([f[140:870, 140:580, :3] for f in fr]))
        print(len(pts))
    else:
        print(A.render('out/fosse'))
