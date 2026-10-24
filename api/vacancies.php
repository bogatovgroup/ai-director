<?php
// Прокси вакансий HeadHunter для сайта. Токен хранится только на сервере:
//  - переменная окружения HH_TOKEN, либо
//  - файл ../../hh_config.php (вне папки сайта) вида: <?php return ['token' => '...'];
// Ответ кэшируется на 15 минут, чтобы не упираться в лимиты HeadHunter.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$cfg = [
    'text'     => 'директор по внедрению ИИ OR "chief AI officer" OR CAIO OR "директор по ИИ"',
    'area'     => 113,      // 113 = Россия; 1 = Москва
    'per_page' => 50,       // берём с запасом: часть вакансий отсеется фильтром по зарплате
    'min_salary' => 150000, // зарплата от, руб. в месяц
    'max_items' => 20,
    'cache_ttl' => 900,
    'user_agent' => 'AI-DIR-CAIO/1.0 (info@ai-corp.by)',
];

$token = getenv('HH_TOKEN');
if (!$token) {
    $file = __DIR__ . '/../../hh_config.php';
    if (is_file($file)) { $c = include $file; $token = $c['token'] ?? ''; }
}

$cacheFile = sys_get_temp_dir() . '/aidir_hh_vacancies.json';
if (is_file($cacheFile) && time() - filemtime($cacheFile) < $cfg['cache_ttl']) {
    readfile($cacheFile);
    exit;
}

function out_stale($cacheFile) {
    if (is_file($cacheFile)) { readfile($cacheFile); } else { echo '{"items":[]}'; }
    exit;
}

if (!$token) out_stale($cacheFile);

$qs = http_build_query([
    'text' => $cfg['text'], 'area' => $cfg['area'], 'per_page' => $cfg['per_page'],
    'order_by' => 'publication_time', 'period' => 30,
    'salary' => $cfg['min_salary'], 'currency' => 'RUR', 'only_with_salary' => 'true',
]);
$ch = curl_init('https://api.hh.ru/vacancies?' . $qs);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
        'HH-User-Agent: ' . $cfg['user_agent'],
        'Accept: application/json',
    ],
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200 || !$body) out_stale($cacheFile);
$data = json_decode($body, true);
if (!isset($data['items'])) out_stale($cacheFile);

$items = [];
foreach ($data['items'] as $v) {
    if (empty($v['alternate_url'])) continue;
    // только вакансии с видимой зарплатой в рублях от min_salary (по нижней границе, а если её нет - по верхней)
    $sal = $v['salary'] ?? null;
    if (!$sal || !in_array($sal['currency'] ?? '', ['RUR', 'RUB'], true)) continue;
    $base = $sal['from'] ?? ($sal['to'] ?? 0);
    if ($base < $cfg['min_salary']) continue;
    if (count($items) >= $cfg['max_items']) break;
    $items[] = [
        'id'        => $v['id'] ?? null,
        'name'      => $v['name'] ?? '',
        'employer'  => $v['employer']['name'] ?? '',
        'area'      => $v['area']['name'] ?? '',
        'salary'    => $v['salary'] ?? null,
        'url'       => $v['alternate_url'],   // ссылка на конкретную вакансию на hh.ru
        'published' => $v['published_at'] ?? null,
    ];
}
$json = json_encode(['items' => $items, 'updated' => date('c')], JSON_UNESCAPED_UNICODE);
file_put_contents($cacheFile, $json);
echo $json;
