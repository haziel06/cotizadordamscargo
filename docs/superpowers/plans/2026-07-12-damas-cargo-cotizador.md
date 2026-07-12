# Damas Cargo Cotizador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a private, role-based web application that lets Damas Cargo staff create, calculate, save, manage, and safely share import quotations to Guatemala.

**Architecture:** A TypeScript React application uses a pure calculation domain module, a protected API layer, and a D1-backed data model. The quote editor derives a versioned calculation snapshot on save; administrators maintain tariff inputs separately. A small public read-only route resolves only revocable, expiring share tokens.

**Tech Stack:** Vite + React + TypeScript, Cloudflare Workers/D1 via Sites, React Router, Zod, Vitest, Testing Library, Playwright-compatible browser verification, CSS modules/vanilla CSS.

---

## File structure

- `app/` — routes and page-level composition.
- `src/domain/` — calculation types, normalization, tariff resolution and pure tests.
- `src/server/` — Worker handlers, auth middleware and D1 repositories.
- `src/components/` — focused quote, administration and shared-view components.
- `migrations/` — D1 schema migrations and seed data.
- `tests/` — browser-facing and component tests.
- `.openai/hosting.json` — deployment, D1 binding and environment declarations.

### Task 1: Initialize the deployable application

**Files:**
- Create: application starter files created by the Sites initializer
- Create: `.openai/hosting.json`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Initialize the supported Sites starter in the workspace**

Run: `bash <sites-skill-root>/scripts/init-site.sh "$PWD"`

Expected: a TypeScript web application with package scripts and `.openai/hosting.json`.

- [ ] **Step 2: Start the development server and verify the starter loads**

Run: `npm run dev`

Expected: a local URL is reported and renders the starter screen.

- [ ] **Step 3: Replace starter metadata with Damas Cargo metadata**

Set title to `Damas Cargo | Cotizador de importaciones` and description to `Cotizaciones operativas de importación hacia Guatemala`.

- [ ] **Step 4: Build the untouched initialized app**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add . && git commit -m "chore: initialize Damas Cargo quotation app"`

### Task 2: Define the database and authentication boundary

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `src/server/db.ts`
- Create: `src/server/auth.ts`
- Create: `src/server/repositories/users.ts`
- Create: `src/server/repositories/quotes.ts`
- Create: `src/server/repositories/tariffs.ts`
- Test: `src/server/repositories/quotes.test.ts`
- Modify: `.openai/hosting.json`

- [ ] **Step 1: Write repository tests for role filtering and version snapshots**

Test that an advisor only receives its own quote rows, an administrator receives all rows, and a saved quote version preserves its resolved snapshot JSON.

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `npm test -- src/server/repositories/quotes.test.ts`

Expected: FAIL because repositories and tables do not exist.

- [ ] **Step 3: Add a D1 migration**

Create tables for `users`, `tariffs`, `surcharges`, `tax_rates`, `quotes`, `quote_versions`, `share_links`, and `audit_events`. Include creator IDs, role, timestamps, quote state, version number, expiry/revocation fields and snapshot JSON.

- [ ] **Step 4: Implement database, repositories and authorization middleware**

Use parameterized statements. Keep quote ownership enforcement in repository queries, not only the UI. Hash passwords, issue signed HTTP-only sessions, and make deactivated users unable to authenticate.

- [ ] **Step 5: Run the repository tests**

Run: `npm test -- src/server/repositories/quotes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add migrations src/server .openai/hosting.json && git commit -m "feat: add protected quotation data model"`

### Task 3: Implement the import calculation engine with TDD

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/money.ts`
- Create: `src/domain/incoterms.ts`
- Create: `src/domain/tariffs.ts`
- Create: `src/domain/calculateQuote.ts`
- Test: `src/domain/calculateQuote.test.ts`
- Test: `src/domain/tariffs.test.ts`

- [ ] **Step 1: Write failing calculation tests**

Cover: GTQ-to-USD conversion as `GTQ / GTQ_PER_USD`; FOB, CFR, CIF, EXW and DDP tax-base behavior; DAI on CIF; IVA on `CIF + DAI`; 2-decimal displayed rounding; air chargeable weight `max(actualKg, cbm * 167)` rounded up to the configured increment.

- [ ] **Step 2: Run domain tests to verify they fail**

Run: `npm test -- src/domain/calculateQuote.test.ts src/domain/tariffs.test.ts`

Expected: FAIL because the domain modules are absent.

- [ ] **Step 3: Implement exact types and pure calculation functions**

Expose `normalizeInvoiceValue`, `resolveTariff`, `calculateCharge`, `calculateTaxes`, and `calculateQuote`. Return line-level source labels (`tariff`, `rule`, `default`, `manual`) and warnings rather than throwing for missing tariff/SAC data.

- [ ] **Step 4: Add tariff precedence tests and implementation**

Test exact match, generic provider/type fallback, default fallback, priority tie-break and no-match blocking warning. Implement the resolver to return the selected rule and explanation.

- [ ] **Step 5: Run all domain tests**

Run: `npm test -- src/domain`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/domain && git commit -m "feat: calculate import quotation totals"`

### Task 4: Build the protected application shell and quote workflow

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/cotizaciones/page.tsx`
- Create: `app/cotizaciones/nueva/page.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/QuoteForm.tsx`
- Create: `src/components/QuoteBreakdown.tsx`
- Create: `src/components/QuoteSummary.tsx`
- Create: `src/components/Field.tsx`
- Create: `src/lib/quoteSchema.ts`
- Test: `tests/QuoteForm.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write failing component tests**

Test conditional fields: FCL shows container, consolidated sea shows CBM, air hides container and calculates chargeable weight. Test that changing an input recalculates the displayed total and missing SAC displays its validation warning.

- [ ] **Step 2: Run the component tests to verify they fail**

Run: `npm test -- tests/QuoteForm.test.tsx`

Expected: FAIL because the editor components do not exist.

- [ ] **Step 3: Implement validation and editor state**

Use Zod to validate required route fields, positive numeric inputs and allowed decimal precision. Keep draft calculation client-side using the domain module; submit a validated snapshot to the protected quote API.

- [ ] **Step 4: Implement the visual interface**

Build the logistics-editorial design: navy foundation, warm white work surface, amber action color, readable compact controls and a sticky result card. Show cost source and manual-adjustment reason on every edited line.

- [ ] **Step 5: Run component tests**

Run: `npm test -- tests/QuoteForm.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add app src/components src/lib tests app/globals.css && git commit -m "feat: add responsive quotation workspace"`

### Task 5: Add quote lifecycle, sharing and history

**Files:**
- Create: `app/cotizaciones/[id]/page.tsx`
- Create: `app/c/[token]/page.tsx`
- Create: `src/components/QuoteHistory.tsx`
- Create: `src/components/SharedQuote.tsx`
- Create: `src/server/routes/quotes.ts`
- Create: `src/server/routes/shares.ts`
- Test: `src/server/routes/shares.test.ts`
- Test: `tests/SharedQuote.test.tsx`

- [ ] **Step 1: Write failing share-route tests**

Test an active token returns only the published quote fields, an expired/revoked token returns 404, and no internal tariff or private note is serialized.

- [ ] **Step 2: Run share-route tests to verify they fail**

Run: `npm test -- src/server/routes/shares.test.ts tests/SharedQuote.test.tsx`

Expected: FAIL because share routes are absent.

- [ ] **Step 3: Implement lifecycle APIs and UI**

Create draft/finalize/version/share/revoke operations. Generate cryptographically random tokens; record expiry; render an accessible print-only client summary with the commercial disclaimer.

- [ ] **Step 4: Run share and history tests**

Run: `npm test -- src/server/routes/shares.test.ts tests/SharedQuote.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add app/c app/cotizaciones src/components src/server/routes tests && git commit -m "feat: share versioned client quotations"`

### Task 6: Build the administrator experience

**Files:**
- Create: `app/administracion/page.tsx`
- Create: `src/components/AdminTariffs.tsx`
- Create: `src/components/AdminTaxRates.tsx`
- Create: `src/components/AdminUsers.tsx`
- Create: `src/server/routes/admin.ts`
- Test: `tests/AdminTariffs.test.tsx`
- Test: `src/server/routes/admin.test.ts`

- [ ] **Step 1: Write failing authorization and tariff tests**

Test an advisor receives 403 from every admin endpoint, an administrator can create a dated tariff and an eight-digit SAC plus origin DAI rate, and updated tariffs leave existing quote snapshots untouched.

- [ ] **Step 2: Run the admin tests to verify they fail**

Run: `npm test -- tests/AdminTariffs.test.tsx src/server/routes/admin.test.ts`

Expected: FAIL because admin components and routes are absent.

- [ ] **Step 3: Implement the protected tariff and user management screens**

Provide forms for provider, route, service, condition, currency, rate, priority, effective dates, DAI rate, exchange rate, surcharge and user status. Validate SAC exactly eight digits and make audits visible to administrators.

- [ ] **Step 4: Run admin tests**

Run: `npm test -- tests/AdminTariffs.test.tsx src/server/routes/admin.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add app/administracion src/components src/server/routes tests && git commit -m "feat: manage quotation tariffs and users"`

### Task 7: Validate, deploy and hand off

**Files:**
- Create: `README.md`
- Modify: `app/layout.tsx`
- Create: `public/og.png`

- [ ] **Step 1: Write deployment configuration and administrator setup notes**

Document initial admin setup, production secrets, D1 migration command, backup/export procedure and the difference between estimates and official customs assessment.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Build the deployment artifact**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Run browser verification**

Verify login, a maritime FCL quote, an air quote, a manual adjustment, admin tariff creation, quote sharing and revoked-link behavior.

- [ ] **Step 5: Deploy using Sites**

Run the Sites hosting flow after build validation. Apply the D1 migration and configure the first administrator before sharing the private URL.

- [ ] **Step 6: Commit**

Run: `git add README.md app/layout.tsx public/og.png .openai && git commit -m "docs: prepare Damas Cargo quotation deployment"`

## Implementation amendments from plan review

### Concrete runtime and API contract

Use the Sites initializer's Vinext/Vite runtime and its file-system `app/` surface; do not add Next.js. Worker API handlers live at `app/api/<resource>/route.ts` and server helpers remain in `src/server/`. Update Tasks 2, 5 and 6 to create those route files, not framework-agnostic `src/server/routes` only. The routes are: `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/reset`, `GET /api/quotes`, `POST /api/quotes`, `GET|PATCH /api/quotes/:id`, `POST /api/quotes/:id/duplicate`, `POST /api/quotes/:id/finalize`, `POST /api/quotes/:id/share`, `POST /api/shares/:token/revoke`, plus `/api/admin/*`. Each state-changing route requires an authenticated session and same-origin/CSRF validation.

Extend Task 2 with failing route tests for login, logout, deactivated accounts, session expiry, CSRF rejection and advisor/admin access. Add initial credential bootstrap using `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD_HASH` Worker secrets, and store sessions in the `sessions` table. Test credentials are never returned in API responses.

### Authoritative calculations and quote behavior

Extend Task 3 and Task 5 with a `saveQuoteVersion` server service. It accepts quote inputs and manual overrides, reloads dated tariffs/taxes/exchange rates, executes the same pure domain calculator server-side, validates override reasons and transactionally stores the result. Client-supplied totals and snapshots are ignored. Add a failing test that submits a tampered total and proves the stored snapshot uses the server result.

Implement and test draft-save, own-quote edit, duplicate, list/history, sequential number, finalization, expiry and revocation transitions. Drafts may retain unresolved tariffs; finalization returns a validation error until all required tariffs are resolved. The server calculates quote validity from the selected tariff's effective/expiry dates. Advisors can only mutate their own records; administrators can mutate all records.

### Expanded calculation and validation coverage

Add separate failing tests before implementation for CFR/CPT, CIF/CIP, EXW/FCA and DAP/DDP normalization; DAP/DDP without a declared CIF breakdown must return tax-pending. Test dated GTQ-per-USD rates, dated SAC+origin DAI matching then global fallback, configurable IVA, every charge method, its minimum/condition/unit rounding and a configurable margin base. Test maritime, air and terrestrial required fields; 3-decimal kg and 4-decimal CBM limits; dimensions-to-CBM; configured air rounding increments; and blocking unresolved tariff finalization.

### Complete administration, sharing and deployment

Expand Task 6 with tested CRUD endpoints and forms for providers, routes/defaults, surcharges/rules, dated exchange rates, margin recommendations, effective dates, priorities and password-reset initiation. All admin writes create visible audit events. Administrators manage every user; advisors have no administrative endpoint access.

For Task 5, create/revoke links only from quote owner or admin, bind a link to a specific finalized version, preserve that published version after refinalization, add `X-Robots-Tag: noindex, nofollow` and equivalent page metadata, and test expiry/revocation/non-owner rejection.

For Task 7, replace the placeholder social image with a generated and inspected image only after metadata is wired; otherwise omit it. Add exact deployment tasks: create/apply the D1 migration, bind `DB`, set session signing and bootstrap-admin secrets, seed initial default rates, verify development and production config separation, and execute a backup/export smoke test. Replace every broad `git add .` in this plan with exact file paths listed in the respective task.

### Password-reset flow

Implement a concrete administrator-issued reset flow: `POST /api/admin/users/:id/reset` creates a cryptographically random, single-use reset token, stores only its hash with a 24-hour expiry in `password_reset_tokens`, invalidates prior unused tokens and returns the one-time reset URL to the administrator for secure delivery. `POST /api/auth/reset/complete` accepts the token plus a new password, atomically verifies expiry/unused state, updates the password hash, marks the token used and invalidates all active sessions. Add route tests for expired, reused and invalid tokens, successful password login after reset, and session invalidation. No password or token is persisted in audit-event details.
