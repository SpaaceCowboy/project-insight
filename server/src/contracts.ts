/** Response allowlists are also the public OpenAPI types; credentials and internal rows cannot leak. */
const text = { type: 'string' }; const integer = { type: 'integer' }; const boolean = { type: 'boolean' };
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const array = (items: object) => ({ type: 'array', items });
const board = array(text);
const user = object({ id: text, username: text, verified: boolean });
const progressFields = { level: integer, xpMilli: text, levelStartMilli: text, nextLevelMilli: nullable(text) };
const world = object({ id: text, ownerId: text, name: text, icon: text, hidden: boolean, moderated: boolean, username: text, gridCount: integer, usedSlots: integer, popularity: integer });
const grid = object({ id: text, ownerId: text, worldId: nullable(text), name: text, code: text, start: board, target: board, hidden: boolean, moderated: boolean, publishedAt: nullable(text), worldName: nullable(text), username: text });
const page = object({ items: array(world), nextPage: nullable(integer) });
const accepted = object({ accepted: boolean, message: text }, ['accepted']);
const tokenResponse = object({ accessToken: text, refreshToken: text, user });
const responses: Record<string, object> = {
  'GET /health': object({ status: text }),
  'GET /v1/vocabulary': object({ version: integer, first: array(text), second: array(text) }),
  'GET /v1/capabilities': object({ emailDelivery: text }),
  'GET /v1/account': object({ user }),
  'POST /v1/auth/login': tokenResponse, 'POST /v1/auth/refresh': tokenResponse,
  'GET /v1/progress': object({ done: array(integer), badges: array(text), ...progressFields }),
  'POST /v1/progress/import': object({ accepted: boolean, awardedMilli: text }),
  'GET /v1/profiles/:id': object({ id: text, username: text, worldCount: integer, gridCount: integer, campaignCount: integer, communityCount: integer, beatenCount: integer, badges: array(text), ...progressFields }),
  'GET /v1/worlds': page, 'POST /v1/worlds': world,
  'GET /v1/worlds/:id/grids': object({ world, items: array(grid) }),
  'GET /v1/grids/drafts': object({ items: array(grid) }),
  'POST /v1/grids/drafts': object({ id: text, code: text, name: text, publishedAt: { type: 'null' } }),
  'POST /v1/grids/:id/publish': object({ id: text, code: text, awardedMilli: text }),
  'GET /v1/grids/code/:code': object({ grid }),
  'POST /v1/grids/:id/sessions': object({ sessionId: text, grid }),
  'POST /v1/completions': object({ accepted: boolean, awardedMilli: text, ...progressFields }),
};
export function responseSchema(method: string, url: string): object | undefined {
  if (responses[`${method} ${url}`]) return responses[`${method} ${url}`];
  if (url.startsWith('/v1/') && (method === 'POST' || method === 'PATCH')) return accepted;
  return undefined;
}
