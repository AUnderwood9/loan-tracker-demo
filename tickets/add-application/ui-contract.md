# ui-contract

Client-facing units for [add-application](add-application.md). The page is a server component that loads the processor list. The form is a client component bound to `createApplicationAction` via `useActionState` ([Unit 2](backend-contract.md#unit-2-createapplication-service-and-server-action)). It works without client-side fetch code, and it renders field errors from the action's returned state.

## Component Decomposition

| Component | Route / file | Responsibility |
|---|---|---|
| AddApplicationLink | in `src/app/page.tsx` (list page from [view-applications](../view-applications/ui-contract.md#component-decomposition)) | "Add application" button-styled link above the table, shown in both the Populated and Empty states |
| NewApplicationPage | `src/app/applications/new/page.tsx` (`/applications/new`) | Server component: calls `listProcessors`, renders the heading "Add application" and the form |
| NewApplicationForm | `src/components/NewApplicationForm.tsx` (`"use client"`) | Five labelled fields, Save and Cancel, per-field error messages, pending state |

Fields, in order: Business name (text), Borrower name (text), Loan amount (number, step 1, min 1, "$" prefix label), Application date (date, default today), Assigned processor (select with a "Choose…" placeholder, then the processor names).

## State Machines

### New application form

| State | Renders | Events → next state |
|---|---|---|
| Editing | Empty form (date = today); Save enabled | `SUBMIT` → Submitting; `CANCEL` → navigates to `/` |
| Submitting | Save disabled, label "Saving…"; fields read-only | action returns `fieldErrors` → Invalid; action redirects → (leaves page to detail); action throws → Failed |
| Invalid | Form with submitted values kept; a message under each invalid field; focus moves to the first invalid field | `SUBMIT` → Submitting; `CANCEL` → `/` |
| Failed | Error boundary with the server error message | `RETRY` → Editing |

Guard: the browser's native `required` and `min` attributes may block obviously empty submits. Server validation is still authoritative, and every Invalid case must also be reachable with native validation bypassed.

## I/O Samples

**Happy path**: the user clicks "Add application", enters `Smith, Jones & Co "East"` / `Dana Ruiz` / `250000` / (keeps today, 10/13/2026) / `Ricardo Fuentes`, and clicks Save. The user lands on `/applications/APP-2026-1061`: the header shows `$250,000 · Ricardo Fuentes · Applied 10/13/2026 · 12 outstanding`, and all 12 checklist rows read Pending.

**Invalid**: the user leaves Borrower name blank and enters loan amount `12.5`, then clicks Save. The form stays, Business name keeps its value, "Borrower name is required" shows under Borrower name, and "Enter a whole dollar amount greater than 0" shows under Loan amount.

## Test Cases — UI

Cypress, with the fixture CSV reset per test (setup from [view-applications](../view-applications/ui-contract.md#test-cases--ui)); the clock is frozen with `cy.clock` where the default date matters.

- **Entry point**: the list page shows "Add application"; clicking it opens `/applications/new`. It is also present when the list is empty.
- **Dropdown**: it lists exactly the fixture's distinct processors, sorted.
- **Default date**: the date field defaults to today.
- **Happy path**: fill all fields, Save → URL `/applications/APP-<year>-<max+1>`; the header shows the entered values and "12 outstanding"; 12 Pending rows. Back on the list, the new row is present.
- **Special characters**: a business name with a comma and quotes displays exactly on the detail page.
- **Invalid**: submit with native validation disabled (`novalidate` toggled in the test) and blank names plus a bad amount → three messages, values kept, URL unchanged, fixture file byte-identical.
- **Cancel**: returns to `/`; the file is byte-identical.
- **Pending state**: Save is disabled while submitting (intercept the action with a delay).

## File Manifest — UI

| Group | File | Purpose |
|---|---|---|
| Entry | `src/app/page.tsx` | Add the "Add application" link |
| Page | `src/app/applications/new/page.tsx` | Loads processors; renders form |
| Form | `src/components/NewApplicationForm.tsx` | Client form with `useActionState` |
| Tests | `cypress/e2e/add-application.cy.ts` | — |

## Tasks — UI

### Task 1: New application page and form

Implements the [New application form](#new-application-form) machine: Editing, Submitting, Invalid and Failed. The form submits to the server action and renders the returned field errors in place.

- [ ] **Done**
- **Who**: UI.
- **What**: Build `/applications/new` and NewApplicationForm with the five fields, Save, Cancel, a pending state and per-field errors.
- **Why**: The form, dropdown, default-date, invalid-submission, redirect and cancel criteria in [Acceptance Criteria](add-application.md#acceptance-criteria).
- **When**: First UI task.
- **Where**: `src/app/applications/new/page.tsx`, `src/components/NewApplicationForm.tsx`.
- **How**: `useActionState(createApplicationAction)` and `useFormStatus` for the pending state; repopulate fields from the returned `values`.

### Task 2: Add application entry point

The [list page](../view-applications/ui-contract.md#applications-list-) has no way to create an application. This adds the AddApplicationLink in both its Populated and Empty states.

- [ ] **Done**
- **Who**: UI.
- **What**: Add an "Add application" link to `/applications/new` above the list.
- **Why**: The entry-point criterion in [Acceptance Criteria](add-application.md#acceptance-criteria).
- **When**: After Task 1.
- **Where**: `src/app/page.tsx`.
- **How**: A plain Next `Link`; no net-new logic.
