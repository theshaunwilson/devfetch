/**
 * The motion behind the homepage's "your knowledge today" panel: icons that
 * drift, tumble, bounce off the walls and scatter away from the pointer.
 *
 * Pure on purpose — no DOM, no `requestAnimationFrame`, and randomness passed
 * in — so the rules are unit-testable. `ChaosField` owns the loop, the
 * observers and the element each chip draws into.
 */

/** Matches the rendered chip size; the physics needs it in numbers. */
export const CHIP_SIZE = 46;
/** px/second the icons settle back to once a shove has bled off. */
export const DRIFT = 15;
export const MIN_SPEED = DRIFT * 0.65;
export const MAX_SPEED = 260;
export const REPEL_RADIUS = 130;
export const REPEL_FORCE = 1500;
/** The longest step a single frame may take, so a stalled tab does not teleport. */
export const MAX_FRAME_SECONDS = 0.05;

/** One chip's position, velocity and the parameters of its wobble. */
export interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  spin: number;
  tilt: number;
  pulse: number;
}

export interface Bounds {
  w: number;
  h: number;
}

export interface Pointer {
  x: number;
  y: number;
  active: boolean;
}

/** A source of numbers in `[0, 1)`; `Math.random` in the browser. */
export type Random = () => number;

/** A chip drifting in a random direction, with its own wobble. */
export function createChip(index: number, random: Random = Math.random): Chip {
  const angle = random() * Math.PI * 2;

  return {
    x: 0,
    y: 0,
    vx: Math.cos(angle) * DRIFT,
    vy: Math.sin(angle) * DRIFT,
    phase: random() * Math.PI * 2,
    spin: 0.5 + random() * 0.45,
    tilt: 6 + random() * 5,
    pulse: 0.7 + (index % 3) * 0.16,
  };
}

function maxPosition(bounds: Bounds): { maxX: number; maxY: number } {
  return {
    maxX: Math.max(bounds.w - CHIP_SIZE, 0),
    maxY: Math.max(bounds.h - CHIP_SIZE, 0),
  };
}

/** Pulls a chip back inside the field, e.g. after the field shrinks. */
export function clampChip(chip: Chip, bounds: Bounds): void {
  const { maxX, maxY } = maxPosition(bounds);

  chip.x = Math.min(Math.max(chip.x, 0), maxX);
  chip.y = Math.min(Math.max(chip.y, 0), maxY);
}

/** Places chips on a jittered grid, so no two icons start stacked on each other. */
export function scatterChips(chips: Chip[], bounds: Bounds, random: Random = Math.random): void {
  const cols = 4;
  const rows = Math.ceil(chips.length / cols);
  const cellW = Math.max(bounds.w / cols, CHIP_SIZE);
  const cellH = Math.max(bounds.h / rows, CHIP_SIZE);

  chips.forEach((chip, i) => {
    chip.x = (i % cols) * cellW + random() * Math.max(cellW - CHIP_SIZE, 0);
    chip.y = Math.floor(i / cols) * cellH + random() * Math.max(cellH - CHIP_SIZE, 0);
    clampChip(chip, bounds);
  });
}

/** Seconds since the last frame, capped at `MAX_FRAME_SECONDS`. */
export function frameSeconds(now: number, last: number): number {
  return Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
}

/** Pushes a chip away from the pointer, harder the closer it is. */
function repel(chip: Chip, pointer: Pointer, dt: number): void {
  if (!pointer.active) return;

  const dx = chip.x + CHIP_SIZE / 2 - pointer.x;
  const dy = chip.y + CHIP_SIZE / 2 - pointer.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

  if (dist >= REPEL_RADIUS) return;

  const push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;

  chip.vx += (dx / dist) * push;
  chip.vy += (dy / dist) * push;
}

/**
 * Bleeds a shove off over about a second, and keeps a slow drift going so the
 * field never settles into stillness.
 */
function regulateSpeed(chip: Chip, dt: number, random: Random): void {
  const speed = Math.sqrt(chip.vx * chip.vx + chip.vy * chip.vy);

  if (speed < 0.001) {
    const angle = random() * Math.PI * 2;

    chip.vx = Math.cos(angle) * DRIFT;
    chip.vy = Math.sin(angle) * DRIFT;

    return;
  }

  let target = speed;

  if (speed > DRIFT) {
    target = DRIFT + (speed - DRIFT) * Math.pow(0.28, dt);
  } else if (speed < MIN_SPEED) {
    target = MIN_SPEED;
  }

  target = Math.min(target, MAX_SPEED);
  chip.vx *= target / speed;
  chip.vy *= target / speed;
}

/** Stops a chip at a wall and turns it back inward. */
function bounce(chip: Chip, bounds: Bounds): void {
  const { maxX, maxY } = maxPosition(bounds);

  if (chip.x <= 0) {
    chip.x = 0;
    chip.vx = Math.abs(chip.vx);
  } else if (chip.x >= maxX) {
    chip.x = maxX;
    chip.vx = -Math.abs(chip.vx);
  }

  if (chip.y <= 0) {
    chip.y = 0;
    chip.vy = Math.abs(chip.vy);
  } else if (chip.y >= maxY) {
    chip.y = maxY;
    chip.vy = -Math.abs(chip.vy);
  }
}

/** Advances one chip by `dt` seconds. */
export function stepChip(
  chip: Chip,
  dt: number,
  bounds: Bounds,
  pointer: Pointer,
  random: Random = Math.random,
): void {
  repel(chip, pointer, dt);
  regulateSpeed(chip, dt, random);

  chip.x += chip.vx * dt;
  chip.y += chip.vy * dt;

  bounce(chip, bounds);
  chip.phase += dt;
}

/** The CSS transform that draws a chip where it is, tilted and pulsing. */
export function chipTransform(chip: Chip): string {
  const rotation = Math.sin(chip.phase * chip.spin) * chip.tilt;
  const scale = 1 + Math.sin(chip.phase * chip.pulse) * 0.055;

  return `translate3d(${chip.x.toFixed(2)}px,${chip.y.toFixed(2)}px,0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
}
