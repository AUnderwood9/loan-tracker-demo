import { describe, expect, it, vi } from "vitest";
import {
  DOCUMENT_TYPES,
  DocumentStatus,
  DocumentType,
  NOT_ON_CHECKLIST_LABEL,
} from "@/lib/applications/constants";
import { buildChecklist } from "@/lib/applications/checklist";
import { buildRow, buildRowsForAllTypes } from "@/lib/applications/test-fixtures";

vi.mock("server-only", () => ({}));

const UNKNOWN_STATUS = "Waiting on Bank";

describe("buildChecklist", () => {
  it("is complete when all 12 types are Approved", () => {
    const rows = buildRowsForAllTypes(DocumentStatus.Approved);

    const checklist = buildChecklist(rows);

    expect(checklist).toMatchObject({
      isComplete: true,
      outstandingCount: 0,
      documentCount: DOCUMENT_TYPES.length,
    });
  });

  it("is complete when all 12 types are a mix of Approved and Not Required", () => {
    const rows = buildRowsForAllTypes(DocumentStatus.Approved).map((row, index) =>
      index % 2 === 0 ? { ...row, documentStatus: DocumentStatus.NotRequired } : row,
    );

    const checklist = buildChecklist(rows);

    expect(checklist.isComplete).toBe(true);
  });

  it("lists all 12 types as Not on checklist for empty input", () => {
    const checklist = buildChecklist([]);

    expect(checklist.items.map((item) => item.status)).toEqual(
      DOCUMENT_TYPES.map(() => NOT_ON_CHECKLIST_LABEL),
    );
    expect(checklist).toMatchObject({
      outstandingCount: DOCUMENT_TYPES.length,
      documentCount: 0,
      isComplete: false,
    });
  });

  it("counts satisfied types against all 12, so missing types stay outstanding", () => {
    const rows = [
      buildRow({ documentType: DocumentType.DebtSchedule, documentStatus: DocumentStatus.Approved }),
      buildRow({ documentType: DocumentType.LeaseAgreement, documentStatus: DocumentStatus.Pending }),
    ];

    const checklist = buildChecklist(rows);

    expect(checklist).toMatchObject({ documentCount: 2, outstandingCount: DOCUMENT_TYPES.length - 1 });
  });

  it("shows an unknown status as stored and does not count it as satisfied", () => {
    const rows = [buildRow({ documentType: DocumentType.DebtSchedule, documentStatus: UNKNOWN_STATUS })];

    const item = buildChecklist(rows).items.find((i) => i.documentType === DocumentType.DebtSchedule);

    expect(item).toMatchObject({ status: UNKNOWN_STATUS, isSatisfied: false });
  });

  it("ignores rows whose document type is not one of the 12", () => {
    const rows = [buildRow({ documentType: "Unknown Form", documentStatus: DocumentStatus.Approved })];

    const checklist = buildChecklist(rows);

    expect(checklist).toMatchObject({ documentCount: 0, outstandingCount: DOCUMENT_TYPES.length });
  });

  it("does not mutate the input rows", () => {
    const rows = [buildRow({ documentStatus: "" })];
    const snapshot = structuredClone(rows);

    buildChecklist(rows);

    expect(rows).toEqual(snapshot);
  });
});
