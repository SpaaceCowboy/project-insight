import { readFileSync } from 'node:fs';
import type { Puzzle } from './rules.js';
export interface CampaignLevel extends Puzzle { par: number }
export const campaign = JSON.parse(readFileSync(new URL('../../app/src/main/assets/levels.json', import.meta.url), 'utf8')) as CampaignLevel[];
// One badge for the first level, one every 30 levels, and one for the whole campaign. Must match app Achievements.kt.
const milestones = Array.from({ length: Math.ceil(campaign.length / 30) - 1 }, (_, i) => (i + 1) * 30);
export const badgeIds = ['first', ...milestones.map(n => `levels-${n}`), 'complete'];
export function earnedBadges(done: number[]): string[] {
  const solved = new Set(done.filter(n => n >= 1 && n <= campaign.length)).size;
  return [
    ...(solved >= 1 ? ['first'] : []),
    ...milestones.filter(n => solved >= n).map(n => `levels-${n}`),
    ...(solved === campaign.length ? ['complete'] : []),
  ];
}
