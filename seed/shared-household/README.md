# Shared household seed pack

This dataset models a shared household finance scenario with:

- 3 users
- 2 income categories
- 7 expense categories
- 6 months of transactions (2026-04 through 2026-09)
- 12 transactions per month across the household (72 total)

## Files

- `users.json` — user accounts to register or seed
- `categories.json` — categories to create for each user
- `transactions-alex.json` — Alex transactions (24)
- `transactions-jamie.json` — Jamie transactions (24)
- `transactions-taylor.json` — Taylor transactions (24)

## Notes on seeding

Current `scripts/seed-transactions.js` posts transactions to `POST /api/transactions` and requires auth.

Use the authenticated multi-user seed runner for this dataset:

- From repo root: `npm run seed:household`
- Or from `api/`: `npm run seed:household`

The runner will:

1. Register each user from `users.json` (or login if already registered).
2. Ensure all categories from `categories.json` exist for that user.
3. Post that user's transaction file with proper auth token and matching `categoryId` links.

Because each transaction is owned by the authenticated user, run the transaction seed once per user session:

1. Authenticate as the target user and obtain a valid token/cookie.
2. Ensure household categories exist for that user (`categories.json` values).
3. Seed one file per user:
   - `SEED_FILE=seed/shared-household/transactions-alex.json npm run seed`
   - `SEED_FILE=seed/shared-household/transactions-jamie.json npm run seed`
   - `SEED_FILE=seed/shared-household/transactions-taylor.json npm run seed`

If your current seed script does not include auth headers yet, seed through the UI/API client after login or extend the script to pass authorization.

## Environment options

- `API_URL` (default: `http://localhost:4000`)
- `SEED_DIR` (default: `seed/shared-household`)
- `SEED_USERS_FILE` (override users file path)
- `SEED_CATEGORIES_FILE` (override categories file path)
- `SEED_TX_FILE_<USER_EMAIL_SLUG>` (override per-user transaction file)
  - Example for `alex.household@example.com`:
    - `SEED_TX_FILE_ALEX_HOUSEHOLD_EXAMPLE_COM=seed/shared-household/transactions-alex.json`
- `DRY_RUN=1` prints plan and counts without calling API

### Dry run

`DRY_RUN=1 npm run seed:household`
