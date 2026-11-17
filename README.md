# A2S YARD

A2S YARD is a container yard booking and operations website built with HTML, CSS, JavaScript, and a Node.js HTTP server. The project includes customer booking flows, admin workflows, payment proof handling, QR gate passes, and yard operations screens.

## Local development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values.
3. Start the app: `npm start`
4. Open `http://localhost:8000`

## PostgreSQL setup

The project supports PostgreSQL through environment variables. Set either `DATABASE_URL` or the individual `PG*` values. The app initializes the required tables automatically when a PostgreSQL configuration is present.

```bash
cp .env.example .env
npm run db:init
npm run migrate:postgres
```

The migration script reads the existing `data/accounts.json` and `data/bookings.json` files and inserts them into Postgres without deleting the original source files.

## Render deployment

For Render, configure these environment variables:

- `NODE_ENV=production`
- `PORT=10000` (Render injects this automatically)
- `DATABASE_URL` for the Render Postgres instance
- `A2S_ADMIN_EMAIL`
- `A2S_ADMIN_PASSWORD`
- `A2S_ADMIN_NAME`

Use the production start command:

```bash
npm start
```

The server listens on `0.0.0.0` and exposes `/health` for deployment health checks.

## Notes

- Uploaded payment proofs are stored in `data/payment-proofs` and can be moved to a persistent external store later.
- The app keeps a JSON fallback for local development when PostgreSQL is not configured.
- The web UI remains as-is while the backend data layer is upgraded for shared database-backed access.
