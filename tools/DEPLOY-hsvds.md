# Выгрузка сайта на VDS (hsvds.ru): пошаговая инструкция

hsvds.ru предлагает VDS на KVM (дата-центр в Москве). Это отдельный сервер, который настраиваете вы (или ваш администратор). Готовой панели для сайтов на нём нет, поэтому ниже всё по шагам. Домен в примерах: `example.ru`, замените на свой.

## 0. Что заказать
- Образ: **Ubuntu 24.04 (или 22.04) с LEMP**. Если такого образа нет, возьмите чистую Ubuntu и поставьте пакеты командой из шага 3.
- Ресурсы: для этого сайта достаточно **1 ядро, 1 ГБ RAM, 10-20 ГБ SSD**.
- Включите у провайдера бэкапы или снимки сервера, если есть (проверьте в панели).
- Запишите: IP-адрес сервера, пароль root (или SSH-ключ).

## 1. Домен и DNS
У регистратора домена создайте записи:
- `A` для `example.ru` на IP сервера;
- `A` для `www.example.ru` на тот же IP (или CNAME на `example.ru`).
Изменения доходят от 15 минут до нескольких часов.

## 2. Первичная защита сервера (один раз)
Подключитесь: `ssh root@IP-СЕРВЕРА` (в Windows можно PowerShell или программу PuTTY).
```bash
apt update && apt -y upgrade
adduser deploy                     # создать обычного пользователя (придумайте пароль)
usermod -aG sudo deploy
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
apt -y install fail2ban unattended-upgrades
```
Дальше работайте под пользователем `deploy` (`ssh deploy@IP-СЕРВЕРА`). Вход под root по паролю лучше отключить (`PermitRootLogin no` в `/etc/ssh/sshd_config`) после настройки ключа.

## 3. Установка nginx, PHP и сертификатов
```bash
sudo apt -y install nginx php-fpm php-curl certbot
php -v                  # запомнить версию (например 8.3)
ls /run/php/            # найти файл вида php8.3-fpm.sock
```
Почтовый сервер на самой VDS ставить не нужно: письма с заявками уходят через вашу корпоративную почту по SMTP (шаг 7).

## 4. Сборка и загрузка сайта
На своём компьютере в папке проекта:
```
python tools/build_dist.py example.ru
```
Появится папка `dist`. Загрузите её содержимое на сервер в `/var/www/aidir`:
- программой WinSCP или FileZilla (протокол SFTP, пользователь `deploy`), либо
- командой `scp -r dist/* deploy@IP-СЕРВЕРА:/tmp/site/` и затем на сервере `sudo mkdir -p /var/www/aidir && sudo cp -r /tmp/site/* /var/www/aidir/`.

Права на сервере:
```bash
sudo chown -R www-data:www-data /var/www/aidir
sudo find /var/www/aidir -type d -exec chmod 755 {} \;
sudo find /var/www/aidir -type f -exec chmod 644 {} \;
```

## 5. Настройка nginx
1. Скопируйте файл `tools/nginx-site.conf` на сервер в `/etc/nginx/sites-available/aidir`.
2. Замените везде `example.ru` на свой домен и версию PHP в строке `fastcgi_pass` на свою.
3. **Сначала получите сертификат** (до этого блоки с `ssl_certificate` вызовут ошибку). Для первого запуска временно закомментируйте в конфиге блоки 2 и 3 (с `listen 443`) и оставьте только блок 1, затем:
```bash
sudo ln -s /etc/nginx/sites-available/aidir /etc/nginx/sites-enabled/aidir
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/aidir -d example.ru -d www.example.ru --email info@aiskolkovo.ru --agree-tos
```
4. Верните закомментированные блоки, снова `sudo nginx -t && sudo systemctl reload nginx`.
5. Продление сертификата идёт автоматически; проверка: `sudo certbot renew --dry-run`.

## 6. Папка и настройки заявок (вне папки сайта)
```bash
sudo mkdir -p /var/lib/aidir-leads
sudo chown www-data:www-data /var/lib/aidir-leads && sudo chmod 750 /var/lib/aidir-leads
sudo nano /var/www/lead_config.php        # на уровень ВЫШЕ папки сайта /var/www/aidir
sudo chown www-data:www-data /var/www/lead_config.php && sudo chmod 640 /var/www/lead_config.php
```
Содержимое `/var/www/lead_config.php`:
```php
<?php return [
  'mail_to'        => 'info@aiskolkovo.ru',
  'mail_from'      => 'info@aiskolkovo.ru',
  'allowed_hosts'  => ['example.ru', 'www.example.ru'],
  'log_dir'        => '/var/lib/aidir-leads',
  // SMTP вашей почты (пример для Яндекс 360; параметры уточните у провайдера почты):
  'smtp_host' => 'smtp.yandex.ru', 'smtp_port' => 465, 'smtp_secure' => 'ssl',
  'smtp_user' => 'info@aiskolkovo.ru', 'smtp_pass' => 'ПАРОЛЬ-ПРИЛОЖЕНИЯ',
  // Битрикс24 (по желанию): вебхук с правом только crm.lead.add
  // 'bitrix_webhook' => 'https://ВАШ.bitrix24.ru/rest/1/КОД/crm.lead.add.json',
];
```
Этот файл содержит пароли: он не должен лежать в папке сайта и не должен попадать в GitHub.

## 7. Почему письма через SMTP
У VDS-провайдеров порт 25 часто закрыт, а письма, отправленные с самого сервера, попадают в спам без настройки SPF/DKIM/DMARC. Отправка через SMTP вашей корпоративной почты решает обе проблемы. Обработчик `api/lead.php` уже умеет SMTP (порты 465 SSL и 587 STARTTLS). Заявки дополнительно пишутся в файл `/var/lib/aidir-leads/leads.jsonl`, поэтому не теряются, даже если письмо не дошло.

## 8. Проверка
1. Откройте `https://example.ru`: замок в адресной строке, сайт загружается, `http://` и `www` перенаправляют на основной адрес.
2. Отправьте тестовую заявку: письмо пришло, запись появилась в `leads.jsonl` (`sudo tail /var/lib/aidir-leads/leads.jsonl`).
3. Откройте `https://example.ru/несуществующая` (должна показаться страница 404), `https://example.ru/robots.txt`, `https://example.ru/sitemap.xml`.
4. Проверьте на телефоне: меню, форму, видео, документы.
5. Прогоните сайт через PageSpeed Insights, securityheaders.com и ssllabs.com.
6. Откройте в браузере консоль (F12): ошибки `Content-Security-Policy-Report-Only` покажут, что нужно разрешить; когда их не останется, замените в nginx `Content-Security-Policy-Report-Only` на `Content-Security-Policy`.
7. Проверьте, что служебное закрыто: `https://example.ru/lead_config.php`, `https://example.ru/.git/config`, `https://example.ru/api/lead.php` (GET) не должны отдавать содержимое.

## 9. После запуска
- В Яндекс.Вебмастере и Google Search Console подтвердите домен, отправьте `sitemap.xml`.
- Подключите Яндекс.Метрику в `loadAnalytics()` (только после согласия на cookies) и укажите её в политике cookies.
- Отключите GitHub Pages для репозитория, чтобы не было дубля сайта (или сделайте редирект на новый домен).
- Замените в юридических документах все пометки `[ВСТАВИТЬ: …]` на реальные данные, особенно номер в реестре операторов ПДн и сведения о хосте в РФ (hsvds.ru: дата-центр в Москве).
- Раз в месяц: `sudo apt update && sudo apt upgrade`, проверка `sudo certbot renew --dry-run`, свободное место `df -h`.

## 10. Обновление сайта позже
Изменили файлы, снова `python tools/build_dist.py example.ru`, залили содержимое `dist` в `/var/www/aidir` поверх старых (права из шага 4), для скриптов и стилей при необходимости обновите версию в имени файла или сбросьте кэш (Ctrl+F5).
