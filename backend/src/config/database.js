const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:               process.env.DB_HOST     || 'localhost',
      port:               parseInt(process.env.DB_PORT || '3306'),
      database:           process.env.DB_NAME     || 'village_connecte',
      user:               process.env.DB_USER     || 'vc_user',
      password:           process.env.DB_PASSWORD || 'vc_secure_pass_2026',
      waitForConnections: true,
      connectionLimit:    parseInt(process.env.DB_POOL_MAX || '10'),
      queueLimit:         0,
      enableKeepAlive:    true,
      keepAliveInitialDelay: 0,
      charset:            'utf8mb4',
      timezone:           '+00:00',
    });

    pool.on('connection', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 New MySQL connection established');
      }
    });
  }
  return pool;
}

/**
 * Execute a query using the pool
 */
async function query(sql, params = []) {
  const db = getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}

/**
 * Execute a query and return first row
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const db = getPool();
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { getPool, query, queryOne, testConnection };
