import type { ChecklistItem } from "@/lib/applications/checklist";
import { CHECKLIST_COLUMN_LABELS, ChecklistColumn } from "@/lib/ui/columns";
import { ELEMENT_IDS, checklistCellId, checklistRowId } from "@/lib/ui/element-ids";

interface ChecklistTableProps {
  items: readonly ChecklistItem[];
}

const COLUMNS = Object.values(ChecklistColumn);

function cellValues(item: ChecklistItem): Record<ChecklistColumn, string> {
  return {
    [ChecklistColumn.DocumentType]: item.documentType,
    [ChecklistColumn.Status]: item.status,
    [ChecklistColumn.DateReceived]: item.row?.dateReceived ?? "",
    [ChecklistColumn.ExpirationDate]: item.row?.expirationDate ?? "",
    [ChecklistColumn.Notes]: item.row?.notes ?? "",
  };
}

export default function ChecklistTable({ items }: ChecklistTableProps) {
  return (
    <table id={ELEMENT_IDS.checklistTable} className="data-table">
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th key={column} scope="col">
              {CHECKLIST_COLUMN_LABELS[column]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const values = cellValues(item);
          const isMissing = item.row === null;
          return (
            <tr key={item.documentType} id={checklistRowId(item.documentType)}>
              {COLUMNS.map((column) => (
                <td
                  key={column}
                  id={checklistCellId(item.documentType, column)}
                  className={isMissing && column === ChecklistColumn.Status ? "status-missing" : undefined}
                >
                  {values[column]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
