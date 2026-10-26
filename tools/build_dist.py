#!/usr/bin/env python3
"""Сборка папки dist/ для выгрузки на хостинг.

Использование:
    python tools/build_dist.py ваш-домен.ru

Что делает:
  - копирует сайт в dist/ без служебных файлов (.git, tools, extras, отчёты, Python-скрипты);
  - подставляет домен вместо example.ru в robots.txt и sitemap.xml;
  - вставляет в index.html и documents.html canonical, og:url, og:image, twitter:image и JSON-LD;
  - печатает список того, что нужно проверить вручную.
Содержимое папки dist/ целиком загружается в корень сайта на хостинге.
"""
import os, re, shutil, sys, datetime, json

if len(sys.argv) != 2 or "." not in sys.argv[1]:
    sys.exit("Укажите домен: python tools/build_dist.py ваш-домен.ru")
domain = sys.argv[1].lower().replace("https://", "").replace("http://", "").strip("/")
base = "https://" + domain
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(root, "dist")
skip_dirs = {".git", "dist", "tools", "extras", "node_modules", "__pycache__"}
skip_files = {".gitattributes", ".gitignore"}
skip_ext = {".md", ".py", ".txt"}
keep_txt = {"robots.txt"}

if os.path.isdir(dist):
    shutil.rmtree(dist)
for dp, dn, fn in os.walk(root):
    dn[:] = [d for d in dn if d not in skip_dirs]
    for f in fn:
        ext = os.path.splitext(f)[1].lower()
        if f in skip_files or (ext in skip_ext and f not in keep_txt):
            continue
        src = os.path.join(dp, f)
        dst = os.path.join(dist, os.path.relpath(src, root))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)

def rw(path, fn):
    p = os.path.join(dist, path)
    s = open(p, encoding="utf-8").read()
    open(p, "w", encoding="utf-8", newline="\n").write(fn(s))

today = datetime.date.today().isoformat()
for f in ("robots.txt", "sitemap.xml"):
    rw(f, lambda s: s.replace("https://example.ru", base).replace("2026-10-26", today))

ld = json.dumps({
    "@context": "https://schema.org", "@type": "Course", "name": "Директор по внедрению ИИ",
    "description": "Практическая программа: 6 модулей, 33 темы, пакет из 19 документов и защита перед комиссией.",
    "provider": {"@type": "Organization", "name": "АО «Ай Ти Сфера»", "url": base + "/"},
    "offers": {"@type": "Offer", "price": "150000", "priceCurrency": "RUB", "url": base + "/#tariffs"},
}, ensure_ascii=False)
meta_index = (f'<link rel="canonical" href="{base}/"><meta property="og:url" content="{base}/">'
              f'<meta property="og:image" content="{base}/img/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
              f'<meta name="twitter:image" content="{base}/img/og.jpg"><script type="application/ld+json">{ld}</script>')
rw("index.html", lambda s: s.replace("<!--DOMAIN-META-->", meta_index))
rw("documents.html", lambda s: s.replace("<title>", f'<link rel="canonical" href="{base}/documents.html"><title>', 1))

size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(dist) for f in fs)
print(f"Готово: {dist}  ({size/1024/1024:.1f} МБ)\nДомен в файлах: {base}")
print("\nПроверьте вручную:\n - заполнены ли вставки [ВСТАВИТЬ] в legal/*.html (grep -r ВСТАВИТЬ dist)\n - лежит ли lead_config.php выше корня сайта (инструкция в api/lead.php)\n - работает ли отправка формы на хостинге (PHP 8+, функция mail() или SMTP)")
