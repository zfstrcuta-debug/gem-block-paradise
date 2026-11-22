from PIL import Image, ImageDraw

S = 1024  # 超采样后缩小，边缘更平滑
GEMS = [(0xD4, 0xA5, 0xA5), (0x8F, 0xA8, 0xB8), (0x9C, 0xAF, 0x9E), (0xDF, 0xC4, 0x98)]
LIGHTS = [(0xF2, 0xDE, 0xDE), (0xD2, 0xE1, 0xE9), (0xD8, 0xE4, 0xD6), (0xF6, 0xE9, 0xCC)]

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 底色：暖米垂直微渐变
for y in range(S):
    t = y / (S - 1)
    r = int(0xF4 + (0xE9 - 0xF4) * t)
    g = int(0xF1 + (0xE4 - 0xF1) * t)
    b = int(0xEA + (0xDC - 0xEA) * t)
    d.line([(0, y), (S, y)], fill=(r, g, b, 255))

# 圆角遮罩（iOS 会自己再切，但先做出圆角观感）
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
img.putalpha(mask)

# 棋盘盘
pad = int(S * 0.155)
d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=int(S * 0.11), fill=(0x6B, 0x66, 0x5D, 255))
# 盘面内圈稍亮，做出凹陷感
inset = int(S * 0.028)
d.rounded_rectangle([pad + inset, pad + inset, S - pad - inset, S - pad - inset],
                    radius=int(S * 0.09), fill=(0x76, 0x72, 0x69, 255))

# 2×2 宝石
inner = S - 2 * pad - 2 * inset
cell = int(inner * 0.40)
gap = int(inner * 0.085)
total = cell * 2 + gap
x0 = (S - total) // 2
y0 = x0
rad = int(cell * 0.28)

overlay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)

for i in range(4):
    cx = x0 + (i % 2) * (cell + gap)
    cy = y0 + (i // 2) * (cell + gap)
    base = GEMS[i]
    d.rounded_rectangle([cx, cy, cx + cell, cy + cell], radius=rad, fill=base + (255,))
    # 顶部亮面
    lr = int(cell * 0.28)
    od.ellipse([cx + int(cell * 0.13), cy + int(cell * 0.11),
                cx + int(cell * 0.13) + lr, cy + int(cell * 0.11) + lr],
               fill=LIGHTS[i] + (150,))
    # 底部渐暗（逐行叠加，越靠下越深，最多 22% 黑）
    for k in range(int(cell * 0.22)):
        yy = cy + cell - 1 - k
        a = int(22 * (1 - k / (cell * 0.22)) ** 1.6)
        if a <= 0:
            continue
        od.line([(cx + rad * 0.35, yy), (cx + cell - rad * 0.35, yy)], fill=(0, 0, 0, a))

img = Image.alpha_composite(img, overlay)

img.convert('RGB').resize((512, 512), Image.LANCZOS).save('icon-512.png')
img.convert('RGB').resize((192, 192), Image.LANCZOS).save('icon-192.png')
img.convert('RGB').resize((180, 180), Image.LANCZOS).save('icon-180.png')
print('icons ok')
