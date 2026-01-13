const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'shadowcore.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      verified INTEGER DEFAULT 0,
      blocked INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      path TEXT
    )`);
  });
}

module.exports = { db, initDB };
