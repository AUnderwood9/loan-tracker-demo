# update-document-status

| File | Holds |
|---|---|
| [update-document-status.md](update-document-status.md) | This index: decisions, sequence, acceptance criteria |
| [backend-contract.md](backend-contract.md) | `updateDocument` service and server action |
| [ui-contract.md](ui-contract.md) | Inline edit of a checklist row on the detail page |

Depends on [view-applications](../view-applications/view-applications.md) (CSV repository, detail page). The shared evidence base is in [research-notes](../view-applications/research-notes.md).

## Feature Request

> Use the files in the /doc folder to get context on the application we are trying to build. I believe the MVP features would be to view the applications and their status, then to add an application and it's status, and to update an application's status. It will use next js with a react front end and to start we can use a CSV as the data layer

- **Branch**: `main`
- **Captured**: 2026-10-13
- **Scope type**: feature (MVP path 2 of 2: update an application's status, realized as updating a document's status)

## Business Impact

- **Current problem**: processors update document progress by finding the right row in a 620-row spreadsheet and editing cells by hand.
- **Desired outcome**: on an application's checklist, click Edit on a document, change its status, date received or notes, and save. The application's derived status updates immediately.
- **Value**: this is the daily-use action. It keeps the data current, which is what makes "which applications are outstanding" trustworthy.

## Root Cause / Problem Statement

This is a greenfield path, built on the [CSV repository](../view-applications/backend-contract.md#unit-2-csv-repository--mutaterows). The request's "update an application's status" resolves to updating one document row, because an application's status is derived from its documents ([Requirements Evolution](../view-applications/research-notes.md#requirements-evolution)). The editable fields are `document_status`, `date_received` and `notes` (Q3). `expiration_date` and the application header fields are not editable here. This affects the processors and the team lead on one screen, the detail page `/applications/[id]`.

**Search patterns used**: same repo scan as [Technical Context](../view-applications/research-notes.md#technical-context); `awk -F, '{print $8}' | sort | uniq -c` for the status set (6 values); a duplicate check on (application_id, document_type) found 0 duplicates, which makes that pair a safe row key.

## Solution

**Change**: Add an `updateDocument` service that validates the three fields, then, inside `mutateRows`, finds the row by (application ID, document type) and replaces only those three cells. A server action wraps it to revalidate the list and detail pages. Each present checklist row gets an inline Edit mode.
**Effort**: 0.5–1 day (assumed).
**Impact**: one edit changes exactly three cells of one row; the application's status recalculates on the same page.
**Risk**: Medium. It is the only path that rewrites existing data. This is mitigated by read-inside-lock, the atomic rename, and tests asserting every other byte is unchanged.

### Why This Solution

Inline row editing keeps users on the checklist they're reading, the closest thing to the spreadsheet habit the brief warns against breaking ("if it's harder than the spreadsheet, they won't use it"). The strongest objection is that two people editing the **same** document both succeed, and the later save silently wins. With three users who each own their applications (each application has exactly one assigned processor), a same-row collision means two people working the same document at the same minute. Optimistic locking (a row version check) costs a hidden field, a conflict state and its tests, for a case the team is unlikely to hit. It's a follow-up if it ever shows up.

### Post-Deployment Plan

- Monitoring: server console only (local MVP).
- Success metric: the team stops editing the CSV or spreadsheet directly for status changes.
- Follow-up work: see [Follow-Up Work](#follow-up-work).

## Impact Analysis

- **Key metric**: after a save, a byte diff of the CSV shows changes only in the edited row's three cells.
- **Risk / rollback**: `data/applications.csv` is a plain file. Back it up before first use (copy it); rollback is restoring the copy. There is no edit history in the MVP.

## Implementation Steps

- [ ] Implement the field validation for status, date received and notes
- [ ] Implement `updateDocument` (row lookup + three-cell replace inside `mutateRows`)
- [ ] Implement the server action (revalidate both pages, return state)
- [ ] Add inline Edit mode to ChecklistTable rows
- [ ] Run unit tests, Cypress specs, lint and type-check

## Sequence

1. Requires view-applications [Tasks — backend](../view-applications/backend-contract.md#tasks--backend) Tasks 1–3 and [Tasks — UI](../view-applications/ui-contract.md#tasks--ui) Task 2 (ChecklistTable exists).
2. Then this folder's [Tasks — backend](backend-contract.md#tasks--backend) and [Tasks — UI](ui-contract.md#tasks--ui) run in parallel against the action signature. The UI must finish after backend Task 2.
3. It doesn't depend on [add-application](../add-application/add-application.md), which is deferred out of the MVP.

## Testing Summary

- Vitest unit tests for validation, the three-cell update, untouched-row and untouched-field guarantees, and the not-found case. See [Test Cases — backend](backend-contract.md#test-cases--backend).
- Cypress specs for the inline edit flow. See [Test Cases — UI](ui-contract.md#test-cases--ui).
- Key scenarios: approving the last outstanding document flips the header to "Complete"; Cancel writes nothing; notes containing commas, quotes and a newline round-trip; an invalid date writes nothing.

## Known Limitations

- Same-row concurrent edits: last save wins, with no warning.
- No edit history or audit trail (who changed what, when).
- `expiration_date` can't be set; marking a document Expired is manual.
- A document type missing from the checklist can't be added here ([view-applications Follow-Up](../view-applications/view-applications.md#follow-up-work) item 3).

## Concerns & Questions

- **Addressed**: Editable fields: status, date received, notes (Q3).
- **Addressed**: "Update application status" means updating a document's status; the application status is derived (Q1).
- **Deferred to Follow-Up**: Conflict detection → [Follow-Up Work](#follow-up-work) item 1; audit trail → item 2.

## Follow-Up Work

1. Optimistic-lock conflict warning for same-row edits - Priority: Low, Effort: 0.5 day
2. Change history per document (who, when, old → new) - Priority: Med, Effort: 1 day
3. Edit expiration date, with defaults from type (bank statements +90 days, tax returns +3 years) - Priority: High, Effort: 0.5–1 day (part of expiration tracking)
4. Bulk status update (e.g. mark several documents Received at once) - Priority: Low, Effort: 0.5–1 day

## Acceptance Criteria

- [ ] On the detail page, every checklist row that exists in the CSV has an Edit control; rows shown as "Not on checklist" do not.
- [ ] Clicking Edit turns that row into a form with Status (the 6 statuses: Pending, Received, Under Review, Approved, Expired, Not Required), Date received and Notes, prefilled with the row's current values.
- [ ] Saving writes the new status, date received (as `M/D/YYYY`) and notes to that document's row in the CSV; every other row, and that row's other 8 fields (including expiration date), are unchanged.
- [ ] After saving, the row shows the new values and the application status in the header recalculates on the same page (e.g. approving the only outstanding document changes "1 outstanding" to "Complete").
- [ ] The list page reflects the new application status on its next load.
- [ ] Cancel restores the row's display without writing anything.
- [ ] Clearing Date received saves it as blank.
- [ ] ⚠️ Validation: the status must be one of the 6; date received is blank or a valid date not in the future; notes are at most 500 characters. Invalid input shows a message next to the field, keeps the entered values and writes nothing.
- [ ] Notes containing commas, double quotes or line breaks are stored and displayed exactly as entered.
- [ ] ⚠️ When the status is changed from Pending to any other status and Date received is blank, Date received pre-fills with today (the user can change or clear it).
- [ ] ⚠️ Only one row is in edit mode at a time; clicking Edit on another row cancels the first.
- [ ] If the document row no longer exists when saving, the user sees "This document could not be found" and nothing is written.

## Answered Questions

The answers that settle this path are Q1 (derived status, so updates target documents) and Q3 (status, date received, notes) in the shared [Answered Questions](../view-applications/research-notes.md#answered-questions) record.

## Metadata

| Key | Value |
|---|---|
| Analysis date | 2026-10-13 |
| Feature | update-document-status |
| Branch | main |
| Phase | `Solution` |
| Scope type | feature |
| Root cause | n/a (greenfield) |
| Estimated effort | 0.5–1 day (assumed) |
| Risk assessment | Medium |
| Blocking questions | 0 |
| Blocker status | unblocked |
