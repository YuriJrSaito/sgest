import { env } from '../../config/env';

export type EmailProvider = 'resend' | 'ethereal' | 'smtp';

function normalizeProvider(provider: string): EmailProvider {
  if (provider === 'resend' || provider === 'smtp') {
    return provider;
  }
  return 'ethereal';
}

export const emailConfig = {
  provider: normalizeProvider(env.EMAIL_PROVIDER),
  from: env.EMAIL_FROM,
  fromName: env.EMAIL_FROM_NAME,
  resendApiKey: env.RESEND_API_KEY,
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpUser: env.SMTP_USER,
  smtpPass: env.SMTP_PASS,
  etherealUser: env.ETHEREAL_USER,
  etherealPass: env.ETHEREAL_PASS,
};
