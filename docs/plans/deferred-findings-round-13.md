# Deferred findings — Sprint Pipeline v3.3 round 13

**Дата:** 2026-04-16
**PR:** [komleff/big-heroes#9](https://github.com/komleff/big-heroes/pull/9)
**Commit где найдены:** `3e7a700`
**Commit с фиксами (5 of 30):** `c6dec4c`
**Статус:** Временный документ. Перевести в Beads issues после восстановления `bd` DB.
**Триаж:** reject with rationale — «Out of scope Sprint Pipeline v3.3. Новые классы bypass/drift, не регрессии. Зарегистрировать как техдолг для отдельного спринта (Sprint Pipeline v3.4: hook redesign на whitelist + deny rules extension + pipeline-audit improvements).»

---

## CRITICAL (bypass hard gate)

### D-01 Hook bypass через file-read utilities помимо `cat`
- **Файл:** `.claude/hooks/check-merge-ready.py:128-139`
- **Проблема:** `_DANGEROUS_SUBST` покрывает только `cat` / `<` / backtick-cat. Bypass через `$(head /tmp/x)`, `$(tail …)`, `$(sed '' …)`, `$(awk 1 …)`, `$(xxd …)`, `$(less …)`, `$(more …)`, `$(tee …)`, `$(od …)`, `$(strings …)`, `$(perl -e …)`, `$(python -c …)`, `$(node -e …)`.
- **Репродьюсер:** `echo '{"tool_input":{"command":"gh pr comment 1 --body \"$(head -1 /tmp/ready.txt)\""}}' | python3 .claude/hooks/check-merge-ready.py; echo $?` → `0` (PASS).
- **Источник:** Tester CRIT #1, Security HIGH #2.
- **Fix направление:** перейти с whitelist-подхода (конкретные утилиты) на blacklist: блокировать любой `$(...)` / backtick внутри `--body` вне allowlisted heredoc `$(cat <<'EOF' ... EOF)`. Регекс `\$\([^)]+\)` + откат если полный match = heredoc.

### D-02 Hook bypass через вложенный substitution `$(echo $VAR)`
- **Файл:** `.claude/hooks/check-merge-ready.py:149-161`
- **Проблема:** `_OPAQUE_VAR_BODY` требует `$` сразу после `--body` (первым символом). Через `$(echo $BODY)` или `$(printf %s $BODY)` переменная раскрывается во вложенном subst, hook видит только литерал `$(echo $BODY)` без `cat`/`<` маркера.
- **Репродьюсер:** `BODY="## Готов к merge"; echo '{"tool_input":{"command":"gh pr comment 1 --body \"$(echo $BODY)\""}}' | python3 .claude/hooks/check-merge-ready.py; echo $?` → `0`.
- **Источник:** Tester CRIT #2.
- **Fix направление:** расширить `_OPAQUE_VAR_BODY` на любые `$VAR` внутри `$(...)`.

### D-03 Hook bypass через `$(cat</path)` без пробела
- **Файл:** `.claude/hooks/check-merge-ready.py:133`
- **Проблема:** pattern `\$\(\s*<` требует `<` сразу после `(`, но вариант `$(cat</tmp/x)` (cat вплотную к `<`) проходит.
- **Репродьюсер:** `echo '{"tool_input":{"command":"gh pr comment 1 --body \"$(cat</tmp/x)\""}}' | python3 ...` → `0`.
- **Источник:** Tester CRIT #3.
- **Fix направление:** `\$\(\s*cat[\s<]`.

### D-04 Tester-gate класс `mixed` недостижим
- **Файл:** `.claude/skills/sprint-pr-cycle/SKILL.md:188-196`
- **Проблема:** `if grep shared → game-math elif grep .claude → pipeline-artifacts else → mixed`. PR трогающий ОДНОВРЕМЕННО `shared/` и `.claude/*` получит `game-math` класс → неполный промпт без пунктов про bypass/drift/silent-downgrade.
- **Источник:** Tester CRIT #6.
- **Fix направление:** два независимых boolean'а `HAS_GAME` / `HAS_PIPE`, комбинация даёт `mixed`.

---

## HIGH

### D-05 Hook bypass через `--edit-last`
- **Файл:** `.claude/hooks/check-merge-ready.py` (не проверяется)
- **Проблема:** `gh pr comment 1 --edit-last` редактирует предыдущий комментарий через `$EDITOR` — без `--body` / `--body-file`, hook ничего не видит.
- **Источник:** Tester HIGH #1.
- **Fix:** добавить `--edit-last` в `_BODY_FILE_FLAGS`-like блокировку.

### D-06 Hook bypass через `gh pr comment N` без `--body` (открывает $EDITOR)
- **Источник:** Tester HIGH #2.
- **Fix:** требовать `--body` или блокировать без него.

### D-07 Hook bypass через альтернативные формулировки
- **Файл:** `.claude/hooks/check-merge-ready.py:43-53`
- **Проблема:** hook ловит только 4 варианта. Проходят: `ready to be merged`, `ready for merging`, `good to merge`, `safe to merge`, `clear to merge`, `approved for merge`, `can be merged`, `готов к мержу`, `готовы к merge`, `можно мержить`, `мержим`.
- **Источник:** Tester HIGH #3, Security HIGH #1 related.
- **Fix направление:** расширить `_MERGE_READY_CANDIDATE` либо (radical) перейти на whitelist — блокировать любой `gh pr comment` от PM без `FINALIZE_PR_TOKEN`.

### D-08 Hook false-negative на punctuation в конце фразы
- **Файл:** `.claude/hooks/check-merge-ready.py:52`
- **Проблема:** `PR is ready to merge.` (точка) проходит.
- **Источник:** Tester HIGH #4.

### D-09 Hook bypass через zero-width chars и HTML entities
- **Файл:** `.claude/hooks/check-merge-ready.py:43-53`
- **Проблема:** `gh pr comment 1 --body 'ready&#x200b;to merge'` или `--body '&#114;eady to merge'`. GitHub рендерит как "ready to merge", но hook видит литералы.
- **Источник:** Security HIGH #1.
- **Fix:** до regex нормализация через `html.unescape()` и удаление `\u200B-\u200F\u2028-\u202F\uFEFF`.

### D-10 Hook bypass через префикс-конкатенацию `--body "Prefix: $VAR"`
- **Файл:** `.claude/hooks/check-merge-ready.py:149-161`
- **Проблема:** `BODY="ready to merge"; gh pr comment 1 --body "Prefix: $BODY"`. `--body` начинается с литерала `Prefix: `, regex `_OPAQUE_VAR_BODY` не матчит.
- **Источник:** Security HIGH #3.
- **Fix:** расширить regex на любое появление `$VAR` / `${VAR}` внутри значения `--body`, не только в начале.

### D-11 Deny rules обходятся через `bash -c` / `sh -c`
- **Файл:** `.claude/settings.json:28-41`
- **Проблема:** `bash -c 'git push --force origin master'` обходит `Bash(git push --force *)` матчер (matcher работает по prefix'у самой команды).
- **Источник:** Security HIGH #4.
- **Fix направление:** добавить `Bash(bash -c *)`, `Bash(sh -c *)`, `Bash(zsh -c *)` в deny (с allow-exception'ами для legitimate cases) либо — PreToolUse hook, парсящий команду полностью.

### D-12 `git push --force-with-lease`, `--all`, `--mirror` не покрыты
- **Файл:** `.claude/settings.json:28-29`
- **Проблема:** `--force-with-lease origin master` или `--all` перезапишут master.
- **Источник:** Security HIGH #5.
- **Fix:** добавить `Bash(git push --force-with-lease *)`, `Bash(git push --force-if-includes *)`, `Bash(git push --all*)`, `Bash(git push --mirror*)`.

### D-13 `gh api` GraphQL merge mutation не заблокирован
- **Файл:** `.claude/settings.json:39-41`
- **Проблема:** `gh api graphql -f query='mutation { mergePullRequest(...) }'` обходит `Bash(gh api *merge*)` (в пути нет "merge"). Также `--method DELETE` не покрывается `gh api -X DELETE *`.
- **Источник:** Security HIGH #6.
- **Fix:** `Bash(gh api graphql*merge*)`, `Bash(gh api * --method DELETE *)`.

### D-14 Codex P1 #2: FINALIZE_PR_TOKEN trivially bypassed
- **Файл:** `.claude/hooks/check-merge-ready.py:225-228`
- **Проблема:** любой caller может обойти блокировку через `FINALIZE_PR_TOKEN=1 gh pr comment ... --body '## ✅ Готов к merge'` без запуска /finalize-pr. Hard gate — honor system.
- **Источник:** Codex P1 #2, Security MED #3.
- **Fix направление:** генерировать random one-shot token из `/finalize-pr`, writer в temp-файл с restrictive permissions, hook читает и сравнивает. Либо — PID-scoped token, либо lockfile.

### D-15 Quality HIGH #2: `codex login status` без timeout
- **Файл:** `.claude/skills/external-review/SKILL.md:77`
- **Проблема:** зависание на broken install / OAuth hang.
- **Fix:** `timeout 30 npx @openai/codex login status` + fallback на Режим C при таймауте.

---

## MEDIUM

### D-16 Tester HIGH #5: Tests не покрывают ключевые bypass-векторы
- **Файл:** `.claude/hooks/test_check_merge_ready.py`
- **Проблема:** отсутствуют тесты на head/tail/sed/awk bypass, zero-width chars, punctuation, alt-формулировки, --edit-last.
- **Fix:** после применения D-01, D-02, D-05, D-07, D-08, D-09 — добавить regression tests.

### D-17 pipeline-audit пропускает `.claude/hooks/*`
- **Файл:** `.claude/skills/pipeline-audit/SKILL.md:119`
- **Проблема:** regex сбора ссылок не включает `claude/hooks`.
- **Fix:** добавить в альтернативы.

### D-18 pipeline-audit `.memory_bank/` не в корнях поиска
- **Файл:** `.claude/skills/pipeline-audit/SKILL.md:119-120`
- **Проблема:** drift-detector не поймает висячие ссылки между `.memory_bank/` и `.agents/`.
- **Fix:** добавить `.memory_bank/` в корневые директории grep.

### D-19 Architecture MED: pipeline-audit 4 аспекта vs Light tier 2
- **Файл:** `.claude/skills/pipeline-audit/SKILL.md:84-86`
- **Проблема:** шаг 3.3 требует 4 аспекта везде, но Light tier (по `reviewer.md:24-26`) использует 2.
- **Fix:** уточнить «ровно 4 аспекта в Standard/Critical/Sprint Final; Light допускается 2».

### D-20 Architecture LOW: C/D regex false match на placeholder `[A/B/C/D]`
- **Файл:** `.claude/skills/finalize-pr/SKILL.md:171`
- **Проблема:** если PM оставит плейсхолдер `Режим: [A/B/C/D]` в публикации, regex `(Режим|Mode)[:"]*\s*"?[CD]\b` сматчит `C` внутри скобок и ложно потребует `⚠️ Degraded mode` label.
- **Fix:** ужесточить regex: `(Режим|Mode)[:"]*\s*"?[CD](?!\w)(?![/A-Z])`.

### D-21 Hygiene MED #2: drift между META JSON шаблонами
- **Файлы:** `.agents/PM_ROLE.md:127`, `.claude/agents/reviewer.md:118-135`, `.claude/skills/sprint-pr-cycle/SKILL.md:302`, `.claude/skills/external-review/SKILL.md:236`
- **Проблема:** PM_ROLE.md канонически требует полный набор полей (iteration, tier, aspects, triage, regressions, reopened, timestamp). reviewer.md использует `triage_counts`. sprint-pr-cycle/external-review публикуют минимальный набор `{reviewer, commit, kind}`.
- **Fix:** унифицировать — либо расширить шаблоны, либо сократить канон до минимума.

### D-22 Hygiene MED #3: дубли jq-regex commit binding в /finalize-pr (3 места)
- **Файл:** `.claude/skills/finalize-pr/SKILL.md:68,137,256`
- **Проблема:** regex `"commit":\\s*\"" + $head + "\"|Commit:\\s*\`?" + $head` повторяется.
- **Fix:** вынести в shell-переменную `COMMIT_FILTER` с документирующим комментарием.

### D-23 Security MED: fail-secure try/except в main()
- **Файл:** `.claude/hooks/check-merge-ready.py:225-237`
- **Проблема:** `HookError` ловится, но `OSError` / общие Exception — нет (полагается на unhandled → non-zero exit).
- **Fix:** обернуть весь main() в try/except Exception.

### D-24 Quality MED: HEAD_COMMIT null-guard в external-review
- **Файл:** `.claude/skills/external-review/SKILL.md:225`
- **Проблема:** null-guard есть в `/finalize-pr` шаг 1, но не в external-review шаг 5 — при таймауте META JSON публикуется с невалидным commit.
- **Fix:** скопировать null-guard из finalize-pr.

### D-25 Security MED: push master через альтернативные формы
- **Файл:** `.claude/settings.json:31-37`
- **Проблема:** не покрыты `git push origin +master`, `refs/heads/master`, `master:master`, `HEAD~1:master`.
- **Fix:** расширить deny rules или PreToolUse hook на git push.

---

## LOW

### D-26 Hygiene: `/tmp/pr-files.txt` хардкод в sprint-pr-cycle
- **Fix:** `$(mktemp)` + trap cleanup.

### D-27 Hygiene: `while IFS='|' read` хрупок к `|` в findings
- **Файл:** `.claude/skills/finalize-pr/SKILL.md:262`
- **Fix:** документировать ограничение в reviewer.md либо перейти на `awk -F'|'` с escape.

### D-28 Hygiene: timeout константы разбросаны (5s / 10s / 15s / 120s)
- **Fix:** добавить комментарии «почему столько» либо вынести в единое место.

### D-29 False-positive hook на code span с merge-ready внутри
- **Проблема:** `` `ready to merge` `` (backticks вокруг фразы) блокируется — false positive на обсуждения.
- **Fix:** разрешить inline code-span контекст.

### D-30 Tier regex матчит в fenced code block
- **Файл:** `.claude/skills/finalize-pr/SKILL.md:104`
- **Проблема:** `Tier: Sprint Final` внутри ```` ``` ```` триггерит детект.
- **Fix:** добавить пре-обработку body для удаления code blocks.

---

## Сводка

- **30 findings всего** в round 13.
- **5 fix now** закрыты в commit `c6dec4c`:
  - Fix 1: hook heredoc-awareness (Codex P1 #1)
  - Fix 2: fake gate /finalize-pr фаза 2 (Tester CRIT #4)
  - Fix 3: triage regex mismatch (Tester CRIT #5)
  - Fix 4: silent Sprint Final downgrade (Qual HIGH #1)
  - Fix 5: стале-ссылка `_MERGE_READY_PATTERN` в docstring (Hygiene MED #1)
- **25 deferred** (D-01 … D-30, с пропусками номеров зарезервированы для нумерации по severity) — этот документ.

## Действие оператора

1. После восстановления `bd` в agent env (или на своей машине): `bd create` для каждого D-XX с приоритетом (D-01…D-04 → P1, D-05…D-15 → P2, D-16…D-25 → P3, D-26…D-30 → P4).
2. Перенести этот файл в `docs/archive/` после миграции в Beads.
3. Решить: отдельный спринт «Sprint Pipeline v3.4: hook redesign» или набор PR'ов.
