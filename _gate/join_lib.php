<?php
// Общий код для публичной ссылки /join и админской части. Данные лежат вне веб-корня.
declare(strict_types=1);

const JOIN_DIR  = '/var/lib/aidir-private/join';
const JOIN_FILE = JOIN_DIR . '/state.json';
const JOIN_MAX  = 60;
const JOIN_TTL  = 30 * 86400;   // данные без обращений 30 дней удаляются автоматически

function join_available(): bool { return is_dir(JOIN_DIR) && is_writable(JOIN_DIR); }

// Транзакция над списком под блокировкой. $fn(array &$st): mixed
function join_tx(callable $fn) {
    $fh = fopen(JOIN_FILE, 'c+'); flock($fh, LOCK_EX);
    $st = json_decode((string)stream_get_contents($fh), true);
    if (!is_array($st) || !isset($st['people']) || time() - (int)($st['touched'] ?? 0) > JOIN_TTL) {
        $st = ['open' => true, 'people' => [], 'touched' => time()];
    }
    $res = $fn($st);
    $st['touched'] = time();
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($st, JSON_UNESCAPED_UNICODE)); fflush($fh);
    flock($fh, LOCK_UN); fclose($fh);
    return $res;
}

// Запрос должен идти с нашего же сайта. Origin при Referrer-Policy: no-referrer бывает "null", поэтому опираемся на Sec-Fetch-Site.
function same_origin(): bool {
    $sfs = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($sfs !== '') { return $sfs === 'same-origin' || $sfs === 'none'; }
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o === '') { return true; }
    $h = parse_url($o, PHP_URL_HOST);
    return is_string($h) && hash_equals(strtolower((string)($_SERVER['HTTP_HOST'] ?? '')), strtolower($h . (($p = parse_url($o, PHP_URL_PORT)) ? ':' . $p : '')));
}
