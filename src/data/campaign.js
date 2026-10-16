// One campaign: Game 1's levels, Game 2's, then studio levels, grouped into worlds of WORLD_SIZE by position.
// Only ever append: saved progress (web and Android) uses 1-based level positions.
import {CORE_LEVELS} from './levels.js';
import {GAME2_LEVELS} from './levels-2.js';
import {STUDIO_LEVELS} from './levels-3.js';
import {LEVEL_SOLUTIONS as SOLUTIONS_1} from './level-solutions.js';
import {LEVEL_SOLUTIONS as SOLUTIONS_2} from './level-solutions-2.js';
import {LEVEL_SOLUTIONS as SOLUTIONS_3} from './level-solutions-3.js';

export const WORLD_SIZE = 20;
export const CAMPAIGN_LEVELS = [...CORE_LEVELS, ...GAME2_LEVELS, ...STUDIO_LEVELS].map((level, i) => ({...level, world: Math.floor(i / WORLD_SIZE) + 1}));
export const CAMPAIGN_SOLUTIONS = [...SOLUTIONS_1, ...SOLUTIONS_2, ...SOLUTIONS_3];
