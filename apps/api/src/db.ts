import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export async function dbOk(): Promise<boolean> {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}
