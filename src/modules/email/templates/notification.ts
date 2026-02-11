export interface NotificationTemplateParams {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function buildNotificationTemplate(params: NotificationTemplateParams) {
  const subject = params.title;
  const actionLink = params.actionUrl
    ? `<p><a href="${params.actionUrl}" style="display:inline-block;padding:10px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;">${params.actionLabel || 'Abrir'}</a></p>`
    : '';

  const html = `
    <h2>${params.title}</h2>
    <p>${params.message}</p>
    ${actionLink}
  `;

  const text = params.actionUrl
    ? `${params.title}\n\n${params.message}\n\n${params.actionLabel || 'Abrir'}: ${params.actionUrl}`
    : `${params.title}\n\n${params.message}`;

  return { subject, html, text };
}
