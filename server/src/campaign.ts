import { readFileSync } from 'node:fs';
import type { Puzzle } from './rules.js';
export interface CampaignLevel extends Puzzle { name: string; world: number; par: number }
export const campaign = JSON.parse(readFileSync(new URL('../../app/src/main/assets/levels.json', import.meta.url), 'utf8')) as CampaignLevel[];
export const badgeIds = ['first', 'flow', 'halfway', 'complete', 'first-clean', 'steady', 'unbroken', 'flawless', 'clean-sweep', 'pristine', ...new Set(campaign.map(l => `world-${l.world}`))];
export function earnedBadges(done: number[]): string[] {
  const solved = new Set(done); const result: string[] = [];
  if (solved.size >= 1) result.push('first', 'first-clean');
  if (solved.size >= 10) result.push('flow', 'steady');
  if (solved.size >= 25) result.push('unbroken');
  if (solved.size >= 50) result.push('halfway', 'flawless');
  if (solved.size === campaign.length) result.push('complete', 'pristine');
  const worlds = [...new Set(campaign.map(l => l.world))].filter(w => campaign.every((l, i) => l.world !== w || solved.has(i + 1)));
  if (worlds.length) result.push('clean-sweep');
  return [...result, ...worlds.map(w => `world-${w}`)];
}
