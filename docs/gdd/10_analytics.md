# 10 — Метрики и аналитика

> Ссылки: [01_core_loop](01_core_loop.md) · [08_monetization](08_monetization.md) · [12_roadmap](12_roadmap.md)

---

## KPI-гейты MVP

Пороговые значения, при которых MVP считается прошедшим валидацию и можно масштабировать UA.

### Retention

| Метрика | Цель | Порог «не пройден» | Индустриальный бенчмарк |
|---------|------|---------------------|------------------------|
| D1 | ≥ 30% | < 25% | ~27% (среднее игровых приложений, Adjust 2024) |
| D7 | ≥ 6% | < 4% | Median ~3.4–3.9%, top quartile ~7–8% |
| D30 | ≥ 2.5% | < 1.5% | У 75% проектов D28 < 3% |

### Core-loop conversion

| Метрика | Цель | Порог | Как измерять |
|---------|------|-------|-------------|
| FTUE completion | ≥ 50% | < 40% | install → завершение tutorial_complete |
| 1-й PvE-run completion | ≥ 60% | < 45% | tutorial_complete → first_pve_boss_defeated OR first_pve_defeat |
| PvE → PvP conversion (48 ч) | ≥ 35% | < 25% | Доля игроков, сделавших хотя бы 1 PvP-бой в первые 48 часов |
| Full cycle completion | ≥ 25% | < 15% | Доля игроков, замкнувших PvE → PvP → получение сундук-награды |

### Сессии

| Метрика | Цель |
|---------|------|
| Сессий в день (среднее) | 4–6 |
| Время сессии (среднее) | 5–10 мин |
| Полных циклов в день (активный игрок) | 2–4 |

### Монетизация

| Метрика | Цель MVP | Порог |
|---------|----------|-------|
| Payer conversion D7 | ≥ 2% | < 1% |
| ARPDAU (IAP + IAA) | Измерить, baseline | — |
| Доля rewarded-users (DAU) | 20–30% | < 10% |
| Средние rewarded / DAU / день | 2–4 | < 1 |

### Экономика

| Метрика | Цель |
|---------|------|
| Net Gold balance / день | Положительный при 4+ сессиях; ремонт не должен блокировать прогресс |
| Durability как sink | Прочность заканчивается через 4–8 PvP-боёв (не раньше, не позже) |
| Mass net growth / день | Положительный при winrate ≥ 60% в PvP |
| Backpack fill rate (среднее) | 70–90% к концу PvE-похода |

---

## События аналитики (event taxonomy)

### Прогрессия

| Событие | Параметры | Когда |
|---------|-----------|-------|
| tutorial_start | — | Начало FTUE |
| tutorial_complete | time_sec | Завершение FTUE |
| pve_run_start | chapter_id, equipment_ids, belt_items, mass, gold | Вход в PvE-поход |
| relic_chosen | relic_id, alternatives, node_type (sanctuary/ancient_chest/elite/boss) | Выбор реликвии |
| pve_node_enter | node_type, node_index | Вход в узел |
| pve_fork_choice | fork_index, chosen_node_type, alternatives | Выбор на развилке |
| scout_used | consumable_id, node_index | Использование разведывательного расходника |
| pve_battle_command | command_id, consumable_used, enemy_type, enemy_mass | Выбор команды перед боем PvE |
| pve_battle_result | node_type, result (win/lose/draw), command_id, mass_after | Результат боя PvE |
| pve_loot_decision | item_id, action (take/drop/sell), backpack_slots_used | Решение по луту |
| pve_run_end | result (boss_win/defeat/retreat), mass_gained, gold_gained, items_count, relics_count, duration_sec | Конец похода |
| booster_activated | booster_id, context (pve/pvp) | Активация мета-бустера в хабе |
| pvp_session_start | rating, mass, equipment_durabilities | Вход на арену |
| pvp_battle_command | command_id, consumable_used, bot_mass, bot_rating | Выбор команды перед боем PvP |
| pvp_battle_result | result, rating_change, mass_change, command_id | Результат боя PvP |
| pvp_session_end | reason (voluntary/mass/durability), fights_count, rating_change_total, chest_progress | Конец сессии |
| pvp_snapshot_saved | mass, equipment_durabilities, rating | Обновление оффлайн-снапшота (после победы) |
| chest_open | rewards_list, chest_progress_total | Открытие аренного сундука |
| chapter_complete | chapter_id, attempts_count | Первое прохождение главы |
| league_reached | league_id, rating | Достижение новой лиги |
| account_level_up | new_level, feature_unlocked | Повышение уровня аккаунта |
| hero_level_up | hero_id, new_level, passive_rank | Повышение уровня героя |

### Экономика

| Событие | Параметры |
|---------|-----------|
| gold_earn | source (combat/elite/boss/chest/sell/chest_reward), amount |
| gold_spend | sink (repair/shop/booster), amount, item_id |
| gems_earn | source (iap/achievement/chest_reward), amount |
| gems_spend | sink (backpack_expand/ticket_buy), amount |
| repair_action | item_id, cost, discount (ad/none), durability_restored |
| item_equip | item_id, slot, previous_item_id |
| item_sell | item_id, gold_received |

### Монетизация

| Событие | Параметры |
|---------|-----------|
| iap_purchase | sku, price_usd, gems_received, gold_received |
| ad_impression | format (rewarded/interstitial), placement, ecpm |
| ad_click | format, placement |
| ad_reward_claimed | placement, reward_type, reward_amount |

### Системные

| Событие | Параметры |
|---------|-----------|
| session_start | — |
| session_end | duration_sec |
| save_load | has_save (bool) |
| dev_panel_action | action, params (только dev-сборка) |

---

## A/B-тесты (планируемые)

### MVP (месяц 1–3)

| Тест | Варианты | Метрика успеха |
|------|----------|---------------|
| FTUE длина | 3 шага vs 5 шагов | FTUE completion rate |
| Потеря лута при поражении | Без потери vs частичная vs полная | D1, D7, NPS |
| Потеря массы в PvP | 5% vs 10% vs 15% | PvP session length, return to PvE rate |
| Блок-выравниватель | block_power 0.3 vs 0.45 vs 0.6 | Использование блока, winrate |
| Rewarded placement | Поражение PvE vs ремонт vs оба | Rewarded adoption, D7 |
| Реликвии: выбор vs случайная | Выбор 1 из 3 vs случайная | Удовлетворённость, D7 |

### Post-MVP (месяц 4–6)

| Тест | Варианты | Метрика успеха |
|------|----------|---------------|
| VIP цена | $4.99 vs $9.99 | Conversion rate × ARPU |
| Season Pass структура | 20 уровней vs 30 уровней | Completion rate, spend |
| Стартовый бандл цена | $0.99 vs $1.99 vs $2.99 | Conversion rate |

---

## Дашборды

### Операционный (ежедневный)

- DAU / WAU / MAU.
- D1, D7, D30 retention (когортные графики).
- Сессий / DAU.
- ARPDAU (IAP + IAA).
- Core-loop conversion (funnel).
- Топ-5 точек churn.

### Экономический (еженедельный)

- Gold: средний earn / spend / net per DAU.
- Gems: средний earn / spend per DAU.
- Durability: средний PvP-боёв до полного износа.
- Mass: средний net growth per DAU.
- Repair frequency и средний repair_cost.

### Монетизация (еженедельный)

- Payer conversion (D1, D7, D30).
- ARPMAU (IAP), ARPMAU (IAA), ARPMAU (total).
- SKU breakdown (какие пакеты покупают).
- Rewarded ad adoption rate.
- LTV прогноз по когортам.
