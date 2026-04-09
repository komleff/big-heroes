/** Человекочитаемое описание эффекта реликвии */
export function getEffectDescription(effect: string, value: number): string {
    switch (effect) {
        case 'strength_bonus': return `+${value} к силе`;
        case 'armor_bonus': return `+${value} к броне`;
        case 'luck_bonus': return `+${value} к удаче`;
        case 'gold_bonus': return `+${Math.round(value * 100)}% золота`;
        case 'mass_bonus': return `+${Math.round(value * 100)}% массы`;
        case 'extra_loot': return `+${value} предмет из сундуков`;
        case 'mass_on_win': return `+${Math.round(value * 100)}% массы за победу`;
        case 'first_strike': return `+${Math.round(value * 100)}% урона первого удара`;
        case 'thorns': return `${Math.round(value * 100)}% отражённого урона`;
        case 'enemy_strength_reduction': return `−${Math.round(value * 100)}% силы врага`;
        case 'boss_armor': return `+${value} брони vs босс`;
        case 'reveal_all': return 'Все «???» раскрыты';
        case 'safe_retreat': return 'Отступление всегда 100%';
        case 'safe_bypass': return 'Обход всегда 100%';
        case 'extra_backpack': return `+${value} слота рюкзака`;
        case 'no_durability': return 'Нет износа снаряжения';
        case 'camp_repair_bonus': return `+${value} к ремонту в лагере`;
        case 'shop_discount': return `−${Math.round(value * 100)}% в магазине`;
        case 'polymorph_bonus': return `+${Math.round(value * 100)}% полиморфа`;
        default: return effect;
    }
}
