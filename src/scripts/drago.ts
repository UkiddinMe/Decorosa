// The Drago page's street (stories/DragoStory.astro), on one frame loop. The dragon's body:
// the piece is its head, and from behind it a long scaled body snakes through the whole
// run, along the page's axis, over the wall and under everything hung on it. A fixed canvas
// draws only the stretch on screen, as short slices of a procedural sprite turned to the
// curve, so the scales bend with it; time and scroll both push the wave along. The
// lanterns: damped pendulums kicked by the scroll's speed and the pointer passing by,
// written to `--sway`. Under reduced motion the body is drawn still and nothing swings. The
// lazy Susan also turns when dragged (finger or mouse), written to `--spin`, and glides on
// when let go.
import { prefersReduced } from './motion';
import type { Axis } from './hscroll';

/** the sprite's height, and its repeat along the body */
const SPRITE = 320;
/** body slice length, CSS px */
const STEP = 6;
const MAX_SWAY = 20;
/** the Susan: nearer its centre than this (px) the finger's angle is too jumpy to follow */
const SPIN_DEAD_ZONE = 16;
/** the Susan's glide: how fast it dies away (ms), how long a finger may rest before letting
    go counts as having stopped (ms), and its top speed (deg/ms: a hard flick, a few turns) */
const GLIDE_DECAY = 900;
const GLIDE_REST = 80;
const GLIDE_MAX = 1.2;

const smooth = (t: number): number => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** The body's cross-section, one repeat twice over: fangs, trim, scales, trim (the piece's paint). */
function paintSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE * 2;
  sprite.height = SPRITE;
  const g = sprite.getContext('2d')!;
  const band = (y: number, h: number, colour: string): void => {
    g.fillStyle = colour;
    g.fillRect(0, y, sprite.width, h);
  };
  band(68, 218, '#14174a');
  // the scales: overlapping discs, lowest rows first, a pale ring in each
  g.save();
  g.beginPath();
  g.rect(0, 68, sprite.width, 218);
  g.clip();
  const r = 40;
  for (let row = 8; row >= 0; row--) {
    for (let col = -1; col <= sprite.width / (r * 2) + 1; col++) {
      const x = col * r * 2 + (row % 2 ? r : 0);
      const y = 40 + row * (r * 0.8);
      g.fillStyle = '#14174a';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#4d62ea';
      g.lineWidth = 7;
      g.beginPath();
      g.arc(x, y, r - 5, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#2b3bb0';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(x, y, r - 19, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
  band(36, 20, '#ee4a1e');
  band(56, 12, '#f2da5e');
  band(286, 14, '#f2da5e');
  band(300, 20, '#ee4a1e');
  // along its back the door's white teeth: scallops, with a fang every half repeat
  g.fillStyle = '#fbf8ef';
  for (let x = 0; x < sprite.width; x += 40) {
    if (x % 160 === 0) {
      g.beginPath();
      g.moveTo(x - 22, 37);
      g.quadraticCurveTo(x - 6, 22, x, 0);
      g.quadraticCurveTo(x + 8, 22, x + 22, 37);
      g.fill();
    } else {
      g.beginPath();
      g.arc(x, 37, 20, Math.PI, 0);
      g.fill();
    }
  }
  // round, like a body: darker at both edges, a sheen above the middle
  const shade = g.createLinearGradient(0, 36, 0, SPRITE);
  shade.addColorStop(0, 'rgb(40 0 20 / 0.5)');
  shade.addColorStop(0.3, 'rgb(255 255 255 / 0.1)');
  shade.addColorStop(0.55, 'rgb(0 0 0 / 0)');
  shade.addColorStop(1, 'rgb(10 0 30 / 0.65)');
  g.fillStyle = shade;
  g.globalCompositeOperation = 'source-atop';
  g.fillRect(0, 36, sprite.width, SPRITE - 36);
  return sprite;
}

/** The Susan dragged round (`touch-action: none` on the table keeps the page still): the
    turn follows the pointer's angle about the centre. `glide` is for the frame loop. */
function spinSusan(table: HTMLElement, turn: HTMLElement): { glide: (time: number) => void; stop: () => void } {
  let spin = 0; // deg
  let velocity = 0; // deg per ms
  let finger: number | null = null;
  let angle = 0;
  let moved = 0; // when the finger last moved
  let glided = 0; // when the glide last ran

  const write = (): void => turn.style.setProperty('--spin', spin.toFixed(2));
  const angleAt = (event: PointerEvent): { deg: number; off: number } => {
    const box = table.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    return { deg: (Math.atan2(dy, dx) * 180) / Math.PI, off: Math.hypot(dx, dy) };
  };
  const onDown = (event: PointerEvent): void => {
    if (finger !== null || event.button !== 0) return;
    event.preventDefault(); // no text selection or image drag from a mouse
    finger = event.pointerId;
    table.setPointerCapture(finger);
    angle = angleAt(event).deg;
    moved = event.timeStamp;
    velocity = 0;
  };
  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== finger) return;
    const { deg, off } = angleAt(event);
    if (off >= SPIN_DEAD_ZONE) {
      // the short way round, across the ±180° seam (screen angles run clockwise, as `rotate` does)
      const delta = ((deg - angle + 540) % 360) - 180;
      // touch events can arrive bunched, so a tiny dt says nothing about the speed
      const dt = Math.max(8, event.timeStamp - moved);
      const speed = velocity * 0.6 + (delta / dt) * 0.4;
      velocity = Math.max(-GLIDE_MAX, Math.min(GLIDE_MAX, speed));
      spin += delta;
      moved = event.timeStamp;
      write();
    }
    angle = deg;
  };
  // after pointerup and pointercancel alike
  const onLost = (event: PointerEvent): void => {
    if (event.pointerId !== finger) return;
    finger = null;
    if (event.timeStamp - moved > GLIDE_REST) velocity = 0;
  };
  table.addEventListener('pointerdown', onDown);
  table.addEventListener('pointermove', onMove);
  table.addEventListener('lostpointercapture', onLost);

  return {
    glide(time) {
      const dt = time - glided;
      glided = time;
      if (finger !== null || !velocity) return;
      spin += velocity * dt;
      velocity *= Math.exp(-dt / GLIDE_DECAY);
      if (Math.abs(velocity) < 0.002) velocity = 0;
      write();
    },
    stop() {
      table.removeEventListener('pointerdown', onDown);
      table.removeEventListener('pointermove', onMove);
      table.removeEventListener('lostpointercapture', onLost);
    },
  };
}

export function dragoStreet(viewport: HTMLElement, axis: Axis): () => void {
  const root = viewport.querySelector<HTMLElement>('[data-drago]');
  const canvas = viewport.querySelector<HTMLCanvasElement>('[data-dragon]');
  const hero = viewport.querySelector<HTMLElement>('[data-page-hero]');
  const end = viewport.querySelector<HTMLElement>('[data-body-end]');
  if (!root || !canvas || !hero || !end) return () => {};
  const ctx = canvas.getContext('2d')!;
  const sprite = paintSprite();
  const still = prefersReduced();
  const x = axis === 'x';

  let dpr = 1;
  let unit = 1; // the page's --u
  let screen = 0; // along the axis
  let head = 0; // the body's start, page px along the axis
  let tail = 0;
  let width = 0;
  let amp = 0;
  let wave = 1;
  let mid = 0; // the wave's centre line, across the axis

  const scroll = (): number => (x ? viewport.scrollLeft : viewport.scrollTop);

  function measure(): void {
    dpr = Math.min(devicePixelRatio, 2);
    const w = Math.round(canvas!.clientWidth * dpr);
    const h = Math.round(canvas!.clientHeight * dpr);
    if (canvas!.width !== w) canvas!.width = w;
    if (canvas!.height !== h) canvas!.height = h;
    unit = (x ? innerHeight : innerWidth) / 100;
    screen = x ? innerWidth : innerHeight;
    const stop = end!.getBoundingClientRect();
    const box = hero!.getBoundingClientRect();
    head = (x ? box.left + box.width / 2 : box.top + box.height / 2) + scroll();
    width = unit * (x ? 16 : 24);
    // runs on behind the last slice, so its end is never seen
    tail = (x ? stop.left : stop.top) + scroll() + width;
    amp = unit * (x ? 22 : 33);
    wave = unit * (x ? 150 : 190);
    mid = unit * (x ? 48 : 50);
  }

  /** where the body's centre line runs across the axis, at page position u */
  const cross = (u: number, phase: number): number => {
    const a = (u / wave) * Math.PI * 2 + phase;
    // starts dead behind the piece, swings out from there
    const grow = smooth((u - head) / (wave * 0.5));
    return mid + grow * amp * (0.82 * Math.sin(a) + 0.18 * Math.sin(a * 2.7 - phase));
  };

  function drawBody(time: number): void {
    const at = scroll();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    const from = Math.max(head, Math.floor((at - width) / STEP) * STEP);
    const to = Math.min(tail, at + screen + width);
    if (from >= to) return;
    const phase = time * 0.0007 + at * 0.0009;
    const texel = SPRITE / width;
    let turnedTo = 0;
    for (let u = from; u < to; u += STEP) {
      const c0 = cross(u, phase);
      const c1 = cross(u + STEP, phase);
      const along = u - at;
      const [px, py, dx, dy] = x ? [along, c0, STEP, c1 - c0] : [c0, along, c1 - c0, STEP];
      const length = Math.hypot(dx, dy);
      const cos = dx / length;
      const sin = dy / length;
      // slices fan open on the outside of a bend: each runs on far enough to close the gap
      const turn = Math.atan2(dy, dx);
      const close = u === from ? 0 : (Math.abs(turn - turnedTo) * width) / 2;
      turnedTo = turn;
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * px, dpr * py);
      const sx = (u * texel) % SPRITE;
      ctx.drawImage(sprite, sx, 0, STEP * texel, SPRITE, 0, -width / 2, length + 0.8 + close, width);
    }
  }

  const lanterns = Array.from(root.querySelectorAll<HTMLElement>('[data-lantern]')).map((el, i) => ({
    el,
    i,
    angle: 0,
    speed: 0,
    shown: 0,
  }));
  let lastScroll = scroll();
  let pointer: { x: number; y: number; dx: number; dy: number } | null = null;

  function swing(time: number): void {
    const at = scroll();
    const kick = at - lastScroll;
    lastScroll = at;
    const near = pointer;
    pointer = null;
    for (const l of lanterns) {
      if (near) {
        const box = l.el.getBoundingClientRect();
        const off = Math.hypot(box.left + box.width / 2 - near.x, box.top + box.height * 0.6 - near.y);
        if (off < box.width) l.speed += near.dx * 0.012;
      }
      // the scroll carries the street away, and the lantern lags behind it
      l.speed += (x ? 1 : 0.5) * kick * 0.0035;
      const breeze = Math.sin(time * 0.0007 + l.i * 1.9) * 1.1;
      l.speed += (breeze - l.angle) * 0.012;
      l.speed *= 0.982;
      l.angle = Math.max(-MAX_SWAY, Math.min(MAX_SWAY, l.angle + l.speed));
      if (Math.abs(l.angle - l.shown) > 0.03) {
        l.shown = l.angle;
        l.el.style.setProperty('--sway', l.angle.toFixed(2));
      }
    }
  }

  measure();
  const onResize = (): void => {
    measure();
    if (still) drawBody(0);
  };
  addEventListener('resize', onResize);
  // the slices settle after this runs (fonts, for one), and the head's place is on them
  const settled = new ResizeObserver(onResize);
  settled.observe(root);

  // even under reduced motion, or the table would just be a patch of page that won't scroll
  const table = root.querySelector<HTMLElement>('[data-susan]');
  const turn = root.querySelector<HTMLElement>('[data-turn]');
  const susan = table && turn ? spinSusan(table, turn) : null;

  if (still) {
    const draw = (): void => drawBody(0);
    drawBody(0);
    viewport.addEventListener('scroll', draw, { passive: true });
    return () => {
      susan?.stop();
      settled.disconnect();
      removeEventListener('resize', onResize);
      viewport.removeEventListener('scroll', draw);
    };
  }

  const onPointer = (event: PointerEvent): void => {
    pointer = {
      x: event.clientX,
      y: event.clientY,
      dx: event.movementX + (pointer?.dx ?? 0),
      dy: event.movementY + (pointer?.dy ?? 0),
    };
  };
  addEventListener('pointermove', onPointer, { passive: true });
  let frame = requestAnimationFrame(function tick(time: number) {
    drawBody(time);
    swing(time);
    susan?.glide(time);
    frame = requestAnimationFrame(tick);
  });
  return () => {
    cancelAnimationFrame(frame);
    susan?.stop();
    settled.disconnect();
    removeEventListener('resize', onResize);
    removeEventListener('pointermove', onPointer);
  };
}
