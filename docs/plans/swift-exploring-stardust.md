# План спринта: реализация pipeline v3.3

**Дата:** 2026-04-13
**Ветка:** `claude/agent-pipeline-sprint-mxaQ1`
**Источник истины:** `.agents/pipeline-improvement-plan-v3.3.md` (закоммичено оператором в `f1f9b1c`)

---

## Контекст

Агентный пайплайн Big Heroes эволюционировал до v3.3 после пяти раундов кросс-модельного ревью (Opus 4.6 ↔ GPT-5.4). Ключевой вывод v3.3: проблема не в отдельных агентах, а в недостаточной автоматизации quality loop — soft constraints («PM обязан») для ИИ-агентов эквивалентны их отсутствию.

План v3.3 превращает soft constraints в hard gates через:
- новый скилл `/finalize-pr` — единственный способ объявить PR готовым к merge;
- новый скилл `/pipeline-audit` — антивирус против drift в документах;
- унификацию проверок через `/verify`;
- привязку review к commit hash;
- protection findings от искажения PM;
- двухфазный degradation path для external-review;
- формальный triage-протокол с Beads ID.

## Что уже сделано (коммит `f1f9b1c`)

Оператор вручную обновил 7 документов в `.agents/` (суммарно 1573 → 1778 строк):

| Файл | Ключевое |
|------|----------|
| `REFERENCES.md` | +6 фреймворков, +4 статьи, +документация инструментов, +проекты-источники |
| `HOW_TO_USE.md` | +`/verify`, `/finalize-pr`, `/external-review`, `/pipeline-audit`; merge-решение через `✅ Готов к merge` |
| `PIPELINE.md` | +finalize-pr, verify, pipeline-audit; обновлён жизненный цикл; инварианты; режимы деградации |
| `AGENT_ROLES.md` | PM — единый владелец публикации, Reviewer возвращает findings; аспект «Качество» проверяет Verification Contract |
| `PM_ROLE.md` | Контекстная изоляция, triage с Beads ID, `/finalize-pr` вместо ручного «готово», JSON-метаданные |
| `PIPELINE_ADR.md` | +5 решений (3.11–3.15), обновлена таблица рисков |
| `AGENTIC_PIPELINE.md` | +4 универсальных принципа (4.7–4.10), обновлён чеклист переноса |
| `pipeline-improvement-plan-v3.3.md` | Сам план как справочник |

## Что осталось сделать (код и конфиги)

### P0: устранение системных сбоев

1. **Шаг 1 — `/verify` как единый gate (0.3).**
   Везде заменить `npm run build && npm run test` на `/verify`.
   - `.claude/skills/sprint-pr-cycle/SKILL.md` — шаг 1.1.
   - Убедиться, что `PM_ROLE.md` секция 2.2 уже переведена.

2. **Шаг 2 — Единый владелец + защита findings (0.2).**
   - `.claude/agents/reviewer.md` — «возвращай findings, не публикуй»; 4-аспектный structured output.
   - `.claude/skills/external-review/SKILL.md` — raw output каждого ревьюера в отдельном collapsible `<details>` блоке (фолбэк-защита от искажения).

3. **Шаг 3 — Degradation path для external-review (0.5).**
   - `.claude/skills/external-review/SKILL.md` — добавить:
     - режим **C**: Codex CLI недоступен → два прохода Claude (стандартный + adversarial) с обязательной меткой ⚠️ «Degraded mode: не эквивалентно cross-model review»;
     - режим **D**: VS Code GitHub Copilot Agent с ChatGPT-5.4, ручной, с меткой ⚠️ «Manual emergency mode».

4. **Шаг 4 — Новый скилл `/pipeline-audit` (0.4).**
   - Создать `.claude/skills/pipeline-audit/SKILL.md` с логикой: собрать нормативные файлы → проверить инварианты 1–7 → проверить согласованность имён ролей, команд, аспектов ревью → проверить отсутствие противоречий с deny-rules → отчёт [OK / DRIFT DETECTED].
   - Триггер: после каждых 3–5 спринтов; обязательно перед изменением самого пайплайна.

5. **Шаг 5a — Новый скилл `/finalize-pr` фаза 1 (0.1).**
   - Создать `.claude/skills/finalize-pr/SKILL.md` с логикой шагов 1–5 из плана v3.3:
     - фикс HEAD commit hash → проверка `/verify` на этом commit → проверка internal review-pass на commit → для Sprint Final — проверка external review на commit → публикация финального комментария (шаблон фазы 1).
   - Emergency override `--force` — только по явной команде оператора, с обязательной пометкой `⚠️ Force finalize`.
   - Обновить `.claude/settings.json` — добавить hook `PreToolUse` для `Bash(gh pr comment*)`, который блокирует тексты «готов к merge» / «ready to merge» / «ready for merge» вне `/finalize-pr`.

### P1: усиление качества

6. **Шаг 6 — Контекстная изоляция PM (1.1).**
   - Проверить, что в `PM_ROLE.md` зафиксировано: обновление `status.md` после каждой задачи, compact handoff packet после каждого review-pass, рекомендация session reset после 3 задач **или** 5 review-итераций.
   - `.claude/agents/developer.md` / `planner.md` — упоминание compact handoff packet при передаче PM.

7. **Шаг 7 — Triage с Beads binding (1.4).**
   - Проверить, что в `PM_ROLE.md` есть таблица статусов (fix now / defer to Beads — только с ID / reject with rationale).
   - Добавить валидацию в `finalize-pr` фазы 2 (см. шаг 5b).

8. **Шаг 5b — `/finalize-pr` фаза 2 (0.1).**
   - Расширить `finalize-pr/SKILL.md`: шаги 6–7 — проверка статуса у каждого замечания; warning при >50% defer; финальный комментарий по шаблону фазы 2 (с полями `Unresolved findings` и `Deferred to Beads`).
   - Зависит от шага 7 (triage-протокол).

9. **Шаг 8 — Verification Contract до кода (1.3).**
   - `.claude/agents/planner.md` — добавить обязательную секцию в любой план: acceptance criteria, expected behaviors, edge cases, error cases, инварианты, список тестов.
   - `.claude/agents/reviewer.md` — в аспекте «Качество» автоматически `CHANGES_REQUESTED`, если Verification Contract отсутствует или тесты не соответствуют.

10. **Шаг 9 — Tester gate для Critical (1.2).**
    - `.claude/skills/sprint-pr-cycle/SKILL.md` — для tier = Critical: PM → Tester-субагент → findings → Developer → повторный `/verify`.
    - Различать Standard vs Critical в скилле (закрывает issue `big-heroes-e0n`).

11. **Шаг 10 — Memory Bank enforcement (1.5).**
    - В `finalize-pr/SKILL.md` добавить мягкий warning (не блокировку), если `.memory_bank/status.md` не обновлён с последнего merge.

12. **Шаг 11 — Метрики с commit/regression (1.6).**
    - `.claude/agents/reviewer.md` — включить JSON-метаданные в review-отчёт (reviewer, iteration, tier, commit, aspects, triage, regressions, reopened_from_previous_iteration, timestamp).
    - Закрывает issue `big-heroes-6bs` (split source of truth по owner публикации).

### Обновление Memory Bank

13. Обновить `.memory_bank/status.md`:
    - Зафиксировать начало спринта pipeline v3.3.
    - Закрыть issues `big-heroes-6bs`, `big-heroes-z3l`, `big-heroes-e0n`, `big-heroes-fkv` после соответствующих шагов.

## Критические файлы к правке

- `.claude/skills/finalize-pr/SKILL.md` — **новый**
- `.claude/skills/pipeline-audit/SKILL.md` — **новый**
- `.claude/skills/sprint-pr-cycle/SKILL.md` — переработка
- `.claude/skills/external-review/SKILL.md` — режимы C/D, collapsible raw
- `.claude/skills/verify/SKILL.md` — расширяемость, возможно typecheck/lint
- `.claude/agents/reviewer.md` — findings вместо публикации, JSON-метаданные, enforcement Verification Contract
- `.claude/agents/planner.md` — Verification Contract обязателен
- `.claude/agents/tester.md` — gate для Critical
- `.claude/agents/developer.md` — compact handoff packet
- `.claude/settings.json` — новый PreToolUse hook блокировки «ready to merge»
- `.memory_bank/status.md` — старт спринта, закрытие связанных issues

## Используемые существующие артефакты

- `.claude/skills/verify/SKILL.md` — уже существует, переиспользуется как единый gate.
- Хуки pre-commit (`npm run test --if-present`) и `Bash(gh pr comment*)` в `.claude/settings.json` — уже есть, дополняются новыми матчерами, не переписываются.
- Правила в `.claude/rules/*.md` — без изменений (не требуют правок по v3.3).
- Деny-правила push в master/main — без изменений.
- `.agents/pipeline-improvement-plan-v3.3.md` — справочник, **не трогаем**.

## Порядок реализации и коммиты

Атомарные коммиты по таблице из плана v3.3 (по одному шагу = один коммит):

```
1. docs(skill): verify как единый gate в sprint-pr-cycle          (шаг 1)
2. docs(agent): reviewer возвращает findings, PM публикует        (шаг 2)
3. docs(skill): external-review режимы C/D + collapsible raw      (шаг 3)
4. feat(skill): pipeline-audit — проверка инвариантов             (шаг 4)
5. feat(skill): finalize-pr фаза 1 (commit+verify+review gate)    (шаг 5a)
6. feat(hook): блокировка ручного «ready to merge» вне /finalize-pr
7. docs(agent): planner — Verification Contract до кода           (шаг 8)
8. docs(agent): reviewer — enforcement Verification Contract      (шаг 8)
9. docs(skill): sprint-pr-cycle — tester gate для Critical        (шаг 9)
10. feat(skill): finalize-pr фаза 2 (triage + Beads ID)           (шаг 5b + 7)
11. docs(agent): reviewer — JSON-метаданные review-отчёта         (шаг 11)
12. docs(memory): status.md — старт спринта, закрытие DOCS-issues (шаг 13)
```

Каждый коммит:
- проходит pre-commit hook (`npm run test`);
- пушится в `claude/agent-pipeline-sprint-mxaQ1` отдельно — оператор может остановить в любой момент;
- описание на русском, в стиле проекта.

## Verification

После всех коммитов:

1. **Вручную:** пройтись по шагам `/finalize-pr` на тестовом PR, проверить что:
   - при mismatch commit hash скилл останавливается;
   - при отсутствии external review для Sprint Final — СТОП;
   - при попытке вручную написать «готов к merge» — блокировка hook'ом.
2. **`/pipeline-audit`:** запустить, ожидаемый результат — `OK` (все инварианты 1–7 отражены в документах без противоречий).
3. **`/verify`:** прогоняется после каждого коммита и зелёный перед push.
4. **Cross-check документов:** убедиться, что `AGENT_ROLES.md`, `PM_ROLE.md`, `PIPELINE.md`, реализованные скиллы и agents-файлы говорят одно и то же про:
   - владельца публикации (PM);
   - число аспектов ревью (4);
   - tier-ы ревью (Light / Standard / Critical / Sprint Final);
   - обязательность external review для Sprint Final.
5. **Коммит-бюджет:** при обнаружении ошибок — не amend, а новый коммит (правило проекта).

## Риски и как их снимаем

- **Риск:** реализованный скилл расходится с документом `AGENT_ROLES.md` / `PM_ROLE.md` (которые уже обновлены оператором).
  **Митигация:** перед каждым шагом читать соответствующий документ из `.agents/` и реализовать скилл строго по нему, не изобретая поведение.
- **Риск:** pre-commit hook на `npm run test` блокирует коммиты с чисто документационными изменениями.
  **Митигация:** hook уже использует `--if-present`, тесты зелёные на старте (Sprint 4 merged). Следим, чтобы тесты не ломались.
- **Риск:** `gh pr comment`-hook ложно срабатывает на текст вроде «почти готов к merge» в цитате ревьюера.
  **Митигация:** матчер по точным фразам (`готов к merge` / `ready to merge` / `ready for merge`) с возможностью обхода через переменную окружения `FINALIZE_PR_TOKEN`, которую проставляет сам скилл `/finalize-pr`.
