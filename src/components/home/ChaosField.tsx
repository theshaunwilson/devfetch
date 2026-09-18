'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Matches the rendered chip size below; the physics needs it in numbers. */
const SIZE = 46;
/** px/second the icons settle back to once a shove has bled off. */
const DRIFT = 15;
const MIN_SPEED = DRIFT * 0.65;
const MAX_SPEED = 260;
const REPEL_RADIUS = 130;
const REPEL_FORCE = 1500;

interface Chip {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  spin: number;
  tilt: number;
  pulse: number;
}

interface ChaosSource {
  name: string;
  icon: ReactNode;
}

/*
 * The eight places a developer's knowledge actually lives. Simplified marks
 * drawn by hand rather than official brand assets, and decorative: the whole
 * field is `aria-hidden`, so none of them needs a label.
 *
 * The filled marks carry more ink than the stroked ones and read brighter at
 * the same colour, so each is pulled back with `opacity-80` to match.
 */
const CHAOS_SOURCES: ChaosSource[] = [
  {
    name: 'Notion',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <rect x="3.5" y="2.5" width="17" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 17V8l6 8.2V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="size-5.5 opacity-80">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    ),
  },
  {
    name: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5.5 opacity-80">
        <path d="M5.1 15.1a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1Zm1.05 0a2.1 2.1 0 0 1 4.2 0v5.25a2.1 2.1 0 1 1-4.2 0V15.1Z" />
        <path d="M8.25 5.1a2.1 2.1 0 1 1 2.1-2.1v2.1h-2.1Zm0 1.05a2.1 2.1 0 0 1 0 4.2H3a2.1 2.1 0 0 1 0-4.2h5.25Z" />
        <path d="M18.9 8.25a2.1 2.1 0 1 1 2.1 2.1h-2.1v-2.1Zm-1.05 0a2.1 2.1 0 0 1-4.2 0V3a2.1 2.1 0 1 1 4.2 0v5.25Z" />
        <path d="M15.75 18.9a2.1 2.1 0 1 1-2.1 2.1v-2.1h2.1Zm0-1.05a2.1 2.1 0 0 1 0-4.2H21a2.1 2.1 0 0 1 0 4.2h-5.25Z" />
      </svg>
    ),
  },
  {
    name: 'VS Code',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5.5 opacity-80">
        <path d="M17.6 2.2 9.8 9.5 5.6 6.3 4 7l3.4 5L4 17l1.6.7 4.2-3.2 7.8 7.3L21 20V4l-3.4-1.8Zm.3 4.6v10.4l-5.4-5.2 5.4-5.2Z" />
      </svg>
    ),
  },
  {
    name: 'Browser tabs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 10h19M9 4.5V10M15 4.5V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Terminal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <path d="m4 17 6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Text file',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 2v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: 'Bookmark',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

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
    const bounds = { w: field.clientWidth, h: field.clientHeight };
    const pointer = { x: 0, y: 0, active: false };
    let running = false;
    let frame = 0;
    let last = 0;

    const chips: Chip[] = elements.map((el, i) => {
      const angle = Math.random() * Math.PI * 2;
      return {
        el,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * DRIFT,
        vy: Math.sin(angle) * DRIFT,
        phase: Math.random() * Math.PI * 2,
        spin: 0.5 + Math.random() * 0.45,
        tilt: 6 + Math.random() * 5,
        pulse: 0.7 + (i % 3) * 0.16,
      };
    });

    function clamp(chip: Chip) {
      const maxX = Math.max(bounds.w - SIZE, 0);
      const maxY = Math.max(bounds.h - SIZE, 0);
      chip.x = Math.min(Math.max(chip.x, 0), maxX);
      chip.y = Math.min(Math.max(chip.y, 0), maxY);
    }

    /** Jittered grid, so no two icons start stacked on each other. */
    function scatter() {
      const cols = 4;
      const rows = Math.ceil(chips.length / cols);
      const cellW = Math.max(bounds.w / cols, SIZE);
      const cellH = Math.max(bounds.h / rows, SIZE);

      chips.forEach((chip, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        chip.x = col * cellW + Math.random() * Math.max(cellW - SIZE, 0);
        chip.y = row * cellH + Math.random() * Math.max(cellH - SIZE, 0);
        clamp(chip);
      });
    }

    function draw(chip: Chip) {
      const rot = Math.sin(chip.phase * chip.spin) * chip.tilt;
      const scale = 1 + Math.sin(chip.phase * chip.pulse) * 0.055;
      chip.el.style.transform = `translate3d(${chip.x.toFixed(2)}px,${chip.y.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }

    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const maxX = Math.max(bounds.w - SIZE, 0);
      const maxY = Math.max(bounds.h - SIZE, 0);

      for (const chip of chips) {
        if (pointer.active) {
          const dx = chip.x + SIZE / 2 - pointer.x;
          const dy = chip.y + SIZE / 2 - pointer.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < REPEL_RADIUS) {
            const push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;
            chip.vx += (dx / dist) * push;
            chip.vy += (dy / dist) * push;
          }
        }

        // Bleed the shove off over about a second, and keep a slow drift going
        // so the field never settles into stillness.
        const speed = Math.sqrt(chip.vx * chip.vx + chip.vy * chip.vy);
        if (speed < 0.001) {
          const a = Math.random() * Math.PI * 2;
          chip.vx = Math.cos(a) * DRIFT;
          chip.vy = Math.sin(a) * DRIFT;
        } else {
          let target = speed;
          if (speed > DRIFT) {
            target = DRIFT + (speed - DRIFT) * Math.pow(0.28, dt);
          } else if (speed < MIN_SPEED) {
            target = MIN_SPEED;
          }
          if (target > MAX_SPEED) target = MAX_SPEED;
          chip.vx *= target / speed;
          chip.vy *= target / speed;
        }

        chip.x += chip.vx * dt;
        chip.y += chip.vy * dt;

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

        chip.phase += dt;
        draw(chip);
      }

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
      for (const chip of chips) {
        clamp(chip);
        draw(chip);
      }
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

    scatter();
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
