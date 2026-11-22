"""生成安卓图标与启动图（复用 h5 的宝石图标设计）"""
from PIL import Image, ImageDraw, ImageFont
import os, glob

RES = os.path.join(os.path.dirname(__file__), 'android', 'app', 'src', 'main', 'res')

GEMS = [(0xD4, 0xA5, 0xA5), (0x8F, 0xA8, 0xB8), (0x9C, 0xAF, 0x9E), (0xDF, 0xC4, 0x98)]
LIGHTS = [(0xF2, 0xDE, 0xDE), (0xD2, 0xE1, 0xE9), (0xD8, 0xE4, 0xD6), (0xF6, 0xE9, 0xCC)]
BG = (0xF4, 0xF1, 0xEA)


def gem_square(S, bg=True, radius_ratio=0.22):
    """画一张 S×S 的宝石方块图"""
    K = 4  # 超采样
    N = S * K
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))

    # 底色渐变 + 圆角
    if bg:
        layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for y in range(N):
            t = y / (N - 1)
            c = (int(BG[0] + (0xE7 - BG[0]) * t), int(BG[1] + (0xE2 - BG[1]) * t), int(BG[2] + (0xD8 - BG[2]) * t))
            ld.line([(0, y), (N, y)], fill=c + (255,))
        mask = Image.new('L', (N, N), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, N - 1, N - 1], radius=int(N * radius_ratio), fill=255)
        layer.putalpha(mask)
        img = Image.alpha_composite(img, layer)

    d = ImageDraw.Draw(img)

    pad = int(N * 0.155)
    d.rounded_rectangle([pad, pad, N - pad, N - pad], radius=int(N * 0.11), fill=(0x6B, 0x66, 0x5D, 255))
    inset = int(N * 0.028)
    d.rounded_rectangle([pad + inset, pad + inset, N - pad - inset, N - pad - inset],
                        radius=int(N * 0.09), fill=(0x76, 0x72, 0x69, 255))

    inner = N - 2 * pad - 2 * inset
    cell = int(inner * 0.40)
    gap = int(inner * 0.085)
    total = cell * 2 + gap
    x0 = (N - total) // 2
    y0 = x0
    rad = int(cell * 0.28)

    overlay = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    for i in range(4):
        cx = x0 + (i % 2) * (cell + gap)
        cy = y0 + (i // 2) * (cell + gap)
        d.rounded_rectangle([cx, cy, cx + cell, cy + cell], radius=rad, fill=GEMS[i] + (255,))
        lr = int(cell * 0.28)
        od.ellipse([cx + int(cell * 0.13), cy + int(cell * 0.11),
                    cx + int(cell * 0.13) + lr, cy + int(cell * 0.11) + lr], fill=LIGHTS[i] + (150,))
        for k in range(int(cell * 0.22)):
            yy = cy + cell - 1 - k
            a = int(22 * (1 - k / (cell * 0.22)) ** 1.6)
            if a > 0:
                od.line([(cx + rad * 0.35, yy), (cx + cell - rad * 0.35, yy)], fill=(0, 0, 0, a))

    img = Image.alpha_composite(img, overlay)
    return img.resize((S, S), Image.LANCZOS)


def rounded_mask(im, ratio=0.22):
    S = im.size[0]
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * ratio), fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


def circle_mask(im):
    S = im.size[0]
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, S - 1, S - 1], fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


# ---- legacy + round icons ----
DENS = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for name, px in DENS.items():
    big = gem_square(px * 4, bg=True)
    sq = rounded_mask(big, 0.22).resize((px, px), Image.LANCZOS)
    sq.save(os.path.join(RES, 'mipmap-' + name, 'ic_launcher.png'))
    rd = circle_mask(big).resize((px, px), Image.LANCZOS)
    rd.save(os.path.join(RES, 'mipmap-' + name, 'ic_launcher_round.png'))
    print('icon', name, px)

# ---- adaptive foreground：透明底，图形缩到安全区 ----
FDENS = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for name, px in FDENS.items():
    canvas = Image.new('RGBA', (px * 2, px * 2), (0, 0, 0, 0))
    inner_size = int(px * 2 * 0.62)          # 108dp 画布中图形占 62%（安全区 66dp≈61%）
    art = gem_square(inner_size * 2, bg=False).resize((inner_size, inner_size), Image.LANCZOS)
    canvas.alpha_composite(art, ((px * 2 - inner_size) // 2, (px * 2 - inner_size) // 2))
    canvas.resize((px, px), Image.LANCZOS).save(os.path.join(RES, 'mipmap-' + name, 'ic_launcher_foreground.png'))
    print('fg', name, px)

# ---- splash ----
FONT = 'C:/Windows/Fonts/msyhbd.ttc'
for path in glob.glob(os.path.join(RES, 'drawable*', 'splash.png')):
    w, h = Image.open(path).size
    canvas = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(canvas)
    side = int(min(w, h) * 0.30)
    art = gem_square(side * 3, bg=False).resize((side, side), Image.LANCZOS)
    top = (h - side) // 2 - int(min(w, h) * 0.05)
    canvas.paste(art, ((w - side) // 2, top), art)
    try:
        fs = max(16, int(min(w, h) * 0.045))
        f = ImageFont.truetype(FONT, fs)
        title = '宝石方块乐园'
        tw = d.textlength(title, font=f)
        d.text(((w - tw) / 2, top + side + int(min(w, h) * 0.045)),
               title, font=f, fill=(0x5A, 0x58, 0x54))
    except Exception as e:
        print('font skip', e)
    canvas.save(path)
    print('splash', os.path.basename(os.path.dirname(path)), w, h)

print('done')
