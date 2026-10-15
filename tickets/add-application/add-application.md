# add-application

| File | Holds |
|---|---|
| [add-application.md](add-application.md) | This index: decisions, sequence, acceptance criteria |
| [backend-contract.md](backend-contract.md) | `createApplication` service + server action, processor list query |
| [ui-contract.md](ui-contract.md) | "Add application" entry point and the new-application form |

Depends on [view-applications](../view-applications/view-applications.md) (scaffold, CSV repository, detail page). The shared evidence base is in [research-notes](../view-applications/research-notes.md).

> **DEFERRED — not in the MVP (2026-10-13).** The user took adding an application out of the MVP because it needs more thought on constraints, starting documents and similar decisions. The decisions below, including Q2 (12 Pending documents) and Q7 (auto ID), are reopened. Do not implement the Tasks in this folder until it is re-analyzed. See [Requirements Evolution](../view-applications/research-notes.md#requirements-evolution).

## Feature Request

> Use the files in the /doc folder to get context on the application we are trying to build. I believe the MVP features would be to view the applications and their status, then to add an application and it's status, and to update an application's status. It will use next js with a react front end and to start we can use a CSV as the data layer

- **Branch**: `main`
- **Captured**: 2026-10-13
- **Scope type**: feature (MVP path 2 of 3: add an application)

## Business Impact

- **Current problem**: new loan applications get typed into a shared spreadsheet by hand, one row per document, with the six application fields repeated on every row.
- **Desired outcome**: a short form takes the five application fields once and creates the full 12-document checklist, all Pending, under an auto-assigned ID.
- **Value**: no repeated typing, no forgotten document types, and no ID collisions. This also stops new applications from joining the 43 sample applications with incomplete checklists.

## Root Cause / Problem Statement

This is a greenfield path. Nothing exists to change, and it builds on the [CSV repository](../view-applications/backend-contract.md#unit-2-csv-repository--mutaterows) from view-applications. The request's "add an application and its status" resolves to: create the application with all 12 document types at status Pending (Q2). The status then reads "12 outstanding", derived as defined in [view-applications](../view-applications/view-applications.md#root-cause--problem-statement); no status is stored. This affects the processors and the team lead on two screens: the list page (entry point) and the new `/applications/new` form.

**Search patterns used**: same repo scan as [Technical Context](../view-applications/research-notes.md#technical-context); `cut -d, -f1 | sort -u` for the ID format (all `APP-2026-NNNN`, 1001–1060); `cut -d, -f6 | sort | uniq -c` for the processor set (3 names).

## Solution

**Change**: Add a `createApplication` service that validates the five fields, then, inside `mutateRows`, assigns `APP-<current year>-<max suffix + 1>` and appends 12 Pending rows. A server action wraps it to revalidate and redirect. Add a `/applications/new` form with a processor dropdown and an "Add application" link on the list page.
**Effort**: 0.5–1 day (assumed).
**Impact**: one form submission replaces 12 hand-typed spreadsheet rows.
**Risk**: Low. It is append-only through the already-tested serialized writer, and ID assignment happens inside the lock.

### Why This Solution

The ID is computed inside the write lock, from the rows as they are at that moment, so two simultaneous submissions can't get the same ID. The strongest objection is the processor dropdown: it's built from names already in the CSV, so a newly hired processor can't be selected until an application exists for them. The alternative, free text, invites typos ("Aisha Patal") that would split one person into two in every later per-processor feature. For three stable users, the dropdown's constraint is the cheaper failure. A processor-management follow-up handles hires.

### Post-Deployment Plan

- Monitoring: server console only (local MVP).
- Success metric: new applications are created through the form, not by editing the CSV.
- Follow-up work: see [Follow-Up Work](#follow-up-work).

## Impact Analysis

- **Key metric**: each submission adds exactly 12 rows, all Pending, under a unique ID.
- **Risk / rollback**: append-only. A bad application can be removed by deleting its rows from `data/applications.csv`; there is no delete in the MVP.

## Implementation Steps

- [ ] Implement `listProcessors` and the validation rules
- [ ] Implement `createApplication` (ID assignment + 12-row append inside `mutateRows`)
- [ ] Implement the server action (revalidate, redirect, field errors)
- [ ] Build `/applications/new` and the "Add application" link
- [ ] Run unit tests, Cypress specs, lint and type-check

## Sequence

1. Requires view-applications [Tasks — backend](../view-applications/backend-contract.md#tasks--backend) Tasks 1–3 and [Tasks — UI](../view-applications/ui-contract.md#tasks--ui) Task 2 (the form redirects to the detail page).
2. Then this folder's [Tasks — backend](backend-contract.md#tasks--backend) and [Tasks — UI](ui-contract.md#tasks--ui) can run in parallel against the action signature. The UI must finish after backend Task 2.
3. This path doesn't depend on [update-document-status](../update-document-status/update-document-status.md); the two can run in parallel.

## Testing Summary

- Vitest unit tests for validation, ID assignment, the 12-row append and concurrency, against temp-dir fixtures. See [Test Cases — backend](backend-contract.md#test-cases--backend).
- Cypress specs for the form: happy path, field errors, cancel. See [Test Cases — UI](ui-contract.md#test-cases--ui).
- Key scenarios: valid submit lands on the new detail page showing "12 outstanding"; invalid submit writes nothing; a business name containing a comma round-trips; two concurrent creates get distinct IDs.

## Known Limitations

- Application fields can't be edited or deleted after creation.
- No duplicate detection (the same business can be added twice).
- New processors can't be added through the UI.
- `expiration_date` is not set on creation; it stays blank until expiration tracking ships.

## Concerns & Questions

- **Addressed**: Which documents a new application gets: all 12, Pending (Q2).
- **Addressed**: ID assignment: auto `APP-<year>-<max+1>` (Q7).
- **Deferred to Follow-Up**: Edit or delete application fields → [Follow-Up Work](#follow-up-work) item 1; processor management → item 2.

## Follow-Up Work

1. Edit and delete an application's header fields - Priority: Med, Effort: 0.5–1 day
2. Manage the processor list (add a new hire) - Priority: Low, Effort: 0.5 day
3. Duplicate-application warning (same business + borrower) - Priority: Low, Effort: 0.5 day
4. Choose which document types apply at creation (mark others Not Required up front) - Priority: Low, Effort: 0.5 day

## Acceptance Criteria

- [ ] The applications list page has an "Add application" link that opens `/applications/new`.
- [ ] The form asks for business name, borrower name, loan amount, application date and assigned processor.
- [ ] ⚠️ Assigned processor is a dropdown of the distinct processor names already in the CSV, sorted alphabetically.
- [ ] ⚠️ Application date defaults to today.
- [ ] Submitting a valid form creates an application whose ID is `APP-<current year>-<N>`, where N is one more than the highest numeric suffix of any existing application ID (e.g. `APP-2026-1061` against the sample).
- [ ] The new application has exactly 12 document rows, one per document type, each with status Pending and blank date received, expiration date and notes.
- [ ] The application date is stored in the CSV as `M/D/YYYY` (e.g. `10/13/2026`), matching existing rows.
- [ ] After a successful submit the user lands on the new application's detail page, which shows status "12 outstanding"; the list page also shows it.
- [ ] ⚠️ Validation: business name and borrower name are required (trimmed, max 100 characters); loan amount is a whole number greater than 0; application date is a valid date not in the future; processor is one of the listed names.
- [ ] An invalid submission shows a message next to each invalid field, keeps the entered values, and writes nothing to the CSV.
- [ ] Text containing commas or double quotes (e.g. `Smith, Jones & Co "East"`) is stored and displayed exactly as entered.
- [ ] Two applications created at the same moment receive different IDs and both have 12 rows.
- [ ] A Cancel link returns to the list without writing anything.

## Answered Questions

The answers that settle this path are Q2 (12 Pending rows) and Q7 (auto ID) in the shared [Answered Questions](../view-applications/research-notes.md#answered-questions) record.

## Metadata

| Key | Value |
|---|---|
| Analysis date | 2026-10-13 |
| Feature | add-application |
| Branch | main |
| Phase | `Solution` |
| Scope type | feature |
| Root cause | n/a (greenfield) |
| Estimated effort | 0.5–1 day (assumed) |
| Risk assessment | Low |
| Blocking questions | 0 |
| Blocker status | unblocked |
