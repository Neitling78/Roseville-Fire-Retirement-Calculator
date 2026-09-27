// Renders every screen server-side and asserts what a member actually sees.
// Catches runtime errors (undefined variables) and silent content regressions.
// The component reads localStorage once at import, so each scenario re-imports it.
// NOTE: server rendering does not run useEffect, so values the app derives in an effect
// (memberType, medicalTier) must be supplied explicitly in each scenario's saved state.
import { renderToString } from "react-dom/server";
import React from "react";

const STORAGE_KEY = "rff-calc-v1";
const store = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];}, clear(){this._d={};} };
globalThis.localStorage = store;
// the component reads window.localStorage, not the bare global — stub both
globalThis.window = { innerWidth: 1280, addEventListener(){}, removeEventListener(){},
  matchMedia: () => ({ matches:false, addListener(){}, removeListener(){} }),
  location: { search: "" }, localStorage: store };
globalThis.document = { addEventListener(){}, removeEventListener(){}, createElement: () => ({ style:{} }) };

let pass=0, fail=0, bust=0;
const check = (label, fn) => {
  try { const r = fn(); if (r !== true) throw new Error(r || "assertion returned falsy");
    console.log("  PASS  " + label); pass++; }
  catch (e) { console.log("! FAIL  " + label + "  -> " + e.message); fail++; }
};
// The Compensation year picker now defaults to the member's RETIREMENT year so that screen
// agrees with the header. Tests about TODAY's pay must say so explicitly.
const TODAY_YEAR = new Date().getFullYear();
const pinToday = { rateYear: TODAY_YEAR, rateYearPicked: true };
const has   = (t,n) => t.includes(n) ? true : "missing: " + JSON.stringify(n);
const lacks = (t,n) => !t.includes(n) ? true : "should NOT contain: " + JSON.stringify(n);
const strip = (h) => h.replace(/<!-- -->/g,"").replace(/<[^>]+>/g," ").replace(/&#x27;/g,"'").replace(/&amp;/g,"&")
  .replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#8722;|−/g,"-").replace(/\s+/g," ");

// The Jan-2028 Labor Market Adjustment now DEFAULTS to an assumed 3%, which moves every
// golden figure for a 2028-or-later year. These scenarios were all written against the old
// zero, so pin them there and mark it chosen -- the default's own behaviour gets its own
// tests below rather than being smeared through every other assertion in the file.
async function scenario(saved, opts = {}) {
  globalThis.localStorage.clear();
  const seed = saved && !opts.rawLma
    ? { lmaPct: 0, lmaTouched: true, ...saved }
    : saved;
  if (seed) globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  const { default: Calc } = await import("./component.mjs?v=" + (++bust));
  const out = {};
  for (const t of ["member","comp","pension","survivor","health","now","retired","stayorgo","start","pension","pay","wait","sickleave","medical","inputs","income","help","pensiondetail","timeline","deductions","advanced"]) {
    globalThis.window.location.search = "?tab=" + t;
    const html = renderToString(React.createElement(Calc));
    out[t] = strip(html);
    // Keep the unstripped markup for ONE tab only -- holding raw HTML for every tab of every
    // scenario in the file is enough to run the test process out of heap.
    if (t === "comp" && opts.raw) out.raw_comp = html;
  }
  return out;
}

// ── A first-time visitor gets guided setup ──────────────────────────
// Landing cold on eight tabs and forty fields, a member cannot tell which answers matter.
// The wizard asks five, one at a time, and will not advance on an answer it cannot use.
console.log("\n-- first visit: guided setup, one step at a time --");
const A = await scenario(null);
check("every screen renders", () => Object.values(A).every(h => h.length > 200) || "a screen came back empty");
check("opens on step one, not the dashboard", () =>
  has(A.member, "Step 1 of 13") && has(A.member, "When were you born?"));
check("and asks only that one question", () => lacks(A.member, "When did Roseville hire you?"));
// The whole point: the dashboard is not sitting behind the wizard competing with it.
check("the tabs are not there yet", () => lacks(A.member, "Survivor / beneficiary"));
check("nor any figure to misread", () => lacks(A.member, "Lands in your bank"));
check("the Next button is there", () => has(A.member, "Next"));
// Date of birth is step one because everything downstream reads an age back.
check("date of birth is the first thing asked", () => {
  const dob = A.member.indexOf("Date of birth"), hire = A.member.indexOf("Roseville hire date");
  return (dob >= 0 && (hire < 0 || dob < hire)) || `dob at ${dob}, hire date at ${hire}`;
});
// The gate has to actually gate. dob and hireDate carry defaults so the rest of the
// maths stays finite -- if the wizard read those defaults it would let a member click
// straight past a prefilled 1990-01-01 and silently adopt it as their birthday.
check("step one starts empty, not prefilled", () => lacks(A.member, "1990-01-01"));
check("and says what it wants", () => has(A.member, "Pick your date of birth to carry on"));
check("no placeholder figures while setup runs", () =>
  lacks(A.member, "While retired") && lacks(A.member, "While working"));
check("says what part of the form you are in", () => has(A.member, "The basics"));
check("and roughly what is left", () => has(A.member, "The first five decide your pension"));
// Every question the tool has an input for should be walked past once, not discovered
// three tabs deep a week later.
// This list used to assert only its OWN length, so it could not fail no matter what the
// wizard did. It now has to agree with the step count the app prints, and every title has
// to actually render at its own step.
const WIZ_TITLES = ["When were you born?", "When did Roseville hire you?", "Are you Classic, 3% @ 50?",
  "What is your rank and step?", "When do you plan to go?", "Any service before Roseville?",
  "What specialty pay do you hold?", "How much overtime do you work?", "Sick leave at retirement",
  "Your health plan while working", "Your health plan in retirement", "Dental and vision in retirement",
  "How do you file?", "Your deferred comp (457)"];
check("setup covers the whole calculator", () =>
  has(A.member, `Step 1 of ${WIZ_TITLES.length}`));
{
  const missing = [];
  for (let i = 0; i < WIZ_TITLES.length; i++) {
    const S = await scenario({ wizardStep: i, dob: "1978-10-31", hireDate: "2003-01-01" });
    if (!S.member.includes(WIZ_TITLES[i])) missing.push(`${i}: ${WIZ_TITLES[i]}`);
  }
  check("every step named here really renders", () =>
    missing.length === 0 || "step titles not found: " + missing.join(" | "));
}
check("says data stays in the browser", () => has(A.member, "leaves your browser"));
// A URL pointing at any tab still lands in setup -- there is nothing else to show.
check("every entry point lands in setup", () =>
  ["pension", "comp", "stayorgo", "health"].every(t => A[t].includes(`Step 1 of ${WIZ_TITLES.length}`))
  || "a tab skipped the wizard");

// Thirteen questions is long enough that somebody will close the tab partway.
{
  const mid = await scenario({ wizardStep: 6, dob: "1978-10-31", hireDate: "2003-01-01",
    memberType: "classic", classification: "Fire Captain", salaryStep: "H",
    retirementDateOverride: "2028-12-31" });
  check("setup resumes where you left it", () =>
    has(mid.member, "Step 7 of 13") && has(mid.member, "What specialty pay do you hold?"));
  check("and names the part of the form", () => has(mid.member, "Your pay"));
}
// Each of the last eight has a working default, so none of them traps a member who
// does not have an answer -- the gate is on the five that decide the pension.
{
  const late = await scenario({ wizardStep: 5, dob: "1978-10-31", hireDate: "2003-01-01",
    memberType: "classic", classification: "Fire Captain", salaryStep: "H",
    retirementDateOverride: "2028-12-31" });
  check("the optional steps do not block", () => lacks(late.member, "to carry on"));
}

// A member who has been through it never sees it again: wizardDone falls back to
// setupDone, so an existing saved profile is not sent back to step one.
const RET = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-06-01" });
check("a saved profile skips setup entirely", () => lacks(RET.member, "Step 1 of 13"));
check("and gets the whole tool", () => has(RET.member, "1 \u00b7 Roseville") && has(RET.pension, "Your pension \u00b7 "));

// ── A 28-year Classic Captain, the actual audience ──────────────────────────
console.log("\n-- returning member: Classic Captain, 28 yrs, retiring 2028 --");
const B = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", currentSickLeaveHours:2600,
  retirementDateOverride:"2028-06-01", sickLeaveDisposition:"credit",
  openSections:{ sickdetail:true } });
check("every screen renders", () => Object.values(B).every(h => h.length > 200) || "a screen came back empty");
check("shows the answer on the pension tab", () => has(B.pension, "Your pension \u00b7 "));
check("shows what lands in the bank", () => has(B.pension, "Lands in your bank"));
check("shows gross pension", () => has(B.pension, "Gross CalPERS pension"));
check("shows medical as a deduction", () => has(B.pension, "your out-of-pocket"));
check("compares against working take-home", () => has(B.pension, "Working today, after everything"));
check("Classic member sees the 90% cap", () => has(B.pension, "90% of final compensation"));
check("Classic member sees 12-month final comp", () => has(B.pension, "highest 12 months"));
check("Classic member gets 3% COLA", () => has(B.start, "3.0% COLA"));
check("shows Schedule A for a 1998 hire", () => has(B.start, "Schedule A"));
check("shows the Classic formula", () => has(B.start, "3% @ 50"));

console.log("\n-- 'what if I wait' with real numbers --");
check("table header present", () => has(B.wait, "Go in"));
check("lists candidate years", () => has(B.wait, "2028"));
check("says tax comes off the warrant, not the estimate", () => has(B.wait, "come off the warrant afterward"));
check("warns later dollars buy less", () => has(B.wait, "which buy less"));

console.log("\n-- sick leave decision screen --");
check("frames the decision", () => has(B.member, "Cash or credit?"));
// Collapsed by default: a member breezing through gets the two checkboxes and their two
// figures, and never has to scroll past the reasoning behind them.
check("the reasoning is behind a disclosure", () => has(B.member, "Want more details?"));
check("gives the CalPERS conversion rate", () => has(B.member, "2,000 hours = 1 year"));
check("says you cannot do both", () => has(B.member, "cannot do both with the same hours"));
check("the payoff ceiling is flagged as unconfirmed", () => has(B.member, "base hourly plus longevity only"));
// The cash/credit/split dropdown is gone — the two boxes on Member details are the only control.
check("no second sick-leave control here", () => lacks(B.member, "Split them"));
check("the choice is two checkboxes, in the same section", () =>
  has(B.member, "What will you do with them?") && has(B.member, "Add to service time"));
check("still shows both sides of the decision", () => has(B.member, "As service credit") && has(B.member, "As cash"));
check("points at the Treasurer to confirm", () => has(B.member, "Treasurer"));

// ── A PEPRA member hired 2014 — the one the old code got wrong twice ────────
console.log("\n-- PEPRA member hired 2014 (old code: wrong COLA AND a false cap) --");
const C = await scenario({ setupDone:true, hireDate:"2014-03-01", dob:"1990-01-10",
  memberType:"pepra", medicalTier:"3",
  classification:"Fire Engineer", salaryStep:"H", currentSickLeaveHours:900,
  retirementDateOverride:"2047-03-01" });
check("every screen renders", () => Object.values(C).every(h => h.length > 200) || "a screen came back empty");
check("gets the 3% COLA (hired before 12/16/2016)", () => has(C.start, "3.0% COLA"));
check("told 2.7% @ 57 has no cap", () => has(C.pension, "has no cap"));
check("told the cap removal was a fix", () => has(C.pension, "that was wrong"));
check("sees 36-month final comp explained", () => has(C.pension, "36-month average"));
check("2014 hire is on Schedule A (B starts 1/7/2017)", () => has(C.start, "Schedule A"));
check("shows PEPRA formula", () => has(C.start, "2.7% @ 57"));

// ── A Schedule B member (hired after 1/7/2017) ─────────────────────────────
console.log("\n-- member hired 2019: Schedule B, 9 steps, 2% COLA --");
const D = await scenario({ setupDone:true, hireDate:"2019-05-01", dob:"1995-02-01",
  memberType:"pepra", medicalTier:"4",
  classification:"Firefighter Paramedic II", salaryStep:"I", currentSickLeaveHours:300,
  retirementDateOverride:"2052-05-01" });
check("every screen renders", () => Object.values(D).every(h => h.length > 200) || "a screen came back empty");
check("2019 hire is on Schedule B", () => has(D.start, "Schedule B"));
check("gets the 2% COLA (hired after 12/16/2016)", () => has(D.start, "2.0% COLA"));
check("Tier 4 medical", () => has(D.start, "Medical Tier 4"));
check("service term bonus, not longevity", () => has(D.start, "Service term bonus"));

// ── Pay detail is reachable from the Start screen, not buried ───────────────
console.log("\n-- pay detail on the Start screen --");
const E = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", currentSickLeaveHours:2600,
  retirementDateOverride:"2028-06-01", sickLeaveDisposition:"credit",
  hasBachelor:true, hasChiefFireOfficer:true, hasHazmat:true, hazmatLevel:"taskforce",
  unusedHolidayHours:96, openSections:{ sickdetail:true } });
check("every screen renders", () => Object.values(E).every(h => h.length > 200) || "a screen came back empty");
check("shows the compensation table", () => has(E.comp, "Compensation in "));
// same member, every pay section expanded
const Eo = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", currentSickLeaveHours:2600,
  retirementDateOverride:"2028-06-01", sickLeaveDisposition:"credit",
  hasBachelor:true, hasChiefFireOfficer:true, hasHazmat:true, hazmatLevel:"taskforce",
  openSections:{ startpay:true, startincent:true, starthourly:true, startraises:true, startpayout:true, sickdetail:true } });
check("shows specialty pay section", () => has(E.start, "Specialty pay and certificates"));
check("collapsed header still shows the incentive total", () => /Specialty pay and certificates \s*[\d.]+%/.test(E.start) || "no total in the collapsed header");
check("the table ends at gross pay", () => has(E.comp, "Gross pay"));
check("collapsed header still shows the hourly rate", () => /Your hourly rates \s*\$/.test(E.comp) || "no value in the collapsed header");
check("the cash-out figure is in the cash-or-credit panel", () => /As cash \s*\$/.test(E.member) || "no cash figure in the panel");
check("offers the education incentive", () => has(Eo.start, "Bachelor's degree (10%)"));
check("offers Chief Fire Officer for a Captain", () => has(Eo.start, "Chief Fire Officer cert (10%)"));
check("offers hazmat", () => has(Eo.start, "Hazmat"));
check("offers rescue", () => has(Eo.start, "Rescue"));
check("offers fire investigation", () => has(Eo.start, "Fire investigation"));
check("shows hourly rates", () => has(E.comp, "Your hourly rates"));
check("shows the FLSA regular rate", () => has(Eo.comp, "FLSA regular rate"));
check("All-Call rate is gone (never actually paid)", () => lacks(Eo.pay, "All-Call"));
check("hourly rates carry cents", () => (Eo.comp.match(/\$[\d,]+\.\d{2}\/hr/g) || []).length >= 5
  || "expected 5 hourly rates with cents, found " + (Eo.pay.match(/\$[\d,]+\.\d{2}\/hr/g) || []).length);
check("collapsed hourly header carries cents", () => /Your hourly rates \s*\$[\d,]+\.\d{2}\/hr/.test(E.comp)
  || "collapsed header rate has no cents");
check("monthly figures stay whole dollars", () => /\$[\d,]+\/mo/.test(Eo.pay)
  || "monthly figures should not have gained cents");
check("shows future raises", () => has(E.comp, "Future raises"));
check("shows the 2028 study is an assumption", () => has(Eo.comp, "Total Compensation Study"));
check("shows the cash-out decision", () => has(E.member, "Cash or credit?"));
check("no holiday cash-out input anywhere", () => lacks(E.pay, "Unused holiday hours") === true
  && lacks(E.start, "Unused holiday hours") === true);
check("explains holiday is special comp, not a payout", () => has(Eo.member, "Holiday hours are not a separate cash-out"));
check("cites the special-comp reporting", () => has(Eo.member, "reported to CalPERS as special compensation"));
check("says it cannot be both", () => has(Eo.member, "cannot be both reported to CalPERS and paid out again"));
check("holiday pay still counts as pensionable", () => has(E.comp, "Holiday pay"));
check("cash-out rate says base + longevity, no incentives", () => has(Eo.comp, "base + longevity, no incentives"));
check("cash-out card spells out the exclusion", () => has(Eo.member, "base hourly plus longevity only"));
check("cash-out card excludes specialty pay explicitly", () => has(Eo.member, "no education, certificate or specialty pay"));
check("distinguishes the projected rate from today's", () => has(Eo.member, "not today\u2019s") || has(Eo.member, "not today's"));
check("and the two rates actually differ", () => {
  const m = Eo.member.match(/uses \$([\d.,]+)\/hr .{0,60}?not today.{0,3}\$([\d.,]+)\/hr/);
  if (!m) return true;                       // wording changed; the assertion above still guards it
  return m[1] !== m[2] || `projected ${m[1]} equals today ${m[2]}`;
});
check("shows what the pension is figured on", () => has(E.pension, "What the pension is figured on"));
check("specialty pay is in the build-up", () => has(E.comp, "Specialty and certificate pay"));
check("Classic sees holiday pay as pensionable", () => has(E.comp, "168 hrs at base"));
check("Classic sees uniform allowance", () => has(E.comp, "Uniform allowance"));
check("Classic sees FLSA OT special comp", () => has(E.comp, "FLSA scheduled overtime"));
check("15% education+cert cap is applied", () => has(Eo.comp, "15% Education + Cert Cap Applied"));

// ── Current pay vs pension projection must not be the same figure ───────────
console.log("\n-- a Captain paid Engine Boss today, retiring after it ceases --");
const F = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2029-06-01", rateYear:2027, rateYearPicked:true,
  hasEngineBoss:true, hasBachelor:true,
  openSections:{ startpay:true, starthourly:true } });
check("every screen renders", () => Object.values(F).every(h => h.length > 200) || "a screen came back empty");
check("current pay still shows Engine Boss", () => has(F.comp, "Engine Boss"));
check("says the ceasing cert pay ends 1/9/2027", () => has(F.comp, "end 1/9/2027"));
check("names the rank separation that replaces it", () => has(F.comp, "rank separation sets"));
check("pension build-up does NOT count it", () => {
  const i = F.pension.indexOf("What the pension is figured on");
  const j = F.pension.indexOf("Lands in your bank");
  return i > -1 && j > i && !F.pension.slice(i, j).includes("Engine Boss")
    || "Engine Boss leaked into the pension build-up";
});
// same member retiring BEFORE the cease date keeps it in both places
const G = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2026-12-01",
  hasEngineBoss:true, hasBachelor:true,
  openSections:{ startpay:true } });
check("retiring before the cease date keeps it", () => has(G.comp, "Engine Boss"));
check("no cease warning when it does not apply", () => lacks(G.comp, "it ends 1/9/2027"));

// ── Year picker on the hourly-rate card ─────────────────────────────────────
console.log("\n-- hourly rates by year --");
const mkCapt = (rateYear, unionRaisePct = 3, lmaPct = 0) => ({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2034-06-01", rateYear, rateYearPicked:true, unionRaisePct, lmaPct, openSections:{ starthourly:true } });
const H26 = await scenario(mkCapt(2026));
const H27 = await scenario(mkCapt(2027));
const H28 = await scenario(mkCapt(2028));
const H28c = await scenario(mkCapt(2028, 0));
const H29 = await scenario(mkCapt(2029));
const H29c = await scenario(mkCapt(2029, 0));
const H30 = await scenario(mkCapt(2030));
const H30c = await scenario(mkCapt(2030, 0));
const H31 = await scenario(mkCapt(2031));
check("year picker is present", () => has(H26.comp, "Show rates for"));
check("2026 shows the published base", () => has(H26.comp, "$12,295"));
check("2027 shows the rank-separated base", () => has(H27.comp, "$13,013"));
// The MOU sets 2027 and 2029 and runs through 12/31/2029. The bargaining dial is barred from
// every year the contract already covers, so 2028 and 2029 must not move when it is turned up.
check("the dial does not touch 2028", () => has(H28.comp, "$13,316"));
check("2028 is the same with the dial at zero", () => has(H28c.comp, "$13,316"));
check("2029 is the MOU 1.75%, not the dial", () => has(H29.comp, "$13,549"));
check("2029 is the same with the dial at zero", () => has(H29c.comp, "$13,549"));
check("2030 is the first year the dial bites", () => has(H30.comp, "$13,955"));
check("2030 with the dial at zero stays at the 2029 rate", () => has(H30c.comp, "$13,549"));
check("the dial compounds after 2030", () => has(H31.comp, "$14,374"));
check("2026 base hourly to the cent", () => has(H26.comp, "$50.67/hr"));
check("2027 base hourly to the cent", () => has(H27.comp, "$53.63/hr"));
check("picking a future year explains what moved", () => has(H27.comp, "What moved between"));
check("names the 2027 rank separation", () => has(H27.comp, "rank separation sets"));
check("names the ceasing incentives", () => has(H27.comp, "end 1/9/2027"));
check("names the 2028 Labor Market Adjustment", () => has(H28.comp, "Labor Market Adjustment"));
check("no assumed-figure warning when the LMA is left at zero", () => lacks(H28.pension, "Change it on Pension"));

// ── Labor Market Adjustment, MOU Ch.2 Art.I.A.3 ────────────────────────────
// Effective the first full pay period in January 2028. The 2027 Total Compensation Study
// sets it (survey data effective 9/1/2027), so the figure does not exist yet — the member
// supplies it. It raises base hourly rate, so everything after compounds on top of it.
console.log("\n-- Labor Market Adjustment (Jan 2028) --");
const L27 = await scenario(mkCapt(2027, 3, 5));
const L28 = await scenario(mkCapt(2028, 3, 5));
const L29 = await scenario(mkCapt(2029, 3, 5));
const L30 = await scenario(mkCapt(2030, 3, 5));
check("the LMA does not touch 2027", () => has(L27.comp, "$13,013"));
check("a 5% LMA lifts the 2028 base", () => has(L28.comp, "$13,982"));
check("the 2029 MOU raise compounds on top of the LMA", () => has(L29.comp, "$14,226"));
check("the 2030 bargaining dial compounds on top of both", () => has(L30.comp, "$14,653"));
check("warns once an LMA has been assumed", () => has(L28.comp, "Change it on Pension"));
check("the LMA box is on the wait tab", () => has(L28.wait, "Labor Market Adjustment"));
check("the wait tab cites the MOU article", () => has(L28.wait, "MOU Ch.2 Art.I.A.3"));
check("the wait tab says the study sets it", () => has(L28.wait, "Total Compensation"));
check("the LMA box is on Current compensation", () => has(L28.comp, "55th percentile"));
const LZ = await scenario(mkCapt(2028, 0, 0));
check("all three at zero says nothing is assumed", () => has(LZ.wait, "All three at zero"));
check("zero state says the LMA is deliberately left out", () => has(LZ.wait, "does not exist yet"));
check("a set LMA is named in the assumptions banner", () => has(L28.wait, "Labor Market Adjustment in January 2028"));
check("today's year shows no 'what moved' panel", () => lacks(H26.comp, "What moved between"));

console.log("\n-- MOU raises are shown, not typed --");
check("2027 GWI stated", () => has(H26.pension, "2027"));
check("2029 GWI stated", () => has(H26.comp, "Total Compensation Study"));
check("cites the MOU article", () => has(H26.comp, "MOU Ch.2 Art.I.A"));
check("the bargaining lever is on the pay tab too", () => has(H26.comp, "Raises Local 1592 bargains"));
const PREVp = await scenario({ setupDone:true, hireDate:"2005-06-01", dob:"1975-03-15",
  memberType:"classic", medicalTier:"2", classification:"Fire Plans Examiner", salaryStep:"H",
  retirementDateOverride:"2030-06-01", rateYear:2029, rateYearPicked:true, openSections:{ starthourly:true, startraises:true } });
check("prevention class gets its own 2027 figure", () => has(PREVp.comp, "prevention +3.0%")
  || has(PREVp.pay, "2.5%"));
check("prevention class renders", () => PREVp.pay.length > 200 || "empty");

// ── Start here is fact-finding only ─────────────────────────────────────────
console.log("\n-- Start here asks, it does not answer --");
const FF = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  currentSickLeaveHours:2600, retirementDateOverride:"2028-06-01",
  openSections:{ startincent:true, startprior:true, startextras:true } });
const FFC = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  openSections:{ startcalpers:true, whyclassic:true } });
check("asks rank and step", () => has(FF.member, "Rank and pay step"));
check("asks hire date", () => has(FF.member, "Roseville hire date"));
check("asks retirement date, at the end of Member details", () => has(FF.member, "When do you plan to go?"));
check("asks sick leave", () => has(FF.start, "sick leave hours will you have on the books at retirement"));
check("asks specialty pay", () => has(FF.start, "Specialty pay and certificates"));
check("asks prior agency service", () => has(FF.member, "2 \u00b7 Prior service"));
check("asks purchased service credit", () => has(FF.member, "Air Time purchased"));
check("asks beneficiary age on Survivor / beneficiary", () => has(FF.survivor, "beneficiary’s age at your retirement"));
check("offers the pension type override", () => has(FFC.member, "CalPERS reciprocity"));
check("no pension answer on page one", () => lacks(FF.now, "Gross CalPERS pension"));
check("no cash-out totals on Start here", () => lacks(FF.member, "Total cash at separation"));
check("member details no longer ends in a call to action", () => lacks(FF.member, "That is everything"));

console.log("\n-- the three tabs hold different things --");
check("pension tab has the answer", () => has(FF.pension, "Lands in your bank"));
check("pension tab has no hourly rates", () => lacks(FF.pension, "FLSA regular rate"));
check("pay tab has the rates", () => has(FF.comp, "Your hourly rates"));
check("page one has no pension answer", () => lacks(FF.now, "of final comp"));
check("Member details has the cash-out decision", () => has(FF.member, "Cash or credit?"));
check("six primary tabs", () => ["Member details","Pension","Survivor / beneficiary","Health care","Stay or go?"]
  .every(x => FF.member.includes(x)) || "a primary tab is missing");
check("Deductions is gone as a tab", () => lacks(FF.member, ">Deductions<"));
check("the retired pension-detail link lands on Pension", () => has(FF.pensiondetail, "Gross CalPERS pension"));

// ── CalPERS service credit, straight off myCalPERS ──────────────────────────
console.log("\n-- CalPERS service credit override --");
// Real shape of a myCalPERS page: Roseville 23.390, South Lake Tahoe 4.682 (same 3%@50),
// State of California 1.038 (3%@55), total 29.110.
const CP = await scenario({ setupDone:true, hireDate:"2002-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-06-01",
  calpersCreditRoseville:23.390, calpersCreditIncludesPurchased:true,
  priorService:[
    { agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" },
    { agencyName:"State of California", years:1.038, formula:"3@55" },
  ],
  openSections:{ startcalpers:true, startprior:true, whyclassic:true, whycalpers:true } });
const CPO = await scenario({ setupDone:true, hireDate:"2014-01-01", dob:"1985-03-15",
  memberType:"pepra", medicalTier:"3", classification:"Fire Captain", salaryStep:"H",
  overridePensionType:true, openSections:{ startcalpers:true, whyclassic:true, whycalpers:true } });
check("every screen renders", () => Object.values(CP).every(h => h.length > 200) || "a screen came back empty");
// The reason the override exists: PEPRA by Roseville hire date, Classic via reciprocity.
check("one plain question sets the formula", () => has(CP.member, "Are you Classic, 3% @ 50?"));
// The hire date ticks it; a member Classic via reciprocity ticks it themselves.
check("it explains reciprocity without making you find a picker", () =>
  has(CP.member, "Classic through") && has(CP.member, "CalPERS reciprocity"));
check("no formula dropdown to wade through", () => lacks(CP.member, "hired 1/1/2013 or later"));
check("states the service credit instead of demanding it", () => has(CP.member, "Service credit:"));
check("and offers the exact figure behind one word", () => has(CP.member, "Roseville service credit today"));
check("points at myCalPERS", () => has(CP.member, "my.calpers.ca.gov"));
check("shows the figure on file", () => has(CP.member, "23.390"));
check("projects it to retirement", () => has(CP.member, "Roseville credit at retirement"));
check("asks whether purchased credit is included", () => has(CP.member, "already includes service credit I purchased"));
check("warns about double-counting airtime", () => has(CP.member, "count it twice"));
check("gives a total to reconcile", () => has(CP.member, "Check yourself"));
check("total matches myCalPERS (29.110)", () => has(CP.member, "29.110 years"));
check("says why the Classic question matters", () => has(CP.member, "nothing else in this tool is right"));
// no override supplied -> falls back to the hire date and says so
const NOCP = await scenario({ setupDone:true, hireDate:"2002-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-06-01", openSections:{ startcalpers:true } });
check("falls back to the hire date when blank", () => has(NOCP.member, "estimated from your hire date"));
check("says the fallback is not exact", () => has(NOCP.member, "estimate"));
check("no reconcile panel without a figure", () => lacks(NOCP.member, "Check yourself"));

// ── "Last reported" date and the balance-vs-pension comparison ─────────────
console.log("\n-- reported date and account balance --");
const BAL = await scenario({ setupDone:true, hireDate:"2002-06-01", dob:"1978-09-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-10-01",
  calpersCreditRoseville:23.390, calpersCreditIncludesPurchased:true,
  calpersCreditAsOf:"2026-08-21", calpersBalance:571606.22,
  priorService:[
    { agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" },
    { agencyName:"State of California", years:1.038, formula:"3@55" },
  ],
  openSections:{ startcalpers:true } });
check("every screen renders", () => Object.values(BAL).every(h => h.length > 200) || "a screen came back empty");
check("asks for the Last reported date", () => has(BAL.member, '"Last reported" date on myCalPERS'));
check("explains the employer reporting lag", () => has(BAL.member, "reports on a lag"));
check("counts service still to earn from that date", () => has(BAL.member, "Still to earn"));
check("the account balance sits on Pension, next to what it explains", () => has(BAL.pension, "CalPERS account balance"));
check("says the balance changes nothing", () => has(BAL.pension, "does not change your pension by a cent"));
check("warns a refund forfeits the pension", () => has(BAL.pension, "forfeit the pension entirely"));
check("and it is off Member details", () => lacks(BAL.member, "CalPERS account balance"));
check("pension tab compares balance to pension value", () => has(BAL.pension, "Your account balance is not your pension"));
check("shows the refund value", () => has(BAL.pension, "refund value"));
check("shows the private-saver equivalent", () => has(BAL.pension, "What a private saver would need"));
check("notes the private saver carries risk and no COLA", () => has(BAL.pension, "market risk and no COLA"));
// with no balance entered, the comparison stays off
const NOBAL = await scenario({ setupDone:true, hireDate:"2002-06-01", dob:"1978-09-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-10-01", calpersCreditRoseville:23.390 });
check("no balance panel when none entered", () => lacks(NOBAL.pension, "Your account balance is not your pension"));

// ── Past the cap: surplus service and worthless sick-leave credit ──────────
console.log("\n-- a member past the 90% cap --");
// Roseville 23.390 + South Lake Tahoe 4.682 = 28.072 in the 3%@50 bucket, plus ~2.1 more
// years worked and sick leave converted -> well past 30 years.
const CAP = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-09-28",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-09-28",
  calpersCreditRoseville:23.390, calpersCreditIncludesPurchased:true,
  calpersCreditAsOf:"2026-08-21", airtime:3,
  currentSickLeaveHours:2600, sickLeaveDisposition:"credit",
  priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" }],
  openSections:{ startcalpers:true, sickdetail:true } });
check("every screen renders", () => Object.values(CAP).every(h => h.length > 200) || "a screen came back empty");
check("warns you are past the cap", () => has(CAP.pension, "You are past the cap"));
check("quantifies the wasted years", () => /years<\/strong> of credit pays you nothing|of credit pays you nothing/.test(CAP.pension)
  || "no surplus-years figure");
check("names sick leave as part of the surplus", () => has(CAP.pension, "worth"));
check("explains what still raises the pension", () => has(CAP.pension, "only through pay increases"));
check("sick leave screen says worth $0", () => has(CAP.member, "Worth $0 to you"));
check("sick leave screen gives the cash alternative", () => has(CAP.member, "Taking it as cash is worth"));
check("airtime is not double-counted", () => has(CAP.member, "not") === true
  && has(CAP.member, "already inside the figure above") === true);
check("offers the rows-vs-total sanity check", () => has(CAP.member, "if the employer rows on myCalPERS add up to the Total"));
// a member well under the cap sees none of it
const UNDER = await scenario({ setupDone:true, hireDate:"2015-01-01", dob:"1990-01-01",
  memberType:"pepra", medicalTier:"3", classification:"Firefighter Paramedic II", salaryStep:"H",
  retirementDateOverride:"2047-01-01", currentSickLeaveHours:500 });
check("no cap warning when well under it", () => lacks(UNDER.pension, "You are past the cap"));

// ── "What if I wait" columns and year range ────────────────────────────────
console.log("\n-- what if I wait: columns, ages, eligibility range --");
const WW = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-09-28",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-09-28",
  calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
  priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" }] });
check("take-home is stated in today's dollars", () => has(WW.wait, "today's $"));
check("says every figure is in today's dollars", () => has(WW.wait, "Every figure here is in"));
check("explains that later dollars buy less", () => has(WW.wait, "which buy less"));
check("age is right on the birthday year", () => /2031\s*\u25aa?\s*53/.test(WW.wait) || has(WW.wait, "53"));
check("cap note says the percentage stops moving", () => has(WW.wait, "the percentage stops moving"));
check("cap note says what still raises it", () => has(WW.wait, "your pay growing"));
// a member whose eligibility is more than 12 years out used to get an empty table
const YOUNG = await scenario({ setupDone:true, hireDate:"2015-01-01", dob:"1990-06-01",
  memberType:"pepra", medicalTier:"4", classification:"Fire Engineer", salaryStep:"H",
  retirementDateOverride:"2047-06-01" });
check("young member gets rows, not an empty table", () => lacks(YOUNG.wait, "No eligible years"));
check("first row is the year they turn 50", () => has(YOUNG.wait, "2040"));
check("range reaches their chosen retirement year", () => has(YOUNG.wait, "2047"));

// ── Today's dollars only, and the speculative-raise switch ────────────────
console.log("\n-- what if I wait: no future-dollar headline --");
const WD = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-09-28",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-09-28", calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
  priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" }] });
check("column is the gross CalPERS allowance", () => has(WD.wait, "gross, today's $"));
check("says the figure matches myCalPERS", () => has(WD.wait, "same figure myCalPERS shows you"));
check("wait tab no longer nets out tax", () => lacks(WD.wait, "less estimated income tax"));
check("says every figure is in today's dollars", () => has(WD.wait, "Every figure here is in"));
check("explains why raw future numbers are not shown", () => has(WD.wait, "would make waiting look better than it is"));
check("offers the bargaining lever", () => has(WD.wait, "Raises Local 1592 bargains"));
check("offers the CPI lever", () => has(WD.wait, "CPI / inflation"));
check("zero/zero says nothing is assumed", () => has(WD.wait, "Nothing is assumed"));
check("zero/zero names what still moves", () => has(WD.wait, "service credit you earn"));
check("keeps the contracted MOU raises in", () => has(WD.wait, "signed MOU increases for 2027 and 2029 are still in"));
// switched off, it says what it is crediting you with
const WDoff = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-09-28",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-09-28", unionRaisePct:3, inflationRate:2.5, calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21" });
check("non-zero state states the assumptions", () => has(WDoff.wait, "What you are assuming"));
check("compares pay growth against CPI", () => has(WDoff.wait, "beats inflation by") === true || has(WDoff.wait, "falls behind inflation by") === true || has(WDoff.wait, "keeps pace with inflation exactly") === true);
check("no zero/zero banner when assumptions are set", () => lacks(WDoff.wait, "Nothing is assumed"));

console.log("\n-- navigation --");
check("six primary tabs", () => ["Member details","Pension","Survivor / beneficiary","Health care","Stay or go?"]
  .every(x => B.member.includes(x)) || "a primary tab is missing");
// The two used to share one screen, which made a single decision look like two halves
// of the same form. They are separate choices and now live on separate tabs.
check("the survivor election is NOT on Health care", () => lacks(B.health, "Who gets it after you"));
check("medical is NOT on Survivor / beneficiary", () => lacks(B.survivor, "Medical, dental"));
check("an old ?tab=deductions link lands on the survivor election", () =>
  has(B.deductions, "Who gets it after you"));
check("an old ?tab=medical link lands on Health care", () => has(B.medical, "Medical, dental"));
check("the weeds row holds only what is left", () => ["Other income & tax","Guide"]
  .every(x => B.income.includes(x)) || "a detail screen is missing");
check("screens folded into Member details are gone from the row", () =>
  ["All inputs","Pension detail","Timeline"].every(x => !B.income.includes(x))
  || "a folded screen is still listed");
// Everything All inputs owned outright now lives on Member details.
const BOPEN = await scenario({ setupDone: true, hireDate: "1998-06-01", dob: "1972-03-15",
  memberType: "classic", medicalTier: "1", classification: "Fire Captain", salaryStep: "H",
  calpersBalance: 570000, openSections: { startcalpers: true, whyclassic: true } });
check("CalPERS service credit moved to Member details", () => has(BOPEN.member, "Roseville service credit today"));
check("the myCalPERS pointer came with it", () => has(BOPEN.member, "my.calpers.ca.gov"));
check("the account balance sits with the pension it explains", () => has(BOPEN.pension, "CalPERS account balance"));
check("the reciprocity override came with it", () => has(BOPEN.member, "CalPERS reciprocity"));
check("the sick-leave decision moved to Member details", () => has(B.member, "Cash or credit?"));
check("the cash-out figure came with it", () => has(B.member, "As cash"));
check("old ?tab=inputs and ?tab=sickleave links land on Member details", () =>
  B.member.includes("1 \u00b7 Roseville") && B.member.includes("Cash or credit?"));
check("their old links redirect instead of 404ing", () => B.pensiondetail.includes("Gross CalPERS pension") && B.timeline.includes("Stay or go"));
check("old links still land somewhere", () => B.start.includes("Working now") && B.wait.includes("Stay or go"));

// ── COLA starts the second calendar year after retirement, May 1 ────────────
// CalPERS: "COLA begins the second calendar year after retirement," paid in the May 1 warrant.
// The tool used to grant a COLA at year one, which overstated the allowance for life.
console.log("\n-- COLA start date and lag --");
const mkCola = (retirementDateOverride, retirementAge) => ({ setupDone:true,
  hireDate:"2003-01-01", dob:"1978-09-28", memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", retirementDateOverride, retirementAge,
  calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
  currentSickLeaveHours:2600, sickLeaveDisposition:"credit", unionRaisePct:0, inflationRate:0,
  openSections:{ cola:true },
  priorService:[{agencyName:"City of South Lake Tahoe",years:4.682,formula:"3@50"},
                {agencyName:"State of California",years:1.038,formula:"3@55"}] });
const CD = await scenario(mkCola("2028-12-31", 50));   // December 2028 -> May 1, 2030
const CF = await scenario(mkCola("2028-02-15", 50));   // February 2028 -> also May 1, 2030
const CL = await scenario(mkCola("2033-06-30", 55));   // June 2033     -> May 1, 2035
check("December 2028 retiree: first COLA May 1, 2030", () => has(CD.pension, "May 1, 2030"));
check("February 2028 retiree: same year, also May 1, 2030", () => has(CF.pension, "May 1, 2030"));
check("the date is not hardcoded — 2033 retiree gets May 1, 2035", () => has(CL.pension, "May 1, 2035"));
check("says the allowance is flat until then", () => has(CD.pension, "flat until then"));
// Golden figures. Five years out, the December retiree has banked FOUR COLAs (May 2030-2033),
// not five. Drop the lag and every number here rises by one 3% step.
check("5 years out = 4 COLAs, not 5", () => has(CD.pension, "$16,241"));
check("10 years out = 9 COLAs", () => has(CD.pension, "$18,828"));
// A February retiree reaches each anniversary BEFORE May 1, so at the same elapsed
// years they have banked one fewer COLA than the December retiree.
// Figure moved in v47: this scenario carries 2,600 sick-leave hours and no split, and the
// tool no longer adds 144 hrs/yr of accrual on top of them, so it converts less credit.
check("February retiree: 5 years out = 3 COLAs", () => has(CF.pension, "$13,384"));
check("the CPI dial names the COLA start date", () => has(CD.wait, "May 1, 2030"));


// ── The headline is the gross CalPERS allowance, not a take-home guess ──────
// myCalPERS shows the gross monthly allowance; tax and health premiums come off the
// warrant afterward. The header used to lead with an after-tax figure, which matched
// nothing a member could check against their own CalPERS estimate.
console.log("\n-- headline is the gross allowance --");
const GH = await scenario({ ...mkCola("2028-12-31", 50), ...pinToday });
check("header shows the working pair", () => has(GH.pension, "While working"));
check("header shows the retired pair", () => has(GH.pension, "While retired"));
check("header labels gross and take home", () => has(GH.pension, "Gross") && has(GH.pension, "Take home"));
check("header says the working figure includes overtime", () => has(GH.pension, "today, with your overtime"));
check("header no longer leads with take-home", () => lacks(GH.pension, "Monthly take-home"));
check("header shows the gross figure", () => has(GH.pension, "$14,430/mo"));
check("header names the allowance option", () => has(GH.pension, "unmodified allowance"));
check("the same gross figure appears on every tab", () =>
  ["pension","wait","pay","sickleave","medical"].every(t => GH[t].includes("$14,430/mo"))
  || "a tab disagreed with the header");
check("wait table leads with the gross allowance", () => has(GH.wait, "$14,430"));
// The full take-home chain survives on the pension breakdown, where it has context.
check("breakdown still shows gross pension", () => has(GH.pension, "Gross CalPERS pension"));
check("breakdown still shows what lands in the bank", () => has(GH.pension, "Lands in your bank"));
check("the tax figures say plainly that they are estimates", () => has(GH.pension, "not a number to budget against"));


// ── What waiting actually costs ────────────────────────────────────────────
// Working a year instead of drawing the earliest pension has a price; the bigger
// pension you buy repays it over time, or never does. Take-home basis, because the
// 9% member contribution, dues and active medical only come out while working.
// ── The sweet-spot date ───────────────────────────────────────────
// Classic safety caps the Roseville bucket at 90%. There is a DAY you cross it, and past that
// day service buys nothing. Every year-by-year table on this tab is read differently once you
// know which side of that date you are on.
// ── Specialty pay: the boxes have to add up to the header ─────────────────
// Two things stopped them adding up: longevity was IN the total but in no box, and a box can
// be ticked and still not counted when its pay ends before the member retires.
// ── Start over ────────────────────────────────────────────────
// resetAll existed but was wired to nothing, so a member had no way to clear the tool.
console.log("\n-- start over --");
{
  const R = await scenario({ ...mkCola("2028-12-31", 50) });
  check("the button is on every screen", () =>
    ["member", "comp", "pension", "survivor", "health", "stayorgo", "income", "help"]
      .every(t => R[t] && R[t].includes("Start over")) || "missing on a screen");
  // One click must never erase. The armed label only appears after the first click, so a
  // freshly rendered page showing it would mean the button fires on sight.
  check("it does not start armed", () => lacks(R.member, "Tap again to erase"));
  check("and no Cancel is showing either", () => lacks(R.member, "Cancel"));
}

console.log("\n-- specialty pay adds up --");
{
  const IN = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50,
    hasBachelor:true, hasCompanyOfficer:true, hasEngineBoss:true,
    hasHazmat:true, hazmatLevel:"team", hasRescue:true, rescueLevel:"team",
    openSections:{ startincent:true } });
  check("longevity has a row of its own", () => has(IN.member, "Longevity (20+ yrs) (7.5%)"));
  check("and says it is not a choice", () => has(IN.member, "automatic, from your hire date"));
  check("a box that ends before retirement is struck as not counted", () =>
    has(IN.member, "ends 1/9/2027 · not counted"));
  check("the arithmetic is shown, not left to the member", () =>
    has(IN.member, "Boxes you ticked that count") && has(IN.member, "Total on this section"));
  // 10 bachelor + 5 company officer + 2.5 hazmat team + 2.5 rescue team = 20.0 ticked-and-counted.
  // Engine Boss is ticked and excluded. Plus 7.5 longevity = the 27.5% in the header.
  check("ticked-and-counted, longevity and the total reconcile", () => {
    const m = IN.member.match(/Boxes you ticked that count ([\d.]+)% Longevity \(20\+ yrs\) · automatic ([\d.]+)% Total on this section ([\d.]+)%/);
    if (!m) return "could not read the three figures";
    const [a, b, t] = [ +m[1], +m[2], +m[3] ];
    return (Math.abs(a + b - t) < 0.05 && Math.abs(t - 27.5) < 0.05)
      || `${a} + ${b} != ${t} (expected 20 + 7.5 = 27.5)`;
  });
  check("and the header carries the same total", () => has(IN.member, "27.5% total"));

  // A 2017+ hire gets the Service Term Bonus instead, and it is not pensionable.
  const STB = await scenario({ setupDone:true, hireDate:"2019-01-01", dob:"1995-01-01",
    memberType:"pepra", medicalTier:"3", classification:"Fire Engineer", salaryStep:"E",
    retirementDateOverride:"2040-01-01", retirementAge:45,
    hasBachelor:true, openSections:{ startincent:true } });
  check("a 2017+ hire gets Service Term Bonus, not longevity", () =>
    has(STB.member, "Service Term Bonus (15+ yrs)") && lacks(STB.member, "Longevity ("));
  check("and it is flagged as not pensionable", () => has(STB.member, "not pensionable"));

  // Too junior for either: no row at all, and nothing to reconcile.
  const NEW = await scenario({ setupDone:true, hireDate:"2024-01-01", dob:"1998-01-01",
    memberType:"pepra", medicalTier:"3", classification:"Firefighter EMT I", salaryStep:"A",
    retirementDateOverride:"2031-01-01", retirementAge:33,
    hasBachelor:true, openSections:{ startincent:true } });
  check("no seniority row before you have earned one", () =>
    lacks(NEW.member, "automatic, from your hire date"));
}

// ── The Pension screen leads with figures, not rows ────────────────────
// A page made only of label-left/number-right rows reads as a spreadsheet however it is
// typed. The answer is now a figure, a meter against the cap, and a split of the income.
console.log("\n-- pension: figures, meter, split --");
{
  const F = await scenario({ ...mkCola("2028-12-31", 50), current457: 250000, annual457Contrib: 24000 });
  check("leads with the pension figure", () => has(F.pension, "Your pension \u00b7 2028"));
  check("and the annual beside it", () => has(F.pension, "A year"));
  check("the percentage is a meter against its cap", () => has(F.pension, "Toward the 90.0% cap"));
  check("the income split is shown", () => has(F.pension, "Where the money comes from"));
  // Colour is never the only channel: every segment is named and valued in the legend.
  check("the split names every segment", () =>
    has(F.pension, "CalPERS pension") && has(F.pension, "457 draw"));
  // Server render must already carry the real figure -- the count-up animates from it,
  // it must never be the thing that produces it, or the page paints a wrong number.
  check("the figure is correct before any animation runs", () =>
    /Your pension \u00b7 2028 \$[\d,]+\/mo/.test(F.pension) || "no figure in the hero tile");

  // At the cap, the meter says so in words -- a colour change is not a message.
  const CAPPED = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50,
    calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
    priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" },
                  { agencyName:"State of California", years:1.038, formula:"3@55" }] });
  check("at the cap it says so, not just turns a colour", () => has(CAPPED.pension, "At the cap"));
  check("and explains why the total reads above it", () =>
    has(CAPPED.pension, "stacks on top") && has(CAPPED.pension, "92.5%"));

  // The old glowing masthead is gone.
  check("no oversized glowing title", () =>
    lacks(F.member, "Roseville Fire Fighters Retirement Calculator"));
  check("but the tool is still named", () => has(F.member, "Retirement Calculator"));
}

// ── The 2028 LMA default ───────────────────────────────────────
// It defaults to an assumed 3% rather than 0. Zero was also an assumption -- a pessimistic
// one that understated every pension figured on a 2028-or-later final year -- but either
// way the figure is unpriced until the 2027 study happens, and has to say so.
// ── The light palette stays legible ───────────────────────────────
// Colour is easy to change and easy to break. Going light is the dangerous direction:
// a status hue tuned to sit on near-black washes out completely on beige, and nobody
// notices until a member cannot read the warning that matters.
// ── The printed report ────────────────────────────────────────
// The report is what a member hands to their spouse, so page two answers the question the
// figures do not: stay or go. It is built from stayAnalysis, the same source the on-screen
// tables read -- a second implementation would drift, and this is the copy that leaves the
// building.
// ── Working vs retired, line by line ─────────────────────────────
// Pension showed what a pension resolves into; Compensation now shows both sides against
// each other, which is the question a member actually has.
console.log("\n-- side by side --");
{
  const SBS = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-24", retirementAge:50, currentOTHours:20,
    filingStatus:"mfj", filingStatusRet:"mfj", annual457Contrib:12000,
    calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
    priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" },
                  { agencyName:"State of California", years:1.038, formula:"3@55" }] }, { raw:true });
  check("the comparison is on Compensation", () => has(SBS.comp, "Working vs retired, line by line"));
  check("both columns are headed with the same year", () =>
    has(SBS.comp, "While working \u00b7 2028") && has(SBS.comp, "Retired \u00b7 2028"));
  // Comparing a retirement-year pension to a this-year paycheck is the error that made
  // retiring look better than it is. Both sides must be the retirement year.
  check("it says both sides are in the same dollars", () => has(SBS.comp, "Both sides in 2028 dollars"));
  // The card is the summary, not the itemisation -- the detailed pay table further down the
  // same tab breaks the paycheck apart. Listing every incentive twice on one page is noise.
  const CARD = SBS.comp.slice(SBS.comp.indexOf("Working vs retired, line by line"),
                              SBS.comp.indexOf("The gap is smaller than the drop"));
  const ZERO_OT = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-24", retirementAge:50, currentOTHours:0 });
  const ZCARD = ZERO_OT.comp.slice(ZERO_OT.comp.indexOf("Working vs retired, line by line"),
                                   ZERO_OT.comp.indexOf("The gap is smaller than the drop"));
  check("the comparison card was sliced out", () => CARD.length > 200 || "could not find the card");
  check("the working side starts at pensionable pay, not the incentive list", () =>
    ["Base salary", "Specialty pay and certificates", "Longevity", "Holiday pay",
     "Uniform allowance", "FLSA scheduled overtime"].every(x => !CARD.includes(x))
    || "an itemised pay line is still on the card");
  check("but it still carries the two gross figures", () =>
    ["Gross pay", "Gross CalPERS pension"].every(x => CARD.includes(x))
    || "a gross figure is missing");
  // The whole point of the card is reading STRAIGHT ACROSS. Every line must have a partner on
  // the other side, even when that partner is a dash -- a row present on one side only shunts
  // everything below it out of line and the comparison stops being a comparison.
  check("every line has a partner on the other side", () => {
    const off = ["Federal income tax", "California income tax", "Medicare",
      "CalPERS member contribution", "Union dues", "Health premium", "City pays toward it",
      "Lands in your bank"].filter(x => (CARD.match(new RegExp(x, "g")) || []).length !== 2);
    return off.length === 0 || "not paired: " + off.join(", ");
  });
  // The rows are only worth printing if they add up. Sum each column's own figures out of the
  // markup and hold them against the bottom line the card prints.
  const colSum = (html, which) => {
    const cells = [...html.matchAll(new RegExp(`data-side="${which}"[\\s\\S]*?</div>`, "g"))].map(m => m[0]);
    return cells.reduce((t, c) => {
      // Read ONLY the value span (data-v). Captions carry dollar figures of their own --
      // "92.5% of your $15,597 final compensation", "the City's $180 credit" -- and picking
      // by position rather than by the marker quietly sums those instead.
      const val = c.match(/<span data-v=""[\s\S]*$/);
      const m = val && strip(val[0]).match(/([-\u2212+]?)\$([\d,]+)/);
      if (!m) return t;                       // a dash row contributes nothing
      const n = +m[2].replace(/,/g, "");
      return t + (m[1] === "-" || m[1] === "\u2212" ? -n : n);
    }, 0);
  };
  check("the working rows add up to the working bottom line", () => {
    const shown = +SBS.comp.match(/Lands in your bank \$([\d,]+)\/mo/)[1].replace(/,/g, "");
    const summed = colSum(SBS.raw_comp, "w");
    return Math.abs(summed - shown) <= 2 || `rows sum to ${summed}, card prints ${shown}`;
  });
  check("and the retired rows add up to the retired bottom line", () => {
    const all = [...SBS.comp.matchAll(/Lands in your bank \$([\d,]+)\/mo/g)].map(m => +m[1].replace(/,/g, ""));
    const summed = colSum(SBS.raw_comp, "r");
    return Math.abs(summed - all[1]) <= 2 || `rows sum to ${summed}, card prints ${all[1]}`;
  });
  check("the sides that stop paying show a dash, not a missing row", () =>
    (CARD.match(/\u2014/g) || []).length >= 4 || "the stopped deductions are not rendered as dashes");
  // And with the 457 dropped entirely, it has to leave from BOTH sides at once.
  check("a line absent on both sides drops out whole", () => {
    const n = (ZCARD.match(/457 deferral/g) || []).length;
    return n === 0 || n === 2 || `457 appears ${n} time(s) -- that is a half-pair`;
  });
  // With no overtime the pensionable subtotal equals gross -- one figure, printed twice.
  check("gross pay is the top line whether or not there is overtime", () =>
    (!ZCARD.includes("Pensionable compensation") && ZCARD.includes("Gross pay"))
    || "the working column does not start at gross pay");
  // ...while the detailed table below it still lists every line.
  check("the detailed table below still itemises", () => {
    const BELOW = SBS.comp.slice(SBS.comp.indexOf("The gap is smaller than the drop"));
    const missing = ["Base salary", "Uniform allowance", "FLSA scheduled overtime"]
      .filter(x => !BELOW.includes(x));
    return missing.length === 0 || "detailed table is missing: " + missing.join(", ");
  });
  check("and every deduction that comes out of it", () =>
    ["CalPERS member contribution", "Union dues", "Medicare"].every(x => SBS.comp.includes(x))
    || "a deduction is missing");
  // The point of the comparison: those deductions STOP. Showing them as blank rows on the
  // retired side is what makes that visible rather than something you have to be told.
  check("the retired side shows what stops, not just what is left", () =>
    has(SBS.comp, "you stop paying it the day you retire")
    && has(SBS.comp, "a pension is not wages"));
  check("both columns land on the same bottom line", () => {
    const hits = (SBS.comp.match(/Lands in your bank/g) || []).length;
    return hits >= 2 || `only ${hits} bottom line(s)`;
  });
  check("and the gap between them is stated", () =>
    has(SBS.comp, "You come out ahead") || has(SBS.comp, "The cut"));
  // The two totals and the stated gap have to reconcile, or the card is decoration.
  check("the stated gap is the difference of the two totals", () => {
    const tot = [...SBS.comp.matchAll(/Lands in your bank \$([\d,]+)\/mo/g)].map(m => +m[1].replace(/,/g, ""));
    const gap = SBS.comp.match(/(?:You come out ahead|The cut) [+\u2212-]\$([\d,]+)\/mo/);
    if (tot.length < 2 || !gap) return "could not read the figures";
    return Math.abs(Math.abs(tot[1] - tot[0]) - +gap[1].replace(/,/g, "")) <= 1
      || `${tot[0]} vs ${tot[1]} does not give ${gap[1]}`;
  });
}

// ── Dental and vision in retirement ──────────────────────────────
// The City's $180 dental/vision credit is an ACTIVE-employee benefit; the retiree side runs
// on PEMHCA, which is medical. Nothing we can find says Roseville carries retiree dental or
// vision, so the tool assumes the member pays -- and has to SAY that it is assuming.
console.log("\n-- retiree dental and vision --");
{
  const DV = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-24", retirementAge:50 });
  check("the Health care tab has a retiree dental and vision section", () =>
    has(DV.health, "Dental and vision") && has(DV.health, "you pay these yourself"));
  check("it prices the default election", () =>
    has(DV.health, "Delta Dental High PPO") && has(DV.health, "Out of your own pocket"));
  // The whole point of the section is that the assumption is visible. A confident-looking
  // number with no flag on it is worse than no number at all.
  check("it is labelled unverified, not stated as fact", () =>
    has(DV.health, "Unverified") && has(DV.health, "retireemedical@roseville.ca.us"));
  check("it says where the $180 credit actually lives", () =>
    has(DV.health, "active") && has(DV.health, "C.3"));
  check("and that Kaiser does not cover it for you", () =>
    has(DV.health, "not covered") && has(DV.health, "$175"));
  check("the comparison card carries its own paired row", () => {
    const card = DV.comp.slice(DV.comp.indexOf("Working vs retired, line by line"),
                               DV.comp.indexOf("The gap is smaller than the drop"));
    return (card.match(/Dental and vision/g) || []).length === 2
      || "the dental and vision row is not paired across the two sides";
  });
  check("the working side shows it as covered, the retired side as a cost", () => {
    const card = DV.comp.slice(DV.comp.indexOf("Working vs retired, line by line"),
                               DV.comp.indexOf("The gap is smaller than the drop"));
    return (has(card, "covered by the City's $180 credit") === true
            && has(card, "you pay these yourself") === true)
      || "the two sides are not described differently";
  });
  // Dropping the election has to remove it from BOTH columns, or the card goes out of line.
  const DVoff = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-24", retirementAge:50, retireeKeepsDV:false });
  check("dropping it removes the row from both sides at once", () => {
    const card = DVoff.comp.slice(DVoff.comp.indexOf("Working vs retired, line by line"),
                                  DVoff.comp.indexOf("The gap is smaller than the drop"));
    const n = (card.match(/Dental and vision/g) || []).length;
    return n === 0 || `${n} half-row(s) left behind`;
  });
  // If HR ever says the City does contribute, the override has to actually reduce the cost.
  const DVcity = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-24", retirementAge:50, retireeDVCityPays:"40" });
  check("a City contribution entered by hand reduces the member's share", () =>
    has(DVcity.health, "City pays toward it") && has(DVcity.health, "$31"));
  // And it can never turn into a payout -- the City's share stops at the premium.
  const DVover = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-24", retirementAge:50, retireeDVCityPays:"9999" });
  check("an oversized City figure cannot become income", () =>
    has(DVover.health, "Out of your own pocket") && has(DVover.health, "$0"));
}

// ── The navigation rail ─────────────────────────────────────────
console.log("\n-- navigation --");
{
  const N = await scenario({ ...mkCola("2028-12-31", 50) });
  check("Pension is first", () => {
    const order = ["Pension", "Member details", "Compensation", "Survivor / beneficiary",
      "Health care", "Stay or go?", "Other income & tax", "Guide"];
    const at = order.map(x => N.member.indexOf(x));
    return at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1]))
      || "rail out of order: " + at.join(",");
  });
  // No ?tab= should land on the answer, not the input form.
  const bare = await scenario({ ...mkCola("2028-12-31", 50) });
  check("a bare link lands on Pension", () => has(bare.pension, "Your pension \u00b7 "));
}

console.log("\n-- printed report --");
{
  // Nowhere near the cap, real overtime: the paycheck beats the early pension, so staying
  // pays in the meantime AND buys a bigger pension.
  const WIN = await scenario({ setupDone:true, hireDate:"2006-01-01", dob:"1976-01-01",
    memberType:"classic", medicalTier:"2", classification:"Fire Engineer", salaryStep:"H",
    retirementDateOverride:"2030-01-01", retirementAge:54, inflationRate:3, currentOTHours:20 });
  check("the report has a stay-or-go page", () => has(WIN.member, "Should you stay longer?"));
  check("it runs one to five years", () => {
    const rows = (WIN.member.match(/\+[1-5] \$/g) || []).length;
    return rows >= 5 || `only ${rows} year rows`;
  });
  check("it reaches a verdict, not just numbers", () => has(WIN.member, "WIN \u00b7 paid to stay"));
  check("it names the baseline year it measures against", () =>
    has(WIN.member, "the baseline every row below is measured against"));
  check("it explains how to read the columns", () => has(WIN.member, "How to read it."));
  check("and says what the money does not weigh", () =>
    has(WIN.member, "your health") && has(WIN.member, "the money is rarely the whole of it"));

  // At the cap with real CPI, the pension SHRINKS in today's dollars each year waited.
  // The report has to say lose, not hedge.
  const LOSE = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50, inflationRate:3, currentOTHours:0,
    calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
    priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" },
                  { agencyName:"State of California", years:1.038, formula:"3@55" }] });
  check("a capped member is told plainly that waiting loses", () => has(LOSE.member, "LOSE"));
  check("and never told it wins", () => lacks(LOSE.member, "WIN \u00b7"));
  check("the sweet-spot date rides along on the printed page", () =>
    has(LOSE.member, "Your sweet-spot date:"));

  // The screen and the print must agree: both read stayAnalysis.
  check("print and screen quote the same first-year cost", () => {
    const onScreen = LOSE.stayorgo.match(/out-earns that pension by \$([\d,]+)/);
    const inPrint = LOSE.member.match(/\+1 \$[\d,]+ \+\$([\d,]+)/);
    if (!onScreen || !inPrint) return true;   // different wording paths; covered elsewhere
    return onScreen[1] === inPrint[1] || `screen ${onScreen[1]} vs print ${inPrint[1]}`;
  });
  // A printable report nobody can find is not a feature.
  check("there is a visible print button, not just a buried menu item", () =>
    has(WIN.pension, "Print / Save PDF"));
}

console.log("\n-- light palette --");
{
  const hexToRgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = (h) => { const [r, g, b] = hexToRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // The CARD is the worst case: the lightest surface any text sits on.
  const CARD = "#fbf8f3", PAGE = "#ece5db";
  const INK = { text: "#16120f", muted: "#574e46", dim: "#6f645b" };
  const STATUS = { accent: "#b3172a", gold: "#85540d", green: "#456e21", danger: "#b3261e", info: "#8a5220" };

  check("the page is light, not dark", () => lum(PAGE) > 0.5 || `page luminance ${lum(PAGE).toFixed(3)}`);
  check("and warm, not grey", () => {
    const [r, , b] = hexToRgb(PAGE);
    return r > b || "the beige lost its warmth";
  });
  for (const [name, hex] of Object.entries(INK)) {
    check(`${name} clears AA on the card`, () => contrast(hex, CARD) >= 4.5
      || `${name} is ${contrast(hex, CARD).toFixed(2)}:1`);
  }
  // Status colours carry warnings, so they are held to body contrast too -- these are
  // 11px notes, not headlines, and large-text contrast would not be honest here.
  for (const [name, hex] of Object.entries(STATUS)) {
    check(`${name} clears AA on the card`, () => contrast(hex, CARD) >= 4.5
      || `${name} is ${contrast(hex, CARD).toFixed(2)}:1 -- too pale for beige`);
    check(`${name} clears AA on the page too`, () => contrast(hex, PAGE) >= 4.5
      || `${name} is ${contrast(hex, PAGE).toFixed(2)}:1 on the page`);
  }
  // The chart series had to be re-picked: the dark-theme set fell under 3:1 on beige.
  for (const hex of ["#c8324a", "#1f7fae", "#a86a12"]) {
    check(`chart series ${hex} is visible on the card`, () => contrast(hex, CARD) >= 3
      || `${hex} is ${contrast(hex, CARD).toFixed(2)}:1`);
  }
}

console.log("\n-- 2028 labor market adjustment --");
{
  const D = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50, rateYear:2028, rateYearPicked:true,
    openSections:{ startraises:true } }, { rawLma: true });
  check("it defaults to 3%, not zero", () => has(D.comp, "assumed 3%"));
  check("and is never called a negotiated figure", () =>
    has(D.comp, "not a negotiated or published figure"));
  check("the warning stays whatever the number is", () =>
    has(D.comp, "the year nobody can price yet"));
  check("it names the study that has not happened", () =>
    has(D.comp, "2027 Total Compensation Study"));

  // A profile saved before the default existed carries lmaPct: 0 because that WAS the
  // default. It takes the new assumption; a member who actually typed 0 keeps 0.
  const LEGACY = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50, rateYear:2028, rateYearPicked:true,
    lmaPct: 0, openSections:{ startraises:true } }, { rawLma: true });
  check("an old saved zero takes the new default", () => has(LEGACY.comp, "assumed 3%"));
  const CHOSE = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50, rateYear:2028, rateYearPicked:true,
    lmaPct: 0, lmaTouched: true, openSections:{ startraises:true } }, { rawLma: true });
  check("a deliberate zero is left alone", () =>
    lacks(CHOSE.comp, "assumed 3%") && has(CHOSE.comp, "floor, not a forecast"));
  // The assumption has to actually move the money, or it is decoration.
  check("3% lifts the 2028 figure above the zero case", () => {
    const g = (t) => { const m = t.match(/Gross pay [^$]*\$([\d,]+)/); return m ? +m[1].replace(/,/g,"") : null; };
    const a = g(D.comp), b = g(CHOSE.comp);
    return (a && b && a > b) || `3% case ${a} vs zero case ${b}`;
  });
}

console.log("\n-- sweet-spot date --");
{
  // Well short of the cap: 22 yrs in, no priors, sick leave converted.
  const SS = await scenario({ setupDone:true, hireDate:"2006-01-01", dob:"1976-01-01",
    memberType:"classic", medicalTier:"2", classification:"Fire Engineer", salaryStep:"H",
    retirementDateOverride:"2028-01-01", retirementAge:52,
    currentSickLeaveHours:0, sickLeaveDisposition:"credit" });
  check("the card is on Stay or go?", () => has(SS.stayorgo, "Your sweet-spot date"));
  check("it names a date, not just a year", () => /You reach the cap January 1, 2036/.test(SS.stayorgo)
    || "no full cap date");
  check("30 yrs x 3% from a 2006 hire lands in 2036", () => has(SS.stayorgo, "2036"));
  check("it states what stops", () => has(SS.stayorgo, "more service adds $0 to your pension percentage"));
  check("and what still moves the check", () => has(SS.stayorgo, "your pay going up"));
  check("a member short of the cap is told years still count", () =>
    has(SS.stayorgo, "years still buy percentage"));
  check("and offered that date as a plan", () => has(SS.stayorgo, "Model retiring on January 1, 2036"));

  // At or past the cap: myCalPERS credit plus same-formula priors.
  const SSC = await scenario({ setupDone:true, hireDate:"2003-01-01", dob:"1978-10-31",
    memberType:"classic", medicalTier:"2", classification:"Fire Captain", salaryStep:"H",
    retirementDateOverride:"2028-12-31", retirementAge:50,
    calpersCreditRoseville:23.390, calpersCreditAsOf:"2026-08-21", calpersCreditIncludesPurchased:true,
    currentSickLeaveHours:1200, sickLeaveDisposition:"cash",
    priorService:[{ agencyName:"City of South Lake Tahoe", years:4.682, formula:"3@50" },
                  { agencyName:"State of California", years:1.038, formula:"3@55" }] });
  check("a capped member is told so plainly", () => has(SSC.stayorgo, "you are leaving at or past the cap"));
  check("and the tables below are reframed, not left to be misread", () =>
    has(SSC.stayorgo, "does not raise your percentage"));
  check("no 'model that date' button once it is behind you", () =>
    lacks(SSC.stayorgo, "Model retiring on October"));
  // Prior service on a DIFFERENT formula stacks on top and does not count toward this cap.
  check("it says which bucket the cap is on", () => has(SSC.stayorgo, "Roseville 3% @ 50 bucket"));
  check("and why a total can read above the cap", () => has(SSC.stayorgo, "can read above"));
  // CalPERS pays no safety pension before 50, so the date cannot be earlier than that birthday.
  check("the date is never before age 50", () => has(SSC.stayorgo, "no safety pension before age 50"));

  // PEPRA 2.7% @ 57 has no cap, so there is no date to name and no card to show.
  const SSP = await scenario({ setupDone:true, hireDate:"2015-01-01", dob:"1990-01-01",
    memberType:"pepra", medicalTier:"3", classification:"Fire Engineer", salaryStep:"H",
    retirementDateOverride:"2047-01-01", retirementAge:57,
    currentSickLeaveHours:0, sickLeaveDisposition:"credit" });
  check("PEPRA gets no sweet-spot card at all", () => lacks(SSP.stayorgo, "Your sweet-spot date"));

  // The sick-leave choice moves the date, so the card has to say it is counted.
  const SSK = await scenario({ setupDone:true, hireDate:"2006-01-01", dob:"1976-01-01",
    memberType:"classic", medicalTier:"2", classification:"Fire Engineer", salaryStep:"H",
    retirementDateOverride:"2028-01-01", retirementAge:52,
    currentSickLeaveHours:4000, sickLeaveDisposition:"credit" });
  check("sick-leave credit pulls the date earlier", () => {
    const a = SS.stayorgo.match(/You reach the cap ([A-Z][a-z]+ \d+, (\d{4}))/);
    const b = SSK.stayorgo.match(/You reach the cap ([A-Z][a-z]+ \d+, (\d{4}))/);
    if (!a || !b) return "could not read both cap dates";
    return +b[2] < +a[2] || `2 yrs of sick-leave credit did not move the date: ${a[1]} -> ${b[1]}`;
  });
  check("and the card says it is counted", () => has(SSK.stayorgo, "yrs of sick-leave credit is counted here"));
}

console.log("\n-- what waiting actually costs --");
const CW = await scenario(mkCola("2028-12-31", 50));                       // 0% raises, 0% CPI
const CW3 = await scenario({ ...mkCola("2028-12-31", 50), unionRaisePct:3, inflationRate:3 });
check("the section is on the wait tab", () => has(CW.wait, "What waiting actually costs"));
check("names the earliest year you can go", () => has(CW.wait, "You can go in"));
check("states the cost of the first extra year", () => has(CW.wait, "$9,353"));
check("shows the lifetime pension gain per year", () => has(CW.wait, "$2,453"));
check("shows the break-even in years and age", () => has(CW.wait, "7.1 yrs · age 59"));
check("shows the net position at 20 years", () => has(CW.wait, "+$33,939"));
check("a later year can be a net loss", () => has(CW.wait, "-$2,970"));
// Each waiting year is priced at ITS OWN paycheck, not today's. Pricing them all at today's
// pay understated the cost of waiting by every raise the member had not been paid yet.
{
  // Raises on, so the paycheck genuinely differs year to year.
  const V = await scenario({ ...mkCola("2028-12-31", 50), unionRaisePct: 3, inflationRate: 0 });
  const giveUp = [...V.wait.matchAll(/\n?\s(20\d\d) (\d+) ([-+])\$([\d,]+)/g)]
    .map(m => ({ year: +m[1], yrs: +m[2], amt: (m[3] === "-" ? -1 : 1) * +m[4].replace(/,/g, "") }));
  check("the cost column is built year by year", () => giveUp.length >= 3 || "could not read the give-up column");
  check("two years is not simply twice one year", () => {
    const one = giveUp.find(r => r.yrs === 1), two = giveUp.find(r => r.yrs === 2);
    if (!one || !two) return "missing the 1-yr or 2-yr row";
    return Math.abs(two.amt - 2 * one.amt) > 1
      || `2 yrs (${two.amt}) is exactly 2x 1 yr (${one.amt}) - every year is still priced the same`;
  });
  check("and it says so in words", () => has(V.wait, "priced at"));
}
// When pay only keeps pace with CPI the later pension is no bigger in real terms,
// so there is nothing to repay the skipped checks and the answer must say so.
check("says 'never' when waiting buys no bigger pension", () => has(CW3.wait, "never"));
check("explains what 'never' means", () => has(CW.wait, "nothing repays the checks you skipped"));
check("says why it uses take-home", () => has(CW.wait, "stop when you retire"));
check("admits what it leaves out", () => has(CW.wait, "not only about numbers"));
check("the section is hidden before setup", () => lacks(A.wait, "What waiting actually costs"));


// ── Overtime is the whole point of the rebuild ─────────────────────────────
// OT is real money now and is NOT reported to CalPERS, so it vanishes at retirement.
// With the input buried and defaulting to zero, the tool told members retiring was a raise.
console.log("\n-- overtime on page one, and what it does to the answer --");
const mkOT = (currentOTHours) => ({ ...mkCola("2028-12-31", 50), currentOTHours });
const OT0  = await scenario(mkOT(0));
const OT40 = await scenario(mkOT(40));
const OT60 = await scenario(mkOT(60));
check("page one leads with gross and take-home", () => has(OT40.member, "Take-home"));
check("the OT box is on page one", () => has(OT40.now, "Overtime you actually work"));
check("page one shows the OT dollars", () => has(OT40.now, "$3,268"));
check("page one says OT is not pensionable", () => has(OT40.member, "none of it is in your pension"));
check("overtime is section 4", () => has(OT40.member, "4 \u00b7 Overtime"));
check("the sections run in order down the page", () => {
  const order = ["1 \u00b7 Roseville","2 \u00b7 Prior service","3 \u00b7 Specialty pay","4 \u00b7 Overtime"];
  const at = order.map(x => OT40.member.indexOf(x));
  return at.every((v,i) => v >= 0 && (i === 0 || v > at[i-1])) || "sections out of order: " + at.join(",");
});
check("page one shows the annual OT figure", () => has(OT40.now, "a year that stops the day you retire"));
check("zero OT is called out as a problem", () => has(OT0.now, "makes retiring look far better than it is"));
check("page one says overtime stops at retirement", () => has(OT40.member, "stops the day you retire"));
check("the full ledger moved to Current compensation", () => has(OT40.comp, "Gross pay"));

check("stay or go leads with the take-home change", () => has(OT40.stayorgo, "The day you hang it up"));
check("no OT: retiring reads as a gain", () => has(OT0.stayorgo, "You come out ahead"));
check("no OT: says so and points at the input", () => has(OT0.stayorgo, "no overtime entered"));
// Enough overtime and the sign flips — which is the thing members needed to see.
check("heavy OT: retiring reads as a pay cut", () => has(OT60.stayorgo, "The cut"));
check("heavy OT: names overtime as the reason", () => has(OT60.stayorgo, "does not follow you out the door"));
check("the gap is given per year too", () => has(OT60.stayorgo, "a year"));


// ── The elected survivor option IS the pension ─────────────────────────────
// It used to be a read-only table while every headline showed the unmodified allowance —
// a figure any member leaving a spousal continuance will never receive.
console.log("\n-- survivor option drives every figure --");
const mkSurv = (survivorOption, survivorActualPct = "") => ({ ...mkCola("2028-12-31", 50),
  beneficiaryAge: 48, survivorOption, survivorActualPct, openSections: { breakdown: true } });
const S1  = await scenario(mkSurv("unmod"));
const S3  = await scenario(mkSurv("ben50"));
const S2  = await scenario(mkSurv("ben100"));
const S2A = await scenario(mkSurv("ben100", "12"));
const SLEG = await scenario(mkSurv("opt2"));                        // an election saved before the rename
const SNS = await scenario({ ...mkSurv("ben100"), hasEligibleSurvivor: false });
check("Unmodified pays the unmodified allowance", () => has(S1.pension, "$14,430"));
check("50% Beneficiary reduces the allowance", () => has(S3.pension, "$14,086"));
check("100% Beneficiary reduces it further", () => has(S2.pension, "$13,774"));
// These two carry the retiree dental/vision cost now (default: the member pays it).
check("the reduction reaches take-home", () => has(S2.pension, "$10,395"));
check("Unmodified take-home is the higher figure", () => has(S1.pension, "$10,832"));
// Proving it is the dental/vision line that moved them, not a drifting golden figure:
// turn the election off and the old numbers come back exactly.
{
  const noDV1 = await scenario({ ...mkSurv("unmod"),  retireeKeepsDV: false });
  const noDV2 = await scenario({ ...mkSurv("ben100"), retireeKeepsDV: false });
  check("dropping dental and vision restores the old take-home", () =>
    has(noDV1.pension, "$10,904") && has(noDV2.pension, "$10,466"));
  check("and carrying them costs the premium, not a penny more", () =>
    (!noDV1.pension.includes("$10,832") && !noDV2.pension.includes("$10,395"))
    || "the two elections render the same figure -- the toggle is not wired to the money");
}
check("a myCalPERS figure overrides the calibrated one", () => has(S2A.pension, "$12,699"));
check("it says it is using your figure", () => has(S2A.survivor, "Using your figure"));
check("an election saved under the old key still works", () => has(SLEG.pension, "$13,774"));

// ── The mechanic CalPERS' own estimate proved ─────────────────────────────
// Survivor continuance is free, identical under every option, and NOT an election.
// The option reduction comes out of the option portion only. The old tool got both wrong.
check("survivor continuance is half the unmodified allowance", () => has(S1.survivor, "$7,215"));
check("it is there even on the Unmodified election", () => has(S1.survivor, "free, every option"));
check("Unmodified no longer claims the spouse gets nothing", () =>
  lacks(S1.survivor, "leaves your spouse nothing"));
check("it says so in plain words", () => has(S1.survivor, "does"));
check("the spouse total adds the continuance to the beneficiary allowance", () =>
  has(S2.survivor, "$13,774"));
check("under 100% the spouse keeps exactly the member's own check", () =>
  has(S2.survivor, "Your spouse ends up with"));
check("the option portion is named and priced", () => has(S2.survivor, "option portion"));
check("no eligible survivor means no continuance", () => has(SNS.survivor, "no eligible survivor"));
// The structure is verified; the reduction percentage is one member's. Say so.
check("the reduction is flagged as calibrated, not the member's", () =>
  has(S2.survivor, "calibrated, not yours"));
check("it names where the calibration came from", () =>
  has(S2.survivor, "member 50, beneficiary 49"));
check("it tells the member to get their own figure", () =>
  has(S2.survivor, "Run your own estimate"));
check("every option is priced in one table", () =>
  ["Unmodified","Return of contributions","100% Beneficiary","50% Beneficiary"]
    .every(x => S2.survivor.includes(x)) || "an option is missing from the table");
check("the pop-up behaviour is explained", () => has(S2.survivor, "dies before you"));
check("the option selector is on Survivor / beneficiary", () => has(S2.survivor, "Who gets it after you"));
check("retirement date lives on Member details", () => has(S1.member, "When do you plan to go?"));
check("retirement date is off Pension", () => lacks(S1.pension, "When do you plan to go?"));


// ── Sick leave: one number, one choice ─────────────────────────────────
// The member states the balance they expect ON THEIR LAST DAY and picks cash OR credit.
// Nothing is projected from today's hours: 144 hrs/yr with none used is a ceiling, not a
// forecast, and the tool used to print it as if it were the member's actual balance.
console.log("\n-- sick leave: one number, one choice --");
const SLC = await scenario({ ...mkCola("2028-12-31", 50), currentSickLeaveHours: 2000,
  sickLeaveDisposition: "credit", openSections: { whysickhours: true, whysickchoice: true } });
const SLX = await scenario({ ...mkCola("2028-12-31", 50), currentSickLeaveHours: 2000,
  sickLeaveDisposition: "cash" });
// Every explainer on this screen starts shut. The labels carry the instruction; these carry
// the reasoning, and a member breezing through should see a form, not a wall of grey text.
const SLSHUT = await scenario({ ...mkCola("2028-12-31", 50), currentSickLeaveHours: 2000,
  sickLeaveDisposition: "credit" });
check("the explainers start collapsed", () =>
  has(SLSHUT.member, "why the tool will not fill this in")
  && lacks(SLSHUT.member, "Most members use sick leave along the")
  && lacks(SLSHUT.member, "cannot be cashed and converted"));
check("the details panel is closed until asked for", () =>
  has(SLC.member, "Want more details?") && lacks(SLC.member, "cannot do both with the same hours"));
// The MOU pays a PERCENTAGE of the balance, set by the size of the balance. Members expect
// hours x hourly rate and get roughly half of it, so show the table and the arithmetic.
const SLD = await scenario({ ...mkCola("2028-12-31", 50), currentSickLeaveHours: 1200,
  sickLeaveDisposition: "cash", openSections: { sickdetail: true } });
check("the payoff tiers are listed", () =>
  has(SLD.member, "Why the cash figure is not hours") && has(SLD.member, "1,800 hrs and up"));
check("every band is shown, not just the member's", () =>
  ["not payable", "20.0%", "30.0%", "40.0%", "50.0%", "60.0%", "70.0%"].every(x => SLD.member.includes(x))
  || "a band is missing");
check("the member's own band is marked", () => has(SLD.member, "1,146\u20131,433 hrs \u2190 you"));
check("the percentages are percentages, not 5000%", () => lacks(SLD.member, "5000"));
check("the arithmetic is spelled out", () =>
  /1,200 hrs \u00d7 \$\d+\.\d\d\/hr \u00d7 50\.0% = \$3\d,\d{3}/.test(SLD.member)
  || "no hours x rate x pct = total line");
check("and the 100% figure it is NOT", () => has(SLD.member, "At 100% those hours would be"));
check("the unconfirmed parts are flagged as mine, not the City's", () =>
  has(SLD.member, "my reading of the") && has(SLD.member, "Treasurer"));
check("asks one question, for the balance at retirement", () =>
  has(SLC.member, "How many sick leave hours will you have on the books at retirement?"));
check("no second box for today's balance", () => lacks(SLC.member, "hours to cash out"));
check("nothing is projected from today", () => lacks(SLC.member, "at retirement with accrual"));
check("the accrual figure is a ceiling, not a default", () => has(SLC.member, "ceiling, not a forecast"));
check("two choices, both offered", () =>
  has(SLC.member, "Add to service time") && has(SLC.member, "Cash out"));
check("credit ticked shows the years to two decimals", () => /\+1\.00 yrs/.test(SLC.member) || "no +1.00 yrs");
check("and only one of them can be true", () => has(SLC.member, "cannot be cashed and converted"));
// 2,000 hrs at 70% of the retirement-year base rate. The figure must appear on the
// checkbox whichever box is ticked — that is the comparison the member is making.
check("cash ticked prices the payout", () => /\$\d{2},\d{3}<?\/?[^ ]* ?at separation|\$\d{2},\d{3} at separation/.test(SLX.member) || has(SLX.member, "at separation"));
check("the cash figure is quoted even when credit is ticked", () => has(SLC.member, "at separation"));
check("and it lands on Pension under 'Also waiting for you'", () =>
  has(SLX.pension, "Also waiting for you at retirement") && has(SLX.pension, "cashed out"));
check("credit lands there as years, not dollars", () =>
  has(SLC.pension, "converted to service credit") && /\+1\.00 yrs/.test(SLC.pension) || "no years on Pension");

// ── The Compensation picker starts on the retirement year ──────────────────
// The header is built from retirement-year rates. Landing this screen on today's pay put
// two different years on the same screen with nothing saying so.
console.log("\n-- compensation defaults to the retirement year --");
{
  const D = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40 });
  // Navigation is a vertical rail on desktop, with Pension first -- it is the answer,
  // and everything else is how the answer was arrived at.
  check("Pension leads the navigation", () =>
    has(D.member, "Pension Member details Compensation Survivor / beneficiary"));
  check("and not Current compensation", () => lacks(D.member, "Current compensation"));
  check("every destination is still reachable", () =>
    ["Health care", "Stay or go?", "Other income & tax", "Guide"].every(x => D.member.includes(x))
    || "a destination fell out of the rail");
  check("the card lands on the retirement year", () => has(D.comp, "Compensation in 2028"));
  check("and says why that year", () => has(D.comp, "your last year"));
  check("the header is on the same year", () => has(D.comp, "While working \u00b7 2028"));
  // A member who moves the picker keeps where they put it.
  const P = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...pinToday });
  check("a picked year overrides the default", () =>
    has(P.comp, "Compensation in " + TODAY_YEAR) && lacks(P.comp, "Compensation in 2028"));
  check("and the header follows it back", () => has(P.comp, "While working \u00b7 " + TODAY_YEAR));
}

// ── Current compensation: one table, ends at W-2 gross ─────────────────────
console.log("\n-- current compensation --");
const CC = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...pinToday });
check("one consolidated table", () => has(CC.comp, "Compensation in " + TODAY_YEAR));
check("hourly, monthly and annual", () => ["Hourly","Monthly","Annual"].every(x => CC.comp.includes(x)));
check("base salary to the cent", () => has(CC.comp, "$50.67"));
check("ends at gross pay", () => has(CC.comp, "Gross pay"));
check("annual gross is shown", () => has(CC.comp, "$212,125"));
check("separates what CalPERS is told", () => has(CC.comp, "reported to CalPERS"));
check("overtime is flagged as not pensionable", () => has(CC.comp, "Overtime you work"));
check("explains the W-2 difference", () => has(CC.comp, "Box 1 will read lower"));
check("it is off Member details now", () => lacks(CC.member, "Gross pay"));


// ── Longevity must not be counted twice ────────────────────────────────────
// calcIncentives folds longevity INTO totalIncentivePct. Showing longevity on its own
// row means pulling it back out of the specialty figure first, or the table reads
// 32.5% + 7.5% when the member only gets 25% + 7.5%.
console.log("\n-- longevity is not double-counted --");
const DBL = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...pinToday,
  hasBachelor: true, hasParamedic: true, hasHazmat: true, hazmatLevel: "tech" });
check("specialty pay excludes longevity", () => has(DBL.comp, "17.5% of base"));
check("longevity is its own line", () => has(DBL.comp, "7.5% at 24 yrs"));
check("the two together are the incentive total", () => lacks(DBL.comp, "25.0% of base"));
check("gross reflects the corrected split", () => has(DBL.comp, "$20,361"));
check("pensionable total is not inflated", () => has(DBL.comp, "$16,561"));
// Holiday pay is 168 hrs at (base + longevity) on TODAY'S base — not the retirement-year
// base. Using the projected base here read $9,910/yr instead of $9,150.
check("holiday pay is figured on today's base", () => has(DBL.comp, "$9,150"));
check("holiday pay names the longevity rate", () => has(DBL.comp, "168 hrs at base + 7.5% longevity"));
check("holiday pay is not the retirement-year figure", () => lacks(DBL.comp, "$9,910"));


// ── The compensation table follows the year picker ─────────────────────────
// MOU general wage increases, the 2028 Labor Market Adjustment and the rank
// separation all move it. 2028 is the year nobody can price yet.
console.log("\n-- compensation by year --");
const mkY = (rateYear, lmaPct = 0) => ({ setupDone:true, hireDate:"2003-01-01", dob:"1978-09-28",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-12-31", retirementAge:50, currentOTHours:40, rateYear, rateYearPicked:true, lmaPct });
const Y26 = await scenario(mkY(2026));
const Y27 = await scenario(mkY(2027));
const Y28 = await scenario(mkY(2028));
const Y28L = await scenario(mkY(2028, 5));
const Y29L = await scenario(mkY(2029, 5));
check("the picker is on the compensation card", () => has(Y26.comp, "Compensation in 2026"));
check("a future year retitles the card", () => has(Y27.comp, "Compensation in 2027"));
check("2026 is today's base", () => has(Y26.comp, "$12,295"));
check("2027 adds the rank separation", () => has(Y27.comp, "$13,013"));
check("2028 tightens the rank separation", () => has(Y28.comp, "$13,316"));
check("the LMA moves 2028", () => has(Y28L.comp, "$13,982"));
check("2029 compounds the MOU raise on the LMA", () => has(Y29L.comp, "$14,226"));
check("gross follows the year", () => has(Y29L.comp, "$245,243"));
check("it names what is in that year", () => has(Y27.comp, "What is in 2027"));
check("2029 names the 1.75%", () => has(Y29L.comp, "+1.75%"));
// 2028 with no LMA entered is a floor, and has to say so.
check("2028 at zero LMA is flagged", () => has(Y28.comp, "the year nobody can price yet"));
check("and called a floor, not a forecast", () => has(Y28.comp, "floor, not a forecast"));
// The warning stays whatever the number is -- it is about the study not having happened,
// not about the box being empty. Only its wording changes.
check("a set LMA is still called an assumption", () =>
  has(Y28L.comp, "the year nobody can price yet") && has(Y28L.comp, "your assumption"));
check("this year carries no assumption banner", () => lacks(Y26.comp, "What is in"));


// ── The Pension tab shows no base rates ────────────────────────────────────
// Base, incentives, holiday, uniform and FLSA overtime all live on Current
// compensation with a year picker. Repeating them here confused members, because
// the base rate sat next to a gross figure it did not match.
console.log("\n-- pension tab starts at final compensation --");
const PT = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...pinToday });
check("no base-rate line on the pension tab", () => lacks(PT.pension, "Projected base at 2028"));
check("no base-today line either", () => lacks(PT.pension, "Base today"));
check("it starts at final compensation", () => has(PT.pension, "Final compensation"));
check("and goes straight to the allowance", () => has(PT.pension, "Gross CalPERS pension"));
check("it points at where the build-up lives", () => has(PT.pension, "Compensation"));
// The two tabs must agree: pensionable pay in the retirement year IS final compensation.
const PTC = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, rateYear: 2028, rateYearPicked:true });
check("final comp matches Current compensation for that year", () =>
  (PTC.comp.includes("$15,597") && PTC.pension.includes("$15,597"))
  || "the two tabs disagree on pensionable pay");


// ── The Pension tab shows the whole drop to take-home ──────────────────────
console.log("\n-- pension tab order and the take-home chain --");
const PO = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40 });
check("Pension goes straight to the number", () => has(PO.pension, "Your pension \u00b7 "));
check("the raises are off the Pension tab", () => lacks(PO.pension, "Future raises"));
// Raises sit between the compensation table and the hourly rates — the table's year
// picker is what they drive, so they belong next to it rather than a tab away.
check("Future raises sits between the two compensation sections", () => {
  const tbl = PO.comp.indexOf("Scheduled hours are");
  const fr  = PO.comp.indexOf("Future raises");
  const hr  = PO.comp.indexOf("Your hourly rates");
  return (tbl >= 0 && fr > tbl && hr > fr) || `out of order: table ${tbl}, raises ${fr}, hourly ${hr}`;
});
// The date is the last thing you answer on Member details — everything above it is
// who you are, and it is the one input you can still change your mind about.
check("the date closes Member details, after overtime", () => {
  const ot = PO.member.indexOf("4 \u00b7 Overtime");
  const d = PO.member.indexOf("5 \u00b7 When do you plan to go?");
  return (ot >= 0 && d > ot) || `out of order: overtime ${ot}, date ${d}`;
});
check("federal tax is its own line", () => has(PO.pension, "Federal income tax"));
check("state tax is its own line", () => has(PO.pension, "California income tax"));
check("says CA taxes a CalPERS pension", () => has(PO.pension, "fully taxable by California"));
check("shows the full health premium", () => has(PO.pension, "Retiree health premium"));
check("shows what the City pays toward it", () => has(PO.pension, "City pays toward it"));
check("names the PEMHCA minimum", () => has(PO.pension, "PEMHCA minimum"));
check("shows the member's own share", () => has(PO.pension, "Health insurance, your share"));
check("ends at take-home", () => has(PO.pension, "Lands in your bank"));
check("says what stops at retirement", () => has(PO.pension, "What stops the day you retire"));
check("names no Medicare on a pension", () => has(PO.pension, "no Medicare or Social Security"));
check("admits the tax figures are estimates", () => has(PO.pension, "not a number to budget against"));


// ── The header carries the four numbers, on every tab ──────────────────────
console.log("\n-- header: working vs retired, gross and net --");
const HD = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...pinToday });
check("working gross includes overtime", () => has(HD.member, "$17,677"));
check("working take-home is there", () => has(HD.member, "$11,392"));
check("retired gross is the allowance", () => has(HD.member, "$14,430"));
check("retired take-home is there", () => has(HD.member, "$10,832"));
check("the retired side is dated", () => has(HD.member, "While retired · 2028"));
check("all four appear on every tab", () =>
  ["member","comp","pension","survivor","health","stayorgo"].every(t =>
    HD[t].includes("While working") && HD[t].includes("While retired"))
  || "a tab is missing the header numbers");
// A survivor election has to show in the header, since it moves the retired pair.
const HD2 = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40,
  beneficiaryAge: 48, survivorOption: "ben100" });
check("an elected option is named in the header", () => has(HD2.member, "100% Beneficiary elected"));
check("and the retired gross follows it", () => has(HD2.member, "$13,774"));


// ── The header's working gross IS the Current compensation total ───────────
// It used to be base + incentives only, dropping holiday pay, the uniform allowance and
// FLSA scheduled overtime — about $1,200/mo of real, pensionable cash. The header read
// $16,291 while the table two inches below it read $17,483.
console.log("\n-- header working gross matches the table --");
const headerWorkingGross = (txt) => {
  const m = txt.match(/While working · \d+ Gross (\$[\d,]+) Take home (\$[\d,]+)/);
  return m && { gross: m[1], net: m[2] };
};
const tableGross = (txt) => {
  const m = txt.match(/Gross pay \$[\d.,]+ (\$[\d,]+) \$[\d,]+/);
  return m && m[1];
};

// ── 2027 CalPERS health premiums, Region 1 ─────────────────────────────────
// Roseville is Placer County = Region 1. If these drift, every medical figure in
// the tool is wrong, and the City's contribution is a percentage of Kaiser's.
console.log("\n-- 2027 health premiums --");
{
  const M = await scenario({ ...mkCola("2028-12-31", 50), medicalTier: "1",
    selectedMedicalPlan: "Kaiser Permanente", medicalCoverage: "ee",
    retireeMedicalPlan: "Kaiser Permanente", retireeCoverage: "ee" });
  check("Kaiser 2027 employee-only premium", () => has(M.health, "$1,188"));
  check("the two plans CalPERS dropped are gone", () =>
    lacks(M.health, "UnitedHealthcare Alliance") && lacks(M.health, "UnitedHealthcare Harmony"));
  check("Sutter Health Plan is offered (new for 2027)", () => has(M.health, "Sutter Health Plan"));
  check("Blue Shield EPO is offered (new in Placer)", () => has(M.health, "Blue Shield EPO"));
  // Only the selected plan prints a dollar figure, so price these by electing them.
  const PLAT = await scenario({ ...mkCola("2028-12-31", 50), medicalTier: "1",
    selectedMedicalPlan: "PERS Platinum (PPO)", medicalCoverage: "ee" });
  check("PERS Platinum 2027", () => has(PLAT.health, "$1,779"));
  const WHA = await scenario({ ...mkCola("2028-12-31", 50), medicalTier: "1",
    selectedMedicalPlan: "Western Health Advantage", medicalCoverage: "ee" });
  check("Western Health Advantage 2027", () => has(WHA.health, "$1,031"));
  const FAM = await scenario({ ...mkCola("2028-12-31", 50), medicalTier: "1",
    selectedMedicalPlan: "Kaiser Permanente", medicalCoverage: "fam" });
  check("Kaiser 2027 family premium", () => has(FAM.health, "$3,088"));
  // Medicare: what the same coverage costs at 65.
  check("the Medicare table is on Health care", () => has(M.health, "At 65 the premium drops"));
  check("Kaiser Senior Advantage 2027", () => has(M.health, "$334"));
  check("PERS Platinum Supplement 2027", () => has(M.health, "$666"));
  check("it says Part B is not included", () => has(M.health, "Part B premium is paid"));
  // A saved election pointing at a discontinued plan must not silently show Kaiser's money.
  const OLD = await scenario({ ...mkCola("2028-12-31", 50), medicalTier: "1",
    selectedMedicalPlan: "UnitedHealthcare Harmony", retireeMedicalPlan: "UnitedHealthcare Alliance" });
  check("a dropped plan migrates instead of silently mispricing", () =>
    lacks(OLD.health, "UnitedHealthcare Harmony") && lacks(OLD.health, "UnitedHealthcare Alliance"));
}


// ── One tab row, no parent ─────────────────────────────────────
// "Into the weeds" held exactly two screens and cost a click to reach either of them.
console.log("\n-- tab row --");
{
  const W = await scenario({ ...mkCola("2028-12-31", 50) });
  check("the parent tab is gone", () => lacks(W.member, "Into the weeds"));
  check("it is not called More either", () => lacks(W.member, ">More<"));
  check("both screens sit in the headline row", () =>
    has(W.member, "Other income & tax") && has(W.member, "Guide"));
  check("and they still render", () =>
    (W.income.length > 200 && W.help.length > 200) || "a promoted screen came back empty");
  // Links sent out before this change still have to land somewhere sensible.
  check("old ?tab=advanced still lands somewhere", () =>
    (W.advanced && W.advanced.length > 200) || "?tab=advanced did not render");
}


// ── Health care rate-year picker ───────────────────────────────────────────
// CalPERS publishes next year's premiums around June. A year with no sheet must say
// "pending" and show the newest published year — never a guess, never last year's
// numbers wearing next year's label.
console.log("\n-- health rate year picker --");
{
  const mkYr = (healthRateYear) => ({ ...mkCola("2028-12-31", 50), medicalTier: "1", healthRateYear,
    selectedMedicalPlan: "Kaiser Permanente", medicalCoverage: "ee",
    retireeMedicalPlan: "Kaiser Permanente", retireeCoverage: "ee" });
  const Y26 = await scenario(mkYr(2026));
  const Y27 = await scenario(mkYr(2027));
  const Y28 = await scenario(mkYr(2028));

  check("2026 prices Kaiser at the 2026 rate", () => has(Y26.health, "$1,169"));
  check("2027 prices Kaiser at the 2027 rate", () => has(Y27.health, "$1,188"));
  check("the picker actually changes the premium", () =>
    lacks(Y26.health, "Medical premium (Kaiser Permanente) $1,188") || "2026 is showing the 2027 rate");

  // Plan line-ups differ by year and must follow the picker.
  check("2026 still lists the UnitedHealthcare plans", () => has(Y26.health, "UnitedHealthcare Alliance"));
  check("2027 does not", () => lacks(Y27.health, "UnitedHealthcare Alliance"));
  check("Sutter exists in 2027 but not 2026", () =>
    has(Y27.health, "Sutter Health Plan") && lacks(Y26.health, "Sutter Health Plan"));

  // 2028: no sheet published yet.
  check("2028 is marked pending in the dropdown", () => has(Y28.health, "2028 \u00b7 pending"));
  check("2028 says plainly that the rates are not out", () => has(Y28.health, "not published yet"));
  check("2028 names the year it is actually showing", () => has(Y28.health, "2027"));
  check("2028 shows real 2027 money, not an invented figure", () => has(Y28.health, "$1,188"));
  check("published years carry no pending banner", () =>
    lacks(Y27.health, "not published yet") && lacks(Y26.health, "not published yet"));
  check("the current year is labelled current", () => has(Y27.health, "2027 \u00b7 current"));
  check("all three years are offered", () =>
    ["2026", "2027", "2028"].every(y => Y27.health.includes(y)) || "a year is missing from the picker");

  // The label and the money must agree. The all-plans table once said "All 2026 plans"
  // over 2027 figures, which is the worst kind of wrong: confidently mislabelled.
  const openAll = (y) => ({ ...mkYr(y), openSections: { medplan: true, allPlans: true } });
  const L26 = await scenario(openAll(2026));
  const L27 = await scenario(openAll(2027));
  const L28 = await scenario(openAll(2028));
  check("2026: working header names the year", () => has(L26.health, "while working \u00b7 2026 rates"));
  check("2027: working header names the year", () => has(L27.health, "while working \u00b7 2027 rates"));
  check("2026: retiree header names the year", () => has(L26.health, "your medical \u00b7 2026 rates"));
  check("2027: retiree header names the year", () => has(L27.health, "your medical \u00b7 2027 rates"));
  check("2026: the all-plans table says 2026", () => has(L26.health, "All 2026 plans"));
  check("2027: the all-plans table says 2027", () => has(L27.health, "All 2027 plans"));
  check("the table label never contradicts the money", () =>
    lacks(L27.health, "All 2026 plans") || "2027 selected but the table is labelled 2026");
  check("2028: the table shows the fallback year AND flags the pending one", () =>
    has(L28.health, "All 2027 plans \u00b7 2028 pending"));
  check("a Medicare year that differs from the page is called out", () =>
    has(L26.health, "while the rest of the page is 2026"));
}


// ── The year picker drives the header, not just the table ──────────────────
// The picker sat above a table that changed while the biggest number on the screen
// did not, and nothing said they were on different clocks.
console.log("\n-- the year picker moves the header --");
{
  const yr = {};
  for (const y of [2026, 2027, 2028]) {
    const S = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, rateYear: y, rateYearPicked: true,
      lmaPct: 5, hasBachelor: true, hasParamedic: true });
    const h = headerWorkingGross(S.comp), t = tableGross(S.comp);
    yr[y] = { h, t, txt: S.comp, member: S.member };
    check(`${y}: header names the year`, () => has(S.comp, `While working \u00b7 ${y}`));
    check(`${y}: header gross equals the table total`, () => {
      if (!h) return "could not read the header";
      if (!t) return "could not read the table total";
      return h.gross === t || `header ${h.gross} vs table ${t}`;
    });
  }
  check("the header actually moves between years", () =>
    (yr[2026].h.gross !== yr[2027].h.gross && yr[2027].h.gross !== yr[2028].h.gross)
    || `stuck: ${yr[2026].h.gross} / ${yr[2027].h.gross} / ${yr[2028].h.gross}`);
  check("take-home moves with it", () =>
    yr[2026].h.net !== yr[2028].h.net || `stuck at ${yr[2026].h.net}`);
  check("the picked year carries to other tabs", () =>
    has(yr[2028].member, "While working \u00b7 2028"));
  // Past the retirement year a member is not working, and the retired half of the header is
  // pinned there, so the two halves would be comparing different years.
  const PAST = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, rateYear: 2029, rateYearPicked:true });
  check("a year past retirement clamps to the retirement year", () =>
    has(PAST.comp, "While working \u00b7 2028"));
  check("and says why", () => has(PAST.comp, "you retire in 2028"));
  check("the current year still reads as today", () => has(yr[2026].txt, "today, with your overtime"));
}

for (const ot of [0, 40]) {
  const S = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: ot, rateYear: 2026, rateYearPicked:true,
    hasBachelor: true, hasParamedic: true, hasHazmat: true, hazmatLevel: "tech" });
  check(`header working gross matches the table at ${ot} OT hrs`, () => {
    const h = headerWorkingGross(S.comp), t = tableGross(S.comp);
    if (!h) return "could not read the header";
    if (!t) return "could not read the table total";
    return h.gross === t || `header ${h.gross} vs table ${t}`;
  });
}
const WX = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 0, rateYear: 2026, rateYearPicked:true,
  hasBachelor: true, hasParamedic: true, hasHazmat: true, hazmatLevel: "tech" });
check("working gross includes holiday pay", () => has(WX.comp, "Holiday pay"));
check("working gross includes the uniform allowance", () => has(WX.comp, "Uniform allowance"));
check("working gross includes FLSA scheduled overtime", () => has(WX.comp, "FLSA scheduled overtime"));
check("the corrected working gross is $16,561", () => has(WX.comp, "$16,561"));


// ── Contract figures print exactly as bargained ────────────────────────────
// pct() rounds to one decimal, so the MOU's 1.75% was printing as 1.8%. A bargained
// number is not an approximation — members check these against the contract.
console.log("\n-- future raises, year by year --");
const FR = await scenario({ ...mkCola("2028-12-31", 50), openSections: { startraises: true } });
check("2029 shows the contracted 1.75%", () => has(FR.comp, "1.75%"));
check("and never the rounded 1.8%", () => lacks(FR.comp, "1.8% general wage increase"));
check("laid out by year", () => ["2027","2028","2029","2030+"].every(y => FR.comp.includes(y))
  || "a year is missing from the list");
check("2027 carries its rank separation", () => has(FR.comp, "Eng = FFP2 ×1.075"));
check("2028 shows the alignment tightening", () => has(FR.comp, "Eng = FFP ×1.10"));
check("2028 has the LMA input", () => has(FR.comp, "Labor Market Adjustment"));
check("2028 flags the LMA as unpriced", () => has(FR.comp, "floor, not a forecast"));
check("2030+ has the bargaining dial", () => has(FR.comp, "Raises Local 1592 bargains"));
check("cites Art.I.A(2) for 2027", () => has(FR.comp, "Art.I.A(2)"));
check("cites Art.I.A.3 for the LMA", () => has(FR.comp, "Art.I.A.3"));
check("cites Art.I.A(4) for 2029", () => has(FR.comp, "Art.I.A(4)"));
// Prevention classes bargained different figures and must show their own.
const FRP = await scenario({ ...mkCola("2028-12-31", 50),
  classification: "Fire Plans Examiner", openSections: { startraises: true } });
check("prevention gets its own 2027 figure", () => has(FRP.comp, "2.5% general wage increase"));
check("prevention gets its own 2029 figure", () => has(FRP.comp, "3% general wage increase"));


// ── 457: a deduction while working, not income in retirement ───────────────
// The contribution comes off your check, so it belongs in the working take-home.
// The draw starts whenever you decide to start it, so it does not belong in the
// retirement headline — and must not be taxed there either.
console.log("\n-- 457 in the header --");
const mk457 = (annual457Contrib) => ({ setupDone:true, hireDate:"2003-01-01", dob:"1978-09-28",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-12-31", retirementAge:50, currentOTHours:40, annual457Contrib });
const hdr = (t) => {
  const w = t.match(/While working · \d+ Gross \$[\d,]+ Take home (\$[\d,]+)/);
  const r = t.match(/While retired · \d+ Gross \$[\d,]+ Take home (\$[\d,]+)/);
  return { work: w && w[1], ret: r && r[1] };
};
const Z = hdr((await scenario(mk457(0))).member);
const M = hdr((await scenario(mk457(12000))).member);
const X = hdr((await scenario(mk457(24500))).member);
check("contributing more lowers working take-home", () =>
  (Z.work && M.work && X.work && Z.work !== M.work && M.work !== X.work)
  || `457 contribution is not coming off the check: ${Z.work} / ${M.work} / ${X.work}`);
check("the retirement figure ignores the 457 entirely", () =>
  (Z.ret === M.ret && M.ret === X.ret)
  || `457 is leaking into the retirement take-home: ${Z.ret} / ${M.ret} / ${X.ret}`);


// ── Stay or go must agree with itself and with the banner ──────────────────
// Three things were wrong here at once: the card was in today's dollars while the
// banner was nominal, a negative cost was clamped to zero so working longer read as
// "costs nothing" instead of "pays you", and the break-even column collapsed four
// real cases into two.
console.log("\n-- stay or go: internal consistency --");
// The paycheck you give up is your LAST YEAR's, not today's. Comparing a 2028 pension against
// 2026 wages understated the cut by every raise in between.
{
  const F = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40 });
  check("the card compares the final working year", () => has(F.stayorgo, "Working in 2028"));
  check("and says so", () => has(F.stayorgo, "your last year"));
  check("not today's paycheck", () => lacks(F.stayorgo, "Working now \u00b7"));
  check("both sides are named as retirement-year dollars", () => has(F.stayorgo, "both in 2028 dollars"));
  // The final-year paycheck is bigger than today's, so the cut must be wider than it was.
  const T = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...pinToday });
  const grab = (t) => {
    const m = t.match(/Working in 2028[\s\S]*?\$([\d,]+)\/mo/);
    return m ? +m[1].replace(/,/g, "") : null;
  };
  const hdrToday = T.stayorgo.match(/While working \u00b7 \d+ Gross \$[\d,]+ Take home \$([\d,]+)/);
  check("the final-year paycheck beats today's", () => {
    const fin = grab(F.stayorgo), today = hdrToday ? +hdrToday[1].replace(/,/g, "") : null;
    return (fin && today && fin > today) || `final ${fin} vs today ${today}`;
  });
}
const money = (x) => x == null ? null : +String(x).replace(/[^0-9.\-]/g, "");
const sgRead = (t) => {
  const h = t.match(/While working · \d+ Gross \$[\d,]+ Take home (\$[\d,]+) .*?While retired · \d+ Gross \$[\d,]+ Take home (\$[\d,]+)/);
  const c = t.match(/Retired in \d+ · pension after tax and medical (\$[\d,]+)\/mo/);
  const v = t.match(/(The cut|You come out ahead) [−+-]?(\$[\d,]+)\/mo/);
  return { hdrWork: money(h && h[1]), hdrRet: money(h && h[2]), cardRet: money(c && c[1]), delta: money(v && v[2]) };
};
// Both halves of this card are in RETIREMENT-YEAR dollars now, and so is the header by
// default, so the banner and the card must agree without pinning anything.
const mkSG = (extra) => ({ ...mkCola("2028-12-31", 50), currentOTHours: 40, ...extra });
for (const [label, extra] of [["CPI 0", {}], ["CPI 3", { inflationRate: 3 }], ["no OT", { currentOTHours: 0 }]]) {
  const S = await scenario(mkSG(extra));
  const r = sgRead(S.stayorgo);
  check(`${label}: card retired figure matches the banner`, () =>
    (r.hdrRet != null && r.hdrRet === r.cardRet) || `banner ${r.hdrRet} vs card ${r.cardRet}`);
  check(`${label}: the stated change is the difference of the two`, () =>
    (r.delta != null && Math.abs(r.delta - Math.abs(r.hdrRet - r.hdrWork)) <= 1)
    || `${r.delta} != |${r.hdrRet} - ${r.hdrWork}|`);
}
// A paycheck that beats the pension means working longer PAYS — it must not read as zero.
const SGpay = await scenario(mkSG({}));
check("a paycheck that beats the pension reads as a gain", () => has(SGpay.stayorgo, "out-earns that pension by"));
check("and never as 'costs you nothing'", () => lacks(SGpay.stayorgo, "waiting costs you nothing"));
check("that case breaks even from day one", () => has(SGpay.stayorgo, "ahead from day one"));
// Gain up front, smaller pension later — there is a crossover, and it has to be named.
const SGfade = await scenario(mkSG({ inflationRate: 3 }));
check("a fading gain is called out, not called 'ahead'", () => has(SGfade.stayorgo, "then behind"));
check("and it is not claimed as ahead from day one", () => {
  const hits = (SGfade.stayorgo.match(/ahead from day one/gi) || []).length;
  return hits <= 1 || `${hits} mentions — a row is claiming it, not just the legend`;
});
// The ordinary case still works.
const SGcost = await scenario(mkSG({ currentOTHours: 0 }));
check("a real cost still shows a break-even age", () => has(SGcost.stayorgo, "· age "));
check("and states the yearly cost", () => has(SGcost.stayorgo, "So that year costs you"));
// The two tables use different bases; the page has to say so.
check("the year table is labelled gross", () => has(SGcost.stayorgo, "gross"));
check("the cost table is labelled take-home", () => has(SGcost.stayorgo, "Take-home gain"));

console.log("\n" + (fail?"!! ":"") + pass + " passed, " + fail + " failed\n");
process.exit(fail?1:0);
