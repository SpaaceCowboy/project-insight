export const uuidSchema = { type: 'string', format: 'uuid' } as const;
export const emailSchema = { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' } as const;
/** Required on every destructive or status-changing action; it lands in the audit trail. */
export const reasonSchema = { type: 'string', minLength: 3, maxLength: 500 } as const;
export function objectSchema(properties: Record<string, unknown>, required = Object.keys(properties)) {
  return { type: 'object', additionalProperties: false, properties, required };
}
