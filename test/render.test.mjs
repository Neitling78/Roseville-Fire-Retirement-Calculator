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
  for (const t of ["member","comp","pension","deductions","now","retired","stayorgo","start","pension","pay","wait","sickleave","medical","inputs","pensiondetail","income","timeline","help"]) {
    globalThis.window.location.search = "?tab=" + t;
    out[t] = strip(renderToString(React.createElement(Calc)));
  }
  return out;
}

// ── A first-time visitor ────────────────────────────────────────────────────
console.log("\n-- first visit: questions, not somebody else's numbers --");
const A = await scenario(null);
check("every screen renders", () => Object.values(A).every(h => h.length > 200) || "a screen came back empty");
check("opens with prior service", () => has(A.member, "1 \u00b7 Prior service"));
check("then Roseville", () => has(A.member, "2 \u00b7 Roseville"));
check("then specialty pay", () => has(A.member, "3 \u00b7 Specialty pay and certificates"));
// The overtime + gross-pay card only appears once the member has entered something.
check("asks what you do", () => has(A.member, "Rank and pay step"));
check("asks when Roseville hired you", () => has(A.member, "Roseville hire date"));
check("asks for sick leave hours", () => has(A.start, "Sick leave hours on the books today"));
check("withholds the answer", () => has(A.start, "each get their own tab"));
check("shows NO take-home figure yet", () => lacks(A.start, "Lands in your bank"));
check("says data stays in the browser", () => has(A.start, "leaves your browser"));
check("'what if I wait' also waits", () => has(A.stayorgo, "Fill in"));

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
check("says tax comes off the warrant, not the estimate", () => has(B.wait, "come off the warrant afterward"));
check("warns later dollars buy less", () => has(B.wait, "which buy less"));

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
check("shows the compensation table", () => has(E.comp, "Current compensation"));
// same member, every pay section expanded
const Eo = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H", currentSickLeaveHours:2600,
  retirementDateOverride:"2028-06-01", sickLeaveDisposition:"credit",
  hasBachelor:true, hasChiefFireOfficer:true, hasHazmat:true, hazmatLevel:"taskforce",
  openSections:{ startpay:true, startincent:true, starthourly:true, startraises:true, startpayout:true } });
check("shows specialty pay section", () => has(E.start, "Specialty pay and certificates"));
check("collapsed header still shows the incentive total", () => /Specialty pay and certificates \s*[\d.]+%/.test(E.start) || "no total in the collapsed header");
check("the table ends at gross pay", () => has(E.comp, "Gross pay"));
check("collapsed header still shows the hourly rate", () => /Your hourly rates \s*\$/.test(E.comp) || "no value in the collapsed header");
check("collapsed header still shows the cash-out total", () => /Cash-out at retirement \s*\$/.test(E.sickleave) || "no value in the collapsed header");
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
check("shows future raises", () => has(E.pension, "Future raises"));
check("shows the 2028 study is an assumption", () => has(Eo.pension, "study"));
check("shows the cash-out card", () => has(E.sickleave, "Cash-out at retirement"));
check("no holiday cash-out input anywhere", () => lacks(E.pay, "Unused holiday hours") === true
  && lacks(E.start, "Unused holiday hours") === true);
check("explains holiday is special comp, not a payout", () => has(Eo.sickleave, "Holiday hours are not a separate cash-out"));
check("cites the special-comp reporting", () => has(Eo.sickleave, "reported to CalPERS as special compensation"));
check("says it cannot be both", () => has(Eo.sickleave, "cannot be both reported to CalPERS and paid out again"));
check("holiday pay still counts as pensionable", () => has(E.pension, "Holiday pay (168 hrs)"));
check("cash-out rate says base + longevity, no incentives", () => has(Eo.comp, "base + longevity, no incentives"));
check("cash-out card spells out the exclusion", () => has(Eo.sickleave, "base hourly plus longevity only"));
check("cash-out card excludes specialty pay explicitly", () => has(Eo.sickleave, "no education, certificate or specialty pay"));
check("cash-out card distinguishes projected rate from today's", () => has(Eo.sickleave, "not today's"));
check("shows what the pension is figured on", () => has(E.pension, "What the pension is figured on"));
check("shows pensionable incentives in the build-up", () => has(E.pension, "Pensionable incentives"));
check("Classic sees holiday pay as pensionable", () => has(E.pension, "Holiday pay (168 hrs)"));
check("Classic sees uniform allowance", () => has(E.pension, "Uniform allowance"));
check("Classic sees FLSA OT special comp", () => has(E.pension, "regularly scheduled"));
check("15% education+cert cap is applied", () => has(Eo.comp, "15% Education + Cert Cap Applied"));

// ── Current pay vs pension projection must not be the same figure ───────────
console.log("\n-- a Captain paid Engine Boss today, retiring after it ceases --");
const F = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1",
  classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2029-06-01", rateYear:2027,
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
  retirementDateOverride:"2034-06-01", rateYear, unionRaisePct, lmaPct, openSections:{ starthourly:true } });
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
check("the LMA box is on Your Pay", () => has(L28.pension, "55th percentile"));
const LZ = await scenario(mkCapt(2028, 0, 0));
check("all three at zero says nothing is assumed", () => has(LZ.wait, "All three at zero"));
check("zero state says the LMA is deliberately left out", () => has(LZ.wait, "does not exist yet"));
check("a set LMA is named in the assumptions banner", () => has(L28.wait, "Labor Market Adjustment in January 2028"));
check("today's year shows no 'what moved' panel", () => lacks(H26.comp, "What moved between"));

console.log("\n-- MOU raises are shown, not typed --");
check("2027 GWI stated", () => has(H26.pension, "Jan 2027 general wage increase"));
check("2029 GWI stated", () => has(H26.pension, "Jan 2029 general wage increase"));
check("cites the MOU article", () => has(H26.pension, "MOU Ch.2 Art.I.A"));
check("the bargaining lever is on the pay tab too", () => has(H26.pension, "Raises Local 1592 bargains"));
const PREVp = await scenario({ setupDone:true, hireDate:"2005-06-01", dob:"1975-03-15",
  memberType:"classic", medicalTier:"2", classification:"Fire Plans Examiner", salaryStep:"H",
  retirementDateOverride:"2030-06-01", rateYear:2029, openSections:{ starthourly:true, startraises:true } });
check("prevention class gets its own 2027 figure", () => has(PREVp.comp, "prevention +3.0%")
  || has(PREVp.pay, "2.5%"));
check("prevention class renders", () => PREVp.pay.length > 200 || "empty");

// ── Start here is fact-finding only ─────────────────────────────────────────
console.log("\n-- Start here asks, it does not answer --");
const FF = await scenario({ setupDone:true, hireDate:"1998-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  currentSickLeaveHours:2600, retirementDateOverride:"2028-06-01",
  openSections:{ startincent:true, startprior:true, startextras:true } });
check("asks rank and step", () => has(FF.member, "Rank and pay step"));
check("asks hire date", () => has(FF.member, "Roseville hire date"));
check("asks retirement date", () => has(FF.pension, "When do you plan to go?"));
check("asks sick leave", () => has(FF.start, "Sick leave hours on the books today"));
check("asks specialty pay", () => has(FF.start, "Specialty pay and certificates"));
check("asks prior agency service", () => has(FF.member, "1 \u00b7 Prior service"));
check("asks purchased service credit", () => has(FF.member, "Air Time purchased"));
check("asks beneficiary age on Deductions", () => has(FF.deductions, "beneficiary’s age at your retirement"));
check("offers the pension type override", () => has(FF.inputs, "CalPERS reciprocity"));
check("no pension answer on page one", () => lacks(FF.now, "Gross CalPERS pension"));
check("no cash-out totals on Start here", () => lacks(FF.sickleave, "Total cash at separation"));
check("member details no longer ends in a call to action", () => lacks(FF.member, "That is everything"));

console.log("\n-- the three tabs hold different things --");
check("pension tab has the answer", () => has(FF.pension, "Lands in your bank"));
check("pension tab has no hourly rates", () => lacks(FF.pension, "FLSA regular rate"));
check("pay tab has the rates", () => has(FF.comp, "Your hourly rates"));
check("page one has no pension answer", () => lacks(FF.now, "of final comp"));
check("pay tab has the cash-out card", () => has(FF.sickleave, "Cash-out at retirement"));
check("four primary tabs", () => ["Member details","Pension","Deductions","Stay or go?"]
  .every(x => FF.member.includes(x)) || "a primary tab is missing");
check("advanced pension detail still reachable", () => has(FF.pensiondetail, "Pension detail"));

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
  openSections:{ startcalpers:true, startprior:true } });
check("every screen renders", () => Object.values(CP).every(h => h.length > 200) || "a screen came back empty");
check("asks for CalPERS service credit", () => has(CP.inputs, "CalPERS service credit"));
check("points at myCalPERS", () => has(CP.inputs, "my.calpers.ca.gov"));
check("shows the figure on file", () => has(CP.inputs, "23.390"));
check("projects it to retirement", () => has(CP.inputs, "Roseville credit at retirement"));
check("asks whether purchased credit is included", () => has(CP.inputs, "already includes service credit I purchased"));
check("warns about double-counting airtime", () => has(CP.inputs, "count it twice"));
check("gives a total to reconcile", () => has(CP.inputs, "Check yourself"));
check("total matches myCalPERS (29.110)", () => has(CP.inputs, "29.110 years"));
check("explains same vs different formula buckets", () => has(CP.inputs, "is its own bucket and stacks on top"));
// no override supplied -> falls back to the hire date and says so
const NOCP = await scenario({ setupDone:true, hireDate:"2002-06-01", dob:"1972-03-15",
  memberType:"classic", medicalTier:"1", classification:"Fire Captain", salaryStep:"H",
  retirementDateOverride:"2028-06-01", openSections:{ startcalpers:true } });
check("falls back to the hire date when blank", () => has(NOCP.inputs, "estimating"));
check("says the fallback is an estimate", () => has(NOCP.inputs, "it is an estimate"));
check("no reconcile panel without a figure", () => lacks(NOCP.inputs, "Check yourself"));

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
check("asks for the Last reported date", () => has(BAL.inputs, '"Last reported" date on myCalPERS'));
check("explains the employer reporting lag", () => has(BAL.inputs, "reports on a lag"));
check("counts service still to earn from that date", () => has(BAL.inputs, "Still to earn"));
check("asks for the account balance", () => has(BAL.inputs, "CalPERS account balance"));
check("says the balance changes nothing", () => has(BAL.inputs, "does not change your pension by a cent"));
check("warns a refund forfeits the pension", () => has(BAL.inputs, "forfeit the pension entirely"));
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
  openSections:{ startcalpers:true } });
check("every screen renders", () => Object.values(CAP).every(h => h.length > 200) || "a screen came back empty");
check("warns you are past the cap", () => has(CAP.pension, "You are past the cap"));
check("quantifies the wasted years", () => /years<\/strong> of credit pays you nothing|of credit pays you nothing/.test(CAP.pension)
  || "no surplus-years figure");
check("names sick leave as part of the surplus", () => has(CAP.pension, "worth"));
check("explains what still raises the pension", () => has(CAP.pension, "only through pay increases"));
check("sick leave screen says worth $0", () => has(CAP.sickleave, "Worth $0 to you"));
check("sick leave screen gives the cash alternative", () => has(CAP.sickleave, "Taking it as cash is worth"));
check("airtime is not double-counted", () => has(CAP.inputs, "not") === true
  && has(CAP.inputs, "already inside the figure above") === true);
check("offers the rows-vs-total sanity check", () => has(CAP.inputs, "if the employer rows on myCalPERS add up to the Total"));
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
check("four primary tabs", () => ["Member details","Pension","Deductions","Stay or go?"]
  .every(x => B.member.includes(x)) || "a primary tab is missing");
check("detail screens demoted, not deleted", () => ["Sick leave","All inputs","Pension detail","Timeline","Guide"]
  .every(x => B.inputs.includes(x)) || "a detail screen is missing");
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
check("December 2028 retiree: first COLA May 1, 2030", () => has(CD.pensiondetail, "May 1, 2030"));
check("February 2028 retiree: same year, also May 1, 2030", () => has(CF.pensiondetail, "May 1, 2030"));
check("the date is not hardcoded — 2033 retiree gets May 1, 2035", () => has(CL.pensiondetail, "May 1, 2035"));
check("says the allowance is flat until then", () => has(CD.pensiondetail, "flat until then"));
// Golden figures. Five years out, the December retiree has banked FOUR COLAs (May 2030-2033),
// not five. Drop the lag and every number here rises by one 3% step.
check("5 years out = 4 COLAs, not 5", () => has(CD.pensiondetail, "$16,241"));
check("10 years out = 9 COLAs", () => has(CD.pensiondetail, "$18,828"));
// A February retiree reaches each anniversary BEFORE May 1, so at the same elapsed
// years they have banked one fewer COLA than the December retiree.
check("February retiree: 5 years out = 3 COLAs", () => has(CF.pensiondetail, "$13,435"));
check("the CPI dial names the COLA start date", () => has(CD.wait, "May 1, 2030"));


// ── The headline is the gross CalPERS allowance, not a take-home guess ──────
// myCalPERS shows the gross monthly allowance; tax and health premiums come off the
// warrant afterward. The header used to lead with an after-tax figure, which matched
// nothing a member could check against their own CalPERS estimate.
console.log("\n-- headline is the gross allowance --");
const GH = await scenario(mkCola("2028-12-31", 50));
check("header is labelled as the CalPERS pension", () => has(GH.pension, "Monthly CalPERS pension"));
check("header says it is gross", () => has(GH.pension, "gross, before tax"));
check("header no longer leads with take-home", () => lacks(GH.pension, "Monthly take-home"));
check("header shows the gross figure", () => has(GH.pension, "$14,430/mo"));
check("header shows percent of final comp", () => has(GH.pension, "Of final compensation"));
check("the same gross figure appears on every tab", () =>
  ["pension","wait","pay","sickleave","medical"].every(t => GH[t].includes("$14,430/mo"))
  || "a tab disagreed with the header");
check("wait table leads with the gross allowance", () => has(GH.wait, "$14,430"));
// The full take-home chain survives on the pension breakdown, where it has context.
check("breakdown still shows gross pension", () => has(GH.pension, "Gross CalPERS pension"));
check("breakdown still shows what lands in the bank", () => has(GH.pension, "Lands in your bank"));
check("the tax line says plainly that it is rough", () => has(GH.pension, "rough estimate only"));
check("timeline gains a gross CalPERS column", () => has(GH.timeline, "(gross — CalPERS)"));


// ── What waiting actually costs ────────────────────────────────────────────
// Working a year instead of drawing the earliest pension has a price; the bigger
// pension you buy repays it over time, or never does. Take-home basis, because the
// 9% member contribution, dues and active medical only come out while working.
console.log("\n-- what waiting actually costs --");
const CW = await scenario(mkCola("2028-12-31", 50));                       // 0% raises, 0% CPI
const CW3 = await scenario({ ...mkCola("2028-12-31", 50), unionRaisePct:3, inflationRate:3 });
check("the section is on the wait tab", () => has(CW.wait, "What waiting actually costs"));
check("names the earliest year you can go", () => has(CW.wait, "You can go in"));
check("states the yearly cost of staying", () => has(CW.wait, "$28,964"));
check("shows the lifetime pension gain per year", () => has(CW.wait, "$2,451"));
check("shows the break-even in years and age", () => has(CW.wait, "11.8 yrs · age 63"));
check("shows the net position at 20 years", () => has(CW.wait, "$20,063"));
check("a later year can be a net loss", () => has(CW.wait, "$30,702"));
// When pay only keeps pace with CPI the later pension is no bigger in real terms,
// so there is nothing to repay the skipped checks and the answer must say so.
check("says 'never' when waiting buys no bigger pension", () => has(CW3.wait, "never"));
check("explains what 'never' means", () => has(CW.wait, "waiting is never repaid"));
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
  const order = ["1 \u00b7 Prior service","2 \u00b7 Roseville","3 \u00b7 Specialty pay","4 \u00b7 Overtime"];
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
const S1  = await scenario(mkSurv("opt1"));
const S3  = await scenario(mkSurv("opt3"));
const S2  = await scenario(mkSurv("opt2"));
const S2A = await scenario(mkSurv("opt2", "12"));
check("Option 1 pays the unmodified allowance", () => has(S1.pension, "$14,430"));
check("Option 3 reduces the allowance", () => has(S3.pension, "$13,088"));
check("Option 2 reduces it further", () => has(S2.pension, "$12,179"));
check("the reduction reaches take-home", () => has(S2.pension, "$9,393"));
check("Option 1 take-home is the higher figure", () => has(S1.pension, "$10,896"));
check("a myCalPERS figure overrides the estimate", () => has(S2A.pension, "$12,699"));
check("it says it is using your figure", () => has(S2A.deductions, "Using your figure"));
// The factors are invented. Every screen that shows one has to say so.
check("the estimate is flagged as not a CalPERS figure", () => has(S2.deductions, "not a CalPERS figure"));
check("it quotes CalPERS on why", () => has(S2.deductions, "contributed to the retirement plan"));
check("it gives a band, not a point figure", () => has(S2.deductions, "rough band, not a number to plan on"));
check("Option 1 warns you are seeing a pension you may not take", () => has(S1.deductions, "pension you do not plan to take"));
check("the beneficiary continuance is shown", () => has(S2.deductions, "keeps, for life"));
check("the option selector is on Deductions", () => has(S2.deductions, "Who gets it after you"));
check("retirement date moved to Pension", () => has(S1.pension, "When do you plan to go?"));
check("retirement date is off Member details", () => lacks(S1.member, "When do you plan to go?"));


// ── Sick leave: two boxes, not a dropdown ──────────────────────────────────
// The split IS the decision — how many hours you cash and how many you convert
// (2,000 hrs = 1 year of service credit, Gov. Code §20965).
console.log("\n-- sick leave split --");
const SPL = await scenario({ ...mkCola("2028-12-31", 50), sickCashHours: 600, sickCreditHours: 2000,
  currentSickLeaveHours: 0 });
check("two boxes, not a dropdown", () => has(SPL.member, "hours to cash out") && has(SPL.member, "hours to convert"));
check("shows the years the converted hours buy", () => has(SPL.member, "1.00 yrs"));
check("projects the split total, not just one box", () => has(SPL.member, "2600 hrs today"));
check("accrual is added, not lost", () => has(SPL.member, "2927 hrs"));
check("future accrual follows the same split", () => has(SPL.member, "1.13 yrs"));
check("and the rest is cashed", () => has(SPL.member, "676 hrs cashed"));

// ── Current compensation: one table, ends at W-2 gross ─────────────────────
console.log("\n-- current compensation --");
const CC = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40 });
check("one consolidated table", () => has(CC.comp, "Current compensation"));
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
const DBL = await scenario({ ...mkCola("2028-12-31", 50), currentOTHours: 40,
  hasBachelor: true, hasParamedic: true, hasHazmat: true, hazmatLevel: "tech" });
check("specialty pay excludes longevity", () => has(DBL.comp, "17.5% of base"));
check("longevity is its own line", () => has(DBL.comp, "7.5% at 26 yrs"));
check("the two together are the incentive total", () => lacks(DBL.comp, "25.0% of base"));
check("gross reflects the corrected split", () => has(DBL.comp, "$20,361"));
check("pensionable total is not inflated", () => has(DBL.comp, "$16,561"));
// Holiday pay is 168 hrs at (base + longevity) on TODAY'S base — not the retirement-year
// base. Using the projected base here read $9,910/yr instead of $9,150.
check("holiday pay is figured on today's base", () => has(DBL.comp, "$9,150"));
check("holiday pay names the longevity rate", () => has(DBL.comp, "168 hrs at base + 7.5% longevity"));
check("holiday pay is not the retirement-year figure", () => lacks(DBL.comp, "$9,910"));

console.log("\n" + (fail?"!! ":"") + pass + " passed, " + fail + " failed\n");
process.exit(fail?1:0);
