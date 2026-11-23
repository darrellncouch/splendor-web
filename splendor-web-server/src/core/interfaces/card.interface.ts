import { CardTier } from "../types/card-tier.type";
import { BasicGemColor } from "../types/gem-color.type";
import { IResource } from "./resource.interface";

export interface ICard {
    id: number;
    tier: CardTier;
    prestige: number;
    bonus: BasicGemColor;
    cost: Array<IResource>;
}
