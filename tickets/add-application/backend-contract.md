# backend-contract

Server-side units for [add-application](add-application.md). They reuse the [view-applications](../view-applications/backend-contract.md#contract) foundation: `readRows`, `mutateRows`, the domain constants and the date helpers.

## Contract

### Unit 1: listProcessors

#### Pre-conditions

1. The data file is readable ([readRows pre-conditions](../view-applications/backend-contract.md#unit-1-csv-repository--readrows)).

#### Input

1. **Signature**: `listProcessors(): Promise<string[]>`
2. **Input fields**: none.
3. **Identity / context**: none.

#### Operations

1. Read rows via `readRows`.
2. Collect the distinct non-blank `assignedProcessor` values, sorted alphabetically.
3. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: names are returned and the file is untouched.
2. **On failure**: `readRows` errors propagate.
3. **Downstream consequence**: feeds the form's dropdown and the allowed set in Unit 2's validation.

#### Output

1. **Success**: `["Aisha Patel", "Janet Morrison", "Ricardo Fuentes"]` against the sample.
2. **Failures**: `readRows` errors only.

### Unit 2: createApplication service and server action

#### Pre-conditions

1. The data file is readable and writable by the Node process.
2. A single Node process ([Q4](../view-applications/research-notes.md#answered-questions)), so the `mutateRows` lock is effective.

#### Input

1. **Signatures**:
   - Service: `createApplication(input: NewApplicationInput): Promise<{ ok: true; applicationId: string } | { ok: false; fieldErrors: Partial<Record<keyof NewApplicationInput, string>> }>`
   - Server action (form-bound via `useActionState`): `createApplicationAction(prevState, formData): Promise<CreateApplicationState>`. It calls the service; on success it revalidates and redirects, and on failure it returns `{ fieldErrors, values }`.
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| businessName | string | no | user input | `business_name` on all 12 rows |
| borrowerName | string | no | user input | `borrower_name` on all 12 rows |
| loanAmount | string → integer | no | user input (number field) | `loan_amount`, written as digits only |
| applicationDate | string `YYYY-MM-DD` | no | user input (date field) | `application_date`, written as `M/D/YYYY` |
| assignedProcessor | string | no | dropdown (Unit 1) | `assigned_processor` |

3. **Identity / context**: the server's current date (default "today", the future-date check, and the ID year). No auth (MVP limitation).

#### Operations

Validate → Persist. No external calls.

1. Trim all string fields.
2. Validate (net-new; rules are ⚠️ assumed per [Acceptance Criteria](add-application.md#acceptance-criteria)) and collect **all** field errors, not just the first:
   - businessName and borrowerName are non-empty and ≤ 100 characters;
   - loanAmount matches whole digits and is > 0;
   - applicationDate is a valid ISO date and not after today (date helpers from [view-applications Task 2](../view-applications/backend-contract.md#task-2-domain-constants-and-date-helpers));
   - assignedProcessor is in `listProcessors()`.
3. If any errors: return `{ ok: false, fieldErrors }`. Don't call `mutateRows`.
4. Call `mutateRows` with a mutator that, **inside the lock**:
   1. computes `maxSuffix` = the highest N over all IDs matching `APP-<4 digits>-<N>`, or 1000 if none match (ASSUMED, so the first ID is 1001 like the sample);
   2. builds `applicationId` = `APP-<current year>-<maxSuffix + 1>`;
   3. appends 12 rows, one per document type in constant order, with the header fields from the input, `document_status` = Pending, and blank `date_received`, `expiration_date` and `notes`;
   4. returns `{ rows, result: applicationId }`.
5. Return `{ ok: true, applicationId }`.
6. Action only: on `ok`, call `revalidatePath('/')` and then `redirect('/applications/<applicationId>')`.
7. Lint and type-check pass; no new rule disables.

#### Post-conditions

1. **On success**: exactly 12 new rows sit at the end of the file under one new ID, and existing rows are byte-identical. The list and detail pages show the application as "12 outstanding".
2. **On failure (validation)**: nothing is written; `mutateRows` is **not called**.
3. **On failure (I/O)**: `mutateRows` guarantees the file is unchanged; the error propagates to the action, which lets it reach the error boundary.
4. **Downstream consequence**: the new ID is the detail-page URL the user is redirected to, and the 12 Pending rows are what [update-document-status](../update-document-status/backend-contract.md#contract) edits.

#### Output

1. **Success**: the service returns `{ "ok": true, "applicationId": "APP-2026-1061" }`; the action redirects (no body).
2. **Failure table** (server-action convention: body-level `ok` flag, no HTTP status):

| Trigger | Result |
|---|---|
| Blank business name | `{ ok: false, fieldErrors: { businessName: "Business name is required" } }` |
| Name over 100 chars | `fieldErrors.<field>: "Must be 100 characters or fewer"` |
| Loan amount `0`, `-5`, `12.5`, `abc` or blank | `fieldErrors.loanAmount: "Enter a whole dollar amount greater than 0"` |
| Invalid or future date | `fieldErrors.applicationDate: "Enter a valid date that is not in the future"` |
| Processor not in list | `fieldErrors.assignedProcessor: "Choose a processor from the list"` |
| Data file missing or invalid, or write fails | thrown; error boundary shows the message |

## I/O Samples

**Input** (form submit on 10/13/2026):

```json
{ "businessName": "Smith, Jones & Co \"East\"", "borrowerName": "Dana Ruiz", "loanAmount": "250000", "applicationDate": "2026-10-13", "assignedProcessor": "Ricardo Fuentes" }
```

**Rows appended** (2 of 12 shown):

| application_id | business_name | borrower_name | loan_amount | application_date | assigned_processor | document_type | document_status | date_received | expiration_date | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| APP-2026-1061 | Smith, Jones & Co "East" | Dana Ruiz | 250000 | 10/13/2026 | Ricardo Fuentes | Articles of Incorporation | Pending | | | |
| APP-2026-1061 | Smith, Jones & Co "East" | Dana Ruiz | 250000 | 10/13/2026 | Ricardo Fuentes | Bank Statements (90 day) | Pending | | | |

On disk, the business name cell is written quoted, with its inner quotes doubled.

**Result**: redirect to `/applications/APP-2026-1061`.

## Test Cases — backend

Fixtures are temp-dir CSVs via the shared row builder; the clock is frozen with fake timers at a fixed date.

- **Happy path**: a valid input against a fixture whose max ID is `APP-2026-1060` → `APP-2026-1061`; 12 new rows in constant type order, all Pending with blank dates and notes; existing rows unchanged.
- **Date format**: `2026-01-05` → stored `1/5/2026`.
- **ID across years**: fixture max `APP-2026-1060`, clock in 2027 → `APP-2027-1061`.
- **Empty file**: header-only fixture → `APP-<year>-1001`.
- **Non-matching IDs ignored**: a fixture with `LEGACY-7` → doesn't affect max.
- **Concurrency**: two `createApplication` calls in parallel → two distinct IDs and 24 new rows.
- **Validation (one test per failure-table row)**: returns the expected `fieldErrors`, and `mutateRows` is never called (spy) and the file is byte-identical.
- **Multiple errors**: blank names + bad amount → all three fieldErrors returned together.
- **Round-trip**: a business name with a comma and quotes reads back identically via `readRows`.
- **listProcessors**: distinct, sorted, blank values excluded.
- **Action**: on success it calls `revalidatePath('/')` and `redirect` with the new ID (both mocked); on failure it returns `fieldErrors` and the submitted `values` and doesn't redirect.

## File Manifest — backend

| Group | File | Purpose |
|---|---|---|
| Domain | `src/lib/applications/create-application.ts` | Validation + service (Unit 2), `listProcessors` (Unit 1) |
| Action | `src/app/applications/new/actions.ts` | `"use server"` action wrapper |
| Tests | `src/lib/applications/create-application.test.ts`, `src/app/applications/new/actions.test.ts` | — |

## Tasks — backend

### Task 1: Processor list and validation

[Unit 1](#unit-1-listprocessors) supplies the dropdown values and the allowed set that [Unit 2's validation step](#unit-2-createapplication-service-and-server-action) checks against. This task covers Operations steps 1–3, returning every field error at once.

- [ ] **Done**
- **Who**: backend.
- **What**: Implement `listProcessors` and the field-validation function.
- **Why**: The validation and invalid-submission criteria in [Acceptance Criteria](add-application.md#acceptance-criteria).
- **Where**: `src/lib/applications/create-application.ts`.
- **How**: Reuse `readRows` and the date helpers from view-applications; the rules are net-new.

### Task 2: createApplication service and server action

[Unit 2](#unit-2-createapplication-service-and-server-action) Operations steps 4–6: ID assignment and the 12-row append happen inside `mutateRows`, so concurrent creates serialize. The action wrapper revalidates and redirects.

- [ ] **Done**
- **Who**: backend.
- **What**: Implement the service and the `"use server"` action.
- **Why**: The ID, 12-rows, date-format, redirect and concurrency criteria in [Acceptance Criteria](add-application.md#acceptance-criteria).
- **When**: After Task 1.
- **Where**: `src/lib/applications/create-application.ts`, `src/app/applications/new/actions.ts`.
- **How**: Reuse `mutateRows`, the constants and the date helpers; `revalidatePath` and `redirect` from `next/cache` and `next/navigation`.
