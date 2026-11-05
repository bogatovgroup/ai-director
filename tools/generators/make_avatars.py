"""Аватарки профессий из фото. Запуск из папки сайта: python tools/generators/make_avatars.py
Берёт img/avatars/source/prof-1..4.(jpg|jpeg|png|webp), делает квадратный кадр (лицо в верхней части), 192x192 webp -> img/avatars/prof-N.webp.
Требуется: pip install pillow. После запуска в index.html заменить src="img/avatars/prof-N.svg" на prof-N.webp (скрипт делает это сам с ключом --html)."""
import os, re, sys
from PIL import Image

# Кадры по лицам (left, top, right, bottom) в пикселях исходных фото; для остальных кадр берётся автоматически сверху.
CROPS = {
    1: (0, 30, 736, 766),       # prof-1: мужчина с седыми волосами (736x977)
    2: (0, 300, 1080, 1380),    # prof-2: мужчина в очках (1080x1920)
    3: (10, 30, 450, 470),      # prof-3: мужчина с бородой (474x711)
    4: (265, 0, 465, 200),      # prof-4: женщина (643x360)
}

src_dir = os.path.join("img", "avatars", "source")
out_dir = os.path.join("img", "avatars")
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
    side = min(w, h)
    left = (w - side) // 2
    top = 0 if h > side else 0          # лицо обычно в верхней половине: берём верх кадра
    if h > side:
        top = int((h - side) * 0.15)    # чуть ниже самого верха, чтобы не обрезать макушку
    box = CROPS.get(n)
    if box and box[2] <= w and box[3] <= h:
        im = im.crop(box).resize((192, 192), Image.LANCZOS)
    else:
        im = im.crop((left, top, left + side, top + side)).resize((192, 192), Image.LANCZOS)
    out = os.path.join(out_dir, f"prof-{n}.webp")
    im.save(out, "WEBP", quality=82, method=6)
    print(out, os.path.getsize(out), "байт")
    done.append(n)

if "--html" in sys.argv and done:
    s = open("index.html", encoding="utf-8").read()
    for n in done:
        s = s.replace(f'src="img/avatars/prof-{n}.svg"', f'src="img/avatars/prof-{n}.webp"')
    open("index.html", "w", encoding="utf-8").write(s)
    print("index.html обновлён для:", done)
