"""Аватарки профессий из фото. Запуск из папки сайта: python tools/generators/make_avatars.py
Берёт img/avatars/source/prof-1..4.(jpg|jpeg|png|webp), вырезает человека из фона, ставит на матовый перламутровый фон,
кадрирует по лицу и сохраняет 192x192 webp -> img/avatars/prof-N.webp.

Требуется: pip install pillow numpy rembg onnxruntime  (при первом запуске rembg скачивает модель u2net_human_seg ~176 МБ в папку пользователя).
Ключи: --keep-bg  оставить исходный фон фото (без вырезания);  --html  заменить src="...prof-N.svg" на .webp в index.html."""
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

# Кадры по лицам (left, top, right, bottom) в пикселях исходных фото; рамка может выходить за края (там будет перламутровый фон).
CROPS = {
    1: (-65, -25, 785, 825),      # prof-1: мужчина с седыми волосами (736x977), голова целиком
    2: (-275, -75, 1355, 1555),   # prof-2: мужчина в очках (1080x1920)
    3: (-80, -45, 550, 585),      # prof-3: мужчина с бородой (474x711), лицо мельче (кадр шире на 20%)
    4: (262, -8, 462, 192),       # prof-4: женщина (643x360), лицо крупнее на 10%
}
SIZE = 192

def pearl(size=SIZE, seed=7):
    """Матовый перламутр: мягкий светлый градиент с розовыми, мятными и сиреневыми разводами и лёгкой зернистостью."""
    rng = np.random.default_rng(seed)
    base = Image.new("RGB", (size, size))
    px = base.load()
    c0, c1 = (247, 242, 251), (232, 236, 247)      # светлый лавандово-белый -> голубоватый
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
    layer = Image.new("RGB", (size, size), (0, 0, 0))
    mask_all = Image.new("L", (size, size), 0)
    blobs = [((-0.1, 0.1, 0.65, 0.7), (244, 214, 232)),   # розовый
             ((0.35, -0.2, 1.1, 0.5), (214, 236, 232)),   # мятный
             ((0.0, 0.5, 0.7, 1.15), (222, 212, 245)),    # сиреневый
             ((0.45, 0.55, 1.15, 1.1), (246, 232, 214))]  # тёплый песочный отсвет
    out = base.copy()
    for (x0, y0, x1, y1), col in blobs:
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).ellipse((x0 * size, y0 * size, x1 * size, y1 * size), fill=150)
        m = m.filter(ImageFilter.GaussianBlur(size * 0.18))
        out = Image.composite(Image.new("RGB", (size, size), col), out, m)
    arr = np.asarray(out).astype(np.int16)
    arr += rng.integers(-3, 4, size=arr.shape[:2])[..., None]   # едва заметная матовая зернистость
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def cutout(im, session):
    """Вырезает человека; возвращает RGBA. Край слегка сжимается, чтобы не оставалось каймы старого фона."""
    from rembg import remove
    rgba = remove(im, session=session).convert("RGBA")
    a = rgba.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba.putalpha(a)
    return rgba

src_dir = os.path.join("img", "avatars", "source")
out_dir = os.path.join("img", "avatars")
keep_bg = "--keep-bg" in sys.argv
session = None
if not keep_bg:
    from rembg import new_session
    session = new_session("u2net_human_seg")

bg = pearl()
done = []
for n in range(1, 5):
    path = None
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = os.path.join(src_dir, f"prof-{n}.{ext}")
        if os.path.exists(p):
            path = p
            break
    if not path:
        print(f"prof-{n}: файла нет, пропуск")
        continue
    im = Image.open(path).convert("RGB")
    w, h = im.size
    box = CROPS.get(n)
    if not box:
        side = min(w, h)
        left = (w - side) // 2
        top = int((h - side) * 0.15) if h > side else 0
        box = (left, top, left + side, top + side)
    l, t, r, b = box
    side = r - l
    if keep_bg:
        top_strip = im.crop((0, 0, w, 8))
        fill = tuple(int(v) for v in np.median(np.asarray(top_strip).reshape(-1, 3), axis=0))
        canvas = Image.new("RGB", (side, side), fill)
        canvas.paste(im, (-l, -t))
        res = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    else:
        person = cutout(im, session)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(person, (-l, -t))
        person_small = canvas.resize((SIZE, SIZE), Image.LANCZOS)
        res = bg.copy()
        res.paste(person_small, (0, 0), person_small)
        person_small.save(os.path.join(src_dir, f"_cut-{n}.png"))
    out = os.path.join(out_dir, f"prof-{n}.webp")
    res.save(out, "WEBP", quality=84, method=6)
    print(out, os.path.getsize(out), "байт")
    done.append(n)

if "--html" in sys.argv and done:
    s = open("index.html", encoding="utf-8").read()
    for n in done:
        s = s.replace(f'src="img/avatars/prof-{n}.svg"', f'src="img/avatars/prof-{n}.webp"')
    open("index.html", "w", encoding="utf-8").write(s)
    print("index.html обновлён для:", done)
