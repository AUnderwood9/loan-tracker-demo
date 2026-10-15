# backend-contract

Server-side unit for [update-document-status](update-document-status.md). It reuses the [view-applications](../view-applications/backend-contract.md#contract) foundation: `mutateRows`, the domain constants and the date helpers.

## Contract

### Unit 1: updateDocument service and server action

#### Pre-conditions

1. The data file is readable and writable by the Node process.
2. A single Node process ([Q4](../view-applications/research-notes.md#answered-questions)), so the `mutateRows` lock is effective.
3. (application_id, document_type) identifies at most one row. This holds in the sample ([Technical Context](../view-applications/research-notes.md#technical-context)) and is preserved by add-application, which creates one row per type.

#### Input

1. **Signatures**:
   - Service: `updateDocument(input: UpdateDocumentInput): Promise<{ ok: true; row: DocumentRow } | { ok: false; fieldErrors?: Partial<Record<'status' | 'dateReceived' | 'notes', string>>; formError?: string }>`
   - Server action (form-bound via `useActionState`): `updateDocumentAction(prevState, formData): Promise<UpdateDocumentState>`. It calls the service and, on success, revalidates both pages and returns `{ ok: true }`.
2. **Input fields**:

| Field | Type | Nullable | Source | Destination |
|---|---|---|---|---|
| applicationId | string | no | hidden form field (from the detail route) | row lookup |
| documentType | string | no | hidden form field (the checklist row) | row lookup |
| status | string | no | select | `document_status` |
| dateReceived | string `YYYY-MM-DD` or empty | yes (empty) | date input | `date_received`, written as `M/D/YYYY` or blank |
| notes | string | yes (empty) | textarea | `notes`, verbatim (trimmed) |

3. **Identity / context**: the server's current date (future-date check). No auth (MVP limitation).

#### Operations

Validate → Persist. No external calls.

1. Trim `notes` and `dateReceived`.
2. Validate (net-new; rules are ⚠️ assumed per [Acceptance Criteria](update-document-status.md#acceptance-criteria)) and collect all field errors:
   - status is one of the 6 document statuses (constants from view-applications);
   - dateReceived is empty, or a valid ISO date not after today (date helpers);
   - notes are ≤ 500 characters.
3. If any errors: return `{ ok: false, fieldErrors }`. Don't call `mutateRows`.
4. Call `mutateRows` with a mutator that, **inside the lock**:
   1. finds the index of the row with matching `applicationId` **and** `documentType`;
   2. if none, throws `DocumentNotFound` (net-new), so nothing is written;
   3. replaces that row with a copy whose `documentStatus`, `dateReceived` (converted to `M/D/YYYY`, or blank) and `notes` are the new values, with the other 8 fields copied unchanged;
   4. returns `{ rows, result: updatedRow }`.
5. Catch `DocumentNotFound` → return `{ ok: false, formError: "This document could not be found" }`. Other errors propagate.
6. Return `{ ok: true, row: updatedRow }`.
7. Action only: on `ok`, call `revalidatePath('/')` and `revalidatePath('/applications/<applicationId>')`.
8. Lint and type-check pass; no new rule disables.

No status/date coupling is enforced server-side: a Pending document may keep a received date, and a Received one may have none. The today pre-fill is a UI convenience only ([State Machines](ui-contract.md#state-machines)).

#### Post-conditions

1. **On success**: exactly one row changes, and only its three editable cells. Row order and every other byte of the file are unchanged.
2. **On failure (validation or not found)**: nothing is written. On validation failure `mutateRows` is **not called**; on not-found it is called, but the mutator throws, so the file stays byte-identical.
3. **On failure (I/O)**: `mutateRows` guarantees the original file is intact; the error reaches the error boundary.
4. **Downstream consequence**: the list's status column and the detail header derive from these rows ([buildChecklist](../view-applications/backend-contract.md#unit-3-checklist-derivation--buildchecklist)). Revalidation makes them reflect the change on the next render.

#### Output

1. **Success**: `{ "ok": true, "row": { "applicationId": "APP-2026-1001", "documentType": "Lease Agreement", "documentStatus": "Received", "dateReceived": "10/13/2026", "notes": "Signed lease, 5-yr term", "...": "..." } }`. The action returns `{ "ok": true }`.
2. **Failure table** (server-action convention: body-level `ok` flag, no HTTP status):

| Trigger | Result |
|---|---|
| Status not one of the 6 | `fieldErrors.status: "Choose a status from the list"` |
| Unparseable or future date | `fieldErrors.dateReceived: "Enter a valid date that is not in the future"` |
| Notes over 500 chars | `fieldErrors.notes: "Notes must be 500 characters or fewer"` |
| No row for (applicationId, documentType) | `formError: "This document could not be found"` |
| Write fails (unexpected I/O error) | thrown; generic error boundary |

## I/O Samples

**Before** (sample row):

| application_id | … | document_type | document_status | date_received | expiration_date | notes |
|---|---|---|---|---|---|---|
| APP-2026-1001 | … | Lease Agreement | Pending | | | Borrower contacted via email |

**Input**: `{ applicationId: "APP-2026-1001", documentType: "Lease Agreement", status: "Received", dateReceived: "2026-10-13", notes: "Signed lease, 5-yr term" }`

**After**:

| application_id | … | document_type | document_status | date_received | expiration_date | notes |
|---|---|---|---|---|---|---|
| APP-2026-1001 | … | Lease Agreement | Received | 10/13/2026 | | Signed lease, 5-yr term |

On disk, the notes cell is quoted because it contains a comma. The application stays at "10 outstanding" because Received is not a satisfied status.

## Test Cases — backend

Temp-dir fixtures via the shared row builder; the clock is frozen.

- **Happy path**: the three cells are updated; the date is converted to `M/D/YYYY`; the returned row matches.
- **Isolation**: compare the file before and after. Only the target row differs, and within it only the three cells; `expirationDate` and the header fields are identical; row order is unchanged.
- **Same type, other application**: a fixture where two applications both have "Lease Agreement" → only the targeted one changes.
- **Clear date**: empty `dateReceived` → blank cell.
- **Status completes the application**: a fixture with 11 satisfied types + 1 Pending, update to Approved → `getApplication` reports `isComplete: true`.
- **Validation (one test per failure-table row)**: correct `fieldErrors`; `mutateRows` is not called (spy); the file is byte-identical.
- **Not found**: an unknown application ID, or a type the application lacks → `formError`; the file is byte-identical.
- **Round-trip**: notes with a comma, a double quote and a newline read back identically via `readRows`.
- **Concurrency**: two parallel updates to different rows of the same application → both persist.
- **Action**: on success it calls `revalidatePath` for `/` and `/applications/<id>` (mocked); on failure it returns state and doesn't revalidate.

## File Manifest — backend

| Group | File | Purpose |
|---|---|---|
| Domain | `src/lib/applications/update-document.ts` | Validation + service |
| Action | `src/app/applications/[id]/actions.ts` | `"use server"` action wrapper |
| Tests | `src/lib/applications/update-document.test.ts`, `src/app/applications/[id]/actions.test.ts` | — |

## Tasks — backend

### Task 1: Update validation

[Unit 1](#unit-1-updatedocument-service-and-server-action) Operations steps 1–3 reject bad input before the lock is ever taken, returning every field error at once.

- [ ] **Done**
- **Who**: backend.
- **What**: Implement validation for status, date received and notes.
- **Why**: The validation criterion in [Acceptance Criteria](update-document-status.md#acceptance-criteria).
- **Where**: `src/lib/applications/update-document.ts`.
- **How**: Reuse the status constants and date helpers from view-applications; the length rule is net-new.

### Task 2: updateDocument service and server action

[Unit 1](#unit-1-updatedocument-service-and-server-action) Operations steps 4–7: the row lookup and the three-cell replace inside `mutateRows`, the not-found mapping, and revalidation of both pages.

- [ ] **Done**
- **Who**: backend.
- **What**: Implement the service and the `"use server"` action.
- **Why**: The save, isolation, recalculation, clear-date, round-trip and not-found criteria in [Acceptance Criteria](update-document-status.md#acceptance-criteria).
- **When**: After Task 1.
- **Where**: `src/lib/applications/update-document.ts`, `src/app/applications/[id]/actions.ts`.
- **How**: Reuse `mutateRows`; `revalidatePath` from `next/cache`; `DocumentNotFound` is net-new.
