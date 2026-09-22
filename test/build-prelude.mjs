// Extracts the pure (non-React) top of the calculator so the math can be unit-tested.
// Run automatically by `npm test`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/RFF_Retirement_Calculator.jsx"), "utf8");
const head = src.slice(0, src.indexOf("export default function RFFRetirementCalculator()"))
  .split("\n").filter(l => !l.startsWith("import ")).join("\n");
const EXPORTS = ["SALARY_SCHEDULE_A","SALARY_SCHEDULE_B","scheduleForHire","SCHEDULE_B_CUTOFF",
  "COLA_TIER_DATE","pemhcaMinFor","max457For","formulaMaxPct","calcRetireeMedical",
  "calcSickLeavePayoff","priorYearFactor","SICK_LEAVE_PAYOFF_MAX_HOURS","MAX_457_ANNUAL",
  "MAX_457_SPECIAL_3YR","SICK_LEAVE_HOURS_PER_YEAR_CREDIT","LONGEVITY","SERVICE_TERM_BONUS","mouGwiFor","isPreventionClass","MOU_GWI","PREVENTION_CLASSES"];
writeFileSync(join(here, "prelude.mjs"), head + "\nexport { " + EXPORTS.join(", ") + " };\n");
