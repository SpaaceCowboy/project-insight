import { blockedWords } from './blocked-words.js';
import { requireValue } from './rules.js';

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const collapse = (s: string) => s.replace(/(.)\1+/gu, '$1');
const exact = new Set(blockedWords.exact.flatMap(w => [w, collapse(w)]));
const roots = blockedWords.contains.map(collapse);

function fold(value: string) {
  return [...value.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')].map(ch => LEET[ch] ?? ch).join('');
}

/**
 * Whole-word matches for short/ambiguous words, substring matches for long unambiguous roots.
 * Each whitespace-separated word is judged alone (so "Wash It" is fine); runs of single letters ("f u c k") are joined.
 */
export function isBlocked(value: string): boolean {
  const exactCandidates: string[] = []; const rootCandidates: string[] = []; let run = '';
  for (const word of [...fold(value).split(/\s+/u).filter(Boolean), '']) {
    const letters = word.replace(/[^a-z]/gu, '');
    if ([...word].length === 1 && letters.length === 1) { run += letters; continue; }
    if (run.length > 1) { exactCandidates.push(run); rootCandidates.push(run); }
    run = '';
    if (letters) { exactCandidates.push(letters); rootCandidates.push(letters); }
    exactCandidates.push(...word.split(/[^a-z]+/u).filter(Boolean));
  }
  return exactCandidates.some(t => exact.has(t) || exact.has(collapse(t))) || rootCandidates.some(t => roots.some(r => collapse(t).includes(r)));
}

export function worldName(value: string): string {
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const visible = /[\p{L}\p{N}\p{P}\p{S}]/u.test(name);
  const hidden = /\p{C}/u.test(name.replace(/[‌‍]/gu, ''));
  requireValue(visible && !hidden && [...name].length <= 32, 'INVALID_NAME', 'Choose a name of 1–32 visible characters.');
  requireValue(!isBlocked(name), 'INVALID_NAME', "That name isn't allowed. Please choose another.");
  return name;
}

export function levelName(value: string, number: number): string {
  return value.trim() === '' ? `Level ${number}` : worldName(value);
}
