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
#     fence остаётся открытым до реального closer того же типа;
#   - backtick-fence info-string НЕ содержит ` (Pass 3 Copilot D-1):
#     CommonMark §4.5 запрещает backtick в info-string после ```-opener'а
#     (для ~~~ разрешено). Нарушение → opener НЕ открывает fence,
#     строка идёт как inline. Без проверки adversarial `` ``` `fake-info` ``
#     открывал ложный fence и проглатывал CHANGES_REQUESTED в хвосте.
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
# Pass 4 E-3 (escaped backticks): CommonMark §2.4 backslash escape — `\`` это
# literal backtick, НЕ code span delimiter. Прежний inline-scanner матчил
# любой run ` как delimiter, игнорируя backslash перед ним. Bypass:
# `\`CHANGES_REQUESTED\`` полностью стрипался как span (backslash + backtick
# трактовались как opener/closer), реальный вердикт CR в escaped form
# становился невидим. Fix: считаем run backslashes ПЕРЕД backtick-run'ом;
# нечётное число → первый backtick экранирован → не участвует в span.
# Чётное (включая 0) → backticks обычные, span-логика работает.
# Edge: `\\` (двойной backslash) — literal backslash + следующий backtick
# НЕ экранирован (чётное количество).
#
# Pass 4 E-2 (multiline inline spans): CommonMark §6.1 допускает inline span
# через newline: `` `code\nmore code` `` — opener на строке N, closer на N+1.
# Прежний scanner работал line-by-line и не видел closer за newline. Fix:
# после fence-стрипа склеиваем non-fence строки через sentinel \x01, гоняем
# inline scanner на virtual single-line, разделяем обратно. Escape handling
# (backslash перед backtick) работает как и раньше, sentinel-символ никогда
# не встречается в body (control-char, не печатается reviewer'ами).
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
#     run-length N, содержимое между ними стрипается целиком;
#   - escaped backticks `\`` — literal, не span delimiter (Pass 4 E-3);
#   - multiline inline spans `` `code\nmore` `` — open/close через newline
#     (Pass 4 E-2).

set -u

# Двухстадийный pipeline:
#
# Стадия 1 (awk fence-stripper): читает stdin, удаляет fenced blocks,
# на stdout пишет «не-fence» строки (как есть, inline ещё не обработан).
# Fail-safe для lone opener (Pass 2 G3) — буферизация с восстановлением
# pending в output при EOF без closer.
#
# Стадия 2 (awk inline-stripper): читает поток не-fence строк, склеивает
# их через sentinel \x01 в единую virtual-line, прогоняет run-length
# matcher (E-2 multiline fix), разделяет обратно на строки.
# Escape handling (E-3): считает backslash-prefix перед backtick-run,
# нечётное количество → первый backtick литерал, span не открывается.
tr -d '\r' | awk '
  # Подсчёт длины run-а маркера (marker = "`" или "~") на opener-строке.
  # Возвращает длину run-а (≥3), если строка — валидный opener
  # (0-3 leading spaces + run маркеров длиной ≥3), иначе 0.
  # Вся не-whitespace часть до маркера запрещена (CommonMark).
  #
  # D-1 (Pass 3 Copilot): для BACKTICK-маркера info-string (хвост строки
  # после run-а) НЕ должен содержать `. CommonMark §4.5: «A fenced code
  # block begins with a code fence, followed by an optional info string …
  # If the info string comes after a backtick fence, it cannot contain
  # any backtick characters». Нарушение этого правила — opener НЕ
  # открывает fence (строка трактуется как inline-текст). Для TILDE-
  # маркера такого ограничения нет. Без валидации adversarial opener
  # `` ``` `not-a-lang` `` открывает «fence», проглатывая хвост с
  # CHANGES_REQUESTED, и validator ложно видит APPROVED.
  function fence_open_run(line, marker,   i, n, indent, run, c, info) {
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
    # tilde тоже. CommonMark §4.5: backtick-fence info-string НЕ может
    # содержать `. D-1 fix: если marker="`" и в info-string есть backtick —
    # fence НЕ открывается (adversarial `` ``` `fake-info` `` bypass).
    # Для tilde-fence backticks в info допустимы — валидация не нужна.
    if (marker == "`") {
      info = substr(line, i, n - i + 1)
      if (index(info, "`") > 0) return 0
    }
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
      # Не-fence строка — печатаем как есть, inline обрабатывается в Стадии 2.
      print line
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
' | awk '
  # Стадия 2: inline code span matcher с поддержкой multiline (E-2) и
  # escape-sequences (E-3).
  #
  # CommonMark §6.1: inline code spans — inline element внутри параграфа.
  # Блок (параграф) ограничен blank-строками. Span может пересекать
  # newline ВНУТРИ параграфа, но НЕ может пересекать пустую строку
  # (paragraph boundary). E-2 fix: при встрече blank line — очистка
  # accumulator-а, paragraph обрабатывается отдельно.
  #
  # Склеиваем строки параграфа через sentinel SEP (\x01), прогоняем
  # run-length matcher на virtual-line, разделяем обратно. sentinel —
  # control-char U+0001, не появляется в markdown-body review-pass
  # комментариев (reviewers пишут printable text), безопасен как
  # разделитель.
  #
  # Алгоритм per-span (E-3 escape + F-2-inline run-length):
  #   1. Найти backtick-run длины N.
  #   2. Посчитать backslash-run ПЕРЕД ним. Нечётное число backslash-symbols →
  #      первый backtick экранирован; откусываем один backtick как literal
  #      (append в out), остаток run-а длиной N-1 продолжает span-поиск
  #      (если N-1 ≥ 1; иначе ничего не открывается).
  #   3. Если effective run-length N ≥ 1 — ищем closer того же run-length N.
  #   4. В closer тоже учитываем escape: если backslash-run перед backtick-run
  #      нечётный, первый из closer-run экранирован → effective run короче
  #      на 1 и начинается на символ вперёд. Если eff_run == N → closer
  #      валиден; иначе ищем следующий.
  #
  # Sentinel внутри inline span (multi-line code) — стрипается вместе с
  # content; outside span — восстанавливается как реальный newline при
  # восстановлении lone-opener tail.
  function process_paragraph(buf,    n, out, i, c, bs, k, N, start,
                                     found_close_start, close_end, j,
                                     bs2, jj, M, rj, eff_j, eff_M, tail) {
    # Run-length matcher с escape-handling (E-3) и multi-line within paragraph (E-2).
    n = length(buf)
    out = ""
    i = 1
    while (i <= n) {
      c = substr(buf, i, 1)
      if (c != "`") {
        out = out c
        i++
        continue
      }
      # Нашли backtick-run. Считаем backslash-run перед ним (escape check, E-3).
      bs = 0
      k = i - 1
      while (k >= 1 && substr(buf, k, 1) == "\\") { bs++; k-- }
      N = 0
      start = i
      while (i <= n && substr(buf, i, 1) == "`") { N++; i++ }
      # Если нечётное число backslash перед — первый backtick экранирован.
      if ((bs % 2) == 1) {
        # Literal backtick (escaped): добавить в out один `.
        out = out "`"
        N--
        start++
      }
      if (N == 0) {
        # Полностью escaped (run был длины 1, после decrement 0). Продолжаем.
        continue
      }
      # Ищем closer — run ровно длины N, начиная с позиции i (после opener-run).
      found_close_start = 0
      close_end = 0
      j = i
      while (j <= n) {
        if (substr(buf, j, 1) != "`") { j++; continue }
        # Считаем backslash-run перед j (но не заходим внутрь opener-run).
        bs2 = 0
        jj = j - 1
        while (jj >= start + N && substr(buf, jj, 1) == "\\") { bs2++; jj-- }
        M = 0
        rj = j
        while (rj <= n && substr(buf, rj, 1) == "`") { M++; rj++ }
        eff_j = j
        eff_M = M
        if ((bs2 % 2) == 1) {
          # Первый backtick closer-run-а экранирован — не считается частью closer.
          eff_j = j + 1
          eff_M = M - 1
        }
        if (eff_M == N) {
          found_close_start = eff_j
          close_end = rj - 1
          break
        }
        j = rj
      }
      if (found_close_start > 0) {
        # Валидный span — ни opener, ни content, ни closer не сохраняем.
        # Content может содержать SEP (multiline span в одном paragraph, E-2).
        i = close_end + 1
      } else {
        # Closer не нашёлся — восстановим opener + остаток buf как plain.
        # Safe default: лучше ложно показать хвост и дать validator-grep
        # блокировать, чем съесть реальный CHANGES_REQUESTED.
        tail = substr(buf, start, n - start + 1)
        gsub(SEP, "\n", tail)
        out = out tail
        i = n + 1
      }
    }
    # Восстанавливаем newline-разделители из SEP вне span-ов.
    gsub(SEP, "\n", out)
    return out
  }

  BEGIN {
    SEP = sprintf("%c", 1)   # \x01 — control char, не появляется в body
    para = ""
    para_has_content = 0
  }
  {
    # Blank line — paragraph boundary. CommonMark §6.1: inline span НЕ
    # пересекает paragraph boundary (blank line). Обрабатываем накопленный
    # paragraph, печатаем результат, печатаем blank line отдельно, сбрасываем.
    if ($0 == "") {
      if (para_has_content) {
        print process_paragraph(para)
      }
      print ""
      para = ""
      para_has_content = 0
      next
    }
    # Накапливаем строки одного paragraph через SEP.
    if (para_has_content) {
      para = para SEP $0
    } else {
      para = $0
      para_has_content = 1
    }
  }
  END {
    # Финальный paragraph (если есть).
    if (para_has_content) {
      print process_paragraph(para)
    }
  }
'
