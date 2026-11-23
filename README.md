# Splendor Web

A Jackbox-style online version of Splendor. A **host** screen shows the board (you screenshare it on Discord), players use their **phones** as controllers, and an authoritative **server** runs the game over WebSockets.

```
splendor-web/
├─ splendor-web-server/   Node + ws game server (all rules and state). See its README for the protocol.
├─ splendor-web-host/     Angular app: lobby + board for the screenshare
├─ splendor-web-client/   Angular app: phone controller (deploy to GitHub Pages)
└─ splendor-web-shared/   Code both Angular apps use: protocol types, socket service, gem/card/noble components, theme
```

The Angular workspace is the repo root (`angular.json`, `package.json`). The server has its own `package.json`.

## Run locally

```bash
npm install                          # Angular workspace
npm --prefix splendor-web-server install
```

Then, in three terminals:

```bash
npm run server        # ws://localhost:3000
npm run start:host    # http://localhost:4200
npm run start:client  # http://localhost:4300 (also reachable from phones on your Wi-Fi)
```

Open the host, click **Create room**, then open the client (or copy the invite link) and join with the code.

## Playing with friends (server on your desktop, client on GitHub Pages)

1. **Expose the server over wss://.** GitHub Pages is https, so phones can't connect to a plain `ws://` server. A free quick tunnel works:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   It prints something like `https://random-words.trycloudflare.com`. The players' server address is that with `wss://` instead of `https://`. Quick-tunnel URLs change on every run.
2. **Deploy the client** (once, or after changes):
   ```bash
   npm run build:client:pages
   ```
   Publish the contents of `dist/client/browser/` to GitHub Pages (for example push them to a `gh-pages` branch). The relative base href means it works from any repo path.
3. **On the host screen** (setup page): set *Public server URL* to your `wss://…trycloudflare.com` address and *Player site URL* to your Pages URL. Then create the room and click **Copy invite link**. The link includes the room code and server address, so friends just enter a name.

## How the apps work

- The host and client are "dumb": they render the `state` messages the server pushes and send actions. Buttons are enabled from the server's `actions` flags.
- Phones and the host save a session token in `localStorage`, so a refresh or a dropped connection rejoins the same seat or room automatically.
- The first player to join is the **VIP**, who can start the game and "play again" from their phone. The host can do both too, and can also remove players from the lobby or end a game early (header buttons, shown on hover).
- There's no art yet: gems are colored tokens, and cards and nobles are CSS tiles showing prestige, bonus color and cost.
