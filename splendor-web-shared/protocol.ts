/*
 * Client-side copy of the server's wire types (splendor-web-server/src/core/interfaces and src/hub/protocol.ts).
 * If you change a shape on the server, change it here too.
 */

export type GemColor = 'gold' | 'white' | 'black' | 'blue' | 'green' | 'red';
export type BasicGemColor = Exclude<GemColor, 'gold'>;
export type CardTier = 1 | 2 | 3;
export type GamePhase = 'lobby' | 'playing' | 'finished';

export interface IResource { id: GemColor; count: number; }
export interface IBonus { id: GemColor; quantity: number; }

export interface ICard {
  id: number;
  tier: CardTier;
  prestige: number;
  bonus: BasicGemColor;
  cost: IResource[];
}

export interface INoble {
  id: number;
  prestige: number;
  cost: IResource[];
  imgUrl: string;
}

export interface IDeck {
  tier: CardTier;
  remaining: number;
  cards: Array<ICard | null>;
}

export interface ILogEntry { id: number; at: string; message: string; }

export type IPendingDecision =
  | { type: 'discard'; playerId: string; count: number }
  | { type: 'chooseNoble'; playerId: string; nobleIds: number[] };

export interface IPlayer {
  id: string;
  name: string;
  connected: boolean;
  isVip: boolean;
  seat: number;
  isCurrentTurn: boolean;
  prestige: number;
  gems: IResource[];
  gemTotal: number;
  bonuses: IBonus[];
  purchasedCount: number;
  reserved: Array<{ tier: CardTier }>;
  nobles: INoble[];
}

export interface IReservedCardView extends ICard { fromDeck: boolean; }

export interface ISelfPlayer extends Omit<IPlayer, 'reserved'> {
  reserved: IReservedCardView[];
}

export interface IAvailableActions {
  isYourTurn: boolean;
  pending: IPendingDecision | null;
  canTakeGems: boolean;
  distinctGemColors: BasicGemColor[];
  requiredDistinctCount: number;
  doubleGemColors: BasicGemColor[];
  canReserve: boolean;
  reservableDeckTiers: CardTier[];
  canPurchase: boolean;
  affordableCardIds: number[];
  canPass: boolean;
}

export interface IBoard {
  roomCode: string;
  phase: GamePhase;
  round: number;
  finalRound: boolean;
  currentPlayerId: string | null;
  vipPlayerId: string | null;
  minPlayers: number;
  maxPlayers: number;
  market: IDeck[];
  availableNobles: INoble[];
  bank: IResource[];
  players: IPlayer[];
  pending: IPendingDecision | null;
  winnerIds: string[];
  log: ILogEntry[];
}

export interface IPlayerView {
  board: IBoard;
  self: ISelfPlayer;
  actions: IAvailableActions;
}

export type ReserveSource = { from: 'market'; cardId: number } | { from: 'deck'; tier: CardTier };

export type PlayerAction =
  | { type: 'takeGems'; gems: IResource[] }
  | { type: 'reserveCard'; source: ReserveSource }
  | { type: 'purchaseCard'; cardId: number; payment?: IResource[] }
  | { type: 'discardGems'; gems: IResource[] }
  | { type: 'chooseNoble'; nobleId: number }
  | { type: 'pass' };

export type ClientMessage = (
  | { type: 'host:create' }
  | { type: 'host:rejoin'; roomCode: string; hostToken: string }
  | { type: 'host:kick'; playerId: string }
  | { type: 'player:join'; roomCode: string; name: string }
  | { type: 'player:rejoin'; roomCode: string; sessionToken: string }
  | { type: 'player:leave' }
  | { type: 'game:start' }
  | { type: 'game:reset' }
  | { type: 'action'; action: PlayerAction }
  | { type: 'state:request' }
  | { type: 'ping' }
) & { requestId?: string | number };

export type ServerMessage =
  | { type: 'room:created'; roomCode: string; hostToken: string }
  | { type: 'room:hosting'; roomCode: string }
  | { type: 'player:joined'; roomCode: string; playerId: string; sessionToken: string; name: string }
  | { type: 'state'; role: 'host'; board: IBoard }
  | ({ type: 'state'; role: 'player' } & IPlayerView)
  | { type: 'removed'; reason: string }
  | { type: 'error'; message: string; requestId?: string | number }
  | { type: 'pong' };
