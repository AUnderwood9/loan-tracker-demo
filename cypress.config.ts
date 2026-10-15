import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defineConfig } from "cypress";
import { CsvTask, SAMPLE_CSV_PATH } from "./cypress/support/csv-tasks";

const DATA_CSV_PATH_ENV = "DATA_CSV_PATH";
const E2E_BASE_URL = "http://localhost:3100";

// The tasks overwrite this file, so it must be the fixture path the server was started
// with. Failing fast keeps Cypress from ever defaulting onto data/applications.csv.
function resolveFixturePath(): string {
  const path = process.env[DATA_CSV_PATH_ENV];
  if (!path) {
    throw new Error(`${DATA_CSV_PATH_ENV} must be set; run Cypress through the e2e npm scripts.`);
  }
  return resolve(path);
}

export default defineConfig({
  e2e: {
    baseUrl: E2E_BASE_URL,
    supportFile: "cypress/support/e2e.ts",
    setupNodeEvents(on) {
      const fixturePath = resolveFixturePath();
      on("task", {
        async [CsvTask.UseSampleCsv]() {
          await mkdir(dirname(fixturePath), { recursive: true });
          await copyFile(resolve(SAMPLE_CSV_PATH), fixturePath);
          return null;
        },
        async [CsvTask.WriteDataCsv](content: string) {
          await mkdir(dirname(fixturePath), { recursive: true });
          await writeFile(fixturePath, content, "utf8");
          return null;
        },
        [CsvTask.ReadDataCsv]() {
          return readFile(fixturePath, "utf8");
        },
      });
    },
  },
});
