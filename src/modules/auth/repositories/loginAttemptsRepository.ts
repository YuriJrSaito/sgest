import database from '../../../config/database';

export class LoginAttemptsRepository {
  async record(data: {
    email: string;
    ipAddress: string;
    success: boolean;
    userAgent?: string;
  }): Promise<void> {
    await database.query(
      `INSERT INTO login_attempts (email, ip_address, success, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [data.email, data.ipAddress, data.success, data.userAgent || null]
    );
  }

  async deleteOld(daysToKeep: number = 90): Promise<number> {
    const result = await database.query(
      `DELETE FROM login_attempts
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [daysToKeep]
    );
    return result.rowCount || 0;
  }

  async countRecent(email: string, ipAddress: string, windowMinutes: number): Promise<number> {
    const result = await database.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM login_attempts
       WHERE email = $1
         AND ip_address = $2
         AND success = FALSE
         AND created_at >= NOW() - ($3::int * INTERVAL '1 minute')`,
      [email, ipAddress, windowMinutes]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }
}

const loginAttemptsRepository = new LoginAttemptsRepository();

export default loginAttemptsRepository;
