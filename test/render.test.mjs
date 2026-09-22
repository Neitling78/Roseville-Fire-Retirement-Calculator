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
const has   = (t,n) => t.includes(n) ? true : "missing: " + JSON.stringify(n);
const lacks = (t,n) => !t.includes(n) ? true : "should NOT contain: " + JSON.stringify(n);
const strip = (h) => h.replace(/<!-- -->/g,"").replace(/<[^>]+>/g," ").replace(/&#x27;/g,"'").replace(/&amp;/g,"&")
  .replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#8722;|−/g,"-").replace(/\s+/g," ");

async function scenario(saved) {
  globalThis.localStorage.clear();
  if (saved) globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const { default: Calc } = await import("./component.mjs?v=" + (++bust));
  const out = {};
  for (const t of ["start","pension","pay","wait","sickleave","medical","inputs","pensiondetail","income","timeline","help"]) {
    globalThis.window.location.search = "?tab=" + t;
    out[t] = strip(renderToString(React.createElement(Calc)));
  }
  return out;
}

// ── A first-time visitor ────────────────────────────────────────────────────
console.log("\n-- first visit: questions, not somebody else's numbers --");
const A = await scenario(null);
check("every screen renders", () => Object.values(A).every(h => h.length > 200) || "a screen came back empty");
check("asks the five questions", () => has(A.start, "Five questions"));
check("asks what you do", () => has(A.start, "What do you do?"));
check("asks when Roseville hired you", () => has(A.start, "When did Roseville hire you?"));
check("asks for sick leave hours", () => has(A.start, "Sick leave hours on the books today"));
check("withholds the answer", () => has(A.start, "each get their own tab"));
check("shows NO take-home figure yet", () => lacks(A.start, "Lands in your bank"));
check("says data stays in the browser", () => has(A.start, "leaves your browser"));
check("'what if I wait' also waits", () => has(A.wait, "Answer the five questions"));

// ── A 28-year Classic Captain, the actual audience ──────────────────────────
console.log("\n-- returning member: Classic Captain, 28 yrs, retiring 2028 --");
const B = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", currentSickLeaveHours:2600,
  retirementDateOverride:"2028-06-01", sickLeaveDisposition:"credit" });
check("every screen renders", () => Object.values(B).every(h => h.length > 200) || "a screen came back empty");
check("shows the answer on the pension tab", () => has(B.pension, "Your number"));
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
check("explains the tax approximation", () => has(B.wait, "rank the years"));
check("warns they are future dollars", () => has(B.wait, "future dollars"));

console.log("\n-- sick leave decision screen --");
check("frames the decision", () => has(B.sickleave, "Cash or credit?"));
check("gives the CalPERS conversion rate", () => has(B.sickleave, "2,000 hours = 1 year"));
check("says you cannot do both", () => has(B.sickleave, "cannot do both with the same hours"));
check("warns about the 2,400-hour payoff ceiling", () => has(B.sickleave, "are payable"));
check("offers all three choices", () => ["All credit","All cash","Split them"].every(x => B.sickleave.includes(x)) || "a choice is missing");
check("points at the Treasurer to confirm", () => has(B.sickleave, "Treasurer"));

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
  unusedHolidayHours:96 });
check("every screen renders", () => Object.values(E).every(h => h.length > 200) || "a screen came back empty");
check("shows current pay section", () => has(E.pay, "Your pay right now"));
// same member, every pay section expanded
const Eo = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", currentSickLeaveHours:2600,
  retirementDateOverride:"2028-06-01", sickLeaveDisposition:"credit",
  hasBachelor:true, hasChiefFireOfficer:true, hasHazmat:true, hazmatLevel:"taskforce",
  unusedHolidayHours:96,
  openSections:{ startpay:true, startincent:true, starthourly:true, startraises:true, startpayout:true } });
check("shows specialty pay section", () => has(E.start, "Specialty pay and certificates"));
check("collapsed header still shows the incentive total", () => /Specialty pay and certificates \s*[\d.]+%/.test(E.start) || "no total in the collapsed header");
check("collapsed header still shows current pay", () => /Your pay right now \s*\$/.test(E.pay) || "no value in the collapsed header");
check("collapsed header still shows the hourly rate", () => /Your hourly rates \s*\$/.test(E.pay) || "no value in the collapsed header");
check("collapsed header still shows cash-out total", () => /Cash-outs at retirement \s*\$/.test(E.pay) || "no value in the collapsed header");
check("offers the education incentive", () => has(Eo.start, "Bachelor's degree (10%)"));
check("offers Chief Fire Officer for a Captain", () => has(Eo.start, "Chief Fire Officer cert (10%)"));
check("offers hazmat", () => has(Eo.start, "Hazmat"));
check("offers rescue", () => has(Eo.start, "Rescue"));
check("offers fire investigation", () => has(Eo.start, "Fire investigation"));
check("shows hourly rates", () => has(E.pay, "Your hourly rates"));
check("shows the FLSA regular rate", () => has(Eo.pay, "FLSA regular rate"));
check("All-Call rate is gone (never actually paid)", () => lacks(Eo.pay, "All-Call"));
check("hourly rates carry cents", () => (Eo.pay.match(/\$[\d,]+\.\d{2}\/hr/g) || []).length >= 5
  || "expected 5 hourly rates with cents, found " + (Eo.pay.match(/\$[\d,]+\.\d{2}\/hr/g) || []).length);
check("collapsed hourly header carries cents", () => /Your hourly rates \s*\$[\d,]+\.\d{2}\/hr/.test(E.pay)
  || "collapsed header rate has no cents");
check("monthly figures stay whole dollars", () => /\$[\d,]+\/mo/.test(Eo.pay)
  || "monthly figures should not have gained cents");
check("shows future raises", () => has(E.pay, "Future raises"));
check("shows the 2028 study is an assumption", () => has(Eo.pay, "study"));
check("shows cash-outs at retirement", () => has(E.pay, "Cash-outs at retirement"));
check("cash-out rate says base + longevity, no incentives", () => has(Eo.pay, "base + longevity, no incentives"));
check("cash-out card spells out the exclusion", () => has(Eo.pay, "base hourly plus longevity only"));
check("cash-out card excludes specialty pay explicitly", () => has(Eo.pay, "no education, certificate or specialty pay"));
check("cash-out card distinguishes projected rate from today's", () => has(Eo.pay, "not today's"));
check("shows holiday cash-out", () => has(Eo.pay, "Unused holiday hours at separation"));
check("tells them to confirm holiday practice", () => has(Eo.pay, "Confirm the City's separation practice"));
check("shows what the pension is figured on", () => has(E.pension, "What the pension is figured on"));
check("shows pensionable incentives in the build-up", () => has(E.pension, "Pensionable incentives"));
check("Classic sees holiday pay as pensionable", () => has(E.pension, "Holiday pay (168 hrs)"));
check("Classic sees uniform allowance", () => has(E.pension, "Uniform allowance"));
check("Classic sees FLSA OT special comp", () => has(E.pension, "FLSA overtime (special comp)"));
check("15% education+cert cap is applied", () => has(Eo.pay, "15% Education + Cert Cap Applied"));

// ── Current pay vs pension projection must not be the same figure ───────────
console.log("\n-- a Captain paid Engine Boss today, retiring after it ceases --");
const F = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2029-06-01",
  hasEngineBoss:true, hasBachelor:true,
  openSections:{ startpay:true, starthourly:true } });
check("every screen renders", () => Object.values(F).every(h => h.length > 200) || "a screen came back empty");
check("current pay still shows Engine Boss", () => has(F.pay, "Engine Boss"));
check("explains why it is not in the pension", () => has(F.pay, "it ends 1/9/2027"));
check("explains the rank-separation trade", () => has(F.pay, "trades it for rank separation"));
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
check("retiring before the cease date keeps it", () => has(G.pay, "Engine Boss"));
check("no cease warning when it does not apply", () => lacks(G.pay, "it ends 1/9/2027"));

// ── Year picker on the hourly-rate card ─────────────────────────────────────
console.log("\n-- hourly rates by year --");
const mkCapt = (rateYear) => ({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2030-06-01", rateYear, raise2028:3,
  openSections:{ starthourly:true } });
const H26 = await scenario(mkCapt(2026));
const H27 = await scenario(mkCapt(2027));
const H28 = await scenario(mkCapt(2028));
check("year picker is present", () => has(H26.pay, "Show rates for"));
check("2026 shows the published base", () => has(H26.pay, "$12,295"));
check("2027 shows the rank-separated base", () => has(H27.pay, "$13,013"));
check("2028 shows base after the study", () => has(H28.pay, "$13,715"));
check("2026 base hourly to the cent", () => has(H26.pay, "$50.67/hr"));
check("2027 base hourly to the cent", () => has(H27.pay, "$53.63/hr"));
check("picking a future year explains what moved", () => has(H27.pay, "What moved between"));
check("names the 2027 rank separation", () => has(H27.pay, "rank separation sets"));
check("names the ceasing incentives", () => has(H27.pay, "end 1/9/2027"));
check("flags 2028 as an assumption", () => has(H28.pay, "not yet known"));
check("warns the figure is assumed", () => has(H28.pay, "include an assumed figure"));
check("today's year shows no 'what moved' panel", () => lacks(H26.pay, "What moved between"));

console.log("\n-- MOU raises are shown, not typed --");
check("2027 GWI stated", () => has(H26.pay, "Jan 2027 general wage increase"));
check("2029 GWI stated", () => has(H26.pay, "Jan 2029 general wage increase"));
check("cites the MOU article", () => has(H26.pay, "MOU Ch.2 Art.I.A"));
check("2028 is still editable", () => has(H26.pay, "comp study"));
const PREVp = await scenario({ setupDone:true, hireDate:"2005-06-01", dob:"1975-03-15",
  memberType:"classic", medicalTier:"2", classification:"Fire Plans Examiner", salaryStep:"H",
  retirementDateOverride:"2030-06-01", rateYear:2029, openSections:{ starthourly:true, startraises:true } });
check("prevention class gets its own 2027 figure", () => has(PREVp.pay, "prevention +3.0%")
  || has(PREVp.pay, "2.5%"));
check("prevention class renders", () => PREVp.pay.length > 200 || "empty");

// ── Start here is fact-finding only ─────────────────────────────────────────
console.log("\n-- Start here asks, it does not answer --");
const FF = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  currentSickLeaveHours:2600, retirementDateOverride:"2028-06-01",
  openSections:{ startincent:true, startprior:true, startextras:true } });
check("asks rank and step", () => has(FF.start, "What do you do?"));
check("asks hire date", () => has(FF.start, "When did Roseville hire you?"));
check("asks retirement date", () => has(FF.start, "When do you plan to go?"));
check("asks sick leave", () => has(FF.start, "Sick leave hours on the books today"));
check("asks specialty pay", () => has(FF.start, "Specialty pay and certificates"));
check("asks prior agency service", () => has(FF.start, "Prior service and purchased credit"));
check("asks purchased service credit", () => has(FF.start, "Airtime / purchased service"));
check("asks unused holiday hours", () => has(FF.start, "Unused holiday hours at separation"));
check("asks beneficiary age", () => has(FF.start, "Beneficiary's age at your retirement"));
check("offers the pension type override", () => has(FF.start, "CalPERS reciprocity"));
check("no pension answer on Start here", () => lacks(FF.start, "Lands in your bank"));
check("no hourly rates on Start here", () => lacks(FF.start, "FLSA regular rate"));
check("no cash-out totals on Start here", () => lacks(FF.start, "Total cash at separation"));
check("points at the next tabs", () => has(FF.start, "See your pension"));

console.log("\n-- the three tabs hold different things --");
check("pension tab has the answer", () => has(FF.pension, "Lands in your bank"));
check("pension tab has no hourly rates", () => lacks(FF.pension, "FLSA regular rate"));
check("pay tab has the rates", () => has(FF.pay, "Your hourly rates"));
check("pay tab has no pension answer", () => lacks(FF.pay, "Lands in your bank"));
check("pay tab has cash-outs", () => has(FF.pay, "Cash-outs at retirement"));
check("seven primary tabs", () => ["Start here","Your pension","Your pay","What if I wait?","Sick leave","Medical","Everything else"]
  .every(x => FF.start.includes(x)) || "a primary tab is missing");
check("advanced pension detail still reachable", () => has(FF.pensiondetail, "Pension detail"));

console.log("\n-- navigation --");
check("five primary tabs", () => ["Start here","What if I wait?","Sick leave","Medical","Everything else"]
  .every(x => B.start.includes(x)) || "a primary tab is missing");
check("old screens demoted, not deleted", () => ["All inputs","Pension detail","Timeline","Guide"]
  .every(x => B.inputs.includes(x)) || "an advanced screen is missing");

console.log("\n" + (fail?"!! ":"") + pass + " passed, " + fail + " failed\n");
process.exit(fail?1:0);
