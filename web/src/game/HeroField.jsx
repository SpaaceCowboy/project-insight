import {useEffect, useRef} from 'react';
import {PuzzleRules as Rules} from './rules.js';
import {ICONS} from './tileArt.js';

const COLORS = {R: ['#E09A91', '#AE546B'], B: ['#93D2DB', '#3B88A6'], G: ['#A6D7AD', '#4B896B'], Y: ['#F0D38B', '#B88A43'], P: ['#C9B8E1', '#8464A9'], W: ['#F3F4DF', '#C3CFBC']};
const BAG = 'RRRBBBGGGYYYPPW';
const SIZE = 54, GAP = 12, STEP = SIZE + GAP, SWAP_MS = 520, GLOW = 180;
const ease = t => 1 - Math.pow(1 - t, 4);

function sprite(type, dpr) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(SIZE * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const fill = g.createLinearGradient(0, 0, SIZE, SIZE);
  fill.addColorStop(0, COLORS[type][0]); fill.addColorStop(1, COLORS[type][1]);
  g.fillStyle = fill; g.beginPath(); g.roundRect(0, 0, SIZE, SIZE, SIZE * .23); g.fill();
  g.translate(SIZE * .28, SIZE * .28); g.scale(SIZE * .44 / 48, SIZE * .44 / 48);
  g.strokeStyle = type === 'W' ? '#45474C' : '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  if (type === 'W') {
    g.lineWidth = 4; g.beginPath(); g.arc(24, 24, 10, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3.6; g.stroke(new Path2D('M24 6v8M24 34v8M6 24h8M34 24h8'));
  } else { g.lineWidth = type === 'P' ? 3.4 : 4.2; g.stroke(new Path2D(ICONS[type])); }
  return canvas;
}

/**
 * The hero's backdrop: a wide, faint board that keeps playing itself. Every swap is a legal move
 * under the game's rules, lights up as it happens, and tiles near the pointer brighten.
 * It idles when off screen or hidden, and stands still under reduced motion.
 */
export default function HeroField() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current, host = canvas.parentElement, ctx = canvas.getContext('2d');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0, height = 0, cols = 0, rows = 0, dpr = 1, base = .14, originX = 0;
    let grid = [], heat = new Float32Array(0), quiet = new Float32Array(0), sprites = {}, swaps = [];
    let pointer = null, frame = null, last = 0, nextSwap = 0, visible = false;

    function layout() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height; dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      cols = Math.ceil(width / STEP) + 1; rows = Math.ceil(height / STEP) + 1;
      originX = (width - (cols * STEP - GAP)) / 2;
      grid = Array.from({length: rows}, () => Array.from({length: cols}, () => Math.random() < .2 ? '.' : BAG[Math.floor(Math.random() * BAG.length)]));
      heat = new Float32Array(rows * cols); quiet = new Float32Array(rows * cols).fill(1); swaps = [];
      // Tiles sitting under the copy and the playable board stay dim so they never fight the content.
      for (const node of host.querySelectorAll('.hero-copy,.hero-more,.stage')) {
        const box = node.getBoundingClientRect(), pad = 14;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = rect.left + originX + c * STEP, y = rect.top + r * STEP;
          if (x + SIZE > box.left - pad && x < box.right + pad && y + SIZE > box.top - pad && y < box.bottom + pad) quiet[r * cols + c] = .22;
        }
      }
      base = parseFloat(getComputedStyle(canvas).getPropertyValue('--field-alpha')) || .14;
      for (const type of 'RBGYPW') sprites[type] = sprite(type, dpr);
      draw(performance.now());
    }
    function near(x, y) {
      if (!pointer) return 0;
      const distance = Math.hypot(x + SIZE / 2 - pointer[0], y + SIZE / 2 - pointer[1]);
      return distance < GLOW ? .4 * (1 - distance / GLOW) ** 2 : 0;
    }
    function paint(type, x, y, alpha) {
      ctx.globalAlpha = Math.min(alpha, .85);
      ctx.drawImage(sprites[type], x, y, SIZE, SIZE);
    }
    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const busy = new Set(swaps.flatMap(swap => [swap.a, swap.b]));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const index = r * cols + c, type = grid[r][c];
        if (type === '.' || busy.has(index)) continue;
        const x = originX + c * STEP, y = r * STEP;
        paint(type, x, y, (base + heat[index] * .5 + near(x, y)) * quiet[index]);
      }
      for (const swap of swaps) {
        const t = ease(Math.min(1, (now - swap.start) / SWAP_MS)), lift = Math.sin(Math.PI * t) * .55;
        const ax = originX + (swap.a % cols) * STEP, ay = Math.floor(swap.a / cols) * STEP;
        const bx = originX + (swap.b % cols) * STEP, by = Math.floor(swap.b / cols) * STEP;
        const dim = Math.min(quiet[swap.a], quiet[swap.b]);
        if (swap.to !== '.') paint(swap.to, bx + (ax - bx) * t, by + (ay - by) * t, (base + lift * .5) * dim);
        paint(swap.from, ax + (bx - ax) * t, ay + (by - ay) * t, (base + lift) * dim);
      }
      ctx.globalAlpha = 1;
    }
    function spawn(now) {
      for (let attempt = 0; attempt < 14; attempt++) {
        const r = Math.floor(Math.random() * rows), c = Math.floor(Math.random() * cols);
        const options = Rules.legalMoves(grid, r, c).filter(([nr, nc]) => grid[nr][nc] !== grid[r][c]);
        if (!options.length) continue;
        const [nr, nc] = options[Math.floor(Math.random() * options.length)], a = r * cols + c, b = nr * cols + nc;
        if (swaps.some(swap => swap.a === a || swap.b === a || swap.a === b || swap.b === b)) continue;
        swaps.push({a, b, from: grid[r][c], to: grid[nr][nc], start: now});
        return;
      }
    }
    function tick(now) {
      frame = requestAnimationFrame(tick);
      const delta = Math.min(now - last, 64); last = now;
      for (let i = 0; i < heat.length; i++) if (heat[i] > 0) heat[i] = Math.max(0, heat[i] - delta / 1500);
      swaps = swaps.filter(swap => {
        if (now - swap.start < SWAP_MS) return true;
        const [ar, ac, br, bc] = [Math.floor(swap.a / cols), swap.a % cols, Math.floor(swap.b / cols), swap.b % cols];
        grid[ar][ac] = swap.to; grid[br][bc] = swap.from; heat[swap.b] = 1; heat[swap.a] = .5;
        return false;
      });
      if (now > nextSwap && swaps.length < 3) { spawn(now); nextSwap = now + 320 + Math.random() * 380; }
      draw(now);
    }
    function sync() {
      const run = visible && !document.hidden && !still;
      if (run && frame === null) { last = performance.now(); frame = requestAnimationFrame(tick); }
      if (!run && frame !== null) { cancelAnimationFrame(frame); frame = null; }
    }
    function move(event) {
      const rect = canvas.getBoundingClientRect();
      pointer = [event.clientX - rect.left, event.clientY - rect.top];
    }
    const leave = () => { pointer = null; };

    const resize = new ResizeObserver(layout); resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); seen.observe(canvas);
    const themed = new MutationObserver(layout); themed.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    document.addEventListener('visibilitychange', sync);
    if (!still) { host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave); }
    return () => {
      resize.disconnect(); seen.disconnect(); themed.disconnect();
      document.removeEventListener('visibilitychange', sync);
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(frame);
    };
  }, []);
  return <canvas ref={ref} className="hero-field" aria-hidden="true" />;
}
