export type SwarmQueenPhase = 1 | 2 | 3;
export type SwarmQueenState = 'dormant' | 'transition' | 'telegraph' | 'attack' | 'recover' | 'dead';
export type SwarmQueenAttack = 'spores' | 'dive' | 'toxic' | 'summon';

const PATTERNS: Record<SwarmQueenPhase, readonly SwarmQueenAttack[]> = {
  1: ['spores', 'dive', 'spores'],
  2: ['spores', 'toxic', 'summon', 'dive'],
  3: ['spores', 'dive', 'toxic', 'summon', 'spores'],
};

const phaseFor = (fraction: number): SwarmQueenPhase => fraction <= 0.35 ? 3 : fraction <= 0.7 ? 2 : 1;

export class SwarmQueenController {
  phase: SwarmQueenPhase = 1;
  state: SwarmQueenState = 'dormant';
  private elapsed = 0;
  private patternIndex = 0;
  private nodesActive = false;
  private supportLeft = 0;

  get pattern(): SwarmQueenAttack {
    return PATTERNS[this.phase][this.patternIndex % PATTERNS[this.phase].length];
  }

  get isProtected(): boolean {
    return this.phase > 1 && !this.nodesActive;
  }

  get vulnerable(): boolean {
    return this.state === 'recover' && !this.isProtected;
  }

  get contactActive(): boolean {
    return this.state === 'attack' && this.pattern === 'dive';
  }

  get hazardsActive(): boolean {
    return this.state === 'attack' && this.pattern === 'toxic';
  }

  get telegraphDuration(): number {
    return this.phase === 3 ? 0.68 : this.phase === 2 ? 0.88 : 1.08;
  }

  get recoveryDuration(): number {
    return this.phase === 3 ? 0.9 : this.phase === 2 ? 1.15 : 1.4;
  }

  get attackDuration(): number {
    return this.pattern === 'dive' ? 0.4 : this.pattern === 'toxic' ? 0.75 : 0.25;
  }

  takeSupportSlot(): boolean {
    if (this.supportLeft <= 0) return false;
    this.supportLeft--;
    return true;
  }

  suspend(): void {
    if (this.state === 'dead') return;
    this.state = 'dormant';
    this.elapsed = 0;
    this.patternIndex = 0;
    this.nodesActive = false;
    this.supportLeft = 0;
  }

  reset(): void {
    this.state = 'dormant';
    this.phase = 1;
    this.elapsed = 0;
    this.patternIndex = 0;
    this.nodesActive = false;
    this.supportLeft = 0;
  }

  defeat(): void {
    this.state = 'dead';
    this.elapsed = 0;
    this.nodesActive = false;
  }

  update(dt: number, fraction: number, engaged: boolean, nodesActive: boolean): SwarmQueenAttack | null {
    if (this.state === 'dead') return null;
    if (fraction <= 0) {
      this.defeat();
      return null;
    }
    this.nodesActive = nodesActive;
    if (!engaged) {
      this.suspend();
      return null;
    }
    const phase = phaseFor(fraction);
    if (this.state === 'dormant' || phase > this.phase || phase < this.phase) {
      this.phase = phase;
      this.state = 'transition';
      this.elapsed = 0;
      this.patternIndex = 0;
      this.supportLeft = phase === 2 ? 2 : phase === 3 ? 2 : 0;
      return null;
    }
    this.elapsed += Math.min(0.1, Math.max(0, dt));
    const duration = this.state === 'transition' ? 1.4
      : this.state === 'telegraph' ? this.telegraphDuration
        : this.state === 'attack' ? this.attackDuration
          : this.recoveryDuration;
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