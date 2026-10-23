# ReelTime – Movie Ticket Booking System

Full-stack demo: HTML, CSS, JavaScript, Node.js, Express.js, PostgreSQL, REST APIs.
Educational project. No real payments.

## Setup
1. Install Node.js (LTS) and PostgreSQL (pgAdmin).
2. Create a database named `movie_booking`.
3. In pgAdmin Query Tool (on movie_booking) run `db/schema.sql`, then `db/seed.sql`.
4. Put your values in `.env` (DB_PASSWORD, JWT_SECRET).
5. `npm install`
6. `npm run dev`
7. Open http://localhost:5000

## Make an admin
Register a normal user on the site, then run in pgAdmin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```
Open http://localhost:5000/admin.html and login.

## Known limitations (see report)
No payment gateway, seat hold, cancellation, e-mail/QR ticket, automated tests.
CORS is open, no rate limiting or security headers yet.