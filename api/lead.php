<?php
// Приём заявок с сайта: проверка, защита от спама, запись в журнал, письмо на почту и (по желанию) передача в Битрикс24.
// Секреты хранятся ТОЛЬКО на сервере, вне папки сайта: файл lead_config.php (на уровень выше корня сайта) или переменные окружения.
// Пример lead_config.php:
//   <?php return [
//     'mail_to'        => 'info@aiskolkovo.ru',
//     'mail_from'      => 'no-reply@ВАШ-ДОМЕН.ru',
//     'bitrix_webhook' => 'https://ВАШ.bitrix24.ru/rest/1/КОД/crm.lead.add.json', // права вебхука: только crm.lead.add
//     'log_dir'        => '/home/user/leads',   // вне папки сайта, права 700
//     'allowed_hosts'  => ['ВАШ-ДОМЕН.ru', 'www.ВАШ-ДОМЕН.ru'],
//   ];

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    out(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// ---- Настройки ----
$cfg = [
    'mail_to' => getenv('LEAD_MAIL_TO') ?: 'info@aiskolkovo.ru',
    'mail_from' => getenv('LEAD_MAIL_FROM') ?: '',
    'bitrix_webhook' => getenv('LEAD_BITRIX_WEBHOOK') ?: '',
    'log_dir' => getenv('LEAD_LOG_DIR') ?: '',
    'allowed_hosts' => [],
];
$file = __DIR__ . '/../../lead_config.php';
if (is_file($file)) {
    $c = include $file;
    if (is_array($c)) { $cfg = array_merge($cfg, $c); }
}

// ---- Проверка источника запроса (простая защита от чужих форм) ----
$host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
$allowed = $cfg['allowed_hosts'] ?: [$host];
foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
    if (!empty($_SERVER[$h])) {
        $oh = strtolower((string)parse_url((string)$_SERVER[$h], PHP_URL_HOST));
        if ($oh !== '' && !in_array($oh, array_map('strtolower', $allowed), true)) {
            out(403, ['ok' => false, 'error' => 'bad_origin']);
        }
    }
}

// ---- Ограничение частоты: не больше 5 заявок в час с одного адреса ----
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$logDir = $cfg['log_dir'] ?: sys_get_temp_dir() . '/aidir_leads';
if (!is_dir($logDir)) { @mkdir($logDir, 0700, true); }
$rateFile = $logDir . '/rate_' . md5($ip) . '.json';
$now = time();
$hits = [];
if (is_file($rateFile)) {
    $hits = json_decode((string)file_get_contents($rateFile), true) ?: [];
    $hits = array_values(array_filter($hits, fn($t) => $t > $now - 3600));
}
if (count($hits) >= 5) { out(429, ['ok' => false, 'error' => 'rate_limited']); }

// ---- Данные ----
function field(string $k, int $max): string {
    $v = isset($_POST[$k]) && is_string($_POST[$k]) ? trim($_POST[$k]) : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
}

// Ловушка для ботов: поле скрыто от людей. Если заполнено, делаем вид, что всё хорошо, но ничего не отправляем.
if (field('website', 200) !== '') { out(200, ['ok' => true]); }

$name = field('name', 100);
$email = field('email', 150);
$contact = field('contact', 120);
$format = field('format', 60);
$who = field('who', 20);
$company = field('company', 150);
$comment = field('comment', 2000);
$consentVersion = field('consent_version', 100);
$page = field('page', 300);
$pd = !empty($_POST['pd']);
$mailing = !empty($_POST['mailing']);

$formats = ['Онлайн', 'Комбинированный', 'Офлайн в Москве'];
$errors = [];
if (mb_strlen($name) < 2) { $errors[] = 'name'; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'email'; }
if (mb_strlen($contact) < 3) { $errors[] = 'contact'; }
if (!in_array($format, $formats, true)) { $errors[] = 'format'; }
if (!in_array($who, ['себя', 'компанию'], true)) { $errors[] = 'who'; }
if ($who === 'компанию' && $company === '') { $errors[] = 'company'; }
if (!$pd) { $errors[] = 'consent'; }
if ($errors) { out(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]); }

$utm = [];
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $k) {
    $v = field($k, 100); if ($v !== '') { $utm[$k] = $v; }
}

$lead = [
    'time' => date('c'),
    'ip' => $ip,
    'ua' => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250),
    'name' => $name, 'email' => $email, 'contact' => $contact, 'format' => $format,
    'who' => $who, 'company' => $company, 'comment' => $comment,
    'consent_pd' => true, 'consent_version' => $consentVersion, 'consent_mailing' => $mailing,
    'page' => $page, 'utm' => $utm,
];

// ---- 1) Журнал (JSON Lines). Главное хранилище: заявка не должна потеряться ----
$hits[] = $now;
@file_put_contents($rateFile, json_encode($hits), LOCK_EX);
$saved = @file_put_contents($logDir . '/leads.jsonl', json_encode($lead, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false;

// ---- 2) Письмо на почту ----
$mailed = false;
if ($cfg['mail_to'] !== '') {
    $body = "Новая заявка с сайта\n\n"
        . "Имя: $name\nEmail: $email\nКонтакт: $contact\nФормат: $format\n"
        . "Заявка для: $who" . ($company !== '' ? " ($company)" : '') . "\n"
        . "Комментарий: " . ($comment !== '' ? $comment : '-') . "\n\n"
        . "Согласие на обработку ПДн: да ($consentVersion), " . date('c') . "\n"
        . "Согласие на рассылки: " . ($mailing ? 'да' : 'нет') . "\n"
        . "Страница: $page\nIP: $ip\n"
        . ($utm ? 'UTM: ' . json_encode($utm, JSON_UNESCAPED_UNICODE) . "\n" : '');
    $from = $cfg['mail_from'] !== '' ? $cfg['mail_from'] : 'no-reply@' . preg_replace('/^www\./', '', $host ?: 'localhost');
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $from,
        'Reply-To: ' . str_replace(["\r", "\n"], '', $email),
    ];
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . $format) . '?=';
    $mailed = @mail($cfg['mail_to'], $subject, $body, implode("\r\n", $headers));
}

// ---- 3) Битрикс24 (необязательно). Сбой CRM не должен ломать приём заявки ----
if ($cfg['bitrix_webhook'] !== '' && function_exists('curl_init')) {
    $fields = [
        'TITLE' => 'Заявка с сайта: ' . $format,
        'NAME' => $name,
        'EMAIL' => [['VALUE' => $email, 'VALUE_TYPE' => 'WORK']],
        'COMMENTS' => "Контакт: $contact\nЗаявка для: $who" . ($company !== '' ? " ($company)" : '')
            . "\nКомментарий: $comment\nСогласие на ПДн: $consentVersion\nРассылки: " . ($mailing ? 'да' : 'нет') . "\nСтраница: $page",
        'SOURCE_ID' => 'WEB',
    ];
    foreach ($utm as $k => $v) { $fields[strtoupper($k)] = $v; }
    $ch = curl_init($cfg['bitrix_webhook']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['fields' => $fields], JSON_UNESCAPED_UNICODE),
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// Если не удалось ни записать, ни отправить письмо: сообщаем, чтобы страница предложила запасной вариант
if (!$saved && !$mailed) { out(500, ['ok' => false, 'error' => 'storage_failed']); }
out(200, ['ok' => true]);
