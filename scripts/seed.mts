import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SAMPLE_CSV_PATH = "docs/NEWITY_Sample_Data_A_Document_Checklist.csv";
const DEFAULT_DATA_CSV_PATH = "data/applications.csv";
const FORCE_FLAG = "--force";

const target = resolve(process.env.DATA_CSV_PATH ?? DEFAULT_DATA_CSV_PATH);
const force = process.argv.includes(FORCE_FLAG);

if (existsSync(target) && !force) {
  console.error(`${target} already exists; rerun with ${FORCE_FLAG} to overwrite it.`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(resolve(SAMPLE_CSV_PATH), target);
console.log(`Seeded ${target} from ${SAMPLE_CSV_PATH}`);
