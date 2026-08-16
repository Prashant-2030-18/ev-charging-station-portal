const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Helper function to check if two booking time windows overlap
function checkOverlap(existingBooking, newDate, newTime, newDurationHours) {
  if (existingBooking.date !== newDate) return false;

  const newStart = new Date(`${newDate}T${newTime}`).getTime();
  const newEnd = newStart + parseInt(newDurationHours, 10) * 60 * 60 * 1000;

  const existingStart = new Date(`${existingBooking.date}T${existingBooking.time}`).getTime();
  const existingDuration = existingBooking.duration_hours || 1;
  const existingEnd = existingStart + existingDuration * 60 * 60 * 1000;

  // Overlap condition: start of one is before end of another
  return newStart < existingEnd && newEnd > existingStart;
}

// Helper to check if a booking is currently active (for live station slot counts)
function isBookingActive(booking) {
  const now = new Date();
  const start = new Date(`${booking.date}T${booking.time}`);
  const durationMs = (booking.duration_hours || 1) * 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  return now >= start && now < end;
}

// Get stations with accurate dynamic slot counts
app.get('/api/stations', (req, res) => {
  const { search, type } = req.query;
  let sql = 'SELECT * FROM stations WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR location LIKE ? OR address LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  db.all(sql, params, (err, stations) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all('SELECT * FROM bookings', [], (err, bookings) => {
      if (err) return res.status(500).json({ error: err.message });

      const result = stations.map(station => {
        // Find chargers currently active at this station
        const activeBookings = bookings.filter(b => b.station_id === station.id && isBookingActive(b));
        
        // Count unique active chargers
        const uniqueOccupiedChargers = new Set(activeBookings.map(b => b.charger_name)).size;
        const availableSlots = Math.max(0, station.total_slots - uniqueOccupiedChargers);

        return {
          ...station,
          available_slots: availableSlots,
          active_charging: uniqueOccupiedChargers
        };
      });

      res.json(result);
    });
  });
});

// Get single station with all bookings for validation/display
app.get('/api/stations/:id', (req, res) => {
  const stationId = req.params.id;

  db.get('SELECT * FROM stations WHERE id = ?', [stationId], (err, station) => {
    if (err || !station) return res.status(404).json({ error: 'Station not found' });

    db.all('SELECT * FROM bookings WHERE station_id = ?', [stationId], (err, bookings) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...station, bookings });
    });
  });
});

// User Registration
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function (err) {
    if (err) return res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Username taken' : err.message });
    res.json({ message: 'User registered!', id: this.lastID });
  });
});

// User Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', username: row.username });
  });
});

// Create Booking (With strict overlap prevention)
app.post('/api/bookings', (req, res) => {
  const { user_name, station_id, charger_name, date, time, duration_hours, vehicle_info } = req.body;

  if (!user_name || !station_id || !charger_name || !date || !time || !duration_hours || !vehicle_info) {
    return res.status(400).json({ error: 'All booking fields are required.' });
  }

  // Check if charger is already booked during this time frame
  const checkSql = 'SELECT * FROM bookings WHERE station_id = ? AND charger_name = ?';
  db.all(checkSql, [station_id, charger_name], (err, existingBookings) => {
    if (err) return res.status(500).json({ error: err.message });

    const hasConflict = existingBookings.some(b => checkOverlap(b, date, time, duration_hours));

    if (hasConflict) {
      return res.status(409).json({ error: 'This charger is already booked during the selected time period.' });
    }

    const insertSql = `
      INSERT INTO bookings (user_name, station_id, charger_name, date, time, duration_hours, vehicle_info)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [user_name, station_id, charger_name, date, time, duration_hours, vehicle_info], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Booking confirmed!' });
    });
  });
});

// Get User Bookings
app.get('/api/bookings', (req, res) => {
  const { user_name } = req.query;
  const sql = `
    SELECT bookings.*, stations.name AS station_name, stations.address 
    FROM bookings 
    JOIN stations ON bookings.station_id = stations.id 
    WHERE bookings.user_name = ?
  `;
  db.all(sql, [user_name], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Cancel Booking
app.delete('/api/bookings/:id', (req, res) => {
  db.run('DELETE FROM bookings WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Booking cancelled' });
  });
});

// ==========================================
// PASTE THIS NEW EDIT ROUTE RIGHT HERE:
// ==========================================
// Edit / Update Booking (With overlap check excluding the current booking)
app.put('/api/bookings/:id', (req, res) => {
  const bookingId = req.params.id;
  const { date, time, duration_hours, vehicle_info } = req.body;

  if (!date || !time || !duration_hours || !vehicle_info) {
    return res.status(400).json({ error: 'All edit fields are required.' });
  }

  // First fetch existing booking details (to get station_id & charger_name)
  db.get('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, currentBooking) => {
    if (err || !currentBooking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Check for time overlap with OTHER bookings on the same charger (excluding this booking ID)
    const checkSql = 'SELECT * FROM bookings WHERE station_id = ? AND charger_name = ? AND id != ?';
    db.all(checkSql, [currentBooking.station_id, currentBooking.charger_name, bookingId], (err, otherBookings) => {
      if (err) return res.status(500).json({ error: err.message });

      const hasConflict = otherBookings.some(b => checkOverlap(b, date, time, duration_hours));

      if (hasConflict) {
        return res.status(409).json({ error: 'This charger is already booked during the new selected time.' });
      }

      // Update the booking in SQLite database
      const updateSql = `
        UPDATE bookings 
        SET date = ?, time = ?, duration_hours = ?, vehicle_info = ?
        WHERE id = ?
      `;

      db.run(updateSql, [date, time, duration_hours, vehicle_info, bookingId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Booking updated successfully!' });
      });
    });
  });
});

// Submit Feedback Route
app.post('/api/feedback', (req, res) => {
  const { user_name, rating, comments } = req.body;

  if (!rating || !comments) {
    return res.status(400).json({ error: 'Rating and comments are required.' });
  }

  const sql = 'INSERT INTO feedback (user_name, rating, comments) VALUES (?, ?, ?)';
  db.run(sql, [user_name || 'Anonymous', rating, comments], function (err) {
    if (err) {
      console.error('Database Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Feedback submitted successfully!', id: this.lastID });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));