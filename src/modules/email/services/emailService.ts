import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../../../config/env';
import { getLogger } from '../../../config/logger';
import { emailConfig } from '../config';
import { buildPasswordResetTemplate } from '../templates/passwordReset';
import { buildInviteTemplate } from '../templates/invite';
import { buildNotificationTemplate } from '../templates/notification';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private readonly logger = getLogger().child({ module: 'email' });
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.setupProvider();
  }

  private setupProvider() {
    if (emailConfig.provider === 'resend') {
      if (emailConfig.resendApiKey) {
        this.resend = new Resend(emailConfig.resendApiKey);
        return;
      }

      this.logger.warn('EMAIL_PROVIDER=resend configurado sem RESEND_API_KEY. Aplicando fallback para SMTP.');
    }

    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost || 'smtp.ethereal.email',
      port: emailConfig.smtpPort || 587,
      secure: false,
      auth: {
        user: emailConfig.etherealUser || emailConfig.smtpUser || '',
        pass: emailConfig.etherealPass || emailConfig.smtpPass || '',
      },
    });
  }

  async send(options: SendEmailOptions): Promise<boolean> {
    try {
      if (this.resend) {
        await this.resend.emails.send({
          from: `${emailConfig.fromName} <${emailConfig.from}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        return true;
      }

      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from: `"${emailConfig.fromName}" <${emailConfig.from}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        if (env.NODE_ENV === 'development') {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            this.logger.info({ previewUrl }, 'Email preview URL');
          }
        }

        return true;
      }

      this.logger.error('Nenhum provider de email foi inicializado');
      return false;
    } catch (error) {
      this.logger.error({ err: error }, 'Erro ao enviar email');
      return false;
    }
  }

  async sendPasswordReset(email: string, token: string, userName: string): Promise<boolean> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    const template = buildPasswordResetTemplate({ userName, resetUrl });
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendInvite(email: string, token: string, inviterName: string): Promise<boolean> {
    const inviteUrl = `${env.FRONTEND_URL}/invite/${token}`;
    const template = buildInviteTemplate({ inviterName, inviteUrl });
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendNotification(
    to: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionLabel?: string
  ): Promise<boolean> {
    const template = buildNotificationTemplate({
      title,
      message,
      actionUrl,
      actionLabel,
    });

    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

export default new EmailService();
