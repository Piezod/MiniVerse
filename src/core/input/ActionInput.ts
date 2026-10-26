import type Phaser from 'phaser';

/**
 * Merges keyboard and touch into named actions. Call `update()` once per frame before reading.
 * Short taps that start and end between two frames are latched so they are never lost.
 */
export class ActionInput<A extends string> {
  private readonly keys = new Map<A, Phaser.Input.Keyboard.Key[]>();
  private readonly codeToActions = new Map<number, A[]>();
  private readonly touch = new Map<A, boolean>();
  private readonly latched = new Set<A>();
  private readonly down = new Set<A>();
  private readonly pressed = new Set<A>();
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(scene: Phaser.Scene, bindings: Record<A, number[]>) {
    this.keyboard = scene.input.keyboard;
    for (const action of Object.keys(bindings) as A[]) {
      const codes = bindings[action];
      this.keys.set(action, this.keyboard ? codes.map((code) => this.keyboard!.addKey(code)) : []);
      for (const code of codes) this.codeToActions.set(code, [...(this.codeToActions.get(code) ?? []), action]);
    }
    this.keyboard?.on('keydown', this.onKeyDown, this);
  }

  setTouch(action: A, isDown: boolean): void {
    this.touch.set(action, isDown);
    if (isDown) this.latched.add(action);
  }

  clearTouch(): void {
    this.touch.clear();
    this.latched.clear();
  }

  update(): void {
    this.pressed.clear();
    for (const [action, keys] of this.keys) {
      const isDown = this.latched.has(action) || this.touch.get(action) === true || keys.some((k) => k.isDown);
      if (isDown && !this.down.has(action)) this.pressed.add(action);
      if (isDown) this.down.add(action);
      else this.down.delete(action);
    }
    this.latched.clear();
  }

  isDown(action: A): boolean {
    return this.down.has(action);
  }

  justPressed(action: A): boolean {
    return this.pressed.has(action);
  }

  destroy(): void {
    this.keyboard?.off('keydown', this.onKeyDown, this);
    this.clearTouch();
  }

  private onKeyDown(event: KeyboardEvent): void {
    for (const action of this.codeToActions.get(event.keyCode) ?? []) this.latched.add(action);
  }
}
