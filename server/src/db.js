const { Pool } = require('pg');

const DEFAULT_DB_URL = 'postgresql://webdashboard:webdashboard@127.0.0.1:5432/webdashboard';

async function initDb(databaseUrl = DEFAULT_DB_URL) {
  const pool = new Pool({ connectionString: databaseUrl });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_status TEXT,
      last_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checks (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      response_ms INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  async function getAllServices() {
    const { rows } = await pool.query(
      `
      SELECT services.*,
        (
          SELECT response_ms
          FROM checks
          WHERE checks.service_id = services.id
          ORDER BY checks.id DESC
          LIMIT 1
        ) AS latest_response_ms
      FROM services
      ORDER BY services.id DESC
      `,
    );
    return rows;
  }

  async function getServiceById(id) {
    const { rows } = await pool.query(
      `
      SELECT services.*,
        (
          SELECT response_ms
          FROM checks
          WHERE checks.service_id = services.id
          ORDER BY checks.id DESC
          LIMIT 1
        ) AS latest_response_ms
      FROM services
      WHERE services.id = $1
      `,
      [id],
    );
    return rows[0] || null;
  }

  async function addService(name, url, enabled = true) {
    const { rows } = await pool.query(
      'INSERT INTO services (name, url, enabled) VALUES ($1, $2, $3) RETURNING id',
      [name, url, !!enabled],
    );
    return rows[0].id;
  }

  async function updateService(id, name, url, enabled) {
    await pool.query(
      'UPDATE services SET name = $1, url = $2, enabled = $3 WHERE id = $4',
      [name, url, !!enabled, id],
    );
  }

  async function deleteService(id) {
    await pool.query('DELETE FROM services WHERE id = $1', [id]);
  }

  async function addCheck(serviceId, status, responseMs) {
    await pool.query(
      'INSERT INTO checks (service_id, status, response_ms) VALUES ($1, $2, $3)',
      [serviceId, status, responseMs],
    );
  }

  async function updateStatus(id, status) {
    await pool.query(
      'UPDATE services SET last_status = $1, last_checked_at = NOW() WHERE id = $2',
      [status, id],
    );
  }

  async function close() {
    await pool.end();
  }

  return {
    getAllServices,
    getServiceById,
    addService,
    updateService,
    deleteService,
    addCheck,
    updateStatus,
    close,
  };
}

module.exports = { initDb, DEFAULT_DB_URL };
