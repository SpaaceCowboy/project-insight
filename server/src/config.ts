import { requireValue } from './rules.js';
export interface Config {
  databaseUrl: string; encryptionKey: string; host: string; port: number;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser?: string; smtpPassword?: string;
  mailFrom: string; environment: string; trustProxy: string | false;
  mailDeliveryMode?: 'smtp' | 'test-inbox' | 'disabled';
  /** The Web OAuth client ID issued by Google Cloud; also the ID-token audience. */
  googleClientId?: string;
  /** Where Share feedback and Report a bug are mailed. */
  feedbackTo?: string;
  feedbackDeliveryMode?: 'store' | 'smtp';
  /** Puzzles one player may publish per UTC day. Unset means no cap. */
  createDailyLimit?: number;
  developerUserIds?: string[];
  /** Dedicated, private Redis with persistence and no eviction. Required in production. */
  rateLimitRedisUrl?: string;
  rateLimitNamespace?: string;
}
export function configFromEnv(): Config {
  const environment = process.env.NODE_ENV ?? 'development';
  requireValue(['development', 'test', 'production'].includes(environment), 'CONFIGURATION', 'NODE_ENV must be development, test, or production.', 500);
  const encryptionKey = process.env.ENCRYPTION_KEY ?? '';
  requireValue(/^[a-fA-F0-9]{64}$/.test(encryptionKey), 'CONFIGURATION', 'ENCRYPTION_KEY must be 32 random bytes in hex.', 500);
  requireValue(!!process.env.DATABASE_URL, 'CONFIGURATION', 'DATABASE_URL is required.', 500);
  const rateLimitRedisUrl = process.env.RATE_LIMIT_REDIS_URL;
  requireValue(environment !== 'production' || !!rateLimitRedisUrl, 'CONFIGURATION', 'RATE_LIMIT_REDIS_URL is required in production.', 500);
  if (rateLimitRedisUrl) {
    let valid = false;
    try {
      const url = new URL(rateLimitRedisUrl);
      valid = ['redis:', 'rediss:'].includes(url.protocol) ? !!url.hostname
        : url.protocol === 'unix:' && !url.hostname && url.pathname.startsWith('/') && url.pathname.length > 1 && !url.search && !url.hash;
    } catch {}
    requireValue(valid, 'CONFIGURATION', 'RATE_LIMIT_REDIS_URL must be a Redis URL.', 500);
  }
  requireValue(!process.env.RATE_LIMIT_NAMESPACE || /^[A-Za-z0-9:_-]{1,80}$/.test(process.env.RATE_LIMIT_NAMESPACE), 'CONFIGURATION', 'Invalid RATE_LIMIT_NAMESPACE.', 500);
  requireValue(!process.env.MAIL_DELIVERY_MODE || ['smtp', 'test-inbox', 'disabled'].includes(process.env.MAIL_DELIVERY_MODE), 'CONFIGURATION', 'Invalid MAIL_DELIVERY_MODE.', 500);
  requireValue(!process.env.FEEDBACK_DELIVERY_MODE || ['store', 'smtp'].includes(process.env.FEEDBACK_DELIVERY_MODE), 'CONFIGURATION', 'Invalid FEEDBACK_DELIVERY_MODE.', 500);
  return {
    databaseUrl: process.env.DATABASE_URL!, encryptionKey, environment,
    rateLimitRedisUrl, rateLimitNamespace: process.env.RATE_LIMIT_NAMESPACE || undefined,
    host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3000),
    smtpHost: process.env.SMTP_HOST ?? '127.0.0.1', smtpPort: Number(process.env.SMTP_PORT ?? 1025),
    smtpSecure: process.env.SMTP_SECURE === 'true', smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD, mailFrom: process.env.MAIL_FROM ?? 'INSIGHT <accounts@localhost>',
    trustProxy: process.env.TRUST_PROXY || false,
    mailDeliveryMode: process.env.MAIL_DELIVERY_MODE === 'test-inbox' ? 'test-inbox' : process.env.MAIL_DELIVERY_MODE === 'disabled' ? 'disabled' : 'smtp',
    googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
    feedbackTo: process.env.FEEDBACK_TO || 'Insight.correspondence@gmail.com',
    feedbackDeliveryMode: process.env.FEEDBACK_DELIVERY_MODE === 'smtp' ? 'smtp' : 'store',
    createDailyLimit: Number(process.env.CREATE_DAILY_LIMIT) > 0 ? Number(process.env.CREATE_DAILY_LIMIT) : undefined,
    developerUserIds: (process.env.DEVELOPER_USER_IDS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
  };
}
