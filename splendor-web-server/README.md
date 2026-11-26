# Booty – Game Server

The authoritative game server. It holds all game state in memory, enforces every rule, and talks to the host screen and player phones over plain WebSockets (JSON messages). The host and clients just display what they receive and send actions.

```
npm install
npm run dev        # watch mode on ws://localhost:3000
npm test           # rule tests, 75 simulated games, websocket end-to-end
npm run build && npm start
```

Env vars: `PORT` (default 3000), `DATA_DIR` (default `./data`), `ALLOWED_ORIGINS` (comma list, e.g. `https://you.github.io,http://localhost:5173`; empty means allow all).

## Layout

| Folder | What it does |
|---|---|
| `src/core` | Interfaces, types, constants (`game-rules.constant.ts`), helpers, data loader |
| `src/state` | One class per piece of state: `bank`, `deck`/`market`, `noble`, `player`, `game` (phase, turn order, pending decisions, log). These hold data only, no rules. |
| `src/logic` | Services with the rules: `take-gems`, `reserve-card`, `purchase-card`, `turn` (discard → noble → end turn → final round), `player-action` (entry point / turn checks), `lobby`, `game-setup`, `view` (strips hidden info) |
| `src/gameEngine.ts` | One room: owns the state and passes requests to the services |
| `src/hub` | `game.hub.ts` (websocket routing and broadcast), `protocol.ts` (message types and input validation), `room.registry.ts` (room codes) |

## Card / noble data

Game data lives in `data/`: `cards.json` or `cards.csv`, and `nobles.json` or `nobles.csv` (JSON wins if both exist). The server won't start without both.

- JSON matches `ICard` (`{ id, tier, prestige, bonus, cost: [{ id, count }] }`) and `INoble` (`{ id, prestige, cost, imgUrl }`).
- CSV headers: `id,tier,prestige,bonus,white,blue,green,red,black` and `id,prestige,white,blue,green,red,black,imgUrl`.

Data is validated at startup (unique ids, valid colors, no gold in costs).

## Protocol

Every frame is a JSON object with a `type`. Any client message can include a `requestId`, and an error reply will include it.

### Client → server

| type | sent by | fields |
|---|---|---|
| `host:create` | host | – → replies `room:created { roomCode, hostToken }` |
| `host:rejoin` | host | `roomCode, hostToken` (after a refresh) |
| `host:kick` | host | `playerId` (lobby only) |
| `player:join` | phone | `roomCode, name` → replies `player:joined { playerId, sessionToken }` |
| `player:rejoin` | phone | `roomCode, sessionToken` (store the token in localStorage) |
| `player:leave` | phone | – |
| `game:start` / `game:reset` | host or VIP (first player to join) | – |
| `action` | current player | `action` (see below) |
| `state:request` / `ping` | anyone | – |

Actions (`{ type: 'action', action: … }`):

```jsonc
{ "type": "takeGems", "gems": [{ "id": "white", "count": 1 }, { "id": "blue", "count": 1 }, { "id": "red", "count": 1 }] }
{ "type": "takeGems", "gems": [{ "id": "green", "count": 2 }] }
{ "type": "reserveCard", "source": { "from": "market", "cardId": 12 } }
{ "type": "reserveCard", "source": { "from": "deck", "tier": 2 } }
{ "type": "purchaseCard", "cardId": 12 }                       // auto-pays: colors first, then gold
{ "type": "purchaseCard", "cardId": 12, "payment": [{ "id": "gold", "count": 1 }] }   // optional explicit payment
{ "type": "discardGems", "gems": [{ "id": "black", "count": 1 }] }   // only when pending.type === 'discard'
{ "type": "chooseNoble", "nobleId": 3 }                              // only when pending.type === 'chooseNoble'
{ "type": "pass" }                                                   // only when actions.canPass
```

### Server → client

- Host: `{ type: 'state', role: 'host', board: IBoard }` after every change.
- Player: `{ type: 'state', role: 'player', board: IBoard, self: ISelfPlayer, actions: IAvailableActions }` after every change.
  - `board.players[]` is the public view for the other-player tabs (reserved cards show only `{ tier }`, face down).
  - `self` is the player's own tab, with reserved cards face up.
  - `actions` has flags for enabling buttons (`isYourTurn`, `canTakeGems`, `canReserve`, `canPurchase`, `canPass`, `affordableCardIds`, `doubleGemColors`, `requiredDistinctCount`, `pending`, …).
- `{ type: 'error', message, requestId? }`: show the message to the player. Nothing changed on the server.
- `{ type: 'removed', reason }`: kicked, left, another tab took this seat, or the room closed. A room closes when the host sends `host:close`, or when the host has been disconnected for 2 minutes (a refresh within that window keeps the room). Go back to the join screen.

See `src/core/interfaces` and `src/hub/protocol.ts` for the exact shapes.

## Turn flow

Main action → if over 10 tokens, `pending: discard` (same player) → noble check (given automatically if one qualifies; `pending: chooseNoble` if several) → next player. When someone reaches 15 prestige, `finalRound` turns on and the game ends once the last seat in the round has played. Highest prestige wins, ties go to whoever bought the fewest cards, and if still tied they share the win.

## Hosting note

GitHub Pages serves over **https**, and browsers block an https page from opening a plain `ws://` connection. The phones need a `wss://` URL, so put the server on your desktop behind a TLS tunnel, e.g. `cloudflared tunnel --url http://localhost:3000` (free, no port forwarding). Then point the client at `wss://<tunnel-host>`.
