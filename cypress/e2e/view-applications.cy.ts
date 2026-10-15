import {
  DOCUMENT_TYPES,
  DocumentStatus,
  DocumentType,
  NOT_ON_CHECKLIST_LABEL,
  NOT_STARTED_LABEL,
} from "../../src/lib/applications/constants";
import { SortColumn, SortDirection } from "../../src/lib/applications/sort";
import {
  APPLICATION_COLUMN_LABELS,
  ApplicationColumn,
  ApplicationField,
  ChecklistColumn,
  SORTABLE_COLUMNS,
} from "../../src/lib/ui/columns";
import {
  ELEMENT_IDS,
  SortArrowState,
  applicationCellId,
  applicationFieldId,
  applicationHeaderId,
  applicationRowId,
  checklistCellId,
  sortArrowId,
  sortIndicatorId,
  sortLinkId,
} from "../../src/lib/ui/element-ids";
import { ROUTES } from "../../src/lib/ui/routes";
import {
  UI_TEXT,
  applicationCountLabel,
  documentCountLabel,
  outstandingLabel,
} from "../../src/lib/ui/ui-text";
import {
  buildBadHeaderCsv,
  buildHeaderOnlyCsv,
  buildRow,
  buildRowsForAllTypes,
  toCsv,
  type CsvRow,
} from "../builders/csv-builder";

const SAMPLE_APPLICATION_COUNT = 60;
const PAGE_SIZE = 10;
const SAMPLE_PAGE_COUNT = 6;
const SAMPLE_LAST_APPLICATION_ID = "APP-2026-1060";
const SAMPLE_FIRST_APPLICATION_ID = "APP-2026-1001";
const SAMPLE_FIRST_APPLICATION_DOCUMENT_COUNT = 9;
const SAMPLE_FULL_CHECKLIST_APPLICATION_ID = "APP-2026-1007";
const UNKNOWN_APPLICATION_ID = "APP-2026-9999";
const BUILDER_APPLICATION_ID = "APP-2026-9001";
const RSC_REQUEST_HEADER = "rsc";
const PREFETCH_REQUEST_HEADER = "next-router-prefetch";
const SERVER_DELAY_MS = 1500;

const byId = (id: string) => `#${id}`;
const applicationRows = () => cy.get(`${byId(ELEMENT_IDS.applicationsTable)} tbody tr`);
const paginationPrevious = () => cy.get(byId(ELEMENT_IDS.paginationPrevious));
const paginationNext = () => cy.get(byId(ELEMENT_IDS.paginationNext));
const paginationStatus = () => cy.get(byId(ELEMENT_IDS.paginationStatus));
const checklistRows = () => cy.get(`${byId(ELEMENT_IDS.checklistTable)} tbody tr`);
const applicationCell = (applicationId: string, column: ApplicationColumn) =>
  cy.get(byId(applicationCellId(applicationId, column)));
const checklistCell = (documentType: string, column: ChecklistColumn) =>
  cy.get(byId(checklistCellId(documentType, column)));

const ALPHABETICAL_DOCUMENT_TYPES = [...DOCUMENT_TYPES].sort((a, b) => a.localeCompare(b));

const SEGMENT_PREFETCH_HEADER = "next-router-segment-prefetch";
const ROUTE_TREE_SEGMENT = "/_tree";
const SHELL_PREFETCH_ALIAS = "shellPrefetch";
// One App Shell serves every /applications/<id> link, so it arrives on whichever link's URL.
const DETAIL_PATHNAME_PATTERN = /^\/applications\/[^/]+$/;

// loading.tsx ships in the route's prefetched App Shell. A click before that prefetch lands
// shows no loader (research-notes.md Corrections), so the loader tests click after it.
function aliasShellPrefetch(pathname: string | RegExp): void {
  cy.intercept({ method: "GET", pathname, headers: { [PREFETCH_REQUEST_HEADER]: "1" } }, (req) => {
    const segment = req.headers[SEGMENT_PREFETCH_HEADER];
    if (segment && segment !== ROUTE_TREE_SEGMENT) {
      req.alias = SHELL_PREFETCH_ALIAS;
    }
  });
}

function delayNavigationResponse(pathname: string, query?: Record<string, string>): void {
  const matcher = { method: "GET", pathname, headers: { [RSC_REQUEST_HEADER]: "1" } };
  cy.intercept(query ? { ...matcher, query } : matcher, (req) => {
    if (req.headers[PREFETCH_REQUEST_HEADER]) {
      return;
    }
    req.on("response", (res) => {
      res.setDelay(SERVER_DELAY_MS);
    });
  });
}

// React reports a Server Component error thrown inside a streamed Suspense boundary as
// recoverable error 419 before error.tsx renders (Q20). Any other uncaught error still fails.
const STREAMED_SERVER_ERROR = "react.dev/errors/419";

function allowStreamedServerError(): void {
  cy.on("uncaught:exception", (error) => !error.message.includes(STREAMED_SERVER_ERROR));
}

function expectChecklistOrder(): void {
  checklistRows().should("have.length", DOCUMENT_TYPES.length);
  cy.get(`${byId(ELEMENT_IDS.checklistTable)} tbody tr td:first-child`).then(($cells) => {
    expect([...$cells].map((cell) => cell.textContent)).to.deep.equal(ALPHABETICAL_DOCUMENT_TYPES);
  });
}

describe("Acceptance tests (user-specified)", () => {
  it("1. reads the CSV: the list renders application rows from the file", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.applications);

    applicationRows().first().should("have.id", applicationRowId(SAMPLE_FIRST_APPLICATION_ID));
    const id = SAMPLE_FIRST_APPLICATION_ID;
    applicationCell(id, ApplicationColumn.ApplicationId).should("have.text", id);
    applicationCell(id, ApplicationColumn.BusinessName).should("have.text", "Metro Dental Group");
    applicationCell(id, ApplicationColumn.BorrowerName).should("have.text", "Elena Williams");
    applicationCell(id, ApplicationColumn.LoanAmount).should("have.text", "$390,000.00");
    applicationCell(id, ApplicationColumn.AssignedProcessor).should("have.text", "Aisha Patel");
    applicationCell(id, ApplicationColumn.ApplicationDate).should("have.text", "12/1/2025");
  });

  it("2. counts the total number of applications", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.applicationCount)).should(
      "have.text",
      applicationCountLabel(SAMPLE_APPLICATION_COUNT),
    );
    applicationRows().should("have.length", PAGE_SIZE);

    const seenRowIds: string[] = [];
    for (let page = 1; page <= SAMPLE_PAGE_COUNT; page++) {
      cy.visit(`/?page=${page}`);
      paginationStatus().should("have.text", `Page ${page} of 6`);
      applicationRows().each(($row) => {
        seenRowIds.push($row.attr("id") ?? "");
      });
    }
    cy.wrap(seenRowIds).should("have.length", SAMPLE_APPLICATION_COUNT);
    cy.wrap(seenRowIds).should(($ids) => {
      expect(new Set($ids).size).to.equal(SAMPLE_APPLICATION_COUNT);
    });
  });

  it("3. counts the documents for each application", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.applications);

    applicationCell(SAMPLE_FIRST_APPLICATION_ID, ApplicationColumn.Documents).should(
      "have.text",
      documentCountLabel(SAMPLE_FIRST_APPLICATION_DOCUMENT_COUNT),
    );
    applicationCell(SAMPLE_FULL_CHECKLIST_APPLICATION_ID, ApplicationColumn.Documents).should(
      "have.text",
      documentCountLabel(DOCUMENT_TYPES.length),
    );
  });

  it("4. shows the status of every document under an application", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.application(SAMPLE_FIRST_APPLICATION_ID));

    expectChecklistOrder();
    checklistCell(DocumentType.OwnershipVerification, ChecklistColumn.Status).should(
      "have.text",
      DocumentStatus.Approved,
    );
    checklistCell(DocumentType.BankStatements90Day, ChecklistColumn.Status).should(
      "have.text",
      DocumentStatus.UnderReview,
    );
    checklistCell(DocumentType.LeaseAgreement, ChecklistColumn.Status).should(
      "have.text",
      DocumentStatus.Pending,
    );
  });

  it("5. still lists an application that is missing documents", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.applications);
    cy.get(byId(applicationRowId(SAMPLE_FIRST_APPLICATION_ID))).should("be.visible");

    cy.visit(ROUTES.application(SAMPLE_FIRST_APPLICATION_ID));
    for (const documentType of [
      DocumentType.DebtSchedule,
      DocumentType.SbaForm1919,
      DocumentType.SbaForm912,
    ]) {
      checklistCell(documentType, ChecklistColumn.Status).should(
        "have.text",
        NOT_ON_CHECKLIST_LABEL,
      );
    }
  });

  it("6. shows Not Started for a document without a status and counts it as outstanding", () => {
    const rows = buildRowsForAllTypes(DocumentStatus.Approved).map((row) =>
      row.documentType === DocumentType.LeaseAgreement ? { ...row, documentStatus: "" } : row,
    );
    cy.useCsv(toCsv(rows));
    cy.visit(ROUTES.application(BUILDER_APPLICATION_ID));

    checklistCell(DocumentType.LeaseAgreement, ChecklistColumn.Status).should(
      "have.text",
      NOT_STARTED_LABEL,
    );
    cy.get(byId(applicationFieldId(ApplicationField.Status))).should(
      "have.text",
      outstandingLabel(1),
    );
  });

  it("7. shows No open applications to display when there are no applications", () => {
    cy.useCsv(buildHeaderOnlyCsv());
    cy.visit(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.applicationsEmpty)).should("have.text", UI_TEXT.emptyApplications);
    cy.get(byId(ELEMENT_IDS.applicationsTable)).should("not.exist");
    cy.get(byId(ELEMENT_IDS.applicationCount)).should("not.exist");
  });
});

// Literals on purpose: the URL and the arrows are part of the user-visible contract.
const SORT_SEARCH: Record<SortColumn, Record<SortDirection, string>> = {
  [SortColumn.Application]: {
    [SortDirection.Asc]: "?sort=application&dir=asc",
    [SortDirection.Desc]: "?sort=application&dir=desc",
  },
  [SortColumn.Business]: {
    [SortDirection.Asc]: "?sort=business&dir=asc",
    [SortDirection.Desc]: "?sort=business&dir=desc",
  },
  [SortColumn.Applied]: {
    [SortDirection.Asc]: "?sort=applied&dir=asc",
    [SortDirection.Desc]: "?sort=applied&dir=desc",
  },
};
const SORT_INDICATOR: Record<SortDirection, string> = {
  [SortDirection.Asc]: "▲",
  [SortDirection.Desc]: "▼",
};
const ARIA_SORT: Record<SortDirection, string> = {
  [SortDirection.Asc]: "ascending",
  [SortDirection.Desc]: "descending",
};
const ARIA_SORT_NONE = "none";

const SORT_COLUMN_HEADERS: Record<SortColumn, ApplicationColumn> = {
  [SortColumn.Application]: ApplicationColumn.ApplicationId,
  [SortColumn.Business]: ApplicationColumn.BusinessName,
  [SortColumn.Applied]: ApplicationColumn.ApplicationDate,
};
const NON_SORTABLE_COLUMNS = [
  ApplicationColumn.BorrowerName,
  ApplicationColumn.LoanAmount,
  ApplicationColumn.AssignedProcessor,
  ApplicationColumn.Documents,
  ApplicationColumn.Status,
];

interface ExpectedOrder {
  first: string[];
  last: string[];
}

// backend-contract.md I/O Samples, "Unit 5 — order against the sample".
const SAMPLE_SORT_ORDER: Record<SortColumn, Record<SortDirection, ExpectedOrder>> = {
  [SortColumn.Application]: {
    [SortDirection.Asc]: { first: ["APP-2026-1001"], last: ["APP-2026-1060"] },
    [SortDirection.Desc]: { first: ["APP-2026-1060"], last: ["APP-2026-1001"] },
  },
  [SortColumn.Business]: {
    [SortDirection.Asc]: { first: ["APP-2026-1014", "APP-2026-1059"], last: ["APP-2026-1012"] },
    [SortDirection.Desc]: { first: ["APP-2026-1012", "APP-2026-1038"], last: ["APP-2026-1014"] },
  },
  [SortColumn.Applied]: {
    [SortDirection.Asc]: {
      first: ["APP-2026-1049", "APP-2026-1056", "APP-2026-1014"],
      last: ["APP-2026-1030"],
    },
    [SortDirection.Desc]: {
      first: ["APP-2026-1030", "APP-2026-1011", "APP-2026-1042"],
      last: ["APP-2026-1049", "APP-2026-1056"],
    },
  },
};

const sortLink = (column: SortColumn) => cy.get(byId(sortLinkId(column)));
const sortHeader = (column: SortColumn) =>
  cy.get(byId(applicationHeaderId(SORT_COLUMN_HEADERS[column])));

const BOTH_SORT_INDICATORS = `${SORT_INDICATOR[SortDirection.Asc]}${SORT_INDICATOR[SortDirection.Desc]}`;

const sortArrow = (column: SortColumn, direction: SortDirection) =>
  cy.get(byId(sortArrowId(column, direction)));

function expectArrowState(column: SortColumn, direction: SortDirection, state: SortArrowState): void {
  sortArrow(column, direction)
    .should("have.text", SORT_INDICATOR[direction])
    .and("have.attr", "data-state", state);
}

// Arrow states per the "Sortable columns (/)" table (Q33). The active arrow is checked first:
// it comes from the server render, so it also proves the new table has arrived.
function expectSortIndicator(column: SortColumn, direction: SortDirection): void {
  expectArrowState(column, direction, SortArrowState.Active);
  sortHeader(column).should("have.attr", "aria-sort", ARIA_SORT[direction]);
  for (const sortColumn of Object.values(SortColumn)) {
    for (const arrowDirection of Object.values(SortDirection)) {
      if (sortColumn !== column || arrowDirection !== direction) {
        expectArrowState(sortColumn, arrowDirection, SortArrowState.Inactive);
      }
    }
    if (sortColumn !== column) {
      sortHeader(sortColumn).should("have.attr", "aria-sort", ARIA_SORT_NONE);
    }
  }
}

function expectSampleOrder(column: SortColumn, direction: SortDirection): void {
  const { first } = SAMPLE_SORT_ORDER[column][direction];
  paginationStatus().should("have.text", "Page 1 of 6");
  applicationRows().should("have.length", PAGE_SIZE);
  applicationRows().then(($rows) => {
    const ids = [...$rows].map((row) => row.id);
    expect(ids.slice(0, first.length)).to.deep.equal(first.map(applicationRowId));
  });
}

// The last rows of a sort are on the last page since pagination (Q32).
function expectSampleOrderEnd(column: SortColumn, direction: SortDirection): void {
  const { last } = SAMPLE_SORT_ORDER[column][direction];
  cy.visit(`${ROUTES.applications}${SORT_SEARCH[column][direction]}&page=6`);
  paginationStatus().should("have.text", "Page 6 of 6");
  applicationRows().then(($rows) => {
    const ids = [...$rows].map((row) => row.id);
    expect(ids.slice(-last.length)).to.deep.equal(last.map(applicationRowId));
  });
}

function expectSortedUrl(column: SortColumn, direction: SortDirection): void {
  cy.location("pathname").should("eq", ROUTES.applications);
  cy.location("search").should("eq", SORT_SEARCH[column][direction]);
}

function expectSortedPage(column: SortColumn, direction: SortDirection): void {
  expectSortedUrl(column, direction);
  expectSortIndicator(column, direction);
  expectSampleOrder(column, direction);
}

function expectDefaultSortedPage(): void {
  expectSortIndicator(SortColumn.Application, SortDirection.Asc);
  expectSampleOrder(SortColumn.Application, SortDirection.Asc);
}

describe("Acceptance tests — sorting (user-specified)", () => {
  beforeEach(() => {
    cy.useSampleCsv();
  });

  it("S1. sorts by each column ascending", () => {
    cy.visit(ROUTES.applications);
    sortLink(SortColumn.Application).click();
    expectSortedPage(SortColumn.Application, SortDirection.Desc);
    expectSampleOrderEnd(SortColumn.Application, SortDirection.Desc);
    sortLink(SortColumn.Application).click();
    expectSortedPage(SortColumn.Application, SortDirection.Asc);
    expectSampleOrderEnd(SortColumn.Application, SortDirection.Asc);

    for (const column of [SortColumn.Business, SortColumn.Applied]) {
      cy.visit(ROUTES.applications);
      sortLink(column).click();
      expectSortedPage(column, SortDirection.Asc);
      expectSampleOrderEnd(column, SortDirection.Asc);
    }
  });

  it("S2. sorts by each column descending when the active header is clicked again", () => {
    cy.visit(ROUTES.applications);
    sortLink(SortColumn.Application).click();
    expectSortedPage(SortColumn.Application, SortDirection.Desc);
    expectSampleOrderEnd(SortColumn.Application, SortDirection.Desc);

    for (const column of [SortColumn.Business, SortColumn.Applied]) {
      cy.visit(ROUTES.applications);
      sortLink(column).click();
      expectSortIndicator(column, SortDirection.Asc);
      sortLink(column).click();
      expectSortedPage(column, SortDirection.Desc);
      expectSampleOrderEnd(column, SortDirection.Desc);
    }
  });

  it("S3. keeps the total and the row count unchanged for every sort", () => {
    const sorts: [SortColumn, SortDirection][] = [
      [SortColumn.Application, SortDirection.Desc],
      [SortColumn.Application, SortDirection.Asc],
      [SortColumn.Business, SortDirection.Asc],
      [SortColumn.Business, SortDirection.Desc],
      [SortColumn.Applied, SortDirection.Asc],
      [SortColumn.Applied, SortDirection.Desc],
    ];
    cy.visit(ROUTES.applications);

    for (const [column, direction] of sorts) {
      sortLink(column).click();
      expectSortedUrl(column, direction);
      expectSortIndicator(column, direction);
      cy.get(byId(ELEMENT_IDS.applicationCount)).should(
        "have.text",
        applicationCountLabel(SAMPLE_APPLICATION_COUNT),
      );
      paginationStatus().should("have.text", "Page 1 of 6");
      applicationRows().should("have.length", PAGE_SIZE);
    }
  });

  it("S4. falls back to the default order for invalid sort and dir values", () => {
    for (const path of ["/?sort=status&dir=up", "/?sort=Business"]) {
      cy.visit(path);
      expectDefaultSortedPage();
    }
  });

  it("S5. falls back to the default order for empty or missing sort and dir values", () => {
    for (const path of ["/?sort=&dir=", ROUTES.applications]) {
      cy.visit(path);
      expectDefaultSortedPage();
    }
  });
});

describe("Acceptance tests — sort arrows", () => {
  beforeEach(() => {
    cy.useSampleCsv();
  });

  it("A1. shows both arrows on every sortable header", () => {
    for (const path of ["/", "/?sort=business&dir=asc", "/?sort=applied&dir=desc&page=3"]) {
      cy.visit(path);
      for (const column of Object.values(SortColumn)) {
        cy.get(byId(sortIndicatorId(column))).should("have.text", BOTH_SORT_INDICATORS);
        for (const direction of Object.values(SortDirection)) {
          sortArrow(column, direction).should("have.text", SORT_INDICATOR[direction]);
        }
      }
    }
  });

  it("A2. marks the current direction active on the sorted column", () => {
    cy.visit("/?sort=business&dir=asc");

    expectArrowState(SortColumn.Business, SortDirection.Asc, SortArrowState.Active);
    expectArrowState(SortColumn.Business, SortDirection.Desc, SortArrowState.Inactive);
  });

  it("A3. greys out both arrows on unsorted sortable columns", () => {
    cy.visit("/?sort=business&dir=asc");

    for (const column of [SortColumn.Application, SortColumn.Applied]) {
      for (const direction of Object.values(SortDirection)) {
        expectArrowState(column, direction, SortArrowState.Inactive);
      }
    }
  });

  it("A4. flips the active arrow when the sorted column is toggled", () => {
    cy.visit("/?sort=business&dir=asc");
    expectArrowState(SortColumn.Business, SortDirection.Asc, SortArrowState.Active);

    sortLink(SortColumn.Business).click();

    expectSortedUrl(SortColumn.Business, SortDirection.Desc);
    expectArrowState(SortColumn.Business, SortDirection.Desc, SortArrowState.Active);
    expectArrowState(SortColumn.Business, SortDirection.Asc, SortArrowState.Inactive);
  });

  it("A5. lights Application ascending for the default sort", () => {
    for (const path of ["/", "/?sort=&dir=", "/?sort=status&dir=up"]) {
      cy.visit(path);
      expectSortIndicator(SortColumn.Application, SortDirection.Asc);
    }
  });

  it("A6. shows no arrows on non-sortable headers", () => {
    cy.visit(ROUTES.applications);
    cy.get(byId(sortIndicatorId(SortColumn.Application))).should("exist");

    for (const column of NON_SORTABLE_COLUMNS) {
      const header = () => cy.get(byId(applicationHeaderId(column)));
      header().invoke("text").should("not.match", /[▲▼]/);
      header().find('[id^="sort-arrow-"]').should("not.exist");
    }
  });

  it("A7. renders a greyed-out arrow in a different colour from an active one", () => {
    cy.visit(ROUTES.applications);
    expectArrowState(SortColumn.Application, SortDirection.Asc, SortArrowState.Active);

    sortArrow(SortColumn.Application, SortDirection.Asc)
      .invoke("css", "color")
      .then((activeColor) => {
        sortArrow(SortColumn.Application, SortDirection.Desc)
          .invoke("css", "color")
          .should("not.equal", activeColor);
      });
  });
});

describe("Sorting", () => {
  beforeEach(() => {
    cy.useSampleCsv();
  });

  it("shows Loading applications… while a sort is pending", () => {
    cy.visit(ROUTES.applications);
    applicationRows().should("have.length", PAGE_SIZE);
    delayNavigationResponse(ROUTES.applications, {
      sort: SortColumn.Business,
      dir: SortDirection.Asc,
    });

    sortLink(SortColumn.Business).click();

    cy.get(byId(ELEMENT_IDS.pageLoader))
      .should("be.visible")
      .and("contain.text", UI_TEXT.loadingApplications);
    expectSortedPage(SortColumn.Business, SortDirection.Asc);
    cy.get(byId(ELEMENT_IDS.pageLoader)).should("not.exist");
    expectSampleOrderEnd(SortColumn.Business, SortDirection.Asc);
  });

  it("keeps the Borrower, Loan amount, Processor, Documents and Status headers as plain text", () => {
    cy.visit(ROUTES.applications);

    for (const column of NON_SORTABLE_COLUMNS) {
      const header = () => cy.get(byId(applicationHeaderId(column)));
      header().should("have.text", APPLICATION_COLUMN_LABELS[column]);
      header().should("not.have.attr", "aria-sort");
      header().find("a").should("not.exist");
    }
  });

  it("keeps the sort after a reload", () => {
    cy.visit(ROUTES.applications);
    sortLink(SortColumn.Applied).click();
    expectSortIndicator(SortColumn.Applied, SortDirection.Asc);
    sortLink(SortColumn.Applied).click();
    expectSortedPage(SortColumn.Applied, SortDirection.Desc);

    cy.reload();

    expectSortedPage(SortColumn.Applied, SortDirection.Desc);
    expectSampleOrderEnd(SortColumn.Applied, SortDirection.Desc);
  });
});

const PARTIAL_FIXTURE_APPLICATION_COUNT = 23;
const PARTIAL_FIXTURE_LAST_PAGE_ROWS = 3;
const SINGLE_PAGE_FIXTURE_APPLICATION_COUNT = 7;
const FIRST_BUILDER_APPLICATION_NUMBER = 9001;
// The 11th application in Applied descending order (backend-contract.md, Unit 5 order).
const APPLIED_DESC_ELEVENTH_ID = "APP-2026-1055";

// One application per ID, APP-2026-9001 upwards, so the fixture's page count is predictable.
function buildApplicationsCsv(count: number): string {
  return toCsv(
    Array.from({ length: count }, (_, index) =>
      buildRow({ applicationId: `APP-2026-${FIRST_BUILDER_APPLICATION_NUMBER + index}` }),
    ),
  );
}

// An enabled arrow is a link; a disabled one is a real disabled button.
function expectArrowEnabled(arrow: Cypress.Chainable<JQuery<HTMLElement>>): void {
  arrow.should("match", "a").and("have.attr", "href");
}

function expectArrowDisabled(arrow: Cypress.Chainable<JQuery<HTMLElement>>): void {
  arrow.should("match", "button").and("be.disabled");
}

function expectPageRows(firstId: string, lastId: string, length = PAGE_SIZE): void {
  applicationRows().should("have.length", length);
  applicationRows().first().should("have.id", applicationRowId(firstId));
  applicationRows().last().should("have.id", applicationRowId(lastId));
}

function expectFirstPageOfSample(): void {
  paginationStatus().should("have.text", "Page 1 of 6");
  applicationRows().should("have.length", PAGE_SIZE);
  applicationRows().first().should("have.id", applicationRowId(SAMPLE_FIRST_APPLICATION_ID));
}

describe("Acceptance tests — pagination (user-specified)", () => {
  beforeEach(() => {
    cy.useSampleCsv();
  });

  it("P1. paginates to the end of the list", () => {
    cy.visit(ROUTES.applications);
    paginationStatus().should("have.text", "Page 1 of 6");
    applicationRows().should("have.length", PAGE_SIZE);

    for (let page = 2; page <= SAMPLE_PAGE_COUNT; page++) {
      paginationNext().click();
      paginationStatus().should("have.text", `Page ${page} of 6`);
      applicationRows().should("have.length", PAGE_SIZE);
    }

    expectArrowDisabled(paginationNext());
    applicationRows().last().should("have.id", applicationRowId(SAMPLE_LAST_APPLICATION_ID));
    cy.location("search").should("match", /page=6$/);

    cy.useCsv(buildApplicationsCsv(PARTIAL_FIXTURE_APPLICATION_COUNT));
    cy.visit(ROUTES.applications);
    paginationNext().click();
    paginationStatus().should("have.text", "Page 2 of 3");
    paginationNext().click();
    paginationStatus().should("have.text", "Page 3 of 3");
    applicationRows().should("have.length", PARTIAL_FIXTURE_LAST_PAGE_ROWS);
    expectArrowDisabled(paginationNext());
  });

  it("P2. can't paginate before page 1", () => {
    cy.visit(ROUTES.applications);
    expectArrowDisabled(paginationPrevious());
    paginationPrevious().click({ force: true });
    cy.location("search").should("eq", "");
    expectFirstPageOfSample();

    for (const path of ["/?page=0", "/?page=-1"]) {
      cy.visit(path);
      expectFirstPageOfSample();
    }
  });

  it("P3. disables the arrows at the ends", () => {
    cy.visit(ROUTES.applications);
    expectArrowDisabled(paginationPrevious());
    expectArrowEnabled(paginationNext());

    cy.visit("/?page=3");
    paginationStatus().should("have.text", "Page 3 of 6");
    expectArrowEnabled(paginationPrevious());
    expectArrowEnabled(paginationNext());

    cy.visit("/?page=6");
    paginationStatus().should("have.text", "Page 6 of 6");
    expectArrowEnabled(paginationPrevious());
    expectArrowDisabled(paginationNext());

    cy.useCsv(buildApplicationsCsv(SINGLE_PAGE_FIXTURE_APPLICATION_COUNT));
    cy.visit(ROUTES.applications);
    paginationStatus().should("have.text", "Page 1 of 1");
    applicationRows().should("have.length", SINGLE_PAGE_FIXTURE_APPLICATION_COUNT);
    expectArrowDisabled(paginationPrevious());
    expectArrowDisabled(paginationNext());
  });

  it("P4. shows the requested page for valid page values", () => {
    cy.visit("/?page=2");
    paginationStatus().should("have.text", "Page 2 of 6");
    expectPageRows("APP-2026-1011", "APP-2026-1020");

    cy.visit("/?page=99");
    paginationStatus().should("have.text", "Page 6 of 6");
    expectPageRows("APP-2026-1051", SAMPLE_LAST_APPLICATION_ID);

    cy.visit("/?sort=business&dir=asc&page=2");
    paginationStatus().should("have.text", "Page 2 of 6");
    expectPageRows("APP-2026-1032", "APP-2026-1036");
    expectSortIndicator(SortColumn.Business, SortDirection.Asc);
  });

  it("P5. shows page 1 for empty page values", () => {
    for (const path of ["/?page=", ROUTES.applications]) {
      cy.visit(path);
      expectFirstPageOfSample();
    }
  });

  it("P6. shows page 1 for invalid page values", () => {
    for (const path of ["/?page=abc", "/?page=2.5", "/?page=02"]) {
      cy.visit(path);
      expectFirstPageOfSample();
      cy.get(byId(ELEMENT_IDS.pageError)).should("not.exist");
    }
  });
});

describe("Pagination", () => {
  beforeEach(() => {
    cy.useSampleCsv();
  });

  it("shows Loading applications… while the next page is pending", () => {
    cy.visit(ROUTES.applications);
    paginationStatus().should("have.text", "Page 1 of 6");
    delayNavigationResponse(ROUTES.applications, { page: "2" });

    paginationNext().click();

    cy.get(byId(ELEMENT_IDS.pageLoader))
      .should("be.visible")
      .and("contain.text", UI_TEXT.loadingApplications);
    paginationStatus().should("have.text", "Page 2 of 6");
    cy.get(byId(ELEMENT_IDS.pageLoader)).should("not.exist");
  });

  it("returns to page 1 when the sort changes", () => {
    cy.visit("/?page=3");
    paginationStatus().should("have.text", "Page 3 of 6");

    sortLink(SortColumn.Business).click();

    cy.location("search").should("eq", "?sort=business&dir=asc");
    expectSortIndicator(SortColumn.Business, SortDirection.Asc);
    paginationStatus().should("have.text", "Page 1 of 6");
  });

  it("keeps the sort when an arrow is clicked", () => {
    cy.visit("/?sort=applied&dir=desc");
    paginationStatus().should("have.text", "Page 1 of 6");

    paginationNext().click();

    cy.location("search").should("eq", "?sort=applied&dir=desc&page=2");
    paginationStatus().should("have.text", "Page 2 of 6");
    applicationRows().first().should("have.id", applicationRowId(APPLIED_DESC_ELEVENTH_ID));
    expectSortIndicator(SortColumn.Applied, SortDirection.Desc);
  });

  it("shows the total of all applications on every page", () => {
    cy.visit(ROUTES.applications);

    for (let page = 1; page <= SAMPLE_PAGE_COUNT; page++) {
      paginationStatus().should("have.text", `Page ${page} of 6`);
      cy.get(byId(ELEMENT_IDS.applicationCount)).should(
        "have.text",
        applicationCountLabel(SAMPLE_APPLICATION_COUNT),
      );
      if (page < SAMPLE_PAGE_COUNT) {
        paginationNext().click();
      }
    }
  });

  it("shows no pagination controls when there are no applications", () => {
    cy.useCsv(buildHeaderOnlyCsv());
    cy.visit(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.applicationsEmpty)).should("be.visible");
    cy.get(byId(ELEMENT_IDS.paginationControls)).should("not.exist");
  });
});

describe("Applications list", () => {
  const firstId = "APP-2026-9001";
  const secondId = "APP-2026-9002";
  const thirdId = "APP-2026-9003";

  function buildInterleavedRows(): CsvRow[] {
    const complete = buildRowsForAllTypes(DocumentStatus.Approved, { applicationId: firstId });
    const partial = DOCUMENT_TYPES.slice(0, 9).map((documentType, index) =>
      buildRow({
        applicationId: secondId,
        documentType,
        documentStatus: index < 2 ? DocumentStatus.Approved : DocumentStatus.Pending,
      }),
    );
    const single = [buildRow({ applicationId: thirdId })];
    const groups = [single, partial, complete];
    const longest = Math.max(...groups.map((group) => group.length));
    return Array.from({ length: longest }, (_, index) =>
      groups.flatMap((group) => (group[index] ? [group[index]] : [])),
    ).flat();
  }

  it("groups interleaved rows into one row per application, in ID order, with all columns", () => {
    cy.useCsv(toCsv(buildInterleavedRows()));
    cy.visit(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.applicationCount)).should("have.text", applicationCountLabel(3));
    applicationRows().should("have.length", 3);
    applicationRows().then(($rows) => {
      expect([...$rows].map((row) => row.id)).to.deep.equal(
        [firstId, secondId, thirdId].map(applicationRowId),
      );
    });
    cy.get(`${byId(ELEMENT_IDS.applicationsTable)} thead th`).then(($headers) => {
      // Every sortable header shows both arrows (Q33).
      expect([...$headers].map((header) => header.textContent)).to.deep.equal(
        Object.values(ApplicationColumn).map((column) =>
          SORTABLE_COLUMNS[column]
            ? `${APPLICATION_COLUMN_LABELS[column]}${BOTH_SORT_INDICATORS}`
            : APPLICATION_COLUMN_LABELS[column],
        ),
      );
    });
    applicationCell(secondId, ApplicationColumn.Documents).should("have.text", documentCountLabel(9));
  });

  it("shows the empty message for a zero-byte CSV", () => {
    cy.useCsv("");
    cy.visit(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.applicationsEmpty)).should("have.text", UI_TEXT.emptyApplications);
    cy.get(byId(ELEMENT_IDS.applicationsTable)).should("not.exist");
  });

  it("shows only the generic error when the CSV header is wrong", () => {
    allowStreamedServerError();
    cy.useCsv(buildBadHeaderCsv());
    cy.visit(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.pageError)).should("contain.text", UI_TEXT.errorMessage);
    cy.get(byId(ELEMENT_IDS.applicationsTable)).should("not.exist");
    cy.get("body")
      .invoke("prop", "innerText")
      .should("not.contain", "application_id")
      .and("not.contain", "header")
      .and("not.contain", ".csv");
  });

  it("recovers from the error when Try again is clicked after the CSV is fixed", () => {
    allowStreamedServerError();
    cy.useCsv(buildBadHeaderCsv());
    cy.visit(ROUTES.applications);
    cy.get(byId(ELEMENT_IDS.pageError)).should("be.visible");

    cy.useSampleCsv();
    cy.get(byId(ELEMENT_IDS.pageErrorRetry)).should("have.text", UI_TEXT.errorRetry).click();

    applicationRows().should("have.length", PAGE_SIZE);
    cy.get(byId(ELEMENT_IDS.pageError)).should("not.exist");
  });

  it("formats loan amounts as US dollars with two decimals", () => {
    cy.useCsv(
      toCsv([
        buildRow({ applicationId: firstId, loanAmount: "390000" }),
        buildRow({ applicationId: secondId, loanAmount: "12500.5" }),
      ]),
    );
    cy.visit(ROUTES.applications);

    applicationCell(firstId, ApplicationColumn.LoanAmount).should("have.text", "$390,000.00");
    applicationCell(secondId, ApplicationColumn.LoanAmount).should("have.text", "$12,500.50");
  });

  it("shows Complete when every type is satisfied and N outstanding otherwise", () => {
    const satisfied = buildRowsForAllTypes(DocumentStatus.Approved, { applicationId: firstId }).map(
      (row, index) => (index % 2 === 0 ? { ...row, documentStatus: DocumentStatus.NotRequired } : row),
    );
    const partial = DOCUMENT_TYPES.slice(0, 9).map((documentType, index) =>
      buildRow({
        applicationId: secondId,
        documentType,
        documentStatus: index < 2 ? DocumentStatus.Approved : DocumentStatus.Received,
      }),
    );
    cy.useCsv(toCsv([...satisfied, ...partial]));
    cy.visit(ROUTES.applications);

    applicationCell(firstId, ApplicationColumn.Status).should("have.text", UI_TEXT.complete);
    applicationCell(secondId, ApplicationColumn.Status).should("have.text", outstandingLabel(10));
  });

  it("opens the application detail page when a row is clicked", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.applications);

    cy.get(byId(applicationRowId(SAMPLE_FIRST_APPLICATION_ID))).click();

    cy.location("pathname").should("eq", ROUTES.application(SAMPLE_FIRST_APPLICATION_ID));
    cy.get(byId(ELEMENT_IDS.applicationTitle)).should("contain.text", SAMPLE_FIRST_APPLICATION_ID);
  });
});

describe("Application detail", () => {
  it("shows all 12 types alphabetically with missing, not-started and stored rows", () => {
    const presentRow = buildRow({
      documentType: DocumentType.BankStatements90Day,
      documentStatus: DocumentStatus.UnderReview,
      dateReceived: "1/28/2026",
      expirationDate: "4/28/2026",
      notes: "Reviewing for completeness",
    });
    const blankStatusRow = buildRow({
      documentType: DocumentType.LeaseAgreement,
      documentStatus: "",
    });
    const otherRows = DOCUMENT_TYPES.filter(
      (documentType) =>
        documentType !== DocumentType.BankStatements90Day &&
        documentType !== DocumentType.LeaseAgreement &&
        documentType !== DocumentType.DebtSchedule,
    ).map((documentType) => buildRow({ documentType }));
    cy.useCsv(toCsv([blankStatusRow, ...otherRows, presentRow]));
    cy.visit(ROUTES.application(BUILDER_APPLICATION_ID));

    expectChecklistOrder();
    checklistCell(DocumentType.DebtSchedule, ChecklistColumn.Status).should(
      "have.text",
      NOT_ON_CHECKLIST_LABEL,
    );
    checklistCell(DocumentType.DebtSchedule, ChecklistColumn.DateReceived).should("have.text", "");
    checklistCell(DocumentType.LeaseAgreement, ChecklistColumn.Status).should(
      "have.text",
      NOT_STARTED_LABEL,
    );
    const present = DocumentType.BankStatements90Day;
    checklistCell(present, ChecklistColumn.Status).should("have.text", DocumentStatus.UnderReview);
    checklistCell(present, ChecklistColumn.DateReceived).should("have.text", "1/28/2026");
    checklistCell(present, ChecklistColumn.ExpirationDate).should("have.text", "4/28/2026");
    checklistCell(present, ChecklistColumn.Notes).should("have.text", "Reviewing for completeness");
  });

  it("shows the application details in the header", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.application(SAMPLE_FIRST_APPLICATION_ID));

    cy.get(byId(ELEMENT_IDS.applicationTitle)).should("contain.text", "Metro Dental Group");
    const field = (name: ApplicationField) => cy.get(byId(applicationFieldId(name)));
    field(ApplicationField.BorrowerName).should("have.text", "Elena Williams");
    field(ApplicationField.LoanAmount).should("have.text", "$390,000.00");
    field(ApplicationField.AssignedProcessor).should("have.text", "Aisha Patel");
    field(ApplicationField.ApplicationDate).should("have.text", "12/1/2025");
    field(ApplicationField.Status).should("have.text", outstandingLabel(10));
  });

  it("shows Application not found for an unknown ID and links back to the list", () => {
    cy.useSampleCsv();
    cy.visit(ROUTES.application(UNKNOWN_APPLICATION_ID), { failOnStatusCode: false });

    cy.get(byId(ELEMENT_IDS.applicationNotFound)).should("contain.text", UI_TEXT.applicationNotFound);
    cy.get(byId(ELEMENT_IDS.backToApplications)).click();

    cy.location("pathname").should("eq", ROUTES.applications);
    applicationRows().should("have.length", PAGE_SIZE);
  });
});

describe("Loader", () => {
  it("shows Loading application… while navigating from the list to a detail page", () => {
    const detailPath = ROUTES.application(SAMPLE_FIRST_APPLICATION_ID);
    cy.useSampleCsv();
    aliasShellPrefetch(DETAIL_PATHNAME_PATTERN);
    cy.visit(ROUTES.applications);
    applicationRows().should("have.length", PAGE_SIZE);
    cy.wait(`@${SHELL_PREFETCH_ALIAS}`);
    delayNavigationResponse(detailPath);

    cy.get(byId(applicationRowId(SAMPLE_FIRST_APPLICATION_ID))).click();

    cy.get(byId(ELEMENT_IDS.pageLoader))
      .should("be.visible")
      .and("have.attr", "role", "status")
      .and("contain.text", UI_TEXT.loadingApplication);
    checklistRows().should("have.length", DOCUMENT_TYPES.length);
    cy.get(byId(ELEMENT_IDS.pageLoader)).should("not.exist");
  });

  it("shows Loading applications… while navigating from a detail page back to the list", () => {
    cy.useSampleCsv();
    aliasShellPrefetch(ROUTES.applications);
    cy.visit(ROUTES.application(SAMPLE_FIRST_APPLICATION_ID));
    checklistRows().should("have.length", DOCUMENT_TYPES.length);
    cy.wait(`@${SHELL_PREFETCH_ALIAS}`);
    delayNavigationResponse(ROUTES.applications);

    cy.get(byId(ELEMENT_IDS.backToApplications)).click();

    cy.get(byId(ELEMENT_IDS.pageLoader))
      .should("be.visible")
      .and("contain.text", UI_TEXT.loadingApplications);
    applicationRows().should("have.length", PAGE_SIZE);
    cy.get(byId(ELEMENT_IDS.pageLoader)).should("not.exist");
  });
});

describe("No writes", () => {
  it("leaves the CSV byte-identical after viewing both pages", () => {
    cy.useSampleCsv();
    cy.readDataCsv().then((before) => {
      cy.visit(ROUTES.applications);
      applicationRows().should("have.length", PAGE_SIZE);
      cy.visit(ROUTES.application(SAMPLE_FIRST_APPLICATION_ID));
      checklistRows().should("have.length", DOCUMENT_TYPES.length);

      cy.readDataCsv().should("equal", before);
    });
  });
});
