// One campaign: Game 1's levels followed by Game 2's, grouped into worlds of WORLD_SIZE by position.
import {CORE_LEVELS} from './levels.js';
import {GAME2_LEVELS} from './levels-2.js';

export const WORLD_SIZE = 20;
export const CAMPAIGN_LEVELS = [...CORE_LEVELS, ...GAME2_LEVELS].map((level, i) => ({...level, world: Math.floor(i / WORLD_SIZE) + 1}));
