<?php
// Публичная запись участников розыгрыша: POST /join-api (JSON), GET /join-api (открыт ли набор).
// Хранение: /var/lib/aidir-private/join/state.json (вне веб-корня). Данные автоматически удаляются через 30 дней без обращений.
declare(strict_types=1);

require_once __DIR__ . '/join_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');

function out(int $code, array $data): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

if (!join_available()) { out(503, ['error' => 'Сервис временно недоступен']); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $st = join_tx(function (array &$st) { return ['open' => (bool)$st['open'], 'full' => count($st['people']) >= JOIN_MAX, 'count' => count($st['people']),
        'live' => (isset($st['live']) && is_array($st['live']) && time() - (int)($st['live']['at'] ?? 0) < 900) ? $st['live'] : ['phase' => 'idle'],
        'people' => array_map(fn($p) => ['n' => $p['n'], 'name' => $p['name'], 'nick' => $p['nick']], $st['people'])]; });
    out(200, $st);
}
if ($method !== 'POST') { out(405, ['error' => 'Метод не поддерживается']); }
if (!same_origin()) { out(403, ['error' => 'Запрос отклонён']); }

$raw = (string)file_get_contents('php://input');
if (strlen($raw) > 4096) { out(413, ['error' => 'Слишком большой запрос']); }
$in = json_decode($raw, true);
if (!is_array($in)) { out(400, ['error' => 'Некорректный запрос']); }

// ловушка для ботов: невидимое поле должно быть пустым
if (!empty($in['website'])) { out(200, ['ok' => true]); }

if (($in['consent'] ?? false) !== true) { out(422, ['error' => 'Нужно согласие на обработку персональных данных']); }

$name = trim((string)preg_replace('/\s+/u', ' ', (string)($in['name'] ?? '')));
$nick = ltrim(trim((string)($in['nick'] ?? '')), '@');
if ($name === '') { out(422, ['error' => 'Введите имя']); }
if (mb_strlen($name) > 30 || !preg_match('/^[\p{L}\p{M}\s\'.\-]+$/u', $name)) { out(422, ['error' => 'Имя: только буквы, до 30 символов']); }
if ($nick === '') { out(422, ['error' => 'Введите ник Telegram']); }
if (!preg_match('/^[A-Za-z0-9_]{5,32}$/', $nick)) { out(422, ['error' => 'Ник: латиница, цифры, _ ; 5–32 символа']); }

$res = join_tx(function (array &$st) use ($name, $nick) {
    if (!$st['open']) { return ['code' => 409, 'error' => 'Набор участников закрыт']; }
    if (count($st['people']) >= JOIN_MAX) { return ['code' => 409, 'error' => 'Достигнут лимит участников: ' . JOIN_MAX]; }
    foreach ($st['people'] as $p) {
        if (strtolower(ltrim((string)$p['nick'], '@')) === strtolower($nick)) { return ['code' => 409, 'error' => 'Такой участник уже есть в списке']; }
    }
    $n = count($st['people']) + 1;
    $st['people'][] = ['n' => $n, 'name' => $name, 'nick' => '@' . $nick, 'at' => time() * 1000, 'consent_at' => time()];
    return ['code' => 200, 'ok' => true, 'n' => $n];
});
$code = (int)$res['code']; unset($res['code']);
out($code, $res);
