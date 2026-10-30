// Online, design and daily-streak achievements. Campaign badges stay in campaign.ts. Must match app Achievements.kt.
export const ONLINE_GOALS = [1, 10, 20, 50, 100, 200, 500, 1000];
export const DESIGN_GOALS = [1, 10, 20, 50, 100];
export const STREAK_GOALS = [7, 14, 30, 50, 70, 100];
export const LEVEL_GOALS = [10, 20, 30, 50, 70, 100];
export const socialBadgeIds = [...ONLINE_GOALS.map(n => `online-${n}`), ...DESIGN_GOALS.map(n => `designed-${n}`), ...STREAK_GOALS.map(n => `streak-${n}`), ...LEVEL_GOALS.map(n => `level-${n}`)];
/** Player-level badges, read from the level itself (never stored), so they cannot drift from the XP ledger. */
export const levelBadges = (level: number): string[] => LEVEL_GOALS.filter(n => level >= n).map(n => `level-${n}`);
export interface SocialStats { onlineSolved: number; designedCount: number; bestStreak: number }
export function socialBadges(s: SocialStats): string[] {
  return [
    ...ONLINE_GOALS.filter(n => s.onlineSolved >= n).map(n => `online-${n}`),
    ...DESIGN_GOALS.filter(n => s.designedCount >= n).map(n => `designed-${n}`),
    ...STREAK_GOALS.filter(n => s.bestStreak >= n).map(n => `streak-${n}`),
  ];
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
export const dayText = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
/** Longest run of consecutive calendar days in [days] (any order, YYYY-MM-DD). */
export function longestRun(days: string[]): number {
  const sorted = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
  let best = 0, run = 0;
  sorted.forEach((d, i) => { run = i > 0 && d === sorted[i - 1]! + 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}
/** The streak still alive on [today]: consecutive days ending today, or yesterday if today has no solve yet. */
export function currentRun(days: string[], today: string): number {
  const set = new Set(days.map(dayNumber));
  let d = dayNumber(today);
  if (!set.has(d)) d -= 1;
  let run = 0;
  while (set.has(d)) { run++; d--; }
  return run;
}
/** A client's local date, accepted only within a day of the server's UTC date (time zones span about ±14 hours). */
export function acceptedDay(day: string | undefined, now = new Date()): string {
  const utc = Math.floor(now.getTime() / 86_400_000);
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Math.abs(dayNumber(day) - utc) <= 1 && dayText(dayNumber(day)) === day) return day;
  return dayText(utc);
}
