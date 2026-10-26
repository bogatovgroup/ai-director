<?php
// Прокси вакансий HeadHunter для сайта. Токен хранится только на сервере:
//  - переменная окружения HH_TOKEN, либо
//  - файл ../../hh_config.php (вне папки сайта) вида: <?php return ['token' => '...'];
// Ответ кэшируется на 15 минут, чтобы не упираться в лимиты HeadHunter.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$cfg = [
    'text'       => 'директор по внедрению ИИ OR "chief AI officer" OR CAIO OR "директор по ИИ"',
    'area'       => 113,       // 113 = Россия; 1 = Москва
    'per_page'   => 100,       // максимум у HeadHunter; берём с запасом, часть отсеется фильтрами
    'min_salary' => 150000,    // зарплата от, руб. в месяц, только с видимой зарплатой
    'max_items'  => 20,        // сколько карточек отдаём на сайт
    // "Крупная компания": HeadHunter не отдаёт размер компании, поэтому используем признаки:
    //  - число открытых вакансий у работодателя не меньше этого порога, либо
    //  - работодатель есть в белом списке employer_ids (id компании на hh.ru, можно добавить вручную)
    'min_employer_open_vacancies' => 50,
    'employer_ids' => [],      // например [1740, 3529]; такие компании считаются крупными всегда
    'cache_ttl'  => 900,
    'employer_cache_ttl' => 604800, // карточку работодателя кэшируем на неделю
    'user_agent' => 'AI-DIR-CAIO/1.0 (info@aiskolkovo.ru)',
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

function hh_get($url, $token, $ua) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'HH-User-Agent: ' . $ua,
            'Accept: application/json',
        ],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, $body];
}

// Число открытых вакансий работодателя (с кэшем), как признак крупной компании
function employer_open_vacancies($id, $token, $cfg) {
    $f = sys_get_temp_dir() . '/aidir_hh_emp_' . (int)$id . '.json';
    if (is_file($f) && time() - filemtime($f) < $cfg['employer_cache_ttl']) {
        $d = json_decode(file_get_contents($f), true);
        return (int)($d['open_vacancies'] ?? 0);
    }
    list($code, $body) = hh_get('https://api.hh.ru/employers/' . (int)$id, $token, $cfg['user_agent']);
    if ($code !== 200 || !$body) return -1; // неизвестно
    $d = json_decode($body, true);
    $n = (int)($d['open_vacancies'] ?? 0);
    file_put_contents($f, json_encode(['open_vacancies' => $n]));
    return $n;
}

if (!$token) out_stale($cacheFile);

$qs = http_build_query([
    'text' => $cfg['text'], 'area' => $cfg['area'], 'per_page' => $cfg['per_page'],
    'order_by' => 'salary_desc', 'period' => 30,
    'salary' => $cfg['min_salary'], 'currency' => 'RUR', 'only_with_salary' => 'true',
]);
list($code, $body) = hh_get('https://api.hh.ru/vacancies?' . $qs, $token, $cfg['user_agent']);
if ($code !== 200 || !$body) out_stale($cacheFile);
$data = json_decode($body, true);
if (!isset($data['items'])) out_stale($cacheFile);

// 1) только с видимой зарплатой в рублях от min_salary, 2) сортировка по величине зарплаты
$cands = [];
foreach ($data['items'] as $v) {
    if (empty($v['alternate_url'])) continue;
    $sal = $v['salary'] ?? null;
    if (!$sal || !in_array($sal['currency'] ?? '', ['RUR', 'RUB'], true)) continue;
    $base = $sal['from'] ?? ($sal['to'] ?? 0);
    if ($base < $cfg['min_salary']) continue;
    $v['_key'] = max((int)($sal['from'] ?? 0), (int)($sal['to'] ?? 0));
    $cands[] = $v;
}
usort($cands, function ($a, $b) { return $b['_key'] <=> $a['_key']; });

// 3) только крупные компании
$items = [];
$checked = []; // кэш результата проверки по работодателю в рамках запроса
$calls = 0;
foreach ($cands as $v) {
    if (count($items) >= $cfg['max_items']) break;
    $eid = $v['employer']['id'] ?? null;
    if ($eid === null) continue;
    if (!isset($checked[$eid])) {
        if (in_array((int)$eid, $cfg['employer_ids'], true)) {
            $checked[$eid] = true;
        } elseif ($calls >= 40) {
            $checked[$eid] = false; // защита от лишних запросов за один заход
        } else {
            $calls++;
            $n = employer_open_vacancies($eid, $token, $cfg);
            $checked[$eid] = ($n >= $cfg['min_employer_open_vacancies']);
        }
    }
    if (!$checked[$eid]) continue;
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
