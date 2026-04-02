// Типизация config/balance.json
export interface IBalanceConfig {
    hero: {
        startMass: number;
        startRating: number;
        startHp: number;
        baseAttack: number;
        baseDefense: number;
    };
    resources: {
        startGold: number;
        maxCampaignTickets: number;
        startCampaignTickets: number;
        maxArenaTickets: number;
        startArenaTickets: number;
    };
    equipment: {
        starterItems: Array<{
            id: string;
            name: string;
            slot: string;
            tier: number;
            modifier: number;
            maxDurability: number;
            basePrice: number;
        }>;
    };
}
