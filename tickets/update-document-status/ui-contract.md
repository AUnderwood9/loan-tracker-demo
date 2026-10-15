# ui-contract

Client-facing units for [update-document-status](update-document-status.md). They extend the view-applications [ChecklistTable](../view-applications/ui-contract.md#component-decomposition), which stays server-rendered. Each present row gets a small client component that switches between display and edit, and submits to `updateDocumentAction` ([Unit 1](backend-contract.md#unit-1-updatedocument-service-and-server-action)). After a successful save, revalidation re-renders the server component, so the header status badge updates without extra client state.

## Component Decomposition

| Component | File | Responsibility |
|---|---|---|
| ChecklistTable | `src/components/ChecklistTable.tsx` (existing, from view-applications) | Renders a ChecklistRowEditor for each present row and the static "Not on checklist" row for missing ones; adds an Actions column |
| ChecklistRowEditor | `src/components/ChecklistRowEditor.tsx` (`"use client"`) | Display mode: stored values + Edit button. Edit mode: status select, date input, notes textarea, Save and Cancel, errors |
| EditingRowContext | `src/components/EditingRowContext.tsx` (`"use client"`) | Holds which document type is being edited, so only one row is in edit mode |

Date conversion: the stored `M/D/YYYY` is converted to `YYYY-MM-DD` for the date input's initial value, with the view-applications date helpers (imported as pure functions; no server-only code crosses into the client).

## State Machines

### Checklist row editor

| State | Renders | Events → next state |
|---|---|---|
| Viewing | Status, date received, expiration date, notes (line breaks preserved); Edit button | `EDIT` → Editing (and any other Editing row → Viewing) |
| Editing | Form prefilled with current values; expiration date shown read-only; Save, Cancel | `CHANGE_STATUS` (see guard); `SAVE` → Saving; `CANCEL` → Viewing (no write) |
| Saving | Save disabled, label "Saving…" | result `ok` → Viewing with new values; `fieldErrors` → Invalid; `formError` → NotFound; thrown → Failed |
| Invalid | Form with entered values kept; message under each invalid field | `SAVE` → Saving; `CANCEL` → Viewing |
| NotFound | Row-level message "This document could not be found" + Cancel | `CANCEL` → Viewing |
| Failed | Generic error boundary | `RETRY` → re-render |

**Guard on `CHANGE_STATUS`** (⚠️): if the previous status was Pending, the new status is not Pending, and Date received is blank, set Date received to today. It never overwrites a non-blank date and never clears one.

Missing rows ("Not on checklist") have no machine; they render statically with no Edit button.

## I/O Samples

**Approve the last outstanding document**: on `/applications/APP-X` (11 satisfied, header "1 outstanding"), the user clicks Edit on "SBA Form 912" (Pending). They pick Approved; Date received fills with today (10/13/2026); they click Save. The row shows "Approved · 10/13/2026", and the header badge changes to "Complete".

**Notes with punctuation**: the user enters `Called borrower, said "next week"` on line 1 and `Follow up Fri` on line 2, then saves. The row shows both lines exactly.

**Invalid date**: the user enters date received 1/1/2030 and saves. "Enter a valid date that is not in the future" appears under the date, and the row stays in edit mode.

## Test Cases — UI

Cypress, with the fixture CSV reset per test (setup from [view-applications](../view-applications/ui-contract.md#test-cases--ui)) and `cy.clock` for "today".

- **Edit availability**: present rows have Edit; "Not on checklist" rows don't.
- **Prefill**: the Edit form shows the current status, the date (converted correctly, e.g. `12/29/2025` → `2025-12-29`) and the notes.
- **Save**: change all three fields → the row displays the new values. Read the fixture file: the target row's cells are updated and the date is stored `M/D/YYYY`.
- **Recalculate**: approving the single outstanding document flips the header badge to "Complete"; the list page shows "Complete" for that application.
- **Cancel**: edit values then Cancel → the original values are displayed and the file is byte-identical.
- **Clear date**: clear the date and save → blank cell in display and in the file.
- **Pre-fill guard**: Pending + blank date → choosing Received fills today. A row that already has a date keeps it. Choosing Pending doesn't fill.
- **Single edit**: Edit on row A, then Edit on row B → A returns to Viewing.
- **Invalid**: a future date → message, values kept, file byte-identical.
- **Punctuation**: notes with a comma, quotes and a newline display exactly after save and after a reload.

## File Manifest — UI

| Group | File | Purpose |
|---|---|---|
| Table | `src/components/ChecklistTable.tsx` | Add the Actions column; render ChecklistRowEditor for present rows; wrap in EditingRowContext |
| Editor | `src/components/ChecklistRowEditor.tsx` | Row display/edit machine with `useActionState` |
| Context | `src/components/EditingRowContext.tsx` | Single-row-in-edit coordination |
| Tests | `cypress/e2e/update-document-status.cy.ts` | — |

## Tasks — UI

### Task 1: Inline row editor

Implements the [Checklist row editor](#checklist-row-editor) machine: Viewing, Editing, Saving, Invalid, NotFound and Failed, including the today pre-fill guard.

- [ ] **Done**
- **Who**: UI.
- **What**: Build ChecklistRowEditor and wire it into ChecklistTable for present rows.
- **Why**: The Edit, prefill, save, cancel, clear-date, validation, pre-fill, punctuation and not-found criteria in [Acceptance Criteria](update-document-status.md#acceptance-criteria).
- **When**: First UI task.
- **Where**: `src/components/ChecklistRowEditor.tsx`, `src/components/ChecklistTable.tsx`.
- **How**: `useActionState(updateDocumentAction)` with hidden applicationId and documentType fields; date conversion via the shared date helpers.

### Task 2: One row in edit at a time

The [Checklist row editor](#checklist-row-editor) `EDIT` transition must return any other editing row to Viewing. That needs shared state above the rows.

- [ ] **Done**
- **Who**: UI.
- **What**: Add EditingRowContext and use it in ChecklistRowEditor.
- **Why**: The single-row criterion in [Acceptance Criteria](update-document-status.md#acceptance-criteria).
- **When**: After Task 1.
- **Where**: `src/components/EditingRowContext.tsx`, `src/components/ChecklistTable.tsx`, `src/components/ChecklistRowEditor.tsx`.
- **How**: A React context holding the editing document type; net-new, no library.
