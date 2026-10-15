import { CsvTask } from "./csv-tasks";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      useSampleCsv(): Chainable<null>;
      useCsv(content: string): Chainable<null>;
      readDataCsv(): Chainable<string>;
    }
  }
}

Cypress.Commands.add("useSampleCsv", () => cy.task<null>(CsvTask.UseSampleCsv));
Cypress.Commands.add("useCsv", (content: string) => cy.task<null>(CsvTask.WriteDataCsv, content));
Cypress.Commands.add("readDataCsv", () => cy.task<string>(CsvTask.ReadDataCsv));
