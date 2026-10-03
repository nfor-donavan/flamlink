# Flamlink

Multi-tenant LPG cylinder and supply chain platform for gas distributors in Cameroon (SCTM, Tradex, Total, Afrigaz, Camgaz).
Tracks every steel bottle by barcode, balances full-for-empty exchanges, flags depots before they run dry, and catches overpricing and hoarding.

```
flamlink/
  backend/    Node + Express + MongoDB API (Render)
  web/        React + Vite operations dashboard (EN/FR, light/dark)
  mobile/     React Native + Expo driver app, Android-first (EN/FR, light/dark)
  branding/   Logo (SVG + PNG) and the scripts that generate the icons
```

## Run it locally

1. **API**: `cd backend && cp .env.example .env` (set `MONGODB_URI`, `JWT_SECRET`), then `npm install && npm run seed && npm run dev`.
   Seed creates the company code `gaz-capitale` with 16 Yaoundé depots. Logins (password `Flamlink123!`): `owner@gazcapitale.cm`, `manager@gazcapitale.cm`, drivers `670000001` to `670000003`.
2. **Dashboard**: `cd web && cp .env.example .env && npm install && npm run dev` (http://localhost:5173).
3. **Driver app**: `cd mobile && npm install && npx expo install --fix && npx expo start`. Set `EXPO_PUBLIC_API_URL` to your API (on an Android emulator `http://10.0.2.2:4000` already works). Build an APK with `eas build -p android --profile preview`.

## How the core logic works

- **Twin scan** (`POST /api/handovers`): one transaction moves the scanned full bottles to the depot and the scanned empties onto the driver's truck. If fewer empties come back than full bottles went out, a deposit charge is written to the retailer's ledger; cash below the expected price is logged as a shortfall. Retried requests carry an `idempotencyKey`, so nothing is booked twice.
- **Shortage engine** (`GET /api/inventory/critical-zones`): depots below safety stock turn `CRITICAL`, at zero `OUT`. A dispatch order is created for the nearest driver (by last GPS position and open workload) and a push notification is sent. A 7-day sales curve flags depots with under 2 days of cover as `AT_RISK`. A background sweep runs every 2 minutes.
- **Anti-gouging**: per-tenant price table with a legal retail ceiling (default 6 500 XAF for 12.5 kg). Drivers and customers report prices; a price above the ceiling, or "no stock" from a depot our count says has stock, is flagged.
- **Empties map**: depot sales turn full bottles into empty shells at that depot, so the dashboard shows where your metal capital is sitting.

## Deliberate choices to review

- Serial uniqueness is per tenant, not global, so two distributors can never collide.
- Default prices and deposits in `backend/src/utils/pricing.js` are placeholders. Set your real figures in the dashboard under Accounts & prices.
- Mongo transactions need a replica set (Atlas has one); use `USE_TRANSACTIONS=false` for a plain local mongod.
- Server error messages are English; the apps translate the common ones to French.
