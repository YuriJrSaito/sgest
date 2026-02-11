export interface InviteTemplateParams {
  inviterName: string;
  inviteUrl: string;
}

export function buildInviteTemplate(params: InviteTemplateParams) {
  const subject = 'Convite para acessar o SGest';
  const html = `
    <h1>Voce recebeu um convite</h1>
    <p>${params.inviterName} convidou voce para acessar o SGest.</p>
    <p>
      <a href="${params.inviteUrl}" style="display:inline-block;padding:12px 24px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;">
        Aceitar convite
      </a>
    </p>
    <p>Este convite expira em breve. Se nao esperava este email, ignore.</p>
  `;
  const text = `${params.inviterName} convidou voce para o SGest. Acesse: ${params.inviteUrl}`;

  return { subject, html, text };
}
