export type OmegaPhase = 1 | 2 | 3;
export type OmegaState = 'dormant' | 'transition' | 'telegraph' | 'attack' | 'recover' | 'dead';
export type OmegaAttack = 'shot' | 'dash' | 'lasers' | 'combo';

const PATTERNS: Record<OmegaPhase, readonly OmegaAttack[]> = {
  1: ['shot', 'dash'],
  2: ['shot', 'lasers', 'dash'],
  3: ['combo', 'dash', 'lasers', 'shot'],
};

export const omegaPhase = (fraction: number): OmegaPhase => fraction <= 0.35 ? 3 : fraction <= 0.7 ? 2 : 1;

export class OmegaController {
  phase: OmegaPhase = 1;
  state: OmegaState = 'dormant';
  private elapsed = 0;
  private patternIndex = 0;

  get pattern(): OmegaAttack {
    return PATTERNS[this.phase][this.patternIndex % PATTERNS[this.phase].length];
  }

  get vulnerable(): boolean {
    return this.state === 'recover';
  }

  get hazardsActive(): boolean {
    return this.phase >= 2 && this.state === 'attack' && (this.pattern === 'lasers' || this.pattern === 'combo');
  }

  get contactActive(): boolean {
    return this.state === 'attack' && (this.pattern === 'dash' || this.pattern === 'combo');
  }

  get telegraphDuration(): number {
    return this.phase === 3 ? 0.85 : this.phase === 2 ? 1 : 1.15;
  }

  get recoveryDuration(): number {
    return this.phase === 3 ? 1.5 : this.phase === 2 ? 1.9 : 2.3;
  }

  get attackDuration(): number {
    return this.pattern === 'dash' ? 0.45 : this.pattern === 'shot' ? 0.2 : 1.2;
  }

  suspend(): void {
    if (this.state === 'dead') return;
    this.state = 'dormant';
    this.elapsed = 0;
    this.patternIndex = 0;
  }

  defeat(): void {
    this.state = 'dead';
    this.elapsed = 0;
  }

  update(dt: number, fraction: number, engaged: boolean): OmegaAttack | null {
    if (this.state === 'dead') return null;
    if (fraction <= 0) {
      this.defeat();
      return null;
    }
    if (!engaged) {
      this.suspend();
      return null;
    }
    const phase = omegaPhase(fraction);
    if (this.state === 'dormant' || phase > this.phase) {
      this.phase = phase;
      this.state = 'transition';
      this.elapsed = 0;
      this.patternIndex = 0;
      return null;
    }
    this.elapsed += Math.min(0.1, Math.max(0, dt));
    const duration = this.state === 'transition' ? 1.8 : this.state === 'telegraph' ? this.telegraphDuration : this.state === 'attack' ? this.attackDuration : this.recoveryDuration;
    if (this.elapsed + 1e-9 < duration) return null;
    this.elapsed = 0;
    if (this.state === 'transition') this.state = 'telegraph';
    else if (this.state === 'telegraph') {
      this.state = 'attack';
      return this.pattern;
    } else if (this.state === 'attack') this.state = 'recover';
    else if (this.state === 'recover') {
      this.patternIndex++;
      this.state = 'telegraph';
    }
    return null;
  }
}