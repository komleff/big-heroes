#!/usr/bin/env bash
# strip_code_spans.sh — предобработка тела review-pass для validate_review_pass_body.
#
# Зачем: validator Шаг 5 в SKILL.md использует `grep -qE` по `CHANGES_REQUESTED`
# и `APPROVED` с word-boundary regex. Бэктики попадают в non-[A-Z_] boundary,
# и narrative-текст с цитатой `CHANGES_REQUESTED` внутри code span ложно
# блокирует hard gate (infrastructure false positive v3.4 #14).
#
# Что делаем: заменяем содержимое code spans (inline `...` и fenced ```...```)
# на пустоту ДО того, как validator grep'ает слова. Реальные вердикты в
# plain text остаются, narrative-цитаты из code spans — нет.
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
# 2) Strip fenced blocks: awk-toggle включается на строке, НАЧИНАЮЩЕЙСЯ с
#    тройного бэктика (с опциональным language hint), выключается на
#    следующей такой строке. Внутри — всё вырезается.
# 3) Strip inline code spans: в каждой строке, которая НЕ внутри fenced
#    блока (после шага 2 таких не осталось), проходим посимвольно и
#    удаляем содержимое между парными одиночными бэктиками.
#    Непарный backtick оставляет хвост строки как есть (best-effort).
tr -d '\r' | awk '
  # Fenced block toggle. Маркер — строка вида ```... (три бэктика в начале, затем что угодно до EOL).
  /^```/ {
    if (in_fence) {
      in_fence = 0
      next  # закрывающий маркер — не печатаем
    } else {
      in_fence = 1
      next  # открывающий маркер — не печатаем
    }
  }
  {
    if (in_fence) {
      next  # строка внутри fenced — вырезаем целиком
    }
    # Strip inline code spans на текущей строке.
    # Проход посимвольно: toggle at `, не-code символы копируем.
    line = $0
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
  }
'
