import sys; sys.path.insert(0, '.')
from lib import *

A = Anim('../../final/mermaid0.png', frames=120, fps=24)
def circ(c, r, b=8):
    m = np.zeros((H, W), np.float32); cv2.circle(m, c, r, 1.0, -1); return cv2.GaussianBlur(m, (b * 2 + 1, b * 2 + 1), b / 2)
win = soft_poly([(101, 112), (620, 112), (620, 960), (101, 960)], 1)
band_low = soft_poly([(40, 600), (700, 600), (700, 1000), (40, 1000)], 0)
parch = fill_holes(color_mask(A.src, 10, 32, smin=25, smax=140, vmin=150, region=band_low, close=15, dil=5, blur=0))
WIN = window_rect('sirene')
static = np.clip(1 - WIN + circ((130, 150), 92, 2) + circ((600, 105), 70, 2) + circ((565, 880), 105, 2) + circ((101, 112), 34, 2) + circ((620, 112), 34, 2)
                 + soft_poly([(60, 590), (128, 590), (128, 760), (60, 760)], 1) + soft_poly([(592, 560), (660, 560), (660, 760), (592, 760)], 1) + parch, 0, 1)
keep = 1 - cv2.GaussianBlur(static, (3, 3), 1)
A.set_frame(keep, window=WIN)

# cheveux qui flottent vers la gauche : onde qui voyage de la tête vers les pointes
hair = soft_poly([(335, 165), (250, 185), (150, 245), (92, 300), (88, 610), (165, 600), (228, 565), (262, 480), (318, 430), (342, 335)], 22)
face = soft_ellipse((428, 320), (92, 120), 0, 20)
hair *= (1 - face)
tip = np.clip((345 - XX) / 230, 0, 1) ** 1.2
wH = hair * tip
def hairwave(t):
    ph = 2 * math.pi * (XX / 170 + t * 2)
    dy = 7 * np.sin(ph) * wH
    dx = 2.5 * np.cos(ph) * wH
    return dx, dy
A.warps.append(hairwave)
# mèche à droite
hairR = soft_poly([(488, 215), (545, 225), (548, 345), (500, 340)], 12)
A.curl((505, 210), ramp_from((505, 210), hairR, 1), 3, 160, 1, .3)

# méduses qui montent et descendent
A.bob((0, 0), soft_ellipse((168, 255), (30, 36), 0, 10), dy=5, cycles=1, phase=0)
A.bob((0, 0), soft_ellipse((550, 212), (24, 30), 0, 10), dy=4, cycles=1, phase=.4)
# poissons et algues à droite
A.bob((0, 0), soft_poly([(545, 330), (625, 330), (625, 425), (545, 425)], 12), dx=4, dy=1.5, cycles=1, phase=.2)
weed = soft_poly([(540, 470), (622, 470), (622, 600), (540, 600)], 14)
A.sway((580, 600), ramp_from((580, 600), weed, 1), 4, 1, .1)
coral = soft_poly([(180, 630), (270, 630), (270, 700), (180, 700)], 10)
A.sway((225, 700), ramp_from((225, 700), coral, 1), 3, 1, .6)
coral2 = soft_poly([(545, 630), (615, 630), (615, 700), (545, 700)], 10)
A.sway((580, 700), ramp_from((580, 700), coral2, 1), 3, 1, .3)
# eau du fond : léger tremblement
bg = keep * (1 - np.clip(hair + face + soft_poly([(250, 380), (560, 380), (560, 700), (250, 700)], 20), 0, 1))
A.flow(bg, amp=1.0, ly=90, cycles=2, axis='x')

# rayons de lumière qui respirent (zone haute)
rays = soft_poly([(200, 112), (560, 112), (520, 330), (260, 330)], 40) * .5
A.flicker(rays, amp=.10, seed=8, warped=False)

# perles qui scintillent : on prend les points les plus clairs des colliers
hsv = cv2.cvtColor(A.src[..., :3], cv2.COLOR_BGR2HSV)
pm = ((hsv[..., 2] > 248) & (hsv[..., 1] < 25)).astype(np.uint8) * (soft_poly([(170, 270), (520, 270), (520, 690), (170, 690)], 0) > .5).astype(np.uint8) * (face < .2).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(pm)
pts = [tuple(map(int, cen[i])) for i in range(1, n) if st[i, 4] > 6]
rng = np.random.default_rng(2); rng.shuffle(pts); pts = pts[:14]
for i, p in enumerate(pts):
    A.glow(p, 9, (255, 255, 255), (0, .9), 1, i / len(pts))

# bulles qui montent (boucle exacte)
bub = [(rng.uniform(110, 610), rng.uniform(0, 1), rng.uniform(2, 5), rng.integers(1, 3)) for _ in range(26)]
def bubbles(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x, y0, r, k in bub:
        y = 690 - ((y0 + t * k) % 1) * 580
        xx = x + 6 * math.sin(2 * math.pi * (t * k * 2 + y0))
        cv2.circle(lay, (int(xx), int(y)), int(r), .55, 1, cv2.LINE_AA)
        cv2.circle(lay, (int(xx - r * .35), int(y - r * .35)), 1, .8, -1, cv2.LINE_AA)
    lay *= keep
    img[..., :3] = img[..., :3] + lay[..., None] * (255 - img[..., :3]) * .9
    return img
A.add_post(bubbles)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        fr = [A.frame(i) for i in (0, 30, 60, 90)]
        cv2.imwrite('si_t.jpg', np.hstack([f[150:700, 80:420, :3] for f in fr]))
        a, b = fr[0], fr[1]
        d = cv2.absdiff(a, b).max(2); cv2.imwrite('si_d.jpg', cv2.applyColorMap(np.clip(d * 4, 0, 255).astype(np.uint8), cv2.COLORMAP_INFERNO))
        print(len(pts))
    else:
        print(A.render('out/sirene'))
