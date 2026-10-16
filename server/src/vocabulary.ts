import { requireValue } from './rules.js';

// Reviewed combinations for world/grid titles. Account nicknames are separately validated free text.
export const vocabulary = {
  version: 1,
  first: ['Amber', 'Calm', 'Clear', 'Gentle', 'Golden', 'Quiet', 'Silver', 'Soft', 'Still', 'Warm'],
  second: ['Brook', 'Cove', 'Dawn', 'Fern', 'Grove', 'Leaf', 'Meadow', 'Pebble', 'Pool', 'Tide'],
};
export function safeName(value: string): string {
  requireValue(vocabulary.first.some(a => vocabulary.second.some(b => value === `${a} ${b}`)), 'INVALID_NAME', 'Choose a name from the word picker.');
  return value;
}
