# Flamlink API

Node + Express + MongoDB (Mongoose). Every collection carries `tenantId`; every route runs behind `requireAuth`, which pins the request to one tenant.

```bash
cp .env.example .env     # fill MONGODB_URI and JWT_SECRET
npm install
npm run seed             # demo company "gaz-capitale" with Yaoundé depots
npm run dev
```

Key endpoints: `POST /api/handovers`, `GET /api/inventory/critical-zones`, `GET /api/inventory/empties`, `GET /api/dispatch/mine`, `POST /api/prices/reports`.
Transactions require a replica set (Atlas has one). For a plain local mongod set `USE_TRANSACTIONS=false`.
