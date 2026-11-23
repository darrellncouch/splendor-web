import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameSocketService } from '@shared/game-socket.service';
import { IPlayerView, PlayerAction, ServerMessage } from '@shared/protocol';
import { GameComponent } from './game.component';

interface PlayerSession {
  serverUrl: string;
  roomCode: string;
  sessionToken: string;
  playerId: string;
  name: string;
}

const SESSION_KEY = 'splendor.player.session';
const SERVER_KEY = 'splendor.player.server';
const NAME_KEY = 'splendor.player.name';

function loadSession(): PlayerSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as PlayerSession | null;
  } catch {
    return null;
  }
}

/** Server address priority: ?server= in the invite link, then the last one used, then the same machine on port 3000 (local dev). */
function defaultServer(params: URLSearchParams): string {
  const fromLink = params.get('server');
  if (fromLink) return fromLink;
  const saved = localStorage.getItem(SERVER_KEY);
  if (saved) return saved;
  return location.protocol === 'https:' ? '' : `ws://${location.hostname || 'localhost'}:3000`;
}

/**
 * Phone client: join a room, wait in the lobby, then play. It only sends intents and shows
 * what the server sends back.
 */
@Component({
  selector: 'sp-root',
  imports: [FormsModule, GameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly socket = inject(GameSocketService);
  private readonly params = new URLSearchParams(location.search);

  protected readonly status = this.socket.status;
  protected readonly session = signal<PlayerSession | null>(loadSession());
  protected readonly view = signal<IPlayerView | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Increments on every state update so the game screen can close its sheets. */
  protected readonly stateVersion = signal(0);

  protected roomCode = (this.params.get('room') ?? '').toUpperCase();
  protected name = localStorage.getItem(NAME_KEY) ?? '';
  protected serverUrl = defaultServer(this.params);
  protected showServer = !this.serverUrl;

  protected readonly board = computed(() => this.view()?.board ?? null);
  protected readonly isVip = computed(() => {
    const v = this.view();
    return !!v && v.board.vipPlayerId === v.self.id;
  });

  private pendingJoin = false;
  private errorTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.socket.onMessage(msg => this.onMessage(msg));
    this.socket.onOpen(() => this.onOpen());
    this.socket.onFail(reason => {
      this.busy.set(false);
      this.pendingJoin = false;
      this.socket.disconnect();
      this.showServer = true;
      this.showError(`${reason}. Check the server address.`);
    });

    const session = this.session();
    if (session) {
      this.busy.set(true);
      this.socket.connect(session.serverUrl);
    }

    // Phones drop sockets when they sleep. Make sure we're reconnecting when the page is visible again.
    document.addEventListener('visibilitychange', () => {
      const s = this.session();
      if (document.visibilityState === 'visible' && s && this.status() === 'idle') this.socket.connect(s.serverUrl);
    });
  }

  protected join(): void {
    const roomCode = this.roomCode.trim().toUpperCase();
    const name = this.name.trim();
    const serverUrl = this.serverUrl.trim();
    if (!roomCode || !name) return this.showError('Enter the room code and your name');
    if (!serverUrl) {
      this.showServer = true;
      return this.showError('Enter the server address. Ask the host for the invite link.');
    }

    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(SERVER_KEY, serverUrl);
    this.busy.set(true);
    this.pendingJoin = true;

    if (this.status() === 'open' && this.socket.url() === serverUrl) this.onOpen();
    else this.socket.connect(serverUrl);
  }

  protected leave(): void {
    this.socket.send({ type: 'player:leave' });
    this.resetToJoin();
  }

  protected start(): void {
    this.socket.send({ type: 'game:start' });
  }

  protected playAgain(): void {
    this.socket.send({ type: 'game:reset' });
  }

  protected sendAction(action: PlayerAction): void {
    if (!this.socket.send({ type: 'action', action })) this.showError('Not connected. Reconnecting…');
  }

  private onOpen(): void {
    const session = this.session();
    if (session) {
      this.socket.send({ type: 'player:rejoin', roomCode: session.roomCode, sessionToken: session.sessionToken });
    } else if (this.pendingJoin) {
      this.socket.send({ type: 'player:join', roomCode: this.roomCode.trim().toUpperCase(), name: this.name.trim() });
    }
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'player:joined': {
        const session: PlayerSession = {
          serverUrl: this.socket.url(),
          roomCode: msg.roomCode,
          sessionToken: msg.sessionToken,
          playerId: msg.playerId,
          name: msg.name,
        };
        this.session.set(session);
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        this.pendingJoin = false;
        this.busy.set(false);
        break;
      }
      case 'state':
        if (msg.role === 'player') {
          this.view.set({ board: msg.board, self: msg.self, actions: msg.actions });
          this.stateVersion.update(v => v + 1);
        }
        break;
      case 'removed':
        this.resetToJoin();
        this.showError(msg.reason);
        break;
      case 'error':
        this.busy.set(false);
        this.pendingJoin = false;
        if (this.session() && !this.view()) {
          // Couldn't rejoin our old seat (server restarted, or the room closed)
          this.resetToJoin();
          this.showError(`${msg.message}`);
        } else {
          this.showError(msg.message);
        }
        break;
    }
  }

  private resetToJoin(): void {
    if (this.session()) this.roomCode = this.session()!.roomCode;
    this.session.set(null);
    this.view.set(null);
    localStorage.removeItem(SESSION_KEY);
    this.busy.set(false);
  }

  private showError(message: string): void {
    this.error.set(message);
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.error.set(null), 4500);
  }
}
