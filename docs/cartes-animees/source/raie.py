import sys; sys.path.insert(0, '.')
from lib import *

A = Anim('../../final/stingray.png', frames=120, fps=24)
def circ(c, r, b=8):
    m = np.zeros((H, W), np.float32); cv2.circle(m, c, r, 1.0, -1); return cv2.GaussianBlur(m, (b * 2 + 1, b * 2 + 1), b / 2)
med = circ((580, 140), 93, 2)
WIN = window_rect('raie')
keep = WIN * (1 - med)
A.set_frame(keep, window=WIN)

# la raie : les ailes battent (onde de la racine vers la pointe), le corps plane
wingL = soft_poly([(132, 445), (250, 470), (318, 545), (300, 600), (240, 595), (150, 500)], 16)
wingR = soft_poly([(588, 440), (560, 470), (450, 540), (440, 600), (500, 590), (590, 480)], 16)
A.curl((320, 575), ramp_from((320, 575), wingL, 1.25), 7, 520, 1, 0)
A.curl((430, 575), ramp_from((430, 575), wingR, 1.25), -7, 520, 1, 0)
tail = soft_poly([(395, 470), (490, 470), (490, 505), (395, 505)], 8)
A.curl((400, 500), ramp_from((400, 500), tail, 1), 6, 120, 2, .2)
ray = soft_poly([(130, 440), (590, 440), (450, 600), (380, 690), (300, 690), (250, 600)], 20)
A.bob((370, 600), ray, dy=5, dx=2, rot=1.2, cycles=1, phase=.15)

# navire qui tangue, surface agitée
ship = soft_poly([(160, 110), (465, 110), (465, 300), (160, 300)], 12)
A.bob((310, 292), ship, dy=2.5, rot=1.1, cycles=1, phase=.4)
surf = soft_poly([(108, 285), (612, 285), (612, 390), (108, 390)], 18) * (1 - ship)
A.water(surf, amp=2.4, lx=70, ly=30, cycles=(2, 3))
under = soft_poly([(108, 380), (612, 380), (612, 906), (108, 906)], 30) * (1 - np.clip(ray * 1.3, 0, 1))
A.flow(under, amp=1.0, ly=110, cycles=1, axis='x')

# algues qui ondulent depuis le fond
for pts, root, amp, ph in [([(105, 520), (215, 520), (225, 790), (105, 790)], (160, 800), 4, 0),
                           ([(430, 560), (615, 540), (615, 800), (430, 800)], (520, 800), 3.5, .35),
                           ([(380, 720), (470, 720), (470, 800), (380, 800)], (425, 800), 4, .7)]:
    m = soft_poly(pts, 14) * (1 - np.clip(ray * 1.3, 0, 1))
    A.curl(root, ramp_from(root, m, 1.2), amp, 260, 1, ph)

# rayons de lumière qui respirent
rays = soft_poly([(240, 340), (470, 340), (420, 700), (300, 700)], 50)
A.flicker(rays, amp=.12, seed=5, warped=False)

# reflets qui dansent sur le sable (motif bouclé)
sand = soft_poly([(108, 790), (612, 790), (612, 906), (108, 906)], 20) * keep
def caustics(img, t, *_):
    a = np.sin(2 * math.pi * (XX / 48 + t) + 1.7 * np.sin(2 * math.pi * (YY / 30 - t)))
    b = np.sin(2 * math.pi * (YY / 22 - 2 * t) + 1.5 * np.sin(2 * math.pi * (XX / 60 + t)))
    c = np.clip((a * b - .55) / .45, 0, 1) * sand
    img[..., :3] = img[..., :3] + c[..., None] * np.array([200, 245, 255], np.float32) * .25
    return img
A.add_post(caustics)

rng = np.random.default_rng(6)
bub = [(rng.uniform(120, 600), rng.uniform(0, 1), rng.uniform(2, 4.5), rng.integers(1, 3)) for _ in range(22)]
def bubbles(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x, y0, r, k in bub:
        y = 880 - ((y0 + t * k) % 1) * 500
        xx = x + 5 * math.sin(2 * math.pi * (t * k * 2 + y0))
        cv2.circle(lay, (int(xx), int(y)), int(r), .55, 1, cv2.LINE_AA)
    lay *= keep
    img[..., :3] = img[..., :3] + lay[..., None] * (255 - img[..., :3]) * .8
    return img
A.add_post(bubbles)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        fr = [A.frame(i) for i in (0, 30, 60, 90)]
        cv2.imwrite('ra_t.jpg', np.hstack([f[400:720, 110:610, :3] for f in fr[:2]] ))
        cv2.imwrite('ra_t2.jpg', np.hstack([f[100:320, 150:480, :3] for f in fr] + []))
        cv2.imwrite('ra_t3.jpg', fr[1][760:910, 110:610, :3])
    else:
        print(A.render('out/raie'))
