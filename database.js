const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ev_charging.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`DROP TABLE IF EXISTS stations`);

  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      address TEXT NOT NULL,
      type TEXT NOT NULL,
      total_slots INTEGER NOT NULL,
      operating_hours TEXT NOT NULL,
      contact TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      station_id INTEGER NOT NULL,
      charger_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration_hours INTEGER NOT NULL DEFAULT 1,
      vehicle_info TEXT NOT NULL,
      status TEXT DEFAULT 'Confirmed',
      FOREIGN KEY (station_id) REFERENCES stations (id)
    )
  `);
  // Feedback Table Added Here
  db.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT,
      rating INTEGER NOT NULL,
      comments TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const stmt = db.prepare(`
    INSERT INTO stations (name, location, address, type, total_slots, operating_hours, contact)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run("GreenVolt Central Station", "Mangalore", "Hampankatta, Mangalore, Karnataka 575001", "AC & DC Fast", 3, "24/7 Access", "555-0192");
  stmt.run("City EV Hub", "Mangalore", "K S Rao Road, Mangalore, Karnataka 575001", "DC Fast", 3, "6 AM - 10 PM", "555-0143");
  stmt.run("Highway Fast Charge", "Surathkal", "NH 66, Surathkal, Karnataka 575014", "DC Ultra Fast", 3, "24/7 Access", "555-0188");
  stmt.finalize();
});

module.exports = db;