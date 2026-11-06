# ai-dir.ru: что нужно сделать на сервере (для администратора)

Из репозитория это не исправить: настройки Caddy и DNS. Проверено 06.11.2026 снаружи.

## 1. DDoS: включить проксирование Cloudflare (важнее всего)
Сейчас A-запись ai-dir.ru ведёт прямо на 195.209.210.90 (в Cloudflare режим "DNS only"), фильтрации нет.
1. Cloudflare -> DNS -> записи ai-dir.ru и www: включить оранжевое облако (Proxied).
2. SSL/TLS -> режим Full (strict). Сертификат Let's Encrypt на сервере остаётся.
3. Security -> включить Bot Fight Mode, при атаке "Under Attack Mode".
4. В Caddy принимать 80/443 только с адресов Cloudflare (https://www.cloudflare.com/ips/) и настроить доверенные прокси, чтобы PHP видел реальный IP:
```
{
    servers {
        trusted_proxies static 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
        client_ip_headers CF-Connecting-IP
    }
}
```
(и в php_fastcgi передать `trusted_proxies`, либо в firewall закрыть 80/443 для остальных адресов).

## 2. Заголовки и кэш
```
ai-dir.ru {
    encode zstd gzip
    header {
        -Server
        X-Content-Type-Options nosniff          # PHP-обработчик его больше не ставит, дубля не будет
    }
    @static path *.css *.js *.woff2 *.webp *.jpg *.png *.svg *.mp4 *.ico
    header @static Cache-Control "public, max-age=31536000, immutable"   # CSS/JS с ?v=хэш, безопасно
    @html path / *.html
    header @html Cache-Control "public, max-age=300, must-revalidate"
}
```

## 3. Лимит запросов к форме (нужен модуль caddy-ratelimit)
```
@lead path /api/lead.php
rate_limit @lead {
    zone lead { key {remote_host}  events 20  window 1m }
}
```

## 4. CSP: перевести из Report-Only в боевой
Сейчас стоит Content-Security-Policy-Report-Only. После недели без нарушений в отчётах (проверить Метрику, виджет HH, форму) заменить имя заголовка на Content-Security-Policy.

## 5. Сервер
Обновления ОС и PHP, вход по SSH только по ключу, ufw/nftables (открыты 22, 80, 443), fail2ban, права: lead_config.php и журнал заявок вне веб-корня, права 600/700.
