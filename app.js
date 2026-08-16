const API = 'http://localhost:5000/api';
let currentUser = localStorage.getItem('ev_user') || null;

function checkAuth() {
  if (!currentUser) {
    window.location.href = 'index.html';
  } else {
    const displayUser = document.getElementById('display-user');
    if (displayUser) displayUser.innerText = currentUser;
  }
}

function logout() {
  localStorage.removeItem('ev_user');
  window.location.href = 'index.html';
}

async function register() {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  const res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  const data = await res.json();
  document.getElementById('auth-msg').innerText = data.message || data.error;
}

async function login() {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  const data = await res.json();
  if (res.ok) {
    currentUser = data.username;
    localStorage.setItem('ev_user', currentUser);
    window.location.href = 'stations.html';
  } else {
    document.getElementById('auth-msg').innerText = data.error;
  }
}

// Check if a specific charger is active right now
function isChargerCurrentlyOccupied(chargerName, bookings) {
  const now = new Date();
  return (bookings || []).some(b => {
    if (b.charger_name !== chargerName) return false;
    const start = new Date(`${b.date}T${b.time}`);
    const durationMs = (b.duration_hours || 1) * 60 * 60 * 1000;
    const end = new Date(start.getTime() + durationMs);
    return now >= start && now < end;
  });
}

// Load Stations List Page
async function loadStationsPage() {
  checkAuth();
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');

  const search = searchInput ? searchInput.value.trim() : '';
  const type = typeFilter ? typeFilter.value : '';
  
  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  if (type) queryParams.append('type', type);

  const res = await fetch(`${API}/stations?${queryParams.toString()}`);
  const stations = await res.json();

  const container = document.getElementById('stations-list');
  if (!container) return;

  if (!Array.isArray(stations) || stations.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666;">No stations found.</p>`;
    return;
  }

  container.innerHTML = stations.map(s => `
    <div class="station-card">
      <div class="card-header-icon">⚡ ${s.type}</div>
      <h3>${s.name}</h3>
      <p class="location-text">📍 <strong>${s.location}</strong></p>
      <p class="address-text">${s.address}</p>
      <div class="slots-info">
        <span><strong>${s.total_slots}</strong> chargers</span>
        <span class="status-green">🟢 <strong>${s.available_slots}</strong> available</span>
        <span class="status-red">🔴 <strong>${s.active_charging}</strong> charging</span>
      </div>
      <button class="btn-outline-green" onclick="goToChargers(${s.id})">View Chargers</button>
    </div>
  `).join('');
}

function goToChargers(stationId) {
  window.location.href = `book.html?stationId=${stationId}`;
}

// Load Booking Details Page
async function loadBookingPage() {
  checkAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const stationId = urlParams.get('stationId');

  if (!stationId) {
    window.location.href = 'stations.html';
    return;
  }

  const res = await fetch(`${API}/stations/${stationId}`);
  const station = await res.json();

  document.getElementById('station-title').innerText = station.name;
  document.getElementById('station-subtitle').innerText = `${station.location} · ${station.address}`;

  const chargersContainer = document.getElementById('chargers-container');
  const types = ["AC · 22 kW", "DC Fast · 60 kW", "DC Ultra Fast · 120 kW"];

  let html = '';
  for (let i = 1; i <= station.total_slots; i++) {
    const chargerName = `Charger 0${i}`;
    const occupied = isChargerCurrentlyOccupied(chargerName, station.bookings);
    
    html += `
      <div class="charger-card">
        <div class="charger-header">
          <div>
            <h4>${chargerName}</h4>
            <span class="charger-type">${types[(i - 1) % types.length]}</span>
          </div>
          <span class="pill-badge ${!occupied ? 'pill-green' : 'pill-gray'}">
            ${!occupied ? '● AVAILABLE' : '🔴 CHARGING'}
          </span>
        </div>
        <button class="btn-green margin-top-15" 
                ${occupied ? 'disabled style="background:#cbd5e1; color:#64748b; cursor:not-allowed;"' : ''} 
                onclick="openBookingModal(${station.id}, '${chargerName}')">
          ${!occupied ? 'Book Now' : 'Charging in Progress'}
        </button>
      </div>
    `;
  }
  chargersContainer.innerHTML = html;
}

// Helper function to restrict past date selections
function restrictPastDates() {
  const today = new Date().toISOString().split('T')[0];
  const bookDateInput = document.getElementById('book-date');
  const editDateInput = document.getElementById('edit-date');

  if (bookDateInput) bookDateInput.setAttribute('min', today);
  if (editDateInput) editDateInput.setAttribute('min', today);
}

function openBookingModal(stationId, chargerName) {
  restrictPastDates();
  document.getElementById('modal-station-id').value = stationId;
  document.getElementById('modal-charger-name').value = chargerName;
  document.getElementById('selected-charger-label').innerText = chargerName;
  document.getElementById('booking-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('booking-modal').style.display = 'none';
}

// Submit Booking Form
async function submitBooking(e) {
  e.preventDefault();
  const payload = {
    user_name: currentUser,
    station_id: document.getElementById('modal-station-id').value,
    charger_name: document.getElementById('modal-charger-name').value,
    date: document.getElementById('book-date').value,
    time: document.getElementById('book-time').value,
    duration_hours: parseInt(document.getElementById('book-duration').value, 10),
    vehicle_info: document.getElementById('book-vehicle').value
  };

  const res = await fetch(`${API}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();

  if (res.ok) {
    alert('Booking confirmed!');
    window.location.href = 'dashboard.html';
  } else {
    alert(data.error);
  }
}

// Helper function to convert 24-hour time to 12-hour AM/PM format
function formatTime12Hour(timeStr) {
  if (!timeStr) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  return `${hours}:${minutes} ${ampm}`;
}

// Helper function to assign station background class
function getStationBgClass(stationName) {
  if (!stationName) return '';
  if (stationName.includes('GreenVolt')) return 'bg-greenvolt';
  if (stationName.includes('City EV')) return 'bg-city-hub';
  if (stationName.includes('Highway')) return 'bg-highway';
  return '';
}

// Load Dashboard Page
async function loadDashboardPage() {
  checkAuth();

  try {
    const stationsRes = await fetch(`${API}/stations`);
    const stations = await stationsRes.json();
    const statTotal = document.getElementById('stat-total-stations');
    if (statTotal) statTotal.innerText = stations.length;
  } catch (err) {
    console.error('Error fetching stations count:', err);
  }

  try {
    const res = await fetch(`${API}/bookings?user_name=${currentUser}`);
    const bookings = await res.json();

    const statBookings = document.getElementById('stat-my-bookings');
    if (statBookings) statBookings.innerText = bookings.length;

    const container = document.getElementById('bookings-list');
    if (!container) return;

    if (!Array.isArray(bookings) || bookings.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666;">No active bookings found.</p>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      const bgClass = getStationBgClass(b.station_name);
      const bookingData = JSON.stringify(b).replace(/'/g, "&apos;");
      return `
        <div class="booking-card-item ${bgClass}" style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px;">
          <h3 style="margin-top:0;">${b.station_name}</h3>
          <p class="location-text">⚡ <strong>${b.charger_name}</strong></p>
          <p class="address-text">📍 ${b.address}</p>
          <p>📅 <strong>Date:</strong> ${b.date} | <strong>Time:</strong> ${formatTime12Hour(b.time)}</p>
          <p>⏱️ <strong>Duration:</strong> ${b.duration_hours || 1} Hour(s)</p>
          <p>🚗 <strong>Vehicle:</strong> ${b.vehicle_info}</p>
          <div class="card-actions">
            <button class="btn-warning" onclick='openEditModal(${bookingData})'>Edit Booking</button>
            <button class="btn-danger" onclick="cancelBooking(${b.id})">Cancel Booking</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching user bookings:', err);
  }
}

// Cancel Booking
async function cancelBooking(id) {
  if (confirm("Cancel this booking?")) {
    const res = await fetch(`${API}/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadDashboardPage();
    }
  }
}

// Edit Booking Functions
function openEditModal(booking) {
  restrictPastDates();
  document.getElementById('edit-booking-id').value = booking.id;
  document.getElementById('edit-date').value = booking.date;
  document.getElementById('edit-time').value = booking.time;
  document.getElementById('edit-duration').value = booking.duration_hours || 1;
  document.getElementById('edit-vehicle').value = booking.vehicle_info;
  
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

async function submitEditBooking(e) {
  e.preventDefault();
  const id = document.getElementById('edit-booking-id').value;
  const payload = {
    date: document.getElementById('edit-date').value,
    time: document.getElementById('edit-time').value,
    duration_hours: parseInt(document.getElementById('edit-duration').value, 10),
    vehicle_info: document.getElementById('edit-vehicle').value
  };

  const res = await fetch(`${API}/bookings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (res.ok) {
    alert('Booking updated!');
    closeEditModal();
    loadDashboardPage();
  } else {
    alert(data.error || 'Failed to update booking');
  }
}

// Submit Feedback Handler
async function submitFeedback(e) {
  e.preventDefault();
  const rating = document.getElementById('feedback-rating').value;
  const comments = document.getElementById('feedback-comments').value;

  try {
    const res = await fetch(`${API}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: currentUser,
        rating: parseInt(rating, 10),
        comments: comments
      })
    });

    if (res.ok) {
      document.getElementById('feedback-msg').innerText = 'Thank you! Your feedback has been submitted.';
      document.getElementById('feedback-form').reset();
    } else {
      document.getElementById('feedback-msg').innerText = 'Failed to submit feedback. Please try again.';
    }
  } catch (err) {
    console.error('Feedback Error:', err);
    document.getElementById('feedback-msg').innerText = 'Server error. Could not save feedback.';
  }
}