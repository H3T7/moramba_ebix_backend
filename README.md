# Moramba Backend

A real, working API for the Moramba frontend — Node.js + TypeScript + PostgreSQL.

This README assumes you're new to backend development. Every step is spelled out. If a command's output doesn't match what's described, stop and re-read the step before moving on — most problems come from skipping one small thing.

---

## 1. What's actually here right now

This is **Milestone 11**: the ENTIRE planned backend surface, all fully working and tested — Auth + Employees + Customers + Vendors + Products + Company Memberships & Invitations + Export Invoices & Import Bills + Payments + Documents + Shipments + Payroll + **Verification Portal**.

| Piece | Status |
|---|---|
| Project setup (TypeScript, Express, folder structure) | ✅ Done |
| Database schema: companies, employees, memberships, verifiers, customers, vendors, products, invitations, invoices+items, bills+items | ✅ Done, migrated |
| Auth: register (with or without a company), login, JWT, protected routes, role checks | ✅ Done, tested |
| Companies: create, list, get one | ✅ Done (minimal) |
| Employees: full CRUD, status/role changes, RBAC-gated | ✅ Done, tested |
| Customers: full CRUD, RBAC-gated (Admin + Accountant) | ✅ Done, tested |
| Vendors: full CRUD, RBAC-gated (Admin + Accountant) | ✅ Done, tested |
| Products: full CRUD, RBAC-gated (Admin + Accountant + HR), decimal-precise pricing | ✅ Done, tested |
| Company Memberships: per-company role, independent of any single global role | ✅ Done, tested |
| Invitations: create, list, accept, reject, resend, cancel — a real state machine | ✅ Done, tested |
| **Export Invoices: transactional create with line items, server-computed totals, submit-locks the record** | ✅ Done, tested |
| **Import Bills: mirror of Export Invoices, vendor-side** | ✅ Done, tested |
| **Payments: advance/final tracking, DB-enforced link to exactly one invoice or bill, paid/remaining summary** | ✅ Done, tested |
| **Documents: upload, replace-with-version-history, review workflow (approve/reject/request changes), DB-enforced single parent** | ✅ Done, tested |
| **Shipments: full lifecycle with a real event timeline, DB-enforced single parent** | ✅ Done, tested |
| **Payroll: salary history per employee, payroll run generation with frozen snapshots, entry-level Paid tracking** | ✅ Done, tested |
| **Verification Portal: its own login/JWT realm, cross-company review queue, approve/reject/request-changes decision (real, not Admin-gated anymore)** | ✅ Done, tested |

---

## 2. The big picture — how the pieces fit together

```
Browser (Moramba frontend)
        │  HTTP requests (fetch/axios), JSON in and out
        ▼
Express app (src/app.ts)
        │  every request passes through middleware first:
        │  helmet (security headers) → cors → json parser → morgan (logging)
        ▼
Routes (src/modules/*/  *.routes.ts)
        │  decides WHICH controller function handles this URL + method
        ▼
Controller (*.controller.ts)
        │  parses/validates the request (zod), calls the service, sends the response
        │  knows about HTTP (req, res) but not about SQL
        ▼
Service (*.service.ts)
        │  the actual business logic — "can this email register?", "hash this password"
        │  knows about the database but nothing about HTTP
        ▼
Drizzle ORM (src/db/client.ts)
        │  turns JS function calls into SQL
        ▼
PostgreSQL (your local database)
```

Every feature module (auth, company, and later customers/invoices/etc.) follows this same four-file shape: **schema → service → controller → routes**. Once you understand one module, you understand the pattern for all of them.

---

## 3. One-time setup

### 3.1 Install Node.js

You need Node 18 or newer. Check with:
```bash
node -v
```
If that fails or shows something older, install Node from [nodejs.org](https://nodejs.org) (the LTS version).

### 3.2 Install PostgreSQL locally

Pick **one** of these:

**Option A — Docker (recommended, easiest to get right):**
```bash
docker run --name moramba-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=moramba_dev \
  -p 5432:5432 \
  -d postgres:16
```
This downloads and starts a real Postgres server in a container. To stop/start it later: `docker stop moramba-postgres` / `docker start moramba-postgres`.

**Option B — Native install:**
- **Mac:** `brew install postgresql@16 && brew services start postgresql@16`
- **Windows:** download the installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
- **Linux:** `sudo apt install postgresql postgresql-contrib`

Then create the database:
```bash
psql -U postgres -c "CREATE DATABASE moramba_dev;"
```
(On some setups you'll need `sudo -u postgres psql -c "CREATE DATABASE moramba_dev;"` instead.)

### 3.3 Install project dependencies

```bash
cd moramba-backend
npm install
```

### 3.4 Configure environment variables

```bash
cp .env.example .env
```
Open `.env` and check `DATABASE_URL` matches your setup. The default (`postgresql://postgres:postgres@localhost:5432/moramba_dev`) matches both options above exactly — you probably don't need to change anything if you followed 3.2 as written.

### 3.5 Create the database tables

```bash
npm run db:migrate
```
This runs the SQL file in `src/db/migrations/` against your database, creating every table. You should see `[✓] migrations applied successfully!`.

### 3.6 Load demo data

```bash
npm run db:seed
```
This creates 2 demo companies, 5 employees (with different roles), and 3 verifiers — matching the mock data the frontend has been using — all with the password `Password123!`. The script prints every login email when it finishes.

### 3.7 Start the server

```bash
npm run dev
```
You should see:
```
✅ Connected to Postgres
🚀 Moramba API listening on http://localhost:4000
```
Leave this running in its own terminal. Open a **second** terminal for the commands below.

---

## 4. Prove it works

```bash
curl http://localhost:4000/health
```
Expect: `{"status":"ok","timestamp":"..."}`

Log in as one of the seeded employees:
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"karan.mehta@aureliatex.com","password":"Password123!"}'
```
You'll get back a JSON object with a `token` (a long string starting with `eyJ...`) and your employee profile plus the companies you can access.

Copy that token and try the protected route:
```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer PASTE_YOUR_TOKEN_HERE"
```
If you get your profile back, everything is wired up correctly. If you get `{"error":"..."}` with a 401, either you mistyped the token or it's a different one than you just received (tokens are single-use-to-copy, not single-use-to-call — you can reuse the same token for 7 days).

---

## 5. Project structure

```
src/
  config/env.ts          Validates and exports every environment variable
  db/
    client.ts             The Drizzle instance + Postgres connection pool
    schema/                One file per table, plus index.ts re-exporting all of them
    migrations/            Auto-generated SQL files — never hand-edit these
    seed.ts                Demo data loader
  lib/
    password.ts            bcrypt hashing helpers
    jwt.ts                  JWT sign/verify helpers
  middleware/
    auth.ts                 requireAuth / requireRole
    errorHandler.ts          Central error handling + custom AppError class
  modules/
    auth/                    register, login, me
    company/                 create, list, get
    (more modules land here as we build them)
  app.ts                    Wires up Express + all routes
  server.ts                 Actually starts listening on a port
```

---

## 6. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with auto-reload on file changes |
| `npm run build` | Compile TypeScript → `dist/` (for production) |
| `npm start` | Run the compiled `dist/` version |
| `npm run db:generate` | After editing a schema file, generate a new migration SQL file |
| `npm run db:migrate` | Apply any pending migrations to the database |
| `npm run db:studio` | Opens a browser-based GUI to browse/edit your database visually |
| `npm run db:seed` | Reset and reload demo data |

**The schema-change workflow**, whenever we add a new table or column together:
1. Edit/add a file in `src/db/schema/`
2. `npm run db:generate` — Drizzle reads your schema, compares it to the last migration, and writes a new SQL file with just the differences
3. Look at the generated SQL (in `src/db/migrations/`) — you should always be able to read and understand it
4. `npm run db:migrate` — applies it to your actual database

---

## 7. Key concepts explained

**ORM (Object-Relational Mapper).** Postgres only understands SQL. An ORM (Drizzle, here) lets you write TypeScript function calls instead, and translates them into SQL for you — while keeping everything type-checked, so a typo in a column name is caught before you even run the code.

**Migration.** A SQL file that changes your database's *structure* (adds a table, adds a column, etc.) in a specific, ordered, repeatable way. Every teammate (and every environment — your laptop, a teammate's laptop, production) runs the exact same migrations in the exact same order, so everyone's database structure stays identical.

**JWT (JSON Web Token).** After you log in, the server gives you a signed token instead of making you send your password on every request. You attach it as `Authorization: Bearer <token>` on every future request. The server verifies the signature to confirm it's genuine and hasn't been tampered with. See the big comment block in `src/lib/jwt.ts` for more.

**Password hashing.** We never store your actual password — only an irreversible scrambled version (a "hash"). See `src/lib/password.ts`.

**Middleware.** A function that runs *before* your actual route handler, with the power to inspect/modify the request or stop it entirely. `requireAuth` is middleware: it checks your token before your controller code ever runs.

**Validation with zod.** Every piece of data coming from the outside world (a request body) gets checked against a schema before we trust it. If someone sends `{"email": 123}` instead of a string, zod rejects it with a clear error — before it ever reaches our database logic.

---

## 8. What's next

Every planned backend module is built and tested. The only thing left is wiring the frontend's Export Invoice / Import Bill / Payments / Documents / Shipments / Payroll / Verification Portal UI (all still on mock data) to these real endpoints — no new backend modules remain on the roadmap.

Each milestone will also come with its own migration (if it needs new tables) and its own set of tested endpoints, exactly like this one.

## 9. Employees API reference

All routes require `Authorization: Bearer <token>` from a successful login.

| Method | Path | Who can call it | What it does |
|---|---|---|---|
| GET | `/api/companies/:companyId/employees` | Admin, HR | List every employee at a company |
| POST | `/api/companies/:companyId/employees` | Admin, HR | Create a new employee (sets their initial password) |
| GET | `/api/employees/:id` | Admin, HR | Get one employee |
| PATCH | `/api/employees/:id` | Admin, HR | Update profile fields (email changes are checked for uniqueness) |
| PATCH | `/api/employees/:id/status` | Admin, HR | Set `active`/`inactive` |
| PATCH | `/api/employees/:id/role` | **Admin only** | Change someone's role — deliberately locked tighter than the rest |
| DELETE | `/api/employees/:id` | **Admin only** | Remove an employee |

Every one of these was tested against the real database with curl, including the failure paths: a non-Admin/HR user gets a `403`, an unauthenticated request gets a `401`, and creating an employee with an email that's already taken gets a `409`.

## 10. Customers & Vendors API reference

Same nested-resource shape as Employees, but a **different** RBAC rule — this is worth noticing: **HR cannot touch these** (they were blocked with a `403` in testing), while **Accountant can** (unlike Employees, where Accountant is blocked). Each module enforces exactly the access rule that module needs, not one blanket "logged in employees can do anything" check.

| Method | Path | Who can call it |
|---|---|---|
| GET / POST | `/api/companies/:companyId/customers` | Admin, Accountant |
| GET / PATCH / DELETE | `/api/customers/:id` | Admin, Accountant |
| GET / POST | `/api/companies/:companyId/vendors` | Admin, Accountant |
| GET / PATCH / DELETE | `/api/vendors/:id` | Admin, Accountant |

## 11. Products API reference

| Method | Path | Who can call it |
|---|---|---|
| GET / POST | `/api/companies/:companyId/products` | Admin, Accountant, **HR** |
| GET / PATCH / DELETE | `/api/products/:id` | Admin, Accountant, HR |

Products deliberately allows **HR** where Customers/Vendors don't — tested and confirmed: HR gets `200` on products, a plain Employee gets `403`.

`defaultRate` is stored as Postgres `numeric(12, 2)`, not a plain number — confirmed by creating a product at `19.99`, reading it back as the exact string `"19.99"` (not `19.989999999999998` or similar), updating it, and getting the exact new value back. See the comment in `src/db/schema/products.ts` for why every money column in this app will follow this same pattern (Export Invoices, Import Bills, and Payments all deal in money too).

## 12. A real bug I hit while building this — worth knowing about

While testing the Products module, every single product route returned `404 "No route"` — even though the code was correct and `tsc` compiled clean. The cause: I'd started the dev server a few file-edits too early in my own workflow, so it was running with an in-memory version of `app.ts` from *before* the product routes were wired in. **Killing the server and starting it fresh fixed it immediately** — nothing was wrong with the code.

If you ever see `"No route"` for an endpoint you're sure you just added: stop `npm run dev`, start it again, and try the request again before you go hunting for a code bug. `tsx watch` (what `npm run dev` uses) reloads automatically on file saves, but if you've got a plain `npx tsx src/server.ts` running in a separate terminal instead, it won't.

## 13. Company Memberships & Invitations API reference

This is the milestone that makes "User account ≠ Company membership" real, not just a comment in the code:

- **`employees.companyId` is now nullable.** `POST /api/auth/register` can be called with none of the company-specific fields at all — you get back a real account and JWT with `accessibleCompanies: []`. It gains access to a company only by accepting an invitation.
- **`employee_companies` is now a real membership table**, not just an access list — each row has its OWN `role` (owner / admin / hr / accountant / operations / verifier / viewer / employee) and its OWN `status` (active / suspended / removed), completely independent of the same person's role at any other company. `GET /api/auth/me` returns each accessible company with that specific role attached.
- **Invitation status and membership status are two separate state machines.** An invitation resolves once (`pending → accepted/rejected/expired/cancelled`) and never changes again; membership can keep changing after that for as long as someone is associated with a company.

| Method | Path | Who can call it | What it does |
|---|---|---|---|
| POST | `/api/companies/:companyId/invitations` | Admin, HR | Create an invitation. Automatically links to an existing account by email if one exists — never creates a duplicate account. Blocks a second pending invite to the same email+company with `409`. |
| GET | `/api/companies/:companyId/invitations` | Admin, HR | List every invitation ever sent from this company (any status) — expired ones are lazily flipped from `pending` to `expired` on read. |
| GET | `/api/invitations/mine` | Any signed-in employee | List *your own* pending invitations, matched by your account's email. |
| POST | `/api/invitations/:id/accept` | Any signed-in employee | Accept an invitation addressed to you. Creates (or reactivates, if you'd been removed before) a membership row, and backfills your `companyId` if this was your first company. |
| POST | `/api/invitations/:id/reject` | Any signed-in employee | Reject an invitation addressed to you. No membership is ever created. |
| POST | `/api/invitations/:id/resend` | Admin, HR | Resets the 7-day expiry window — only works while still pending. |
| POST | `/api/invitations/:id/cancel` | Admin, HR | Pulls back an invitation before it's answered — only works while still pending. |

**Every one of these was tested end to end against the real database**, including the cases that actually matter for security and correctness:
- Registered a brand-new account with zero fields beyond name/email/password → confirmed `companyId: null` and `accessibleCompanies: []`
- Invited that account by email → confirmed the backend auto-detected the existing account (`invitedEmployeeId` populated) rather than creating a duplicate
- Accepted it → confirmed a real membership was created with the invited role, and `companyId` was correctly backfilled since it was that account's first company
- Invited a genuinely new email with no account at all → confirmed `invitedEmployeeId` came back `null`
- Tried to invite the same email to the same company twice while the first invite was still pending → `409`
- Rejected an invitation → confirmed no membership was created
- A plain Employee tried to create an invitation → `403`
- **One person tried to accept an invitation addressed to someone else → `403`** — this is enforced in the service layer (matching the invitation's email against the accepting account's own email), not just hidden in the UI
- Cancelled a pending invitation, then tried to cancel it again → `409` ("already cancelled")

## 14. Frontend integration notes

This module is now fully wired into the frontend (`invitationApiService.js`, `invitation/slice.js` on the React side) and tested against the running server with the real `Origin: http://localhost:5173` header, matching exactly how a browser would call it — every field each component actually reads (`companyName`, `companyLogoColor`, `invitedByName`, `invitedEmployeeId`, `result.company.name`, `result.invitation.role`) was confirmed present in the real API responses, not just assumed.

One thing worth understanding if you're reading both codebases side by side: the frontend's Export Invoices, Import Bills, Employees list *display*, and Dashboard still run on **mock company data** (a separate seed with ids like `cmp_001`) because those modules don't have real backend endpoints for company-scoped views yet. So when someone accepts a REAL invitation via this API, the frontend bridges the result into that mock world by matching the company **name** (e.g. "Aurelia Textiles Pvt. Ltd." exists in both the real seed and the mock seed with identical names on purpose) — see `handleAccept` in `InvitationsPage.jsx`. This is a deliberate, temporary bridge, not a design flaw: once Export Invoices/Import Bills get their own real backend module, that bridge goes away and everything reads from one source of truth.

## 15. Export Invoices & Import Bills API reference

Both modules are structural mirrors — invoices are customer-side (export), bills are vendor-side (import). Same RBAC as Customers/Vendors (Admin + Accountant), with Submit/Delete tightened to Admin-only since those are one-way, consequential actions.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST | `/api/companies/:companyId/invoices` (or `/bills`) | Admin, Accountant | List returns totals only, not every line item (avoids N+1-per-invoice payload bloat) |
| GET | `/api/invoices/:id` (or `/bills/:id`) | Admin, Accountant | Full record with line items and computed totals |
| PATCH | `/api/invoices/:id` | Admin, Accountant | Blocked with `409` once submitted. Including `items` REPLACES the whole line-item set (delete-then-reinsert in one transaction), not a merge |
| PATCH | `/api/invoices/:id/status` | **Admin only** | |
| POST | `/api/invoices/:id/submit` | **Admin only** | One-way lock — `409` if called twice |
| DELETE | `/api/invoices/:id` | **Admin only** | Blocked with `409` once submitted |

**Key design points, tested against the real database:**
- Invoice/bill creation and its line items insert inside **one database transaction** — either the whole thing commits or none of it does, so a crash mid-request can never leave a parent record with no items.
- `invoiceNumber`/`billNumber` (`EXP-2026-0001`, `IMP-2026-0001`) are server-generated by counting existing numbers for the year, not client-supplied.
- Totals (`lineTotal`, `lineTax`, `subtotal`, `taxTotal`, `grandTotal`) are computed server-side from `numeric`-precision quantity/rate/tax fields, never trusted from the client.
- Verified: 100 × $145 + 5% tax → line total $14,500 / tax $725, correctly summed across multiple lines to a $19,425 grand total. A second real test (50kg × ₹210 at 12% tax → ₹11,760) confirmed on Import Bills too.
- Empty `items: []` → `400` (a transaction needs at least one line).
- HR tried to create an invoice → `403`.
- Edit / submit-again / delete, all tried on an already-submitted invoice → `409` each time.
- Updating `items` on an existing bill replaced the old line item entirely rather than appending — confirmed only the new item exists afterward, with correct recalculated totals.

## 16. Payments API reference

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST | `/api/companies/:companyId/payments` | Admin, Accountant | |
| GET | `/api/transactions/:transactionId/payments?type=invoice\|bill` | Admin, Accountant | Every payment recorded against one invoice or bill |
| GET | `/api/transactions/:transactionId/payments/summary?type=invoice\|bill` | Admin, Accountant | `{ grandTotal, paid, remaining, paymentCount }` — grand total recomputed fresh from real line items, never a stored/stale number |
| GET | `/api/payments/:id` | Admin, Accountant | |
| PATCH | `/api/payments/:id/status` | **Admin only** | |
| DELETE | `/api/payments/:id` | **Admin only** | |

**The key design decision here:** a payment belongs to exactly one invoice or one bill — never both, never neither — enforced with a Postgres `CHECK` constraint, not just application code. Confirmed by trying to `INSERT` a payment with neither `invoice_id` nor `bill_id` set **directly via `psql`, bypassing the API entirely** — the database itself rejected it:
```
ERROR:  new row for relation "payments" violates check constraint "payment_exactly_one_parent"
```
That's real defense-in-depth: even a future bug in this code, or someone running a raw SQL script by hand, can't create a payment that doesn't make sense.

Also tested: a `pending` or `failed` payment doesn't count toward the summary's `paid` total (only `completed` does) — verified a pending $1,000 payment left the summary unchanged, then marking it `completed` correctly added it. HR blocked from recording a payment (`403`); Accountant blocked from deleting one (`403`, Admin-only); Admin succeeded.

## 17. Documents API reference

Same "exactly one parent" pattern as Payments, plus real version history.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST | `/api/companies/:companyId/documents` | Admin, Accountant | |
| GET | `/api/transactions/:transactionId/documents?type=invoice\|bill` | Admin, Accountant | |
| GET | `/api/documents/:id` | Admin, Accountant | Includes full `history` array, newest version first |
| POST | `/api/documents/:id/replace` | Admin, Accountant | Bumps `version`, resets status to `Pending Verification`, clears any prior rejection reason — a corrected file has to be looked at fresh |
| DELETE | `/api/documents/:id` | **Admin only** | |

The review decision itself (`POST /.../review`) has moved to the Verifier Portal's own routes — see Section 20.

**Tested against the real database:**
- Uploaded a document, confirmed `version: 1` and exactly one history row
- Rejected it with a reason → confirmed `status: "Rejected"` and the reason stored
- Replaced the file → confirmed `version` bumped to 2, status reset to `"Pending Verification"`, rejection reason cleared, and the history now shows both versions
- Approved → `status: "Verified"`
- Tried inserting a document with neither `invoice_id` nor `bill_id` **directly via `psql`** → rejected by the same kind of `CHECK` constraint proven on Payments
- HR tried to upload → `403`. Accountant tried to review → `403` (Admin-only)

## 18. Shipments API reference

Same "exactly one parent" pattern as Payments/Documents, plus a real append-only event timeline (one row per status change, powering a genuine history view, not just "current state with no memory").

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST | `/api/companies/:companyId/shipments` | GET: Admin, Accountant, HR · POST: Admin, Accountant | Creating writes the first `"Preparing"` timeline event automatically |
| GET | `/api/transactions/:transactionId/shipments?type=invoice\|bill` | Admin, Accountant, HR | |
| GET | `/api/shipments/:id` | Admin, Accountant, HR | Includes `timeline`, newest event first |
| PATCH | `/api/shipments/:id` | Admin, Accountant | Edits carrier/tracking/route fields — doesn't touch status or the timeline |
| PATCH | `/api/shipments/:id/status` | Admin, Accountant | Writes a NEW timeline event rather than editing the shipment in place. Setting status to `"Delivered"` auto-stamps `actualDate` |
| DELETE | `/api/shipments/:id` | **Admin only** | |

RBAC is intentionally asymmetric here: HR can **read** shipment data (they're not purely a finance concern — see Products for the same reasoning) but can't create, edit, or change status — confirmed with a real `200` on list and a real `403` on create using the same HR account in the same test run.

**Tested against the real database:** created a shipment → confirmed a `"Preparing"` event was written automatically → walked it through `In Transit → Customs → Delivered` → confirmed all 4 timeline events came back in the right order and `actualDate` was auto-stamped only once it hit `Delivered`. Also confirmed the `CHECK` constraint rejects a shipment with neither `invoice_id` nor `bill_id` **directly via `psql`**, same as Payments and Documents.

## 19. Payroll API reference

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/companies/:companyId/salary-structures` | Admin, HR | Adds a new salary record — never overwrites the previous one (see below) |
| GET | `/api/employees/:employeeId/salary-history` | Admin, HR | Every salary change ever recorded, most recent first |
| POST | `/api/companies/:companyId/payroll-runs` | Admin, HR | Generates a run for a month across the selected employees. `409` if that month already has a run for this company; `422` if any selected employee has no salary structure as of that month |
| GET | `/api/companies/:companyId/payroll-runs` | Admin, HR, Accountant | |
| GET | `/api/payroll/runs/:id` | Admin, HR, Accountant | Includes every `entry` plus a computed `totalNet` |
| PATCH | `/api/payroll/runs/:id/status` | Admin, HR | |
| PATCH | `/api/payroll/entries/:id/status` | Admin, HR | Setting `"Paid"` auto-stamps `paidAt`; changing away from it clears the stamp |

**Two design decisions worth knowing:**
- **Salary structures are append-only history, not an overwritten single row.** `effectiveFrom` lets someone get a raise next month without losing the record of what they were paid before. Run generation always picks whichever structure's `effectiveFrom` is the most recent one on or before the run's month.
- **Payroll entries are a frozen snapshot**, not a live pointer back to the salary structure. The actual basic/HRA/etc. figures are copied onto the entry at generation time, so a raise given in October can never silently rewrite what September's payslip says was paid.

**A real bug caught and fixed during testing, not just written and shipped:** my first version computed "the last day of this month" as a hardcoded `-31`, which produced the invalid date `2026-09-31` (September only has 30 days) and crashed with a `500` the moment anyone tried to generate a run for a 30-day month. Fixed to compute the real last day via `new Date(year, month, 0)`, then re-tested the exact case that broke it.

**Verified against the real database:** an employee with no salary structure correctly produces a `422` (not a `500`, after the fix above) naming exactly how many employees were missing one; generated a real two-person run and hand-checked the math (₹40,000 + ₹16,000 + ₹1,600 + ₹1,250 + ₹5,000 − ₹2,500 deductions = ₹61,350 net, matching exactly); a duplicate month for the same company correctly `409`s; marking an entry `"Paid"` correctly stamps `paidAt`; Accountant can view a run but is blocked (`403`) from generating one; a plain Employee is blocked from the module entirely.

## 20. Verification Portal API reference

A completely separate login realm from the company workspace — matching the frontend's "Verification Portal is a separate world" design. A verifier isn't a member of any company; they review documents across ALL of them.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/verifier-auth/login` | `{ email, password }` → `{ token, verifier }` |
| GET | `/api/verifier-auth/me` | Requires a verifier token |
| GET | `/api/verifier/documents/queue?status=...` | Every document across every company, optionally filtered by status. Joined with the company name and parent invoice/bill number |
| GET | `/api/verifier/documents/:id` | |
| POST | `/api/verifier/documents/:id/review` | `{ decision: "approve" \| "reject" \| "request_changes", comments?, rejectionReason? }` — this is the same decision logic documented in Section 17, now actually gated by a verifier's own token instead of an Admin's |

**The most important thing this module gets right is isolation, and it's actually tested, not just asserted:**
- An employee's JWT (`type: "employee"`) used on `/api/verifier/documents/queue` → `401`
- A verifier's JWT (`type: "verifier"`) used on `/api/auth/me` → `401`
- Both directions checked in the same test run with real tokens from real logins, not mocked.

**Real database test, full loop:** logged in as verifier Meera Iyer → confirmed `/me` returns her profile → uploaded a fresh document as an Admin employee → confirmed it appeared in Meera's queue with the exact right context (`"packing-list.pdf | Aurelia Textiles Pvt. Ltd. | invoice EXP-2026-0001"`) → approved it as Meera → confirmed `status: "Verified"` and `reviewerVerifierId` was actually set to her id → confirmed an Admin's employee token gets `401` when it tries to hit the same verifier-only review route.

**Migration note worth knowing about:** `documents.reviewerEmployeeId` had to become `reviewerVerifierId` — a genuinely different foreign key target, since a verifier is not an employee. `drizzle-kit generate` detected this as an ambiguous "was this a rename?" case and wanted an interactive yes/no answer, which this sandbox has no TTY to provide. Rather than hand-write risky raw SQL migrations, I split it into two unambiguous steps instead — add the new column (migrate), then drop the old one (migrate) — so the tool could handle each one automatically with its snapshot tracking staying correct, no guessing involved.

**A real bug `tsc` caught before it ever ran:** after renaming the column, `replaceDocument` (which resets a document back to "Pending Verification" when a corrected file is uploaded) still referenced the old `reviewerEmployeeId` field name in its reset logic. TypeScript's `--noEmit` check refused to compile it — caught and fixed before the server ever started, not discovered live.

## 21. Where the backend stands now

Every module on the original roadmap is built and tested against a real running Postgres database: Auth (including true zero-company self-registration), Employees, Customers, Vendors, Products, Company Memberships & Invitations, Export Invoices & Import Bills, Payments, Documents, Shipments, Payroll, and the Verification Portal. 20 tables, all migrated. The only work left is wiring the frontend's still-mock screens for these later modules to the real endpoints documented above — no new backend modules remain on the roadmap.

## 22. A real bug caught while wiring the frontend, worth knowing about

`npm run db:seed` is meant to be safe to re-run any time — but once real invoices, documents, payroll runs, etc. actually existed in the database (from testing the frontend wiring against this API), running it again failed with:
```
error: update or delete on table "employees" violates foreign key constraint
"payroll_entries_employee_id_employees_id_fk" on table "payroll_entries"
```
The cause: `seed.ts`'s cleanup step was never updated as new modules were added from Milestone 5 onward — it only ever cleared the tables that existed when it was first written (companies, employees, customers, vendors, products, invitations), so Postgres correctly refused to delete an employee that a payroll entry still pointed to.

Fixed by adding every table introduced since then to the cleanup, in the correct child-before-parent order (payroll entries → payroll runs → salary structures → shipment events → shipments → document versions → documents → payments → invoice/bill line items → invoices/bills → invitations → memberships → employees → customers/vendors/products → companies → verifiers). Re-tested: seed now runs cleanly even with real transactional data already in the database, confirmed by checking the count came back to exactly the seeded numbers (0 invoices, 4 customers) right after.

**If you add a new table with a foreign key to an existing one in the future, remember to add its cleanup to `seed.ts` too** — this exact class of bug will resurface otherwise, and the error message points at the table being *referenced*, not the one you actually forgot to clear, which makes it a bit confusing to track down.
