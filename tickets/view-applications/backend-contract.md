# backend-contract

Server-side units for [view-applications](view-applications.md). All are new modules: the repo has only the scaffold. Unit 2 (`mutateRows`) is the shared writer for [update-document-status](../update-document-status/backend-contract.md#contract). It is specified here but built in its own later task, since viewing never writes.

**Domain constants** (one module, imported everywhere; values from [Technical Context](research-notes.md#technical-context)):

| Constant | Value |
|---|---|
| CSV columns | the 11 header names, in file order |
| Document types | the 12 distinct `document_type` values, alphabetical |
| Document statuses | Pending, Received, Under Review, Approved, Expired, Not Required |
| Satisfied statuses | Approved, Not Required |
| Not Started label | `Not Started`: the display status for a document row whose `document_status` cell is blank (Q18) |
| Not on checklist label | `Not on checklist`: the display status for a document type the application has no row for (Q18) |

Neither label is a stored status. Neither is ever written to the CSV, and neither counts as satisfied.

**Data file location**: `DATA_CSV_PATH` env var, defaulting to `data/applications.csv` relative to the project root. Tests point it at temp-dir fixtures.

## Contract

### Unit 1: CSV repository — readRows

#### Pre-conditions

1. Runs server-side only (the module is marked `server-only`).

A missing file, a bad header and malformed rows are not pre-conditions: they are defined failures (see Output).

#### Input

1. **Signature**: `readRows(): Promise<DocumentRow[]>`
2. **Input fields**: none. The file path comes from config.

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| (file contents) | text | no | data CSV | parsed rows |

3. **Identity / context**: `DATA_CSV_PATH` env var (optional).

`DocumentRow` has one string field per CSV column, camel-cased (`applicationId`, `businessName`, `borrowerName`, `loanAmount`, `applicationDate`, `assignedProcessor`, `documentType`, `documentStatus`, `dateReceived`, `expirationDate`, `notes`). Blank cells are empty strings. Values stay exactly as stored, including dates in `M/D/YYYY` and a blank `documentStatus`. The Not Started label is applied in Unit 3, never here, so the raw value is what a writer would see.

#### Operations

Validate → Parse. No external calls or persistence.

1. Resolve the data path from config.
2. Read the whole file as UTF-8 on every call, never at module scope. Under `cacheComponents`, a module-scope read is treated as build-time data and would serve a stale CSV. Any read failure (missing file, permissions) → throw `CsvDataError` (net-new), with the underlying cause attached.
3. If the content is empty or whitespace only (a zero-byte file), return `[]`.
4. Parse with papaparse in header mode, skipping empty lines. Quoted fields with commas, quotes and newlines must parse.
5. If the parsed header is not exactly the 11 expected columns in order → throw `CsvDataError`, naming the expected and actual headers.
6. If papaparse reports any row error (for example, a row with too few or too many fields) → throw `CsvDataError`, naming the first bad row's line number.
7. Return the rows in file order. A header-only file returns `[]`.
8. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: rows are returned and the file is untouched.
2. **On failure**: `CsvDataError` is thrown and nothing is written.
3. **Downstream consequence**: every page reads through this unit. `[]` drives the list page's empty state ("No open applications to display"). `CsvDataError` reaches the route error boundary ("An error has occurred"). Detail messages go to the server log only and are never shown to users.

#### Output

1. **Success**: an array of `DocumentRow`; `[]` for a zero-byte or header-only file.
2. **Failures** (thrown; the error boundary renders "An error has occurred"). The HTTP status stays 200, because the page has already started streaming behind its loader (Q20):

| Trigger | Error | Message (server log) |
|---|---|---|
| File missing or unreadable | `CsvDataError` | "Cannot read data file at <path>" + cause |
| Header not the 11 expected columns | `CsvDataError` | "Unexpected CSV header. Expected: …; found: …" |
| A row papaparse rejects (wrong field count, unterminated quote) | `CsvDataError` | "Malformed CSV row at line <n>" |

### Unit 2: CSV repository — mutateRows

Shared writer. Viewing never calls it; update-document-status does. Built in [Task 5](#task-5-shared-writer-and-date-helpers-for-update-document-status), not in the view run.

#### Pre-conditions

1. Same as Unit 1 pre-conditions.
2. A single Node process owns the file (Q4 in [Answered Questions](research-notes.md#answered-questions)).

#### Input

1. **Signature**: `mutateRows<T>(mutator: (rows: DocumentRow[]) => { rows: DocumentRow[]; result: T }): Promise<T>`
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| mutator | function | no | calling server action | its returned rows are written to the CSV; its `result` goes back to the caller |

3. **Identity / context**: none.

#### Operations

Validate → Persist, inside a lock.

1. Wait for the module-level write lock: a promise chain, so calls run strictly one at a time (net-new, no library).
2. Read the current rows **inside the lock** via Unit 1, so every mutation sees the previous one's writes.
3. Call the mutator with those rows. If it throws, release the lock and rethrow; nothing is written.
4. Serialize the returned rows with the same 11-column header, quoting fields only where needed. Use the CSV library's serializer; never join strings by hand.
5. Write to a temp file in the same directory, then rename it over the data file. On POSIX the rename is atomic, so readers see the old file or the new one, never a partial write.
6. Release the lock and return `result`.
7. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: the data file holds exactly the returned rows, each field round-trips byte-for-byte (commas, quotes and newlines included), and no temp file remains.
2. **On failure**: if the mutator throws or validation fails, the file is unchanged. If the write fails, the temp file is removed and the original is intact. The lock is always released, so later calls still run.
3. **Downstream consequence**: update-document-status relies on this for atomic, serialized writes. Two saves at the same moment both land, in order.

#### Output

1. **Success**: the mutator's `result`.
2. **Failures**: errors from Unit 1 and from the mutator are rethrown unchanged. A filesystem write error is rethrown after the temp file is cleaned up.

### Unit 3: Checklist derivation — buildChecklist

#### Pre-conditions

1. The input rows belong to one application. The caller groups them.

#### Input

1. **Signature**: `buildChecklist(rows: DocumentRow[]): { items: ChecklistItem[]; documentCount: number; outstandingCount: number; isComplete: boolean }`
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| rows | DocumentRow[] | no (may be empty) | Unit 1, grouped by `applicationId` | checklist items and counts |

`ChecklistItem` = `{ documentType, status, row: DocumentRow | null, isSatisfied }`, where `status` is the display status (see Operations step 2).

3. **Identity / context**: none. A pure function.

#### Operations

No I/O.

1. For each of the 12 document types, in constant (alphabetical) order, find the row with that `documentType` (unique per application; see [Technical Context](research-notes.md#technical-context)).
2. `status` =
   - the Not on checklist label, if there is no row;
   - else the Not Started label, if the row's `documentStatus` is blank (after trimming);
   - else the stored `documentStatus`, unchanged.
3. `isSatisfied` = `status` is in Satisfied statuses. Not Started, Not on checklist and unknown values are not satisfied.
4. `documentCount` = the number of the 12 types that have a row (e.g. 9 for APP-2026-1001).
5. `outstandingCount` = 12 − the number of satisfied items. `isComplete` = `outstandingCount` is 0.
6. Rows whose `documentType` is not one of the 12 are ignored for every count (ASSUMED — the sample has none).
7. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: always exactly 12 items; the input rows are not mutated (the Not Started label lives only on the item).
2. **On failure**: none. It is total over any input.
3. **Downstream consequence**: the list page's status and Documents columns and the detail page's checklist all come from this. It is the single definition of "Complete" and of the two placeholder labels.

#### Output

1. **Success**: see I/O Samples.
2. **Failures**: none.

### Unit 4: Read queries — listApplications, getApplication

#### Pre-conditions

1. Unit 1 pre-conditions.

#### Input

1. **Signatures**: `listApplications(sort?: ApplicationSort): Promise<ApplicationSummary[]>` (default: the default sort from [Unit 5](#unit-5-sort-parsing-and-ordering--parseapplicationsort-compareapplications)) and `getApplication(applicationId: string): Promise<ApplicationDetail | null>`
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| applicationId | string | no | route param `[id]` | row filter |

3. **Identity / context**: none.

`ApplicationSummary` = `{ applicationId, businessName, borrowerName, loanAmount (number), applicationDate (as stored), assignedProcessor, documentCount, outstandingCount, isComplete }`. `ApplicationDetail` = the summary fields + `items: ChecklistItem[]`. The total application count is `listApplications().length`; no separate query (YAGNI).

#### Operations

1. Read all rows via Unit 1.
2. Group them by `applicationId`.
3. Take the header fields from the group's first row; parse `loanAmount` to a number, keeping any decimals (e.g. `12500.5` → 12500.5).
4. Derive the counts and items via Unit 3.
5. `listApplications` returns one summary per `applicationId`, ordered by `compareApplications(sort)` ([Unit 5](#unit-5-sort-parsing-and-ordering--parseapplicationsort-compareapplications)). With no `sort`, that is Application ID ascending, unchanged from before. Sorting reorders only; it never adds, drops or changes a summary. Every application with at least one row is returned, however many of the 12 types it is missing. `getApplication` returns `null` when no row has that ID.
6. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: the data is returned and the file is not modified.
2. **On failure**: `CsvDataError` from Unit 1 propagates unchanged.
3. **Downstream consequence**: the list page and detail page render these results directly. `[]` drives the empty state, `null` from `getApplication` drives the not-found page, and a thrown `CsvDataError` drives the error page.

#### Output

See I/O Samples. Failures are Unit 1's.

### Unit 5: Sort parsing and ordering — parseApplicationSort, compareApplications

Added 2026-10-15 for list sorting (Q23–Q26). Sort columns are Application, Business and Applied. Status sorting is dropped for now (Q24).

#### Pre-conditions

1. None. Both functions are pure, with no I/O, so the module is **not** `server-only`: the list page's header links import its enums to build URLs.

#### Input

1. **Signatures**:
   - `parseApplicationSort(params: { sort?: string | string[]; dir?: string | string[] }): ApplicationSort`
   - `compareApplications(sort: ApplicationSort): (a: ApplicationSummary, b: ApplicationSummary) => number`
   - `ApplicationSort` = `{ column: SortColumn; direction: SortDirection }`
   - `SortColumn` enum: `application`, `business`, `applied` (these are the URL values)
   - `SortDirection` enum: `asc`, `desc`
   - Default sort: `{ column: application, direction: asc }`
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| sort | string, string[] or missing | yes | `/` page `searchParams.sort` | `ApplicationSort.column` |
| dir | string, string[] or missing | yes | `/` page `searchParams.dir` | `ApplicationSort.direction` |

3. **Identity / context**: none.

#### Operations

No I/O.

1. `column` = `sort` if it is a single string exactly matching a `SortColumn` value; otherwise (missing, empty, unknown, wrong case, or repeated as an array) the default column, `application` (Q25).
2. `direction` = `dir` if it is a single string exactly matching a `SortDirection` value; otherwise the default, `asc`. Each param falls back **independently**, so `?sort=business&dir=sideways` → Business ascending (ASSUMED — confirm with user).
3. The comparator's primary key, by column:
   - `application`: `applicationId`, plain string comparison (fixed-width IDs);
   - `business`: `businessName`, case-insensitive, via `localeCompare` with locale `en-US` and sensitivity `base` (ASSUMED — confirm with user);
   - `applied`: `applicationDate` parsed from `M/D/YYYY` to a calendar date and compared chronologically. **Never compare the stored text**, because text order puts `1/11/2026` before `9/4/2025`.
4. `desc` negates the primary comparison only.
5. Ties on the primary key are always broken by `applicationId` **ascending**, whatever the direction (Q26).
6. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: a total, deterministic order; the same input always gives the same sequence.
2. **On failure**: none. Invalid params never throw.
3. **Downstream consequence**: the list page's row order and the header sort indicators come from the parsed `ApplicationSort`.

#### Output

1. **Success**: see I/O Samples.
2. **Failures**: none. Every invalid input maps to a default.

### Unit 6: Pagination — parsePageParam, paginate

Added 2026-10-15 for list pagination (Q27–Q31). The page size is 10.

#### Pre-conditions

1. None. Both functions are pure, with no I/O, so the module is **not** `server-only`: the pagination controls import its types.
2. The input list is already sorted ([Unit 5](#unit-5-sort-parsing-and-ordering--parseapplicationsort-compareapplications)). Pagination slices the sorted list; it never re-sorts.

#### Input

1. **Signatures**:
   - `PAGE_SIZE` = 10
   - `parsePageParam(page?: string | string[]): number`
   - `paginate<T>(items: readonly T[], requestedPage: number): Page<T>`
   - `Page<T>` = `{ items: T[]; page: number; totalPages: number; totalCount: number; hasPrevious: boolean; hasNext: boolean }`
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| page | string, string[] or missing | yes | `/` page `searchParams.page` | `requestedPage` |
| items | ApplicationSummary[] | no (may be empty) | `listApplications(sort)` | `Page.items` (one slice) |

3. **Identity / context**: none.

#### Operations

No I/O.

1. `parsePageParam`: return the value if it is a single string of digits with no leading zero and a value of 1 or more (`2`, `15`). Anything else returns 1 (Q28): missing, empty, `0`, `-1`, `abc`, `2.5`, ` 2`, `02` (ASSUMED — leading zeros rejected), or an array.
2. `paginate`:
   1. `totalCount` = the number of items. `totalPages` = max(1, ceil(totalCount / PAGE_SIZE)), so an empty list is page 1 of 1.
   2. `page` = min(`requestedPage`, `totalPages`). A page past the end clamps to the last page (Q29). `requestedPage` is always ≥ 1 because it comes from `parsePageParam`.
   3. `items` = the slice from (page − 1) × 10, taking up to 10.
   4. `hasPrevious` = page > 1; `hasNext` = page < totalPages.
3. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: the slices partition the list. Going from page 1 to `totalPages` returns every item exactly once, in order. `totalCount` never depends on the page or the sort.
2. **On failure**: none. Invalid input never throws.
3. **Downstream consequence**: the list page renders `items`, the "Page N of M" indicator, and enables or disables the arrows from `hasPrevious` and `hasNext`.

#### Output

1. **Success**: see I/O Samples.
2. **Failures**: none.

## I/O Samples

**Unit 3 / Unit 4**: `getApplication("APP-2026-1001")` against the sample (9 rows; Approved: Ownership Verification and Business Tax Returns (3yr)):

```json
{
  "applicationId": "APP-2026-1001",
  "businessName": "Metro Dental Group",
  "borrowerName": "Elena Williams",
  "loanAmount": 390000,
  "applicationDate": "12/1/2025",
  "assignedProcessor": "Aisha Patel",
  "documentCount": 9,
  "outstandingCount": 10,
  "isComplete": false,
  "items": [
    { "documentType": "Articles of Incorporation", "status": "Received", "isSatisfied": false,
      "row": { "documentStatus": "Received", "dateReceived": "12/29/2025", "expirationDate": "", "notes": "", "...": "..." } },
    { "documentType": "Debt Schedule", "status": "Not on checklist", "isSatisfied": false, "row": null },
    { "documentType": "Ownership Verification", "status": "Approved", "isSatisfied": true,
      "row": { "documentStatus": "Approved", "dateReceived": "1/20/2026", "...": "..." } }
  ]
}
```

(`items` is truncated here; the real array always has 12 entries, in alphabetical order; three types are `row: null` for this application.)

**Blank status**: a row `APP-2026-1001,…,Lease Agreement,,,,` produces the item `{ "documentType": "Lease Agreement", "status": "Not Started", "isSatisfied": false, "row": { "documentStatus": "", "...": "..." } }`.

**listApplications** against the sample: 60 summaries, from `APP-2026-1001` to `APP-2026-1060`.

**Unit 5 — parsing**:

| `searchParams` | `ApplicationSort` |
|---|---|
| `{}` (no query) | application, asc |
| `{ sort: "", dir: "" }` | application, asc |
| `{ sort: "applied", dir: "desc" }` | applied, desc |
| `{ sort: "status", dir: "desc" }` | application, desc |
| `{ sort: "Business", dir: "asc" }` | application, asc (case-sensitive match) |
| `{ sort: "business", dir: "up" }` | business, asc |
| `{ sort: ["business", "applied"] }` | application, asc |

**Unit 5 — order against the sample** (60 applications):

| Sort | First rows | Last row |
|---|---|---|
| application asc | APP-2026-1001 | APP-2026-1060 |
| application desc | APP-2026-1060 | APP-2026-1001 |
| business asc | APP-2026-1014 Ace Hardware Downtown, APP-2026-1059 Atlas Moving Co | APP-2026-1012 Zenith Engineering |
| business desc | APP-2026-1012 Zenith Engineering, APP-2026-1038 York Street Deli | APP-2026-1014 Ace Hardware Downtown |
| applied asc | APP-2026-1049 (9/4/2025), APP-2026-1056 (9/4/2025, tie by ID), APP-2026-1014 (9/5/2025) | APP-2026-1030 (1/29/2026) |
| applied desc | APP-2026-1030 (1/29/2026), APP-2026-1011 (1/26/2026), APP-2026-1042 (1/26/2026, tie still ID ascending) | APP-2026-1056 (9/4/2025), directly after APP-2026-1049 |

**Unit 6 — parsing**:

| `page` | Result |
|---|---|
| missing, `""` | 1 |
| `"2"`, `"6"` | 2, 6 |
| `"0"`, `"-1"`, `"abc"`, `"2.5"`, `"02"`, `["2", "3"]` | 1 |
| `"99"` | 99 (`paginate` then clamps it) |

**Unit 6 — pages against the sample** (60 applications → 6 full pages):

| Sort | Page | First → last ID | hasPrevious / hasNext |
|---|---|---|---|
| application asc | 1 | APP-2026-1001 → APP-2026-1010 | false / true |
| application asc | 2 | APP-2026-1011 → APP-2026-1020 | true / true |
| application asc | 6 | APP-2026-1051 → APP-2026-1060 | true / false |
| application asc | 99 (clamped to 6) | APP-2026-1051 → APP-2026-1060 | true / false |
| business asc | 2 | APP-2026-1032 → APP-2026-1036 | true / true |
| applied desc | 6 | APP-2026-1053 → APP-2026-1056 | true / false |

**Unit 6 — partial last page**: a builder fixture with 23 applications gives 3 pages; page 3 holds items 21–23 (3 items), with `hasNext: false`.

**Unit 2 round-trip**: a mutator that sets `notes` to `Called borrower, left "urgent" msg` writes the cell as `"Called borrower, left ""urgent"" msg"`, and the next `readRows` returns the original string.

## Test Cases — backend

Fixtures are temp-dir CSVs, either built by a row-builder helper or copied from `docs/NEWITY_Sample_Data_A_Document_Checklist.csv`. Never use the real `data/` file, and never write to `docs/`.

### Acceptance tests (user-specified)

These seven are the done-criteria for this run (Q17–Q21). Write them first and confirm each fails for the right reason before implementing.

| # | User's test | Exercised through | Fixture → assertion |
|---|---|---|---|
| 1 | We can read the CSV | `readRows` | Sample copy → 620 rows, each with all 11 fields; the first row is `APP-2026-1001`, Metro Dental Group, Bank Statements (90 day), Under Review |
| 2 | Count of the total number of applications | `listApplications` | Sample copy → length 60 |
| 3 | Count of the documents for each application | `listApplications` → `documentCount` | Sample copy → `APP-2026-1001` is 9; every summary's `documentCount` equals its row count in the file (8–12) |
| 4 | Status of all documents under an application | `getApplication` → `items` | Sample copy, `APP-2026-1001` → 12 items in alphabetical order; Ownership Verification `Approved`, Bank Statements (90 day) `Under Review`, Lease Agreement `Pending` |
| 5 | An application missing documents is still returned | `listApplications`, `getApplication` | Sample copy → `APP-2026-1001` (9 rows) is in the list; its detail has 3 items with status `Not on checklist` and `row: null` (Debt Schedule, SBA Form 1919, SBA Form 912) |
| 6 | A document without a status is returned as Not Started | `getApplication` → `items` | Builder fixture with one blank `document_status` → that item's status is `Not Started`, it is not satisfied, it counts as outstanding, and `row.documentStatus` is still `""` |
| 7 | No applications → empty result (the UI shows "No open applications to display") | `listApplications` | Header-only fixture → `[]`; zero-byte fixture → `[]` |

### Acceptance tests — sorting (user-specified)

Done-criteria for the sorting run (Q23, Q25). Write them first and confirm each fails for the right reason (`parseApplicationSort` / `compareApplications` missing, or `listApplications` ignoring its argument) before implementing. Expected orders are in [I/O Samples](#io-samples).

| # | User's test | Exercised through | Fixture → assertion |
|---|---|---|---|
| S1 | Sort by each column, ascending | `listApplications({ column, direction: asc })` for application, business, applied | Sample copy → the first and last rows per the order table; applied asc is chronological (the first row is 9/4/2025, not `1/11/2026`) |
| S2 | Sort by each column, descending | same, `direction: desc` | Sample copy → the first and last rows per the order table; tied dates stay ID ascending (APP-2026-1011 before APP-2026-1042) |
| S3 | The total number of applications doesn't change with the sort | `listApplications` for all 6 column × direction combinations | Sample copy → every result has length 60 and the same set of application IDs as the default call |
| S4 | Invalid sort and dir values fall back | `parseApplicationSort` | Unknown column (`status`), wrong case (`Business`), unknown dir (`up`) and a repeated param → the parsed sort per the parsing table |
| S5 | Empty or missing sort and dir fall back | `parseApplicationSort` | `{}` and `{ sort: "", dir: "" }` → application, asc; and `listApplications()` with no argument still returns ID ascending |

### Acceptance tests — pagination (user-specified)

Done-criteria for the pagination run (Q27–Q31). Write them first and confirm each fails for the right reason (`pagination.ts`, `parsePageParam` or `paginate` missing) before implementing. Expected pages are in [I/O Samples](#io-samples).

| # | User's test | Exercised through | Fixture → assertion |
|---|---|---|---|
| P1 | We can paginate to the end of the list | `paginate` on pages 1 → `totalPages` | Sample copy → 6 pages of 10; page 6 ends at APP-2026-1060; the six pages together hold all 60 IDs once each, in order. The 23-item builder fixture → page 3 holds 3 items |
| P2 | We can't paginate before page 1 | `paginate`, `parsePageParam` | Page 1 → `hasPrevious: false`; `parsePageParam("0")` and `parsePageParam("-1")` → 1 |
| P3 | The arrows can't go past either end | `paginate` | Page 1 → `hasPrevious: false`, `hasNext: true`; the last page → `hasPrevious: true`, `hasNext: false`; a single-page list (≤ 10 items) → both false |
| P4 | Valid page values | `parsePageParam`, `paginate` | `"2"` → page 2, APP-2026-1011 → APP-2026-1020; `"99"` → clamped to page 6; business asc page 2 → APP-2026-1032 → APP-2026-1036 (pagination slices the sorted list) |
| P5 | Empty page values | `parsePageParam` | Missing and `""` → 1 |
| P6 | Invalid page values | `parsePageParam` | `"abc"`, `"2.5"`, `"02"` and an array → 1 |

### Further unit tests

**readRows**
- Blank cells are empty strings.
- A quoted field containing a comma, a double quote and a newline parses to the original string.
- Missing file → `CsvDataError`.
- Wrong or reordered header → `CsvDataError`.
- A row with too few fields → `CsvDataError` naming its line.
- Does not modify the file (compare mtime and contents before and after).

**buildChecklist**
- 12 rows all Approved → complete, 0 outstanding, `documentCount` 12.
- Mix of Approved and Not Required covering all 12 → complete.
- Empty input → 12 items, all `Not on checklist`, 12 outstanding, `documentCount` 0.
- Unknown status value → shown as stored, not satisfied.
- Input rows are not mutated.

**listApplications / getApplication**
- Rows for different applications interleaved in the file → one summary per ID, sorted by ID.
- `loanAmount` parses to a number for whole (`390000`) and decimal (`12500.5`) values.
- Unknown ID → `null`.
- `CsvDataError` from `readRows` propagates.

**compareApplications**
- Business compares case-insensitively (a builder fixture with `apex Co` and `Acme Inc` → `Acme Inc` first).
- Applied: a builder fixture with `9/11/2025`, `12/1/2025` and `1/5/2026` → chronological order in asc, and reversed in desc.
- Ties on business name or date → `applicationId` ascending in both directions.

**paginate**
- An empty list → page 1 of 1, `items: []`, `totalCount: 0`, both flags false.
- Exactly 10 items → 1 page; 11 items → 2 pages, the second holding 1 item.
- The input array is not mutated.

**mutateRows** (Task 5, not this run)
- The mutator's returned rows are persisted and its `result` is returned.
- A throwing mutator → error rethrown, file byte-identical, and a following call still succeeds (lock released).
- Two concurrent calls that each append one row → both rows present (proves read-inside-lock serialization).
- After success, no temp file remains in the directory.
- Write-step failure (rename made to fail with a read-only directory or a mocked fs) → original intact, temp removed.

## File Manifest — backend

| Group | File | Purpose |
|---|---|---|
| Scaffold | `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` | Done in Task 1. Scripts: `dev`, `build`, `start`, `test`, `lint`, `typecheck`, `seed` |
| Scaffold | `.gitignore`, `scripts/seed.mts` | Done in Task 1 |
| Domain | `src/lib/applications/constants.ts` | Columns, types, statuses, satisfied set, the two labels |
| Domain | `src/lib/applications/dates.ts` | Task 5: `M/D/YYYY` ↔ ISO conversion and validation, for update-document-status |
| Data | `src/lib/applications/csv-repository.ts` | Unit 1 (Task 3); Unit 2 (Task 5) |
| Data | `src/lib/applications/checklist.ts` | Unit 3 |
| Data | `src/lib/applications/queries.ts` | Unit 4 (Task 6 adds the `sort` argument) |
| Domain | `src/lib/applications/pagination.ts` | Unit 6: `PAGE_SIZE`, `Page<T>`, `parsePageParam`, `paginate` (not `server-only`) |
| Domain | `src/lib/applications/sort.ts` | Unit 5: enums, default, `parseApplicationSort`, `compareApplications` (not `server-only`) |
| Tests | `*.test.ts` beside each module, plus a shared fixture builder | — |

## Tasks — backend

### Task 1: Scaffold the project and seed script

Every unit in the [Contract](#contract) needs a Next.js project, a test runner and a live data file.

- [x] **Done**
- **Who**: infra.
- **What**: Create the Next.js App Router TypeScript project with Vitest, `server-only` and papaparse, a `data/` gitignore entry, and a seed script.
- **Why**: [Unit 1](#unit-1-csv-repository--readrows) reads the seeded file.
- **When**: First; no dependencies.
- **Where**: Project root (see [File Manifest — backend](#file-manifest--backend)).
- **How**: `create-next-app@16.4.1` (TypeScript, ESLint, App Router, `src/`); the seed script copies the sample file and never overwrites an existing data file unless forced.

### Task 2: Domain constants

[Unit 3](#unit-3-checklist-derivation--buildchecklist) counts against the 12 types and the satisfied set, and labels placeholders with the Not Started and Not on checklist constants.

- [x] **Done**
- **Who**: backend.
- **What**: Add the constants module.
- **Why**: Every Contract unit imports it; the placeholder labels satisfy acceptance tests 5 and 6.
- **When**: After Task 1.
- **Where**: `src/lib/applications/constants.ts`.
- **How**: Net-new. Use an `enum` for the fixed status set, per the TypeScript standards.

### Task 3: CSV repository — readRows

[Unit 1](#unit-1-csv-repository--readrows) is the only code that reads the data file. It returns `[]` for an empty file and throws `CsvDataError` for a missing file, a bad header or a malformed row.

- [x] **Done**
- **Who**: backend.
- **What**: Implement `readRows` and `CsvDataError`.
- **Why**: Acceptance tests 1 and 7, and the CSV-error criterion in [Acceptance Criteria](view-applications.md#acceptance-criteria).
- **When**: After Task 2.
- **Where**: `src/lib/applications/csv-repository.ts`.
- **How**: papaparse `parse` in header mode; `fs.promises.readFile` per call.

### Task 4: Checklist derivation and read queries

[Units 3 and 4](#unit-3-checklist-derivation--buildchecklist) turn rows into what the pages show: Complete vs N outstanding, the document count, and the display status of each of the 12 types.

- [x] **Done**
- **Who**: backend.
- **What**: Implement `buildChecklist`, `listApplications` and `getApplication`.
- **Why**: Acceptance tests 2–7.
- **When**: After Task 3.
- **Where**: `src/lib/applications/checklist.ts`, `src/lib/applications/queries.ts`.
- **How**: A pure function over `readRows` output; no new dependencies.

### Task 5: Shared writer and date helpers for update-document-status

[Unit 2](#unit-2-csv-repository--mutaterows) is the serialized atomic writer, and the date helpers convert between `M/D/YYYY` and ISO dates for form inputs. Viewing uses neither. Build this when update-document-status starts, not in the view run.

- [ ] **Done**
- **Who**: backend.
- **What**: Implement `mutateRows` and the date helpers (format, parse, is-valid, is-not-in-future).
- **Why**: [update-document-status Contract](../update-document-status/backend-contract.md#contract) depends on both.
- **When**: After Task 3.
- **Where**: `src/lib/applications/csv-repository.ts`, `src/lib/applications/dates.ts`.
- **How**: papaparse `unparse`; a module-level promise-chain lock; `fs.promises` write then rename. Dates are formatted without zero padding to match the sample (`1/5/2026`).

### Task 6: Sortable applications list query

[Unit 5](#unit-5-sort-parsing-and-ordering--parseapplicationsort-compareapplications) turns the `/` page's `sort` and `dir` URL params into a validated sort and a deterministic comparator, and [Unit 4](#unit-4-read-queries--listapplications-getapplication)'s `listApplications` gains an optional `sort` argument that uses it. With no argument, the existing ID-ascending order is unchanged.

- [x] **Done**
- **Who**: backend.
- **What**: Add `sort.ts` (enums, default, parser, comparator) and the `sort` argument on `listApplications`.
- **Why**: Acceptance tests S1–S5 and the sorting criteria in [Acceptance Criteria](view-applications.md#acceptance-criteria).
- **When**: After Task 4. Independent of Task 5.
- **Where**: `src/lib/applications/sort.ts`, `src/lib/applications/queries.ts`.
- **How**: Net-new pure functions. Parse `M/D/YYYY` locally inside `sort.ts`; don't wait for Task 5's date helpers. No new dependencies.

### Task 7: Pagination

[Unit 6](#unit-6-pagination--parsepageparam-paginate) turns the `/` page's `page` URL param into a valid page number and slices the already-sorted list into pages of 10, reporting whether the Previous and Next arrows can move.

- [x] **Done**
- **Who**: backend.
- **What**: Add `pagination.ts` (`PAGE_SIZE`, `Page<T>`, `parsePageParam`, `paginate`).
- **Why**: Acceptance tests P1–P6 and the pagination criteria in [Acceptance Criteria](view-applications.md#acceptance-criteria).
- **When**: After Task 6. `listApplications` is unchanged; the page calls `paginate` on its result.
- **Where**: `src/lib/applications/pagination.ts`.
- **How**: Net-new pure functions; generic over the item type; no new dependencies.
