import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameSocketService } from '@shared/game-socket.service';
import { IBoard, ServerMessage } from '@shared/protocol';
import { BoardComponent } from './board.component';

interface HostSettings {
  /** Where this screen connects. Usually the server on this machine. */
  serverUrl: string;
  /** The wss:// address players use (your tunnel URL). Put in the invite link. */
  publicServerUrl: string;
  /** Where the player site is hosted (GitHub Pages). */
  playerSiteUrl: string;
}

interface HostSession {
  serverUrl: string;
  roomCode: string;
  hostToken: string;
}

const SETTINGS_KEY = 'splendor.host.settings';
const SESSION_KEY = 'splendor.host.session';

function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

/**
 * Host screen: create a room, show the lobby, then show the board for the Discord screenshare.
 * It only displays state. The server decides everything.
 */
@Component({
  selector: 'sp-root',
  imports: [FormsModule, BoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly socket = inject(GameSocketService);

  protected readonly status = this.socket.status;
  protected readonly settings = signal<HostSettings>({
    // Under `ng serve` (port 4200) the server is on port 3000; in the Docker setup it's /ws on this same site
    serverUrl: location.port === '4200' ? 'ws://localhost:3000' : `ws://${location.host}/ws`,
    publicServerUrl: '',
    playerSiteUrl: 'http://localhost:4300/',
    ...load<HostSettings>(SETTINGS_KEY),
  });
  protected readonly session = signal<HostSession | null>(load<HostSession>(SESSION_KEY));
  protected readonly board = signal<IBoard | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  private errorTimer?: ReturnType<typeof setTimeout>;

  protected readonly inviteLink = computed(() => {
    const board = this.board();
    const s = this.settings();
    if (!board) return '';
    try {
      const url = new URL(s.playerSiteUrl);
      url.searchParams.set('room', board.roomCode);
      if (s.publicServerUrl.trim()) url.searchParams.set('server', s.publicServerUrl.trim());
      return url.toString();
    } catch {
      return '';
    }
  });

  protected readonly canStart = computed(() => {
    const b = this.board();
    return !!b && b.players.length >= b.minPlayers && b.players.length <= b.maxPlayers;
  });

  constructor() {
    this.socket.onMessage(msg => this.onMessage(msg));
    this.socket.onOpen(() => this.onOpen());
    this.socket.onFail(reason => {
      this.busy.set(false);
      this.socket.disconnect();
      this.showError(reason);
    });

    // Pick the room back up after a refresh
    const session = this.session();
    if (session) {
      this.busy.set(true);
      this.socket.connect(session.serverUrl);
    }
  }

  protected updateSetting(key: keyof HostSettings, value: string): void {
    this.settings.update(s => ({ ...s, [key]: value }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings()));
  }

  protected createRoom(): void {
    this.clearSession();
    this.busy.set(true);
    this.socket.connect(this.settings().serverUrl.trim());
  }

  protected closeRoom(): void {
    // Tell the server first so it deletes the room and sends every phone back to the join screen.
    // (Messages queued before close() are still delivered.)
    this.socket.send({ type: 'host:close' });
    this.socket.disconnect();
    this.clearSession();
    this.board.set(null);
  }

  protected start(): void {
    this.socket.send({ type: 'game:start' });
  }

  protected playAgain(): void {
    this.socket.send({ type: 'game:reset' });
  }

  protected kick(playerId: string): void {
    this.socket.send({ type: 'host:kick', playerId });
  }

  protected async copyInvite(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteLink());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.showError('Could not copy. Select the link and copy it manually.');
    }
  }

  private onOpen(): void {
    const session = this.session();
    if (session) this.socket.send({ type: 'host:rejoin', roomCode: session.roomCode, hostToken: session.hostToken });
    else this.socket.send({ type: 'host:create' });
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'room:created': {
        const session: HostSession = { serverUrl: this.socket.url(), roomCode: msg.roomCode, hostToken: msg.hostToken };
        this.session.set(session);
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        this.busy.set(false);
        break;
      }
      case 'room:hosting':
        this.busy.set(false);
        break;
      case 'state':
        if (msg.role === 'host') this.board.set(msg.board);
        break;
      case 'error':
        if (!this.board() && this.session()) {
          // The room we were rejoining is gone (server restarted, or we were away too long and it closed)
          this.socket.disconnect();
          this.clearSession();
          this.busy.set(false);
          this.showError(`Your previous room is gone (${msg.message}). Create a new one.`);
        } else {
          this.showError(msg.message);
        }
        break;
    }
  }

  private clearSession(): void {
    this.session.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

  private showError(message: string): void {
    this.error.set(message);
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.error.set(null), 5000);
  }
}
