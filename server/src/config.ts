import { requireValue } from './rules.js';
export interface Config {
  databaseUrl: string; encryptionKey: string; host: string; port: number;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser?: string; smtpPassword?: string;
  mailFrom: string; environment: string; trustProxy: string | false;
  mailDeliveryMode?: 'smtp' | 'test-inbox';
  /** Where Share feedback and Report a bug are mailed. */
  feedbackTo?: string;
  feedbackDeliveryMode?: 'store' | 'smtp';
}
export function configFromEnv(): Config {
  const environment = process.env.NODE_ENV ?? 'development';
  const encryptionKey = process.env.ENCRYPTION_KEY ?? '';
  requireValue(/^[a-fA-F0-9]{64}$/.test(encryptionKey), 'CONFIGURATION', 'ENCRYPTION_KEY must be 32 random bytes in hex.', 500);
  requireValue(!!process.env.DATABASE_URL, 'CONFIGURATION', 'DATABASE_URL is required.', 500);
  requireValue(!process.env.MAIL_DELIVERY_MODE || ['smtp', 'test-inbox'].includes(process.env.MAIL_DELIVERY_MODE), 'CONFIGURATION', 'Invalid MAIL_DELIVERY_MODE.', 500);
  requireValue(!process.env.FEEDBACK_DELIVERY_MODE || ['store', 'smtp'].includes(process.env.FEEDBACK_DELIVERY_MODE), 'CONFIGURATION', 'Invalid FEEDBACK_DELIVERY_MODE.', 500);
  return {
    databaseUrl: process.env.DATABASE_URL!, encryptionKey, environment,
    host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3000),
    smtpHost: process.env.SMTP_HOST ?? '127.0.0.1', smtpPort: Number(process.env.SMTP_PORT ?? 1025),
    smtpSecure: process.env.SMTP_SECURE === 'true', smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD, mailFrom: process.env.MAIL_FROM ?? 'INSIGHT <accounts@localhost>',
    trustProxy: process.env.TRUST_PROXY || false,
    mailDeliveryMode: process.env.MAIL_DELIVERY_MODE === 'test-inbox' ? 'test-inbox' : 'smtp',
    feedbackTo: process.env.FEEDBACK_TO || 'Insight.correspondence@gmail.com',
    feedbackDeliveryMode: process.env.FEEDBACK_DELIVERY_MODE === 'smtp' ? 'smtp' : 'store',
  };
}
