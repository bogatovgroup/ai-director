"""Картинка для превью ссылки (img/og.jpg, 1200x630). Запуск из папки сайта: python tools/generators/make_og.py
Требуется: pip install pillow. Шрифты Arial Black / Arial Bold берутся из C:/Windows/Fonts (на другой системе заменить пути)."""
import math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

DATE_TEXT = "Старт 20.11.2026, 19:00 МСК"
W, H = 1200, 630

bg = Image.new("RGB", (W, H), (5, 0, 8))
glow = Image.new("RGB", (W, H), (5, 0, 8))
ImageDraw.Draw(glow).ellipse((650, -120, 1350, 580), fill=(90, 40, 190))
glow = glow.filter(ImageFilter.GaussianBlur(120))
bg = Image.blend(bg, glow, 0.75)
d = ImageDraw.Draw(bg)
for x in range(0, W, 28):
    for y in range(0, H, 28):
        d.point((x, y), fill=(40, 25, 70))

random.seed(3)
cx, cy, R = 900, 315, 210
for _ in range(2200):
    th = random.random() * 2 * math.pi
    ph = math.acos(2 * random.random() - 1)
    x = math.sin(ph) * math.cos(th)
    y = math.cos(ph)
    z = math.sin(ph) * math.sin(th)
    if z < 0:
        continue
    lam = max(0, x * 0.5 + y * 0.5 + z * 0.7)
    v = int(110 + 130 * lam)
    px, py = cx + x * R, cy - y * R
    d.ellipse((px - 1.6, py - 1.6, px + 1.6, py + 1.6), fill=(v, max(90, v - 20), 255))

fonts = "C:/Windows/Fonts/"
F = lambda s: ImageFont.truetype(fonts + "ariblk.ttf", s)
B = lambda s: ImageFont.truetype(fonts + "arialbd.ttf", s)

mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).text((70, 170), "ИИ-Директор", font=F(112), fill=255)
grad = Image.new("RGB", (W, H))
gp = grad.load()
for y in range(H):
    for x in range(W):
        t = min(1, max(0, (x - 70) / 620))
        gp[x, y] = (int(216 - 92 * t), int(204 - 146 * t), int(255 - 18 * t))
bg.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(bg)
d.text((72, 70), "AI-DIR | CAIO", font=B(34), fill=(167, 139, 250))
d.text((72, 320), "Программа для тех, кто хочет,", font=B(40), fill=(235, 230, 255))
d.text((72, 370), "чтобы ИИ приносил деньги в компанию", font=B(40), fill=(235, 230, 255))
d.rounded_rectangle((72, 470, 545, 540), radius=16, fill=(124, 58, 237))
d.text((100, 486), DATE_TEXT, font=B(30), fill=(255, 255, 255))

out = os.path.join("img", "og.jpg")
bg.save(out, quality=88, optimize=True)
print(out, os.path.getsize(out))
