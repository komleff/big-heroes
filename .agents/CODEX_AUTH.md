# Настройка Codex CLI (OpenAI API key) для Claude Code

> ⚠️ **Sprint Pipeline v3.6: Codex CLI — legacy fallback.**
> Основной путь Mode A — Node.js native скрипт [`.claude/tools/openai-review.mjs`](../.claude/tools/openai-review.mjs) (Правка 1 плана v3.6). Он обращается к OpenAI API напрямую через SDK (без subprocess), устраняет BE-11 (`CreateProcessWithLogonW failed: 1326` на Windows) как класс проблем и не требует `sandbox_mode=danger-full-access` (инвариант I4 плана).
>
> Документ сохранён для среды, где Node.js native недоступен (старая версия Node, сломан `openai` npm пакет). Ключ `OPENAI_API_KEY` используется обоими путями — инструкции по ротации в §5 применимы и к Mode A через `openai-review.mjs`.

Документ описывает, как настроить Codex CLI так, чтобы **любая сессия Claude Code** в проекте Big Heroes автоматически получала доступ к моделям OpenAI (GPT-5.4 / GPT-5.3-Codex) для внешнего ревью PR через скилл [`/external-review`](../.claude/skills/external-review/SKILL.md).

Документ — часть пайплайна агентов (см. соседние файлы в `.agents/`). Читай целиком — в конце раздел «Что делать при компрометации ключа».

---

## 1. Архитектура решения

```
┌───────────────────────────────────────┐
│ OpenAI Dashboard                      │
│ • Project (Default или отдельный)     │
│ • Restricted API key                  │
└──────────────────┬────────────────────┘
                   │ sk-proj-...
                   ▼
┌───────────────────────────────────────┐
│ Источник OPENAI_API_KEY (один из):    │
│ • Claude Code Web → Secrets           │
│ • ~/.claude/settings.json → env       │
│ • .claude/settings.local.json → env   │
│ • shell rc (export)                   │
└──────────────────┬────────────────────┘
                   │ env var в каждой сессии
                   ▼
┌───────────────────────────────────────┐
│ SessionStart hook                     │
│ .claude/hooks/codex-login.sh          │
│ → codex login --with-api-key (stdin)  │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ ~/.codex/auth.json (chmod 600)        │
│ живёт в $HOME, вне git-репо           │
└───────────────────────────────────────┘
```

Ключ **никогда не попадает в git**: он хранится в Secrets/user-global settings/shell, пробрасывается в сессию как env var, а хук на старте сессии делает логин Codex из stdin.

> **Platform note:** схема показывает POSIX-путь `$HOME/.codex/`. На Windows git-bash `$HOME == $USERPROFILE`, физический путь — `%USERPROFILE%\.codex\`. Hook использует `${HOME:-}` expansion, которое в git-bash разрешается корректно. `chmod 600` на Windows — no-op (NTFS ACL, не POSIX bits), auth.json полагается на стандартный user-profile ACL.

---

## 2. Создание API key в OpenAI

### 2.1 Project (контекст биллинга)

OpenAI Project — это **биллинговый/изоляционный контейнер**, не «программный продукт». Один project = одна категория интеграции (Claude Code, Cursor, VS Code Copilot…), а не одна игра. Разделять имеет смысл по **источнику запросов**, чтобы:

- usage и алерты считались отдельно;
- при компрометации revoke не задел другие интеграции.

**Рекомендация:** отдельный проект `claude-code-codex` (Settings → Projects → Create project). Если в твоём аккаунте Projects не управляются (только `Default project`) — оставайся в Default, главное настроить Limits (§2.4).

### 2.2 Restricted API key — минимальные permissions

В выбранном проекте: **API keys → Create new secret key → Restricted**.

**Name:** `claude-code-codex` (или с датой ротации).

#### Семантика уровней OpenAI

| Уровень | Что значит |
|---|---|
| **None** | 403 на любой вызов |
| **Read** | только GET (актуально для эндпоинтов с listing — например `/v1/models`) |
| **Request** | разрешён инференс — основной рабочий уровень для эндпоинтов без stored ресурсов |
| **Write** | плюс создание/изменение хранящихся ресурсов (доступен только там, где такие ресурсы есть) |

Важно: уровни Write vs Request в OpenAI UI **зависят от эндпоинта**, не одинаковы повсеместно. Для Chat completions, Embeddings, TTS максимум — `Request` (эти эндпоинты без stored ресурсов). Для `/v1/responses` доступен `Write` — т.к. Responses API управляет хранимым context state (streaming sessions). Для File API и Fine-tuning тоже доступен `Write`. «Request» — полноценный доступ к inference, не урезанный; `Write` — плюс ресурс-ops, где они есть.

#### Минимальный набор permissions для `codex review`

| Скоуп | Уровень | Зачем |
|---|---|---|
| **List models** | **Read** | Codex CLI опрашивает `/v1/models` в некоторых сценариях (интерактивный login / model discovery). **Не используется** при `codex login --with-api-key` — этот путь сохраняет ключ без валидации (см. §4 troubleshooting row про «Hook OK но 401»). Оставлен в минимальном наборе на случай будущих версий CLI |
| **Model capabilities → Responses** (`/v1/responses`) | **Write** | Основной API для `codex review` |
| **Model capabilities → Chat completions** (`/v1/chat/completions`) | **Request** | Fallback для отдельных моделей |
| Model capabilities → Text-to-speech | **None** | Не используется |
| Model capabilities → Realtime | **None** | Не используется |
| Model capabilities → Embeddings | **None** | Не используется |
| Model capabilities → Images | **None** | Не используется |
| Model capabilities → Moderations | **None** | Не используется |
| Assistants | **None** | Не используется |
| Threads | **None** | Не используется |
| Evals | **None** | Не используется |
| Fine-tuning | **None** | Не используется |
| Files | **None** | Ревью передаёт diff inline, файлы не загружает |
| Videos | **None** | Не используется |
| Vector Stores | **None** | Не используется |
| Prompts | **None** | Не используется |
| Datasets | **None** | Не используется |
| Batch / Uploads / Audit logs | **None** | Не используется |
| Organization / Billing / Members | **None** | Критично — иначе ключ сможет менять биллинг и приглашать юзеров |

Итого: **5 selected permissions** (List models: Read + Responses: Write + Chat completions: Request, остальные None).

> **Правило:** UI OpenAI для каждого скоупа предлагает свой набор уровней. Если для какого-то поля нет варианта `Write` — это нормально, у этого эндпоинта нет stored-ресурсов; используй максимум, который доступен (обычно `Request`).

### 2.3 Model allowlist (если доступно в UI)

Если в настройках проекта есть «Model access» или «Allowed models» — ограничь только теми моделями, что использует `/external-review`:

- `gpt-5.4`
- `gpt-5.3-codex`
- (опционально) дефолтная модель Codex CLI на случай fallback

Защита от misuse: даже при утечке нельзя будет вызывать дорогие модели вне набора.

### 2.4 Usage limits (бюджет)

**Settings → Limits → Usage limits** на уровне проекта:

| Лимит | Рекомендация | Обоснование |
|---|---|---|
| **Hard limit** | `$50/мес` для старта | Одно ревью PR = ~$1-4 (2 ревьюера × ~100k токенов). При 15-20 PR/мес хватит с запасом |
| **Soft limit (email alert)** | `$30/мес` (60% от hard) | Заранее увидишь аномальный расход |
| **Rate limit: RPM** | 20 | `codex review` делает ~5-10 запросов на ревью; 20 RPM хватит на 2-3 одновременных ревью |
| **Rate limit: TPM** | `200k` | С запасом на большие diff'ы |

> Первый месяц — понаблюдай фактический расход в OpenAI Dashboard → Usage. Потом скорректируй hard limit до `max(наблюдаемое × 3, $20)`.

### 2.5 Срок жизни ключа (expiration)

Если UI поддерживает `expires_at` — **90 дней**. Принудительная ротация отрежет утёкший ключ автоматически. Иначе — поставь напоминание раз в 90 дней.

### 2.6 ВАЖНО: API-кредиты

API оплачивается **отдельно** от ChatGPT Plus/Pro/Team. Без кредитов любой запрос → `429 You exceeded your current quota`, даже с валидным ключом и полными правами. **Settings → Billing → Add credits** ($10-20 для старта).

---

## 3. Размещение ключа в Claude Code

Иерархия по приоритету (от лучшего к худшему):

### 3.1 Claude Code Web (`claude.ai/code`) — Secrets

1. Открой проект в web-интерфейсе.
2. **Settings → Environment Variables / Secrets**.
3. Добавь:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-proj-...`
   - **Scope:** project (или user, если хочешь использовать в нескольких репо)
4. Сохрани.

После этого во всех новых сессиях переменная доступна, и SessionStart-хук автоматически залогинит Codex.

### 3.2 Claude Code Desktop / CLI — user-global settings (рекомендуется)

Если работаешь в нескольких репозиториях, удобнее всего положить ключ **один раз** в user-global settings — ключ будет работать во всех проектах.

Файл: `~/.claude/settings.json` (на macOS/Linux) или `%USERPROFILE%\.claude\settings.json` (Windows).

```jsonc
{
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "env": {
        "OPENAI_API_KEY": "sk-proj-..."
    },
    "permissions": {}
    // ... другие секции (permissions, hooks) — оставь существующие.
    // Важно: после "env": {...} ставь запятую, если дальше идут другие секции.
}
```

После правки: `chmod 600 ~/.claude/settings.json` и перезапусти сессии.

### 3.3 Shell rc — env через систему

```bash
# в ~/.zshrc или ~/.bashrc
export OPENAI_API_KEY='sk-proj-...'
```

Либо через менеджер секретов:

```bash
# 1Password CLI
export OPENAI_API_KEY="$(op read 'op://Personal/OpenAI Big Heroes/credential')"
```

Claude Code наследует env из shell, в котором запущен.

### 3.4 Project-local fallback: `.claude/settings.local.json`

Если нужно привязать ключ к **одному** проекту:

```jsonc
// .claude/settings.local.json — НЕ коммитится (в .gitignore)
{
    "env": {
        "OPENAI_API_KEY": "sk-proj-..."
    }
}
```

Файл **должен** быть в `.gitignore` (в этом репо уже добавлен — см. `.gitignore`). В web-сессиях не работает (репо клонируется свежим каждый старт).

### 3.5 ⚠️ Чего делать НЕ надо

**Не клади ключ в `.claude/settings.json`** проекта — он коммитится в git.

```jsonc
// ❌ ОПАСНО — settings.json коммитится
{
    "env": {
        "OPENAI_API_KEY": "sk-proj-..."  // утечёт в историю репо!
    }
}
```

`.claude/settings.json` — shared-файл команды (permissions, хуки). Ключ оттуда попадёт в коммит, в PR, в GitHub-зеркала, в индекс поисковиков. Revoke не отменит репутационную утечку.

> **Приоритет:** Secrets (3.1) > user-global settings.json (3.2) > shell rc (3.3) > settings.local.json (3.4) >>> shared settings.json (❌ никогда).

---

## 4. Проверка работы

В новой сессии Claude Code:

```bash
# 1. Хук отработал при старте?
npx @openai/codex login status
# → Logged in using an API key - sk-proj-***XXXX

# 2. Env var видна?
printenv OPENAI_API_KEY | head -c 15
# → sk-proj-XXXXXXX (первые 15 символов твоего ключа)

# 3. Smoke-тест запроса
echo 'Скажи pong' | npx @openai/codex exec -
```

### Возможные ошибки

| Ошибка | Причина | Лечение |
|---|---|---|
| `printenv` пусто | JSON в settings.json сломан или env-секция не на верхнем уровне | `python3 -m json.tool ~/.claude/settings.json` |
| `401 Unauthorized` | Ключ скопирован неполностью / лишний пробел | Перекопировать целиком из OpenAI Dashboard |
| `403 Forbidden` на конкретной модели | Permissions слишком узкие (не Responses: Write) | Проверь permissions ключа (§2.2) |
| `429 quota exceeded` | На аккаунте нет API-кредитов | OpenAI → Billing → Add credits (§2.6) |
| `model X not found` | Модель не входит в твой tier | Скорректируй модели в `/external-review` SKILL.md |
| `Not logged in` после старта сессии | Хук не сработал — проверь путь `.claude/hooks/codex-login.sh` читаем, в `.claude/settings.json` есть `hooks.SessionStart` с этим путём, в PATH доступны `bash` и `npx` | `bash .claude/hooks/codex-login.sh` вручную; см. логи: `cat ~/.codex/log/*.log` |
| Hook exit 0 + stderr `установлен` / silent, но `/external-review` возвращает `401 Unauthorized` | `codex login --with-api-key` не валидирует ключ при сохранении — hook успешно пишет в `auth.json` любую строку. Реальная невалидность проявляется только на первом API call. Ключ в env либо revoke'нут, либо неполностью скопирован, либо из другого OpenAI project | `npx @openai/codex logout && printenv OPENAI_API_KEY \| head -c 15` — проверь префикс; пересоздай ключ на OpenAI Dashboard; обнови источник (Secrets / settings / shell rc); перезапусти сессию |

---

## 5. Ротация ключа

**Раз в 90 дней (или при подозрении на утечку):**

1. В OpenAI Dashboard создай новый restricted key с теми же permissions (§2.2).
2. Обнови значение `OPENAI_API_KEY` в источнике (Secrets / user-global settings / shell rc).
3. Дождись, пока все открытые сессии перезапустятся (или перезапусти вручную).
4. В OpenAI Dashboard **revoke** старый ключ.
5. Проверь Usage за 24 часа: запросов со старого ключа быть не должно.

---

## 6. Что делать при компрометации ключа

**Признаки:** аномальный расход в OpenAI Usage, email-alert от OpenAI, ключ засветился в git/PR/чате/скриншоте.

### Действия (по срочности):

1. **Немедленно revoke** в OpenAI Dashboard → API keys → Revoke. Доступ отсекается мгновенно.
2. Создай новый ключ (§2.2) и обнови источник (§3).
3. Проверь Usage за 24-72 часа: нетипичные модели, объёмы токенов, время.
4. Если ключ засветился в git:
   - `git rebase -i` НЕ помогает: GitHub/GitLab уже индексируют историю и могут раздать ботам.
   - Ключ скомпрометирован, даже если commit удалён. Обязателен revoke.
   - Проверь `git reflog` и remote mirrors.
5. При подозрении на misuse — напиши в OpenAI Support с указанием key prefix (`sk-proj-***last4`).

### Быстрая проверка, не засветился ли ключ в репо

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
| Только whitelisted модели (если allowlist настроен) | — |
| Ротация каждые 90 дней ограничивает окно злоупотребления | — |
| Алерты при 60% бюджета ловят аномалии | — |

**Итог:** полноценное ревью PR возможно без компромиссов по безопасности.

---

## Связанные файлы

- `.claude/hooks/codex-login.sh` — SessionStart-хук авто-логина
- `.claude/settings.json` — регистрация хука (секция `hooks.SessionStart`)
- `.claude/skills/external-review/SKILL.md` — скилл, использующий Codex CLI
- `.gitignore` — исключение `.claude/settings.local.json`
- `.agents/AGENT_ROLES.md` §3 — формат вердикта Reviewer
- `.agents/PIPELINE.md`, `.agents/AGENTIC_PIPELINE.md` — общая архитектура пайплайна
