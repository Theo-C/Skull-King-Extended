"""Petit moteur d'animation de cartes : déformations locales (cv2.remap) bouclées."""
import numpy as np, cv2, math, subprocess, os

W, H = 720, 1024
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def soft_poly(pts, blur=25):
    m = np.zeros((H, W), np.float32)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1.0)
    if blur:
        k = blur * 2 + 1
        m = cv2.GaussianBlur(m, (k, k), blur / 2)
    return m


def soft_ellipse(c, ax, ang=0, blur=25):
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(c[0]), int(c[1])), (int(ax[0]), int(ax[1])), ang, 0, 360, 1.0, -1)
    if blur:
        k = blur * 2 + 1
        m = cv2.GaussianBlur(m, (k, k), blur / 2)
    return m


def color_mask(src, hlo, hhi, smin=0, smax=255, vmin=0, vmax=255, region=None, close=9, dil=0, blur=2):
    hsv = cv2.cvtColor(src[..., :3], cv2.COLOR_BGR2HSV)
    h, s_, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hm = ((h >= hlo) & (h <= hhi)) if hlo <= hhi else ((h >= hlo) | (h <= hhi))
    m = (hm & (s_ >= smin) & (s_ <= smax) & (v >= vmin) & (v <= vmax)).astype(np.uint8)
    if region is not None:
        m &= (region > .5).astype(np.uint8)
    if close:
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    if dil:
        m = cv2.dilate(m, np.ones((dil, dil), np.uint8))
    m = m.astype(np.float32)
    if blur:
        m = cv2.GaussianBlur(m, (blur * 2 + 1, blur * 2 + 1), blur / 2)
    return m


def fill_holes(m):
    b = (m > .5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(1 - b)
    out = b.copy()
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if x > 0 and y > 0 and x + w < W and y + h < H and a < 4000:
            out[lab == i] = 1
    return out.astype(np.float32)


def ramp_from(root, mask, power=1.0, reach=None):
    d = np.sqrt((XX - root[0]) ** 2 + (YY - root[1]) ** 2)
    if reach is None:
        reach = float(d[mask > .5].max()) if (mask > .5).any() else 1
    return np.clip(d / reach, 0, 1) ** power * mask


class Anim:
    def __init__(self, img_path, frames=100, fps=20):
        self.src = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
        if self.src.shape[2] == 3:
            self.src = cv2.cvtColor(self.src, cv2.COLOR_BGR2BGRA)
        self.N, self.fps = frames, fps
        self.warps = []   # fonctions t -> (dx, dy)
        self.posts = []   # fonctions (img, t, mapx, mapy) -> img
        self.keep = None  # masque : seules ces zones peuvent bouger
        self.frame_m = None  # cadre fixe recollé par-dessus (net), avec un fond prolongé dessous

    def set_frame(self, art, window=None, grow=0):
        """art = zone de l'illustration qui peut bouger (1) ; tout le reste est le cadre, recollé tel quel par-dessus.
        window = fenêtre exacte de l'illustration (detect_window). Sous le cadre, on prolonge l'illustration
        en miroir depuis le bord de la fenêtre (les formes se continuent), et sous les éléments posés
        dans la fenêtre (bandeau, médaillons) on la reconstitue par inpainting."""
        fr = ((1 - np.clip(art, 0, 1)) > .5).astype(np.uint8)
        if grow:
            fr = cv2.dilate(fr, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow * 2 + 1, grow * 2 + 1)))
        self.frame_m = cv2.GaussianBlur(fr.astype(np.float32), (3, 3), .8)
        plate = self.src[..., :3].copy()
        if window is not None:
            inside = (window > .5).astype(np.uint8)
            # miroir : chaque pixel hors fenêtre prend la couleur de son symétrique par rapport au bord le plus proche
            d, lab = cv2.distanceTransformWithLabels(1 - inside, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
            ys, xs = np.nonzero(inside == 0)
            zy, zx = np.nonzero(inside)  # les pixels "zéro" de 1-inside, dans l'ordre des labels
            order = lab[zy, zx]
            cy = np.zeros(order.max() + 1, np.float32); cx = np.zeros(order.max() + 1, np.float32)
            cy[order] = zy; cx[order] = zx
            l = lab[ys, xs]
            my_ = np.clip(2 * cy[l] - ys, 0, H - 1).astype(np.int32); mx_ = np.clip(2 * cx[l] - xs, 0, W - 1).astype(np.int32)
            ok = inside[my_, mx_] > 0
            plate[ys[ok], xs[ok]] = self.src[my_[ok], mx_[ok], :3]
            hole = ((fr > 0) & (inside > 0)).astype(np.uint8)  # bandeau, médaillons… posés dans la fenêtre
            hole |= ((inside == 0) & ~np.zeros_like(inside, bool)).astype(np.uint8) * 0
            band = cv2.dilate(hole, np.ones((5, 5), np.uint8)) & inside
            if band.any():
                plate = cv2.inpaint(plate, band, 6, cv2.INPAINT_TELEA)
        else:
            hard = fr
            band = cv2.dilate((1 - hard), np.ones((61, 61), np.uint8)) & hard
            plate = cv2.inpaint(plate, band, 6, cv2.INPAINT_TELEA)
        self.plate = np.dstack([plate, np.full((H, W), 255, np.uint8)])

    # --- déformations ---
    def sway(self, root, weight, amp_deg, cycles=1, phase=0.0):
        """rotation autour de root, pondérée (0 à la racine, 1 au bout)"""
        rx, ry = root
        px, py = XX - rx, YY - ry
        def f(t):
            th = math.radians(amp_deg) * math.sin(2 * math.pi * (cycles * t + phase)) * weight
            c, s = np.cos(-th), np.sin(-th)
            return (c * px - s * py + rx) - XX, (s * px + c * py + ry) - YY
        self.warps.append(f)

    def curl(self, root, weight, amp_deg, wavelength, cycles=1, phase=0.0):
        """ondulation qui voyage de la racine vers le bout (tentacule, cheveux)"""
        rx, ry = root
        px, py = XX - rx, YY - ry
        d = np.sqrt(px ** 2 + py ** 2)
        def f(t):
            th = math.radians(amp_deg) * np.sin(2 * math.pi * (cycles * t - d / wavelength + phase)) * weight
            c, s = np.cos(-th), np.sin(-th)
            return (c * px - s * py + rx) - XX, (s * px + c * py + ry) - YY
        self.warps.append(f)

    def bob(self, center, mask, dy=3, dx=0, rot=0.0, cycles=1, phase=0.0):
        cx, cy = center
        px, py = XX - cx, YY - cy
        def f(t):
            s_ = math.sin(2 * math.pi * (cycles * t + phase))
            c_ = math.cos(2 * math.pi * (cycles * t + phase))
            th = math.radians(rot) * c_
            c, s = math.cos(-th), math.sin(-th)
            ox = (c * px - s * py + cx) - XX - dx * c_
            oy = (s * px + c * py + cy) - YY - dy * s_
            return ox * mask, oy * mask
        self.warps.append(f)

    def breathe(self, center, mask, amp=0.012, cycles=1, phase=0.0):
        cx, cy = center
        def f(t):
            k = -amp * math.sin(2 * math.pi * (cycles * t + phase))
            return (XX - cx) * k * mask, (YY - cy) * k * mask
        self.warps.append(f)

    def water(self, mask, amp=2.5, lx=90, ly=40, cycles=(1, 2), dirs=(1, -1)):
        def f(t):
            dx = amp * .6 * np.sin(2 * math.pi * (YY / ly + dirs[0] * cycles[0] * t)) * mask
            dy = amp * (np.sin(2 * math.pi * (XX / lx + dirs[1] * cycles[1] * t + YY / 170)) * .7
                        + np.sin(2 * math.pi * (XX / (lx * .47) - cycles[0] * t)) * .3) * mask
            return dx, dy
        self.warps.append(f)

    def flow(self, mask, amp=4, lx=60, ly=120, cycles=1, phase=0.0, axis='x'):
        """onde progressive (cheveux, algues, voile) le long d'un axe"""
        def f(t):
            if axis == 'x':
                v = amp * np.sin(2 * math.pi * (YY / ly - cycles * t + phase)) * mask
                return v, v * 0
            v = amp * np.sin(2 * math.pi * (XX / lx - cycles * t + phase)) * mask
            return v * 0, v
        self.warps.append(f)

    # --- effets de lumière (après déformation) ---
    def glow(self, c, r, color, amp=(0.35, 1.0), cycles=1, phase=0.0, follow=True):
        g = np.exp(-(((XX - c[0]) ** 2 + (YY - c[1]) ** 2) / (2 * (r / 2.2) ** 2))).astype(np.float32)
        col = np.array(color[::-1], np.float32) / 255  # BGR
        def p(img, t, mx, my):
            a = amp[0] + (amp[1] - amp[0]) * (.5 + .5 * math.sin(2 * math.pi * (cycles * t + phase)))
            gg = cv2.remap(g, mx, my, cv2.INTER_LINEAR) if follow else g  # la lueur suit l'élément qui bouge
            img[..., :3] = img[..., :3] + (gg * a)[..., None] * col[None, None] * 255 * (1 - img[..., :3] / 255 * .5)
            return img
        self.posts.append(p)

    def flicker(self, mask, amp=0.25, seed=1, warped=True):
        rng = np.random.default_rng(seed)
        ks = rng.integers(3, 9, 4); ph = rng.random(4)
        def p(img, t, mx, my):
            m = cv2.remap(mask, mx, my, cv2.INTER_LINEAR) if warped else mask
            v = sum(math.sin(2 * math.pi * (k * t + q)) for k, q in zip(ks, ph)) / 4
            img[..., :3] = img[..., :3] * (1 + amp * v * m)[..., None]
            return img
        self.posts.append(p)

    def flash(self, mask, times, color=(215, 228, 255), amp=0.5, dur=0.035):
        col = np.array(color[::-1], np.float32)
        def p(img, t, mx, my):
            a = 0
            for t0, k in times:
                if 0 <= t - t0 < dur * 4:
                    a = max(a, k * max(0, 1 - (t - t0) / (dur * 4)) * (1 if (t - t0) < dur or (t - t0) > dur * 2 else .25))
            if a:
                img[..., :3] = img[..., :3] + (mask * a * amp)[..., None] * (col - img[..., :3] * .6)
            return img
        self.posts.append(p)

    def add_post(self, fn):
        self.posts.append(fn)

    def frame(self, i):
        t = i / self.N
        dx = np.zeros((H, W), np.float32); dy = np.zeros((H, W), np.float32)
        for f in self.warps:
            a, b = f(t); dx += a; dy += b
        if self.keep is not None:
            dx *= self.keep; dy *= self.keep
        mx, my = XX + dx, YY + dy
        if self.frame_m is not None:
            wv = cv2.remap(self.plate, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
            f = self.frame_m[..., None]
            img = self.src.astype(np.float32) * f + wv * (1 - f)
        else:
            img = cv2.remap(self.src, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
        for p in self.posts:
            img = p(img, t, mx, my)
        return np.clip(img, 0, 255).astype(np.uint8)

    def render(self, out, size=720, bg=(16, 12, 10)):
        os.makedirs(out + '_f', exist_ok=True)
        for i in range(self.N):
            fr = self.frame(i)
            a = fr[..., 3:4].astype(np.float32) / 255
            rgb = (fr[..., :3] * a + np.array(bg[::-1]) * (1 - a)).astype(np.uint8)
            if size != W:
                rgb = cv2.resize(rgb, (size, int(H * size / W)), interpolation=cv2.INTER_AREA)
            cv2.imwrite(f'{out}_f/{i:04d}.png', rgb)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(self.fps), '-i', f'{out}_f/%04d.png',
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', out + '.mp4'], check=True)
        return out + '.mp4'


def detect_window(src, guess, search=45, smooth=41, pad=2):
    """Trouve le bord intérieur réel du cadre (le filet doré) autour du rectangle estimé `guess`
    = (x0, y0, x1, y1). On part de l'intérieur et on avance vers le cadre jusqu'au premier pixel doré.
    Renvoie un masque 0/1 de la fenêtre de l'illustration, collé au filet."""
    hsv = cv2.cvtColor(src[..., :3], cv2.COLOR_BGR2HSV).astype(np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    gold = (h >= 10) & (h <= 36) & (s >= 60) & (v >= 105)
    gold2 = gold & np.roll(gold, 1, 1) & np.roll(gold, -1, 1)
    goldv = gold & np.roll(gold, 1, 0) & np.roll(gold, -1, 0)
    x0, y0, x1, y1 = guess
    L = np.full(H, np.nan); R = np.full(H, np.nan); T = np.full(W, np.nan); B = np.full(W, np.nan)
    for y in range(y0, y1):
        for x in range(x0 + search, x0 - search, -1):
            if gold2[y, x]: L[y] = x + 1 + pad; break
        for x in range(x1 - search, x1 + search):
            if gold2[y, x]: R[y] = x - 1 - pad; break
    for x in range(x0, x1):
        for y in range(y0 + search, y0 - search, -1):
            if goldv[y, x]: T[x] = y + 1 + pad; break
        for y in range(y1 - search, y1 + search):
            if goldv[y, x]: B[x] = y - 1 - pad; break
    def clean(a, lo, hi, default):
        idx = np.arange(len(a)); ok = ~np.isnan(a)
        if ok.sum() < 10:
            return np.full(len(a), default, float)
        a = np.interp(idx, idx[ok], a[ok])
        from scipy.ndimage import median_filter
        a = median_filter(a, size=smooth, mode='nearest')
        return a
    L = clean(L, y0, y1, x0); R = clean(R, y0, y1, x1); T = clean(T, x0, x1, y0); B = clean(B, x0, x1, y1)
    m = ((XX >= L[:, None]) & (XX <= R[:, None]) & (YY >= T[None, :]) & (YY <= B[None, :])).astype(np.float32)
    return m, (L, R, T, B)


def window_rect(key):
    """fenêtre exacte de l'illustration (bord intérieur du filet doré), mesurée une fois par carte"""
    import json, os
    L, T, R, B = json.load(open(os.path.join(os.path.dirname(__file__), 'windows.json')))[key]
    return ((XX >= L) & (XX <= R) & (YY >= T) & (YY <= B)).astype(np.float32)
