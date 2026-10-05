import sys; sys.path.insert(0, '.')
from lib import *

A = Anim('../../final/sk.png', frames=120, fps=24)
def circ(c, r, b=8):
    m = np.zeros((H, W), np.float32); cv2.circle(m, c, r, 1.0, -1); return cv2.GaussianBlur(m, (b * 2 + 1, b * 2 + 1), b / 2)
# cadre fixe : bord, médaillons, bandeau du nom et volutes dorées, détectés à la couleur
win = soft_poly([(102, 106), (612, 106), (612, 960), (102, 960)], 1)
band_low = np.clip(soft_poly([(60, 600), (215, 600), (215, 1000), (60, 1000)], 0) + soft_poly([(60, 685), (700, 685), (700, 1000), (60, 1000)], 0), 0, 1)
parch = fill_holes(color_mask(A.src, 10, 32, smin=25, smax=140, vmin=150, region=band_low, close=15, dil=5, blur=0))
edge = np.clip(1 - soft_poly([(140, 140), (575, 140), (575, 1000), (140, 1000)], 0) - soft_poly([(92, 465), (270, 465), (270, 645), (92, 645)], 0), 0, 1)
gold = fill_holes(color_mask(A.src, 12, 35, smin=90, vmin=110, region=edge, close=7, dil=5, blur=0))
WIN = window_rect('sk')
static = np.clip(1 - WIN + circ((135, 140), 95, 2) + circ((605, 110), 68, 2) + circ((578, 880), 110, 2) + parch + gold, 0, 1)
static = cv2.GaussianBlur(static, (3, 3), 1)
keep = 1 - static
A.set_frame(keep, window=WIN)
hsv = cv2.cvtColor(A.src[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)

# tresses et barbe dans le vent
for pts, root, amp, ph in [([(290, 255), (340, 255), (345, 420), (290, 420)], (320, 250), 4, 0),
                           ([(462, 255), (500, 255), (500, 400), (465, 400)], (480, 250), 4, .25)]:
    m = soft_poly(pts, 10)
    A.curl(root, ramp_from(root, m, 1.2), amp, 220, 1, ph)
beard = soft_poly([(345, 330), (455, 330), (450, 430), (350, 430)], 14)
A.curl((400, 320), ramp_from((400, 320), beard, 1.4), 2.5, 160, 1, .1)
# la barre tourne d'un bloc autour de son moyeu (centre mesuré sur la jante : 490, 740), mains comprises
wheel = np.clip(circ((490, 740), 322, 10) + soft_poly([(92, 470), (265, 470), (275, 640), (92, 640)], 14)
                + soft_poly([(500, 295), (612, 295), (612, 480), (500, 480)], 14), 0, 1)
A.sway((490, 740), wheel, 2.2, 1, 0)

# la mer déchaînée derrière lui
man = soft_poly([(250, 125), (560, 125), (600, 300), (620, 700), (110, 700), (100, 520), (190, 420), (260, 300)], 26)
sea = keep * (1 - man) * (1 - wheel)
A.water(sea * soft_poly([(100, 250), (620, 250), (620, 700), (100, 700)], 30), amp=3.2, lx=60, ly=40, cycles=(2, 3))
A.flow(sea * soft_poly([(100, 108), (620, 108), (620, 260), (100, 260)], 30), amp=2.5, ly=150, cycles=1, axis='x')
# navires au loin
A.bob((240, 300), soft_poly([(195, 225), (285, 225), (285, 305), (195, 305)], 10), dy=3, rot=2, cycles=1, phase=.2)
A.bob((590, 320), soft_poly([(555, 270), (615, 270), (615, 330), (555, 330)], 8), dy=2.5, rot=2, cycles=1, phase=.7)

# éclairs existants qui s'allument, et la scène éclairée par le flash
bolt = ((hsv[..., 2] > 200) & (hsv[..., 1] < 60)).astype(np.float32) * sea
bolt = np.clip(cv2.GaussianBlur(bolt, (17, 17), 5) * 2, 0, 1)
A.flash(bolt, [(.3, 1), (.34, .7), (.78, .8)], amp=.8, dur=.012)
A.flash(keep * .5, [(.3, 1), (.34, .7), (.78, .8)], amp=.28, dur=.012)

# rubis du médaillon et éclat de la couronne
A.glow((566, 893), 18, (255, 40, 30), (.1, .7), 1, .2)
A.glow((416, 152), 10, (255, 250, 230), (0, .9), 1, .55)
A.glow((416, 152), 26, (255, 210, 120), (0, .35), 1, .55)

rng = np.random.default_rng(9)
drops = [(rng.uniform(100, 615), rng.uniform(0, 1), rng.uniform(.5, 1)) for _ in range(120)]
def rain(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x, y0, k in drops:
        y = 108 + ((y0 + t * 4) % 1) * 600
        cv2.line(lay, (int(x), int(y)), (int(x - 5), int(y + 18)), .2 * k, 1, cv2.LINE_AA)
    lay *= keep
    img[..., :3] = img[..., :3] + lay[..., None] * 255 * .9
    return img
A.add_post(rain)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        fr = [A.frame(i) for i in (0, 30, 36, 60)]
        cv2.imwrite('sk_t.jpg', np.hstack([f[110:700, 100:615, :3] for f in fr]))
    else:
        print(A.render('out/sk'))
