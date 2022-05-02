import EventEmitter = require('events');
import PQueue from 'p-queue';
import { isDomainAvailable, IsDomainAvailableOptions } from './isDomainAvailable';

export interface DomainProcessorOptions extends IsDomainAvailableOptions {
  // How many checks may be performed in parallel, default: 30
  concurrency: number;
}

interface DomainProcessorEvents {
  failed: (name: string, error: Error) => void;
  next: (name: string, available: boolean) => void;
  available: (name: string) => void;
  taken: (name: string) => void;
  idle: () => void;
  end: () => void;
  add: (domain: string) => void;
}

type DomainProcessorEventListener<K extends keyof DomainProcessorEvents> = DomainProcessorEvents[K];

export class DomainProcessor extends EventEmitter {
  private readonly options: DomainProcessorOptions;
  private readonly queue: PQueue;
  private readonly queued: string[] = [];
  private _duplicated: number = 0;
  private _finished: number = 0;
  private _failed: number = 0;
  private _succeed: number = 0;
  private _ended: boolean = false;

  public declare readonly on: <K extends keyof DomainProcessorEvents>(eventName: K, listener: DomainProcessorEventListener<K>) => this;
  public declare readonly emit: <K extends keyof DomainProcessorEvents>(eventName: K, ...args: Parameters<DomainProcessorEventListener<K>>) => boolean;

  public constructor(options?: Partial<DomainProcessorOptions>) {
    super();
    this.options = {
      concurrency: options?.concurrency ?? 30,
      trustDns: options?.trustDns ?? false,
      proxy: options?.proxy || null,
      timeout: options?.timeout ?? 3000,
      maxRetries: options?.maxRetries ?? 2,
      retryTime: options?.retryTime ?? 3000,
    };
    this.queue = new PQueue({
      concurrency: this.options.concurrency,
    });
    this.queue.on('idle', () => {
      if (this.idle) {
        this.emit('idle');
      }
      if (this._ended) {
        this.emit('end');
      }
    });
  }

  public get size(): number {
    return this.queued.length;
  }

  public get duplicated(): number {
    return this._duplicated;
  }

  public get finished(): number {
    return this._finished;
  }

  public get failed(): number {
    return this._failed;
  }

  public get succeed(): number {
    return this._succeed;
  }

  public get idle(): boolean {
    return this.queue.size === 0 && this.queue.pending === 0;
  }

  public get ended(): boolean {
    return this.idle && this._ended;
  }

  public end(): void {
    if (this._ended) {
      return;
    }
    this._ended = true;
    if (this.idle) {
      // lift, so 'end' is always asynchronous
      Promise.resolve().then(() => this.emit('end'));
    }
  }

  public add(name: string): void {
    if (this.ended) {
      throw new Error('The processor queue is already finished.');
    }
    const lowercaseName = name.toLowerCase();
    if (this.queued.includes(lowercaseName)) {
      this._duplicated++;
    } else {
      this.queued.push(lowercaseName);
      this.queue.add(() => this.process(lowercaseName));
      this.emit('add', lowercaseName);
    }
  }

  private async process(name: string): Promise<void> {
    try {
      const available = await isDomainAvailable(name, this.options);
      this._finished++;
      this._succeed++;
      this.emit('next', name, available);
      this.emit(available ? 'available' : 'taken', name);
    } catch (error: any) {
      this._finished++;
      this._failed++;
      this.emit('failed', name, error);
    }
  }
}
