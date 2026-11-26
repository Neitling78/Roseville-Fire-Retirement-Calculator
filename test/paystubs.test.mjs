// Paystub reader tests. Uses SYNTHETIC stubs laid out like the City's Oracle payslip —
// no real member's pay data is ever committed to this public repo.
import { parseStub, analyzeStubs, paystubFinalComp, ceasingPatterns, MIN_MONTHS } from "../src/paystubs.js";

let pass = 0, fail = 0;
const check = (name, fn) => {
  let r; try { r = fn(); } catch (e) { r = "threw " + e.message; }
  if (r === true) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("! FAIL  " + name + (r ? "  -> " + r : "")); }
};
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol || `${a} vs ${b}`;

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const us = (s) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
const $ = (n) => `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// One synthetic stub. Positions copy the real layout: labels x<200, Current at ~423,
// YTD at ~527; header value one row under its label.
function fakeStub({ start, rate = 50, regular, special = {}, notReported = {}, memberRate = 0.09, plan = "Classic" }) {
  const end = iso(new Date(new Date(start + "T00:00:00Z").getTime() + 13 * DAY));
  const check = iso(new Date(new Date(start + "T00:00:00Z").getTime() + 20 * DAY));
  const p1 = [], p2 = [];
  const hdr = (x, y, label, value) => { p1.push({ x, y, s: label }); p1.push({ x: x + 10, y: y - 11, s: value }); };
  hdr(37, 599, "Period Start Date", us(start));
  hdr(136, 599, "Period End Date", us(end));
  hdr(343, 599, "Check Date", us(check));
  hdr(524, 599, "Hourly Rate", `$ ${rate.toFixed(4)}`);
  p1.push({ x: 49, y: 368, s: "Gross Earnings and Imputed Earnings" });
  let y = 356;
  const line = (arr, label, amt) => { arr.push({ x: 65, y, s: label }); arr.push({ x: 423, y: y + 1, s: $(amt) }); arr.push({ x: 527, y: y + 1, s: $(amt * 10) }); y -= 12; };
  const earnings = { "Regular 24 Hour Fire": regular, ...special, ...notReported };
  Object.entries(earnings).sort().forEach(([k, v]) => line(p1, k, v));
  p1.push({ x: 54, y: y - 10, s: "Pretax Deductions" }); y -= 22;
  const specialSum = Object.values(special).reduce((a, b) => a + b, 0);
  line(p1, `PERS Normal Wages ${plan}`, Math.round(regular * memberRate * 100) / 100);
  line(p1, `PERS Special Comp ${plan}`, Math.round(specialSum * memberRate * 100) / 100);
  p2.push({ x: 54, y: 597, s: "Employee Tax Deductions" });
  p2.push({ x: 63, y: 585, s: "FIT Withheld" }); p2.push({ x: 415, y: 586, s: "$ 1,000.00" });
  return { pages: [p1, p2], check, end };
}
// A run of consecutive biweekly stubs ending with the period that starts on lastStart.
function run(n, lastStart, opts = {}) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = iso(new Date(new Date(lastStart + "T00:00:00Z").getTime() - i * 14 * DAY));
    out.push(parseStub(fakeStub({ start, regular: 5800, special: { "Education Pay BA or BS": 600, "Engine Boss 5 Perc": 300, "Longevity": 450 },
      notReported: { "Overtime 1.5": 1800, "FLSA Overtime": 250 }, ...opts }).pages));
  }
  return out;
}

console.log("\n-- paystubs: reading one stub --");
const one = parseStub(fakeStub({ start: "2026-10-31", rate: 50.666, regular: 5877.24, special: { "Longevity": 456 }, notReported: { "Overtime 1.5": 1823.98 } }).pages);
check("reads the check date", () => one.checkDate === "2026-11-20" || one.checkDate);
check("reads the pay period", () => (one.periodStart === "2026-10-31" && one.periodEnd === "2026-11-13") || `${one.periodStart}–${one.periodEnd}`);
check("reads the hourly rate", () => near(one.hourlyRate, 50.666, 0.0001));
check("reads an earnings line", () => near(one.earnings["Regular 24 Hour Fire"].cur, 5877.24));
check("reads the PERS base deduction", () => near(one.persNormal, 528.95));
check("reads the plan name off the PERS line", () => one.plan === "Classic" || one.plan);
check("a non-paystub PDF is rejected", () => parseStub([[{ x: 40, y: 700, s: "Some other document" }]]).ok === false);

console.log("\n-- paystubs: the 12-to-36-month rule --");
const full = analyzeStubs(run(26, "2026-10-31"), { today: "2026-11-25" });
check("26 stubs in a row (12 months) is accepted", () => full.ok || full.errors.join(" | "));
const short = analyzeStubs(run(20, "2026-10-31"), { today: "2026-11-25" });
check("fewer than 12 months is refused", () => !short.ok);
check("and says how many more stubs are needed", () => /at least 12 months/.test(short.errors.join(" ")) || short.errors.join(" | "));
const many = analyzeStubs(run(90, "2026-10-31"), { today: "2026-11-25" });
check("more than 36 months: older stubs are left out", () => many.stubCount <= 79 || many.stubCount);
check("and the member is told", () => /older than 36 months/.test(many.notes.join(" ")) || many.notes.join(" | "));
const holes = run(30, "2026-10-31"); holes.splice(25, 1);       // a missing stub inside the latest 12 months
const gap = analyzeStubs(holes, { today: "2026-11-25" });
check("a missing stub inside the latest 12 months is refused", () => !gap.ok);
check("and the missing pay period is named", () => /pay period is missing/.test(gap.errors.join(" ")) || gap.errors.join(" | "));
const oldHole = run(40, "2026-10-31"); oldHole.splice(5, 1);    // a missing stub further back
const og = analyzeStubs(oldHole, { today: "2026-11-25" });
check("an older gap still works, using the stubs after it", () => (og.ok && og.stubCount === 34) || `${og.ok} ${og.stubCount}`);
const dupes = analyzeStubs([...run(26, "2026-10-31"), ...run(3, "2026-10-31")], { today: "2026-11-25" });
check("the same stub dropped twice counts once", () => dupes.stubCount === 26 || dupes.stubCount);
const stale = analyzeStubs(run(26, "2026-03-07"), { today: "2026-11-25" });
check("stubs months out of date get a warning", () => /days ago/.test(stale.warnings.join(" ")) || stale.warnings.join(" | "));

console.log("\n-- paystubs: what counts toward the pension --");
check("the member rate is read off the stubs", () => near(full.memberRate, 0.09, 0.00001));
check("every stub reconciles with its PERS deduction", () => full.reconciledStubs === 26 || full.reconciledStubs);
check("12-month base = the regular pay reported", () => near(full.last12.base, 26 * 5800, 1));
check("12-month special = only the reported special pay", () => near(full.last12.special, 26 * 1350, 1));
check("voluntary overtime is not in it", () => full.last12.total < 26 * (5800 + 1350) + 1 || full.last12.total);
check("unreported lines are listed as not reported", () => full.breakdown.some((b) => b.label === "Overtime 1.5" && b.kind === "not") || "missing");
const cap = analyzeStubs(run(26, "2026-10-31"), { today: "2026-11-25", ceasing: ceasingPatterns("Fire Captain") });
check("Captain: Engine Boss is marked as ending 1/9/2027", () => near(cap.last12.ceasing, 26 * 300, 1));
check("FF: nothing is marked as ending", () => near(analyzeStubs(run(26, "2026-10-31"), { today: "2026-11-25", ceasing: ceasingPatterns("Firefighter Paramedic II") }).last12.ceasing, 0));
const pepra = analyzeStubs(run(26, "2026-10-31", { memberRate: 0.135, plan: "PEPRA" }), { today: "2026-11-25" });
check("a PEPRA stub's own member rate is used", () => near(pepra.memberRate, 0.135, 0.0001));
check("and gives the same pensionable pay", () => near(pepra.last12.total, full.last12.total, 2));

console.log("\n-- paystubs: final compensation --");
const flat = () => 1;
const inWindow = paystubFinalComp(full, { retirementDate: "2026-11-14", months: 12, growthForYear: flat });
const perMonth = (26 * 7150) / 364 * 365.25 / 12;
check("retiring the day after the newest stub: all actual pay", () => inWindow.actualShare > 0.99 || inWindow.actualShare);
check("and final comp = the stubs' monthly average", () => near(inWindow.monthly, perMonth, 1));
const future = paystubFinalComp(full, { retirementDate: "2028-06-01", months: 12, growthForYear: (y) => (y >= 2028 ? 1.10 : 1) });
check("retiring later: the window is projected", () => future.actualShare === 0 || future.actualShare);
check("projection grows base by the calculator's factor", () => future.monthly > inWindow.monthly || `${future.monthly}`);
const capFuture = paystubFinalComp(cap, { retirementDate: "2028-06-01", months: 12, growthForYear: flat });
const capNow = paystubFinalComp(cap, { retirementDate: "2026-12-01", months: 12, growthForYear: flat });
check("pay ending 1/9/2027 drops out of a later window", () => capFuture.monthly < capNow.monthly || `${capFuture.monthly} vs ${capNow.monthly}`);
const p36 = paystubFinalComp(full, { retirementDate: "2026-11-14", months: 36, growthForYear: flat });
check("36-month window reaching past the stubs still averages", () => near(p36.monthly, perMonth, 2));
check("a refused upload gives no final comp", () => paystubFinalComp(short, { retirementDate: "2028-01-01", months: 12, growthForYear: flat }) === null);

console.log("\n-- paystubs: FLSA, to the penny --");
const withFlsa = run(26, "2026-10-31", { special: { "Education Pay BA or BS": 600, "Longevity": 450, "Overtime FLSA Over 64 Hours": 217.86 } });
const fl = analyzeStubs(withFlsa, { today: "2026-11-25" });
check("the Over-64 FLSA line is totalled", () => near(fl.flsa.amount, 26 * 217.86, 0.001));
check("FLSA rate = Over-64 ÷ base reported", () => near(fl.flsa.pct, 217.86 / 5800, 0.0000001));
check("the other FLSA line is never in it", () => fl.breakdown.some((b) => b.label === "FLSA Overtime" && b.kind === "not") || "FLSA Overtime counted");
check("every stub ties out to the penny", () => (fl.reconciledStubs === 26 && fl.tieOut.every((t) => t.ok)) || fl.reconciledStubs);
const off = run(26, "2026-10-31"); off[10] = { ...off[10], persSpecial: off[10].persSpecial + 0.01 };
const offA = analyzeStubs(off, { today: "2026-11-25" });
check("a stub one cent off is flagged", () => (offA.reconciledStubs === 25 && /to the penny/.test(offA.warnings.join(" "))) || `${offA.reconciledStubs} ${offA.warnings}`);

const rnd = run(26, "2026-10-31", { special: { "Holiday Buy Up": 3167.41, "Education Pay BA or BS": 2243.85 } });
// Whole-total rounding gives 487.01; rounding line by line gives 487.02 (as the City did on a real stub).
check("synthetic setup: whole-total rounding is 487.01", () => near(rnd[5].persSpecial, 487.01, 0.001));
rnd[5] = { ...rnd[5], persSpecial: 487.02 };
const rndA = analyzeStubs(rnd, { today: "2026-11-25" });
check("line-by-line rounding by the City still ties to the penny", () => rndA.reconciledStubs === 26 || rndA.reconciledStubs);
rnd[5] = { ...rnd[5], persSpecial: 487.03 };
check("but a real one-cent difference does not", () => analyzeStubs(rnd, { today: "2026-11-25" }).reconciledStubs === 25);
check("tied stubs use the exact pay lines, not deduction ÷ rate", () => near(rndA.last12.special, 26 * (3167.41 + 2243.85), 0.0001));

console.log("\n-- paystubs: Holiday Buy Up, 168 hours a year --");
const perCheck = Math.round(168 / 26 * 50 * 1.075 * 100) / 100;           // $50/hr + 7.5% longevity
const hol = run(26, "2026-10-31", { rate: 50, special: { "Education Pay BA or BS": 600, "Holiday Buy Up": perCheck } });
const holLump = run(26, "2026-10-31", { rate: 50, special: { "Education Pay BA or BS": 600, "Holiday Buy Up": perCheck } });
// One check also cashes out 48 hours carried over from the year before.
holLump[12] = parseStub(fakeStub({ start: holLump[12].periodStart, rate: 50, regular: 5800,
  special: { "Education Pay BA or BS": 600, "Holiday Buy Up": perCheck + 48 * 50 * 1.075 } }).pages);
const H = analyzeStubs(hol, { today: "2026-11-25" }), HL = analyzeStubs(holLump, { today: "2026-11-25" });
check("holiday is kept out of the special-pay ratio", () => near(H.last12.specialRatio, 600 / 5800, 0.000001));
const fc = (S, date) => paystubFinalComp(S, { retirementDate: date, months: 12, growthForYear: () => 1, longevityPct: 0.075 });
const want = 168 * 50 * 1.075 / 12;
check("projected holiday = 168 hrs × (rate + longevity) a year", () => near(fc(H, "2028-06-01").holidayMonthly, want, 0.01));
check("a carried-over cash-out does not raise the projection", () => near(fc(HL, "2028-06-01").monthly, fc(H, "2028-06-01").monthly, 0.01));
check("inside the stub window the cash-out is capped at 168 hrs", () => near(fc(HL, "2026-11-14").monthly, fc(H, "2026-11-14").monthly, 1));
check("and the excluded amount is reported", () => near(fc(HL, "2026-11-14").holidayExcluded * 12, 48 * 50 * 1.075, 3) );
check("no Holiday Buy Up on the stubs: none is projected", () => fc(analyzeStubs(run(26, "2026-10-31"), { today: "2026-11-25" }), "2028-06-01").holidayMonthly === 0);

console.log("\n-- paystubs: uniform allowance is a flat $1,300 a year --");
const uni = analyzeStubs(run(26, "2026-10-31", { special: { "Education Pay BA or BS": 600, "Uniform Allowance Payment": 50 } }), { today: "2026-11-25" });
check("uniform is kept out of the special-pay ratio", () => near(uni.last12.specialRatio, 600 / 5800, 0.000001));
check("the 12-month uniform total is read", () => near(uni.last12.uniform, 1300, 0.001));
const uf = (g) => paystubFinalComp(uni, { retirementDate: "2028-06-01", months: 12, growthForYear: () => g, uniformAnnual: 1300 });
check("a 20% raise does not raise the uniform allowance", () => near(uf(1.2).monthly - uf(1).monthly, 0.2 * 5800 * 26 / 12 * (1 + 600 / 5800) * 0 + (uf(1.2).monthly - uf(1).monthly), 0) && near((uf(1.2).monthly - uf(1).monthly) / (uf(1).monthly - 1300 / 12) , 0.2, 0.0001));
const noUni = analyzeStubs(run(26, "2026-10-31", { special: { "Education Pay BA or BS": 600 } }), { today: "2026-11-25" });
check("no uniform on the stubs: none is projected", () => near(paystubFinalComp(noUni, { retirementDate: "2028-06-01", months: 12, growthForYear: () => 1, uniformAnnual: 1300 }).monthly
  + 1300 / 12, uf(1).monthly, 0.01));

console.log(`\n${fail ? "!!" : "OK"} ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);
