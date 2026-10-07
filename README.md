# FF LEVEL Full-Stack Dashboard

## Stack
- Node.js + Express
- SQLite (`better-sqlite3`)
- JWT login
- bcrypt password hashing
- HTML/CSS/JavaScript frontend

## Run locally
1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run:
   npm install
   npm start
4. Open http://localhost:3000

Default development login:
username: admin
password: change-me

Before putting this online, set strong ADMIN_PASSWORD and JWT_SECRET environment variables.

## API
POST /api/login
GET /api/accounts
POST /api/accounts
PUT /api/accounts/:id
DELETE /api/accounts/:id
POST /api/accounts/:id/refresh

The refresh endpoint is deliberately only a database refresh placeholder. Connect it to a service/API that you are authorized to use; do not add credential theft, packet interception, anti-cheat bypasses, or unauthorized game APIs.
