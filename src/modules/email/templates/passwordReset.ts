export interface PasswordResetTemplateParams {
  userName: string;
  resetUrl: string;
}

export function buildPasswordResetTemplate(params: PasswordResetTemplateParams) {
  const subject = 'Recuperacao de senha - SGest';
  const html = `
    <h1>Ola, ${params.userName}!</h1>
    <p>Recebemos uma solicitacao para redefinir sua senha.</p>
    <p>
      <a href="${params.resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
        Redefinir senha
      </a>
    </p>
    <p>Este link expira em 1 hora.</p>
    <p>Se voce nao solicitou esta acao, ignore este email.</p>
  `;

  const text = `Ola, ${params.userName}! Use este link para redefinir sua senha: ${params.resetUrl}`;

  return { subject, html, text };
}
