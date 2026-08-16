import { CONFIG } from './config';

// Frame-time governor. Watches p75 of recent frames and walks a degradation
// ladder with hysteresis: drop a bloom level, then thin the field toward the
// floor, then kill bloom. Stepping up reverses the ladder.
export class Quality {
  bloomLevels = 3;
  targetCount: number = CONFIG.initialCount;
  onChange: (() => void) | null = null;

  private ring = new Float32Array(CONFIG.quality.ring);
  private idx = 0;
  private filled = 0;
  private settleUntil = 0;
  private cooldownUntil = 0;
  private slowSince = -1;
  private fastSince = -1;
  private lastP75 = 0;

  frame(dtMs: number, now: number): void {
    const q = CONFIG.quality;
    if (now < this.settleUntil) return;
    this.ring[this.idx] = dtMs;
    this.idx = (this.idx + 1) % this.ring.length;
    if (this.filled < this.ring.length) this.filled++;
    if (this.filled < this.ring.length || this.idx % 15 !== 0) return;

    const sorted = Array.from(this.ring).sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    this.lastP75 = p75;

    if (p75 > q.p75Down) {
      this.fastSince = -1;
      if (this.slowSince < 0) this.slowSince = now;
      else if (now - this.slowSince > q.downHoldS && now > this.cooldownUntil) {
        this.stepDown();
        this.cooldownUntil = now + q.cooldownS;
        this.slowSince = -1;
      }
    } else if (p75 < q.p75Up) {
      this.slowSince = -1;
      if (this.fastSince < 0) this.fastSince = now;
      else if (now - this.fastSince > q.upHoldS && now > this.cooldownUntil) {
        this.stepUp();
        this.cooldownUntil = now + q.cooldownS;
        this.fastSince = -1;
      }
    } else {
      this.slowSince = -1;
      this.fastSince = -1;
    }
  }

  // Reset measurement after load, resize, or visibility changes.
  disturb(now: number): void {
    this.settleUntil = now + CONFIG.quality.settleS;
    this.filled = 0;
    this.idx = 0;
    this.slowSince = -1;
    this.fastSince = -1;
  }

  p75(): number {
    return this.lastP75;
  }

  private stepDown(): void {
    const q = CONFIG.quality;
    if (this.bloomLevels === 3) this.bloomLevels = 2;
    else if (this.targetCount > CONFIG.minCount) {
      this.targetCount = Math.max(
        CONFIG.minCount,
        Math.round(this.targetCount * q.countStepDown),
      );
    } else if (this.bloomLevels > 0) this.bloomLevels = 0;
    else return;
    this.onChange?.();
  }

  private stepUp(): void {
    const q = CONFIG.quality;
    if (this.bloomLevels === 0) this.bloomLevels = 2;
    else if (this.targetCount < CONFIG.maxCount) {
      this.targetCount = Math.min(CONFIG.maxCount, Math.round(this.targetCount * q.countStepUp));
    } else if (this.bloomLevels < 3) this.bloomLevels = 3;
    else return;
    this.onChange?.();
  }
}
