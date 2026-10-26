/** Tracks which pointers (fingers) hold one on-screen button, so several fingers can hold different buttons. */
export class PointerHold {
  private readonly ids = new Set<number>();

  get down(): boolean {
    return this.ids.size > 0;
  }

  /** Returns true when the button went from released to held. */
  press(id: number): boolean {
    const was = this.down;
    this.ids.add(id);
    return !was;
  }

  /** Returns true when the last finger left the button. */
  release(id: number): boolean {
    return this.ids.delete(id) && !this.down;
  }

  /** Drops every finger (pause, focus loss). Returns true when the button was held. */
  clear(): boolean {
    const was = this.down;
    this.ids.clear();
    return was;
  }
}
