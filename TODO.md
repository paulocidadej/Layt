# Project TODO

This file tracks the development progress of the Laytime Platform. It is designed to be detailed and comprehensible for any team member, including AI agents, to understand the project's status.

## Phase 1: Core Functionality and UI

### Completed Tasks

- [x] **Initial Setup and Configuration:**
  - [x] Initialized Next.js project with TypeScript.
  - [x] Integrated Supabase for database and authentication.
  - [x] Set up NextAuth.js for session management.
  - [x] Configured Tailwind CSS for styling.

- [x] **User Interface and Layout:**
  - [x] Implemented a modern, maritime-inspired UI/UX.
  - [x] Created a responsive sidebar for navigation.
  - [x] Designed a dashboard with KPI cards and widgets.
  - [x] Addressed and fixed Tailwind CSS build errors.

- [x] **Data Management and Multi-Tenancy:**
  - [x] **KYC Status Dropdown:**
    - [x] Replaced the free text input for KYC status in the `PartyDialog` with a dropdown menu.
    - [x] Defined a predefined list of statuses ('Pending', 'Verified', 'Rejected') to ensure data consistency.
  - [x] **Super Admin Voyage Creation:**
    - [x] Enabled `super_admin` users to select a tenant when creating a new voyage.
    - [x] Implemented a tenant selection dropdown in the `CreateVoyageDialog`.
    - [x] Updated the `/api/voyages` API to handle voyage creation for the selected tenant.
  - [x] **"Visible for All" for Lookup Data:**
    - [x] Added an `is_public` boolean flag to all lookup tables (`parties`, `vessels`, `ports`, `cargo_names`, `charter_parties`).
    - [x] Allowed `super_admin` to create lookup data visible to all tenants via a checkbox in all data dialogs.
    - [x] Updated RLS policies to allow all users to read records where `is_public` is true.
  - [x] **Tenant Creation Dialog UI:**
    - [x] Increased the width of the `CreateTenantDialog` for a better user experience.

- [x] **Bug Fixes and Migrations:**
  - [x] **Fixed Tenant Dropdown in Voyage Creation:**
    - [x] Added a `GET` handler to the `/api/admin/tenants` API route to fetch all tenants.
    - [x] Ensured the tenant selection dropdown in `CreateVoyageDialog` is populated with data.
  - [x] **Database Migrations:**
    - [x] Created and applied a database migration to add the `is_public` column and update RLS policies.
    - [x] Resolved migration errors related to permissions and function existence.
    - [x] Created roles for `customer_admin` and `operator` and granted them to the `authenticator` role.
  - [x] **Fixed Missing Checkbox Component:**
    - [x] Created the `src/components/ui/checkbox.tsx` file.
    - [x] Installed the missing `@radix-ui/react-checkbox` dependency.
  - [x] **Fixed `400 Bad Request` on Data Creation:**
    - [x] Corrected the `table` name in the payload in `CargoDialog.tsx` and `CharterPartyDialog.tsx`.
- [x] **Fixed Authentication and Data Fetching:**
  - [x] Reverted to `CredentialsProvider` and implemented a secure way to generate Supabase JWTs.
  - [x] Simplified the data fetching logic in the Data Management page to rely on RLS policies.
- [x] **Fixed Lookup “tenants/tenantName column” errors for public data:**
  - [x] Stopped sending UI-only `tenantName` to Supabase from lookup dialogs and trimmed required name fields to prevent null/invalid inserts.
  - [x] Updated lookup fetching to avoid `tenants(name)` joins and attach tenant labels client-side.
- [x] **Lookup Read Access for Operators:**
  - [x] Allowed all authenticated roles (including operators) to fetch lookup data/terms via `/api/lookup` while keeping write restrictions, so term dropdowns render in claim flows.
- [x] **Claim Events API Stability:**
  - [x] Simplified claim fetch in `/api/claims/[id]/events` to avoid schema-cache column errors that returned 404s for existing claims.
  - [x] Reduced the select to `*` so existing claims are always found even if related columns change.
  - [x] API now returns tenant/public terms alongside claim/events so the calculator dropdown always has options without extra fetches.
  - [x] Calculator API now also fetches voyage cargo quantity/name for the claim so allowed time calculations work.
  - [x] Claim events API always returns full voyage port calls (even when the claim is tied to one) so reversible pooling can sum per-port allowances.
- [x] **Claim Creation UX:**
  - [x] Restructured the Create Claim dialog into clearer sections (voyage/metadata, ops/location, rates, timings) with better spacing and scrolling.
  - [x] Added port type-ahead dropdown with inline request-to-admin action; ports load when the dialog opens.
  - [x] Added term type-ahead dropdown with inline “request term” action.
- [ ] **Billing & Plans**
  - [x] Added billing schema (plans, tenant_plans, invoices) with enums for cycles/status.
  - [x] Super admin plans CRUD API and UI page to create/list plans.
  - [x] Invoices API and page to list/mark paid; dashboard metrics for due/paid.
  - [x] Super admin dashboard with core metrics (tenants, users, voyages, claims, invoice totals).
  - [x] Added max_claims_per_month to plans and surfaced in Plans UI.
  - [x] Brought back dedicated dashboard at /admin/dashboard (modern gradient cards) and kept tenants list on /admin only.
  - [x] Login now routes super_admin to /admin/dashboard after sign-in.
  - [x] Navigation cleanup: dashboard link points to /admin/dashboard; Tenants moved to /admin/tenants; removed duplicate dashboard link.
  - [x] Hid the base "/" dashboard link for super_admin to avoid duplicate sidebar dashboards.
  - [x] Tenant plan assignment UI (link plan to tenant, seats/limits) with API upsert.
  - [x] Basic feature gating: enforce plan voyage limit on voyage create; enforce claim and monthly claim limits on claim create.
  - [x] Automated invoice generation endpoint for active tenant plans (current month, idempotent).
  - [x] Seat limits enforced on user creation (admins/operators) based on tenant plan.
  - [x] Fixed tenant plan upsert conflict handling and made plans editable via UI.
  - [x] Feature gating in UI: Data Management tabs disabled per plan flags; messaging when not included.
  - [x] Tenant page shows usage vs limits (admins, operators, voyages, claims, claims/month).
  - [x] Users page shows seat usage and blocks inviting roles when seats are full.
  - [ ] Scheduled/cron trigger for invoice generation.
- [ ] **Claims Enhancements**
  - [x] Added claim attachments (NOR/SOF) upload/list/delete with storage.
  - [x] Added SOF event audit trail (insert/update/delete logged and shown on calculator).
  - [ ] PDF export of laytime statement.
- [x] SOF events now editable/deletable.
- [x] Time format toggle (DD.HH.MM.SS vs decimal days) in calculator.
- [x] Allowed-time preview in claim creation based on voyage cargo and rate.
- [x] Reversible scope applied in calculations: events tag port_call, totals filtered by scope; allowed time sums scope-matching per-port `allowed_hours` or falls back to cargo/rate.
- [x] Added scope-aware per-port breakdown cards in the calculator (allowed/used/over-under) alongside pooled totals.
- [x] Calculator pools totals using sibling claims in the same voyage (reversible scopes) and shows “claim not created yet” for missing ports.
- [x] Reversible pooling selection persists per claim, syncs across pooled claims, and can be set during claim creation with scoped voyage claims.
- [x] Build hardened for restricted environments by removing external Google Fonts dependency (local sans stack).
- [x] Added QC scaffolding: claim stores `qc_status`/`qc_reviewer_id`/`qc_notes` with UI to edit; claim-level comments API + UI for messaging. Migration 020 adds QC columns and `claim_comments`.
- [x] Notifications: tables/policies (022/023/024), API `/api/notifications`, notification bell with per-item mark-read and claim deep links; QC assignments/status changes and comments notify the reviewer.
- [x] Claims UX: status/reviewer chips and filters on claims list; voyage/port-call views show chips; dashboard “My Queue” + unread badge; per-port breakdown hidden for non-reversible claims.
- [x] Attachments trigger notifications to assigned reviewer.
- [x] Fix Create Claim default status to "created" (avoid invalid status).
- [x] SOF port-call creation: UUID claim reference + rollback safety on failure.
- [x] Notifications: add unread count endpoint.
- [x] Notifications hardening: ensured `claim_id` column (migration 026); insert fallbacks if schema cache misses; bell shows claim links and refreshes after mark-all-read.
- [x] Claims calculator: non-reversible events scoped to claim port call with warnings; once-on-demurrage badge; quick edit timings panel; reversible per-port breakdown only shows pooled ports.
- [x] Laytime foundations scaffolding: migration 025 for cargo/charter_party/laytime_profile/laytime_calculation/port_activity/port_deductions/cargo_port_laytime_rows with RLS; added `src/lib/laytime-engine` stub for pure TS calculation module.
- [x] Laytime API scaffold: `/api/laytime-calculations` (list/create), `/api/laytime-calculations/[calcId]` (fetch calc + related), `/api/laytime-calculations/[calcId]/recalculate` (engine stub call).
- [x] Contracts/CPs: clause profiles stored on charter parties; claim calculator selects Contract/CP to apply clause rules (SHEX/SHINC, NOR offset, rounding, count rules, holidays).
- [x] Laytime sandbox status: `/laytime` + `/laytime/[id]` and related APIs are gated by `NEXT_PUBLIC_ENABLE_LAYTIME_TEST`. When off (default), sandbox UI/APIs stay hidden and do not affect live claims; when on, you can create/recalc sandbox calcs without touching live data.
- [x] Improve non-reversible per-port balances and expose per-port breakdowns when pooling is off.
- [x] Refine reversible pooling math when laytime span is missing (ensure pooled allowed minus pooled deductions logic matches charter terms).
- [x] Voyage detail/port-call pages restyled with richer port-call claims summary and upcoming legs timeline-style layout.
- [x] Claims, voyages, dashboard aligned to new palette; claim calculator themed to match.
- [x] Claim creation dialog validates required operation/port; voyage create/edit enforce vessel and tenant (super_admin).
- [x] Admin and customer-admin pages rethemed to light palette; tenants/users tables restyled for readability.
- [x] Port-call timeline component with icons/status badges added to voyage and port-call pages.
- [x] Dashboard includes claims-by-status and upcoming port-call widgets.
- [x] Claim create form sections regrouped with helper text and validation hints; cargo quantity > 0 enforced on voyage create/edit.
- [x] SOF extractor tab split into summary/preview/timeline; low-confidence rows filtered server-side via `SOF_CONFIDENCE_FLOOR`, warnings surfaced in UI; added banner for skipped rows.
- [x] SOF editing UX: timeline scrollable, inline edit of event name/from/to/rate, delete, manual add with page; click row jumps preview page; preview offers open-in-new-tab and add-from-preview form.
- [x] Signed URLs for attachments: `/api/claims/[claimId]/attachments` signs storage URLs (when `SUPABASE_SERVICE_ROLE_KEY` is set) and surfaces `signed_url` to the SOF preview/links for reliable embedding.
- [x] Sidebar hover-collapse: main nav now icon-only and expands on hover for more workspace.
- [x] Sample OCR service (FastAPI) now returns per-line bounding boxes, page/line, confidence, and boxes array for future PDF overlays.
- [x] pdf.js viewer: client-side pdf.js renderer added for SOF preview with bbox overlays; falls back to iframe when pdf.js is not available. Local assets expected in `public/pdfjs-dist/build/pdf.min.js` and `pdf.worker.min.js`.
- [x] SOF extractor/parser hardening: dotted/ordinal date parsing (`22.01.2017`, `April 22nd 2024`), default date context pre-scan for timelines, cleaner header vs timeline separation (vessel/terminal/cargo), vessel suffix cleanup, and 10-minute API/batch timeouts to reduce aborted large scans. Batch7 shows clean timelines for structured PDFs; a few scans (e.g., HT UNITE, Taihakusan) still need OCR/log review.
- [ ] Planned: deepen QC workflow (multi-step approvals, audit stamps), external/third-party sharing & validation, versioning/diffs, SOF parser + master SOF data, contract-driven auto-calc, AI assist, GDPR/retention/audit enhancements.
- [ ] **Voyage Enhancements**
  - [x] Added port_calls table and API (ETA/ETD, activity, status, sequence).
  - [x] Port Calls dialog to manage legs per voyage.
  - [x] Port call summary shown in voyages list; button to create claim preselects voyage/port call.
  - [x] Voyage detail page with port call timeline and per-port-call claims + create links.
  - [x] Port calls expose `allowed_hours` to drive reversible pooling; claim events carry `port_call_id`.
  - [ ] Reversible scope usage across ports in calculations (richer per-port breakdowns, validation).
  - [ ] Multi-port legs with ETA/ETD and status tracking (polish).
- [ ] **Data Management Enhancements**
  - [ ] Holidays/terms library (reusable calendars).
  - [ ] Bulk import and dedupe tools for lookups.
- [ ] **UX Enhancements**
  - [ ] Live allowed-time preview + validation improvements on claim create.

### To Be Done

- [ ] **Refine UI/UX:**
  - [ ] Continuously improve the user interface and user experience based on feedback.
  - [ ] Review and enhance the responsiveness of all components.

- [ ] **Build out remaining screens:**
- [ ] **Claims Screen:**
  - [x] Add claim calculation workspace with SOF event timeline and manual event capture.
  - [x] Implement claims listing with real data and calculator links.
  - [x] Create a dialog for creating new claims (now captures operation type, port/country, laycan/NOR/load/laytime timestamps, reversible flag, rate units/fixed duration, demurrage/despatch inputs, and term selection).
  - [ ] Improve claim creation layout/readability (long form still cramped for users).
  - [x] Add in-page claim details editing on the calculator page (apply new claim fields).
  - [x] Show derived summaries on calculator page: allowed time vs used vs overage, demurrage/despatch result with color cues.
  - [x] Replaced terms selection in calculator with Contract/CP selection and clause profiles.
- [ ] **Calculation UI:**
  - [x] Initial calculator for per-claim events with time-used computation and demurrage/despatch estimates.
  - [ ] Expand with clause-based engine and audit trail.
  - [x] Apply new claim fields (rates, laycan, reversible, terms) into calculation logic and summary.
  - [ ] **Admin Panels:**
    - [ ] Enhance the `super_admin` dashboard with more features.
    - [ ] Implement user management for `customer_admin`.

- [ ] **Restore Custom Styles:**
  - [ ] Gradually restore custom styles that were removed to fix build errors.
  - [ ] Isolate and fix any remaining Tailwind CSS issues.

- [ ] **Add Automated Tests:**
  - [ ] Implement unit tests for critical components and utility functions.
  - [ ] Add integration tests for key user flows, such as voyage creation and claim submission.

- [ ] **API Hardening:**
  - [ ] Add session checks to all protected API routes.
  - [ ] Implement robust error handling and logging.

- [ ] **Voyages Enhancements:**
  - [x] Add voyage editing (UI dialog + PUT API) and delete action.
  - [ ] Improve voyage creation/editing UX and validations.
  - [x] Add operator request-new option in voyage selectors (vessels, cargo, parties, charter parties) posting to requests API.
  - [x] Convert voyage selectors to single type-ahead fields with inline dropdown suggestions and bottom “Request” action when no match.
  - [ ] Fix relationship field handling in edit form (avoid non-column payloads) and add cp_date if needed.

- [ ] **Data Management - Terms:**
  - [x] Add UI tab to manage terms (name, window start/end, notes, tenant/public).
  - [ ] Hook term selection into claim creation/edit flows (calculator page).
  - [x] Add holiday flag (include_holidays) and day dropdowns; full holiday listing deferred.
  - [x] Fix missing DialogDescription import in Term dialog.

- [ ] **Data Management - Terms:**
  - [ ] Add UI tab to manage terms (name, window start/end, notes, tenant/public).
  - [ ] Hook term selection into claim creation/edit flows (calculator page).

- [ ] **Migrations & Policies:**
  - [x] Added migration 008 to extend claims with laytime/demurrage fields and terms with window/public flag; updated terms read policy for public visibility.
  - [x] Added migration 009 for requests table with RLS/policies.

### New SOF Extractor Follow-ups
- [ ] Persist extracted SOF header + timeline per claim (schema + API) and allow reapply/edit.
- [ ] Add toggle to show filtered-out low-confidence rows in UI.
- [ ] Map extracted header fields into claim/port-call (port/vessel/cargo/laycan) with user confirm.
- [ ] Add per-row accept/reject + manual edit before saving to events.
- [ ] Save to DB: add “Save to claim events” action to upsert the edited/manual list into `calculation_events`.
- [ ] PDF overlays: use OCR-provided bounding boxes to highlight extracted text and click-to-add directly from the preview.
- [ ] pdf.js stability: ensure local pdf.js UMD build is present and loading; remove iframe fallback once confirmed.

### High Priority Bug Fixes (New)

- [x] **Fix 1 — Super Admin voyages visibility**
  - [ ] Update voyages listing UI (`src/app/voyages/page.tsx`) to allow `super_admin` to view all voyages and optionally filter by tenant.
  - [ ] Update server logic to fetch all voyages for `super_admin` (no tenant_id filter), and add a tenant selector to filter.
  - [ ] Add tests to verify `super_admin` sees all voyages and other roles only see tenant-specific voyages.

- [x] **Fix 2 — Super Admin Create Voyage lookups**
  - [ ] Modify `CreateVoyageDialog` to fetch lookups for the selected tenant when `super_admin` is creating a voyage for another tenant (instead of relying on `lookups` passed in on the page).
  - [ ] Ensure server-side `createServerClient()` is used to fetch tenant-scoped lookups and public lookups.

- [x] **Fix 3 — `is_public` visibility & Tenant assignment**
  - [ ] Update all data dialogs (Party/Vessel/Port/Cargo/CharterParty) so that when `is_public=true`, the `tenant_id` field is omitted or set to null.
  - [ ] Update list views to show both `tenant` and `is_public` indicator columns so it's clear which records are tenant-specific vs public.
  - [ ] Add server-side validation in `/api/lookup` to enforce `tenant_id = null` for public records and prevent tenant scoping for public items.

- [x] **Fix 4 — Admins not seeing tenant & public records**
  - [ ] Ensure RLS policies inspect the correct `tenantId` claim from tokens by making it a top-level claim in the Supabase JWT.
  - [ ] Add a server-side session check or helper function to detect tenant context for non-super_admin users and return the combined dataset (tenant-specific + public).

- [x] **Fix 5 — Operators not seeing public data when creating voyages**
  - [ ] Verify operator sessions include `tenantId` claim in their Supabase JWT and can read public items subject to RLS policies.
  - [ ] Add tests to confirm operator-level reads return tenant-specific items and `is_public` items.

- [ ] **Migration & Data Cleanup**
  - [ ] Add a migration script to set `tenant_id` to NULL for lookup records where `is_public = true`, to standardize public items.
  - [ ] Confirm with a DB backup and add small script to run at maintenance window.
