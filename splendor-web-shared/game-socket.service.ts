import { Injectable, signal } from '@angular/core';
import { ClientMessage, ServerMessage } from './protocol';

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

/**
 * A thin wrapper around the browser WebSocket. It reconnects with backoff, and onOpen
 * listeners run on every (re)connect, so the app can rejoin its room.
 */
@Injectable({ providedIn: 'root' })
export class GameSocketService {
  readonly status = signal<SocketStatus>('idle');
  readonly url = signal('');

  private socket?: WebSocket;
  private wantOpen = false;
  private attempts = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private readonly messageListeners = new Set<(msg: ServerMessage) => void>();
  private readonly openListeners = new Set<() => void>();
  private readonly failListeners = new Set<(reason: string) => void>();

  connect(url: string): void {
    this.disconnect();
    this.url.set(url);
    this.wantOpen = true;
    this.attempts = 0;
    this.open();
  }

  disconnect(): void {
    this.wantOpen = false;
    clearTimeout(this.retryTimer);
    const s = this.socket;
    this.socket = undefined;
    s?.close();
    this.status.set('idle');
  }

  send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  onMessage(fn: (msg: ServerMessage) => void): () => void {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }

  /** Runs on every successful connect, including reconnects. */
  onOpen(fn: () => void): () => void {
    this.openListeners.add(fn);
    return () => this.openListeners.delete(fn);
  }

  /** Runs when the first connection attempt fails (bad URL, server not running). */
  onFail(fn: (reason: string) => void): () => void {
    this.failListeners.add(fn);
    return () => this.failListeners.delete(fn);
  }

  private open(): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url());
    } catch {
      this.wantOpen = false;
      this.status.set('idle');
      this.failListeners.forEach(fn => fn('That server address is not valid'));
      return;
    }

    this.socket = ws;
    this.status.set(this.attempts === 0 ? 'connecting' : 'reconnecting');
    let opened = false;

    ws.onopen = () => {
      opened = true;
      this.attempts = 0;
      this.status.set('open');
      this.openListeners.forEach(fn => fn());
    };

    ws.onmessage = event => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      this.messageListeners.forEach(fn => fn(msg));
    };

    ws.onclose = () => {
      if (this.socket !== ws) return; // replaced or disconnected on purpose
      const neverConnected = !opened && this.attempts === 0 && this.status() === 'connecting';
      if (neverConnected) {
        this.failListeners.forEach(fn => fn(`Could not reach the server at ${this.url()}`));
      }
      if (!this.wantOpen) {
        this.status.set('idle');
        return;
      }
      this.status.set('reconnecting');
      const delay = Math.min(1000 * 2 ** this.attempts, 10_000);
      this.attempts++;
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }
}
