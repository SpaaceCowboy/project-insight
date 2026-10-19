import type { PoolClient } from 'pg';
import { requireValue } from './rules.js';

/** Preserve the chosen spelling; normalize compatibility characters and spacing for uniqueness. */
export function nickname(value: string): string {
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const visible = /[\p{L}\p{N}\p{P}\p{S}]/u.test(name);
  // Keep Persian joining characters and emoji sequences, but reject hidden direction overrides/control text.
  const hidden = /\p{C}/u.test(name.replace(/[\u200c\u200d]/gu, ''));
  requireValue(visible && !hidden && [...name].length <= 32, 'INVALID_NICKNAME', 'Choose a username of 1–32 visible characters.');
  return name;
}

export async function claimNickname(c: PoolClient, name: string, owner: string | null = null) {
  // Use precisely the same normalization as the unique index, including for concurrent registrations/renames.
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || lower(normalize($2, NFKC)),0))', ['username:', name]);
  const exists = await c.query('SELECT 1 FROM users WHERE lower(normalize(username, NFKC))=lower(normalize($1, NFKC)) AND ($2::uuid IS NULL OR id<>$2)', [name, owner]);
  requireValue(!exists.rowCount, 'NAME_TAKEN', 'That username is already taken. Choose another.', 409);
}
