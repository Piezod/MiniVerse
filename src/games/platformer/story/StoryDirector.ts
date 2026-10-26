import type { StoryBeat, StoryLine } from './types';

/** Characters typed per second. */
export const TYPE_SPEED = 45;
const DEFAULT_HOLD = 2.2;
/** A blocking line that nobody advances moves on by itself after this long (touch players, AFK). */
const BLOCKING_FALLBACK = 12;

export interface StoryBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StoryView {
  beatId: string;
  speaker: string;
  /** Full text of the current line. */
  text: string;
  /** Text typed so far. */
  shown: string;
  blocking: boolean;
  line: number;
  lineCount: number;
  typed: boolean;
}

const overlaps = (a: StoryBox, b: StoryBox): boolean => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * Plays story beats one at a time (Phaser-free). Beats triggered while another one plays are queued.
 * `update(dt)` only advances while the scene runs, so pausing the level pauses the dialogue too.
 */
export class StoryDirector {
  private queue: StoryBeat[] = [];
  private current: StoryBeat | null = null;
  private lineIndex = 0;
  private lineTime = 0;
  private readonly played = new Set<string>();
  /** Zones the box is currently inside, so a repeatable beat fires once per entry. */
  private readonly inside = new Set<string>();

  constructor(
    private readonly beats: readonly StoryBeat[],
    private readonly touch: boolean,
    private readonly tile = 16,
  ) {}

  /** Triggers the "start" beat. */
  start(): void {
    for (const beat of this.beats) if (beat.trigger.type === 'start') this.trigger(beat.id);
  }

  /** Triggers the zone beats the box enters (once per entry for repeatable beats). */
  checkZones(box: StoryBox): void {
    for (const beat of this.beats) {
      const t = beat.trigger;
      if (t.type !== 'zone') continue;
      const inside = overlaps(box, { x: t.col * this.tile, y: t.row * this.tile, width: t.width * this.tile, height: t.height * this.tile });
      const was = this.inside.has(beat.id);
      if (inside) this.inside.add(beat.id);
      else this.inside.delete(beat.id);
      if (inside && !was) this.trigger(beat.id);
    }
  }

  trigger(id: string): boolean {
    const beat = this.beats.find((b) => b.id === id);
    if (!beat) return false;
    if (beat.once && this.played.has(id)) return false;
    if (this.current?.id === id || this.queue.some((b) => b.id === id)) return false;
    this.played.add(id);
    if (beat.blocking && this.current && !this.current.blocking) {
      this.queue.unshift(this.current);
      this.begin(beat);
    } else if (this.current) this.queue.push(beat);
    else this.begin(beat);
    return true;
  }

  get active(): boolean {
    return this.current !== null;
  }

  /** True while a blocking beat is playing: the scene should freeze the action. */
  get blocking(): boolean {
    return this.current?.blocking === true;
  }

  get pendingBlocking(): boolean {
    return this.blocking || this.queue.some((beat) => beat.blocking);
  }

  hasPlayed(id: string): boolean {
    return this.played.has(id);
  }

  get view(): StoryView | null {
    const beat = this.current;
    if (!beat) return null;
    const line = this.lineOf(beat);
    const typed = this.lineTime >= line.text.length / TYPE_SPEED;
    const count = typed ? line.text.length : Math.floor(this.lineTime * TYPE_SPEED);
    return { beatId: beat.id, speaker: line.speaker, text: line.text, shown: line.text.slice(0, count), blocking: beat.blocking, line: this.lineIndex, lineCount: beat.lines.length, typed };
  }

  /** Completes the typing of the current line, or moves to the next line / beat when it is already complete. */
  advance(): void {
    const view = this.view;
    if (!view) return;
    if (!view.typed) this.lineTime = view.text.length / TYPE_SPEED;
    else this.nextLine();
  }

  update(dt: number): void {
    const view = this.view;
    if (!view) return;
    this.lineTime += Math.max(0, dt);
    const beat = this.current!;
    const line = this.lineOf(beat);
    const typedAt = line.text.length / TYPE_SPEED;
    const hold = beat.blocking ? BLOCKING_FALLBACK : (line.duration ?? DEFAULT_HOLD);
    if (this.lineTime >= typedAt + hold) this.nextLine();
  }

  /** Forgets everything (level restart). */
  reset(): void {
    this.queue = [];
    this.current = null;
    this.played.clear();
    this.inside.clear();
    this.lineIndex = 0;
    this.lineTime = 0;
  }

  private lineOf(beat: StoryBeat): StoryLine & { text: string } {
    const line = beat.lines[this.lineIndex];
    return { ...line, text: this.touch ? (line.touchText ?? line.text) : line.text };
  }

  private begin(beat: StoryBeat): void {
    this.current = beat;
    this.lineIndex = 0;
    this.lineTime = 0;
  }

  private nextLine(): void {
    const beat = this.current;
    if (!beat) return;
    if (this.lineIndex + 1 < beat.lines.length) {
      this.lineIndex++;
      this.lineTime = 0;
      return;
    }
    this.current = null;
    const next = this.queue.shift();
    if (next) this.begin(next);
  }
}
