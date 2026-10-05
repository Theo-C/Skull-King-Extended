import sys; sys.path.insert(0, '.')
from lib import *

A = Anim('../../final/kraken.png', frames=120, fps=24)
hsv = cv2.cvtColor(A.src[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)
win = soft_poly([(110, 104), (596, 104), (596, 909), (110, 909)], 4)
med = np.zeros((H, W), np.float32); cv2.circle(med, (552, 160), 113, 1.0, -1); med = cv2.GaussianBlur(med, (5, 5), 1)
WIN = window_rect('kraken')
art = WIN * (1 - med)
A.set_frame(art, window=WIN)
# chair du kraken (rouge) : les tentacules ne bougent que là, le décor autour reste net
flesh = color_mask(A.src, 165, 12, smin=60, vmin=40, close=7, dil=7, blur=5)

# --- tentacules ---
# grand bras en haut à gauche, qui s'enroule (racine dans le corps)
mA = soft_poly([(135, 195), (305, 190), (312, 290), (240, 300), (210, 340), (215, 440), (150, 440), (128, 300)], 18) * flesh
A.curl((340, 400), ramp_from((340, 400), mA, 1.3), 4.5, 420, 1, 0.0)
# petit crochet qui sort de l'eau à côté
mB = soft_poly([(248, 282), (322, 282), (322, 385), (252, 385)], 12) * flesh
A.curl((292, 392), ramp_from((292, 392), mB, 1.2), 7, 200, 1, .35)
# bras à droite (derrière l'épave)
mC = soft_poly([(530, 395), (598, 395), (598, 565), (520, 565)], 16) * flesh
A.sway((520, 470), ramp_from((520, 470), mC, 1), 3, 1, .6)
# bras en bas à droite
mD = soft_poly([(455, 755), (598, 755), (598, 910), (455, 910)], 18) * flesh
A.curl((600, 790), ramp_from((600, 790), mD, 1.2), 3.5, 380, 1, .2)
# petit bras qui sort de l'eau près du navire de gauche
mE = soft_poly([(228, 712), (292, 712), (292, 785), (228, 785)], 10) * flesh
A.curl((262, 790), ramp_from((262, 790), mE, 1.1), 9, 150, 2, .1)
# bras qui s'enroule dans le navire de gauche
mE2 = soft_poly([(240, 620), (320, 620), (320, 720), (240, 720)], 14) * flesh
A.sway((310, 640), ramp_from((310, 640), mE2, 1), 3, 1, .8)
# bras gauche, au milieu
mF = soft_poly([(126, 440), (215, 440), (215, 530), (126, 530)], 14) * flesh
A.sway((215, 480), ramp_from((215, 480), mF, 1), 4, 1, .45)
# la tête respire
A.breathe((430, 360), soft_ellipse((430, 350), (120, 95), 0, 30), .014, 1, .1)

# --- décor ---
shipL = soft_poly([(132, 470), (300, 470), (348, 610), (340, 745), (140, 745)], 16)
shipR = soft_poly([(440, 580), (598, 580), (598, 815), (440, 815)], 16)
wreck = soft_poly([(495, 355), (580, 355), (580, 445), (495, 445)], 10)
people = [soft_ellipse(c, (26, 34), 0, 8) for c in [(205, 812), (318, 790), (378, 762)]]
A.bob((240, 735), shipL, dy=3.5, rot=1.4, cycles=1, phase=0)
A.bob((520, 805), shipR, dy=3.5, rot=1.4, cycles=1, phase=.5)
A.bob((540, 430), wreck, dy=2.5, rot=2.0, cycles=1, phase=.25)
for i, m in enumerate(people):
    A.bob((0, 0), m, dy=3, cycles=2, phase=i * .33)
sea = soft_poly([(110, 420), (596, 420), (596, 909), (110, 909)], 30) * (1 - np.clip(shipL + shipR + sum(people) + mD + mE, 0, 1))
A.water(sea, amp=2.6, lx=80, ly=36, cycles=(2, 3))
sky = soft_poly([(110, 104), (596, 104), (596, 230), (420, 260), (110, 230)], 30) * (1 - mA)
A.flow(sky, amp=2.2, ly=140, cycles=1, axis='x')

# feu qui vacille
fire = ((hsv[..., 0] < 28) & (hsv[..., 1] > 120) & (hsv[..., 2] > 190)).astype(np.float32)
fire *= np.clip(soft_poly([(140, 560), (330, 560), (330, 720), (140, 720)], 0) + soft_poly([(500, 650), (598, 650), (598, 780), (500, 780)], 0), 0, 1)
fire = cv2.GaussianBlur(fire, (15, 15), 5)
A.flow(fire, amp=2.5, lx=14, cycles=6, axis='y')
A.flicker(fire, amp=.35, seed=3)

# éclair existant : il s'illumine, le ciel s'éclaire
bolt = ((hsv[..., 2] > 185) & (hsv[..., 1] < 70)).astype(np.float32) * soft_poly([(240, 150), (400, 150), (400, 345), (240, 345)], 0)
bolt = cv2.GaussianBlur(bolt, (21, 21), 6) * 1.8
A.flash(np.clip(bolt, 0, 1), [(.62, 1.0), (.66, .8)], amp=.7, dur=.012)
A.flash(win * .45 * (1 - med), [(.62, 1.0), (.66, .8)], amp=.32, dur=.012)

# œil qui rougeoie (centre mesuré : 450, 344)
A.glow((450, 344), 26, (255, 120, 30), (.12, .55), 1, .1)
A.glow((450, 344), 7, (255, 240, 170), (.05, .45), 1, .1)

# pluie fine (boucle : décalage = période entière)
rng = np.random.default_rng(4)
drops = [(rng.uniform(110, 596), rng.uniform(0, 1), rng.uniform(.5, 1)) for _ in range(150)]
def rain(img, t, *_):
    lay = np.zeros((H, W), np.float32)
    for x, y0, k in drops:
        y = 104 + ((y0 + t * 4) % 1) * 805
        cv2.line(lay, (int(x), int(y)), (int(x - 4), int(y + 18)), .22 * k, 1, cv2.LINE_AA)
    lay *= win * (1 - med)
    img[..., :3] = img[..., :3] + lay[..., None] * 255 * .9
    return img
A.add_post(rain)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        for i in (0, 30, 60, 75, 90):
            cv2.imwrite(f'kr_{i}.png', A.frame(i))
    else:
        print(A.render('out/kraken'))
