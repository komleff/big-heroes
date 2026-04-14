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

```bash
HEAD_COMMIT=$(gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid' 2>/dev/null)

# null-guard: PR может быть закрыт/удалён/недоступен между шагами
if [ -z "$HEAD_COMMIT" ] || [ "$HEAD_COMMIT" = "null" ]; then
  echo "СТОП: не удалось получить HEAD commit PR #<PR_NUMBER>."
  echo "Возможные причины: PR закрыт/удалён, нет прав, API недоступен."
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

PM публикует review-отчёты с JSON-метаданными в HTML-комментарии (см. `PM_ROLE.md` секция 2.2):

```
<!-- {"reviewer": "opus", "iteration": N, "tier": "...", "commit": "<hash>", ...} -->
```

Скилл выгружает все комментарии PR и ищет последний `review-pass` с `commit == $HEAD_COMMIT`:

```bash
gh pr view <PR_NUMBER> --json comments --jq '.comments[].body' \
  | grep -B 1 -A 30 'reviewer.*commit.*'"$HEAD_COMMIT" \
  | head -50
```

Если последний review-pass на этом commit — **OK**.
Если последний review-pass на старом commit (или его нет) — **СТОП**:
```
СТОП: Internal review-pass отсутствует для commit $HEAD_COMMIT.
Последний внутренний review был на commit <старый_hash>.
Запусти /sprint-pr-cycle для нового review-pass.
```

### Шаг 4: External review для Sprint Final

Определи tier текущего PR. Sprint Final — это PR, который завершает спринт и готовится к merge в master. Признаки:
- Метка `sprint-final` на PR;
- В описании PR явно указано `Tier: Sprint Final`;
- PM в ходе оркестрации зафиксировал tier=`sprint-final` в Memory Bank.

Если tier == `sprint-final`:
```bash
gh pr view <PR_NUMBER> --json comments --jq '.comments[].body' \
  | grep -B 1 -A 5 'Внешнее ревью.*Sprint Final.*commit.*'"$HEAD_COMMIT"
```

- Если внешний review-pass на $HEAD_COMMIT есть — **OK**.
- Если нет — **СТОП**: «External review обязателен для Sprint Final. Запусти `/external-review <PR_NUMBER>`».
- `N/A` для Sprint Final **не допускается** — внешнее ревью обязательно.

Если tier == `light`/`standard`/`critical` — external review **опционален**. Если он есть на $HEAD_COMMIT — отметить, если нет — `N/A`.

### Шаг 5: Повторный review после CHANGES_REQUESTED

Если внешний review (или внутренний) когда-либо возвращал `CHANGES_REQUESTED`, после фиксов **обязателен** повторный review-pass на $HEAD_COMMIT.

```bash
LAST_VERDICT=$(gh pr view <PR_NUMBER> --json comments --jq '.comments[].body' \
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
| **defer to Beads** | **Обязателен Beads ID** (`bd-XXX`). Без ID — замечание считается неразрешённым |
| **reject with rationale** | **Обязательно обоснование** в PR comment |

Скилл выгружает все review-pass комментарии PR, парсит таблицу замечаний и проверяет:
- У каждого fix-now-замечания есть закрывающий APPROVED.
- У каждого defer есть Beads ID в формате `bd-[a-z0-9-]+` (класс включает цифры и дефис — валидные примеры: `bd-001`, `bd-042`, `bd-pipeline-001`).
- У каждого reject есть текстовое обоснование (не пустое).

> **Проверка реального существования `bd show <id>` — опциональна и мягкая.** Скилл проверяет только формат. Если Beads локально доступен, PM может дополнительно вызвать `bd show <id>` для sanity-check, но это НЕ hard gate: недоступность Beads в среде не должна ломать `/finalize-pr`. Полная валидация «ID → реальная issue» — отдельная задача (см. `bd-pipeline-bdid-check`).

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
