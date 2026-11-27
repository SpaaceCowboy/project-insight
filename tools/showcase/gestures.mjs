// Writes a showcase Autopilot timeline (app/src/showcase/.../Autopilot.kt: lines of "ms action x y", action d|m|u, raw window pixels).
//   node tools/showcase/gestures.mjs steps.json > g.txt        steps.json: [{"tap":[x,y],"at":ms,"hold":ms}, {"swipe":[x1,y1,x2,y2],"at":ms,"ms":duration}]
//   node tools/showcase/gestures.mjs --scale 1.5 old-g.txt > g.txt    the same gestures at 1.5x the pace (times only; the app's own animations are unchanged)
// A swipe is sampled every 8 ms along an ease that keeps some speed at the end, so the pager is released with a real fling velocity and settles on the next page.
import { readFileSync } from 'node:fs';

const STEP_MS = 8;
const ease = (t) => 0.7 * t * t * (3 - 2 * t) + 0.3 * t;   // smoothstep mixed with a straight line: slow start, never stops dead at the end

function steps(list) {
  const out = [];
  for (const s of list) {
    if (s.tap) {
      const [x, y] = s.tap;
      out.push([s.at, 'd', x, y], [s.at + (s.hold ?? 80), 'u', x, y]);
    } else if (s.swipe) {
      const [x1, y1, x2, y2] = s.swipe, n = Math.max(2, Math.round(s.ms / STEP_MS));
      out.push([s.at, 'd', x1, y1]);
      for (let i = 1; i <= n; i++) { const e = ease(i / n); out.push([s.at + i * STEP_MS, i < n ? 'm' : 'u', Math.round(x1 + (x2 - x1) * e), Math.round(y1 + (y2 - y1) * e)]); }
    } else throw new Error(`unknown step ${JSON.stringify(s)}`);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

const args = process.argv.slice(2);
let lines;
if (args[0] === '--scale') {
  const k = Number(args[1]);
  if (!(k > 0)) throw new Error('--scale needs a factor above 0');
  lines = readFileSync(args[2], 'utf8').split('\n').filter((l) => l.trim()).map((l) => { const [ms, a, x, y] = l.trim().split(' '); return [Math.round(Number(ms) * k), a, x, y]; });
} else {
  lines = steps(JSON.parse(readFileSync(args[0], 'utf8')));
}
process.stdout.write(lines.map((l) => l.join(' ')).join('\n') + '\n');
