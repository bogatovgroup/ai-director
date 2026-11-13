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
skip_dirs = {".git", "dist", "tools", "extras", "node_modules", "__pycache__", "_rz", "_gate"}
skip_files = {".gitattributes", ".gitignore", "start-preview.bat"}
skip_ext = {".md", ".py", ".txt"}
keep_txt = {"robots.txt", "security.txt", "llms.txt"}

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

# JSON-LD строится из видимого текста страницы (FAQ берётся из блока «Частые вопросы»), чтобы разметка не расходилась с сайтом
_src = open(os.path.join(dist, "index.html"), encoding="utf-8").read()
def _txt(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h)).replace(" ,", ",").replace(" .", ".").strip()
_faq_html = re.search(r'<section id="faq".*?</section>', _src, re.S)
_faq = [{"@type": "Question", "name": _txt(q), "acceptedAnswer": {"@type": "Answer", "text": _txt(a)}}
        for q, a in re.findall(r"<summary>(.*?)</summary>(.*?)</details>", _faq_html.group(0) if _faq_html else "", re.S)]
_org = {"@type": "Organization", "@id": base + "/#org", "name": "АО «Ай Ти Сфера»", "url": base + "/",
        "email": "aidir@aiskolkovo.ru", "logo": base + "/favicon-192.png"}
_offer = lambda name, price: {"@type": "Offer", "name": name, "price": price, "priceCurrency": "RUB",
                              "url": base + "/#tariffs", "availability": "https://schema.org/InStock", "category": "Paid"}
_graph = [
    _org,
    {"@type": "WebSite", "@id": base + "/#site", "url": base + "/", "name": "AI-DIR", "alternateName": ["ИИ-Директор", "CAIO"], "inLanguage": "ru", "publisher": {"@id": base + "/#org"}},
    {"@type": "Course", "@id": base + "/#course", "name": "Директор по внедрению ИИ",
     "description": "Практическая программа для тех, кто отвечает за внедрение ИИ в компании: 6 модулей, 33 темы, 92 видео, пакет из 19 документов и защита перед комиссией.",
     "inLanguage": "ru", "provider": {"@id": base + "/#org"},
     "author": {"@type": "Person", "name": "Сергей Курьян", "url": "https://sergeykuryan.ru"},
     "offers": [_offer("Онлайн", "150000"), _offer("Комбинированный", "250000"), _offer("Офлайн в Москве", "500000")],
     "hasCourseInstance": [
        {"@type": "CourseInstance", "courseMode": "Online", "startDate": "2026-11-20", "courseWorkload": "PT141H"},
        {"@type": "CourseInstance", "courseMode": "Blended", "startDate": "2026-11-20", "location": {"@type": "Place", "name": "Москва", "address": "Москва"}},
        {"@type": "CourseInstance", "courseMode": "Onsite", "startDate": "2026-11-20", "location": {"@type": "Place", "name": "Москва", "address": "Москва"}}]},
    {"@type": "Event", "name": "Онлайн-конференция: запуск курса «ИИ-Директор»", "startDate": "2026-11-20T19:00:00+03:00",
     "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode", "eventStatus": "https://schema.org/EventScheduled",
     "location": {"@type": "VirtualLocation", "url": base + "/#conference"}, "organizer": {"@id": base + "/#org"},
     "performer": {"@type": "Person", "name": "Сергей Курьян"}, "url": base + "/#conference"},
]
if _faq:
    _graph.append({"@type": "FAQPage", "mainEntity": _faq})
ld = json.dumps({"@context": "https://schema.org", "@graph": _graph}, ensure_ascii=False).replace("</", "<\\/")
meta_index = (f'<link rel="canonical" href="{base}/"><meta property="og:url" content="{base}/">'
              f'<meta property="og:image" content="{base}/img/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
              f'<meta name="twitter:image" content="{base}/img/og.jpg"><script type="application/ld+json">{ld}</script>')
rw("index.html", lambda s: s.replace("<!--DOMAIN-META-->", meta_index))
rw("documents.html", lambda s: s.replace("<title>", f'<link rel="canonical" href="{base}/documents.html"><title>', 1))

size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(dist) for f in fs)
print(f"Готово: {dist}  ({size/1024/1024:.1f} МБ)\nДомен в файлах: {base}")
print("\nПроверьте вручную:\n - заполнены ли вставки [ВСТАВИТЬ] в legal/*.html (grep -r ВСТАВИТЬ dist)\n - лежит ли lead_config.php выше корня сайта (инструкция в api/lead.php)\n - работает ли отправка формы на хостинге (PHP 8+, функция mail() или SMTP)")

# Версии CSS/JS в адресах (?v=хэш): браузеры (Safari) не держат старый стиль после обновления сайта
import hashlib
def _ver(rel):
    return hashlib.md5(open(os.path.join(dist, rel), "rb").read()).hexdigest()[:8]
_ref = re.compile(r'(href|src)="((?:\.\./)?)([\w.-]+\.(?:css|js))"')
for dp, dn, fn in os.walk(dist):
    for f in fn:
        if not f.endswith(".html"):
            continue
        p = os.path.join(dp, f)
        s = open(p, encoding="utf-8").read()
        s2 = _ref.sub(lambda m: f'{m.group(1)}="{m.group(2)}{m.group(3)}?v={_ver(m.group(3))}"', s)
        if s2 != s:
            open(p, "w", encoding="utf-8", newline="\n").write(s2)

# Закрытая страница розыгрыша: копируется ПОСЛЕ всей обработки, как есть (без версий ?v=, canonical и т.п.).
# Caddy эти папки напрямую не отдаёт (404), доступ только через _gate/gate.php.
for _d in ("_gate", "_rz"):
    _src = os.path.join(root, _d)
    if os.path.isdir(_src):
        shutil.copytree(_src, os.path.join(dist, _d))
