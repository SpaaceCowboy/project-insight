import type { PoolClient } from 'pg';
import { requireValue } from './rules.js';
import { NAME_MESSAGES, usernameProblem } from './username.js';

/**
 * A username for registration or rename: English letters, numbers, spaces, _ and -, 3–20 characters, no profanity, hate speech, violence or reserved names
 * (see username.ts). The chosen spelling is kept; compatibility characters and spacing are normalised. Existing accounts are not re-checked.
 */
export function nickname(value: string): string {
  const { name, problem } = usernameProblem(value);
  requireValue(!problem, problem ?? 'NAME_CHARACTERS', problem ? NAME_MESSAGES[problem] : '');
  return name;
}

export async function claimNickname(c: PoolClient, name: string, owner: string | null = null) {
  // Use precisely the same normalization as the unique index, including for concurrent registrations/renames.
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || lower(normalize($2, NFKC)),0))', ['username:', name]);
  const exists = await c.query('SELECT 1 FROM users WHERE lower(normalize(username, NFKC))=lower(normalize($1, NFKC)) AND ($2::uuid IS NULL OR id<>$2)', [name, owner]);
  requireValue(!exists.rowCount, 'NAME_TAKEN', 'That username is already taken. Choose another.', 409);
}
