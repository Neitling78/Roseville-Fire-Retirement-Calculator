// Renders the Paystubs tab with a SYNTHETIC paystub summary (no real member's pay data in
// this public repo) and checks the "pension both ways" comparison against the rest of the app.
import { renderToString } from "react-dom/server";
import React from "react";
import { parseStub, analyzeStubs } from "../src/paystubs.js";

const store = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }, clear() { this._d = {}; } };
globalThis.localStorage = store;
globalThis.window = { innerWidth: 1280, addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
  location: { search: "" }, localStorage: store };
globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {} }) };

let pass = 0, fail = 0, bust = 0;
const check = (label, fn) => {
  try { const r = fn(); if (r !== true) throw new Error(r || "assertion returned falsy"); console.log("  PASS  " + label); pass++; }
  catch (e) { console.log("! FAIL  " + label + "  -> " + e.message); fail++; }
};
const strip = (h) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&#8722;|−/g, "-").replace(/\s+/g, " ");

// ── Synthetic stubs: a Classic Captain at $50.666/hr, 26 checks ─────────────
const DAY = 86400000, iso = (d) => d.toISOString().slice(0, 10);
const us = (s) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
const $ = (n) => `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function fakeStub(start, earnings, special) {
  const end = iso(new Date(new Date(start + "T00:00:00Z").getTime() + 13 * DAY));
  const chk = iso(new Date(new Date(start + "T00:00:00Z").getTime() + 20 * DAY));
  const p = [];
  const hdr = (x, label, v) => { p.push({ x, y: 599, s: label }); p.push({ x: x + 10, y: 588, s: v }); };
  hdr(37, "Period Start Date", us(start)); hdr(136, "Period End Date", us(end)); hdr(343, "Check Date", us(chk)); hdr(524, "Hourly Rate", "$ 50.6660");
  p.push({ x: 49, y: 368, s: "Gross Earnings and Imputed Earnings" });
  let y = 356;
  const line = (k, v) => { p.push({ x: 65, y, s: k }); p.push({ x: 423, y: y + 1, s: $(v) }); y -= 12; };
  Object.entries(earnings).forEach(([k, v]) => line(k, v));
  p.push({ x: 54, y: y - 10, s: "Pretax Deductions" }); y -= 22;
  const sp = Object.entries(earnings).filter(([k]) => special.includes(k)).reduce((a, [, v]) => a + v, 0);
  line("PERS Normal Wages Classic", Math.round(earnings["Regular 24 Hour Fire"] * 9) / 100);
  line("PERS Special Comp Classic", Math.round(sp * 9) / 100);
  return parseStub([p]);
}
const SPECIAL = ["Education Pay BA or BS", "Fire Captain 5 Per Cert", "Longevity", "Holiday Buy Up", "Uniform Allowance Payment", "Overtime FLSA Over 64 Hours"];
const stubs = [];
for (let i = 25; i >= 0; i--) {
  const start = iso(new Date(new Date("2026-10-31T00:00:00Z").getTime() - i * 14 * DAY));
  stubs.push(fakeStub(start, {
    "Regular 24 Hour Fire": 5674.59,           // 112 hrs × $50.666
    "Education Pay BA or BS": 567.46, "Fire Captain 5 Per Cert": 283.73, "Longevity": 425.59,
    "Holiday Buy Up": 351.93, "Uniform Allowance Payment": 50, "Overtime FLSA Over 64 Hours": 108.93,
    "Overtime 1.5": 1823.98,
  }, SPECIAL));
}
const summary = { ...analyzeStubs(stubs, { today: "2026-11-25" }), readOn: "2026-11-25" };

const base = { setupDone: true, wizardDone: true, hireDate: "1998-07-01", dob: "1975-03-15", classification: "Fire Captain", salaryStep: "H",
  memberType: "classic", overridePensionType: true, medicalTier: "1", retirementDateOverride: "2028-12-31",
  calpersCreditRoseville: 28.25, calpersCreditAsOf: "2026-11-01", lmaPct: 0, lmaTouched: true,
  hasBachelor: true, hasCompanyOfficer: true, survivorOption: "unmod" };
async function render(saved, withStubs) {
  store.clear();
  store.setItem("rff-calc-v1", JSON.stringify(saved));
  if (withStubs) store.setItem("rff-paystubs-v1", JSON.stringify(summary));
  const { default: Calc } = await import("./component.mjs?p=" + (++bust));
  const out = {};
  for (const t of ["paystubs", "pension", "member"]) { window.location.search = "?tab=" + t; out[t] = strip(renderToString(React.createElement(Calc))); }
  return out;
}
const money = (s) => parseFloat(s.replace(/[$,]/g, ""));
const headerRetiredGross = (t) => { const m = t.match(/While retired[^$]*?Gross \$([\d,]+)/); return m ? money(m[1]) : NaN; };
const tableRow = (t, label) => { const m = t.match(new RegExp(label + "[^$]*\\$([\\d,]+) \\$([\\d,]+) ([+-])\\$([\\d,]+)")); return m ? { off: money(m[1]), on: money(m[2]) } : null; };

console.log("\n-- paystubs tab: pension both ways --");
check("synthetic stubs are accepted", () => summary.ok || summary.errors.join(" | "));
const OFF = await render({ ...base, usePaystubs: false }, true);
const ON = await render({ ...base, usePaystubs: true }, true);
check("the comparison is on the Paystubs tab", () => OFF.paystubs.includes("Your pension both ways") || "missing");
check("it uses the service credit from Member details", () => /28\.250 yrs from myCalPERS \(as of 2026-11-01\)/.test(ON.paystubs) || ON.paystubs.match(/CalPERS service credit at retirement.{0,200}/)?.[0]);
const svc = (t) => t.match(/CalPERS service credit at retirement .{0,40}?([\d.]+) yrs/)?.[1];
check("the same service credit with the switch off and on", () => (svc(OFF.paystubs) && svc(OFF.paystubs) === svc(ON.paystubs)) || `${svc(OFF.paystubs)} vs ${svc(ON.paystubs)}`);
const pOff = tableRow(OFF.paystubs, "Gross pension"), pOn = tableRow(ON.paystubs, "Gross pension");
check("the table reads the same whichever way the switch is set", () => (pOff && pOn && pOff.off === pOn.off && pOff.on === pOn.on) || JSON.stringify([pOff, pOn]));
check("switch off: the header pension = the table's estimate", () => Math.abs(headerRetiredGross(OFF.paystubs) - pOff.off) <= 1 || `${headerRetiredGross(OFF.paystubs)} vs ${pOff.off}`);
check("switch on: the header pension = the table's paystub figure", () => Math.abs(headerRetiredGross(ON.paystubs) - pOn.on) <= 1 || `${headerRetiredGross(ON.paystubs)} vs ${pOn.on}`);
const fOff = tableRow(OFF.paystubs, "Final compensation");
const lineSum = (t, col) => ["Base pay", "Longevity", "Incentives & certificates", "Holiday \\(168 hrs a year\\)", "Uniform allowance", "FLSA scheduled overtime"]
  .reduce((a, l) => a + (tableRow(t, l)?.[col] ?? NaN), 0);
check("Classic: estimate lines add up to the estimate's final comp", () => Math.abs(lineSum(OFF.paystubs, "off") - fOff.off) <= 6 || `${lineSum(OFF.paystubs, "off")} vs ${fOff.off}`);
check("the stub FLSA row uses the stubs, not 2.61%", () => { const r = tableRow(ON.paystubs, "FLSA scheduled overtime"); return (r && r.on < r.off) || JSON.stringify(r); });
const NONE = await render({ ...base, usePaystubs: true }, false);
check("without stubs the switch can't turn on", () => NONE.paystubs.includes("Off · add paystubs on the Paystubs tab") || "toggle text missing");
check("and there is no comparison table", () => !NONE.paystubs.includes("Your pension both ways") || "table shown without stubs");

// Raises: the paystub side must use exactly the calculator's raise settings. Change the
// January 2028 raise and both sides' base pay must move together, to the dollar.
console.log("\n-- paystubs: raises always match the calculator's --");
const baseRow = async (lma, extra = {}) => { const R = await render({ ...base, usePaystubs: true, lmaPct: lma, lmaTouched: true, ...extra }, true); return tableRow(R.paystubs, "Base pay"); };
const r0 = await baseRow(0), r3 = await baseRow(3), r5 = await baseRow(5);
check("LMA 0%: both sides' base pay match", () => (r0 && r0.off === r0.on) || JSON.stringify(r0));
check("LMA 3%: both sides' base pay match", () => (r3 && r3.off === r3.on) || JSON.stringify(r3));
check("LMA 5%: both sides' base pay match", () => (r5 && r5.off === r5.on) || JSON.stringify(r5));
check("and a bigger raise moves both", () => (r5.on > r3.on && r3.on > r0.on) || JSON.stringify([r0, r3, r5]));
const rb = await baseRow(3, { unionRaisePct: 4, retirementDateOverride: "2031-12-31" });
check("future bargained raises (2030+) match too", () => (rb && rb.off === rb.on) || JSON.stringify(rb));

// A summary saved by an older version has no line detail: the rows must not read $0.
const { items, ...oldL12 } = summary.last12;
store.clear(); store.setItem("rff-calc-v1", JSON.stringify({ ...base, usePaystubs: true }));
store.setItem("rff-paystubs-v1", JSON.stringify({ ...summary, last12: oldL12 }));
const { default: Calc2 } = await import("./component.mjs?p=" + (++bust));
window.location.search = "?tab=paystubs";
const OLD = strip(renderToString(React.createElement(Calc2)));
check("old saved stubs: no line rows showing $0", () => !/Longevity \$[\d,]+ \$0 /.test(OLD) || "zero rows shown");
check("and the member is asked to add them again", () => OLD.includes("Add your paystubs again") || "prompt missing");
check("final comp and pension rows still show", () => OLD.includes("Gross pension") || "missing");

console.log(`\n${fail ? "!!" : "OK"} ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);
