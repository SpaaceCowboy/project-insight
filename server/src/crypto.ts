import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
export function digest(value: string, key: string): string { return createHmac('sha256', Buffer.from(key, 'hex')).update(value).digest('hex'); }
export function token(): string { return randomBytes(32).toString('base64url'); }
export function encrypt(value: unknown, key: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function decrypt<T>(value: string, key: string): T {
  const data = Buffer.from(value, 'base64'); const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8')) as T;
}
