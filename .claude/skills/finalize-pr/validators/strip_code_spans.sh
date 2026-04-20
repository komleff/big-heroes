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
#   - непарный run backticks — best-effort: весь run + хвост строки идут в out
#     как plain text (safe default: не прячем потенциальный CHANGES_REQUESTED);
#   - множественные inline spans на одной строке — run-length matcher;
#   - N-backtick inline spans (``content``, ```content``` и т.п., CommonMark
#     F-2-inline, Pass 1 external dolt-cet): opener/closer одинаковой
#     run-length N, содержимое между ними стрипается целиком.

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

  BEGIN { in_fence = ""; fence_len = 0; pending_count = 0 }
  {
    line = $0

    if (in_fence == "") {
      # Не внутри fence — проверить, это ли opener.
      # CommonMark: 0-3 leading spaces, затем ``` / ~~~ (run length ≥3).
      open_run = fence_open_run(line, "`")
      if (open_run >= 3) {
        in_fence = "BACKTICK"
        fence_len = open_run
        # Fail-safe для lone opener (Pass 2 G3, dolt-xn3):
        # буферизуем opener + все последующие строки до closer. Если closer
        # не найден до EOF (lone opener / fence-injection), END-блок сбросит
        # буфер обратно в output как plain text — validator увидит реальный
        # CHANGES_REQUESTED в хвосте, и hard gate не пропустит ложный APPROVED.
        # Прежний код делал `next` без буферизации, что стирало всё после
        # opener молча.
        pending_count = 1
        pending_lines[pending_count] = line
        next
      }
      open_run = fence_open_run(line, "~")
      if (open_run >= 3) {
        in_fence = "TILDE"
        fence_len = open_run
        pending_count = 1
        pending_lines[pending_count] = line
        next
      }
      # Strip inline code spans на текущей строке — run-length matcher (F-2-inline).
      # CommonMark: inline code span — opener N backticks, closer строго того же
      # run-length N. Между ними — любой текст (включая backticks ≠ N).
      # Прежний posimvolniy toggle ломал N-backtick spans (``CONTENT`` и т.п.):
      # flip-flip давало пустой span, content оставался plain.
      #
      # Алгоритм:
      #   i проходит по строке слева направо.
      #   При встрече run-а backticks длиной N ищем справа следующий run
      #   ровно той же длины N. Если найден — содержимое (вкл. non-N backticks
      #   внутри) стрипаем, сам opener+closer не сохраняем, i перепрыгивает
      #   после closer-run. Если не найден — текущий run + остаток строки
      #   идут в out как plain text (best-effort safe default: не скрывать
      #   CHANGES_REQUESTED потенциально лежащий в хвосте).
      out = ""
      n = length(line)
      i = 1
      while (i <= n) {
        c = substr(line, i, 1)
        if (c != "`") {
          out = out c
          i++
          continue
        }
        # Нашли начало run-а. Считаем его длину N.
        N = 0
        start = i
        while (i <= n && substr(line, i, 1) == "`") { N++; i++ }
        # Ищем closer — run ровно длины N, начиная с позиции i (после opener-run).
        found_close_start = 0
        j = i
        while (j <= n) {
          if (substr(line, j, 1) != "`") { j++; continue }
          # Считаем длину run-а на позиции j.
          M = 0
          rj = j
          while (rj <= n && substr(line, rj, 1) == "`") { M++; rj++ }
          if (M == N) {
            found_close_start = j
            close_end = rj - 1  # последний символ closer-run
            break
          }
          # Run длины M != N — не наш closer, перескочить через него.
          j = rj
        }
        if (found_close_start > 0) {
          # Валидный span — ни opener, ни content, ни closer не сохраняем.
          i = close_end + 1
        } else {
          # Closer не нашёлся — восстановим opener + остаток строки как plain.
          # Это best-effort safe default (лучше ложно показать хвост и дать
          # validator-grep блокировать, чем съесть реальный CHANGES_REQUESTED).
          out = out substr(line, start, n - start + 1)
          i = n + 1
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
        # Closer найден — pending успешно стриплен, очищаем буфер.
        pending_count = 0
        next
      }
      if (in_fence == "TILDE" && fence_close_matches(line, "~", fence_len)) {
        in_fence = ""
        fence_len = 0
        pending_count = 0
        next
      }
      # Внутри fence — содержимое добавляется в pending buffer (не печатается).
      # Если closer не найдётся до EOF, END-блок восстановит этот буфер как
      # plain text (fail-safe против lone opener).
      pending_count++
      pending_lines[pending_count] = line
      next
    }
  }
  END {
    # Fail-safe для lone opener (Pass 2 G3, dolt-xn3): если EOF достигнут
    # при in_fence != "" (opener без closer того же типа), restore pending
    # buffer в output как plain text. Это защищает validator от fence-injection,
    # когда attacker пишет ```\nInjected CHANGES_REQUESTED\n(без closer) —
    # прежний код съедал хвост до EOF, прячa реальный вердикт в plain text,
    # и validator ложно видел только APPROVED выше.
    if (in_fence != "") {
      for (k = 1; k <= pending_count; k++) {
        print pending_lines[k]
      }
    }
  }
'
