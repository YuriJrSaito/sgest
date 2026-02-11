import database from '../../config/database';
import inviteService from '../../modules/invites/services/inviteService';
import { cleanDatabase, createAdminUser, createInvite } from '../helpers/testHelpers';

describe('InviteService - accept', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('cria reseller_profile ao aceitar convite de RESELLER', async () => {
    const admin = await createAdminUser();
    const invite = await createInvite({
      email: 'revenda@test.com',
      createdBy: admin.id,
      roleToAssign: 'RESELLER',
      commissionRate: 15,
    });

    const user = await inviteService.accept({
      token: invite.token,
      name: 'Revendedora Teste',
      password: 'Senha@123',
    });

    const profileResult = await database.query(
      'SELECT commission_rate FROM reseller_profiles WHERE user_id = $1',
      [user.id]
    );

    expect(profileResult.rowCount).toBe(1);
    expect(Number(profileResult.rows[0].commission_rate)).toBe(15);
  });
});
