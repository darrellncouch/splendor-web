import { CardTier } from "../types/card-tier.type";
import { IBonus } from "./bonus.interface";
import { ICard } from "./card.interface";
import { INoble } from "./noble.interface";
import { IResource } from "./resource.interface";

/** A player as everyone sees them: the host board and the other-player tabs. Reserved cards are face down. */
export interface IPlayer {
    id: string;
    name: string;
    connected: boolean;
    isVip: boolean;
    /** 0-based seat in turn order. */
    seat: number;
    isCurrentTurn: boolean;
    prestige: number;
    gems: Array<IResource>;
    gemTotal: number;
    bonuses: Array<IBonus>;
    purchasedCount: number;
    /** Face down: only the tier is shown so the client can draw the right card back. */
    reserved: Array<{ tier: CardTier }>;
    nobles: Array<INoble>;
}

export interface IReservedCardView extends ICard {
    fromDeck: boolean;
}

/** A player's own "self" tab. Same as IPlayer, but reserved cards are face up. */
export interface ISelfPlayer extends Omit<IPlayer, 'reserved'> {
    reserved: Array<IReservedCardView>;
}
