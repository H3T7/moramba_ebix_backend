# Moramba Backend

A real, working API for the Moramba frontend — Node.js + TypeScript + PostgreSQL.

> ## ⚠️ ORM switched: Drizzle → Prisma
>
> This backend was originally built on Drizzle ORM. It has since been switched to **Prisma** — the schema is now `prisma/schema.prisma`, and every service file was rewritten to Prisma Client syntax.
>
> **Start here:** [`PRISMA_TESTING_STEPS.md`](./PRISMA_TESTING_STEPS.md) — a full step-by-step guide to install, migrate, seed, and verify the Prisma version actually works. **This code has not been run in the sandbox it was written in** (Prisma's engine binary is hosted at `binaries.prisma.sh`, which that sandbox's network couldn't reach) — you are the first real test of it. The testing doc includes a full checklist covering every major flow.
>
> Everything below this notice was written while the backend still ran on Drizzle. It's left in place as-is because it's still accurate **history** of how and why each module was built and tested (the reasoning behind every design decision hasn't changed) — but any command shown as `drizzle-kit ...` is now `prisma ...` (see the testing doc for the current equivalents), and code snippets referencing `db.query...`/`db.insert(...)` describe the old implementation, not the current one.

## 1. What's actually here right now

This is **Milestone 12**: every module from Milestone 11, now on a corrected **Users vs. Employees** identity model (see Section 28) — a real person is a `user`; their role, department, and everything else company-specific lives on a separate `employees` row per company they belong to.

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

**Duplicate emails are rejected**, per company, case-insensitively: creating (or updating) a customer/vendor with an email that already exists for that same company returns `409` with a message naming the existing record (`"A customer with this email already exists for this company (Acme Corp)."`). The SAME email is fine across two *different* companies. Enforced twice — an application-level check for a clear error message, and a case-insensitive database index (`prisma/migrations/20260922100000_customer_vendor_unique_email`) as a backstop against a race between two simultaneous requests.

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
| GET | `/api/companies/:companyId/documents` | Admin, Accountant | Newest first. Each row carries `uploadedBy` (a name), `uploadedAt`, `hasFile`, `mimeType`, `fileSize` |
| POST | `/api/companies/:companyId/documents` | Admin, Accountant | **`multipart/form-data`**: one file in the field `file`, plus text fields `invoiceId` *or* `billId` (exactly one), `category`, and optional `docType`, `description`, `country`. The file name comes from the file itself. |
| GET | `/api/transactions/:transactionId/documents?type=invoice\|bill` | Admin, Accountant | |
| GET | `/api/documents/:id` | Admin, Accountant | Includes full `history` array, newest version first (each entry: `version`, `fileName`, `fileSize`, `uploadedAt`, `uploadedBy`, `hasFile`, `isCurrent`) |
| GET | `/api/documents/:id/file` | Admin, Accountant | Streams the stored file. `?version=N` fetches an older version; `?download=1` forces a download. PDFs and images are sent `inline`, everything else as an `attachment`. Send the JWT in the `Authorization` header (fetch it as a Blob — a plain `<a href>` can't carry the header). |
| POST | `/api/documents/:id/replace` | Admin, Accountant | **`multipart/form-data`** with the new file in `file`. Bumps `version`, resets status to `Pending Verification`, clears any prior rejection reason — a corrected file has to be looked at fresh. The previous file is **kept** so it stays in the history. |
| PATCH | `/api/documents/:id` | Admin, Accountant | Changes only `docType` / `description` — no new file, no new version |
| DELETE | `/api/documents/:id` | **Admin only** | Also deletes every stored file (all versions). Deleting an invoice/bill does the same for its documents. |

### Where the files live

Uploaded files are stored on the server's own disk, **not** in the database:

```
<UPLOAD_DIR>/<companyId>/<random-uuid>.<ext>      (UPLOAD_DIR defaults to ./uploads)
```

The database keeps the person's original file name (for display and download), plus `stored_name`, `mime_type` and `file_size`. **Back up the `uploads/` folder together with the database.** Configure with `UPLOAD_DIR` and `MAX_UPLOAD_MB` (default 10) in `.env`.

- Allowed types: `.pdf .png .jpg .jpeg .webp .gif .doc .docx .xls .xlsx .csv .txt`. The stored/served MIME type is looked up from the extension, never trusted from the browser. HTML and SVG are deliberately not accepted.
- A rejected upload never leaves a file behind: everything that can be rejected is checked *before* the file is written, and if the database write fails afterwards the file is deleted again.
- Rows created before file storage existed have `hasFile: false` (a name, but no file). They can be fixed by using Replace.
- Verifiers can fetch a file at `GET /api/verifier/documents/:id/file` (their own token; a company token is rejected with `401`, and vice versa).
- All of `src/lib/fileStorage.ts` is the only code that touches the disk, so moving to S3/R2 later means rewriting just that file.

**Run the migration** `20260921120000_document_file_storage` (`npm run db:deploy`) — it adds `stored_name`, `mime_type`, `file_size` to `documents` and `document_versions`.

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
| GET | `/api/verifier/documents/queue?status=...` | Every document across every company, **oldest first** (a real FIFO queue), optionally filtered by status. Each row carries `companyName`, `transactionNumber`, `transactionType`, `uploadedBy`, `reviewerName` and `reviewedAt` |
| GET | `/api/verifier/documents/:id` | The document plus its `history` (versions), its `reviews` log, its `companyName`, and a `transaction` summary of the invoice/bill it belongs to (number, status, customer/vendor, countries, currency, total) — a verifier can't call the company-only invoice/bill routes, so this is how the review screen knows what it is reviewing |
| POST | `/api/verifier/documents/:id/start-review` | Picks the document up: `Pending Verification` → `Under Review`, assigned to the caller, so the company can see it has been seen and by whom. A no-op if it is already under review or decided — opening a document to look at it never disturbs someone else's decision |
| POST | `/api/verifier/documents/:id/review` | `{ decision: "approve" \| "reject" \| "request_changes", comments?, rejectionReason? }` — this is the same decision logic documented in Section 17, now actually gated by a verifier's own token instead of an Admin's. **Rejecting or requesting changes requires a reason** (`rejectionReason` or `comments`) → otherwise `400`; the reason is stored on the document and shown to whoever uploaded it |

**The most important thing this module gets right is isolation, and it's actually tested, not just asserted:**
- An employee's JWT (`type: "employee"`) used on `/api/verifier/documents/queue` → `401`
- A verifier's JWT (`type: "verifier"`) used on `/api/auth/me` → `401`
- Both directions checked in the same test run with real tokens from real logins, not mocked.

**Real database test, full loop:** logged in as verifier Meera Iyer → confirmed `/me` returns her profile → uploaded a fresh document as an Admin employee → confirmed it appeared in Meera's queue with the exact right context (`"packing-list.pdf | Aurelia Textiles Pvt. Ltd. | invoice EXP-2026-0001"`) → approved it as Meera → confirmed `status: "Verified"` and `reviewerVerifierId` was actually set to her id → confirmed an Admin's employee token gets `401` when it tries to hit the same verifier-only review route.

**Migration note worth knowing about:** `documents.reviewerEmployeeId` had to become `reviewerVerifierId` — a genuinely different foreign key target, since a verifier is not an employee. `drizzle-kit generate` detected this as an ambiguous "was this a rename?" case and wanted an interactive yes/no answer, which this sandbox has no TTY to provide. Rather than hand-write risky raw SQL migrations, I split it into two unambiguous steps instead — add the new column (migrate), then drop the old one (migrate) — so the tool could handle each one automatically with its snapshot tracking staying correct, no guessing involved.

**A real bug `tsc` caught before it ever ran:** after renaming the column, `replaceDocument` (which resets a document back to "Pending Verification" when a corrected file is uploaded) still referenced the old `reviewerEmployeeId` field name in its reset logic. TypeScript's `--noEmit` check refused to compile it — caught and fixed before the server ever started, not discovered live.

### Two kinds of verifier

| | Moramba's own verifiers | Company employees with the **Verifier** role |
|---|---|---|
| Where they live | rows in `verifiers` (seeded), with their own password | a normal company user + an employee membership with `role = verifier` (added via Employees → Add, then the invitation is accepted) |
| Sign in with | `POST /api/verifier-auth/login` | the **same email + password as their normal login** — either `POST /api/verifier-auth/login`, or a normal login followed by `POST /api/verifier-auth/exchange` |
| Can review | documents of **every** company (`scope: "all"`) | only documents of the company/companies where they hold the role (`scope: "company"`, with a `companies` list) |

Notes:
- The portal keeps a linked row in `verifiers` for a company verifier (`verifiers.user_id`, created the first time they open the portal) because review decisions are recorded against a verifier id. Migration `20260921180000_verifier_user_link`.
- **Scope is re-checked on every request** — the queue, the document detail, the file download, `start-review` and the decision. Suspending someone or changing their role takes effect immediately, even for a token they already hold; login then fails too.
- A document outside a company verifier's scope answers **`404 Document not found`** (not `403`), so the response doesn't reveal that the id exists.
- A wrong password, an unknown email and a user with no verifier role all return the same `401 Invalid email or password.` on the portal login. `POST /api/verifier-auth/exchange` (which needs a normal login token) returns `403` if the caller holds no verifier role.
- Why company-scoped: otherwise any company's HR/Admin could add "a verifier" and read every other company's documents.
- On the frontend, `AuthGuard` sends a user whose role at the active company is `verifier` to `/verifier-entry`, which performs the exchange and opens the portal.

### Approvals: who decides what

| Step | Who | What happens |
|---|---|---|
| Share | Admin / Accountant | Upload documents to an invoice or bill → each starts as `Pending Verification` and appears in every verifier's queue |
| Verify | Verifier | `start-review` → `Under Review`; then `approve` → `Verified`, or `reject` / `request_changes` (a reason is required) |
| Fix | Admin / Accountant | `POST /api/documents/:id/replace` uploads a corrected file → the document goes back to `Pending Verification` and into the queue again. Earlier rounds stay in the review log |
| Submit | **Admin / Owner only** | `POST /api/invoices/:id/submit` / `POST /api/bills/:id/submit` |

**Submit is gated server-side.** It returns `409` with an explanation unless (a) at least one document has been uploaded, (b) every uploaded document is `Verified`, and (c) at least as many documents as the invoice/bill's required-documents checklist have been uploaded. (The UI already hid the button until this was true; now the API enforces it too.)

**Review log.** Every pick-up and decision is kept in the append-only `document_reviews` table (`documentId`, `verifierId`, the document `version` reviewed, resulting `status`, `comments`, `reason`, `createdAt`). `GET /api/documents/:id` and the verifier version return it as `reviews` (newest first, with `verifierName`). Run the migration `20260921150000_document_reviews` (`npm run db:deploy`).

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

## 23. A real gap found and fixed: company creation never made anyone Owner

Reported issue: registering a new account and creating a company worked in isolation, but the person who created it had no real ownership of it — `POST /api/companies` just inserted a row and stopped. No membership was created at all, so "the creator becomes Owner" (a core rule from day one) was never actually true on the backend.

**Fixed:** `createCompany` now runs inside a transaction that inserts the company AND a real `employee_companies` row with `role: "owner"` for whoever created it — same pattern as every other parent+child insert in this API. If it's their first company ever, their `employees.companyId` (previously `null`) gets backfilled too, identical to what happens when accepting an invitation for the first time. The route now requires `requireAuth` (previously fully public) since it needs to know who's creating it.

**Tested end to end against a real, freshly-wiped database:** registered a brand-new account with zero fields beyond name/email/password → confirmed `accessibleCompanies: []` → created a company → confirmed `/auth/me` now shows that company with role `"owner"` and `companyId` correctly backfilled → created a SECOND company as the same person → confirmed they're `"owner"` of both, independently.

## 24. Testing from a genuinely empty database

`npm run db:wipe` clears every table's data (keeping the schema/migrations intact) without seeding anything back — no demo company, no demo employees. Use this to test the real flow exactly as a brand-new person would experience it:

```bash
npm run db:wipe
npm run dev
```

Then register a real account, create a company, and confirm you're its Owner — no pre-existing demo data to lean on or accidentally rely on. Run `npm run db:seed` afterward whenever you want the demo data back.

## 25. The matching frontend gap: Register was never actually wired

The backend has supported real self-registration (with `companyId` fully optional) since Milestone 5 — but `RegisterPage.jsx` on the frontend never called it. It only ran a `setTimeout` to simulate a network round-trip, then moved on. Nothing was ever created, so signing in with a "newly registered" account always failed — there was nothing in the database to sign into.

Fixed on the frontend side: `RegisterPage.jsx` now calls the real `registerRequest()`, `CompanyOnboardingPage.jsx` now calls the real `createCompanyThunk` (hitting the fixed `POST /api/companies` from Section 23) and bridges the result into the app's still-partially-mock world, and a real Rules-of-Hooks bug (a `useState` declared after an early `return`) was caught by lint and fixed before it shipped. See the frontend project's own notes for the full details — this section is here so both sides of the fix are discoverable from either repo.

## 26. A real gap found and fixed: becoming Owner didn't grant Owner-level access

Reported (with a screenshot): a brand-new user registered, created a company, correctly saw "Owner" in the Company Switcher — but the sidebar only showed Dashboard and My Profile, like a plain Employee.

**Root cause:** two separate role fields, never connected. `employee_companies.role` (owner/admin/hr/accountant/operations/verifier/viewer/employee — per-company, what shows in the Company Switcher) is intentionally different from `employees.role` (admin/hr/accountant/employee — the single global RBAC field the frontend's sidebar and permission checks actually read). Creating a company correctly set the membership role to `"owner"`, but never touched `employees.role`, which stays at its registration default of `"employee"` forever. Same gap existed on the invitation-accept path — accepting an invitation as "HR" never updated the RBAC field either.

**Fixed in both places**, using the same `!creator.companyId` / `!acceptingEmployee.companyId` guard already used for backfilling their home company — i.e. only on someone's FIRST company, so it can never silently upgrade someone who already has an established role elsewhere just because they created or joined an unrelated second company:
- `company.service.ts`'s `createCompany` — sets `employees.role = "admin"` for the creator, alongside the existing owner membership and companyId backfill.
- `invitation.service.ts`'s `acceptInvitation` — maps the invitation's membership role to the closest RBAC role (`owner`/`admin` → `admin`, `hr` → `hr`, `accountant` → `accountant`, everything else → `employee`) and sets it on first acceptance.

**Tested against a real, freshly-wiped database, both paths:** registered a brand-new account, confirmed `role: "employee"` right after registering, created a company, confirmed `role` flipped to `"admin"` while the membership stayed correctly `"owner"`. Separately: invited a brand-new email as `"hr"`, confirmed their role was `"employee"` before accepting and `"hr"` immediately after.

## 27. Two more real gaps found and fixed

### Stale role until logout/login (frontend fix, documented on both sides)

Following on from Section 26's fix: setting `employees.role` correctly server-side wasn't quite enough, because the JWT the person is already holding was signed BEFORE that update — it's stateless and never auto-refreshes. `company.controller.ts`'s `create` and `invitation.controller.ts`'s `accept` now sign and return a **fresh token** alongside their normal response, but ONLY when the role-changing branch in the service actually ran (first company / first acceptance) — accepting into a second company, which never touches the RBAC role, correctly returns no `token` field at all.

**Tested by decoding both tokens directly:** the token issued at registration decoded to `role: "employee"`; the token returned from creating a company (same person, immediately after) decoded to `role: "admin"` — confirmed as two genuinely different, correctly-signed tokens, not the same one reused.

The frontend swaps this in immediately via a new `refreshToken` Redux action (updating both the stored JWT and the separate `user.role` field the sidebar actually reads), so the correct sidebar shows up right after creating a company or accepting an invitation — no logout/login round-trip required anymore.

### Invited employees couldn't see their own invitation

**Root cause:** email case-sensitivity. `createInvitation` never normalized the email before storing it, and `listMyPendingInvitations`'s matching query was a case-sensitive exact match. An Admin typing `New.Employee@Example.COM` while inviting someone, and that person registering as `new.employee@example.com` (the far more common way people actually type their own email), were silently treated as two different email addresses — the invitation existed in the database the whole time, just permanently invisible to the person it was for.

**Fixed** by normalizing every email to lowercase at the point it's written — `registerEmployee`, `loginEmployee`, and `createInvitation` all lowercase now — plus a defensive lowercase on the read side in `listMyPendingInvitations` too, so it's correct regardless of what called it.

**Tested with the exact mismatched-case scenario:** invited `New.Employee@Example.COM`, registered as `new.employee@example.com`, confirmed the invitation was found (`1 invitation(s) found`) where it previously would have returned zero.

## 28. A real architectural gap: `employees` was trying to be two things at once

Reported directly: "user is main for us" — one person can belong to many companies, one company has many people, and email must be unique at the PERSON level, not per company-membership. The backend didn't actually support this correctly. `employees` was doing double duty as both "the login identity" (email, password, name) AND "a specific company membership" (role, department, employee code) at the same time, which meant there was never really a clean way to represent "this one person, across all the companies they belong to."

### The fix: split `users` (identity) from `employees` (per-company membership)

- **`users`** — the real, global identity. One row per person, ever. Email is unique HERE. No companyId, no role, no department — this table knows nothing about companies at all.
- **`employees`** — one row per **(user, company) pair**. This is where role, department, designation, employee code, and bank details live, because all of those are genuinely specific to one person's relationship with one company. The old `employee_companies` join table is gone entirely — `employees` itself now IS the membership, not a profile that points at a separate join row.

This is a bigger, more correct model: the same person can now be Owner at one company and a plain Employee at another, with completely independent department/designation/bank details at each — properly, not through the two-different-role-fields hack from the previous milestone.

### A genuinely nice side effect: the "stale role until re-login" bug is now structurally impossible

Two milestones ago, a JWT carried a `role` claim that could go stale (Section 27). The real fix wasn't refreshing the token faster — it was realizing a token should never have carried a role at all, once role became something that only makes sense **per company**. The JWT now only ever contains `{ sub: userId, type: "user" }`. Role is resolved fresh from the database on every single request, scoped to whichever company that request is actually about (`requireCompanyRole` in `middleware/auth.ts`). There is no cached claim left to go stale, so the bug isn't patched — it's gone by construction.

### The rule from the brief, now actually enforced

"If we find the user is already registered, we just send a company invite" — `employee.service.ts`'s `createEmployee` now checks `users` by email before doing anything: if that email already has an account, this creates a real **invitation** instead of a second account (delegating straight into `invitation.service.ts`'s `createInvitation`); only for a genuinely new email does it create both a `users` row (with a fixed temporary password, `Test@123`) and an `employees` row directly, active immediately with no invitation step.

### Migration approach

Given the sheer size of this reshape (one new table, one table restructured with new required columns, one table dropped, a foreign key retargeted), and that the database was already being tested from a wiped, empty state, I reset the migration history entirely and generated one fresh migration from the final schema rather than layering incremental `ALTER`s on top of the old shape. `npm run db:migrate` now applies that single migration to a truly empty database.

### Two real bugs caught during this rewrite, not shipped blind

- **`replaceDocument`** still referenced the pre-rename field name after `documents.reviewerEmployeeId` became `reviewerVerifierId` two milestones ago — TypeScript's `--noEmit` check refused to compile it.
- **`document.controller.ts`'s `upload`/`replace` and `payroll.controller.ts`'s `generateRun`** were passing `req.user.sub` (a `userId`) into fields that expect an `employees.id` — a mistake TypeScript literally cannot catch, since both are just UUID strings. Caught by manually auditing every `req.user.sub` usage across every controller after the restructure, not by any automated check, and fixed to use `req.employee.id` (the caller's own row at the specific company being acted on, resolved by `requireCompanyRole`).

### Tested against a real, freshly-migrated, empty database

- Logged in as a seeded user with two companies → confirmed `owner` at one, `admin` at the other, on the SAME `employees.role` field, correctly independent
- Decoded the JWT directly → confirmed zero role claim, only `{ sub, type }`
- Added a brand-new employee (no existing account) → confirmed a `users` + `employees` row were created directly, with a working temporary password (`FreshPerson@123`) that could log in immediately
- Added an employee whose email **already had an account** → confirmed the response was `{ type: "invitation", ... }`, not a duplicate account, and confirmed via direct SQL that exactly one `users` row exists for that email, not two
- Accepted an invitation for someone already active at that same company → confirmed the existing `employees` row was reactivated/updated (via `onConflictDoUpdate`) rather than erroring
- Confirmed real per-request RBAC: the same person, at a company where they hold a lower role, was correctly blocked (`403`) from an action they're allowed to do at a DIFFERENT company where they hold a higher one
- Confirmed the Verification Portal (a completely separate identity system) was entirely unaffected by any of this

## 29. Known follow-up: the frontend needs a matching pass

This response covered the backend only — it's a large enough change on its own. The frontend currently reads `employee.companyId` in a few places (notably `LoginPage.jsx`'s post-login routing) to decide "does this person have exactly one company, so auto-select it." That field no longer exists on the response at all (`users` has no companyId — see above), so that specific check needs to switch to reading `accessibleCompanies.length` instead, which is arguably more correct anyway since it was always the real source of truth. This hasn't been done yet — flagging it explicitly rather than leaving it to be discovered as another confusing "why doesn't this work" bug report.
