import mysql from 'mysql2/promise';
import { config } from './config.js';

let pool;

export async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.mysql,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const db = await getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}
