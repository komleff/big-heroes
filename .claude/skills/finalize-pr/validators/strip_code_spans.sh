#!/usr/bin/env bash
# strip_code_spans.sh — предобработка тела review-pass для validate_review_pass_body.
#
# Зачем: validator Шаг 5 в SKILL.md использует `grep -qE` по `CHANGES_REQUESTED`
# и `APPROVED` с word-boundary regex. Бэктики попадают в non-[A-Z_] boundary,
# и narrative-текст с цитатой `CHANGES_REQUESTED` внутри code span ложно
# блокирует hard gate (infrastructure false positive v3.4 #14).
#
# Что делаем: заменяем содержимое code spans (inline `...` и fenced блоки)
# на пустоту ДО того, как validator grep'ает слова. Реальные вердикты в
# plain text остаются, narrative-цитаты из code spans — нет.
#
# CommonMark coverage (Pass 2 class-coverage fix, big-heroes-nw5):
#   - fenced blocks: opener/closer — тройной бэктик ``` ИЛИ тильда ~~~;
#   - indent tolerance: 0-3 leading spaces перед маркером (CommonMark spec);
#   - fence type matching: ``` закрывается только ```, ~~~ только ~~~;
#   - mismatched marker (``` внутри ~~~ fence или наоборот) — игнорируется,
#     fence остаётся открытым до реального closer того же типа.
#
# CommonMark fence length symmetry (Pass 1 external F-2-fence, big-heroes-2iw):
#   - opener run length N ≥ 3 (3+ последовательных маркеров одного типа);
#   - closer run length M ≥ N (CommonMark: closer может быть длиннее opener);
#   - closer короче opener (M < N) НЕ закрывает fence — остаёмся внутри блока.
#   До fix: opener матчился через `^[ ]{0,3}```` (≥3), closer требовал ровно 3
#   → fence с opener ≥4 никогда не закрывался симметричным маркером, остаток
#   до EOF проглатывался, реальные вердикты после блока пропадали → ложный
#   APPROVED. GPT-5.3-Codex + Copilot independent repro. Fail-secure:
#   «неправильный» closer (M < N) НЕ закрывает fence — безопасный default,
#   хвост не попадает в validator как plain text.
#
# НЕ покрыто (deferred):
#   - blockquote-prefixed fences (`> ```) — big-heroes-wz6;
#   - indented code blocks (4+ spaces без маркера) — редкий случай в
#     review-pass, safe default: остаётся plain text, validator блокирует.
#
# Поток: читаем stdin, пишем stdout.
# Зависимости: bash, awk (POSIX). Без внешних тулов.
#
# Edge cases (покрыты тестами в test_validate_review_pass.sh):
#   - fenced с language hint (```bash, ```diff, ```ts и т.п.);
#   - CRLF — нормализуем через tr перед awk;
#   - inline backticks внутри fenced блока — fenced strip работает первым
#     и удаляет весь блок целиком, внутренние ` не ломают логику;
#   - непарный одиночный ` — best-effort, text после него проходит как есть
#     (лучше ложное блокирование чем ложный пропуск);
#   - множественные inline spans на одной строке — toggle на bench.

set -u

# 1) Нормализуем CRLF → LF. Оператор на Windows может прислать \r\n.
# 2) Strip fenced blocks: awk state-machine с типизированным fence tracking.
#    in_fence ∈ {"", "BACKTICK", "TILDE"}. Opener — строка с 0-3 leading spaces
#    и маркером ``` или ~~~. Closer — того же типа, с 0-3 indent и без другого
#    контента (только optional trailing whitespace).
# 3) Strip inline code spans: в каждой строке, которая НЕ внутри fenced
#    блока (после шага 2 таких не осталось), проходим посимвольно и
#    удаляем содержимое между парными одиночными бэктиками.
#    Непарный backtick оставляет хвост строки как есть (best-effort).
tr -d '\r' | awk '
  # Подсчёт длины run-а маркера (marker = "`" или "~") на opener-строке.
  # Возвращает длину run-а (≥3), если строка — валидный opener
  # (0-3 leading spaces + run маркеров длиной ≥3), иначе 0.
  # Вся не-whitespace часть до маркера запрещена (CommonMark).
  function fence_open_run(line, marker,   i, n, indent, run, c) {
    n = length(line)
    # Пропустить 0-3 ведущих пробела; tab запрещён как indent CommonMark.
    indent = 0
    for (i = 1; i <= n && indent < 4; i++) {
      c = substr(line, i, 1)
      if (c == " ") { indent++; continue }
      break
    }
    if (indent > 3) return 0
    # Теперь i указывает на первый не-пробельный символ.
    # Считаем run-length маркера.
    run = 0
    while (i <= n && substr(line, i, 1) == marker) { run++; i++ }
    if (run < 3) return 0
    # После run-а допускается info-string (language hint) для backtick; для
    # tilde тоже. CommonMark: info string для ``` не должна содержать `,
    # но мы проверяем только длину run-а — info пропускаем целиком.
    return run
  }

  # Проверка, является ли строка валидным closer того же типа для fence с
  # open_len маркеров. Closer: 0-3 leading spaces + marker-run длиной >= open_len +
  # только trailing whitespace (info string у closer запрещена CommonMark).
  function fence_close_matches(line, marker, open_len,   i, n, indent, run, c, j) {
    n = length(line)
    indent = 0
    for (i = 1; i <= n && indent < 4; i++) {
      c = substr(line, i, 1)
      if (c == " ") { indent++; continue }
      break
    }
    if (indent > 3) return 0
    run = 0
    while (i <= n && substr(line, i, 1) == marker) { run++; i++ }
    if (run < open_len) return 0
    # После closer-run допускается только whitespace до конца строки.
    for (j = i; j <= n; j++) {
      c = substr(line, j, 1)
      if (c != " " && c != "\t") return 0
    }
    return 1
  }

  BEGIN { in_fence = ""; fence_len = 0 }
  {
    line = $0

    if (in_fence == "") {
      # Не внутри fence — проверить, это ли opener.
      # CommonMark: 0-3 leading spaces, затем ``` / ~~~ (run length ≥3).
      open_run = fence_open_run(line, "`")
      if (open_run >= 3) {
        in_fence = "BACKTICK"
        fence_len = open_run
        next
      }
      open_run = fence_open_run(line, "~")
      if (open_run >= 3) {
        in_fence = "TILDE"
        fence_len = open_run
        next
      }
      # Strip inline code spans на текущей строке.
      # Проход посимвольно: toggle at `, не-code символы копируем.
      out = ""
      in_span = 0
      n = length(line)
      for (i = 1; i <= n; i++) {
        c = substr(line, i, 1)
        if (c == "`") {
          in_span = !in_span
          # сам бэктик не сохраняем (и open, и close)
          continue
        }
        if (!in_span) {
          out = out c
        }
        # если in_span — пропускаем символ
      }
      # Если строка закончилась с in_span=1 (непарный `), оставшийся хвост
      # УЖЕ не попал в out — это удалило бы text и могло спрятать реальный
      # CHANGES_REQUESTED. Восстанавливаем: если закрытия не было, вернём
      # хвост от последнего ` как plain text (best-effort safe default).
      if (in_span) {
        # Найдём последний бэктик и возьмём всё ПОСЛЕ него как plain text.
        last_tick = 0
        for (j = n; j >= 1; j--) {
          if (substr(line, j, 1) == "`") { last_tick = j; break }
        }
        if (last_tick > 0 && last_tick < n) {
          tail = substr(line, last_tick + 1)
          out = out tail
        }
      }
      print out
    } else {
      # Внутри fence — ищем close ТОГО ЖЕ типа и длиной >= opener.
      # Mismatched marker (~~~ внутри BACKTICK или vice versa) игнорируется,
      # closer короче opener (M < fence_len) тоже игнорируется (CommonMark F-2-fence).
      if (in_fence == "BACKTICK" && fence_close_matches(line, "`", fence_len)) {
        in_fence = ""
        fence_len = 0
        next
      }
      if (in_fence == "TILDE" && fence_close_matches(line, "~", fence_len)) {
        in_fence = ""
        fence_len = 0
        next
      }
      # Внутри fence — содержимое стрипуется (линия не выводится).
      next
    }
  }
'
