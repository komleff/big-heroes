---
name: finalize-pr
description: Hard gate перед merge. Единственный разрешённый способ объявить PR готовым к merge. Проверяет commit binding (verify, internal review, external review для Sprint Final, статусы замечаний). Используй: /finalize-pr <PR_NUMBER> [--force]
user-invocable: true
---

# Finalize PR — hard gate перед merge

`/finalize-pr <PR_NUMBER>` — **единственный разрешённый способ** объявить PR готовым к merge. Чеклист «PM обязан проверить» в v2 был soft constraint и игнорировался — `/finalize-pr` превращает его в hard gate с привязкой к commit hash.

> ⛔ Прямой комментарий «готов к merge» / «ready to merge» в PR заблокирован hook-ом из `settings.json`. Используй только этот скилл.

## Аргументы

- `PR_NUMBER` — номер PR (обязательный)
- `--force` — emergency override **только по явной команде оператора** или при подтверждённой ошибке самого скилла. PM не имеет права инициировать `--force` самостоятельно.

## Фаза 1: hard-проверки (commit + verify + review)

### Шаг 1: Зафиксировать HEAD commit hash

> Оборачивай все вызовы `gh pr view` в `timeout 10` — защита от зависания при медленном GitHub API.

```bash
HEAD_COMMIT=$(timeout 10 gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid' 2>/dev/null)

# null-guard: PR может быть закрыт/удалён/недоступен между шагами
if [ -z "$HEAD_COMMIT" ] || [ "$HEAD_COMMIT" = "null" ]; then
  echo "СТОП: не удалось получить HEAD commit PR #<PR_NUMBER>."
  echo "Возможные причины: PR закрыт/удалён, нет прав, API недоступен или таймаут."
  exit 1
fi

echo "Финализируем PR #<PR_NUMBER> на commit $HEAD_COMMIT"
```

Все дальнейшие проверки идут против **этого** commit. Если PR сменит HEAD во время выполнения скилла — придётся запускать заново.

### Шаг 2: Проверка `/verify` на текущем commit

Цель — убедиться, что build + test зелёные именно на $HEAD_COMMIT, а не на каком-то предыдущем.

```bash
# Локальный HEAD должен совпадать с PR HEAD
LOCAL_HEAD=$(git rev-parse HEAD)
if [ "$LOCAL_HEAD" != "$HEAD_COMMIT" ]; then
  echo "СТОП: локальный HEAD ($LOCAL_HEAD) не совпадает с PR HEAD ($HEAD_COMMIT)."
  echo "Выполни: gh pr checkout <PR_NUMBER>"
  exit 1
fi
```

Запусти `/verify`. Если упал — **СТОП**, скилл не публикует финальный комментарий, оператор получает ошибку.

### Шаг 3: Internal review-pass привязан к $HEAD_COMMIT?

PM публикует review-отчёты с двумя маркерами commit binding:
1. **Строка `Commit: <hash>`** в теле отчёта (под заголовком) — человекочитаемый маркер для оператора.
2. **JSON-метаданные** в HTML-комментарии (см. `PM_ROLE.md` секция 2.2): `<!-- {"reviewer": "...", "commit": "<hash>", ...} -->` — машинный маркер.

Скилл ищет **последний по времени** internal review-pass с `commit == $HEAD_COMMIT` через `jq` (сортировка по `createdAt`):

```bash
LAST_INTERNAL=$(timeout 10 gh pr view <PR_NUMBER> --json comments \
  | jq -r --arg head "$HEAD_COMMIT" '
      [ .comments[]
        | select(.body | test("review-pass|Внутреннее ревью"; "i"))
        | select(.body | test("\"commit\":\\s*\"" + $head + "\"|Commit:\\s*`?" + $head; "s"))
      ]
      | sort_by(.createdAt)
      | last
      | .body // empty
    ')

if [ -z "$LAST_INTERNAL" ]; then
  echo "СТОП: Internal review-pass отсутствует для commit $HEAD_COMMIT."
  echo "Запусти /sprint-pr-cycle для нового review-pass."
  exit 1
fi
echo "$LAST_INTERNAL" | head -30
```

> Используем `jq sort_by(.createdAt) | last` вместо `head -50`: при нескольких review-pass на одном commit (например, CHANGES_REQUESTED → APPROVED в одном цикле) берём именно последний, не первый.

Если последний review-pass на этом commit — **OK**.

### Шаг 4: External review для Sprint Final

Определи tier текущего PR. Sprint Final — это PR, который завершает спринт и готовится к merge в master. Признаки:
- Метка `sprint-final` на PR;
- В описании PR явно указано `Tier: Sprint Final`;
- PM в ходе оркестрации зафиксировал tier=`sprint-final` в Memory Bank.

Если tier == `sprint-final`:
```bash
LAST_EXTERNAL=$(timeout 10 gh pr view <PR_NUMBER> --json comments \
  | jq -r --arg head "$HEAD_COMMIT" '
      [ .comments[]
        | select(.body | test("Внешнее ревью"; "i"))
        | select(.body | test("\"commit\":\\s*\"" + $head + "\"|Commit:\\s*`?" + $head; "s"))
      ]
      | sort_by(.createdAt)
      | last
      | .body // empty
    ')

if [ -z "$LAST_EXTERNAL" ]; then
  echo "СТОП: External review обязателен для Sprint Final на commit $HEAD_COMMIT."
  echo "Запусти /external-review <PR_NUMBER>."
  exit 1
fi
```

- Если внешний review-pass на $HEAD_COMMIT есть — **OK**.
- `N/A` для Sprint Final **не допускается** — внешнее ревью обязательно.

> Используем тот же `jq sort_by(.createdAt) | last` паттерн: ищем маркер `Commit: <hash>` (человекочитаемый в теле) ИЛИ `"commit": "<hash>"` (в META JSON HTML-комментария). Оба варианта гарантированно присутствуют в шаблоне `external-review/SKILL.md` после обновления раунда фиксов Copilot.

**Hard gate на метку Degraded/Manual mode (инвариант 6 → честный audit trail):**

Если в METAданных external review-pass указан `mode: C-*` или `mode: D-*` (degraded режимы), в теле комментария **обязана** присутствовать метка:
- Для режима C: `⚠️ Degraded mode`
- Для режима D: `⚠️ Manual emergency mode`

Без метки Sprint Final ложно маркируется как cross-model review. Финализация заблокирована:

```bash
# $LAST_EXTERNAL уже содержит тело последнего external review-pass на $HEAD_COMMIT
# Матчим оба допустимых маркера режима:
#   1) человекочитаемый заголовок «Режим: C» / «Режим: D» (всегда в шаблоне external-review)
#   2) машинный маркер «Mode: C» / `"mode": "C"` в META JSON (fallback)
if echo "$LAST_EXTERNAL" | grep -qE '(Режим|Mode)[:"]*\s*"?[CD]\b'; then
  # Degraded/Manual режим — нужна метка
  if ! echo "$LAST_EXTERNAL" | grep -qE '⚠️ (Degraded mode|Manual emergency mode)'; then
    echo "СТОП: external review в режиме C/D без обязательной метки '⚠️ Degraded mode' / '⚠️ Manual emergency mode'."
    echo "PM должен опубликовать новый external review-pass с меткой."
    exit 1
  fi
fi
```

> **Почему два маркера.** Шаблон `external-review/SKILL.md` использует человекочитаемый заголовок «**Режим: [A/B/C/D]**» — это стабильный якорь (проверено Copilot в раунде 2: предыдущий паттерн `mode: C|D` не матчился ни с одним реальным отчётом). Регексп с альтернативой `(Режим|Mode)` закрывает оба варианта — включая случай, когда PM дополнительно включает `Mode: C` в META JSON.

Если tier == `light`/`standard`/`critical` — external review **опционален**. Если он есть на $HEAD_COMMIT — отметить, если нет — `N/A`.

### Шаг 5: Повторный review после CHANGES_REQUESTED

Если внешний review (или внутренний) когда-либо возвращал `CHANGES_REQUESTED`, после фиксов **обязателен** повторный review-pass на $HEAD_COMMIT.

```bash
LAST_VERDICT=$(timeout 10 gh pr view <PR_NUMBER> --json comments --jq '.comments[].body' \
  | grep -E 'Вердикт.*(APPROVED|CHANGES_REQUESTED)' | tail -1)
```

Если последний вердикт = `CHANGES_REQUESTED` — **СТОП**: «После CHANGES_REQUESTED нужен повторный review-pass на текущем commit».

## Фаза 2: triage-проверки

> Активируется автоматически после внедрения triage-протокола (план v3.3 шаг 1.4 — реализован в `PM_ROLE.md` секция 2.3 и `AGENT_ROLES.md`). До внедрения триажа фаза 2 пропускается, публикуется шаблон фазы 1.

### Шаг 6: статус каждого замечания

Каждое замечание из internal/external review должно иметь явный статус, проставленный PM:

| Статус | Валидация |
|--------|-----------|
| **fix now** | Должен быть закрыт (повторный review-pass на $HEAD_COMMIT с APPROVED для затронутого аспекта) |
| **defer to Beads** | **Обязателен Beads ID**. Формат валидируется через `bd show <id>` (приоритет); при недоступности `bd` CLI — fallback regex `[a-z][a-z-]+-[a-z0-9]+` (покрывает `big-heroes-*` и `bd-*`). Без ID или если `bd show` не находит задачу — замечание считается неразрешённым |
| **reject with rationale** | **Обязательно обоснование** в PR comment |

Скилл выгружает все review-pass комментарии PR, парсит таблицу замечаний и проверяет:
- У каждого fix-now-замечания есть закрывающий APPROVED.
- У каждого defer есть **корректный Beads ID** согласно **фактическому формату проекта**. Валидация:
  - **Мягкая hard-проверка через `bd show <id>`** — если команда находит issue, формат валиден. Это единственный надёжный способ, не завязанный на префикс.
  - **Fallback regex** (если `bd` CLI недоступен): `[a-z][a-z-]+-[a-z0-9]+` — покрывает фактические форматы в проекте: `big-heroes-z3l`, `big-heroes-tgr`, `bd-pipeline-001`. Не хардкодит префикс `bd-`.
- У каждого reject есть текстовое обоснование (не пустое).

> **Почему не хардкодим `bd-*`:** в репозитории фактические Beads ID имеют префикс `big-heroes-*` (см. `.memory_bank/status.md`). Regex `bd-[a-z0-9]+` прошлой версии не покрывал их — все defer были бы ложно отвергнуты как «без ID». Правильный порядок проверки:
> 1. Попробовать `bd show <id>` (если доступен) → если issue существует → OK.
> 2. Если `bd` недоступен → regex `[a-z][a-z-]+-[a-z0-9]+` как fallback (проверка формата, не существования).
> 3. Если ни то, ни другое не прошло → замечание считается неразрешённым.

Если хотя бы одно замечание без статуса/ID/обоснования — **СТОП**:
```
СТОП: замечание #N («<краткая цитата>») не имеет статуса.
Допустимые: fix now / defer to Beads (с ID) / reject with rationale.
```

### Шаг 7: warning при defer-abuse (>50%)

Подсчитай долю замечаний со статусом `defer`:
```
defer_ratio = count(deferred) / count(all_findings)
```

Если `defer_ratio > 0.5` — **warning** (не блокировка):
```
⚠️ ВНИМАНИЕ: >50% замечаний отложены в Beads. Это сигнал defer-abuse —
PR может быть откладывается «на потом» вместо реальных фиксов.
Оператор: проверь Beads issues перед merge.
```

Warning публикуется в финальном комментарии и в чат оператору. Не блокирует merge — это сигнал для оператора, не hard gate (план v3.3 секция 1.4 «Защита от defer-abuse»).

### Сбор данных для финального шаблона

```bash
UNRESOLVED=$(...)              # 0 при штатном ходе после фазы 2
DEFERRED_LIST="bd-001, bd-042" # ID из таблицы триажа
DEFER_RATIO=42                 # % defer от общего числа замечаний
```

## Финальный комментарий

> **Безопасность токена:** `FINALIZE_PR_TOKEN` передаётся как **inline-переменная** в один вызов `gh pr comment` и живёт только для этого процесса. Не используй `export` + `unset` — если скилл упадёт между ними, токен останется в окружении, и следующий ручной `gh pr comment --body "готов к merge"` обойдёт блокировку. Inline-форма `VAR=val cmd ...` устанавливает переменную только для подпроцесса `cmd`, это гарантия очистки без `trap`.

### Re-check HEAD перед публикацией (защита от race condition)

> ⛔ Между шагами 1–5 (фиксация HEAD + проверки) и публикацией финального комментария может пройти 5–30 секунд. За это время в ветку PR может попасть новый commit (параллельный push, force-push, rebase). Если этого не проверить — финальный комментарий объявит `Готов к merge` для commit, который уже не является HEAD-ом.

Перед публикацией финального комментария **обязательно** перепроверь HEAD:

```bash
HEAD_NOW=$(timeout 10 gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid' 2>/dev/null)

if [ "$HEAD_NOW" != "$HEAD_COMMIT" ]; then
  echo "СТОП: HEAD изменился во время выполнения /finalize-pr."
  echo "  Был при старте: $HEAD_COMMIT"
  echo "  Текущий:        $HEAD_NOW"
  echo "Запусти /finalize-pr <PR_NUMBER> заново на новом commit."
  exit 1
fi
```

Если HEAD не изменился — переходи к публикации. Если изменился — **СТОП**, нужен новый запуск скилла на актуальном commit.

### Шаблон фазы 1 (до внедрения triage-протокола)

```bash
FINALIZE_PR_TOKEN=1 gh pr comment <PR_NUMBER> --body "## ✅ Готов к merge

Commit: $HEAD_COMMIT
Verify: ✅
Internal review: ✅ (commit $HEAD_COMMIT)
External review: <✅ (commit $HEAD_COMMIT) | N/A>

— PM (Claude Opus 4.6), /finalize-pr"
```

### Шаблон фазы 2 (после внедрения triage-протокола)

```bash
FINALIZE_PR_TOKEN=1 gh pr comment <PR_NUMBER> --body "## ✅ Готов к merge

Commit: $HEAD_COMMIT
Verify: ✅
Internal review: ✅ (commit $HEAD_COMMIT)
External review: <✅ (commit $HEAD_COMMIT) | N/A>
Unresolved findings: $UNRESOLVED
Deferred to Beads: $DEFERRED_LIST

<если defer_ratio > 50%>
⚠️ ВНИМАНИЕ: $DEFER_RATIO% замечаний отложены в Beads. Проверь перед merge.
</если>

— PM (Claude Opus 4.6), /finalize-pr"
```

Этот вызов обходит hook блокировки «ready to merge» только для одной команды. После завершения `gh pr comment` переменная автоматически исчезает из окружения — гарантия, которой `export`/`unset` не даёт при сбое между ними.

## Emergency override `--force`

Инвокация:
```
/finalize-pr <PR_NUMBER> --force
```

Условия использования:
- **Только** по явной команде оператора в чате («запусти /finalize-pr 42 --force»);
- ИЛИ при зафиксированной ошибке самого скилла (например, GitHub API не отвечает).

PM **не имеет права** инициировать `--force` самостоятельно.

При `--force`:
1. Скилл **не пропускает** проверки 1–5, а **публикует их состояние вручную**:
   ```bash
   gh pr comment <PR_NUMBER> --body "## ⚠️ Force finalize: <причина>

Commit: $HEAD_COMMIT
Verify: <✅/❌/не проверено>
Internal review: <состояние>
External review: <состояние>

Force-причина: <обязательное обоснование оператора>

— PM (Claude Opus 4.6), /finalize-pr --force"
   ```
2. Метка `⚠️ Force finalize` обязательна — оператор по этой метке решает, мержить или нет.
3. `--force` bypass-ит только сломанный механизм автоматической валидации, не сами проверки. Если оператор знает, что какой-то gate не пройден — он берёт ответственность на себя.

## Шаг финального gate (после публикации)

После успешной публикации скилл:
1. Не делает merge автоматически (инвариант 7: merge — отдельное решение оператора).
2. Сообщает оператору в чат: «Опубликован финальный комментарий в PR #<N>. Решение о merge — за тобой.»

## Что НЕ делает фаза 1

- Не проверяет статус замечаний (fix now / defer / reject) — это фаза 2 (после внедрения triage-протокола).
- Не проверяет defer >50% warning — это фаза 2.
- Не обновляет Memory Bank — это делает PM в шаге Landing the Plane (`PM_ROLE.md` 2.5).

## Защита от обхода

| Попытка обхода | Реакция |
|----------------|---------|
| Прямой `gh pr comment` с «готов к merge» | Заблокирован hook'ом в `settings.json` |
| `gh pr merge` | Заблокирован deny-правилом в `settings.json` |
| `/finalize-pr` без проверок | Скилл сам обеспечивает порядок проверок; короткий путь невозможен |
| `--force` PM-ом самостоятельно | Запрещено правилом скилла; обязательная пометка `⚠️ Force finalize` делает обход видимым оператору |
