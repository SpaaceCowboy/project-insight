import { usernameWords } from './username-words.js';

export const NAME_MIN = 3;
export const NAME_MAX = 20;

export type NameProblem = 'NAME_CHARACTERS' | 'NAME_LENGTH' | 'NAME_HATE' | 'NAME_VIOLENCE' | 'NAME_PROFANITY' | 'NAME_RESERVED';

/** Player-facing reasons, in English; the app translates them by code. */
export const NAME_MESSAGES: Record<NameProblem, string> = {
  NAME_CHARACTERS: 'Use only English letters, numbers, _ and -. No spaces.',
  NAME_LENGTH: `Choose a username of ${NAME_MIN}–${NAME_MAX} characters.`,
  NAME_HATE: "Usernames can't contain hateful or discriminatory language.",
  NAME_VIOLENCE: "Usernames can't contain violent or threatening language.",
  NAME_PROFANITY: "Usernames can't contain profanity or sexual language.",
  NAME_RESERVED: 'That username is reserved. Please choose another.',
};

/** A word as a pattern that also accepts stretched spellings: "fuuuck" and "asss" match, but "bob" does not match "boob" and "niigata" does not match "nigga". */
const stretched = (word: string) => word.replace(/(.)\1*/gu, (run, ch: string) => `${ch}{${run.length},}`);
const DIGIT_LETTERS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g' };

interface Words { exact: RegExp[]; roots: RegExp[] }
const words = (list: { readonly exact: readonly string[]; readonly contains: readonly string[] }): Words =>
  ({ exact: list.exact.map(w => new RegExp(`^${stretched(w)}$`, 'u')), roots: list.contains.map(w => new RegExp(stretched(w), 'u')) });
// Checked in this order, so a name that is both hateful and rude gets the stronger explanation.
const CHECKS: [NameProblem, Words][] = [
  ['NAME_HATE', words(usernameWords.hate)], ['NAME_VIOLENCE', words(usernameWords.violence)], ['NAME_PROFANITY', words(usernameWords.profanity)],
];
const RESERVED = words(usernameWords.reserved);

/** The ways one word is read: as typed, with digits as the letters they imitate, with digits dropped, and with look-alike spellings (v for u, ph for f). */
function readings(tokens: string[]): string[][] {
  const letters = (t: string) => t.replace(/[^a-z]/gu, '');
  const leet = tokens.map(t => letters([...t].map(ch => DIGIT_LETTERS[ch] ?? ch).join('')));
  return [
    tokens,
    leet,
    tokens.map(t => letters(t)),
    leet.map(t => t.replace(/v/gu, 'u').replace(/ph/gu, 'f')),
  ].map(r => r.filter(Boolean));
}

/**
 * What a name is tested as: every word on its own, runs of single letters joined ("f u c k"), neighbouring words joined for phrases,
 * and short fragments joined ("fu ck"). Longer words are never glued together, so "Wash It" stays fine.
 */
function candidates(tokens: string[]): { whole: string[]; inside: string[] } {
  const whole = [...tokens]; const inside = [...tokens];
  let run = '';
  for (const t of [...tokens, '']) {
    if (t.length === 1) { run += t; continue; }
    if (run.length > 1) { whole.push(run); inside.push(run); }
    run = '';
  }
  for (let size = 2; size <= 4; size++) for (let i = 0; i + size <= tokens.length; i++) {
    const window = tokens.slice(i, i + size);
    whole.push(window.join(''));
    if (size <= 3 && window.every(t => t.length <= 3)) inside.push(window.join(''));
  }
  return { whole, inside };
}

function matches(list: Words, tokens: string[]): boolean {
  const { whole, inside } = candidates(tokens);
  return whole.some(c => list.exact.some(r => r.test(c))) || inside.some(c => list.roots.some(r => r.test(c)));
}

const PIECE_MIN = 3;
// Every banned word as a whole-piece pattern, with the category it belongs to (index in CHECKS, strongest first).
const PIECES = CHECKS.map(([, list]) => [...list.exact, ...list.roots.map(r => new RegExp(`^${r.source}$`, 'u'))]);
const pieceRanks = new Map<string, number>();
/** The strongest category (index in CHECKS) a piece is a banned word of, or -1. */
function pieceRank(piece: string): number {
  let rank = pieceRanks.get(piece);
  if (rank === undefined) pieceRanks.set(piece, rank = PIECES.findIndex(list => list.some(r => r.test(piece))));
  return rank;
}

/**
 * Banned words glued together ("killjew", "dickass") are one token that no whole-word pattern matches. A token that is nothing but two or more banned words,
 * with no letter left over, is refused with the strongest category among them. Anything left over ("Assassin" is ass + ass + "in") keeps the name fine.
 */
function combination(tokens: string[]): number {
  let best = -1;
  for (const token of tokens) {
    // one[i] / many[i]: strongest category when token[0, i) is exactly one banned word / two or more; Infinity when it cannot be split that way.
    const n = token.length;
    const one = Array<number>(n + 1).fill(Infinity); const many = Array<number>(n + 1).fill(Infinity);
    for (let i = PIECE_MIN; i <= n; i++) for (let j = 0; j <= i - PIECE_MIN; j++) {
      const rank = pieceRank(token.slice(j, i));
      if (rank < 0) continue;
      if (j === 0) one[i] = Math.min(one[i] ?? Infinity, rank);
      else {
        const single = one[j] ?? Infinity; const pair = many[j] ?? Infinity;
        if (single !== Infinity || pair !== Infinity) many[i] = Math.min(many[i] ?? Infinity, rank, single, pair);
      }
    }
    const glued = many[n] ?? Infinity;
    if (glued !== Infinity && (best < 0 || glued < best)) best = glued;
  }
  return best;
}

/** The first rule a (already normalised) name breaks, or null. Only the allowed characters are expected here. */
export function bannedReason(name: string): NameProblem | null {
  const tokens = name.toLowerCase().split(/[ _-]+/u).filter(Boolean);
  const reads = readings(tokens);
  for (const [problem, list] of CHECKS) if (reads.some(r => matches(list, r))) return problem;
  const glued = Math.min(...reads.map(r => { const rank = combination(r); return rank < 0 ? Infinity : rank; }));
  if (glued !== Infinity) return CHECKS[glued]![0];
  // Reserved names are judged as a whole ("Insight_Fan" is fine, "Insight" and "Admin_1" are not).
  if (reads.some(r => { const all = r.join(''); return RESERVED.exact.some(x => x.test(all)) || RESERVED.roots.some(x => x.test(all)); })) return 'NAME_RESERVED';
  return null;
}

/**
 * Normalises a typed username (compatibility characters, spacing) and says why it cannot be used, if it cannot. Mirrors the app's UsernameFilter.
 * Spaces are refused (v0.2.31), never quietly replaced, so the player sees why; the word checks below still split on _ and -.
 */
export function usernameProblem(value: string): { name: string; problem: NameProblem | null } {
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!/^[A-Za-z0-9_-]*$/u.test(name) || !/[A-Za-z0-9]/u.test(name)) return { name, problem: 'NAME_CHARACTERS' };
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { name, problem: 'NAME_LENGTH' };
  return { name, problem: bannedReason(name) };
}
