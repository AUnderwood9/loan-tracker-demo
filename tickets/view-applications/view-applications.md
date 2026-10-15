# view-applications

| File | Holds |
|---|---|
| [view-applications.md](view-applications.md) | This index: decisions, sequence, acceptance criteria |
| [backend-contract.md](backend-contract.md) | Project scaffold, CSV repository (read + serialized write), checklist/status derivation, read queries, list sorting, pagination |
| [ui-contract.md](ui-contract.md) | Applications list page (sortable headers, pagination) and application detail (checklist) page |
| [research-notes.md](research-notes.md) | CSV profile, stakeholder brief, every answered question for all three MVP paths |

MVP sibling path that builds on this one: [update-document-status](../update-document-status/update-document-status.md). [add-application](../add-application/add-application.md) is deferred out of the MVP.

## Feature Request

> Use the files in the /doc folder to get context on the application we are trying to build. I believe the MVP features would be to view the applications and their status, then to add an application and it's status, and to update an application's status. It will use next js with a react front end and to start we can use a CSV as the data layer

- **Branch**: `main`
- **Captured**: 2026-10-13
- **Scope type**: feature (MVP path 1 of 2: view applications and their status; also carries the shared foundation)

## Business Impact

- **Current problem**: three operations staff track SBA document checklists in a shared spreadsheet and can't see which applications are still waiting on documents. Per the brief, "things fall through the cracks."
- **Desired outcome**: a browser page that lists every application with a computed status (Complete, or how many documents are outstanding), plus a per-application checklist of all 12 document types.
- **Value**: it answers the team's biggest pain point without changing the CSV, and it gives the add and update paths the data layer they write through.

## Root Cause / Problem Statement

This is a greenfield project. The repo holds only `README.md:1` (a title) and `docs/`, so no application code exists yet and nothing needs changing. The data source is `docs/NEWITY_Sample_Data_A_Document_Checklist.csv`: one row per application × document, 11 columns, 60 applications, 620 rows, and **no application-level status column** ([research-notes](research-notes.md#technical-context)). An application's status therefore has to be derived. It is **Complete** when each of the 12 known document types has a row whose status is Approved or Not Required. Otherwise it is **N outstanding**, where a missing type counts as outstanding. This affects all three users (two processors and a team lead) on two screens: the list and the detail page.

**Search patterns used**: `find . -type f -not -path './.git/*'` (3 files: README, CSV, docx); `find . -name CLAUDE.md` (none); CSV profiling by column (`cut`/`awk` over columns 1, 6, 7, 8), recorded in [Technical Context](research-notes.md#technical-context).

## Solution

**Change**: Scaffold a Next.js App Router project in TypeScript. Build a server-only CSV repository with a whole-file read, plus a serialized and atomic `mutateRows` for the sibling paths. Add a pure checklist-derivation function and two read queries. Add two server-rendered pages: `/` (list) and `/applications/[id]` (checklist).
**Effort**: 1–1.5 days (assumed, not data-backed), including scaffold, test-runner setup and seed script.
**Impact**: all 60 sample applications visible with a correct status. The sample currently has 0 complete applications and 60 with outstanding items (computed in [Technical Context](research-notes.md#technical-context)).
**Risk**: Low. The app only reads in this path, and the write helper is unit-tested here before any UI calls it.

### Why This Solution

The status is derived rather than stored, so it can never drift from the documents. The single CSV keeps its existing shape, so the team can still open it in a spreadsheet. The strongest objection is that a CSV with full-file rewrites is the wrong data layer: it has no transactions, and it means O(n) writes. That doesn't hold at this scale: about 75 applications × 12 rows ≈ 900 rows, three users, and one Node process ([Answered Questions](research-notes.md#answered-questions), Q4). An in-process lock with temp-file-plus-rename covers both concurrency and torn writes. The repository is the only module that touches the file, so swapping in a database later changes one module.

### Post-Deployment Plan

- Monitoring: none beyond server console errors. It's a local single-server MVP.
- Success metric: the team lead can name every incomplete application from the list page without opening the CSV.
- Follow-up work: see [Follow-Up Work](#follow-up-work).

## Impact Analysis

- **Key metric**: the list shows the correct outstanding count for every application. It is verified against the sample, where APP-2026-1001 has 9 rows, 2 of them Approved, so 10 are outstanding.
- **Performance** (assumed): parsing about 900 rows on each request is negligible, so there is no cache.
- **Risk / rollback**: read-only path. Rollback is removing the pages, and the CSV is never modified by this path.

## Implementation Steps

- [x] Scaffold Next.js (App Router, TypeScript) and Vitest; add `data/` to `.gitignore` and a seed script that copies the sample CSV into `data/applications.csv`
- [ ] Implement the domain constants and `readRows` (empty → `[]`, CSV errors → `CsvDataError`)
- [ ] Implement checklist derivation and the `listApplications` / `getApplication` queries
- [ ] Build the list page and the detail page with loading, empty, error and not-found states; set up Cypress
- [ ] Run the unit tests, Cypress specs, lint and type-check

## Sequence

1. [Tasks — backend](backend-contract.md#tasks--backend) Task 1 (scaffold) lands first; everything depends on it.
2. Backend Tasks 2–4 then run in order (Task 5 waits for update-document-status). [Tasks — UI](ui-contract.md#tasks--ui) can start against the query signatures once Task 4's contract is fixed, and must finish after it.
3. Sorting (added 2026-10-15): backend [Task 6](backend-contract.md#task-6-sortable-applications-list-query) first, then UI [Task 3](ui-contract.md#task-3-sortable-column-headers).
4. Pagination (added 2026-10-15): backend [Task 7](backend-contract.md#task-7-pagination) first, then UI [Task 4](ui-contract.md#task-4-pagination-controls).
5. [update-document-status](../update-document-status/update-document-status.md#sequence) starts after this folder's backend Task 5 (`mutateRows`, date helpers) and UI Task 2 (detail page) are done.

## Testing Summary

- Unit tests (Vitest) for the repository, the derivation and the queries run against temp-dir CSV fixtures. See [Test Cases — backend](backend-contract.md#test-cases--backend).
- Cypress specs drive the list and detail pages against a fixture CSV that is reset before each spec. See [Test Cases — UI](ui-contract.md#test-cases--ui).
- Key scenarios: a mixed-status application shows "N outstanding"; an all-satisfied application shows "Complete"; a missing type counts as outstanding and is labelled on the detail page; an unknown ID shows 404; amounts show two decimals; interleaved rows group into one list row per ID; a blank status shows Not Started; an empty CSV shows the empty message; a broken CSV shows the error page.

## Known Limitations

- No authentication. It assumes a trusted local network of three users.
- "Stalled" (time-based) is not computed. The status is outstanding count only.
- `Expired` is whatever the CSV says. Nothing recomputes it from `expiration_date`.
- A CSV error returns HTTP 200 with the error page, not a 500, because the page has already started streaming behind its loader (Q20).
- Sorting covers Application, Business and Applied only; Status sorting is dropped for now (Q24). There's no filtering.
- Pages render on each request; another user's change shows after a refresh, not live.

## Concerns & Questions

- **Addressed**: What "application status" means: derived, with Complete when all 12 types are Approved or Not Required (Q1, Q5).
- **Addressed**: Missing document types count as outstanding, and the CSV is never backfilled (Q6).
- **Addressed**: Runtime is a local single Node server, so CSV writes persist (Q4).
- **Addressed**: Shared foundation lives in this folder (Q9).
- **Addressed**: Loan amount display: `$10,000.00` style, decimals supported (Q12).
- **Addressed**: List grouped and ordered by application ID (Q13).
- **Addressed**: Checklist order is alphabetical by document type, because processing order is unknown (Q15).
- **Addressed**: A loader shows on every loading transition (Q16).
- **Addressed**: Sorting by Application, Business and Applied, server-side from URL params, with invalid and empty params falling back to the default, and ties by application ID ascending (Q23, Q25, Q26). Status sorting is dropped as ambiguous (Q24) → [Follow-Up Work](#follow-up-work) item 2.
- **Addressed**: Pagination: 10 per page via the `page` URL param; invalid or empty values → page 1; past the end → the last page; arrows plus "Page N of M"; a sort change resets to page 1 (Q27–Q31). Follow-Up item 7 is narrowed to its filter interaction.
- **Addressed**: Empty CSV shows "No open applications to display"; CSV errors show "An error has occurred" (Q19, which supersedes Q14). The status is 200, not 500 (Q20).
- **Addressed**: A blank status cell shows "Not Started"; a missing type shows "Not on checklist" (Q18).
- **Addressed**: The total application count and a per-application document count are shown on the list page (Q21).
- **Deferred to Follow-Up**: Adding a missing document type to an existing checklist goes to [Follow-Up Work](#follow-up-work) item 3.

## Follow-Up Work

1. Expiration tracking: derive "expiring soon / expired" from `expiration_date` and the 90-day / 3-year rules - Priority: High, Effort: 1–2 days
2. Outstanding and stalled filters on the list page, plus sorting by Status once its meaning is decided (Q24) - Priority: High, Effort: 0.5–1 day
3. Add a missing document type to an existing application's checklist - Priority: Med, Effort: 0.5 day
4. Weekly leadership pipeline summary (replaces the Monday email) - Priority: Med, Effort: 1–2 days
5. Email alerts for documents about to expire - Priority: Low, Effort: 2–3 days (needs a scheduler and SMTP)
6. Authentication for the three users - Priority: Low, Effort: 1 day
7. When filters (item 2) land, paginate the filtered list and reset to page 1 on a filter change - Priority: Low, Effort: 0.25 day
8. Add an application: deferred out of the MVP; the constraints, starting documents and ID scheme need re-analysis. Draft in [add-application](../add-application/add-application.md) - Priority: Med, Effort: 0.5–1 day once decided

## Acceptance Criteria

- [ ] Visiting `/` lists every application in the CSV across its pages (10 per page), one row each, showing application ID, business name, borrower name, loan amount, assigned processor, application date, documents and status.
- [ ] ⚠️ Above the table, the list page shows the total number of applications, e.g. "60 applications".
- [ ] ⚠️ The Documents column shows how many of the 12 document types the application has rows for, e.g. "9 of 12".
- [ ] Applications missing some document types are still listed.
- [ ] An application's status reads **Complete** when every one of the 12 document types has a row with status Approved or Not Required.
- [ ] Otherwise the status reads **N outstanding**, where N = 12 − (number of types with an Approved or Not Required row); a document type with no row counts as outstanding.
- [ ] Clicking an application opens `/applications/<id>`, showing the application's details and all 12 document types with status, date received, expiration date and notes.
- [ ] On the detail page, a document type with no row in the CSV is shown as "Not on checklist" and counted as outstanding.
- [ ] On the detail page, a document row whose status cell is blank is shown with status "Not Started" and counted as outstanding; the CSV cell stays blank.
- [ ] When the CSV has no application rows (header only, or a zero-byte file), the list page shows "No open applications to display" instead of a table.
- [ ] When the CSV can't be read (missing or unreadable file, a header that isn't the 11 expected columns, or a malformed row), the page shows "An error has occurred". No partial data and no technical detail is shown, and the cause is logged on the server.
- [ ] Visiting `/applications/<id>` for an ID not in the CSV shows a not-found page.
- [ ] Loan amounts display as US dollars with thousands separators and always two decimal places: `390000` → `$390,000.00`, `12500.5` → `$12,500.50`.
- [ ] The list shows one row per application ID (all of an application's document rows grouped into it), ordered by application ID ascending by default.
- [ ] The Application, Business and Applied column headers sort the list. Clicking a header sorts by that column ascending; clicking the active header again toggles between descending and ascending. The URL carries the sort (`/?sort=<application|business|applied>&dir=<asc|desc>`), so it survives a reload.
- [ ] Applied sorts by calendar date, not by the stored text (9/4/2025 comes before 1/11/2026 in ascending order).
- [ ] ⚠️ Business sorts alphabetically, ignoring case.
- [ ] Rows that tie on the sorted column are ordered by application ID ascending, in both directions.
- [ ] Every sortable header (Application, Business, Applied) always shows both ▲ and ▼, so it's clear which columns can be sorted (Q33). On the sorted column, the arrow for the current direction is dark and the other is greyed out; on unsorted columns both are greyed out. Non-sortable headers show no arrows.
- [ ] The total number of applications and the number of pages never change when the sort changes.
- [ ] An invalid, empty or missing `sort` or `dir` value shows the default order (Application ascending) and never shows an error. Each value falls back on its own: ⚠️ `/?sort=business&dir=up` sorts by Business ascending.
- [ ] Changing the sort shows the loader until the re-sorted list renders.
- [ ] The list shows 10 applications per page, in the current sort order. The page is carried in the URL (`/?page=2`, alongside `sort` and `dir`).
- [ ] Below the table, a Previous (‹) arrow, a "Page N of M" indicator and a Next (›) arrow move between pages. The arrows keep the current sort.
- [ ] The user can page forward to the last page, which shows the remaining applications (fewer than 10 when the total isn't a multiple of 10).
- [ ] Previous is disabled on page 1 and Next is disabled on the last page; a disabled arrow can't be clicked. ⚠️ When everything fits on one page, both arrows are disabled and "Page 1 of 1" shows.
- [ ] The user can never reach a page before 1: `page` values of 0, negatives, non-numbers, decimals, empty or missing all show page 1 and never an error.
- [ ] A `page` past the end shows the last page.
- [ ] Changing the sort returns to page 1.
- [ ] The total line always shows the number of all applications, not just the ones on the current page.
- [ ] Changing the page shows the loader until the new page renders.
- [ ] With no applications, no pagination controls are shown.
- [ ] Checklist rows on the detail page are ordered alphabetically by document type.
- [ ] Every loading transition shows a loader (a spinner with a text label) until the content renders: the first load of `/`, navigating from the list to a detail page, and navigating from a detail or not-found page back to the list. A route that Next.js restores instantly from a recent visit has no loading phase and needs no loader.
- [ ] Viewing pages never modifies the CSV file.

## Metadata

| Key | Value |
|---|---|
| Analysis date | 2026-10-13 |
| Feature | view-applications |
| Branch | main |
| Phase | `Solution` |
| Scope type | feature |
| Root cause | n/a (greenfield) |
| Estimated effort | 1–1.5 days (assumed) |
| Risk assessment | Low |
| Blocking questions | 0 |
| Blocker status | unblocked |
