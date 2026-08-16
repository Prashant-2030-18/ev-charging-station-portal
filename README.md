# ⚡ EV PowerGrid Portal

A full-stack web application designed to help Electric Vehicle (EV) owners locate charging stations, view charger availability in real-time, reserve charging slots, and manage their bookings through a user-friendly dashboard.

---

## 🚀 Features

* **User Authentication:** Secure login and registration for EV drivers.
* **Station Directory:** Search and filter charging stations by location and charging speed/type (AC, DC Fast, Ultra Fast).
* **Real-time Availability:** Check charger status (`AVAILABLE` vs. `CHARGING`) based on active bookings.
* **Slot Reservation:** Select date, start time, charging duration, and vehicle details to book a charger.
* **User Dashboard:** View active reservations with options to edit or cancel bookings.
* **Past-Date Validation:** Automatically prevents users from booking or updating reservations to past dates.
* **User Feedback:** Submit ratings and comments regarding charging experiences.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla ES6+)
* **Backend:** Node.js, Express.js
* **Database:** SQLite (via `sqlite3`) / JSON-based mock API
* **Styling:** Custom CSS with responsive layouts

---

## 📁 Repository Structure

```text
├── backend/
│   ├── server.js            # Express API server & routes
│   └── database.sqlite      # Application database
├── frontend/
│   ├── index.html           # Login & Registration page
│   ├── stations.html        # Charging stations listing
│   ├── book.html            # Charger selection & booking modal
│   ├── dashboard.html       # User bookings & history
│   ├── feedback.html        # User review submission
│   ├── styles.css           # Global stylesheet
│   └── app.js               # Frontend application logic
├── package.json             # Node dependencies and scripts
└── README.md                # Project documentation

```markdown
## ⚙️ Setup & Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v16 or higher) installed on your system.

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/ev-powergrid-portal.git](https://github.com/YOUR_USERNAME/ev-powergrid-portal.git)
cd ev-powergrid-portal

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Start the Backend Server

```bash
npm start

```

> The server will run at `http://localhost:5000`.

### 4. Open the Frontend

* Open `frontend/index.html` directly in your browser.
* *Or* use the **Live Server** extension in Visual Studio Code to serve the `frontend` folder (`http://127.0.0.1:5500/frontend/index.html`).

```

```
