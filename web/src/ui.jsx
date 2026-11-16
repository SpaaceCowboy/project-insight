import {useEffect, useRef, useState} from 'react';
import {PLAY_URL} from './config.js';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const line = {fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round'};
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  play: 'M7 4.5v15l12-7.5-12-7.5Z',
};
export function Icon({name}) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...line}><path d={PATHS[name]} /></svg>;
}

/** The Pearl tile's ring and ticks: Midori's app icon. */
export function Mark() {
  return <svg className="mark" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
    <circle cx="24" cy="24" r="10" strokeWidth="4" /><path d="M24 6v8M24 34v8M6 24h8M34 24h8" strokeWidth="3.6" />
  </svg>;
}

export function PlayButton({className = 'primary'}) {
  if (!PLAY_URL) return <span className="key" aria-disabled="true"><Icon name="play" /><span>Coming soon to Google Play</span></span>;
  return <a className={'key ' + className} href={PLAY_URL} rel="noopener"><Icon name="play" /><span>Get it on Google Play</span></a>;
}

/**
 * Ui.kt pressProgress: a raised key sinks the moment it is touched and, even for a very quick tap, stays down for
 * a beat before it springs back, so no press ever happens without being seen. One listener serves every key.
 */
export function installPress() {
  const MIN_MS = 90;
  let node = null, since = 0, timer = null;
  const lift = target => target.removeAttribute('data-pressed');
  function press(event) {
    const target = event.target.closest?.('.key, .pick');
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    clearTimeout(timer);
    if (node && node !== target) lift(node);
    node = target; since = performance.now(); target.setAttribute('data-pressed', '');
  }
  function release() {
    const target = node;
    if (!target) return;
    clearTimeout(timer);
    timer = setTimeout(() => { lift(target); if (node === target) node = null; }, Math.max(0, MIN_MS - (performance.now() - since)));
  }
  document.addEventListener('pointerdown', event => { if (event.button === 0) press(event); });
  document.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) press(event); });
  for (const type of ['pointerup', 'pointercancel', 'keyup', 'blur']) window.addEventListener(type, release);
}

/** True while the element is on screen (or, with `once`, from the first time it is). */
export function useInView({once = false, threshold = .2} = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); if (once) observer.disconnect(); }
      else if (!once) setInView(false);
    }, {threshold});
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, inView];
}

/** Adds `live` while on screen, so looping animation only runs when it can be seen. */
export function Live({as: Tag = 'div', className = '', once = false, threshold, ...props}) {
  const [ref, inView] = useInView({once, threshold});
  return <Tag ref={ref} className={className + (inView ? ' live' : '')} {...props} />;
}

/**
 * A capture of the game in a phone frame, from public/shots/<name>-<light|dark>[-1x]: a still (.webp), or with `loop` a
 * muted video (.webm, .mp4) over its first frame (.webp). The loop runs only while it is on screen and motion is welcome.
 */
// Each capture exists 640 wide and 320 wide ("-1x"). A video cannot choose by density itself, and a browser scaling the large
// one down to a standard-density screen blurs the game's small text, so the choice is made here.
const RENDITION = window.devicePixelRatio < 1.5 ? '-1x' : '';
export function Shot({name, label, loop = false}) {
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!loop) return;
    const sync = () => ref.current.querySelectorAll('video').forEach(video => {
      // offsetParent is null for the theme that is not displayed.
      if (inView && video.offsetParent && !reducedMotion()) video.play().catch(() => { /* the poster stays */ });
      else video.pause();
    });
    sync();
    // The header's theme toggle swaps which capture is displayed.
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {attributeFilter: ['data-theme']});
    return () => observer.disconnect();
  }, [inView, loop]);
  return <figure ref={ref} className="phone shot" role="img" aria-label={label}>
    {['light', 'dark'].map(theme => {
      const base = `/shots/${name}-${theme}`, src = base + RENDITION;
      return loop
        ? <video key={theme} className={theme} muted loop playsInline preload="none" poster={src + '.webp'} width="640" height="1322" aria-hidden="true">
          <source src={src + '.webm'} type="video/webm" /><source src={src + '.mp4'} type="video/mp4" />
        </video>
        : <img key={theme} className={theme} src={base + '.webp'} srcSet={`${base}-1x.webp 1x, ${base}.webp 2x`} alt="" loading="lazy" decoding="async" width="640" height="1322" />;
    })}
  </figure>;
}

/** A section heading that rises out of a mask the first time it is seen. */
export function Heading({children, sub}) {
  const [ref, inView] = useInView({once: true, threshold: .4});
  return <div ref={ref} className={'section-head' + (inView ? ' in' : '')}>
    <h2><span>{children}</span></h2>
    {sub && <p>{sub}</p>}
  </div>;
}

/** Leans a panel towards the mouse and moves its sheen with it. Touch and pen are left alone. */
export const tilt = {
  onPointerMove(event) {
    if (event.pointerType !== 'mouse' || reducedMotion()) return;
    const node = event.currentTarget, box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
    node.style.setProperty('--ry', ((x - .5) * 5).toFixed(2) + 'deg');
    node.style.setProperty('--rx', ((.5 - y) * 4).toFixed(2) + 'deg');
    node.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    node.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  },
  onPointerLeave(event) {
    event.currentTarget.style.removeProperty('--rx'); event.currentTarget.style.removeProperty('--ry');
  },
};
