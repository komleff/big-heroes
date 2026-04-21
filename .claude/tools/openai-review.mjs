#!/usr/bin/env node
// Native Node.js скрипт внешнего ревью — замена Codex CLI для Mode A (Sprint Pipeline v3.6, Правка 1).
// Вызов: node openai-review.mjs --help | --ping | --model <id> --base <baseRefName>
// Спецификация: docs/plans/sprint-pipeline-v3-6-mode-a-native.md (Правка 1 + Err5).

import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

// Runtime allowlist — ровно две полноразмерные модели, две разные архитектуры (Err5 плана).
// Shape задан под конкретный endpoint, не под общий ключ (см. план, Err5: «не два формата одного поля»).
const ALLOWLIST = [
  {
    model: 'gpt-5.4',
    endpoint: 'chat.completions',
    request_shape: { reasoning_effort: 'high' },
  },
  {
    model: 'gpt-5.3-codex',
    endpoint: 'responses',
    request_shape: { reasoning: { effort: 'high' } },
  },
];

// Коды выхода (описание — см. README, раздел «Диагностика»).
const EXIT_OK = 0;
const EXIT_RUNTIME_ERROR = 1;
const EXIT_ARGS_ERROR = 2;
const EXIT_NOTHING_TO_REVIEW = 3;

// Текст справки (без обращения к сети, выводится по --help).
const USAGE = `Usage: node openai-review.mjs [--help | --ping | --model <id> --base <baseRefName>]

Подкоманды:
  --help                     Показать эту справку и выйти (exit 0).
  --ping                     Проверить валидность $OPENAI_API_KEY через client.models.list().
  --model <id> --base <ref>  Запустить ревью текущего HEAD против origin/<ref>.

Runtime allowlist (ровно две полноразмерные модели):
  gpt-5.4         endpoint=/v1/chat/completions  reasoning_effort=high
  gpt-5.3-codex   endpoint=/v1/responses         reasoning.effort=high

Exit codes:
  0  — OK.
  1  — runtime-ошибка: локальная (нет $OPENAI_API_KEY, git fetch/diff упал, overflow)
       ИЛИ API/сетевая (401/403/429/network). Детали — на stderr.
  2  — ошибка валидации аргументов (или модель вне allowlist).
  3  — нет diff'а относительно base (nothing to review).

Требуется $OPENAI_API_KEY в окружении (кроме --help).
Подробнее: .claude/tools/README.md и docs/plans/sprint-pipeline-v3-6-mode-a-native.md.`;

// Классификация ошибок API по HTTP-статусу для человеко-читаемого сообщения (Правка 5 плана).
function classifyApiError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 401 || status === 403) {
    return 'Невалидный/revoke\'нутый ключ. См. .agents/CODEX_AUTH.md §5 «Ротация ключа».';
  }
  if (status === 429) {
    return 'Rate limit / quota. Подождите, уменьшите частоту запросов, проверьте лимиты в OpenAI Project.';
  }
  // Сетевые ошибки — без HTTP-статуса (ECONNRESET, ENOTFOUND, fetch timeout).
  return 'Проверьте соединение и прокси.';
}

// Безопасная проверка наличия ключа (без логирования значения).
function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '') {
    process.stderr.write('Ошибка: $OPENAI_API_KEY не задан в окружении.\n');
    process.exit(EXIT_RUNTIME_ERROR);
  }
  return key;
}

// Ленивая загрузка SDK — чтобы --help работал без установленного node_modules.
async function loadOpenAI() {
  try {
    const mod = await import('openai');
    return mod.default ?? mod.OpenAI;
  } catch (err) {
    process.stderr.write(
      `Ошибка: не удалось загрузить пакет openai. Выполните: cd .claude/tools && npm install\n${err.message}\n`,
    );
    process.exit(EXIT_RUNTIME_ERROR);
  }
}

// --ping: дешёвый запрос /v1/models для проверки валидности ключа.
async function runPing() {
  requireApiKey();
  const OpenAI = await loadOpenAI();
  const client = new OpenAI();
  try {
    await client.models.list();
    process.stdout.write('OK\n');
    process.exit(EXIT_OK);
  } catch (err) {
    const msg = classifyApiError(err);
    process.stderr.write(`Ping failed: ${msg}\n`);
    process.exit(EXIT_RUNTIME_ERROR);
  }
}

// Валидация имени ref — защита от polluted-ввода в аргументах git.
// Допускаем буквы, цифры, `-`, `_`, `/`, `.` — стандартный набор для git branch names.
function validateBaseRef(baseRef) {
  if (!/^[A-Za-z0-9._/-]+$/.test(baseRef)) {
    process.stderr.write(
      `Ошибка: недопустимое имя base-ветки: ${JSON.stringify(baseRef)}. Допустимы буквы/цифры/./-/_//.\n`,
    );
    process.exit(EXIT_ARGS_ERROR);
  }
}

// Поднимаем maxBuffer: diff крупных PR может существенно превосходить дефолт Node (1MB).
const GIT_OUTPUT_MAX_BUFFER = 16 * 1024 * 1024;

// Обёртка вокруг git — execFileSync без shell (массив аргументов, не интерполяция в строку).
function runGit(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: GIT_OUTPUT_MAX_BUFFER,
    });
  } catch (err) {
    if (err?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || err?.code === 'ENOBUFS') {
      throw new Error(
        `git ${args.join(' ')} вернул слишком большой вывод: превышен лимит ${GIT_OUTPUT_MAX_BUFFER} байт. ` +
          'Увеличьте maxBuffer или уменьшите размер diff для ревью.',
      );
    }
    throw err;
  }
}

// Безопасный quiet-diff: игнорируем exit=1 (есть diff), пробрасываем остальное.
function hasDiff(baseRef) {
  try {
    execFileSync('git', ['diff', '--quiet', `origin/${baseRef}...HEAD`], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return false; // exit 0 — изменений нет.
  } catch (err) {
    if (err.status === 1) return true; // exit 1 — diff есть.
    throw err; // exit >=2 — реальная git-ошибка.
  }
}

// System prompt для обеих моделей — единый формат ответа с 4 аспектами + enum вердикта.
function buildSystemPrompt() {
  return [
    'Ты — внешний Reviewer кросс-модельного ревью. Проверь diff по четырём аспектам:',
    '1. Архитектура — слои, чистота shared-пакета, разделение ответственности.',
    '2. Безопасность — XSS, утечки, OWASP, небезопасные вызовы.',
    '3. Качество — тесты, edge-cases, производительность, Verification Contract.',
    '4. Гигиена кода — мёртвый код, дубликаты, захардкоженные константы.',
    '',
    'Формат ответа (строго, markdown):',
    '',
    '## Вердикт: <APPROVED | CHANGES_REQUESTED | ESCALATION>',
    '',
    '### Архитектура: <OK | ISSUE>',
    '<обоснование>',
    '',
    '### Безопасность: <OK | ISSUE>',
    '<обоснование>',
    '',
    '### Качество: <OK | ISSUE>',
    '<обоснование>',
    '',
    '### Гигиена кода: <OK | ISSUE>',
    '<обоснование>',
    '',
    '### Итого',
    '<краткое резюме для оператора>',
    '',
    'Вердикт ESCALATION используется, когда ты не можешь вынести однозначное решение и требуется оператор.',
  ].join('\n');
}

// User prompt — сам diff с минимальной обёрткой.
function buildUserPrompt(diff, baseRef) {
  return `Diff текущего HEAD относительно origin/${baseRef}:\n\n\`\`\`diff\n${diff}\n\`\`\``;
}

// Извлечение текста из ответа Chat Completions.
function extractChatText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  // Некоторые модели возвращают массив content parts — склеиваем текстовые части.
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('');
  }
  return '';
}

// Извлечение текста из ответа Responses API.
function extractResponsesText(response) {
  // Новый SDK: response.output_text — готовая склейка всех текстовых outputs.
  if (typeof response?.output_text === 'string' && response.output_text.length > 0) {
    return response.output_text;
  }
  // Fallback: ручная склейка output[].content[].text.
  const output = response?.output;
  if (!Array.isArray(output)) return '';
  const chunks = [];
  for (const item of output) {
    const contentArr = item?.content;
    if (!Array.isArray(contentArr)) continue;
    for (const part of contentArr) {
      if (typeof part?.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('');
}

// Поиск модели в allowlist — при промахе: exit 2 + подсказка.
function resolveAllowlistEntry(modelId) {
  const entry = ALLOWLIST.find((m) => m.model === modelId);
  if (entry) return entry;
  const allowed = ALLOWLIST.map((m) => `${m.model} (${m.endpoint})`).join(', ');
  process.stderr.write(
    `Ошибка: модель ${JSON.stringify(modelId)} вне allowlist.\n` +
      `Разрешены: ${allowed}.\n` +
      'См. справочные таблицы Err5 в docs/plans/sprint-pipeline-v3-6-mode-a-native.md.\n',
  );
  process.exit(EXIT_ARGS_ERROR);
}

// Основной флоу --model.
async function runReview(modelId, baseRef) {
  validateBaseRef(baseRef);
  const entry = resolveAllowlistEntry(modelId);
  requireApiKey();

  // Шаг 1: явный refspec-fetch (см. E4 плана — простая форма не обновляет refs/remotes/origin/<ref>).
  try {
    runGit(['fetch', 'origin', `+refs/heads/${baseRef}:refs/remotes/origin/${baseRef}`]);
  } catch (err) {
    process.stderr.write(`Ошибка git fetch: ${err.message}\n`);
    process.exit(EXIT_RUNTIME_ERROR);
  }

  // Шаг 2: проверка наличия diff'а — пустой diff не отправляем в API.
  if (!hasDiff(baseRef)) {
    process.stdout.write('nothing to review\n');
    process.exit(EXIT_NOTHING_TO_REVIEW);
  }

  // Шаг 3: получить сам diff.
  // Принудительно выключаем цвет и внешние diff-драйверы — prompt не должен зависеть
  // от пользовательского git config (color.ui=always, diff.external=...).
  let diff;
  try {
    diff = runGit([
      '-c',
      'diff.external=',
      'diff',
      '--no-color',
      '--no-ext-diff',
      `origin/${baseRef}...HEAD`,
    ]);
  } catch (err) {
    process.stderr.write(`Ошибка git diff: ${err.message}\n`);
    process.exit(EXIT_RUNTIME_ERROR);
  }

  // Шаг 4: построить prompts.
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(diff, baseRef);

  // Шаг 5: диспатч по endpoint — строго по allowlist-metadata, без унификации ключей.
  const OpenAI = await loadOpenAI();
  const client = new OpenAI();

  try {
    let text;
    if (entry.endpoint === 'chat.completions') {
      const response = await client.chat.completions.create({
        model: entry.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        // Согласованный лимит с responses endpoint (4000 tokens) — защита от длинных
        // ответов и нестабильности при превышении серверных лимитов.
        max_completion_tokens: 4000,
        ...entry.request_shape,
      });
      text = extractChatText(response);
    } else if (entry.endpoint === 'responses') {
      // Responses API принимает единый input; склеиваем system + user разделителем.
      const response = await client.responses.create({
        model: entry.model,
        input: `${systemPrompt}\n\n---\n\n${userPrompt}`,
        max_output_tokens: 4000,
        ...entry.request_shape,
      });
      text = extractResponsesText(response);
    } else {
      // Гарантия неразрывности allowlist и диспатчера — изменение одного требует изменения другого.
      process.stderr.write(`Ошибка: неизвестный endpoint в allowlist: ${entry.endpoint}\n`);
      process.exit(EXIT_ARGS_ERROR);
    }

    if (!text || text.trim() === '') {
      process.stderr.write('Ошибка: пустой ответ от модели.\n');
      process.exit(EXIT_RUNTIME_ERROR);
    }

    process.stdout.write(text);
    if (!text.endsWith('\n')) process.stdout.write('\n');
    process.exit(EXIT_OK);
  } catch (err) {
    const msg = classifyApiError(err);
    process.stderr.write(`Ошибка API: ${msg}\n${err.message ?? err}\n`);
    process.exit(EXIT_RUNTIME_ERROR);
  }
}

// Точка входа — разбор аргументов.
async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        help: { type: 'boolean', default: false },
        ping: { type: 'boolean', default: false },
        model: { type: 'string' },
        base: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    process.stderr.write(`Ошибка аргументов: ${err.message}\n\n${USAGE}\n`);
    process.exit(EXIT_ARGS_ERROR);
  }

  const { values } = parsed;

  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(EXIT_OK);
  }

  if (values.ping) {
    await runPing();
    return;
  }

  // Без аргументов — показать usage (exit 2, чтобы автоматизация заметила отсутствие команды).
  if (!values.model && !values.base) {
    process.stderr.write(`Укажите подкоманду.\n\n${USAGE}\n`);
    process.exit(EXIT_ARGS_ERROR);
  }

  if (!values.model) {
    process.stderr.write(`Ошибка: не указан --model.\n\n${USAGE}\n`);
    process.exit(EXIT_ARGS_ERROR);
  }

  if (!values.base) {
    process.stderr.write(`Ошибка: не указан --base.\n\n${USAGE}\n`);
    process.exit(EXIT_ARGS_ERROR);
  }

  await runReview(values.model, values.base);
}

main().catch((err) => {
  process.stderr.write(`Непредвиденная ошибка: ${err?.stack ?? err}\n`);
  process.exit(EXIT_RUNTIME_ERROR);
});
