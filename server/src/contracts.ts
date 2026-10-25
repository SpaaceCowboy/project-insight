/** Response allowlists are also the public OpenAPI types; credentials and internal rows cannot leak. */
const text = { type: 'string' }; const integer = { type: 'integer' }; const boolean = { type: 'boolean' };
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const array = (items: object) => ({ type: 'array', items });
const board = array(text);
const user = object({ id: text, username: text, verified: boolean });
const progressFields = { level: integer, xpMilli: text, levelStartMilli: text, nextLevelMilli: nullable(text) };
const gridFields = { id: text, ownerId: text, levelNumber: nullable(integer), code: text, start: board, target: board, hidden: boolean, moderated: boolean, publishedAt: nullable(text), username: text };
const grid = object({ ...gridFields, completed: boolean, beatenCount: integer, failedAttemptCount: integer, popularity: integer, likeCount: integer, liked: boolean, bookmarked: boolean }, Object.keys(gridFields));
const creator = object({ id: text, username: text, gridCount: integer, beatenCount: integer, likeCount: integer, ...progressFields }, ['id', 'username', 'gridCount', 'beatenCount', 'level', 'xpMilli', 'levelStartMilli', 'nextLevelMilli']);
const socialProgress = { onlineSolved: integer, designedCount: integer, bestStreak: integer };
const page = object({ items: array(grid), nextPage: nullable(integer) });
const accepted = object({ accepted: boolean, message: text }, ['accepted']);
const tokenResponse = object({ accessToken: text, refreshToken: text, user });
const responses: Record<string, object> = {
  'GET /health': object({ status: text }),
  'GET /v1/capabilities': object({ emailDelivery: text }),
  'GET /v1/account': object({ user }),
  'POST /v1/auth/register': tokenResponse, 'POST /v1/auth/login': tokenResponse, 'POST /v1/auth/refresh': tokenResponse,
  'GET /v1/progress': object({ done: array(integer), communityDone: array(text), badges: array(text), ...socialProgress, ...progressFields }),
  'POST /v1/progress/import': object({ accepted: boolean, awardedMilli: text }),
  'GET /v1/profiles/:id': object({ id: text, username: text, gridCount: integer, campaignCount: integer, communityCount: integer, beatenCount: integer, badges: array(text), followerCount: integer, followingCount: integer, bookmarkCount: integer, following: boolean, streak: integer, ...progressFields }),
  'GET /v1/grids': page,
  'POST /v1/grids': object({ id: text, code: text, levelNumber: integer, awardedMilli: text }),
  'GET /v1/creators': object({ items: array(creator), nextPage: nullable(integer) }),
  'GET /v1/following': object({ items: array(creator), nextPage: nullable(integer) }),
  'GET /v1/followers': object({ items: array(creator), nextPage: nullable(integer) }),
  'POST /v1/feedback': object({ accepted: boolean }),
  'POST /v1/users/:id/follow': object({ following: boolean, followerCount: integer }),
  'POST /v1/grids/:id/like': object({ liked: boolean, likeCount: integer }),
  'POST /v1/grids/:id/bookmark': object({ bookmarked: boolean }),
  'GET /v1/grids/code/:code': object({ grid }),
  'POST /v1/casual/sessions': object({ sessionId: nullable(text), grid: nullable(grid) }),
  'POST /v1/grids/:id/sessions': object({ sessionId: text, grid }),
  'POST /v1/completions': object({ accepted: boolean, awardedMilli: text, ...progressFields }),
};
export function responseSchema(method: string, url: string): object | undefined {
  if (responses[`${method} ${url}`]) return responses[`${method} ${url}`];
  if (url.startsWith('/v1/') && (method === 'POST' || method === 'PATCH')) return accepted;
  return undefined;
}
