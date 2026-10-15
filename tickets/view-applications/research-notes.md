# research-notes

Evidence record for the loan-tracker MVP. It is shared by [view-applications](view-applications.md), [add-application](../add-application/add-application.md) and [update-document-status](../update-document-status/update-document-status.md).

## Acceptance Criteria

Converted to the index checklist: [Acceptance Criteria](view-applications.md#acceptance-criteria).

## Requirements Evolution

- **"Application status" became derived, not stored.** The request asks to "add an application and its status" and "update an application's status". The CSV has no such column; its only status is per document. The user decided (Q1, Q5) that an application is Complete when all 12 document types are Approved or Not Required. "Update an application's status" therefore means updating a document's status, so the third path is named `update-document-status`.
- **Update scope grew slightly.** Q3 added `date_received` and `notes` to the editable fields, beyond status. Without the date, documents marked Received would have no received date, which the v2 expiration feature needs.
- **One folder per user path** (Q8). The original single MVP became three folders, with the shared foundation in this one (Q9).
- **Adding an application cut from MVP** (2026-10-13). The user deprioritized it because constraints, starting documents and similar decisions need more thought. The MVP is now viewing applications and updating the documents that already exist. Q2 and Q7 are reopened; the [add-application](../add-application/add-application.md) folder is kept as a deferred draft (Q11).
- **Future features added by the user** (2026-10-13): pagination on the list view, and adding a document to an existing application. Both are in [Follow-Up Work](view-applications.md#follow-up-work) (items 7 and 3).
- **Sorting added to view-applications** (2026-10-15). The user's words: "Let's go ahead and add sorting. Our backend listing query will need to support sorting for the following columns: Application, Business, Applied, and Status so that the viewer would be able to get overviews and groups of applications faster. Create the following tests first: 1. We can sort by the columns provided in asc order. 2. We can sort by the columns provided in desc order. 3. The total number of applications do not change based on the sort order applied." Status was then dropped as ambiguous (Q24), and invalid and empty param tests were added (Q25). This takes the sorting half of Follow-Up item 2.
- **Pagination added to view-applications** (2026-10-15). The user's words: "Let's add pagination now. We will just do 10 per page. We must test that we can paginate to the end of the list and we can't paginate before page 1. The Arrows for pagination must also be disabled when you cant go back anymore or go forward anymore. Pagination can be url params as well. They must be tested for valid values and for empty values as well. Write the tests first and the agents are done when they are all passing green." Invalid values were added to the tests (Q28). This replaces Follow-Up item 7.
- **Both sort arrows shown** (2026-10-15). The user's words: "Next, the ability to paginate isn't clear to the user, we need to display both arrows, however if sorting isn't applied grey it out. The other arrow that doesn't have pagination should have their's greyed out as well." It was clarified as the sort arrows (Q33). This replaces the earlier rule that only the active column shows a single arrow, and revises the indicator checks in S1, S2, S4 and S5.
- **Cut from MVP** (from the brief's wish list): expiration tracking, email alerts and the leadership dashboard. See [Follow-Up Work](view-applications.md#follow-up-work).

## Technical Context

**Repo state** (checked 2026-10-13): branch `main`, one commit `fb11b16 Initial commit`. Files: `README.md`, `docs/NEWITY_Sample_Data_A_Document_Checklist.csv`, `docs/sba application tracker.docx`; `docs/` is untracked. No `package.json` and no project `CLAUDE.md`.

**Stakeholder brief** (`docs/sba application tracker.docx`, condensed):

| Topic | Answer from the team |
|---|---|
| Active applications | About 50–75 at any time |
| Biggest pain point | Not knowing which applications are stalled waiting on documents |
| Expirations that matter | Tax returns (3 years), bank statements (90 days) |
| Users | Two loan processors and one team lead |
| Leadership wants | A weekly pipeline summary, currently a manual Monday email |
| Technical skill | None. "If it's harder than the spreadsheet, they won't use it." |
| Integrations | None. Standalone, no APIs, no existing DB |
| Tech preference | None. It must run in a browser; Next.js + React + Node with a CSV is chosen |

**CSV profile** (`docs/NEWITY_Sample_Data_A_Document_Checklist.csv`):

- Header (11 columns, in order): `application_id, business_name, borrower_name, loan_amount, application_date, assigned_processor, document_type, document_status, date_received, expiration_date, notes`
- 621 lines = 1 header + 620 rows; every line has exactly 11 fields; no quoted fields; LF line endings.
- 60 applications (`APP-2026-1001` … `APP-2026-1060`). The 6 application header columns repeat identically on every row of an application. No application has conflicting header values (checked by `cut -d, -f1-6 | sort -u` and looking for duplicate IDs).
- Rows per application: 8 (6 apps), 9 (15), 10 (9), 11 (13), 12 (17). So 43 apps have fewer than 12 rows.
- No duplicate (application_id, document_type) pairs.
- Dates are `M/D/YYYY` with no zero padding (e.g. `12/1/2025`); `date_received`, `expiration_date` and `notes` are often blank.
- `loan_amount` is whole dollars in the sample (e.g. `390000`), but decimals are possible and must display (Q12).

| document_status | Rows |
|---|---|
| Pending | 183 |
| Received | 160 |
| Approved | 121 |
| Under Review | 93 |
| Expired | 37 |
| Not Required | 26 |

| document_type (12 distinct) | Rows |
|---|---|
| Articles of Incorporation | 50 |
| Bank Statements (90 day) | 49 |
| Business Financial Statements | 52 |
| Business Licenses & Permits | 57 |
| Business Tax Returns (3yr) | 55 |
| Debt Schedule | 50 |
| Insurance Verification | 50 |
| Lease Agreement | 53 |
| Ownership Verification | 48 |
| Personal Tax Returns (3yr) | 54 |
| SBA Form 1919 | 54 |
| SBA Form 912 | 48 |

| assigned_processor | Rows |
|---|---|
| Ricardo Fuentes | 253 |
| Aisha Patel | 186 |
| Janet Morrison | 181 |

**Status rule against the sample**: 0 applications have all 12 types Approved; 0 have every existing row Approved or Not Required; 18 have at least one Not Required row. Under the decided rule, all 60 sample applications show as outstanding.

**Architecture considerations**

- Runtime is a single long-lived Node process (`next start`) on a local machine (Q4). It has a writable disk, so module-level state (the write lock) is shared across requests. This would **not** hold on serverless.
- User-entered text (business names, notes) can contain commas, quotes and newlines. The sample has none, so a real CSV parser/serializer is required; splitting on commas would corrupt the file on the first such entry.
- The sample file in `docs/` is the seed and is never written. The live file is `data/applications.csv` (gitignored), so UI edits don't dirty the repo.

**Deployed-state checks**: none. Nothing is deployed.

## Answered Questions

| # | Question | Answer | Answered by | Date |
|---|---|---|---|---|
| Q1 | What is an application's "status", given the CSV only has document status? | If all 12 document types are known, go by all of them being approved; otherwise defer to a future feature. The 12 types are known (12 distinct values in the CSV), so the rule applies. | the user (types confirmed by the CSV) | 2026-10-13 |
| Q2 | Which document rows does a new application get? | All 12 types, status Pending | the user | 2026-10-13 |
| Q3 | What can a user change when updating a document? | Status, date received and notes | the user | 2026-10-13 |
| Q4 | Where does the MVP run? | Local / single Node server | the user | 2026-10-13 |
| Q5 | Does Not Required count as satisfied for completeness? | Yes | the user | 2026-10-13 |
| Q6 | How are missing document types (43 apps have fewer than 12 rows) handled? | Count as outstanding; never backfill the CSV | the user | 2026-10-13 |
| Q7 | How is a new application_id assigned? | Auto-generate `APP-<year>-<max+1>` | the user | 2026-10-13 |
| Q8 | Feature folder naming | One folder per distinct user path | the user | 2026-10-13 |
| Q9 | Where does the shared foundation live? | In view-applications | the user | 2026-10-13 |
| Q10 | Folder names | `view-applications`, `add-application`, `update-document-status` | the user | 2026-10-13 |
| Q11 | With add-application deferred, what happens to its folder? | Keep as-is with a deferred notice | the user | 2026-10-13 |
| Q12 | How do loan amounts display? | Everyday dollars with separators, always two decimals (`$10,000.00`); decimals are possible | the user | 2026-10-14 |
| Q13 | How is the list ordered? | Grouped by application ID and ordered by it | the user | 2026-10-14 |
| Q14 | Must V1 handle a missing, malformed or other CSV? | No. V1 assumes only the supplied CSV; keep the cases on record for later versions | the user | 2026-10-14 |
| Q15 | Checklist document order? | Alphabetical by document type; processing order is unknown | the user | 2026-10-14 |
| Q16 | Loading feedback? | Show a loader on every loading transition | the user | 2026-10-14 |
| Q17 | Test 5 ("an application with no documents is returned"): what does it mean, given a zero-document application has no rows? | Applications missing some types are still returned, with the missing types shown as Not on checklist | the user | 2026-10-14 |
| Q18 | Test 6 ("documents without status → Not Started"): which documents? | Both, labelled separately: a blank status cell → "Not Started"; a missing type → "Not on checklist" | the user | 2026-10-14 |
| Q19 | Test 7: reverse Q14? | Yes, with two cases: an empty CSV shows "No open applications to display"; CSV errors show "An error has occurred" with HTTP 500 (the status is revised by Q20) | the user | 2026-10-14 |
| Q20 | A real 500 is impossible once the page streams behind its loader (Next.js 16 `streaming.md`, "The HTTP contract"). Which wins? | Keep the loader; the error page is served with 200 | the user | 2026-10-14 |
| Q21 | Are the total and per-application document counts shown? | Both shown on the list page | the user | 2026-10-14 |
| Q22 | What are the UI agent's done-criteria? | The same seven test cases as the backend, written first and failing, then implemented until they pass | the user | 2026-10-14 |
| Q23 | Where is sorting analyzed? | Extend view-applications (not a new folder) | the user | 2026-10-15 |
| Q24 | What does sorting by Status mean? | Ambiguous; Status sorting is dropped for now | the user | 2026-10-15 |
| Q25 | Where does the sort live? | URL params, sorted server-side; tests must cover invalid and empty `sort`/`dir` values | the user | 2026-10-15 |
| Q26 | How are ties ordered? | Always by application ID ascending | the user | 2026-10-15 |
| Q27 | Pagination size and state | 10 per page; the page lives in URL params; tests cover valid and empty values | the user | 2026-10-15 |
| Q28 | Are invalid page values tested too? | Yes; anything that isn't a whole number ≥ 1 renders page 1 | the user | 2026-10-15 |
| Q29 | Page past the end? | Show the last page | the user | 2026-10-15 |
| Q30 | Controls besides the arrows? | A "Page N of M" indicator between Previous and Next | the user | 2026-10-15 |
| Q31 | Page after a sort change? | Back to page 1 | the user | 2026-10-15 |
| Q32 | Revise the 13 Cypress specs that assumed all 60 rows on `/` (acceptance test 2, S1–S5, and seven wait-only specs)? | Approved, as proposed in Corrections | the user | 2026-10-15 |
| Q33 | Which arrows does "display both arrows, grey out if sorting isn't applied" mean? | The sort arrows in the headers: every sortable header shows ▲▼; the sorted column's current direction is dark, everything else greyed out | the user | 2026-10-15 |

## Corrections

- **2026-10-14 — data-file error handling cut from V1** (Q14). The first analysis had `readRows` fail with `DataFileMissing` when the file was absent and `DataFileInvalid` when the header wasn't the 11 expected columns. Both surfaced as a named error page, and a header-only file showed "No applications yet". Kept here for the later version ([Follow-Up Work](view-applications.md#follow-up-work) item 9). V1 assumes the supplied CSV and has none of these.
- **2026-10-14 — loan amount display** (Q12). The first analysis assumed whole dollars with no cents (`$390,000`). Corrected to two decimals (`$390,000.00`), with decimal values parsed rather than truncated.
- **2026-10-14 — data-file handling reinstated** (Q19). The cut above was reversed the same day. A header-only or zero-byte CSV shows "No open applications to display" (replacing "No applications yet"). A missing file, a bad header or a malformed row throws `CsvDataError` and shows "An error has occurred". The error page is served with HTTP 200, not 500, because the page streams behind its loader (Q20).
- **2026-10-14 — malformed-row line number is approximate** (backend-contract Unit 1, Operations step 6; found while implementing Task 3). The contract says `CsvDataError` names "the first bad row's line number". Papaparse reports only a 0-based data-row index, not a file line, so `readRows` logs index + 2. That is exact when every record is on one line and there are no blank lines, which holds for the sample. If an earlier record has a quoted newline, or the parser skipped a blank line, the reported line is too low. The message goes to the server log only, so nothing user-facing changes. Getting exact lines would mean tracking offsets ourselves; not done (YAGNI). Implemented at `src/lib/applications/csv-repository.ts:17`.
- **2026-10-14 — the list → detail loader needs the route's prefetch to have landed** (ui-contract State Machines, detail Loading; acceptance criterion "Every loading transition shows a loader"; found while implementing UI Task 2). The contract says Loading is entered on "any navigation to `/applications/[id]`". In practice `loading.tsx` ships inside the route's prefetched App Shell. Next fetches it about 100 ms after a row link enters the viewport, and one shell serves every `/applications/<id>` link. If the user clicks before that prefetch lands, Next keeps the list on screen with no loader until the server responds (documented in `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:232`, "Slow networks"). On the local network this window is well under a second after page load, so the Cypress loader tests wait for the shell prefetch before clicking (`cypress/e2e/view-applications.cy.ts`, `aliasShellPrefetch`). If the gap matters, the documented remedy is a `useLinkStatus` pending hint on the row link. Not built: it is a new UI decision and wasn't in the contract.
- **2026-10-14 — error boundary uses `retry()`, not `reset()`** (ui-contract State Machines, list `RETRY` event). The contract says "re-render via `reset()`". In Next 16.3+ `reset()` re-renders the boundary's children without re-fetching, so it wouldn't re-read a fixed CSV (per the docs; not tried). `retry()` re-fetches the segment, and the Cypress spec shows it recovering (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`, "retry"). Implemented at `src/app/error.tsx`.
- **2026-10-14 — the Failed state also logs React error #419 in the browser console** (Q20 consequence). A `CsvDataError` thrown inside the streamed Suspense boundary makes React report recoverable error 419 ("switched to client rendering") before `error.tsx` renders. Users see only "An error has occurred". The two Failed-state Cypress specs tolerate exactly that error code; any other uncaught error still fails them.
- **2026-10-15 — the case-insensitive Business test fixture couldn't fail** (backend-contract Test Cases, compareApplications, first bullet; found while implementing Task 6). The contract's fixture is `apex Co` vs `Acme Inc` → `Acme Inc` first. Plain code-point comparison gives the same order, because `A` (65) sorts before `a` (97), so the test would pass against a case-sensitive comparator. The implemented test uses `Apex Co` vs `acme Inc` → `acme Inc` first. That order holds only when case is ignored. The test is stronger than written, not weaker. See `src/lib/applications/sort.test.ts`, "compares business names ignoring case".
- **2026-10-15 — SortableColumnHeader is not a client component; only its pending loader is** (ui-contract Component Decomposition, SortableColumnHeader row; found while implementing UI Task 3). The contract marks SortableColumnHeader `"use client"`. `useLinkStatus` only works in a component rendered *inside* the `Link`, so the hook has to live in a child component anyway. That child is `src/components/SortPendingLoader.tsx` (`"use client"`), and it renders the Loader only while the link is pending. `src/components/SortableColumnHeader.tsx` renders the `<th>`, `Link`, indicator and `aria-sort`, and it needs no client code. Behaviour matches the contract: Cypress shows the pending Loader inside the clicked header while the delayed RSC response is outstanding. The prefetched App Shell doesn't skip it, even though the `useLinkStatus` docs say a prefetched route skips the pending state.
- **2026-10-15 — pagination contradicts the earlier "all 60 rows on `/`" tests** (ui-contract Test Cases — UI: acceptance test 2, sorting S1–S5, and the Further UI tests that wait for 60 rows; found while implementing UI Task 4). P5 requires `/` to show "Page 1 of 6" with 10 rows. Acceptance test 2 still requires "exactly 60 table rows". S1–S3 require 60 rows and the *last* ID of the full sort order on the same page. S4 and S5 require 60 rows. The pagination analysis (Q27–Q31) added P1–P6 but did not revise these tests, and the criterion "Visiting `/` lists every application in the CSV, one row each" now reads as "across pages". With Task 4 implemented, 13 of the 28 existing Cypress specs fail, all with the same assertion (`Found '10', expected '60'`). These are the user-specified acceptance tests 2 and S1–S5. The others are "shows Loading applications… while a sort is pending", "keeps the sort after a reload", "recovers from the error when Try again is clicked after the CSV is fixed", "shows Application not found for an unknown ID and links back to the list", both Loader specs, and "leaves the CSV byte-identical after viewing both pages". Those seven use 60 rows only as a "table has rendered" wait. None were edited, because acceptance tests may not be loosened without a decision. Proposed revision, which needs the user's sign-off: test 2 checks 10 rows on page 1 and "60 applications", and counts all 60 IDs across `?page=1..6`. S1/S2 check the first IDs on page 1 and the last IDs on `?sort=…&dir=…&page=6`. S3/S4/S5 and the seven wait-only specs expect 10 rows (`PAGE_SIZE`) in place of 60.
  - **Resolved 2026-10-15** (Q32): the user approved the revision. The ui-contract tables (acceptance test 2, S1–S5), the Applications list Populated state, the Further UI tests note and the index criteria now reflect it. The analysis error was in the pagination contract, not the implementation: it added P1–P6 without revisiting tests that assumed one page.
