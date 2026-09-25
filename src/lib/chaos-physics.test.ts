/**
 * The homepage panel's physics, pinned on the behaviours that were only ever
 * verified by driving the page: chips stay inside the field, bounce back off
 * every wall, get pushed away from the pointer and never settle into
 * stillness. Randomness is injected, so every run is the same run.
 */
import { describe, expect, it } from 'vitest';

import {
  CHIP_SIZE,
  DRIFT,
  MAX_FRAME_SECONDS,
  MAX_SPEED,
  MIN_SPEED,
  REPEL_RADIUS,
  chipTransform,
  clampChip,
  createChip,
  frameSeconds,
  scatterChips,
  stepChip,
  type Bounds,
  type Chip,
  type Pointer,
} from './chaos-physics';

const BOUNDS: Bounds = { w: 400, h: 260 };
const MAX_X = BOUNDS.w - CHIP_SIZE;
const MAX_Y = BOUNDS.h - CHIP_SIZE;
const NO_POINTER: Pointer = { x: 0, y: 0, active: false };

/** A fixed "random" value, so a test controls every draw. */
const fixed = (value: number) => () => value;

function chip(overrides: Partial<Chip> = {}): Chip {
  return { x: 100, y: 100, vx: DRIFT, vy: 0, phase: 0, spin: 0.5, tilt: 6, pulse: 0.7, ...overrides };
}

function speedOf(c: Chip): number {
  return Math.hypot(c.vx, c.vy);
}

describe('createChip', () => {
  it('starts drifting at exactly the drift speed', () => {
    expect(speedOf(createChip(0, fixed(0.3)))).toBeCloseTo(DRIFT);
  });

  it('gives neighbouring chips different pulse rates', () => {
    const pulses = [0, 1, 2].map((i) => createChip(i, fixed(0)).pulse);

    expect(new Set(pulses).size).toBe(3);
  });
});

describe('clampChip', () => {
  it('pulls a chip that has left the field back inside it', () => {
    const c = chip({ x: 999, y: -40 });

    clampChip(c, BOUNDS);

    expect(c).toMatchObject({ x: MAX_X, y: 0 });
  });

  it('pins a chip to the origin when the field is smaller than one chip', () => {
    const c = chip({ x: 50, y: 50 });

    clampChip(c, { w: 10, h: 10 });

    expect(c).toMatchObject({ x: 0, y: 0 });
  });
});

describe('scatterChips', () => {
  it('spreads chips across distinct positions rather than stacking them', () => {
    const chips = Array.from({ length: 8 }, (_, i) => createChip(i, fixed(0.5)));

    scatterChips(chips, BOUNDS, fixed(0.5));

    const positions = new Set(chips.map((c) => `${c.x},${c.y}`));
    expect(positions.size).toBe(8);
  });

  it('keeps every chip inside the field', () => {
    const chips = Array.from({ length: 8 }, (_, i) => createChip(i, fixed(0.99)));

    scatterChips(chips, BOUNDS, fixed(0.99));

    for (const c of chips) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(MAX_X);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(MAX_Y);
    }
  });
});

describe('frameSeconds', () => {
  it('converts milliseconds to seconds', () => {
    expect(frameSeconds(1016, 1000)).toBeCloseTo(0.016);
  });

  it('caps a long gap, so a tab coming back from the background does not teleport', () => {
    expect(frameSeconds(10_000, 0)).toBe(MAX_FRAME_SECONDS);
  });
});

describe('stepChip, walls', () => {
  it.each([
    ['left', { x: 1, vx: -100, vy: 0 }, 'vx', 1],
    ['right', { x: MAX_X - 1, vx: 100, vy: 0 }, 'vx', -1],
    ['top', { y: 1, vx: 0, vy: -100 }, 'vy', 1],
    ['bottom', { y: MAX_Y - 1, vx: 0, vy: 100 }, 'vy', -1],
  ] as const)('bounces off the %s wall and heads back inward', (_, start, axis, sign) => {
    const c = chip(start);

    stepChip(c, 0.05, BOUNDS, NO_POINTER);

    expect(Math.sign(c[axis])).toBe(sign);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x).toBeLessThanOrEqual(MAX_X);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeLessThanOrEqual(MAX_Y);
  });

  it('never escapes the field over many steps', () => {
    const c = chip({ vx: 180, vy: -140 });

    for (let i = 0; i < 2000; i += 1) {
      stepChip(c, MAX_FRAME_SECONDS, BOUNDS, NO_POINTER, fixed(0.25));
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(MAX_X);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(MAX_Y);
    }
  });
});

describe('stepChip, pointer', () => {
  it('pushes a nearby chip directly away from the pointer', () => {
    // Pointer sits just left of the chip's centre, so the push is to the right.
    const c = chip({ x: 100, y: 100, vx: 0, vy: 0.01 });
    const pointer = { x: 100 + CHIP_SIZE / 2 - 20, y: 100 + CHIP_SIZE / 2, active: true };

    stepChip(c, 0.016, BOUNDS, pointer);

    expect(c.vx).toBeGreaterThan(0);
    expect(speedOf(c)).toBeGreaterThan(DRIFT);
  });

  it('leaves a chip outside the repel radius alone', () => {
    const c = chip({ vx: DRIFT, vy: 0 });
    const pointer = { x: 100 + CHIP_SIZE / 2 + REPEL_RADIUS + 5, y: 100 + CHIP_SIZE / 2, active: true };

    stepChip(c, 0.016, BOUNDS, pointer);

    expect(speedOf(c)).toBeCloseTo(DRIFT);
  });

  it('ignores the pointer once it has left the field', () => {
    const c = chip({ vx: DRIFT, vy: 0 });

    stepChip(c, 0.016, BOUNDS, { x: 110, y: 110, active: false });

    expect(speedOf(c)).toBeCloseTo(DRIFT);
  });
});

describe('stepChip, speed', () => {
  it('bleeds a shove off back towards the drift speed', () => {
    // The excess over the drift speed decays to 28% per second, so it should
    // fall every step and be all but gone after six seconds.
    const c = chip({ vx: 200, vy: 0 });
    let previous = speedOf(c);

    for (let i = 0; i < 120; i += 1) {
      stepChip(c, 0.05, { w: 100_000, h: 100_000 }, NO_POINTER);
      expect(speedOf(c)).toBeLessThan(previous);
      previous = speedOf(c);
    }

    expect(speedOf(c)).toBeLessThan(DRIFT + 1);
  });

  it('never exceeds the speed ceiling', () => {
    const c = chip({ vx: 10_000, vy: 0 });

    stepChip(c, 0.001, { w: 100_000, h: 100_000 }, NO_POINTER);

    expect(speedOf(c)).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
  });

  it('lifts a chip that has nearly stopped back up to the minimum speed', () => {
    const c = chip({ vx: 1, vy: 0 });

    stepChip(c, 0.016, BOUNDS, NO_POINTER);

    expect(speedOf(c)).toBeCloseTo(MIN_SPEED);
  });

  it('restarts a chip that has stopped dead, so the field is never still', () => {
    const c = chip({ vx: 0, vy: 0 });

    stepChip(c, 0.016, BOUNDS, NO_POINTER, fixed(0.25));

    expect(speedOf(c)).toBeCloseTo(DRIFT);
  });
});

describe('chipTransform', () => {
  it('places the chip at its position', () => {
    expect(chipTransform(chip({ x: 12.345, y: 6 }))).toContain('translate3d(12.35px,6.00px,0)');
  });

  it('draws no tilt and no pulse at phase zero', () => {
    expect(chipTransform(chip({ phase: 0 }))).toContain('rotate(0.00deg) scale(1.000)');
  });
});
