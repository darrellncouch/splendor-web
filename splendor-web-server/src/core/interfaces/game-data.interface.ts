import { ICard } from "./card.interface";
import { INoble } from "./noble.interface";

/** The static card and noble data loaded from /data at startup. */
export interface IGameData {
    cards: ReadonlyArray<ICard>;
    nobles: ReadonlyArray<INoble>;
}
