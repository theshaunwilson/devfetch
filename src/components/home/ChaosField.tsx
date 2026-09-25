'use client';

import { useEffect, useRef } from 'react';

import {
  chipTransform,
  clampChip,
  createChip,
  frameSeconds,
  scatterChips,
  stepChip,
  type Bounds,
  type Chip,
  type Pointer,
} from '@/lib/chaos-physics';

import { CHAOS_SOURCES } from './chaos-sources';

/**
 * The "your knowledge today" panel: source icons drifting, tumbling and
 * scattering away from the pointer.
 *
 * All of it runs imperatively against the DOM rather than through React state
 * — sixty renders a second of eight transforms is not what reconciliation is
 * for, and the positions are never read by anything else.
 *
 * Under `prefers-reduced-motion: reduce` the chips are still scattered and
 * drawn, just never stepped: a still field reads as clutter, which is the
 * point of the panel, where an empty one would read as a bug.
 */
export function ChaosField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const elements = Array.from(field.querySelectorAll<HTMLElement>('[data-chip]'));
    if (elements.length === 0) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const bounds: Bounds = { w: field.clientWidth, h: field.clientHeight };
    const pointer: Pointer = { x: 0, y: 0, active: false };
    // Parallel to `elements`: the physics knows nothing about the DOM.
    const chips: Chip[] = elements.map((_, i) => createChip(i));
    let running = false;
    let frame = 0;
    let last = 0;

    function draw(chip: Chip, i: number) {
      elements[i].style.transform = chipTransform(chip);
    }

    function step(now: number) {
      const dt = frameSeconds(now, last);
      last = now;

      chips.forEach((chip, i) => {
        stepChip(chip, dt, bounds, pointer);
        draw(chip, i);
      });

      frame = window.requestAnimationFrame(step);
    }

    function play() {
      if (running || reduceMotion.matches) return;
      running = true;
      last = window.performance.now();
      frame = window.requestAnimationFrame(step);
    }

    function pause() {
      if (!running) return;
      running = false;
      window.cancelAnimationFrame(frame);
    }

    // Arrow functions rather than declarations: a hoisted `function` loses the
    // `if (!field) return` narrowing above, since TypeScript cannot rule out a
    // call before it.
    const measure = () => {
      bounds.w = field.clientWidth;
      bounds.h = field.clientHeight;
      chips.forEach((chip, i) => {
        clampChip(chip, bounds);
        draw(chip, i);
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = field.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };

    function onPointerLeave() {
      pointer.active = false;
    }

    function onVisibilityChange() {
      if (document.hidden) pause();
      else play();
    }

    function onMotionPreferenceChange() {
      if (reduceMotion.matches) pause();
      else play();
    }

    scatterChips(chips, bounds);
    chips.forEach(draw);

    field.addEventListener('pointermove', onPointerMove);
    field.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    reduceMotion.addEventListener('change', onMotionPreferenceChange);

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(field);

    // Nothing is gained by animating a field nobody is looking at.
    const viewObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) play();
        else pause();
      }
    });
    viewObserver.observe(field);

    return () => {
      pause();
      field.removeEventListener('pointermove', onPointerMove);
      field.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reduceMotion.removeEventListener('change', onMotionPreferenceChange);
      resizeObserver.disconnect();
      viewObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      className="relative h-65 overflow-hidden rounded-xl border border-border bg-background bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:22px_22px] lg:h-75"
    >
      {CHAOS_SOURCES.map((source) => (
        <span
          key={source.name}
          data-chip
          className="absolute top-0 left-0 grid size-[46px] place-items-center rounded-xl border border-border bg-muted text-muted-foreground will-change-transform"
        >
          {source.icon}
        </span>
      ))}
    </div>
  );
}
