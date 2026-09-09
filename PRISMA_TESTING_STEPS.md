# Testing the Prisma migration — step by step

> **Version note:** `package.json` pins `prisma` and `@prisma/client` to the exact version `6.19.3` (not a `^`-range) on purpose. Prisma 7 (released Nov 19, 2025 — very recent) introduced a genuinely major breaking change: connection URLs moved out of `schema.prisma` into a new `prisma.config.ts` file, and `PrismaClient` now requires an explicit driver adapter to construct. This project was originally written against that newer syntax, hit that exact error on first real-world test (`Error: The datasource property url is no longer supported in schema files`), and was deliberately pinned back to the well-established, widely-documented 6.x line to avoid fighting a 3-week-old architecture with very little community documentation yet. **Don't run `npm install prisma@latest`** or similar — it'll pull v7 and break the `datasource { url = ... }` line in `schema.prisma`. If you ever want to move to v7 later, that's a deliberate, separate upgrade (see Prisma's own migration guide), not a drive-by version bump.

This backend just moved from Drizzle to Prisma. **None of this Prisma code has been run yet** — it was written and reviewed carefully by hand against the original Drizzle schema, but this sandbox can't reach `binaries.prisma.sh` (where Prisma downloads its query/schema engine from), so `prisma generate` and `prisma migrate` have never actually executed. You're the first real run. This doc walks through it in order, with what to expect at each step and what to do if something's off.

## 0. Prerequisites

- Postgres running locally (same as before)
- A `.env` file with `DATABASE_URL` set — this hasn't changed, reuse what you already have
- Real internet access (this is the whole point — your machine can reach `binaries.prisma.sh`, which is what this sandbox couldn't)

## 1. Install dependencies

```bash
cd moramba-backend
npm install
```

`package.json`'s `postinstall` script runs `prisma generate` automatically — watch for it in the output. If your internet is solid this should just work. If you see a checksum/binary download error here, see Troubleshooting #1 below.

**What "success" looks like:** the install finishes, and you'll see a `node_modules/.prisma/client` folder appear (that's the generated client code specific to this schema — it doesn't exist until this step runs successfully).

## 2. Sanity-check the schema compiles

```bash
npx prisma validate
```

This just parses `prisma/schema.prisma` and checks it's syntactically correct — no database connection needed. If this fails, the error will point at a specific line; that's a real typo in the schema to fix, not an environment problem.

## 3. Create the database and run the first migration

Since this is a full ORM switch, treat this as a fresh database — same as the last major restructure, don't try to migrate old Drizzle-created tables in place.

```bash
# If you want a truly clean slate (recommended for this first run):
psql -U postgres -c "DROP DATABASE IF EXISTS moramba_dev;"
psql -U postgres -c "CREATE DATABASE moramba_dev;"

npx prisma migrate dev --name init
```

`migrate dev` will:
1. Generate a SQL migration file under `prisma/migrations/` from the schema
2. Apply it to your database
3. Run `prisma generate` again automatically

**What "success" looks like:** it prints something like `Your database is now in sync with your schema` and creates `prisma/migrations/<timestamp>_init/migration.sql`.

**Open that generated `migration.sql` and skim it.** You're specifically checking that all 20 tables got created — `users`, `companies`, `employees`, `verifiers`, `customers`, `vendors`, `products`, `invitations`, `invoices`, `invoice_items`, `bills`, `bill_items`, `payments`, `documents`, `document_versions`, `shipments`, `shipment_events`, `salary_structures`, `payroll_runs`, `payroll_entries`.

## 4. Add back the two CHECK constraints — don't skip this

Prisma's schema DSL has no way to declare a `CHECK` constraint (unlike Drizzle, where this was declared right in the schema file). Three tables — `payments`, `documents`, `shipments` — each need one enforcing "exactly one of invoice_id / bill_id is set, never both, never neither." This was real, tested defense-in-depth before (see the original README's Section 16 — a direct `psql` insert bypassing the API was rejected by the database itself). Without this, that protection is gone at the database level, even though the application code still checks it.

Run this once, after the migration above:

```bash
psql -U postgres -d moramba_dev << 'EOF'
ALTER TABLE payments ADD CONSTRAINT payment_exactly_one_parent
  CHECK ((invoice_id IS NOT NULL AND bill_id IS NULL) OR (invoice_id IS NULL AND bill_id IS NOT NULL));

ALTER TABLE documents ADD CONSTRAINT document_exactly_one_parent
  CHECK ((invoice_id IS NOT NULL AND bill_id IS NULL) OR (invoice_id IS NULL AND bill_id IS NOT NULL));

ALTER TABLE shipments ADD CONSTRAINT shipment_exactly_one_parent
  CHECK ((invoice_id IS NOT NULL AND bill_id IS NULL) OR (invoice_id IS NULL AND bill_id IS NOT NULL));
EOF
```

Verify they actually attached:

```bash
psql -U postgres -d moramba_dev -c "\d payments" | grep CHECK
```

You should see `payment_exactly_one_parent` listed as a Check constraint. (If you ever run `prisma migrate reset` later, these three statements get wiped along with the rest of the data — re-run this block after any reset.)

## 5. Seed the database

```bash
npm run db:seed
```

**What "success" looks like:** the same output as before — 2 companies, 5 employees + their login emails printed, 3 verifiers, 4 customers, 4 vendors, 6 products.

## 6. Start the server

```bash
npm run dev
```

**What "success" looks like:** `✅ Connected to Postgres` then `🚀 Moramba API listening on http://localhost:4000`. If it crashes here, see Troubleshooting #2.

## 7. Run through this test checklist

Every one of these was verified end-to-end on the Drizzle version — now confirm the Prisma version behaves identically. Run these from a second terminal while `npm run dev` is running.

### 7a. Basic auth
```bash
# Login with a seeded user
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"karan.mehta@aureliatex.com","password":"Password123!"}' | python3 -m json.tool
```
Expect: a `token`, an `employee` object, and `accessibleCompanies` with **two** companies — Aurelia (`role: "admin"`) and Northbridge (`role: "owner"`). Save the token and the Aurelia company id for the next steps.

### 7b. Register with zero companies (the core "users vs employees" fix)
```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test.user@example.com","password":"TestPass123!"}' | python3 -m json.tool
```
Expect: `201`, a token, no error. Then log in with those same credentials and confirm `accessibleCompanies: []`.

### 7c. Create a company — confirm you become its Owner
```bash
TOKEN="<paste the token from 7b>"
curl -s -X POST http://localhost:4000/api/companies \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Co","logoText":"TC","logoColor":"#000000","taxId":"TESTTAX01","currency":"INR","address":{"line1":"x","city":"x","state":"x","zip":"x","country":"India"},"bank":{"accountName":"x","accountNumber":"0000000000","bankName":"x","ifsc":"XXXX0000000"}}' | python3 -m json.tool
```
Then `GET /api/auth/me` with that same token — confirm `accessibleCompanies` now has exactly one entry with `role: "owner"`.

### 7d. The "existing user → invitation, never a duplicate account" rule
```bash
AURELIA_ID="<Aurelia's company id from 7a>"
curl -s -X POST http://localhost:4000/api/companies/$AURELIA_ID/employees \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"firstName":"Priya","lastName":"Shah","email":"priya.shah@aureliatex.com","phone":"9998887771","employeeCode":"AT-EMP-777","department":"Ops","designation":"Analyst","role":"employee","dateOfJoining":"2026-09-01"}'
```
Expect: `{"type": "invitation", ...}` — NOT a new employee. (Note: this will 403 with the test-company token from 7c since that account isn't Admin/HR at Aurelia — use Karan's token from 7a instead for this one.)

### 7e. Brand-new employee → real account + temp password
```bash
curl -s -X POST http://localhost:4000/api/companies/$AURELIA_ID/employees \
  -H "Content-Type: application/json" -H "Authorization: Bearer <Karan's token>" \
  -d '{"firstName":"Fresh","lastName":"Person","email":"fresh.person@example.com","phone":"9998887770","employeeCode":"AT-EMP-999","department":"Ops","designation":"Analyst","role":"employee","dateOfJoining":"2026-09-01"}'
```
Expect: `{"type": "employee", "temporaryPassword": "FreshPerson@123", ...}`. Then confirm that exact email/password logs in successfully.

### 7f. Export Invoice — the transaction + totals math
```bash
CUSTOMER_ID=$(curl -s http://localhost:4000/api/companies/$AURELIA_ID/customers -H "Authorization: Bearer <Karan's token>" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

curl -s -X POST http://localhost:4000/api/companies/$AURELIA_ID/invoices \
  -H "Content-Type: application/json" -H "Authorization: Bearer <Karan's token>" \
  -d "{\"customerId\":\"$CUSTOMER_ID\",\"currency\":\"USD\",\"paymentTerms\":\"Pay Advance\",\"advancePercent\":30,\"exportDetails\":{\"originCountry\":\"India\",\"destinationCountry\":\"USA\",\"shippingMethod\":\"Sea\"},\"requiredDocs\":[],\"items\":[{\"description\":\"Cotton Fabric\",\"unit\":\"meters\",\"quantity\":100,\"rate\":145,\"taxPercent\":5}]}" | python3 -m json.tool
```
Expect: `invoiceNumber` like `EXP-2026-0001`, `grandTotal: "15225.00"` (100 × $145 = $14,500, + 5% tax = $725, total $15,225). **This is the important one** — it confirms `paymentTerms` correctly mapped from the API's `"Pay Advance"` string to the Prisma enum identifier under the hood (see `src/lib/prismaEnumMaps.ts`) instead of erroring or silently storing the wrong value.

### 7g. The exactly-one-parent CHECK constraint, for real
```bash
psql -U postgres -d moramba_dev -c "INSERT INTO payments (company_id, invoice_id, bill_id, amount, payment_type, payment_date) SELECT '$AURELIA_ID', NULL, NULL, 100, 'advance', now();"
```
Expect: Postgres itself rejects this with `violates check constraint "payment_exactly_one_parent"`. If this succeeds instead, you skipped (or mistyped) Step 4 — go back and re-run it.

### 7h. Verification Portal (separate identity realm, unaffected by any of this)
```bash
curl -s -X POST http://localhost:4000/api/verifier-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"meera.iyer@moramba.com","password":"Password123!"}' | python3 -m json.tool
```
Expect: a token and Meera's profile, same as always.

## 8. If everything above passed

You're done — the Prisma migration is verified working. From here on, day-to-day commands are:

```bash
npm run dev              # start the server
npm run db:seed          # reset to demo data
npm run db:wipe          # empty the database completely
npx prisma studio        # a GUI to browse/edit data directly (new — Drizzle didn't have this)
```

**One thing to remember going forward:** if you ever add a new model or change an existing one in `schema.prisma`, run `npx prisma migrate dev --name <description>` to generate and apply the next migration — never hand-edit the database directly and never edit an already-applied migration file.

---

## Troubleshooting

### 1. `postinstall` / `prisma generate` fails with a checksum or "Failed to fetch" error
This is almost always a network/proxy/firewall issue reaching `binaries.prisma.sh` specifically (corporate VPN, restrictive firewall, etc. — the same category of problem this sandbox had, just hopefully not on your machine). Try:
```bash
npx prisma generate
```
on its own with verbose output, and check if a VPN or proxy might be interfering. If you're behind a corporate proxy, Prisma respects `HTTPS_PROXY`/`HTTP_PROXY` environment variables.

### 2. Server crashes on startup with a Prisma-related error
Almost certainly means `prisma generate` didn't actually complete successfully even if `npm install` appeared to finish — the generated client types won't exist. Run `npx prisma generate` explicitly and watch for errors before trying `npm run dev` again.

### 3. `npx prisma migrate dev` complains about a non-empty/out-of-sync database
You likely still have the old Drizzle-created tables sitting there. Drop and recreate the database (see Step 3) rather than trying to migrate the old schema in place — this was a full ORM switch, not an incremental change.

### 4. A specific field's type looks wrong when you inspect data in `prisma studio`
Decimal/money fields (`amount`, `basic`, `netPay`, `defaultRate`, etc.) come back from Prisma as a `Decimal` object, not a plain JS number — same idea as Drizzle returning numeric columns as strings before. Every service function that does arithmetic on these already calls `Number(...)` first (see `invoice.service.ts`'s `withTotals`, for example) — if you add a NEW calculation somewhere, remember to do the same, or you'll get a `[object Object]`-style bug instead of a number.

### 5. Something in the enum-mapping (`src/lib/prismaEnumMaps.ts`) seems off
The five enums that needed this (`TransactionStatus`, `PaymentTerms`, `DocumentStatus`, `ShipmentStatus`, `EmploymentType`) are the ones whose original values contained spaces or hyphens ("Documents Pending", "Pay Advance", "Full-time", etc.) — Prisma's schema DSL doesn't allow those characters in enum identifiers, so each one is `@map`-ed to a clean identifier in `schema.prisma`, and this file translates the API's original string into that identifier right before any Prisma write/filter call. If you add a NEW enum value with a space or symbol in it later, it needs the same treatment in both files.

### 6. `Error: The datasource property url is no longer supported in schema files`
This means npm somehow installed Prisma 7 instead of the pinned 6.19.3 — check `package.json` still has exact versions (no `^`) for both `prisma` and `@prisma/client`, delete `node_modules` and `package-lock.json`, and reinstall. See the version note at the top of this document for the full story on why this project is pinned to 6.x.
