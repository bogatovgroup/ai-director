<?php
// Привратник закрытой страницы розыгрыша.
// Без действующего сеанса админа любой адрес под защищённым префиксом отдаёт 404 (как обычная 404 сайта).
// Секреты (логин, bcrypt-хэш, список префиксов) лежат ВНЕ репозитория: /var/lib/aidir-private/randomizer.php
// Режим входа включает только Caddy (fastcgi env RZ_MODE=login), клиент подменить его не может.
declare(strict_types=1);

const PRIVATE_DIR = '/var/lib/aidir-private';
const CONF_FILE   = PRIVATE_DIR . '/randomizer.php';
const SESS_DIR    = PRIVATE_DIR . '/sessions';
const RATE_DIR    = PRIVATE_DIR . '/ratelimit';
const COOKIE      = 'rzs';
const IDLE_SEC    = 3 * 3600;   // бездействие 3 часа закрывает сеанс
const MAX_FAILS   = 5;          // неверных попыток
const LOCK_SEC    = 15 * 60;    // блокировка по IP на 15 минут

$docroot = dirname(__DIR__);                 // /var/www/ai-dir.ru
const FILES_SUBDIR = '/_rz';                 // сами файлы страницы (напрямую Caddy их не отдаёт)

function common_headers(): void {
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
}

function not_found(): never {
    global $docroot;
    http_response_code(404);
    common_headers();
    header('Content-Type: text/html; charset=utf-8');
    $f = $docroot . '/404.html';
    if (is_file($f)) { readfile($f); }
    exit;
}

function client_ip(array $cfg): string {
    $h = $cfg['ip_header'] ?? '';                       // например HTTP_CF_CONNECTING_IP, только если сайт за Cloudflare
    $ip = ($h !== '' && !empty($_SERVER[$h])) ? (string)$_SERVER[$h] : (string)($_SERVER['REMOTE_ADDR'] ?? '');
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

function same_origin(): bool {   // для POST: Origin (если есть) должен совпадать с хостом
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o === '') { return ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin') !== 'cross-site'; }
    $h = parse_url($o, PHP_URL_HOST);
    return is_string($h) && hash_equals(strtolower((string)($_SERVER['HTTP_HOST'] ?? '')), strtolower($h . (($p = parse_url($o, PHP_URL_PORT)) ? ':' . $p : '')));
}

function sess_path(string $token): string { return SESS_DIR . '/' . hash('sha256', $token); }

function session_token(): ?string {
    $t = $_COOKIE[COOKIE] ?? '';
    return (is_string($t) && preg_match('/^[a-f0-9]{64}$/', $t)) ? $t : null;
}

function session_valid(): bool {
    $t = session_token();
    if ($t === null) { return false; }
    $p = sess_path($t);
    $m = @filemtime($p);
    if ($m === false) { return false; }
    if (time() - $m > IDLE_SEC) { @unlink($p); return false; }
    @touch($p);                                         // активность продлевает сеанс
    return true;
}

function session_start_new(): void {
    $t = bin2hex(random_bytes(32));                     // 256 бит
    file_put_contents(sess_path($t), '1', LOCK_EX);
    setcookie(COOKIE, $t, ['expires' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
}

function session_destroy_now(): void {
    $t = session_token();
    if ($t !== null) { @unlink(sess_path($t)); }
    setcookie(COOKIE, '', ['expires' => 1, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
}

function gc(): void {
    foreach ((array)glob(SESS_DIR . '/*') as $f) { if (is_file($f) && time() - (int)@filemtime($f) > IDLE_SEC) { @unlink($f); } }
    foreach ((array)glob(RATE_DIR . '/*') as $f) { if (is_file($f) && time() - (int)@filemtime($f) > 86400) { @unlink($f); } }
}

// ---------- конфигурация (fail closed) ----------
$cfg = is_file(CONF_FILE) ? (require CONF_FILE) : null;
if (!is_array($cfg) || empty($cfg['hash']) || empty($cfg['user']) || empty($cfg['prefixes']) || !is_dir(SESS_DIR) || !is_dir(RATE_DIR)) { not_found(); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);

// ---------- вход (адрес секретный, задан в Caddy) ----------
if (($_SERVER['RZ_MODE'] ?? '') === 'login') {
    common_headers();
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    $landing = (string)($cfg['landing'] ?? ($cfg['prefixes'][0] . '/'));
    if ($method === 'GET' || $method === 'HEAD') {
        if (session_valid()) { header('Location: ' . $landing, true, 303); exit; }
        $msg = '';
    } elseif ($method === 'POST') {
        if (!same_origin()) { not_found(); }
        gc();
        $ip = client_ip($cfg);
        $rf = RATE_DIR . '/' . hash('sha256', $ip);
        $fh = fopen($rf, 'c+'); flock($fh, LOCK_EX);
        $st = json_decode((string)stream_get_contents($fh), true) ?: ['fails' => 0, 'until' => 0];
        $now = time(); $msg = '';
        if ($st['until'] > $now) {
            $msg = 'Слишком много попыток. Повторите через ' . (int)ceil(($st['until'] - $now) / 60) . ' мин.';
        } else {
            $u = (string)($_POST['u'] ?? ''); $p = (string)($_POST['p'] ?? '');
            $okUser = hash_equals((string)$cfg['user'], $u);
            $okPass = password_verify($p, $okUser ? (string)$cfg['hash'] : '$2y$12$lzlyPA.HVsdXSYVBIaYSue3YxzrVNX2jYE28gM/LrbfzzkpiIuZk2');  // постоянное время
            if ($okUser && $okPass) {
                $st = ['fails' => 0, 'until' => 0];
                session_start_new();
                ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($st)); flock($fh, LOCK_UN); fclose($fh);
                header('Location: ' . $landing, true, 303); exit;
            }
            $st['fails'] = (int)$st['fails'] + 1;
            if ($st['fails'] >= MAX_FAILS) { $st = ['fails' => 0, 'until' => $now + LOCK_SEC]; $msg = 'Слишком много попыток. Повторите через 15 мин.'; }
            else { $msg = 'Неверный логин или пароль.'; }
        }
        ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($st)); flock($fh, LOCK_UN); fclose($fh);
    } else { http_response_code(405); exit; }
    header('Content-Type: text/html; charset=utf-8');
    $e = htmlspecialchars($msg, ENT_QUOTES);
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Вход</title>'
       . '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050008;color:#fff;font:16px system-ui,sans-serif}'
       . 'form{display:flex;flex-direction:column;gap:12px;width:min(320px,86vw)}input{padding:12px;border-radius:10px;border:1px solid rgba(167,139,250,.3);background:rgba(167,139,250,.06);color:#fff;font:inherit}'
       . 'button{padding:12px;border:0;border-radius:10px;color:#fff;font:600 16px system-ui;background:linear-gradient(135deg,#a78bfa,#7c3aed);cursor:pointer}.e{color:#ff6b8a;min-height:20px;font-size:14px}</style></head><body>'
       . '<form method="post" autocomplete="off"><input name="u" placeholder="Логин" required autofocus><input name="p" type="password" placeholder="Пароль" required>'
       . '<div class="e">' . $e . '</div><button type="submit">Войти</button></form></body></html>';
    exit;
}

// ---------- защищённые адреса ----------
$prefix = null;
foreach ($cfg['prefixes'] as $pf) {
    $pf = rtrim((string)$pf, '/');
    if ($path === $pf || str_starts_with($path, $pf . '/')) { $prefix = $pf; break; }
}
if ($prefix === null || !session_valid()) { not_found(); }

$rest = substr($path, strlen($prefix));            // '', '/', '/js/state.js', '/__logout'
if ($rest === '/__logout') {
    if ($method !== 'POST' || !same_origin()) { not_found(); }
    session_destroy_now();
    common_headers();
    http_response_code(204);
    exit;
}
if ($method !== 'GET' && $method !== 'HEAD') { not_found(); }
if ($rest === '') { header('Location: ' . $prefix . '/', true, 301); common_headers(); exit; }
$rel = rawurldecode($rest);
if ($rel === '/' ) { $rel = '/index.html'; }
if (str_contains($rel, "\0") || str_contains($rel, '\\') || str_contains($rel, '..') || preg_match('#/\.#', $rel)) { not_found(); }
$full = realpath($docroot . FILES_SUBDIR . $rel);
$base = realpath($docroot . FILES_SUBDIR);
if ($full === false || $base === false || !str_starts_with($full, $base . DIRECTORY_SEPARATOR) || !is_file($full)) { not_found(); }
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8',
          'woff2' => 'font/woff2', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'ico' => 'image/x-icon'];
$ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
if (!isset($types[$ext])) { not_found(); }
common_headers();
header('Content-Type: ' . $types[$ext]);
header('Content-Length: ' . filesize($full));
if ($method === 'GET') { readfile($full); }
