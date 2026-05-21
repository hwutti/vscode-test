const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function initDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_status TEXT,
      last_checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      response_ms INTEGER,
      checked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(service_id) REFERENCES services(id)
    );
  `);

  const getAllServices = db.prepare('SELECT * FROM services ORDER BY id DESC');
  const getServiceById = db.prepare('SELECT * FROM services WHERE id = ?');
  const insertService = db.prepare('INSERT INTO services (name, url, enabled) VALUES (?, ?, ?)');
  const updateService = db.prepare('UPDATE services SET name = ?, url = ?, enabled = ? WHERE id = ?');
  const deleteService = db.prepare('DELETE FROM services WHERE id = ?');
  const insertCheck = db.prepare('INSERT INTO checks (service_id, status, response_ms) VALUES (?, ?, ?)');
  const updateServiceStatus = db.prepare('UPDATE services SET last_status = ?, last_checked_at = ? WHERE id = ?');

  return {
    db,
    getAllServices: () => getAllServices.all(),
    getServiceById: (id) => getServiceById.get(id),
    addService: (name, url, enabled = 1) => {
      const info = insertService.run(name, url, enabled ? 1 : 0);
      return info.lastInsertRowid;
    },
    updateService: (id, name, url, enabled) => updateService.run(name, url, enabled ? 1 : 0, id),
    deleteService: (id) => deleteService.run(id),
    addCheck: (service_id, status, response_ms) => insertCheck.run(service_id, status, response_ms),
    updateStatus: (id, status) => updateServiceStatus.run(status, new Date().toISOString(), id),
  };
}

module.exports = { initDb };
