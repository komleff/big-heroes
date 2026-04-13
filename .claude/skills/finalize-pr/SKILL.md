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
HEAD_COMMIT=$(gh pr view <PR_NUMBER> --json headRefOid --jq '.headRefOid')
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

## Финальный комментарий (фаза 1, без triage)

> ⚠️ В фазе 2 (после внедрения triage-протокола, шаг 5b плана v3.3) шаблон расширяется полями `Unresolved findings` и `Deferred to Beads`. Сейчас публикуй именно эту версию.

Формирование тела с экранированной переменной (без heredoc-подстановок, чтобы избежать инъекции):

```bash
gh pr comment <PR_NUMBER> --body "## ✅ Готов к merge

Commit: $HEAD_COMMIT
Verify: ✅
Internal review: ✅ (commit $HEAD_COMMIT)
External review: <✅ (commit $HEAD_COMMIT) | N/A>

— PM (Claude Opus 4.6), /finalize-pr"
```

Этот комментарий обходит hook блокировки «ready to merge» через переменную окружения `FINALIZE_PR_TOKEN`, которую устанавливает сам скилл:

```bash
export FINALIZE_PR_TOKEN=1
gh pr comment <PR_NUMBER> --body "..."
unset FINALIZE_PR_TOKEN
```

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
