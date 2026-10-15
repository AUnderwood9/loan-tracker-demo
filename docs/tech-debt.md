# Tech Debt

Known issues in the loan tracker that aren't blockers. Each entry says what's wrong, where it lives, what it costs, and the proposed fix. Entries are listed by impact, highest first. Logged 2026-10-15; evidence was checked against the `develop` working tree that day.

Feature analyses live in `tickets/`; this file is for issues that outlive a single ticket.

| # | Issue | Area | Impact | Effort |
|---|---|---|---|---|
| 1 | Loader skipped on a fast row click | UI | Medium | Small |
| 2 | Acceptance tests can't catch wording changes | Tests | Medium | Small |
| 3 | Unparseable Applied dates sort last, untested | Backend | Low | Small |
| 4 | Invalid sort params fall back one at a time, URL not rewritten | Backend / UI | Low | Small |
| 5 | Build traces the whole project | Backend | Low | Small |
| 6 | Malformed-row line number can be too low | Backend | Low | Medium |
| 7 | Vitest config loads as CommonJS | Tooling | Low | Trivial |
| 8 | `server-only` mocked in every test file | Tests | Low | Trivial |
| 9 | Error page logs React error #419 | UI | Low | n/a |
| 10 | Ticket metadata names the wrong branch | Docs | Low | Trivial |
| 11 | Dev-only audit findings in ESLint tooling | Tooling | Low | Medium |

## 1. Loader skipped on a fast row click

- **What**: Clicking an application row before Next.js has prefetched the detail route (~100 ms after the links render) shows no loader. The list stays on screen until the server responds.
- **Where**: `src/components/ApplicationsTable.tsx:29` (the row `Link`). The Cypress loader specs wait for the prefetch before clicking, so they don't cover this case.
- **Cost**: Breaks the acceptance criterion that every loading transition shows a loader, for the fastest clicks.
- **Fix**: Add the `useLinkStatus` pending hint to the row link, reusing `src/components/SortPendingLoader.tsx`, which already does this for sort headers. Add a spec that clicks before the prefetch lands.

## 2. Acceptance tests can't catch wording changes

- **What**: Cypress specs take expected text from the same constants and helpers the app renders (`UI_TEXT`, `applicationCountLabel`, `documentCountLabel`): 17 references in `cypress/e2e/view-applications.cy.ts`.
- **Where**: `src/lib/ui/ui-text.ts`, and the specs that import it.
- **Cost**: If a constant changes, for example "No open applications to display" becoming "No applications", every test still passes, yet that text is a user-specified requirement.
- **Fix**: In the acceptance tests, assert user-specified strings as literals ("No open applications to display", "An error has occurred", "60 applications", "9 of 12"). Keep the constants for ids and routes.

## 3. Unparseable Applied dates sort last, untested

- **What**: An `application_date` that isn't `M/D/YYYY` (for example, after a spreadsheet re-save) sorts after every valid date, with ties broken by application ID.
- **Where**: `src/lib/applications/sort.ts:58` (`applicationDateKey`).
- **Cost**: The behaviour is reasonable, but no test locks it in and the user hasn't confirmed it.
- **Fix**: Confirm the rule, then add a test in `sort.test.ts`.

## 4. Invalid sort params fall back one at a time, URL not rewritten

- **What**: `?sort=business&dir=up` gives Business ascending, because each param falls back on its own. Invalid params render the default order, but the URL keeps the bad values.
- **Where**: `src/lib/applications/sort.ts` (`parseApplicationSort`); `src/app/page.tsx`.
- **Cost**: Marked ASSUMED in `tickets/view-applications/backend-contract.md` Unit 5 and never confirmed. A shared URL with bad params looks broken even though the page renders correctly.
- **Fix**: Confirm the fallback rule. Optionally redirect to the canonical URL; that would need a decision, because `redirect()` after streaming starts becomes a client-side redirect.

## 5. Build traces the whole project

- **What**: `next build` warns twice: "Dynamic filesystem access causes tracing of the whole project".
- **Where**: `src/lib/applications/csv-repository.ts:30` (`resolve(process.env[...])`) and `:54` (`readFile(path)`).
- **Cost**: Harmless for the local single-server runtime. A deployed or standalone build would bundle far more files than it needs.
- **Fix**: Resolve the data path in a way Turbopack can see statically, or mark the access as ignored for tracing. Check `node_modules/next/dist/docs/` for the Turbopack-supported way.

## 6. Malformed-row line number can be too low

- **What**: Papaparse reports a data-row index, not a file line, so `readRows` logs index + 2.
- **Where**: `src/lib/applications/csv-repository.ts:17` and `:76`.
- **Cost**: The logged line is too low when an earlier record contains a quoted newline or a skipped blank line. It only affects the server log.
- **Fix**: Track cursor offsets with papaparse's step callback, if exact lines ever matter. Logged in `tickets/view-applications/research-notes.md` Corrections.

## 7. Vitest config loads as CommonJS

- **What**: Every `npm test` run prints "ESM syntax in a file loaded as CommonJS".
- **Where**: `vitest.config.ts` (the package has no `"type": "module"`).
- **Cost**: Noise in test output.
- **Fix**: Rename it to `vitest.config.mts`, the same fix as `scripts/seed.mts`.

## 8. `server-only` mocked in every test file

- **What**: Each Vitest file repeats `vi.mock("server-only", () => ({}))`.
- **Where**: `src/lib/applications/queries.test.ts:32`, `checklist.test.ts:11`, `csv-repository.test.ts:20`, `sort.test.ts:13`.
- **Cost**: Repetition, and a new test file fails until someone remembers the line.
- **Fix**: Move the mock to a Vitest `setupFiles` entry. Don't switch Vitest to the `react-server` resolve condition, because that would also change which React build future component tests load.

## 9. Error page logs React error #419

- **What**: When the CSV is broken, the browser console logs React's recoverable error #419 before `error.tsx` renders. Users only see "An error has occurred".
- **Where**: The streamed error path (Q20 in `tickets/view-applications/research-notes.md`). The two error-state specs ignore that single error code (`cypress/e2e/view-applications.cy.ts:91`).
- **Cost**: Console noise. The test allow-list could hide a different #419 cause later.
- **Fix**: None needed while the page streams behind a loader. Revisit if the error path changes.

## 10. Ticket metadata names the wrong branch

- **What**: The Metadata `Branch` row says `main`, but work happens on `develop`.
- **Where**: `tickets/view-applications/view-applications.md:146`, `tickets/update-document-status/update-document-status.md:118`, `tickets/add-application/add-application.md:121`.
- **Cost**: Misleads anyone matching tickets to branches.
- **Fix**: Change the three rows to `develop`.

## 11. Dev-only audit findings in ESLint tooling

- **What**: `npm audit` reports 5 high-severity findings in `micromatch` through `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`. Production dependencies have 0 (`npm audit --omit=dev`).
- **Where**: `package.json` devDependencies.
- **Cost**: Lint tooling only; nothing ships to the browser or server runtime.
- **Fix**: Upgrade when `eslint-config-next` publishes a release that clears it. `npm audit fix --force` is a breaking downgrade, so don't use it.
