# loan-tracker-demo

A browser-based tracker for SBA loan document checklists. It replaces the shared spreadsheet a loan operations team uses to follow the up-to-12 documents each application needs. Its first job is answering the team's biggest question: which applications are still waiting on documents?

The data lives in a CSV file, one row per document per application. The app reads it on every request. There is no database.

## What V1 does

**Applications list** (`/`)

- One row per application: ID, business, borrower, loan amount (`$390,000.00`), assigned processor, application date, document count (`9 of 12`) and status.
- **Status** is worked out from the documents, never stored. An application is **Complete** when every one of the 12 document types is Approved or Not Required; otherwise it shows **N outstanding**. A document type with no row counts as outstanding.
- The total number of applications shows above the table.
- **Sorting** by Application, Business or Applied date. Click a header to sort ascending, and click it again for descending. Every sortable header shows ▲▼, with the active direction dark and the rest greyed out. Rows that tie are ordered by application ID.
- **Pagination**, 10 per page, with ‹ Previous, "Page N of M" and Next ›. The arrows are disabled at either end, and changing the sort returns to page 1.
- Sorting and paging live in the URL, so a view can be reloaded or shared: `/?sort=applied&dir=desc&page=2`. Invalid or empty values fall back to the defaults (Application ascending, page 1) and never show an error. A page past the end shows the last page.

**Application detail** (`/applications/<id>`)

- The application's details and all 12 document types in alphabetical order, each with its status, date received, expiration date and notes.
- A type with no row shows **Not on checklist**; a row with a blank status shows **Not Started**. Both count as outstanding.
- An unknown ID shows "Application not found".

**Everywhere**

- A loader shows during page loads, sorting, paging and navigation.
- An empty CSV shows "No open applications to display". An unreadable or malformed CSV (missing file, wrong header, bad row) shows "An error has occurred", and the cause is logged on the server.
- Viewing never modifies the CSV.

**Not in V1**: changing document statuses and adding applications. Both have draft analyses under `tickets/`, but they're on hold pending presentation refinements and clarification of some data points. The analyses for every feature are in `tickets/`.

## Requirements

- Node.js 24 (developed on 24.14) and npm.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Seed the live data file. This copies the sample in `docs/NEWITY_Sample_Data_A_Document_Checklist.csv` to `data/applications.csv`, which is gitignored, so edits to it never show up in git:

   ```bash
   npm run seed           # refuses to overwrite an existing data file
   npm run seed -- --force   # resets data/applications.csv to the sample
   ```

To point the app at a different file, set `DATA_CSV_PATH` (the default is `data/applications.csv`).

### CSV format

The file must have exactly these 11 columns, in this order:

```
application_id,business_name,borrower_name,loan_amount,application_date,assigned_processor,document_type,document_status,date_received,expiration_date,notes
```

- Dates are `M/D/YYYY`, for example `1/28/2026`.
- Document statuses are Pending, Received, Under Review, Approved, Expired and Not Required.
- The six application columns repeat on every document row of that application.

## Running

```bash
npm run dev              # development server at http://localhost:3000
npm run build && npm start   # production build
```

The app is built to run as a single long-lived Node server with a writable disk. It is not suitable for serverless hosting such as Vercel, where the CSV can't be read and written reliably.

## Testing

| Command | What it runs |
|---|---|
| `npm test` | Vitest unit tests for the data layer: CSV reading, status derivation, queries, sorting, pagination |
| `npm run test:e2e` | A production build, then every Cypress browser test against it on port 3100 |
| `npm run cypress:open` | The same, in the interactive Cypress runner |
| `npm run lint` | ESLint |
| `npm run typecheck` | Next.js route types, then TypeScript for the app and the Cypress project |

- **Test data:** the browser tests run against their own copy of the data at `cypress/.tmp/applications.csv`, which they reset before each test. They never touch `data/`.
- **The sample CSV:** many unit and browser tests use `docs/NEWITY_Sample_Data_A_Document_Checklist.csv` as their fixture. Don't edit it; change `data/applications.csv` instead.

## Project layout

```
src/app/                    pages: list (/), detail (/applications/[id]), loading, error and not-found states
src/components/             table, checklist, sort header, pagination and loader components
src/lib/applications/       data layer: CSV repository, checklist and status derivation, queries, sorting, pagination
src/lib/ui/                 display text, element ids, routes and formatting shared by the app and its tests
cypress/                    browser tests, CSV builders and fixture tasks
scripts/seed.mts            copies the sample CSV into data/
tickets/                    feature analyses: decisions, contracts, acceptance criteria
docs/                       stakeholder brief, sample data, tech debt log
```

This project uses Next.js 16 with Cache Components enabled. Its APIs differ from older versions; see `AGENTS.md` and the guides in `node_modules/next/dist/docs/` before changing framework code.


## Known limitations

- No sign-in. It assumes a trusted local network.
- A CSV error is shown with HTTP status 200, not 500, because the page has already started loading behind its loader.
- "Expired" is whatever the CSV says. Nothing recomputes it from the expiration date.
