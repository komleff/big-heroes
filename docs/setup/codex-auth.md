# Настройка Codex CLI (OpenAI API key) для Claude Code

Документ описывает, как настроить Codex CLI так, чтобы **любая сессия Claude Code** в проекте Big Heroes автоматически получала доступ к моделям OpenAI (GPT-5.4 / GPT-5.3-Codex) для внешнего ревью PR через скилл [`/external-review`](../../.claude/skills/external-review/SKILL.md).

Читай целиком — в конце документа раздел «Что делать при компрометации ключа».

---

## 1. Архитектура решения

```
┌───────────────────────────────┐
│ OpenAI Dashboard              │
│ • Project: big-heroes-reviews │
│ • API key (restricted)        │
└──────────────┬────────────────┘
               │ sk-proj-...
               ▼
┌───────────────────────────────┐
│ Claude Code Secrets           │
│ OPENAI_API_KEY=sk-proj-...    │
└──────────────┬────────────────┘
               │ env var в каждой сессии
               ▼
┌───────────────────────────────┐
│ SessionStart hook             │
│ .claude/hooks/codex-login.sh  │
│ → codex login --with-api-key  │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ ~/.codex/auth.json (chmod 600)│
│ живёт в $HOME, вне git-репо   │
└───────────────────────────────┘
```

Ключ **никогда не попадает в репозиторий**: он хранится в Secrets Claude Code, пробрасывается в сессию как env var, а хук на старте сессии делает логин Codex из stdin.

---

## 2. Создание API key в OpenAI

### 2.1 Отдельный Project

В OpenAI Dashboard: **Settings → Projects → Create project**.

- Name: `big-heroes-reviews` (или аналогичный — один проект = одна цель).
- **Не переиспользуй** Default project и не смешивай с другими задачами (чатботы, продовые интеграции). Чем уже скоуп проекта, тем меньше blast radius при утечке.

### 2.2 Restricted API key

В выбранном проекте: **API keys → Create new secret key → Restricted**.

**Name:** `claude-code-external-review` (или с датой ротации).

**Permissions (минимальный набор для Codex CLI `codex review`):**

| Scope | Значение | Зачем |
|---|---|---|
| **Model capabilities** | **Write** | Вызов моделей (обязательно — без этого Codex не работает) |
| **Models** | **Read** | Список моделей (Codex опрашивает при старте) |
| **Responses API** | **Write** | Codex CLI использует Responses API для `review` |
| Assistants | **None** | Не используется |
| Threads | **None** | Не используется |
| Files | **None** | Ревью не загружает файлы в OpenAI — diff передаётся inline |
| Vector Stores | **None** | Не используется |
| Fine-tuning | **None** | Не используется |
| Batch | **None** | Не используется |
| Images | **None** | Не используется |
| Audio | **None** | Не используется |
| Embeddings | **None** | Не используется |
| Moderations | **None** | Не используется |
| Uploads | **None** | Не используется |
| Organization / Billing / Members | **None** | Критично — иначе ключ сможет менять биллинг и приглашать юзеров |

> **Правило:** всё, что не в списке «Write/Read» выше, должно быть **None**. Codex CLI `codex review` этого не требует.

### 2.3 Model allowlist (если доступно в UI)

Если в настройках проекта есть «Model access» или «Allowed models» — ограничь список только теми моделями, которые использует `/external-review`:

- `gpt-5.4`
- `gpt-5.3-codex`
- (опционально) дефолтная модель Codex CLI на случай fallback

Это защита от misuse: даже если ключ утечёт, нельзя будет вызывать дорогие модели (например, o-серия с deep reasoning) вне заданного набора.

### 2.4 Usage limits (бюджет)

**Settings → Limits → Usage limits** на уровне проекта:

| Лимит | Рекомендация | Обоснование |
|---|---|---|
| **Hard limit (hard stop)** | `$50/мес` для старта | Одно ревью PR = ~$1-4 (2 ревьюера × ~100k токенов). При 15-20 PR/мес хватит с запасом |
| **Soft limit (email alert)** | `$30/мес` (60% от hard) | Заранее увидишь аномальный расход |
| **Rate limit: RPM** | 20 | `codex review` делает ~5-10 запросов на ревью; 20 RPM хватит на 2-3 одновременных ревью |
| **Rate limit: TPM** | `200k` | С запасом на большие diff'ы |

> Первый месяц — понаблюдай фактический расход в OpenAI Dashboard → Usage. Потом скорректируй hard limit до `max(наблюдаемое × 3, $20)`.

### 2.5 Срок жизни ключа (expiration)

Если UI OpenAI поддерживает `expires_at` — **90 дней**. Это вынудит плановую ротацию и отрежет утёкший ключ автоматически.

Если не поддерживает — поставь в календарь ротацию раз в 90 дней вручную.

---

## 3. Размещение ключа в Claude Code

### 3.1 Claude Code Web (`claude.ai/code`)

1. Открой проект `big-heroes` в web-интерфейсе.
2. **Settings → Environment Variables / Secrets** (точное название раздела может отличаться).
3. Добавь:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-proj-...` (вставь ключ из шага 2.2)
   - **Scope:** project (не user-global — привязывай к репо)
4. Сохрани.

После этого во всех новых сессиях Claude Code переменная будет доступна, и SessionStart-хук автоматически залогинит Codex.

### 3.2 Claude Code Desktop / CLI (локальная машина)

Положи в shell rc (`~/.zshrc`, `~/.bashrc`):

```bash
export OPENAI_API_KEY='sk-proj-...'
```

Либо используй менеджер секретов (1Password CLI, `pass`, `keychain`):

```bash
# 1Password CLI пример
export OPENAI_API_KEY="$(op read 'op://Personal/OpenAI Big Heroes/credential')"
```

**Не клади ключ в `.env` проекта** — даже с `.gitignore` есть риск случайного коммита или утечки через docker/CI.

### 3.3 CI (GitHub Actions) — если понадобится

Если в будущем захочешь прогонять `/external-review` из CI:

1. Settings → Secrets and variables → Actions → New repository secret.
2. Name: `OPENAI_API_KEY`, Value: ключ (можно **отдельный** ключ для CI с ещё более узким скоупом).
3. В workflow: `env: { OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }} }`.

---

## 3.4 ⚠️ Чего делать НЕ надо

**Не клади ключ в `.claude/settings.json`** в секцию `env`.

```jsonc
// ❌ ОПАСНО — settings.json коммитится в git
{
  "env": {
    "OPENAI_API_KEY": "sk-proj-..."  // утечёт в историю репозитория!
  }
}
```

`.claude/settings.json` — **shared-файл, отслеживаемый git'ом** (это общий конфиг команды, в нём лежат permissions и хуки). Ключ, положенный туда, попадёт в коммит, в PR, в GitHub-историю, в зеркала, в индекс поисковиков. Revoke не спасёт — репутационно ключ скомпрометирован навсегда.

### Допустимый fallback: `.claude/settings.local.json`

Если Secrets в вашем варианте Claude Code недоступны, можно использовать **локальный** settings-файл:

```jsonc
// .claude/settings.local.json — НЕ коммитится (в .gitignore)
{
  "env": {
    "OPENAI_API_KEY": "sk-proj-..."
  }
}
```

Оговорки:
- Файл **должен** быть в `.gitignore` (в этом репо уже добавлен — см. `.gitignore`).
- Ключ лежит plaintext на диске — защита только правами ФС.
- В web-сессиях Claude Code репозиторий клонируется заново каждый раз → `settings.local.json` не переживёт рестарт → в web-варианте **работать не будет**, только на локальной машине.
- Нет централизованной ротации — придётся обновлять в каждом клоне.

> **Приоритет:** Secrets (§3.1) > env в shell rc (§3.2) > `settings.local.json` (§3.4) >>> `settings.json` (❌ никогда).

---

## 4. Проверка работы

В новой сессии Claude Code:

```bash
# 1. Хук отработал при старте?
npx @openai/codex login status
# → должно быть: "Logged in using an API key - sk-proj-***XXXX"

# 2. Env var видна?
printenv OPENAI_API_KEY | head -c 10
# → должно быть: sk-proj-mM (первые 10 символов)

# 3. Smoke-тест запроса
echo 'Привет, кто ты?' | npx @openai/codex exec --model gpt-5.3-codex -
```

Если `codex login status` говорит «Not logged in» — проверь:
- Переменная `OPENAI_API_KEY` установлена в Secrets Claude Code?
- `.claude/hooks/codex-login.sh` исполняемый? (`ls -la` должно быть `-rwx`)
- В settings.json есть секция `hooks.SessionStart`? (см. `.claude/settings.json`)

---

## 5. Ротация ключа

**Раз в 90 дней (или при подозрении на утечку):**

1. В OpenAI Dashboard создай новый restricted key с теми же permissions.
2. В Claude Code Secrets **обнови** значение `OPENAI_API_KEY` на новый.
3. Дождись, пока все открытые сессии перезапустятся (или перезапусти вручную).
4. В OpenAI Dashboard **удали старый ключ**.
5. Проверь OpenAI → Usage, что 24 часа не было запросов со старого ключа (т.е. ни одна сессия не зависла на нём).

---

## 6. Что делать при компрометации ключа

Признаки: аномальный расход в OpenAI Usage, email-alert от OpenAI, подозрительная активность в логах, ключ засветился в git/PR/чате/скриншоте.

### Действия (в порядке срочности):

1. **Немедленно удали ключ** в OpenAI Dashboard → API keys → Revoke. Это отсекает доступ мгновенно.
2. Создай новый ключ (шаг 2.2) и обнови Secrets (шаг 3).
3. Проверь Usage за последние 24-72 часа — есть ли нетипичные запросы (модели, которые вы не используете; огромные объёмы токенов; необычное время).
4. Если ключ засветился в git:
   - Не надейся на `git rebase -i` — GitHub/GitLab уже индексируют историю и могут раздать её ботам.
   - Ключ **уже скомпрометирован**, даже если commit удалён. Обязателен revoke.
   - Отдельно: проверь `git reflog` и remote mirrors.
5. Если подозреваешь misuse — напиши в OpenAI Support с указанием key prefix (`sk-proj-***last4`) и попроси аудит.

### Быстрая команда проверки, не засветился ли ключ в репо:

```bash
git log --all -p -S 'sk-proj-' | head
git log --all -p -S 'OPENAI_API_KEY=' | head
```

Пусто = чисто.

---

## 7. Сводка: безопасность vs функциональность

| Что даёт ограниченный ключ | Что теряем |
|---|---|
| Компрометация = максимум $50/мес убытков (hard limit) | Ничего — весь набор прав `codex review` доступен |
| Ключ не может менять биллинг/приглашать юзеров | — |
| Только whitelisted модели (если настроил allowlist) | — |
| Ротация каждые 90 дней ограничивает окно злоупотребления | — |
| Алерты при 60% бюджета ловят аномалии | — |

**Итог:** полноценное ревью PR возможно без компромисса по безопасности — все ограничения выше на функциональность `codex review` не влияют.

---

## Связанные файлы

- `.claude/hooks/codex-login.sh` — SessionStart-хук авто-логина
- `.claude/settings.json` — регистрация хука (секция `hooks.SessionStart`)
- `.claude/skills/external-review/SKILL.md` — скилл, использующий Codex CLI
- `.agents/AGENT_ROLES.md` §3 — формат вердикта Reviewer
