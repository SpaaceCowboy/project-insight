export const FIRST_XP = 100_000n;
export const REPLAY_XP = 10_000n;
export const REPLAY_DAILY_CAP = 50_000n;
export const CREATE_XP = 25_000n;
export const CREATE_DAILY_CAP = 50_000n;
export function threshold(level: number): bigint {
  const n = BigInt(Math.max(1, Math.min(100, level)) - 1);
  return (100n * n + 10n * n * (n - 1n)) * 1000n;
}
export function progression(xp: bigint) {
  let level = 1;
  while (level < 100 && xp >= threshold(level + 1)) level++;
  return { level, xpMilli: xp.toString(), levelStartMilli: threshold(level).toString(), nextLevelMilli: level === 100 ? null : threshold(level + 1).toString() };
}
