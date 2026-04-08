# Sprint 3.1 — Финальный раунд фиксов

## Модель PvE-похода (финальная)

Два понятия:

- **Развилка** — экран выбора следующей точки интереса. 1-3 варианта.
  - 1 вариант: Святилище (шаг 1), Древний сундук (шаг 6), Босс (шаг 12)
  - 2-3 варианта: все остальные шаги
- **Точка интереса** — само место: Бой, Элитный бой, Босс, Сундук, Древний сундук, Святилище, Магазин, Лагерь, Событие, ???

**Flow:** Развилка → выбор → сразу в точку интереса (без экрана "ВОЙТИ"/"ВСТУПИТЬ"). После точки интереса → следующая развилка.

**Нумерация для игрока:** 1-12 (не 0-11). displayStep = currentNodeIndex + 1.

## Антипаттерны (НЕ ДЕЛАТЬ)

- Экран "ВОЙТИ" или "ВСТУПИТЬ В БОЙ" после выбора на развилке
- Двойной экран поражения (пустой + с результатами)
- Возврат на предыдущую развилку (исключение: команда "Отход" в бою — retreat по GDD)
- Линейное продвижение без выбора (кроме фиксированных узлов с 1 вариантом)
- Запись типа фиксированного узла в другой nodes[idx] → дубликат
- goto('pveMap') в handleForkChoice → промежуточный экран
- Дублирование одинаковых точек интереса на одной развилке (два магазина, два лагеря, два сундука). Бой + Элитный бой — допустимо.

## Задачи

### 1. PveMapScene — единый экран развилки

**Файл:** `client/src/scenes/PveMapScene.ts`

onEnter показывает ТОЛЬКО развилку:
- Заголовок "ПОХОД", "Шаг N/12"
- Ресурсы (массса, золото)
- "Выберите путь:" + 1-3 кнопки

ensureForkPaths:
- Если nodes[nextIdx] фиксированный (boss/ancient_chest/sanctuary) → вернуть единственный путь с его типом
- Иначе → сгенерировать 2-3 варианта как сейчас
- НЕ писать фиксированный тип в nodes[currentIdx]

handleForkChoice:
- Для фиксированных типов (boss/ancient_chest/sanctuary): НЕ обновлять nodes. Просто вызвать enterNode(nodes[nextIdx]) напрямую — узел на nextIdx уже имеет правильный тип
- Для обычных типов: обновить nodes[nextIdx].type, вызвать enterNode(nodes[nextIdx])
- НИКОГДА goto('pveMap')

enterNode:
- advanceToNode(nextIdx) → idx = nextIdx, visitedNodes += nextIdx
- Маршрутизация по типу → сцена

advanceToNextNode:
- idx = currentNodeIndex + 1
- Victory check (idx >= totalNodes)
- goto pveMap

**Нумерация:** displayStep = currentNodeIndex + 1. При таком flow: sanctuary idx=0 step=1, развилка idx=1 step=2, ... boss idx=11 step=12.

Но: handleForkChoice вызывает enterNode(nodes[nextIdx]), advanceToNode ставит idx=nextIdx. Потом advanceToNextNode ставит idx=nextIdx+1. Итого: от idx=N карта → idx=N+2 карта. Шаги: 1, 3, 5... Пропуски!

**Решение:** handleForkChoice НЕ вызывает enterNode. Вместо этого: обновляет тип узла, ставит currentNodeIndex = nextIdx, и enterNode(nodes[nextIdx]) БЕЗ advanceToNextNode внутри сцены. Нет — сцены (shop/camp/event) вызывают advanceToNextNode через callback.

**Правильное решение:** Убрать advanceToNextNode из сцен. enterNode(nextIdx) → advanceToNode(nextIdx) → сцена. Сцена → callback → goto pveMap (не advanceToNextNode). Карта показывает idx=nextIdx, ensureForkPaths генерирует варианты из nodes[nextIdx+1]. handleForkChoice → enterNode(nextIdx+1). И так далее.

Flow: карта(0) → sanctuary ВОЙТИ* → enterNode(0) → sanctuary scene → callback → goto pveMap → карта(0) → ensureForkPaths(nodes[1]) → выбор → handleForkChoice → enterNode(1) → shop → callback → goto pveMap → карта(1) → ensureForkPaths(nodes[2]) → ...

*Святилище = единственный вариант на развилке, кнопка "Святилище"

displayStep = currentNodeIndex + 1. idx 0→0→0→1→1→2→... Нет, advanceToNode ставит idx на целевой. Карта всегда на том же idx после callback.

Wait — карта(0) показывает развилку с 1 вариантом "Святилище". Игрок нажимает → handleForkChoice → enterNode(nodes[1])? Нет, sanctuary на idx=0. ensureForkPaths на idx=0 смотрит nodes[1]... Нет, sanctuary — фиксированный, карта показывает его как единственный вариант.

Стоп. Святилище на idx=0. Карта на idx=0. isFixed → показать кнопку "Святилище". Но мы решили убрать отдельные экраны для фиксированных! Всё — развилки. Значит карта на idx=0: ensureForkPaths → sanctuary единственный вариант → 1 кнопка "Святилище". Нажатие → handleForkChoice → enterNode.

Какой enterNode? nodes[0] = sanctuary. handleForkChoice для фиксированного: enterNode(nodes[0]).

enterNode(0) → advanceToNode(0) → idx=0. Святилище → callback → advanceToNextNode? Нет, **goto pveMap** (без инкремента).

Карта на idx=0. Снова! Бесконечный цикл.

**Решение: advanceToNextNode ДОЛЖЕН инкрементировать. Но enterNode через advanceToNode устанавливает idx на тот же узел.**

Правильно: enterNode → сцена → advanceToNextNode (инкремент +1) → goto pveMap.

Flow: карта(0) → [Святилище] → handleForkChoice → enterNode(0) → advanceToNode(0) → sanctuary → callback → advanceToNextNode → idx=1 → goto pveMap → карта(1) → [2-3 варианта] → handleForkChoice → enterNode(nodes[1]) → advanceToNode(1) → shop → advanceToNextNode → idx=2 → карта(2) → ...

displayStep: 1, 2, 3, 4... → idx+1 ✓ Все индексы последовательно ✓

Boss: карта(10) → [Босс] → handleForkChoice → enterNode(10)??? Нет, boss на idx=11. ensureForkPaths на idx=10: nodes[11]=boss → единственный вариант. handleForkChoice → enterNode(nodes[11])? Или enterNode(nodes[10])?

**Вот ключевой вопрос:** handleForkChoice записывает тип в currentIdx и enterNode(currentIdx)? Или enterNode(nextIdx)?

Если enterNode(currentIdx=10): advanceToNode(10) → sanctuary/shop/whatever на idx=10. advanceToNextNode → idx=11. Карта(11): nodes[11]=boss → единственный вариант "Босс". handleForkChoice → enterNode(11) → advanceToNode(11) → boss battle. advanceToNextNode (из BattleScene) → idx=12 >= 12 → victory.

Steps: 1,2,3,...,11 (развилка с "Босс"),12(нет — бой уже на 11). displayStep на карте(10)=11, handleForkChoice → enterNode(10) → бой (не босс!) → advanceToNextNode → idx=11 → карта(11) = "Босс" step=12 → enterNode(11) → босс-бой → victory.

Это 12 шагов, boss на step=12 ✓. Ancient_chest на idx=5: карта(4) step=5 → варианты из nodes[5]=ancient_chest → единственный вариант. handleForkChoice записывает ancient_chest в nodes[4]? Нет, для фиксированных не записываем! enterNode(4) не должен быть ancient_chest.

**РЕШЕНИЕ (окончательное, чёткое):**

handleForkChoice:
1. Для ОБЫЧНЫХ типов: записать тип в nodes[currentIdx], enterNode(currentIdx)
2. Для ФИКСИРОВАННЫХ типов: НЕ записывать. Вместо: advanceToNextNode → idx+1 → goto pveMap. Карта на idx+1 = фиксированный узел → ensureForkPaths → 1 вариант → тот же фиксированный → handleForkChoice снова...

Бесконечный цикл для фиксированных! Потому что ensureForkPaths видит nodes[nextIdx] = фиксированный → единственный вариант → handleForkChoice → advanceToNextNode → idx на фиксированном → ensureForkPaths видит nodes[nextIdx+1]...

Нет! Карта на idx фиксированного. ensureForkPaths: nodes[idx+1] = обычный → 2-3 варианта. Это уже не единственный вариант!

**Финальный чёткий flow для фиксированных:**

Карта(4) step=5. ensureForkPaths: nodes[5]=ancient_chest → единственный вариант "Древний сундук". handleForkChoice('ancient_chest'): isFixed → advanceToNextNode → idx=5. goto pveMap.

Карта(5) step=6. ensureForkPaths: nodes[6] — обычный → 2-3 варианта. Но карта(5) = ancient_chest! onEnter видит currentNode.type=ancient_chest. Это развилка? Нет — ensureForkPaths показывает варианты для nodes[6], не для nodes[5]. Но экран развилки показывает "Шаг 6/12" и "Выберите путь: бой, магазин, лагерь". Игрок не входил в древний сундук!

**Надо входить в фиксированный.** handleForkChoice для фиксированных → enterNode напрямую. Но тогда enterNode(nodes[5]) — advanceToNode(5) — idx=5 — handleChest — advanceToNextNode → idx=6. displayStep: 5→6→7. Шаг 6 = древний сундук ✓.

Но карта(4) показывала step=5. Потом handleForkChoice → enterNode(5) → idx=5 → сцена → advanceToNextNode → idx=6 → карта(6) step=7. Шаг 6 пропущен на карте? Нет — шаг 6 = древний сундук (точка интереса, не карта).

Пользователь видит: карта step=5 → [Древний сундук] → нажал → сцена древнего сундука (это и есть step=6) → карта step=7.

displayStep на карте = 5. Потом карта = 7. Шаг 6 — это сцена внутри. Но пользователь привык что displayStep на карте = номер шага. Шаг 6 не показан на карте → путаница.

**Окончательное решение: displayStep для развилки перед фиксированным = номер фиксированного.**

Карта(4) step=5 → варианты [Бой, Магазин] (обычные) или [Древний сундук] (единственный). Если единственный фиксированный → displayStep = nextIdx + 1 = 6.

Слишком сложно. Упрощаю радикально.

**РАДИКАЛЬНО ПРОСТОЕ РЕШЕНИЕ:**

handleForkChoice ВСЕГДА: enterNode(nodes[nextIdx]). advanceToNode(nextIdx). displayStep = visitedNodes.length + 1.

Каждый enterNode добавляет в visitedNodes. Fork-узлы (развилки) — это ТОЛЬКО экраны карты, они НЕ в visitedNodes. Точки интереса — в visitedNodes.

Flow: карта → выбор → enterNode(nextIdx) → visited += nextIdx → сцена → advanceToNextNode (без инкремента, просто goto pveMap) → карта.

Карта(idx=afterScene). enterNode поставил idx = nextIdx. advanceToNextNode НЕ инкрементирует, просто goto pveMap. Карта на том же idx. ensureForkPaths: nodes[idx+1]. Новая развилка.

Но карта показывает тот же idx! alreadyVisited check в enterNode: idx в visitedNodes → advanceToNextNode → бесконечный цикл.

enterNode НЕ вызывается из карты — handleForkChoice вызывает enterNode(nextIdx), где nextIdx = currentIdx + 1. advanceToNode(nextIdx) → idx = nextIdx. Сцена. advanceToNextNode → просто goto pveMap. Карта(idx = nextIdx). ensureForkPaths: nodes[nextIdx + 1]. Новая развилка. handleForkChoice → enterNode(nextIdx + 1). И так далее.

displayStep = visitedNodes.length + 1:
- visited=[] → step=1 (sanctuary). enterNode(1) → visited=[1]? Нет, sanctuary на idx=0!

Стоп. handleForkChoice вызывает enterNode(nodes[nextIdx]). nextIdx = currentIdx + 1. Начало: idx=0. Карта(0). ensureForkPaths: nodes[1]. Для idx=0, sanctuary ещё не посещён. Карта показывает развилку для nodes[1]? Но sanctuary на idx=0 ещё не пройден!

**Проблема:** Sanctuary на idx=0 — первый узел. Карта стартует с idx=0. ensureForkPaths смотрит nodes[0+1=1]. Sanctuary НЕ показывается!

Нужно сначала войти в sanctuary. handleForkChoice НЕ подходит — sanctuary единственный вариант. Карта должна показать кнопку "Святилище" и enterNode(0).

OK. Я слишком усложнил. Пишу **простейший** план:

---

**PveMapScene.onEnter:**
1. Прочитать currentNode
2. Показать ensureForkPaths(currentNode) как кнопки
3. При нажатии → handleForkChoice

**ensureForkPaths:**
- Всегда возвращает список вариантов (1-3)
- Если currentNode = фиксированный → [{currentNode.type}] (единственный вариант — сам текущий узел)
- Иначе → сгенерировать 2-3 случайных варианта

**handleForkChoice:**
- Записать выбранный тип в nodes[currentIdx]
- enterNode(currentIdx)

**enterNode:**
- advanceToNode(currentIdx) → visited += currentIdx, idx = currentIdx
- Маршрутизация → сцена

**advanceToNextNode (из сцен):**
- idx = currentIdx + 1
- if idx >= total → victory
- goto pveMap

**displayStep = currentNodeIndex + 1**

Flow: карта(0) → [Святилище] → handleForkChoice → nodes[0] уже sanctuary → enterNode(0) → sanctuary → advanceToNextNode → idx=1 → карта(1) → [варианты] → handleForkChoice → nodes[1].type = shop → enterNode(1) → shop → advanceToNextNode → idx=2 → карта(2)...

Steps: 1,2,3,...12. Все последовательно ✓

Ancient_chest на idx=5. Карта(5): ensureForkPaths → currentNode=nodes[5]=ancient_chest → фиксированный → [{ancient_chest}]. Step=6. handleForkChoice → nodes[5] уже ancient_chest → enterNode(5) → handleChest → advanceToNextNode → idx=6 → карта(6) step=7 ✓

Boss на idx=11. Карта(11): ensureForkPaths → currentNode=nodes[11]=boss → [{boss}]. Step=12. handleForkChoice → enterNode(11) → preBattle → battle → BattleScene.onContinue → nextIdx=12 >= 12 → victory ✓

**Дубликат?** Нет! handleForkChoice записывает тип в nodes[currentIdx], но для фиксированных nodes[currentIdx] УЖЕ имеет правильный тип. Запись идемпотентна.

**Проблема с ensureForkPaths:** сейчас она смотрит nodes[nextIdx], а нужно смотреть currentNode.

ВСЁ. Это окончательное решение. ensureForkPaths проверяет ТЕКУЩИЙ узел, а не следующий.
