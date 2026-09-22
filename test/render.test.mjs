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
  for (const t of ["start","wait","sickleave","medical","inputs","pension","income","timeline","help"]) {
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
check("withholds the answer", () => has(A.start, "your number appears here"));
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
check("shows the answer", () => has(B.start, "Your number"));
check("shows what lands in the bank", () => has(B.start, "Lands in your bank"));
check("shows gross pension", () => has(B.start, "Gross CalPERS pension"));
check("shows medical as a deduction", () => has(B.start, "your out-of-pocket"));
check("compares against working take-home", () => has(B.start, "Working today, after everything"));
check("Classic member sees the 90% cap", () => has(B.start, "90% of final compensation"));
check("Classic member sees 12-month final comp", () => has(B.start, "highest 12 months"));
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
check("told 2.7% @ 57 has no cap", () => has(C.start, "has no cap"));
check("told the cap removal was a fix", () => has(C.start, "that was wrong"));
check("sees 36-month final comp explained", () => has(C.start, "36-month average"));
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
check("shows current pay section", () => has(E.start, "Your pay right now"));
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
check("collapsed header still shows current pay", () => /Your pay right now \s*\$/.test(E.start) || "no value in the collapsed header");
check("collapsed header still shows the hourly rate", () => /Your hourly rates \s*\$/.test(E.start) || "no value in the collapsed header");
check("collapsed header still shows cash-out total", () => /Cash-outs at retirement \s*\$/.test(E.start) || "no value in the collapsed header");
check("offers the education incentive", () => has(Eo.start, "Bachelor's degree (10%)"));
check("offers Chief Fire Officer for a Captain", () => has(Eo.start, "Chief Fire Officer cert (10%)"));
check("offers hazmat", () => has(Eo.start, "Hazmat"));
check("offers rescue", () => has(Eo.start, "Rescue"));
check("offers fire investigation", () => has(Eo.start, "Fire investigation"));
check("shows hourly rates", () => has(E.start, "Your hourly rates"));
check("shows the FLSA regular rate", () => has(Eo.start, "FLSA regular rate"));
check("shows All-Call 2x rate", () => has(Eo.start, "All-Call"));
check("shows future raises", () => has(E.start, "Future raises"));
check("shows the 2028 study is an assumption", () => has(Eo.start, "study"));
check("shows cash-outs at retirement", () => has(E.start, "Cash-outs at retirement"));
check("shows holiday cash-out", () => has(Eo.start, "Unused holiday hours at separation"));
check("tells them to confirm holiday practice", () => has(Eo.start, "Confirm the City's separation practice"));
check("shows what the pension is figured on", () => has(E.start, "What the pension is figured on"));
check("shows pensionable incentives in the build-up", () => has(E.start, "Pensionable incentives"));
check("Classic sees holiday pay as pensionable", () => has(E.start, "Holiday pay (168 hrs)"));
check("Classic sees uniform allowance", () => has(E.start, "Uniform allowance"));
check("Classic sees FLSA OT special comp", () => has(E.start, "FLSA overtime (special comp)"));
check("15% education+cert cap is applied", () => has(Eo.start, "15% Education + Cert Cap Applied"));

console.log("\n-- navigation --");
check("five primary tabs", () => ["Start here","What if I wait?","Sick leave","Medical","Everything else"]
  .every(x => B.start.includes(x)) || "a primary tab is missing");
check("old screens demoted, not deleted", () => ["All inputs","Pension detail","Timeline","Guide"]
  .every(x => B.inputs.includes(x)) || "an advanced screen is missing");

console.log("\n" + (fail?"!! ":"") + pass + " passed, " + fail + " failed\n");
process.exit(fail?1:0);
