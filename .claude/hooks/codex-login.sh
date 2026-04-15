#!/usr/bin/env bash
# SessionStart hook: автоматический логин Codex CLI из $OPENAI_API_KEY.
#
# Идемпотентен: ничего не делает, если уже залогинен.
# Не валит сессию: при отсутствии ключа или сбое выдаёт предупреждение и выходит 0.
# Не светит ключ: передача через stdin (--with-api-key), без argv.

set -u

# Если npx недоступен — Codex CLI не поставить, молча выходим.
command -v npx >/dev/null 2>&1 || exit 0

# Если уже залогинены — выходим без шума.
# Codex пишет статус в stderr, поэтому сливаем stderr→stdout перед grep.
if npx --no-install @openai/codex login status 2>&1 | grep -q "Logged in"; then
  exit 0
fi

# Ключа нет — предупреждение, но не ошибка (для работ без внешнего ревью).
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "[codex-login] OPENAI_API_KEY не установлен — /external-review работать не будет." >&2
  echo "[codex-login] Добавь ключ в Claude Code Secrets (см. docs/setup/codex-auth.md)." >&2
  exit 0
fi

# Логинимся через stdin; вывод команды подавляем, чтобы не засорять старт сессии.
if printenv OPENAI_API_KEY | npx @openai/codex login --with-api-key >/dev/null 2>&1; then
  chmod 600 "${HOME}/.codex/auth.json" 2>/dev/null || true
  echo "[codex-login] Codex CLI: API key загружен."
else
  echo "[codex-login] Не удалось залогинить Codex CLI. Проверь валидность OPENAI_API_KEY." >&2
fi

exit 0
