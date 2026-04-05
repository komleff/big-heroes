// Тип моба
export type MobType = 'combat' | 'elite' | 'boss';

// Моб (враг в PvE)
export interface IMob {
    id: string;
    name: string;
    type: MobType;
    mass: number;           // масса = HP
    strength: number;
    armor: number;
    massReward: number;
    goldReward: number;
}
