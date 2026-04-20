# Project Report (Laytime Platform)

## Recent Work
- Contracts/CPs: added claim-level clause profile storage (`claims.clause_profile`) and charter-party clause profile (`charter_parties.clause_profile`), plus contract selection in the claim calculator to apply clause rules directly.
- Contracts/CPs UI: added `/claims/contracts` page, menu entry, and API `/api/contracts` to manage contract clause rules (working time, NOR offset, rounding, start-next-working, count rules, holiday windows).
- Claim calculator: removed Terms UI; statement view now shows clause rule badges, “Clause Rules Summary” badge, and a toggle between derived vs manual laytime start.
- Laytime summary helper: now reads clause profiles for working-time windows, count rules, holiday windows, and NOR-derived laytime start.
- Contracts/CPs schema alignment: switched to `charter_parties.name` (no `cp_number`) and removed `voyage_id` usage where not present in schema to resolve schema cache errors.
- Contracts/CPs schema reintroduced: added `cp_number` and `voyage_id` columns so contracts can be linked to voyages and show a dedicated CP reference again.
- Claims: fixed Create Claim default status to `created` to align with allowed statuses.
- SOF port call creation: claim references now use UUIDs; added best-effort rollback to avoid partial port call/claim/event writes on failure.
- Notifications: added `/api/notifications/unread` endpoint to support unread count.
- Notifications: Added `notifications` table and RLS policies (`022`, `023`, `024`, `026` ensures `claim_id` exists). API `/api/notifications` supports fetch, per-item mark-read, pagination, and claim deep links; bell shows unread count and claim links, refreshes after mark-all-read. QC assignment/status changes, comments, and attachments now notify reviewers; inserts fall back gracefully if schema cache is stale.
- QC/Comments: Claims store `qc_status`, `qc_reviewer_id`, `qc_notes`; reviewer dropdown loads tenant users; only assigned reviewer/super_admin can change QC fields; claim comments API/UI; attachments/comments trigger reviewer notifications.
- Claims calculator: Status/reviewer chips and filters on claims list; non-reversible events strictly scoped to claim port call with clearer warnings; reversible pooling fixes; once-on-demurrage badge and quick edit timings panel; per-port breakdown hidden for non-reversible claims.
- Dashboard: Claims-by-status, upcoming port calls, usage vs limits, My Queue + unread badge.
- Laytime foundations: Migration `025_laytime_foundations` adds cargo, charter parties, laytime profiles, laytime calculations, port activities/deductions, cargo-port laytime rows (with RLS); scaffolded `src/lib/laytime-engine` as a pure TS module (currently stubbed).
- Laytime APIs scaffolded: `/api/laytime-calculations` (list/create), `/api/laytime-calculations/[calcId]` (fetch calc + related data), `/api/laytime-calculations/[calcId]/recalculate` (engine stub call).
- SOF extractor hardening: moved SOF tab into a client component with summary/preview/timeline, added low-confidence filtering on `/api/sof-extract` (env `SOF_CONFIDENCE_FLOOR`), and surfaced warnings/bad rows counts in the UI. Parser now normalizes split months, captures ports from loading/discharge lines, vessel/IMO/terminal more strictly, backfills cargo quantity from best match, and attaches dates to end times.
- SOF parser recent tweaks: end-times now inherit dates (roll +24h if needed), low-confidence rows are kept (flagged) instead of dropped, and terminals are cleaned when they look noisy. Batch tool remains available for Super Admin under Data Management.
- OCR server doc refreshed: main.py/Dockerfile now include CORS, higher DPI OCR (250–300), Tesseract `--oem 1 --psm 6`, and notes on keeping low-confidence rows. Use `/api/sof-extract` proxy by default to avoid CORS, and ensure the Render OCR host is responsive.
- SOF parser resiliency: added dotted/ordinal date parsing (`22.01.2017`, `April 22nd 2024`), pre-scan to set a default date context when times lack dates, stricter header vs timeline separation (clean vessel/terminal/cargo, strip suffixes), and longer API/batch timeouts (10 minutes) to reduce aborted large scans. Batch7 shows clean timelines for structured PDFs; remaining gaps: FOXTROT needs better date anchoring; `SOF HT UNITE.pdf` and `MV Taihakusan - Signed SOF.pdf` previously aborted and should be re-run with the new timeouts and checked in OCR logs.
- SOF UX: SOF tab shows signed attachment links/preview, click to jump pages, inline edit/delete/manual add (with page), “Create port call from SOF” (auto-creates claim + saves events), and “Save to claim events.” Preview has “open in new tab.” Timeline scrolls to keep preview visible.
- SOF batch: Super Admin “SOF Batch” tab under Data Management to upload multiple PDFs, run through `/api/sof-extract` proxy (avoids CORS), show per-file status, and download JSONs.
- Attachments signing: `/api/claims/[claimId]/attachments` now signs storage URLs (using `SUPABASE_SERVICE_ROLE_KEY`) and returns `signed_url` for reliable PDF embedding.
- OCR service sample: provided an updated FastAPI extractor that returns per-line bounding boxes, page/line, confidence, and boxes array for overlay; still basic date/time parsing.
- Optional local OCR fallback: when `NEXT_PUBLIC_ENABLE_LOCAL_OCR=true`, the frontend can extract text locally via pdf.js (and, if `NEXT_PUBLIC_ENABLE_TESSERACT_RASTER=true`, fall back to a lightweight tesseract.js raster pass) before/after calling `/api/sof-extract`. Uses existing pdf.js assets at `public/pdfjs-dist/build/*`.
- SOF highlights: Implemented client-side pdf.js renderer with aligned bbox overlays (when pdf.js loads); falls back to iframe if pdf.js fails. Local pdf.js assets expected at `public/pdfjs-dist/build/pdf.min.js` and `pdf.worker.min.js`.
- SOF mapping/admin: Added Super Admin mapper page with DB-backed canonical events, edit/delete/import/export, unmapped labels capture/export, and seeded canonical enum list in migrations `027/028`. Timeline events show original SOF text with mapped tags.
- Laytime workspace: Timeline selection now uses two-click start/end with mapped-event picker and comment; manual spans create single additions/deductions and feed totals (used/over-under/despatch/demurrage). Events with start/end are split into start/end rows for precise anchoring.
- Attachments panel moved to sit directly below Claim Details; Add Event form now above the SOF timeline and defaults to 100% rate (percent is chosen in the selection modal instead).
- OCR service (AWS deployment current status):
  - Service: FastAPI + PaddleOCR with optional Textract backend (`USE_TEXTRACT=true`, `TEXTRACT_REGION=eu-north-1`).
  - Image: `516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest`.
  - Task definition: `ocr:9` with taskRole `arn:aws:iam::516466084656:role/ocr-textract-task-role` (Textract) and executionRole `arn:aws:iam::516466084656:role/ocr-task-exec` (ECR/Logs).
  - Network: VPC `vpc-0b90354817269a8ec`; tasks in subnets `subnet-0a297c25f1fe3e612`, `subnet-0779f8b1e02bc908d` (NAT-routed). NAT Gateway `nat-08d5e72e712696dad`. SG `sg-0923c68c0c42bb5fb` (8000 allowed within SG; 443 allowed within SG; outbound open). Health check `/health` on port 8000.
  - Endpoints: ECR API `vpce-0634ae40ff196c0f8`, ECR DKR `vpce-0a2e45d16453f79ef` (private DNS enabled), S3 gateway `vpce-0a2df70a94b949172` on RTs `rtb-088c8cb2e34570203`, `rtb-08e67093a29ddb456`.
  - Logging: Log group `/ecs/ocr` (retention 14d). CloudWatch Logs access via NAT.
  - Status: `/health` returning 200; tasks stable after network/role/endpoint fixes.
- Parser fixes (latest): date+time found on the same line now populate from/to directly and set date context; date-only lines seed the context; tabular date+time then description on next line still merges. Header card now has an Edit dialog to tweak port/terminal/vessel/IMO/cargo/laycan before applying.
- Laytime summary helper: factored shared `buildStatementSnapshot` into `src/lib/laytime-summary.ts` and calculation page now consumes it (same logic, reusable for tests and future statement renders). If there are zero events/additions/deductions, Used time now defaults to the full laytime window; additions still correctly extend used time (no clamping when they exceed deductions). Laytime span now uses a “naive” date diff (ignores timezone offsets) to match the user-entered start/end values exactly. Auto deductions from events are currently disabled; only manual deductions/additions affect used time.
- SOF mapping: expanded canonical keywords (pilot station arrival variants, richer cargo ops start/stop/resume) to improve matches on noisy PDFs.
- Tests: Added Vitest setup (`npm test`) with unit coverage for SOF parser/header + canonical mapping, and laytime summary math helper. (Note: `npm install` may be required to fetch vitest when network is available.)
- OCR service (latest): Switched to PyMuPDF per-page rendering (no bulk pdf2image), lightweight preprocessing, per-page Tesseract with dense retry, auto-rotation, and a hard time-budgeted loop that returns partial results with warnings instead of timing out. `PyMuPDF` added to requirements; env tunables include `SOF_OCR_DPI`, `SOF_MAX_SECONDS`, `SOF_MAX_PDF_PAGES` (0=all pages).
- OCR service (Tailwinds/Santos): Still timing out at 295s on Render in current deployment. Needs redeploy with the per-page pipeline and tuning of `SOF_OCR_DPI`/`SOF_MAX_SECONDS`, plus profile of per-page OCR costs to avoid request-level timeouts while keeping all pages.
- OCR service (PaddleOCR): Migrated extractor to PaddleOCR (CPU) with grayscale PyMuPDF renders and downscale safeguards. Requirements pinned to `paddleocr 2.7.0 / paddlepaddle 2.6.2`, `numpy 1.23.5`, `opencv-python-headless 4.8.0.74`, `PyMuPDF 1.20.2`. Dockerfile uses python:3.10-slim with poppler, swig/build-essential, libgomp/libgl deps. Env tunables unchanged; Tesseract configs kept as no-ops for backward compat. Current AWS test endpoint: `http://51.20.12.235:8000/extract`.
- SOF parser (latest): Full month-name date parsing, backscan for date context for time-only lines, and UTC-suffixed timestamps to prevent client-side timezone shifts. Vessel fallback improved (MV/uppercase, filename) when headers are blank.
- SOF parser pending: add stronger filtering to drop header/footer noise (lines without valid time/date or with junk times), keep timeline-like rows, and reject impossible timestamps seen in Tailwinds output (e.g., `T78:06`).

## Migrations
- `029_claim_clause_profile.sql`: Adds `claims.clause_profile` and `claims.cp_id` (contract link).
- `030_charter_party_clause_profile.sql`: Adds `charter_parties.clause_profile` to store contract clause rules.
- `031_charter_party_cp_number_voyage_id.sql`: Adds `charter_parties.cp_number` and `charter_parties.voyage_id` with index.
- `020_qc_and_comments.sql`: QC fields, `claim_comments`.
- `021_claim_status_extension.sql`: Expanded claim_status values.
- `022_notifications.sql`: Notifications table (user_id, tenant_id, claim_id, title/body/level/read_at).
- `023_notifications_policies.sql`: Enable RLS and select/update/insert policies.
- `024_notifications_policy_update.sql`: Broaden insert policy to authenticated/service_role.
- `026_notifications_claim_id.sql`: Ensures `claim_id` column exists on notifications.

## Open/Next Steps
- Add status/reviewer chips and filters to voyage/port-call summaries (partial in lists, extend to more screens).
- Laytime foundations: introduce cargo, charter_party, laytime_profile, laytime_calculation, port_activity, port_deduction, cargo_port_laytime_row tables with RLS.
- Laytime engine module (pure TS): derive laytime start, compute allowed/used, reversible/proration/cargo-match, once-on-demurrage.
- API: `/api/laytime-calculations`, `/recalculate`, `/statement`; HTML/JSON statement for PDF.
- Workspace UI: panels for port calls, SOF events, deductions/additions, cargo laytime grid, summary with Recalculate/Statement; validation gates (estimate-only, missing L/D, reversible/proration checks).
- Tests: unit tests for engine scenarios (single-port, reversible, proration, weather/holiday, once-on-demurrage); integration tests for create/recalc/statement; snapshots for statements.

## Stack (current/target)
- Frontend: Next.js (App Router), TypeScript, Tailwind, shadcn/Radix; notification bell integrated.
- Backend: Next.js API routes with Supabase/Postgres; RLS enforced; service-role for system tasks.
- Engine: planned pure TypeScript module in `src/lib/laytime-engine` (deterministic, testable).
- Testing: Vitest/Jest for unit; Playwright/Supertest for API; snapshots for statements.
