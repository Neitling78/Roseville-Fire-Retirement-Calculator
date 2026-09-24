import { useState, useEffect, useCallback } from "react";
import logoUrl from "./assets/logo.png";
// ─── CONSTANTS FROM 2026 RFF MOU & SALARY SCHEDULE ───────────────────────────
// Official City of Roseville salary schedules, BOTH effective 3/21/2026.
//   Schedule A — 8 steps (A-H) — employees hired before 1/7/2017.
//   Schedule B — 9 steps (A-I) — employees hired on/after 1/7/2017. Same TOP step as A,
//     3% between steps, entry step 4.7% below the old step B (MOU Ch.2 Art.I.B & C).
// Monthly figures are the 56-hr suppression grade codes (e.g. 3320A); the "Z" 8-hour grade
// codes on the same schedule carry an identical monthly rate.
// Firefighter Paramedic I and II share a step table on both schedules — that is what the
// City publishes, not a typo.
const SALARY_SCHEDULE_A = {
  "Fire Captain":              { steps: { A: 8737.70, B: 9174.62, C: 9633.43, D: 10115.03, E: 10620.86, F: 11151.87, G: 11709.44, H: 12294.95 } },
  "Fire Engineer":             { steps: { A: 8016.42, B: 8417.28, C: 8838.19, D: 9280.01, E: 9744.01, F: 10231.21, G: 10742.78, H: 11280.17 } },
  "Firefighter Paramedic II":  { steps: { A: 7820.73, B: 8211.79, C: 8622.41, D: 9053.48, E: 9506.18, F: 9981.49, G: 10480.60, H: 11004.81 } },
  "Firefighter Paramedic I":   { steps: { A: 7820.73, B: 8211.79, C: 8622.41, D: 9053.48, E: 9506.18, F: 9981.49, G: 10480.60, H: 11004.81 } },
  "Firefighter EMT I":         { steps: { A: 6770.76, B: 7109.31, C: 7464.79, D: 7838.04, E: 8230.02, F: 8641.43, G: 9073.57, H: 9527.68 } },
  "Fire & Environmental Inspection Supervisor": { steps: { A: 8120.74, B: 8526.75, C: 8953.08, D: 9400.75, E: 9870.80, F: 10364.33, G: 10882.54, H: 11426.71 } },
  "Fire Plans Examiner":       { steps: { A: 7105.40, B: 7460.68, C: 7833.71, D: 8225.39, E: 8636.66, F: 9068.49, G: 9521.93, H: 9998.01 } },
  "Fire & Environmental Safety Inspector II": { steps: { A: 6766.81, B: 7105.19, C: 7460.46, D: 7833.47, E: 8225.10, F: 8636.37, G: 9068.19, H: 9521.67 } },
  "Fire & Environmental Safety Inspector I":  { steps: { A: 6151.67, B: 6459.32, C: 6782.26, D: 7121.37, E: 7477.44, F: 7851.34, G: 8243.85, H: 8656.09 } },
};
const SALARY_SCHEDULE_B = {
  "Fire Captain":              { steps: { A: 9548.06, B: 9996.80, C: 10296.71, D: 10605.60, E: 10923.76, F: 11251.51, G: 11589.03, H: 11936.70, I: 12294.95 } },
  "Fire Engineer":             { steps: { A: 8760.10, B: 9171.78, C: 9446.96, D: 9730.40, E: 10022.25, F: 10322.94, G: 10632.63, H: 10951.62, I: 11280.17 } },
  "Firefighter Paramedic II":  { steps: { A: 8546.26, B: 8947.92, C: 9216.36, D: 9492.85, E: 9777.62, F: 10070.93, G: 10373.08, H: 10684.30, I: 11004.81 } },
  "Firefighter Paramedic I":   { steps: { A: 8546.26, B: 8947.92, C: 9216.36, D: 9492.85, E: 9777.62, F: 10070.93, G: 10373.08, H: 10684.30, I: 11004.81 } },
  "Firefighter EMT I":         { steps: { A: 7819.84, B: 8015.38, C: 8215.72, D: 8421.14, E: 8631.63, F: 8847.46, G: 9068.60, H: 9295.35, I: 9527.68 } },
  "Fire & Environmental Inspection Supervisor": { steps: { A: 8873.45, B: 9290.49, C: 9569.25, D: 9856.32, E: 10151.99, F: 10456.56, G: 10770.24, H: 11093.37, I: 11426.71 } },
  "Fire Plans Examiner":       { steps: { A: 7764.38, B: 8129.30, C: 8373.18, D: 8624.37, E: 8883.09, F: 9149.61, G: 9424.08, H: 9706.81, I: 9998.01 } },
  "Fire & Environmental Safety Inspector II": { steps: { A: 7394.64, B: 7742.18, C: 7974.46, D: 8213.69, E: 8460.09, F: 8713.90, G: 8975.30, H: 9244.59, I: 9521.93 } },
  "Fire & Environmental Safety Inspector I":  { steps: { A: 6722.40, B: 7038.34, C: 7249.49, D: 7466.97, E: 7690.99, F: 7921.73, G: 8159.37, H: 8404.17, I: 8656.28 } },
};
// MOU Ch.2 Art.I.C — Schedule B applies to employees initially hired on/after 1/7/2017.
const SCHEDULE_B_CUTOFF = new Date("2017-01-07");
const scheduleForHire = (d) => (d < SCHEDULE_B_CUTOFF ? SALARY_SCHEDULE_A : SALARY_SCHEDULE_B);
// Cutoff dates per MOU
// Prevention classes get different general wage increases from suppression under the MOU.
const PREVENTION_CLASSES = [
  "Fire & Environmental Inspection Supervisor", "Fire Plans Examiner",
  "Fire & Environmental Safety Inspector II", "Fire & Environmental Safety Inspector I",
];
const isPreventionClass = (cls) => PREVENTION_CLASSES.indexOf(cls) !== -1;
// Contractual base-pay movement, MOU Ch.2 Art.I.A. These are not assumptions.
//   2026 (eff. 3/21/26) — already baked into the salary schedules loaded above.
//   2027 (1st full pay period in Jan) — prevention +2.5%; suppression 0% GWI; rank separation:
//        Fire Engineer set 7.5% above Firefighter Paramedic II, Fire Captain 10% above Engineer.
//   2028 (1st full pay period in Jan) — Total Compensation Study, amount NOT yet known; the
//        alignment tightens to Engineer 10% above Paramedic, Captain 10% above Engineer.
//   2029 (1st full pay period in Jan) — FF Para I/II and EMT I +1.75%; prevention +3.0%;
//        alignment held at Captain = Engineer x1.10, Engineer = FF Para II x1.10.
const MOU_TERM_END_YEAR = 2029;   // MOU term 1/1/26 – 12/31/29
const MOU_GWI = {
  2027: { prevention: 0.025, suppression: 0 },
  2029: { prevention: 0.030, suppression: 0.0175 },
};
const mouGwiFor = (year, cls) => {
  const row = MOU_GWI[year];
  if (!row) return 0;
  return isPreventionClass(cls) ? row.prevention : row.suppression;
};
const CLASSIC_PEPRA_CUTOFF_YEAR = 2013;          // Hired before 1/1/2013 = Classic
const LONGEVITY_CUTOFF_YEAR = 2017;              // Hired before 1/1/2017 = Longevity; on/after = Service Term Bonus
const ENGINEER_CERT_CEASE_DATE = new Date("2027-01-09");
const CAPTAIN_INCENTIVE_CEASE_DATE = new Date("2027-01-09"); // Captain Paramedic & Engine Boss
// Retiree medical (MOU Art II): Tier 1/2 = $1,200/mo, Tier 3 = $720/mo, both 2% COLA from 1/1/2013.
// Tier 4 (hired 8/15/2015+): NO lifetime premium — City deposits $100/mo (flat) to an RHS account
// starting in year 6 of service until retirement; member draws that account balance down.
const RETIREE_MEDICAL_BASE = 1200;       // Tier 1 & Tier 2
const TIER3_MEDICAL_BASE = 720;          // Tier 3 (hired 2012–2014)
const RETIREE_MEDICAL_COLA = 0.02;
const RETIREE_MEDICAL_BASE_YEAR = 2013;
// Retiree pension COLA is set by DATE OF CALPERS MEMBERSHIP, not Classic/PEPRA status.
// MOU Ch.5 Art.I.F: 3% for everyone hired before 12/16/2016, and for Classic hired on/after;
// 2% only for PEPRA hired on/after. Roseville's CalPERS contract agrees: para 11.j elects
// Sec 21335 (3% COLA) for local fire entering membership on or before 12/16/2016, and
// para 11.m applies Sec 21329 (2% COLA) only to those entering after that date.
const COLA_TIER_DATE = new Date("2016-12-16");
const TIER4_RHS_CITY_MONTHLY = 100;      // Tier 4 City RHS deposit, flat (no escalator)
const TIER4_RHS_VEST_AFTER_YEARS = 5;    // City deposits begin in year 6 of service
const VESTING_SCHEDULE = {
  10: 0.50, 11: 0.55, 12: 0.60, 13: 0.65, 14: 0.70,
  15: 0.75, 16: 0.80, 17: 0.85, 18: 0.90, 19: 0.95, 20: 1.00
};
// Longevity (Article VIII) — hired before 1/1/2017; pensionable for Classic only
const LONGEVITY = (yos) => {
  if (yos >= 20) return 0.075;
  if (yos >= 15) return 0.05;
  if (yos >= 10) return 0.025;
  return 0;
};
// Service Term Bonus (Article IX) — hired on/after 1/1/2017; NOT pensionable
const SERVICE_TERM_BONUS = (yos) => {
  if (yos >= 15) return 0.05;
  if (yos >= 10) return 0.025;
  return 0;
};
// Sick leave payout tiers (24-hr shift)
// Cash payout tiers (24-hr shift, per MOU Ch3 Art III table).
// Top tier extended to Infinity — Roseville fire has no accrual cap, so hours above 1800 stay at 70%.
// MOU Ch.3 Art.III.A.1: the 24-hour-shift payoff band is "1800 to 2400" under a column
// headed "Max". Hours above 2400 are outside the table. The tool therefore pays out on at
// most 2400 hours; anything above that is worth more as service credit anyway.
const SICK_LEAVE_PAYOFF_MAX_HOURS = 2400;
const SICK_LEAVE_TIERS = [
  { min: 1800, max: Infinity, pct: 0.70 },
  { min: 1434, max: 1799.99, pct: 0.60 },
  { min: 1146, max: 1433.99, pct: 0.50 },
  { min: 858, max: 1145.99, pct: 0.40 },
  { min: 570, max: 857.99, pct: 0.30 },
  { min: 282, max: 569.99, pct: 0.20 },
  { min: 0, max: 281.99, pct: 0.00 }
];
// Sick leave conversion (CalPERS Gov Code §20862.8 — safety members + MOU Ch5 Art I + Ch3 Art III)
// MOU explicitly states 100% of accumulated sick leave is credited to service (no cap).
// CalPERS standard: 250 days of unused sick leave = 1 year of additional service credit.
// Days are 8-hour days per CalPERS procedures (MOU confirms "1200 hours = 150 days").
// No double-dipping: hours can be EITHER cashed out OR converted to credit, not both.
const SICK_LEAVE_HOURS_PER_DAY = 8;
const SICK_LEAVE_DAYS_PER_YEAR_CREDIT = 250;
const SICK_LEAVE_HOURS_PER_YEAR_CREDIT = SICK_LEAVE_HOURS_PER_DAY * SICK_LEAVE_DAYS_PER_YEAR_CREDIT; // 2000
// Roseville 24-hr shift personnel: 6 shifts/yr × 24 hrs = 144 hrs/yr accrual.
// No accrual cap for Roseville fire.
const SICK_LEAVE_ANNUAL_ACCRUAL_HOURS = 144;
const HOLIDAY_HOURS = 168;
// 56-hr shift firefighter monthly hours (56 × 52 ÷ 12) — matches the official schedule's
// hourly rate (base ÷ 242.67). Used as the FLSA regular-rate divisor for overtime.
const FLSA_56HR_MONTHLY_HOURS = 242.67;
const UNIFORM_ALLOWANCE_ANNUAL = 1300;  // pensionable uniform allowance, Classic only (per Treasurer)
// ── FLSA REGULARLY SCHEDULED OVERTIME (pensionable, Classic only) ──────────────
// MOU Ch.3 Art.II.A: "The City will maintain a twenty-four (24) day FLSA work period (182 hours
// worked) to coincide with the 48/96 work schedule... All regularly scheduled overtime, plus
// applicable longevity pay, shall be reported to CalPERS as special compensation under C.C.R
// § 571, pursuant to the Public Employee Retirement Law."
//
// So it is pensionable by contract, and the amount falls straight out of the schedule:
//   48/96 is a 6-day cycle working 48 hours, so a 24-day work period is 4 × 48 = 192 hours worked.
//   192 − 182 = 10 hours over the FLSA threshold every cycle, by schedule alone.
//   10 hrs × (365.25 ÷ 24 cycles) = 152.19 overtime hours a year.
//   Base salary already pays straight time for every scheduled hour — the salary schedule's own
//   divisor is 242.67/mo (56 × 52 ÷ 12 = 2,912 hrs/yr) — so what FLSA still owes is the
//   HALF-time premium on those hours: 152.19 × 0.5 = 76.1 premium-hours a year.
//   76.1 ÷ 2,912 = 2.61% of base.
//
// This was a hardcoded 2% with no derivation behind it. It is now computed from the MOU's own
// numbers so it can be checked. It is still DERIVED, not confirmed against a pay stub or against
// what the City actually reports to CalPERS — members can override it from their own stub.
const FLSA_WORK_PERIOD_DAYS = 24;
const FLSA_WORK_PERIOD_THRESHOLD_HOURS = 182;
const FLSA_HOURS_WORKED_PER_PERIOD = 192;              // 48/96 across a 24-day period
const FLSA_OT_HOURS_PER_YEAR =
  (FLSA_HOURS_WORKED_PER_PERIOD - FLSA_WORK_PERIOD_THRESHOLD_HOURS) * (365.25 / FLSA_WORK_PERIOD_DAYS);
const FLSA_ANNUAL_SCHEDULE_HOURS = FLSA_56HR_MONTHLY_HOURS * 12;   // 2,912
const FLSA_OT_PENSIONABLE_PCT = (FLSA_OT_HOURS_PER_YEAR * 0.5) / FLSA_ANNUAL_SCHEDULE_HOURS;
// PEMHCA minimum employer contribution — set by CalPERS every year, NOT a fixed number.
// 2026: $162 (Circular Letter 600-023-25). 2027: $167 (Circular Letter 600-026-26).
// Add each new year here every January. Beyond the last known year the tool escalates at
// PEMHCA_MIN_ASSUMED_COLA and says so.
const PEMHCA_MIN_BY_YEAR = { 2026: 162, 2027: 167 };
const PEMHCA_MIN_ASSUMED_COLA = 0.029;   // CalPERS used 2.9% to set the 2027 figure
const PEMHCA_LAST_KNOWN_YEAR = 2027;
function pemhcaMinFor(year) {
  if (PEMHCA_MIN_BY_YEAR[year] != null) return PEMHCA_MIN_BY_YEAR[year];
  if (year < 2026) return PEMHCA_MIN_BY_YEAR[2026];
  const yrs = year - PEMHCA_LAST_KNOWN_YEAR;
  return Math.round(PEMHCA_MIN_BY_YEAR[PEMHCA_LAST_KNOWN_YEAR] * Math.pow(1 + PEMHCA_MIN_ASSUMED_COLA, yrs));
}
const CITY_MATCH_PCT = 0.03;
const CITY_MATCH_MIN_YEARS = 5;
// 2026 IRS limits for governmental 457(b) plans (IRS Notice 2025-67). Update every year.
const MAX_457_ANNUAL = 24500;            // elective deferral limit
const CATCHUP_457_AGE50 = 8000;          // age 50+ catch-up  -> 32,500
const CATCHUP_457_AGE60_63 = 11250;      // SECURE 2.0 "super" catch-up, ages 60-63 -> 35,750
const MAX_457_SPECIAL_3YR = 49000;       // 457(b) special three-year pre-retirement catch-up
// Which ceiling applies to a member of a given age in a given plan year.
// The special three-year catch-up runs in the 3 years BEFORE normal retirement age and
// cannot be combined with the age-based catch-up -- the member takes the greater.
function max457For(age, normalRetAge, useSpecial3yr) {
  const base = MAX_457_ANNUAL;
  const ageBased = age >= 60 && age <= 63 ? base + CATCHUP_457_AGE60_63
    : age >= 50 ? base + CATCHUP_457_AGE50
    : base;
  const eligible3yr = normalRetAge != null && age >= normalRetAge - 3 && age < normalRetAge;
  return (useSpecial3yr && eligible3yr) ? Math.max(ageBased, MAX_457_SPECIAL_3YR) : ageBased;
}
// CalPERS PEPRA pensionable-compensation cap, non-Social-Security (safety) members, 2026: $191,679
// (CalPERS Circular Letter 200-001-26). Indexed annually — escalated to the retirement year below.
const PEPRA_COMP_CAP_2026 = 191679;
const PEPRA_CAP_COLA = 0.025;       // assumed annual CPI indexing of the PEPRA cap
const UNION_DUES_MONTHLY = 222;     // IAFF Local 1592 dues — used in the take-home comparison
// ── CalPERS HEALTH PREMIUMS · 2027 · REGION 1 ────────────────────────────
// Source: CalPERS "2027 Health Premiums, Region 1" rate sheet, effective 1/1/2027.
// Region 1 is the correct region for Roseville — it covers Placer and Sacramento
// counties (also El Dorado, Nevada, Yolo, Sutter, Yuba and most of NorCal).
// CalPERS held the overall 2027 increase to 4.97%.
//
// These are the BASIC (non-Medicare) rates. They are what an active member pays and
// what a retiree under 65 pays — same premium, different employer contribution.
// Medicare rates at 65 are in MEDICARE_PLANS_2027 below and are far lower.
//
// Changes CalPERS made for 1/1/2027, all of which are reflected here:
//   · UnitedHealthcare SignatureValue Alliance and Harmony EXIT ALL COUNTIES —
//     they are gone from CalPERS entirely, not just from Region 1.
//   · Blue Shield EPO expands INTO Placer County (new option for Roseville members).
//   · Sutter Health Plan HMO is brand new for 2027 and covers Placer County.
// Kaiser stays first in this list because the City's contribution is a percentage
// of the Kaiser premium for your tier (MOU Ch.4 Art.I §C).
const MEDICAL_PLANS_2027 = [
  { name: "Kaiser Permanente",         ee: 1187.63, ee1: 2375.26, fam: 3087.84 },
  { name: "Sutter Health Plan",        ee: 1130.67, ee1: 2261.34, fam: 2939.74, isNew: true },
  { name: "Blue Shield Trio",          ee: 1202.57, ee1: 2405.14, fam: 3126.68 },
  { name: "Blue Shield Access+",       ee: 1479.12, ee1: 2958.24, fam: 3845.71 },
  { name: "Blue Shield EPO",           ee: 1479.12, ee1: 2958.24, fam: 3845.71, isNew: true },
  { name: "Anthem HMO Select",         ee: 1486.44, ee1: 2972.88, fam: 3864.74 },
  { name: "Anthem HMO Traditional",    ee: 1732.52, ee1: 3465.04, fam: 4504.55 },
  { name: "Western Health Advantage",  ee: 1030.80, ee1: 2061.60, fam: 2680.08 },
  { name: "PERS Platinum (PPO)",       ee: 1778.62, ee1: 3557.24, fam: 4624.41 },
  { name: "PERS Gold (PPO)",           ee: 1215.17, ee1: 2430.34, fam: 3159.44 },
  { name: "PORAC (RFF only)",          ee: 1095.00, ee1: 2395.00, fam: 3115.00 },
];
// Plans that went away on 1/1/2027. A saved election pointing at one of these is
// moved to the nearest surviving plan so nobody silently gets Kaiser's numbers
// while their screen still says UnitedHealthcare.
const RETIRED_PLANS_2027 = {
  "UnitedHealthcare Alliance": "Kaiser Permanente",
  "UnitedHealthcare Harmony": "Kaiser Permanente",
};
// ── MEDICARE PREMIUMS · 2027 · REGION 1 ──────────────────────────────────
// What the same coverage costs once you turn 65 and enroll in Medicare Parts A and B.
// You must take Part B to keep a CalPERS plan at 65 — the Part B premium is paid to
// Medicare separately and is NOT in these figures.
// Retiring at 50 means roughly 15 years on the Basic rates above before you get here.
const MEDICARE_PLANS_2027 = [
  { name: "Kaiser Senior Advantage",          single: 333.93, two: 667.86,  fam: 1001.79, kind: "Advantage" },
  { name: "Kaiser Senior Advantage Summit",   single: 391.74, two: 783.48,  fam: 1175.22, kind: "Advantage" },
  { name: "UnitedHealthcare Medicare PPO",    single: 534.00, two: 1068.00, fam: 1602.00, kind: "Advantage" },
  { name: "PERS Gold Supplement",             single: 597.57, two: 1195.14, fam: 1792.71, kind: "Supplement" },
  { name: "Anthem Medicare Preferred PPO",    single: 619.25, two: 1238.50, fam: 1857.75, kind: "Advantage" },
  { name: "Blue Shield Medicare Advantage",   single: 619.36, two: 1238.72, fam: 1858.08, kind: "Advantage" },
  { name: "PORAC Medicare Supplement",        single: 640.00, two: 1410.00, fam: 1925.00, kind: "Supplement" },
  { name: "PERS Platinum Supplement",         single: 665.50, two: 1331.00, fam: 1996.50, kind: "Supplement" },
];
const MEDICARE_TIER_FROM_COVERAGE = { ee: "single", ee1: "two", fam: "fam" };
// ── 2026 · REGION 1 (archived) ───────────────────────────────────────────
// Kept so a member can look back at what they were paying. UnitedHealthcare Alliance and
// Harmony existed this year; both exit CalPERS entirely on 1/1/2027.
const MEDICAL_PLANS_2026 = [
  { name: "Kaiser Permanente",         ee: 1168.86, ee1: 2337.72, fam: 3039.04 },
  { name: "Blue Shield Trio",          ee: 1166.58, ee1: 2333.16, fam: 3033.11 },
  { name: "Blue Shield Access+",       ee: 1301.95, ee1: 2603.90, fam: 3385.07 },
  { name: "Anthem HMO Select",         ee: 1336.29, ee1: 2672.58, fam: 3474.35 },
  { name: "Anthem HMO Traditional",    ee: 1612.08, ee1: 3224.16, fam: 4191.41 },
  { name: "UnitedHealthcare Alliance", ee: 1290.06, ee1: 2580.12, fam: 3354.16 },
  { name: "UnitedHealthcare Harmony",  ee: 1133.09, ee1: 2266.18, fam: 2946.03 },
  { name: "Western Health Advantage",  ee: 969.58,  ee1: 1939.16, fam: 2520.91 },
  { name: "PERS Platinum (PPO)",       ee: 1670.14, ee1: 3340.28, fam: 4342.36 },
  { name: "PERS Gold (PPO)",           ee: 1120.58, ee1: 2241.16, fam: 2913.51 },
  { name: "PORAC (RFF only)",          ee: 1063.00, ee1: 2418.00, fam: 3027.00 },
];
// ── THE RATE YEAR PICKER ─────────────────────────────────────────────────
// CalPERS publishes the following year's premiums around June and they take effect the
// next January 1. A year whose sheet is not out yet is `null` here — NOT a copy of the
// prior year and NOT a guess. The screen says "pending" and shows the newest published
// year instead, clearly labelled, so nobody plans against a number CalPERS never set.
// TO ADD A YEAR: drop the new rate sheet's figures in as an array and delete the null.
const MEDICAL_PLANS_BY_YEAR = {
  2026: MEDICAL_PLANS_2026,
  2027: MEDICAL_PLANS_2027,
  2028: null,   // pending — CalPERS publishes ~June 2027, effective 1/1/2028
};
const MEDICARE_PLANS_BY_YEAR = {
  2026: null,   // not loaded — we only ever pulled the Basic sheet for 2026
  2027: MEDICARE_PLANS_2027,
  2028: null,   // pending
};
const HEALTH_RATE_YEARS = [2026, 2027, 2028];
const HEALTH_RATE_CURRENT = 2027;         // newest year with a published sheet
// Resolve a requested year to the table actually used, and say whether we fell back.
function healthRatesFor(year, table, newest) {
  const asked = Number(year) || newest;
  if (table[asked]) return { year: asked, plans: table[asked], pending: false };
  // Walk back to the newest published year at or below the request.
  const published = Object.keys(table).map(Number).filter(y => table[y]).sort((a, b) => b - a);
  const use = published.find(y => y <= asked) ?? published[0];
  return { year: use, plans: table[use] || [], pending: true, askedFor: asked };
}
// ── WHAT THE CITY ACTUALLY PAYS TOWARD YOUR MEDICAL ──────────────────────
// MOU Ch.4 Art.I §C.3 (effective 3/21/2026) sets ONE combined target, not a stack of allowances:
//   "City Flex Plan Credit (COMBINED WITH the Cafeteria Plan Allowance) covers:
//      Employee Only          — up to 100% of the Kaiser employee only premium, plus $180 dental/vision
//      Employee & 1 Dependent — up to  85% of the Kaiser employee plus one premium, plus $180
//      Employee & 2+          — up to  80% of the Kaiser family premium, plus $180"
// So the percentage of Kaiser IS the benefit. The $1,347 Cafeteria Plan Allowance in §C.2 is a
// FUNDING COMPONENT of that same total (and is itself reduced by the PEMHCA payment the City sends
// straight to CalPERS) — it is not an extra $1,347 on top. Modelling it as a separate additive
// amount would double-count the City’s contribution, so it is deliberately not a constant here.
// The percentages live in CITY_MED_PCT and the $180 in DV_CREDIT, both below. Because the target is
// a percentage of Kaiser, the City share moves on its own every time the Kaiser premium changes.
// Delta Dental 2026 monthly rates by tier (EE only / +spouse / +children / +family)
const DENTAL_PLANS_2026 = [
  { name: "None", ee: 0, spouse: 0, children: 0, family: 0 },
  { name: "Delta Dental High PPO", ee: 63.75, spouse: 112.22, children: 110.28, family: 169.43 },
  { name: "Delta Dental Low PPO", ee: 43.43, spouse: 78.03, children: 73.97, family: 115.15 },
  { name: "DeltaCare HMO", ee: 17.40, spouse: 34.20, children: 32.10, family: 57.00 },
];
const VISION_2026 = { ee: 7.49, ee1: 10.86, fam: 19.48 };     // VSP monthly by tier
const DENTAL_TIER_FROM_MED = { ee: "ee", ee1: "spouse", fam: "family" }; // map medical tier → dental tier
// ── TAX BRACKETS ───────────────────────────────────────────────────────────
// 2026 federal brackets (IRS Rev. Proc. 2025-32) + standard deduction.
const FED_BRACKETS_2026 = {
  single: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]],
  mfj: [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [Infinity, .37]],
  hoh: [[17700, .10], [67450, .12], [105700, .22], [201775, .24], [256200, .32], [640600, .35], [Infinity, .37]],
};
const FED_STD_2026 = { single: 16100, mfj: 32200, hoh: 24150 };
// California 2025 brackets (FTB) + standard deduction. MFJ = 2× single.
const CA_BRACKETS_2025 = {
  single: [[11079, .01], [26264, .02], [41452, .04], [57558, .06], [72742, .08], [371476, .093], [445771, .103], [742952, .113], [Infinity, .123]],
  mfj: [[22158, .01], [52528, .02], [82904, .04], [115116, .06], [145484, .08], [742952, .093], [891542, .103], [1485904, .113], [Infinity, .123]],
  hoh: [[22173, .01], [52530, .02], [67716, .04], [83823, .06], [99005, .08], [505462, .093], [606538, .103], [1010918, .113], [Infinity, .123]],
};
const CA_STD_2025 = { single: 5540, mfj: 11080, hoh: 11080 };
// Hardened states (real brackets/exemptions on retirement income; single-filer brackets, 2025).
const SC_BRACKETS = [[3560, 0], [17830, .03], [Infinity, .06]];   // South Carolina (+ retirement deduction)
const MT_BRACKETS = [[21100, .047], [Infinity, .059]];            // Montana (+ $5,500 retirement deduction)
const HI_BRACKETS = [[9600, .014], [14400, .032], [19200, .055], [24000, .064], [36000, .068], [48000, .072], [150000, .079], [175000, .0825], [225000, .09], [275000, .10], [Infinity, .11]]; // Hawaii — pension exempt, applies to 457/other only
// Every state for the retirement comparison. CA is computed with full brackets; all others use an
// approximate flat rate on retirement income (0 = no income tax OR fully exempts pension/retirement).
// These are ballpark starting points — the member can adjust; pension treatment varies by state.
const STATES_LIST = [
  { code: "CA", name: "California", rate: null },
  { code: "AL", name: "Alabama", rate: 4 }, { code: "AK", name: "Alaska", rate: 0 },
  { code: "AZ", name: "Arizona", rate: 2.5 }, { code: "AR", name: "Arkansas", rate: 3.9 },
  { code: "CO", name: "Colorado", rate: 4.4 }, { code: "CT", name: "Connecticut", rate: 5 },
  { code: "DE", name: "Delaware", rate: 5 }, { code: "DC", name: "Washington, D.C.", rate: 6 },
  { code: "FL", name: "Florida", rate: 0 }, { code: "GA", name: "Georgia", rate: 5.4 },
  { code: "HI", name: "Hawaii", rate: 0 }, { code: "ID", name: "Idaho", rate: 5.3 },
  { code: "IL", name: "Illinois", rate: 0 }, { code: "IN", name: "Indiana", rate: 3 },
  { code: "IA", name: "Iowa", rate: 0 }, { code: "KS", name: "Kansas", rate: 5 },
  { code: "KY", name: "Kentucky", rate: 4 }, { code: "LA", name: "Louisiana", rate: 3 },
  { code: "ME", name: "Maine", rate: 6 }, { code: "MD", name: "Maryland", rate: 5 },
  { code: "MA", name: "Massachusetts", rate: 5 }, { code: "MI", name: "Michigan", rate: 4.25 },
  { code: "MN", name: "Minnesota", rate: 7 }, { code: "MS", name: "Mississippi", rate: 0 },
  { code: "MO", name: "Missouri", rate: 4 }, { code: "MT", name: "Montana", rate: 5 },
  { code: "NE", name: "Nebraska", rate: 5 }, { code: "NV", name: "Nevada", rate: 0 },
  { code: "NH", name: "New Hampshire", rate: 0 }, { code: "NJ", name: "New Jersey", rate: 2 },
  { code: "NM", name: "New Mexico", rate: 4 }, { code: "NY", name: "New York", rate: 6 },
  { code: "NC", name: "North Carolina", rate: 4.25 }, { code: "ND", name: "North Dakota", rate: 2 },
  { code: "OH", name: "Ohio", rate: 3 }, { code: "OK", name: "Oklahoma", rate: 4 },
  { code: "OR", name: "Oregon", rate: 8 }, { code: "PA", name: "Pennsylvania", rate: 0 },
  { code: "RI", name: "Rhode Island", rate: 4 }, { code: "SC", name: "South Carolina", rate: 4 },
  { code: "SD", name: "South Dakota", rate: 0 }, { code: "TN", name: "Tennessee", rate: 0 },
  { code: "TX", name: "Texas", rate: 0 }, { code: "UT", name: "Utah", rate: 4.55 },
  { code: "VT", name: "Vermont", rate: 6 }, { code: "VA", name: "Virginia", rate: 5 },
  { code: "WA", name: "Washington", rate: 0 }, { code: "WV", name: "West Virginia", rate: 4 },
  { code: "WI", name: "Wisconsin", rate: 5 }, { code: "WY", name: "Wyoming", rate: 0 },
];
const MEDICAL_COVERAGE_LABELS = { ee: "Employee only", ee1: "Employee + 1 dependent", fam: "Employee + family" };
// Member-facing changelog shown in the "What's New" tab. Newest first. Add a new {date, items} at the top each update.
const CHANGELOG = [
  { date: "September 24, 2026 (v52)", items: [
    "<strong>“What waiting actually costs” now prices every year at that year’s paycheck.</strong> It used to price all of them at this month’s — so a member weighing five more years was told those five years pay what 2026 pays. The <em>cash you give up getting there</em> column is now built year by year, and the break-even and 20-year columns follow from it.",
    "<strong>The cost of waiting drops sharply for most members</strong>, because the paycheck you give up grows while the earliest pension you are measuring it against does not. On the reference Captain it went from about $19,700 a year to about $9,400 for the first year.",
    "The card says which year it is quoting, and when raises make the years differ it says the column is not that figure multiplied out.",
    "<strong>For a member at the 90% cap this is the whole picture:</strong> more years stop adding to the formula, so the only thing another year buys is a higher final compensation — and this table is where you see whether that is worth the checks you skip.",
  ] },
  { date: "September 24, 2026 (v51)", items: [
    "<strong>Corrected: “The day you hang it up” was comparing your future pension against your <em>current</em> paycheck.</strong> If you retire in 2028, the money you walk away from is your 2028 paycheck, not this month’s — and every raise between now and then was quietly being handed to the retirement side of the ledger. The card now reads <strong>Working in 2028 · your last year</strong>, built on that year’s pay, that year’s overtime and that year’s CalPERS contribution.",
    "<strong>Expect the gap to move against retiring.</strong> Anyone the old card showed coming out ahead should look again — the number was flattered by the raises you have not taken yet.",
    "The card is now independent of the year picker on Compensation. It is always your last working year against your first retired year; moving the picker does not move it.",
    "<strong>Still on today’s pay, on purpose:</strong> “Working today, after everything” on Pension, which is labelled as today. <strong>Not yet fixed:</strong> the “cost of waiting” table further down Stay or go? still prices a year of work at today’s paycheck. Same error, bigger change — flagged, not silently altered.",
  ] },
  { date: "September 24, 2026 (v50)", items: [
    "<strong>“Current compensation” is now just “Compensation.”</strong>",
    "<strong>It opens on your retirement year, not today.</strong> The big numbers at the top of every screen are built from your retirement-year pay; this table was opening on this month's pay. Two different years on one screen, with nothing saying so. The picker now lands on the year you said you are going — the card reads <em>Compensation in 2028 · your last year</em> — and the header moves with it.",
    "The picker still works exactly as before. Move it to 2026 and the whole table, the hourly rates and the header all follow; wherever you put it, it stays put.",
    "<strong>Worth knowing:</strong> the <em>Working now</em> line on Stay or go? is still today's pay on purpose — that card is asking what leaving costs you against what you are earning right now.",
  ] },
  { date: "September 24, 2026 (v49)", items: [
    "<strong>“Into the weeds” is gone.</strong> It held exactly two screens and charged you a click to reach either one. <strong>Other income &amp; tax</strong> and <strong>Guide</strong> now sit in the main tab row with everything else — eight tabs, one row, no parent.",
    "Old links to <em>?tab=advanced</em> land on Other income &amp; tax.",
  ] },
  { date: "September 24, 2026 (v48)", items: [
    "<strong>Section 2 is a form again, not a wall of grey text.</strong> Every explanatory paragraph on Member details collapsed into a one-line <em>▸ more</em> link that opens when you want it: why the exact myCalPERS figure is worth pulling, when you would tick the Classic box yourself, why the tool will not fill in your sick leave hours, and why cash and credit are one-or-the-other.",
    "The labels still say what to enter. Only the reasoning is behind a click, so a member breezing through sees six short questions instead of six paragraphs.",
    "<strong>Fixed:</strong> a disclosure that starts closed took two clicks to open — the first click set it to a state that still read as closed. It opens on the first click now. This also affected “have the exact figure?”, which has been there a while.",
  ] },
  { date: "September 24, 2026 (v47)", items: [
    "<strong>Sick leave is now one question and one choice.</strong> “How many sick leave hours will you have on the books at retirement?” — your number, for your last day. Then two boxes: <strong>add to service time</strong> or <strong>cash out</strong>. Only one can be ticked, because only one is legal with the same hour.",
    "<strong>The tool has stopped guessing your balance.</strong> It used to take today’s hours and add 144 hrs/yr all the way to your last day, which is only right for a member who never calls in sick. The accrual figure is still shown, underneath, labelled as a ceiling rather than a forecast.",
    "Tick <strong>add to service time</strong> and you see exactly what it buys, to the hundredth of a year. Tick <strong>cash out</strong> and the dollar figure carries through to <strong>Pension → Also waiting for you at retirement</strong>.",
    "Both figures are quoted on both boxes whichever one you tick — that comparison is the whole decision, and it should not disappear the moment you choose.",
    "<strong>“Cash or credit?” is now a closed box you open if you want it.</strong> It moved up into section 2, under the choice it explains, and collapsed behind <em>Want more details?</em> — breeze past it and you still have both figures on the checkboxes.",
    "<strong>New inside it: why your cash-out is about half of hours × your hourly rate.</strong> The City does not buy sick leave at 100%. The MOU pays a percentage set by the size of your balance (Ch. 3, Art. III, 24-hour-shift column) — 0% below 282 hrs, then 20/30/40/50/60%, reaching 70% at 1,800 hrs. The full table is listed with your own band marked, and the arithmetic written out: hours × rate × percentage = your figure, against what 100% would have been.",
    "Two parts of that panel are labelled as <strong>my reading of the MOU, not confirmed City practice</strong>: that the percentage applies to the whole balance, and that hours above 2,400 fall outside the table. Confirm both with the Treasurer.",
    "Knock-on: <strong>Stay or go?</strong> no longer grows your sick-leave balance for each year you wait. Your estimate is your estimate.",
  ] },
  { date: "September 24, 2026 (v46)", items: [
    "<strong>Section 2 asks for your hire date and answers the rest itself.</strong> Service credit is now a sentence, not an empty box \u2014 \u201cService credit: 22.7 yrs at retirement, estimated from your hire date\u201d \u2014 with the exact myCalPERS figure behind one word if you have your statement open. It no longer reads like something you forgot to fill in.",
    "<strong>One plain question underneath it: \u201cAre you Classic, 3% @ 50?\u201d</strong> Your hire date ticks it (before 1/1/2013 = Classic, after = PEPRA). The reason it is a question at all is the member who is Classic through CalPERS reciprocity from an agency before Roseville \u2014 the hire date cannot see that, and nothing else in the tool is right if it is wrong.",
    "Gone: the formula dropdown, the separate \u201coverride\u201d checkbox, and the gold warning that made a working estimate look like an error.",
  ] },
  { date: "September 24, 2026 (v45)", items: [
    "<strong>Member details got its three extra cards back down to nothing.</strong> Section 2 now carries one quiet grey line \u2014 \u201cHave your myCalPERS numbers?\u201d \u2014 and everything else is behind it. Breeze past it and you get the estimate; open it and you get an exact pension.",
    "Behind that line: your Roseville service credit (with the \u201clast reported\u201d date and the purchased-credit flag appearing only once you fill it in), and one checkbox \u2014 <strong>\u201cI am locked into Classic (3% @ 50) through CalPERS reciprocity\u201d</strong>. Tick it and the formula picker appears; leave it and the badge at the top of section 2 already tells you which formula you are on.",
    "Dropped the \u201cWhich formula you are on\u201d card entirely. It only read back what the hire date already decided, and section 2 was showing that in a badge two inches above it.",
    "The CalPERS account balance moved to <strong>Pension</strong>, next to the comparison that uses it \u2014 what you would be refunded if you quit, against what a private saver would need for the same income.",
    "Folded the \u201cCash-out at retirement\u201d card into \u201cCash or credit?\u201d. The dollar figure was in both; the rate detail and the holiday-hours correction are now in the one panel that makes the decision.",
  ] },
  { date: "September 24, 2026 (v44)", items: [
    "<strong>All inputs and Sick leave are gone \u2014 folded into Member details, not deleted.</strong> Seven things lived only on All inputs, and four of them were the myCalPERS figures that make your pension accurate rather than estimated. They now sit under 2 \u00b7 Roseville, where the service question already is.",
    "<strong>Moved from All inputs:</strong> your CalPERS service credit and its as-of date, whether that figure already includes purchased time, your CalPERS account balance, and the Classic/PEPRA reciprocity override.",
    "<strong>Moved from Sick leave:</strong> the cash-out figure, the rate it is paid at (base plus longevity only, at your retirement-year rate), the note that holiday hours are not a second payout, and the cash-versus-credit comparison \u2014 now directly under the two boxes that set the split, which is where the decision is actually made.",
    "Old links to either screen land on Member details.",
    "<strong>Into the weeds</strong> is now just Other income &amp; tax and the Guide.",
  ] },
  { date: "September 24, 2026 (v43)", items: [
    "<strong>\u201cMore\u201d is now \u201cInto the weeds.\u201d</strong> Same screens, honest name \u2014 it is where the detail lives if you want it, and nothing you need is hiding behind it.",
  ] },
  { date: "September 24, 2026 (v42)", items: [
    "<strong>Future raises moved to Current compensation</strong>, sitting between the pay table and the hourly rates. That is what it actually drives \u2014 the year picker on that table reads the MOU increases and the Labor Market Adjustment you type in \u2014 so having it a tab away meant changing a number on Pension to watch a table move on Current compensation.",
    "The 2028 warning on the pay table used to say \u201cput a number in on Pension \u203a Future raises.\u201d It now points just below, because that is where the box is.",
    "Pension is now only the pension: what the formula pays, what comes off it, and what lands in your bank.",
  ] },
  { date: "September 24, 2026 (v41)", items: [
    "<strong>\u201cWhen do you plan to go?\u201d moved to the bottom of Member details</strong>, as section 5. It sat at the top of Pension, which split the questions across two tabs \u2014 you answered four things about yourself, jumped to another screen, then answered a fifth. Now Member details is every question in one place, in order, and the date is the last one you give it.",
    "Pension opens with Future raises and goes straight to the number, which is what that tab is for.",
  ] },
  { date: "September 24, 2026 (v40)", items: [
    "<strong>Fixed a mislabelled table.</strong> The all-plans list was headed \u201cAll 2026 plans\u201d while showing 2027 money. It now says the year it is actually showing, and a test fails if the label and the figures ever disagree again.",
    "<strong>Every section on Health care now names its rate year.</strong> \u201cMedical, dental &amp; vision \u00b7 while working \u00b7 2027 rates\u201d and \u201cIn retirement \u2014 your medical \u00b7 2027 rates.\u201d No guessing which year you are reading.",
    "The Medicare table names its year too, and says so when it differs from the rest of the page \u2014 we hold Medicare figures for 2027 only, so picking 2026 shows 2026 Basic rates with 2027 Medicare rates, and the page tells you that instead of leaving you to notice.",
    "Dental and vision are 2026 in every year, because those are City and Delta Dental figures rather than CalPERS. The note under the table now says that outright, so the year label above it is not read as covering them.",
  ] },
  { date: "September 24, 2026 (v39)", items: [
    "<strong>Health care has a rate year picker: 2026, 2027, 2028.</strong> Every premium on the tab follows it \u2014 your plan, the City\u2019s share, your cost from the paycheck, the retiree premium and the Medicare table.",
    "The plan list follows the year too, because CalPERS changes it. Pick 2026 and UnitedHealthcare Alliance and Harmony are back; pick 2027 and they are gone, with Sutter Health Plan and Blue Shield EPO in their place. If the plan you have selected did not exist in the year you picked, the tool says so instead of quietly pricing a different one.",
    "<strong>2028 reads \u201cpending.\u201d</strong> CalPERS publishes the next year\u2019s premiums around June, effective the following January 1. Until that sheet exists, picking 2028 shows the 2027 figures and says plainly that is what you are looking at. No guesses, no last year\u2019s numbers wearing next year\u2019s label.",
    "Adding next year is one line in the file: drop the new rate sheet in and delete the <code>null</code>.",
  ] },
  { date: "September 24, 2026 (v38)", items: [
    "<strong>Deductions is now two tabs: Survivor / beneficiary and Health care.</strong> They were sharing one screen, which made two completely separate decisions look like halves of the same form. Picking who gets your allowance after you die has nothing to do with picking a medical plan.",
    "<strong>Survivor / beneficiary</strong> \u2014 the survivor continuance, the six-option comparison table, the explanation panel for whichever option you pick, and your beneficiary\u2019s age.",
    "<strong>Health care</strong> \u2014 your plan and coverage while working, what the City pays, your cost from the paycheck, your retiree plan and premium, and the 2027 Medicare rates at 65.",
    "Old links still land somewhere sensible: a saved link to Deductions opens Survivor / beneficiary, and the older Medical link opens Health care.",
  ] },
  { date: "September 23, 2026 (v37)", items: [
    "<strong>Every health premium is now the 2027 rate.</strong> CalPERS Region 1 \u2014 the right region for Roseville, since it covers Placer and Sacramento counties \u2014 effective 1/1/2027. CalPERS held the overall increase to 4.97%. Kaiser employee-only goes $1,168.86 \u2192 <strong>$1,187.63</strong>, and because the City\u2019s contribution is a percentage of Kaiser, everyone\u2019s City share moves with it.",
    "<strong>UnitedHealthcare Alliance and Harmony are gone.</strong> Both exit every CalPERS county on 1/1/2027. If you had one saved, the tool moves you to a surviving plan instead of quietly showing you somebody else\u2019s premium.",
    "<strong>Two new choices in Placer County:</strong> Sutter Health Plan HMO ($1,130.67 employee-only, brand new for 2027) and Blue Shield EPO ($1,479.12), which expanded into Placer.",
    "<strong>New: what your medical costs at 65.</strong> The rates you see while working and in early retirement are the Basic premiums \u2014 you pay those from your retirement date until Medicare starts. Deductions now shows all eight 2027 Medicare plans with the premium and your out-of-pocket after the City\u2019s contribution. Kaiser Senior Advantage is $333.93 against a Basic rate of $1,187.63.",
    "Dental, vision, the RFF flex credit and the cafeteria allowance are still on 2026 figures \u2014 those come from the MOU and Delta Dental, not CalPERS, and the 2027 numbers were not in hand.",
  ] },
  { date: "September 23, 2026 (v36)", items: [
    "<strong>The year picker now moves the header.</strong> Clicking 2026 / 2027 / 2028 on Current compensation changed the table underneath while the biggest number on the screen sat still, and nothing told you they were on different clocks. The header\u2019s <em>While working</em> pair now follows the year you picked, and the label says which year it is.",
    "Past your retirement year it clamps back \u2014 you are not working then, and the retired half of the header is pinned to your retirement year, so the two halves would have been comparing different years.",
    "Both numbers are now built by one function instead of two. The header and the Current compensation total physically cannot disagree any more, and a test fails if they ever do.",
  ] },
  { date: "September 23, 2026 (v35)", items: [
    "<strong>Fixed a real error: the Unmodified Allowance does not leave your spouse nothing.</strong> CalPERS pays an eligible survivor half your unmodified allowance for life, the City funds it, it costs you nothing, and it is identical under every option. This tool used to say Option 1 meant \u201cno survivor benefit.\u201d That was wrong, and it would have pushed members into paying for a benefit they partly already had.",
    "Rebuilt the option election on Deductions as a full comparison table \u2014 all six options CalPERS offers, what each pays you, what your spouse ends up with, and what it costs you. Tap a row to elect it; the panel underneath explains what you just picked.",
    "The option reduction now comes out of the <strong>option portion</strong> only \u2014 the half of the allowance above the survivor continuance \u2014 not out of the whole allowance. Verified against a member\u2019s own myCalPERS estimate: the model now reproduces all six rows CalPERS printed, to the dollar.",
    "Retired the invented option factors. The reduction percentages are now calibrated from that verified estimate and labelled as one member\u2019s, at one pair of ages, with the myCalPERS override still there and easier to find.",
    "Options renamed to match myCalPERS wording (Unmodified Allowance, Return of Remaining Contributions, 100% / 50% Beneficiary, with and without Allowance Increase). Elections saved under the old names carry over.",
    "New question: do you have an eligible survivor? A spouse qualifies if you were married at least a year before your retirement date. Answer no and the continuance drops to zero, which changes every figure below it.",
  ] },
  { date: "September 22, 2026 (v34)", items: [
    "Removed two screens from More that nothing on the main calculator used: Pension detail and Timeline. Old links to them now land on Pension and Stay or go.",
    "Moved the year-by-year pension growth table (up to the COLA cap, first raise May 1 of the second calendar year after you retire) onto the Pension tab, so that view is still one tap away.",
    "Retired the promotion-scenario model that lived on Pension detail. It was never wired into any headline figure. Say the word and it comes back.",
    "More now holds only Sick leave, All inputs, Other income & tax, and Guide \u2014 every one of which feeds the main numbers or explains them.",
  ] },
  { date: "September 22, 2026 (v33)", items: [
    "Audited \u201cStay or go?\u201d properly after a member reported the numbers not matching. Four things were wrong, all of them mine.",
    "<strong>The card disagreed with the banner.</strong> With CPI above zero the banner showed your retirement take-home in the dollars you would actually be handed and the card right below it showed today\u2019s dollars \u2014 $10,904 against $10,195, same label, same screen. The card is month one, so it now uses the banner\u2019s figures, and says plainly that the tables below work in today\u2019s dollars and will not match.",
    "<strong>Working longer read as costing nothing when it actually pays you.</strong> If your paycheck beats your pension, a year spent working is money in your pocket \u2014 but the cost was clamped at zero, so the column showed a dash. It now shows the gain: for a Captain with 40 hours of overtime, <strong>+$5,865 a year</strong>.",
    "<strong>The break-even column collapsed four cases into two.</strong> It now separates them: it repays after N years · ahead from day one · ahead N years, then behind · never. That third one was reading as \u201calready ahead\u201d while the same row showed a net loss at twenty years.",
    "<strong>The summary line overclaimed.</strong> It said \u201cyou are ahead from day one\u201d even where the later pension is smaller in real terms. It now reads the rows it is summarising.",
    "Also labelled the two tables: the year table compares <em>gross</em> allowances, the cost table compares <em>take-home</em>. Same comparison, different bases \u2014 which is why 2029 showed as +$271/mo in one and +$2,453/yr in the other.",
    "Fourteen new tests read the banner and the card off the same rendered page and fail if they disagree, in three different scenarios.",
  ] },
  { date: "September 22, 2026 (v32)", items: [
    "Confirmed and kept: your <strong>457 contribution still comes out of the working take-home</strong> in the banner, because it comes out of your check. Put in $24,500 a year and working take-home drops by about $1,360 a month, exactly as it should.",
    "Fixed the other half of it. After the 457 draw was taken out of the retirement figure, it was still being counted when the tool worked out your retirement tax rate \u2014 so changing your 457 <em>contribution</em> quietly moved your retirement <em>take-home</em>, by about $20 a month. It was taxing income it had stopped showing you.",
    "Retirement take-home is now flat no matter what you contribute, which is the honest answer: nobody knows when you will start drawing. If you do want the draw counted, the switch for it is still under More \u203a Other income &amp; tax, and it now controls both the income and the tax together.",
    "Every downstream figure moved slightly as a result \u2014 take-home, the cost of waiting, the break-even years. All re-verified.",
  ] },
  { date: "September 22, 2026 (v31)", items: [
    "<strong>Fixed a rounding error on a contract figure.</strong> The January 2029 increase was printing as 1.8%. It is <strong>1.75%</strong>. Percentages were being rounded to one decimal everywhere, which is fine for an estimate and wrong for a bargained number — members check these against the MOU.",
    "Future raises is now a list by year. <strong>2027</strong>: the general wage increase and your rank separation. <strong>2028</strong>: a box to put the Labor Market Adjustment in, with the alignment tightening noted, flagged in orange while it is empty. <strong>2029</strong>: 1.75% for suppression, 3% for prevention. <strong>2030+</strong>: the bargaining dial. Each line cites its own MOU article.",
    "Retired the old sick-leave dropdown. It lived under More in two places and still used the cash / credit / split model, while Member details used the two boxes \u2014 three controls for one decision is how screens start disagreeing. The two boxes are now the only way to set it; both More screens show what you chose and point back.",
    "The cash-versus-credit comparison stays where it was, including the warning that the credit is worth <strong>$0</strong> when you are already at the cap.",
    "<strong>The 457 is out of the headline.</strong> A 457 draw starts when you decide to start it, so folding it into the retirement take-home at the top made the pension look bigger than it is. The 457 keeps its own projections under More \u203a Other income &amp; tax.",
  ] },
  { date: "September 22, 2026 (v30)", items: [
    "Shrank the Future raises card on the Pension tab without dropping anything. The contracted figures \u2014 the January 2027 increase, the rank separation and how it tightens in 2028, and the January 2029 increase \u2014 are now one line instead of a boxed table with its own heading and footnote.",
    "The two inputs sit side by side instead of stacked, each with its helper text cut to a line and a half. The MOU citation, the 55th-percentile rule, the fact that the 2027 study sets the LMA, that it compounds into 2029, and that the bargaining dial only touches 2030 and later \u2014 all still there.",
    "Roughly half the height it was, and every fact survived.",
  ] },
  { date: "September 22, 2026 (v29)", items: [
    "<strong>Your working pay was understated by about $1,200 a month.</strong> Everywhere the tool said \u201cworking,\u201d it meant base plus specialty pay and nothing else \u2014 it was dropping your holiday pay, your uniform allowance and your FLSA scheduled overtime. All three are real cash, paid every year, and all three are reported to CalPERS.",
    "You could see it on one screen: the banner read $16,291 gross while the Current compensation table two inches below it read $17,483. Same member, same month, same word.",
    "It was not just the headline. Take-home and the tax estimate were both built on the short figure, so every working-versus-retired comparison in the tool leaned toward retiring.",
    "What moves: for a Captain at step H with 40 hours of overtime, working gross goes from $16,485 to <strong>$17,677</strong> and take-home from $10,615 to <strong>$11,392</strong>.",
    "And it changes the answer on \u201cStay or go?\u201d. The cost of working one more year drops from $28,964 to $19,630, so the break-even on staying through 2029 moves from 11.8 years to <strong>8.0 years \u2014 age 59</strong>, and two more years now pays off by 67 instead of 74.",
    "Your pension never used the short figure \u2014 final compensation always included all three \u2014 so no pension number changes. This was the working side only.",
    "There is now a test that reads the banner and the table off the same rendered page and fails if the two gross figures ever disagree again.",
  ] },
  { date: "September 22, 2026 (v28)", items: [
    "The banner at the top of every screen now carries the four numbers people actually came for: <strong>while working</strong>, gross and take-home, against <strong>while retired</strong>, gross and take-home. It follows you across every tab.",
    "The working pair includes the overtime you entered, because that is what is on your check. The retired pair is dated with your retirement year, so there is no guessing which year it is talking about.",
    "It also names your allowance option. If you have elected a survivor continuance the header says so and shows the reduced figure \u2014 no more reading an unmodified allowance you never intend to take.",
    "For a Captain at step H working 40 hours of overtime: working $16,485 gross and $10,615 take-home, retired in 2028 $14,430 gross and $10,896 take-home.",
    "Replaces the old banner, which showed the pension and the percentage of final compensation \u2014 true, but not the comparison anyone was actually making.",
  ] },
  { date: "September 22, 2026 (v27)", items: [
    "Pension tab now runs in the order you would actually work through it: <strong>when you plan to go</strong>, then <strong>future raises</strong>, then the whole drop from your pension to what lands in your bank.",
    "Every line of that drop is shown. Federal income tax and California income tax are split apart instead of hidden inside one blended rate \u2014 and the California line says out loud that a CalPERS pension is fully taxable by this state.",
    "Health insurance is shown in three lines instead of one: the full premium for your plan and tier, what the City pays toward it (the PEMHCA minimum plus your tier allowance), and what is left for you. If your share is $0, you can now see exactly why.",
    "Added what <em>stops</em> the day you retire: the CalPERS member contribution, union dues, your 457 deferral, the active medical premium, and Medicare tax \u2014 a pension is not wages, so no Medicare or Social Security comes out of it.",
    "The tax figures are still estimates off the current brackets and the standard deduction, and now say so in plain words: they do not know your deductions or your spouse\u2019s income, and they are a guide rather than something to budget against.",
  ] },
  { date: "September 22, 2026 (v26)", items: [
    "Took the base-rate numbers off the Pension tab. They appeared in two places there \u2014 in Future raises and again at the top of the pension build-up \u2014 and sat next to a gross figure they do not match, which read as an error even though both numbers were right.",
    "The pension box now starts where it should: <strong>final compensation</strong>, then your percentage, then the allowance. The line-by-line build-up is on Current compensation, where the year picker already shows it for any year through 2029.",
    "Checked that the two tabs agree, and added a test that fails if they ever stop: pensionable pay for your retirement year on Current compensation is <strong>exactly</strong> the final compensation the pension is figured on. For a Captain at step H retiring in 2028, both read $15,597/mo.",
    "Future raises now points at the year picker instead of printing its own projected base.",
  ] },
  { date: "September 22, 2026 (v25)", items: [
    "Year picker on the Current compensation card. Pick 2026, 2027, 2028 or 2029 and the whole table moves \u2014 base, specialty pay, longevity, holiday pay, FLSA overtime, your overtime, the hourly rates and the annual gross.",
    "It runs on the contract, not a guess: the January 2027 general wage increase, the rank separation (Engineer 7.5% above Paramedic in 2027, tightening to 10% in 2028; Captain 10% above Engineer), the 2028 Labor Market Adjustment you set, and the January 2029 increase \u2014 1.75% for suppression, 3.0% for prevention.",
    "A Captain at step H: <strong>$212,125</strong> gross in 2026, <strong>$224,441</strong> in 2027, <strong>$229,630</strong> in 2028 with no LMA \u2014 and <strong>$241,047</strong> if the LMA lands at 5%.",
    "<strong>2028 is called out for what it is.</strong> With the Labor Market Adjustment at zero the card says so in orange: that is the floor, not a forecast, because the 2027 Total Compensation Study has not been run and nobody can price that year yet. Put a number in and the warning clears.",
    "Each future year lists what is in it, so the figure is checkable against the MOU rather than taken on trust.",
    "Longevity now shows the service years you will have <em>in that year</em> rather than at retirement \u2014 24 years in 2026 for someone retiring with 26.",
  ] },
  { date: "September 22, 2026 (v24)", items: [
    "Fixed holiday pay on Current compensation. It was being figured on your <em>retirement-year</em> base instead of what you earn today \u2014 a 2028 number on a page about this month. For a Captain at step H it read $9,910 a year; it should read <strong>$9,150</strong>.",
    "The rule it now follows is the MOU\u2019s own (Ch.3 Art.II.C): 168 hours at the base hourly rate plus the longevity rate, straight time. The row says which longevity percentage it used so you can check it against your own rate.",
    "Same root cause as the longevity double-count: a figure built for the pension projection got reused on a page describing today. Both are now tested, including a test that fails if the retirement-year figure ever reappears here.",
    "Your pension is unaffected \u2014 the projected holiday figure is correct where it belongs, in the final-compensation build-up.",
  ] },
  { date: "September 22, 2026 (v23)", items: [
    "<strong>Fixed a double-count on Current compensation.</strong> Longevity was being paid to you twice on that table \u2014 once inside the specialty-pay percentage, which already contains it, and again on its own row. A Captain with 25% of incentives was reading as 32.5% plus another 7.5%.",
    "It now reads the way your check does: specialty and certificate pay with longevity taken out of it, then longevity on its own line. The two add up to your real incentive total.",
    "This only ever affected the Current compensation table \u2014 your pension, final compensation and take-home were always figured on the correct single count, so no pension figure changes.",
    "Reported by a member reading his own numbers, which is the only way this kind of thing gets caught.",
  ] },
  { date: "September 22, 2026 (v22)", items: [
    "New tab: <strong>Current compensation</strong>. One table, no collapsing, no cards split across the page \u2014 every component of what Roseville pays you by the hour, the month and the year, ending at your gross. A Captain at step H with 40 hours of overtime: <strong>$18,663/mo, $223,950/yr</strong>.",
    "Each line says whether it is reported to CalPERS, and the table totals that separately \u2014 $15,395/mo of that gross is what your pension is actually figured on. The gap is your overtime.",
    "It reconciles to your W-2: the annual gross is what Medicare wages (Box 5) are built from. Box 1 reads lower because your 457 deferral and your medical, dental and vision premiums come out before it. That is now stated on the page.",
    "Member details is four sections and nothing else. Everything below Overtime moved to Current compensation, the hourly-rate year picker with it. Future raises moved to Pension where it belongs. The sick-leave cash-out moved to the Sick leave screen.",
    "Overtime is now a single box. No tiles, no ledger \u2014 type your hours, see what it is worth a month and a year.",
    "<strong>Sick leave is two boxes now</strong>: hours to cash out, hours to convert to service credit. The split is the decision, so it should not be buried in a dropdown. 2,000 hours = 1 year of credit (Gov. Code \u00a720965), and hours you have yet to accrue follow the same split you chose.",
    "Prior service got a red border, and the \u201cthat is everything your pension is built from\u201d card is gone.",
  ] },
  { date: "September 22, 2026 (v21)", items: [
    "Section 1 is now just <strong>Prior service</strong>, and it is about a third of the size it was. Each agency is one tight row \u2014 agency, formula, years \u2014 instead of a card with six stacked fields. Air Time sits beside the Add-agency button.",
    "Two paragraphs of explanation cut to one line: agencies before Roseville, oldest first, years and formula off your myCalPERS Service Credit History.",
    "The controls almost nobody touches only appear when they apply. The benefit-factor box shows up only if you pick \u201cother system\u201d; the final-pay override only for systems that pay their own check.",
    "Pension Type and its reciprocity override moved to More \u203a All inputs. It is set from your hire date automatically and is not something a member should have to read past on the first screen.",
  ] },
  { date: "September 22, 2026 (v20)", items: [
    "Member details is now four sections, not six. <strong>1 \u00b7 Before Roseville</strong>, <strong>2 \u00b7 Roseville</strong>, <strong>3 \u00b7 Specialty pay and certificates</strong>, <strong>4 \u00b7 Overtime</strong>. That is it.",
    "Overtime is one box now. Type the hours you average in a month and you get your gross, your take-home and what the overtime is worth a year. The line-by-line ledger that used to sit under it is gone from that card \u2014 it is still on \u201cYour pay right now\u201d further down the page if you want it.",
    "Deleted \u201cA few more details.\u201d The only thing in it was your beneficiary\u2019s age, which now belongs on Deductions with the rest of the survivor election.",
    "Moved \u201cCalPERS service credit\u201d off the front page to More \u203a All inputs. It is the only place to enter the figure from your myCalPERS Service Credit History, so it could not simply be deleted \u2014 but most members will never touch it, and it did not belong in the first four things you read.",
  ] },
  { date: "September 22, 2026 (v19)", items: [
    "Fixed the pensionable FLSA overtime figure. It was a hardcoded 2% of base with nothing behind it. It is now <strong>2.61%</strong>, derived from the MOU\u2019s own numbers, and the derivation is printed on the screen next to it so you can check it.",
    "The arithmetic: MOU Ch.3 Art.II.A sets a 24-day FLSA work period with a 182-hour threshold, to coincide with 48/96. A 24-day period on 48/96 is 192 hours worked \u2014 so you are 10 hours over the threshold every cycle, 152 hours a year, by schedule alone. Your base already pays straight time for those hours, so what FLSA still owes is the half-time premium: 76 hours \u00f7 2,912 = 2.61% of base.",
    "That is not the overtime you volunteer for. Voluntary and callback overtime is not pensionable and never has been. This is the overtime built into the schedule, which Art.II.A reports to CalPERS as special compensation under C.C.R \u00a7571.",
    "What it moves: about <strong>+$82/mo</strong> of final compensation for a Captain at step H, which is roughly <strong>+$76/mo</strong> on the pension, for life. Every figure in the tool moved with it.",
    "Still derived, not confirmed against payroll. If your pay stub shows a different FLSA overtime figure, trust the stub \u2014 and tell the Treasurer, because the tool should match it.",
  ] },
  { date: "September 22, 2026 (v18)", items: [
    "Member details now walks the way you would actually tell it. <strong>1 \u00b7 Before Roseville</strong> \u2014 every agency you worked before, oldest first, plus any Air Time you bought. <strong>2 \u00b7 Roseville</strong> \u2014 hire date, birthdate, rank, step, sick leave. <strong>3 \u00b7 Specialty pay and certificates</strong>. <strong>4 \u00b7 Overtime</strong>, and what it all adds up to in gross and take-home pay. Then CalPERS service credit and the odds and ends.",
    "Prior service moved from the middle of the page to the top, where a member starts anyway \u2014 CDF time, then the city or county after it, then Roseville.",
    "Dropped the \u201cin the order it happened\u201d heading. The numbered sections say it without needing to be told.",
  ] },
  { date: "September 22, 2026 (v17)", items: [
    "<strong>The survivor option now sets your pension.</strong> Until today it was a read-only table while every headline in the tool showed the <em>unmodified</em> allowance. If you plan to leave your spouse a continuance, the tool was showing you a pension you will never receive. Pick your option on Deductions and every figure follows it.",
    "How much that moves: a Captain retiring in 2028 at the unmodified allowance shows $14,355/mo gross and $10,845 take-home. The same member electing Option 2 (100% joint &amp; survivor) shows $12,115 and $9,350.",
    "<strong>An admission.</strong> The option reduction this tool shows you is an estimate I built, not a CalPERS option factor. CalPERS does not publish a table \u2014 they say the cost \u201cis specific to you and depends on factors such as your age, your beneficiary\u2019s age, life expectancies, and how much you\u2019ve contributed to the retirement plan.\u201d Your own contribution balance is in it, and nothing here can reproduce that.",
    "So it is now labelled as what it is: a rough band, with a warning on the screen, and a box to type your real reduction straight off a myCalPERS estimate. Enter it and the estimate is ignored everywhere.",
    "Rebuilt the tabs to follow a career instead of a filing cabinet. <strong>Member details</strong> \u2014 where you came from, Roseville hire date, rank, step, specialty pay, sick leave, overtime. <strong>Pension</strong> \u2014 your retirement date and what the formula pays. <strong>Deductions</strong> \u2014 the survivor election, tax and medical, all the things that come off. Then Stay or go, then More.",
    "Your retirement date moved to the Pension tab, on its own, because it is the one input you get to change your mind about.",
    "Old links still land: Start here and Working now go to Member details, Medical goes to Deductions, What if I wait goes to Stay or go.",
  ] },
  { date: "September 22, 2026 (v16)", items: [
    "Rebuilt around four tabs instead of seven. <strong>Working now</strong> \u2014 what you earn and what you keep. <strong>Retired</strong> \u2014 what the pension pays and what you keep. <strong>Stay or go?</strong> \u2014 the comparison. <strong>Details</strong> \u2014 everything else, still there, out of the way.",
    "<strong>Overtime is on page one now.</strong> It was buried three screens deep under \u201cOther income &amp; tax\u201d and it defaulted to zero. That was the single worst thing about this tool: with no overtime entered it told members that retiring was a <em>raise</em>.",
    "It is not a raise for anyone who works OT. Overtime is not reported to CalPERS, so none of it is in your pension and all of it stops the day you leave. Page one now shows what yours is worth a month and a year, and says plainly that it does not follow you out the door.",
    "Page one is a straight ledger: base, specialty pay and overtime add up to gross; then the CalPERS member contribution, 457, union dues, medical and tax come out; what is left is what lands in your bank. Same shape on Retired, so the two pages compare line for line.",
    "\u201cStay or go?\u201d opens with the single number most people came for: your take-home working versus your take-home retired, and the size of the change. Where overtime is most of the gap, it says so.",
    "How much that matters: a Captain at step H with no overtime comes out <em>ahead</em> by about $2,400 a month retiring. The same Captain working 60 hours of overtime a month takes a cut of about $840. The break-even is somewhere near 44 hours a month.",
    "Old links still work. A bookmark to \u201cStart here\u201d lands on Working now, \u201cWhat if I wait?\u201d lands on Stay or go.",
  ] },
  { date: "September 22, 2026 (v15)", items: [
    "New section at the bottom of \u201cWhat if I wait\u201d: <strong>What waiting actually costs</strong>. Every year you work past your earliest date, you give up a year of pension checks to buy a permanently larger pension. This lays out that trade, year by year.",
    "For each year it shows the pension you skip getting there, what your pension gains per year for life, how long that gain takes to repay the skipped checks \u2014 and how old you are when it does \u2014 and where you stand after twenty years retired.",
    "It is on a take-home basis, unlike the rest of the tool. That is deliberate: the 9% CalPERS member contribution, union dues and the active medical premium all stop when you retire. Comparing a paycheck to a pension on gross would flatter working and give you the wrong answer.",
    "If the later pension is no larger in real terms \u2014 which happens whenever your raises trail the CPI you set \u2014 the break-even column says <strong>never</strong>, because nothing ever repays those checks.",
    "It also says plainly what it does not count: your 457 still growing, leave still accruing, coverage before Medicare, and the value of the years themselves. It is one input to the decision, not the decision.",
  ] },
  { date: "September 22, 2026 (v14)", items: [
    "Added the missing piece: the <strong>Labor Market Adjustment</strong>, effective the first full pay period in January 2028 (MOU Ch.2 Art.I.A.3). It has its own box on \u201cWhat if I wait\u201d, on Your Pay \u203a Future raises and under Everything else \u203a Inputs. Put a number in and every figure in the tool moves with it.",
    "What the contract actually says: the 2027 Total Compensation Study, using survey data effective 9/1/2027, is run on the Firefighter Paramedic (PEPRA) benchmark. The City then raises the base hourly rate of any classification sitting below the total-compensation 55th percentile up to that percentile, on both Salary Schedule A and B.",
    "It cannot be negative. The contract only moves classifications that fall <em>below</em> the 55th percentile, so the box will not accept a number under zero.",
    "Engineers and Captains inherit it. The MOU holds Fire Engineer at 10% above Firefighter Paramedic and Fire Captain at 10% above Fire Engineer from 2028, so an adjustment to the Paramedic benchmark carries up the ranks. The tool already tightens the alignment from 7.5% to 10% in 2028.",
    "It compounds. The LMA lifts base hourly rate, so the 1.75% January 2029 increase and every later raise build on the higher number, not the old one.",
    "Timing worth knowing: the adjustment lands in January 2028. A member retiring in December 2028 has a full twelve months at the new rate, so it lands in their final compensation in full.",
    "The figure is nobody\u2019s guess yet \u2014 the study has not been run. It defaults to zero, and at zero the tool credits you with nothing for it.",
  ] },
  { date: "September 22, 2026 (v13)", items: [
    "Every headline figure is now your <strong>gross monthly CalPERS allowance</strong> \u2014 the same number myCalPERS shows you. The banner at the top of every screen, the \u201cWhat if I wait\u201d table and the long-range timeline all report it.",
    "They used to report take-home: the gross allowance with an estimated income tax taken out. That number matched nothing you could check. Put your CalPERS estimate next to this tool and the figures should now line up.",
    "Why it was wrong to lead with: the tax figure is a single flat effective rate. It does not know your filing status, your deductions or any other income you have, and it will be off for nearly everyone. CalPERS does not net tax out of an estimate either \u2014 tax and your health premium come off the warrant afterward.",
    "The take-home math has not been deleted. The full chain \u2014 final compensation, percentage, gross allowance, tax, retiree medical, what lands in your bank \u2014 is still on Your Pension, where there is room to label it. The tax line now says on its face that it is a rough estimate.",
    "One figure to watch: the gross number is the <em>unmodified</em> allowance. If you elect a survivor option, CalPERS will show you the reduced amount instead. Survivor options are on Everything else \u203a Pension detail.",
  ] },
  { date: "September 22, 2026 (v12)", items: [
    "The bargaining dial no longer touches any year the MOU already covers. It used to apply in 2028; it now applies to 2030 and later only. The MOU sets 2027 and 2029 and runs through 12/31/2029, so those years show the contract figure and nothing else, whatever you set the dial to.",
    "Fixed a real error in the pension growth: your first COLA now lands when CalPERS actually pays it. CalPERS starts COLAs in the second calendar year after you retire, effective in the May 1 warrant \u2014 retire in December 2028 and your first increase is May 1, 2030, not a year after you walk out.",
    "The tool had been granting that first COLA a year early. Because a COLA compounds, that error never closed; it made every figure from retirement to age 90 too high. Depending on your retirement month, the corrected numbers are roughly one 3% step lower.",
    "Your first COLA date is now printed on the screen \u2014 on the CPI dial and above the pension growth table \u2014 so you can check it rather than take our word for it. Source: CalPERS, Cost-of-Living Adjustment (COLA).",
  ] },
  { date: "September 22, 2026 (v11)", items: [
    "Replaced the \u201conly count contracted raises\u201d checkbox with two dials you control, at the top of \u201cWhat if I wait\u201d: raises Local 1592 bargains (percent per year) and CPI / inflation (percent per year). Both start at zero.",
    "At zero and zero, nothing is assumed. The only things moving those rows are the service credit you earn and, for PEPRA members, your age factor. The 2027 and 2029 increases stay in because they are in the signed MOU.",
    "Set them equal \u2014 say 3 and 3 \u2014 and you are modeling pay that keeps pace with inflation. Set the raise lower than CPI and you are modeling falling behind. The panel tells you which of the three you are looking at.",
    "The bargained-raise dial covers the 2028 compensation study and every year after the contract ends on 12/31/2029. It feeds the hourly-rate year picker too, so a 2031 rate reflects the same assumption.",
    "The CPI dial does two jobs: it converts future dollars back to today\u2019s dollars, and it caps your retiree COLA, since the CalPERS COLA is limited by actual CPI.",
  ] },
  { date: "September 22, 2026 (v10)", items: [
    "\u201cWhat if I wait\u201d is now in today\u2019s dollars only. The future-dollar figure is gone. A pension paid in 2035 arrives in 2035 dollars that buy less, and showing that number as the headline made waiting look better than it is.",
    "New switch, on by default: only count raises that are actually in the contract. The 2027 and 2029 increases are in the signed MOU. The 2028 compensation study has no number yet and there is no contract past 12/31/2029, so those are no longer credited to you unless you ask for them.",
    "The switch applies everywhere, including the hourly-rate year picker \u2014 so a 2028 rate is the contract rate, not a rate built on an assumed study.",
    "Being honest about the honesty: counting zero raises while still discounting for inflation assumes your pay falls behind every year forever. That is a floor, not a forecast, and the tool now says so and shows you how to model pay keeping pace instead.",
  ] },
  { date: "September 22, 2026 (v9)", items: [
    "\u201cWhat if I wait\u201d now has a today\u2019s-dollars column, and the \u201cvs. earliest\u201d gain is measured on it. The take-home column was in each future year\u2019s own dollars, so it climbed whether or not you were actually better off.",
    "Fixed an age bug. Age was computed as milliseconds divided by 365.25 days, which drifts over decades \u2014 someone exactly 53 could read as 52.9993 and get floored to 52.75. For PEPRA members that quarter reaches the benefit factor, so it cost real money. Age is now worked out by the calendar.",
    "Fixed the year range. A member more than 12 years from age 50 got an empty table. It now starts at the year you become eligible and runs through your chosen retirement year.",
    "The 90% cap note now says plainly that the percentage stops moving, and that what still raises the number is pay growth and service under a different CalPERS formula.",
  ] },
  { date: "September 22, 2026 (v8)", items: [
    "Removed the holiday cash-out. It was wrong \u2014 your holiday hours are already reported to CalPERS as special compensation (MOU Ch.3 Art.II.C, CCR \u00a7571) and sit in your pensionable compensation. They cannot be reported to CalPERS and paid out again at separation, so showing both was counting the same hours twice.",
    "Holiday pay still appears where it belongs: in the pension build-up, as 168 hours of pensionable special compensation for Classic members.",
    "Sick leave is now the only cash-out at retirement, which is what it always should have been.",
  ] },
  { date: "September 22, 2026 (v7)", items: [
    "The \u201cyou are past the cap\u201d warning is now on the main pension screen, not buried on the detail tab. It tells you how many years of credit are paying you nothing \u2014 and if sick-leave conversion is part of that surplus, it says so and tells you to take the cash.",
    "The sick-leave screen now says the credit is worth $0 in plain dollars when you are already at the cap, alongside what the cash is worth.",
    "Fixed: the cash-versus-credit comparison was ignoring prior agency service on the same formula. A member with prior CalPERS time under 3% @ 50 could be told sick-leave credit was valuable when their bucket was already over 30 years and it was worth nothing.",
    "If your myCalPERS figure already includes purchased credit, the tool now says outright that your purchased-service entry is not being added again, and gives you a one-line way to check.",
  ] },
  { date: "September 22, 2026 (v6)", items: [
    "Added the \u201cLast reported\u201d date from your myCalPERS Account Summary. Employers report on a lag, so service still to be earned is now counted from that date rather than from today.",
    "Optional: enter your CalPERS account balance and the pension screen shows what it actually is \u2014 a refund figure you would only see if you quit and gave up the pension \u2014 next to what a private saver would need to draw the same income. The two get confused and the gap is worth seeing once.",
  ] },
  { date: "September 22, 2026 (v5)", items: [
    "You can now enter your real CalPERS service credit from myCalPERS instead of having the tool guess it from your hire date. Log in, open Service Credit, and copy the Roseville figure plus each prior employer from the Service Credit History table.",
    "Service credit and calendar service are now treated as two different things, because they are. CalPERS earns credit on reported hours; longevity pay and retiree-medical vesting are written in years of City employment. Using your real credit no longer distorts those.",
    "Guard against double-counting: myCalPERS folds purchased credit into the employer lines, so the tool asks whether yours is included and stops adding your airtime entry on top.",
    "Added a reconciliation line \u2014 Roseville plus every CalPERS agency you enter should equal your myCalPERS Total Service Credit. If it does not, an agency is missing.",
  ] },
  { date: "September 22, 2026 (v4)", items: [
    "Start here is now purely fact-finding. It asks rank and step, date of birth, hire date, planned retirement date, specialty pay and certificates, sick leave hours, prior agency service, purchased service credit, unused holiday hours and your beneficiary's age \u2014 and nothing else.",
    "Your pension is its own tab: gross benefit, what it is figured on, tax, retiree medical, and what actually lands in your bank.",
    "Your pay is its own tab: what you are paid today, hourly rates by year, future raises, and cash-outs at separation.",
    "Beneficiary age moved out of the buried Pension detail screen \u2014 it drives the survivor options and belonged with the other questions.",
    "Prior agency service now appears on Start here and on the advanced inputs screen from a single definition, so the two cannot drift apart.",
  ] },
  { date: "September 22, 2026 (v3)", items: [
    "Hourly rates now have a year picker. Choose 2026 through your retirement year and every rate \u2014 base, FLSA regular, FLSA overtime, contract overtime, cash-out \u2014 recalculates for that year.",
    "Pick a future year and it tells you what moved: the January 2027 rank separation, the incentives that end 1/9/2027, the 2028 compensation study, and the 2029 increase.",
    "2027 and 2029 raises are no longer typed in. They are set by the MOU (Ch.2 Art.I.A) and differ by classification, so the tool now reads them from the contract. Only the 2028 study and the post-2029 years are still assumptions you control.",
    "Fixed: prevention classes were getting the suppression raises \u2014 0% in 2027 and 1.75% in 2029 \u2014 when the MOU gives them 2.5% and 3.0%. Inspectors, Plans Examiner and Inspection Supervisor were all projected low.",
  ] },
  { date: "September 22, 2026 (later)", items: [
    "Put the pay detail back on the Start screen where it belongs \u2014 specialty pay and certificates, your hourly rates, future raises, and cash-outs at retirement. Each one is a collapsed section whose header still shows the total, so the page stays short but nothing is hidden.",
    "Fixed a real problem with the first version of the redesign: the incentive checkboxes had moved to a tab most members would never open, so the headline number was missing education, CSFM, paramedic, hazmat, rescue and investigation pay unless you went looking.",
    "The answer now shows what the pension is actually figured on \u2014 projected base, pensionable incentives, holiday pay, uniform allowance and FLSA overtime, adding up to your final compensation.",
    "New: unused holiday hours cashed out at separation, paid at base plus longevity (MOU Ch.3 Art.II.C and F). Defaults to zero \u2014 enter what you expect to be holding, and confirm the City's separation practice with the Treasurer.",
  ] },
  { date: "September 22, 2026 (evening)", items: [
    "Rebuilt the front of the tool. It now opens on five questions \u2014 what you do, when you were born, when you were hired, when you plan to go, and your sick leave hours. Everything else is worked out from those.",
    "It no longer shows you a number until you have answered. It used to open on a brand-new hire's retirement, which meant every number on screen belonged to somebody else until you corrected it field by field.",
    "New 'What if I wait?' screen: the same calculation run for every year you could go, side by side, with the cost of waiting. Tap a year to make it your plan.",
    "New 'Sick leave' screen: cash versus service credit, with the break-even age, because it is the one retirement decision you cannot undo.",
    "Everything that used to be on the first five tabs is still here, under 'Everything else'. Nothing was deleted.",
    "You can link straight to a screen now \u2014 add ?tab=sickleave to the address.",
  ] },
  { date: "September 22, 2026", items: [
    "Audited the whole tool against the 2026\u201329 MOU, Roseville's CalPERS contract, and CalPERS's published rules. Everything below came out of that.",
    "PEPRA members are no longer capped at 90%. The 90% ceiling belongs to the Classic formulas (3%@50, 3%@55). PEPRA 2.7%@57 has no maximum \u2014 CalPERS's own chart runs to 108% at 40 years. If you are PEPRA, every year past 33 is worth 2.7% more, for life.",
    "Retiree COLA now follows your CalPERS membership date, not Classic/PEPRA. 3% if you entered before 12/16/2016; 2% only for PEPRA hired on or after. Every PEPRA member hired 2013\u20132016 was being shown 2% and is owed 3%.",
    "PEPRA pensions are now figured on the 36-month average (Gov. Code \u00a77522.32), not your last year. Classic still uses one-year final comp \u2014 the City's CalPERS contract elects it for Classic members only.",
    "Salary Schedule B is here. Members hired on/after 1/7/2017 are on the 9-step schedule (A\u2013I); earlier hires stay on the 8-step Schedule A. Both effective 3/21/2026.",
    "Added Firefighter EMT I and all four prevention classes \u2014 Inspection Supervisor, Plans Examiner, and Safety Inspector I and II.",
    "Sick-leave cash-out now stops at the MOU table's 2,400-hour maximum, and tells you how many hours fall outside it. Those hours are still worth service credit at 2,000 hrs = 1 year.",
    "457 catch-up contributions added: $8,000 at 50+, $11,250 at 60\u201363, and the three-year pre-retirement catch-up up to $49,000.",
    "PEMHCA minimum is now by year \u2014 $162 in 2026, $167 from 1/1/2027.",
    "Tier 3 retiree medical now requires 10 years of Roseville service and normal retirement age, per MOU Ch.4 Art.II.D.",
    "Medical is no longer counted as gross income \u2014 it shows as an out-of-pocket cost instead, with the detail on the Medical tab.",
  ] },
  { date: "June 14, 2026", items: [
    "Accuracy: PEPRA pensions are now capped at the state pensionable-pay limit; the City 457 match now counts only after your 5-year vesting point (it was over-counting for newer members); cleaner layout with your key numbers pinned at the top.",
    "New Medical tab: choose your plan and coverage (single / +1 / family) to see your monthly premium and your net cost after the RFF flex credit, plus your hire-date retiree medical tier.",
    "Retirement age + exact date: enter your retirement age and the date fills in automatically — edit it to your exact retirement day. Years of service are figured to that date instead of always assuming January 1.",
    "Prior service now shows in the headline: the big Monthly Pension figure includes your prior-agency (reciprocity) pension, with a Roseville-plus-prior breakdown beneath it.",
  ] },
  { date: "June 13, 2026", items: [
    "FLSA overtime now counts toward your pension as special compensation (Classic members only).",
    "Retiree medical corrected: Tier 3 (hired 2012–2014) is $720/mo; Tier 4 (hired 2015+) is the City's $100/mo RHS account you draw down, not a lifetime monthly benefit.",
    "457 plan: 2026 IRS limit updated to $24,500; the City's 3% match now grows with your pay and correctly counts toward the 457(b) limit (it is not added on top).",
    "The 2028 raise now defaults to 3%.",
    "Sick-leave-to-service-credit now correctly stops adding pension value once you hit the 90% cap (so you can see when cashing it out is the better move).",
    "Accuracy fixes to the take-home comparison and reciprocity wording.",
  ] },
  { date: "June 9, 2026", items: [
    "Collapsible input sections; income comparison with a 'today's dollars' view; combined prior-service view; overtime comparison; official salary schedule; uniform allowance set to $1,300.",
  ] },
  { date: "June 2, 2026", items: [
    "Added multi-agency reciprocity (prior pensions), prior CalPERS service, the promotion projection, and raise inputs for 2027–2030 plus a post-2030 assumption.",
  ] },
  { date: "May 21, 2026", items: [
    "Added projected raises, planned retirement year, and MOU rank-separation logic; the pension breakdown now shows your projected salary at retirement.",
  ] },
  { date: "May 11, 2026", items: [
    "First release: hire date, sick leave, survivor options, mobile layout, and save/reset.",
  ] },
];
const CLASSIC_MULTIPLIER = 0.03;
const CLASSIC_MAX_PCT = 0.90;
// Benefit maximum BY FORMULA. The 90% ceiling belongs to the Classic safety formulas --
// CalPERS publishes "you can receive up to 90% of final compensation" for Local Safety
// 3%@50 and 3%@55. PEPRA 2.7%@57 (Gov Code Sec 7522.25(d), which Roseville's CalPERS
// contract para 10 elects) states NO maximum, and CalPERS's own benefit-factor chart for
// it runs to 108% of final compensation at 40 years of service.
const FORMULA_MAX_PCT = {
  "3@50": 0.90, "3@55": 0.90, "2.5@55": 0.90, "2@50": 0.90, "2@55": 0.90,
  "2.7@57": Infinity,
};
const formulaMaxPct = (key) => (FORMULA_MAX_PCT[key] !== undefined ? FORMULA_MAX_PCT[key] : 0.90);
// ── PRIOR-AGENCY (RECIPROCITY) BENEFIT FACTORS ─────────────────────────────
// Whole-year CalPERS LOCAL SAFETY age factors (decimal %/yr of service).
// Source: CalPERS "Retirement Formulas and Benefit Factors" charts (rev 2021.2.1).
// Safety minimum retirement age is 50; total benefit is capped at 90% of final comp.
// "manual" = non-CalPERS systems (LACERA & other '37 Act counties, CalSTRS, FERS):
// the member reads their own per-year factor off that system's statement.
const PRIOR_FORMULAS = [
  { key: "3@50",   label: "3% @ 50 (Classic safety)",          factors: { 50: 0.030,   51: 0.030,   52: 0.030,   53: 0.030,   54: 0.030,   55: 0.030 } },
  { key: "3@55",   label: "3% @ 55 (safety)",                  factors: { 50: 0.0240,  51: 0.0252,  52: 0.0264,  53: 0.0276,  54: 0.0288,  55: 0.030 } },
  { key: "2.5@55", label: "2.5% @ 55 (safety)",                factors: { 50: 0.020,   51: 0.021,   52: 0.022,   53: 0.023,   54: 0.024,   55: 0.025 } },
  { key: "2@50",   label: "2% @ 50 (safety)",                  factors: { 50: 0.020,   51: 0.0214,  52: 0.0228,  53: 0.0242,  54: 0.0256,  55: 0.027 } },
  { key: "2@55",   label: "2% @ 55 (safety)",                  factors: { 50: 0.01426, 51: 0.01522, 52: 0.01628, 53: 0.01742, 54: 0.01866, 55: 0.020 } },
  { key: "2.7@57", label: "2.7% @ 57 (PEPRA safety)",          factors: { 50: 0.020,   51: 0.021,   52: 0.022,   53: 0.023,   54: 0.024,   55: 0.025,   56: 0.026,   57: 0.027 } },
  // LACERA Safety Plan B ('37 Act, L.A. County): age-based, maxes out at age 55. Source: LACERA Safety A/B benefit factor table.
  { key: "lacera-b", label: "LACERA Safety Plan B ('37 Act)",  factors: { 50: 0.020,   51: 0.021,   52: 0.0222,  53: 0.0234,  54: 0.0247,  55: 0.0262 } },
  { key: "manual", label: "Other system — I'll enter the factor", factors: null },
];
// CalPERS-administered safety formulas. Service under ANY of these is the SAME CalPERS
// account (e.g., CalFire is itself CalPERS) — it consolidates under one 90% cap, NOT reciprocity.
const CALPERS_FORMULA_KEYS = ["3@50", "3@55", "2.5@55", "2@50", "2@55", "2.7@57"];
const isCalpersFormula = k => CALPERS_FORMULA_KEYS.includes(k);
function priorYearFactor(formula, manualFactorPct, retireAge) {
  const def = PRIOR_FORMULAS.find(f => f.key === formula);
  if (!def || !def.factors) {
    return Math.max(0, (parseFloat(manualFactorPct) || 0) / 100);
  }
  if (retireAge < 50) return 0; // safety minimum retirement age
  const ages = Object.keys(def.factors).map(Number);
  const minAge = Math.min(...ages), maxAge = Math.max(...ages);
  if (retireAge >= maxAge) return def.factors[maxAge];
  if (retireAge <= minAge) return def.factors[minAge];
  // CalPERS steps by completed quarter-year; quarter values are evenly spaced
  // between consecutive whole-year benefit factors (linear interpolation).
  const lo = Math.floor(retireAge);
  const q = Math.floor((retireAge - lo) * 4) / 4;
  const fLo = def.factors[lo];
  const fHi = def.factors[lo + 1] ?? def.factors[maxAge];
  return fLo + (fHi - fLo) * q;
}
function calcRetireeMedical(tier, hireYear, retirementYear, cityYOS, totalCalpersYears, atNormalRetirementAge) {
  const yearsFromBase = retirementYear - RETIREE_MEDICAL_BASE_YEAR;
  // Tier 4 (hired 8/15/2015+): no lifetime monthly premium. City deposits a flat $100/mo into an
  // RHS account starting in year 6 of service until retirement (MOU Art II.F). Member draws the
  // ACCOUNT BALANCE down in retirement — it is NOT monthly income for life.
  if (tier === "4") {
    const cityRhsMonths = Math.max(0, cityYOS - TIER4_RHS_VEST_AFTER_YEARS) * 12;
    const rhsCityBalance = TIER4_RHS_CITY_MONTHLY * cityRhsMonths;
    return { monthly: 0, rhsBalance: rhsCityBalance, vested: 1.0,
      note: "City RHS: $100/mo from year 6 to retirement (account balance you draw down, not lifetime monthly)" };
  }
  const base = tier === "3" ? TIER3_MEDICAL_BASE : RETIREE_MEDICAL_BASE;
  const currentValue = base * Math.pow(1 + RETIREE_MEDICAL_COLA, yearsFromBase);
  // Tier 1 (pre-2004, MOU Art II.B) is NOT subject to the vesting schedule — fully vested.
  // Tiers 2 & 3 vest per Art II.C/E: eligible only with ≥5 yrs at Roseville AND ≥10 yrs total
  // CalPERS-credited service; once the 5-yr Roseville minimum is met, the vesting % is based on
  // ALL CalPERS-credited service (Roseville + reciprocal/prior CalPERS), not just Roseville years.
  const totalYears = (totalCalpersYears != null ? totalCalpersYears : cityYOS);
  // Tier 2 (MOU Art.II.C): 5 yrs at Roseville unlocks credit for ALL CalPERS-credited service,
  //   and 10 yrs of CalPERS-credited service is the floor.
  // Tier 3 (MOU Art.II.D): stricter — "must retire with a minimum of ten (10) years of
  //   City of Roseville service", AND must have reached normal retirement age (CalPERS
  //   contract para 1: age 50 classic local safety, age 57 new/PEPRA local safety).
  const eligible = tier === "3"
    ? (cityYOS >= 10 && atNormalRetirementAge)
    : (cityYOS >= 5 && totalYears >= 10);
  const vestYears = Math.min(Math.floor(tier === "3" ? cityYOS : (cityYOS >= 5 ? totalYears : cityYOS)), 20);
  const vestedPct = tier === "1" ? 1.0 : (eligible ? (VESTING_SCHEDULE[vestYears] || (vestYears >= 20 ? 1.0 : 0)) : 0);
  return { monthly: currentValue * vestedPct, vested: vestedPct, rhsBalance: 0, eligible };
}
// Tier 4 RHS account (MOU Ch.4 Art.II.F): employee contributes 1% of base pay at hire, +1%/yr to a
// 5% max, each pay period; the City adds a flat $100/mo starting the 6th year of service. Both go
// into the RHS account, modeled annually and grown at an assumed investment return to retirement.
function calcTier4RHS({ hireYear, retirementYear, currentYear, baseAnnualNow, salaryGrowth, annualReturn }) {
  let empContribTotal = 0, cityContribTotal = 0, balance = 0;
  for (let cy = hireYear; cy < retirementYear; cy++) {
    const serviceYear = cy - hireYear + 1;                 // 1-indexed year of service
    const empPct = Math.min(serviceYear, 5) / 100;          // 1% → 5% cap
    const salaryThatYear = baseAnnualNow * Math.pow(1 + salaryGrowth, cy - currentYear);
    const empDeposit = empPct * salaryThatYear;
    const cityDeposit = serviceYear >= 6 ? 1200 : 0;        // $100/mo begins 6th year
    const growth = Math.pow(1 + annualReturn, Math.max(0, retirementYear - cy - 0.5)); // mid-year deposit
    empContribTotal += empDeposit;
    cityContribTotal += cityDeposit;
    balance += (empDeposit + cityDeposit) * growth;
  }
  const empCurrentPct = Math.min(Math.max(1, currentYear - hireYear + 1), 5);
  return {
    rhsBalance: balance,
    empContribTotal, cityContribTotal,
    growthTotal: Math.max(0, balance - empContribTotal - cityContribTotal),
    empCurrentPct,
    empCurrentMonthly: (empCurrentPct / 100) * baseAnnualNow / 12,
  };
}
function calcSickLeavePayoff(hours, hourlyRate) {
  // Payable hours are capped by the MOU table's maximum; the tier % is set by the
  // accumulated balance, but only payable hours are actually paid.
  const payableHours = Math.min(hours, SICK_LEAVE_PAYOFF_MAX_HOURS);
  const tier = SICK_LEAVE_TIERS.find(t => hours >= t.min && hours <= t.max);
  if (!tier || tier.pct === 0) return 0;
  return payableHours * hourlyRate * tier.pct;
}
// ─── CalPERS RETIREMENT ALLOWANCE OPTIONS ────────────────────────────────
// VERIFIED against a Roseville member's own myCalPERS Planning Calculator estimate,
// September 2026 — local safety, retiring at 50, beneficiary aged 49. CalPERS printed:
//
//   Option                            Member     Beneficiary   Survivor   If ben. dies first
//   Unmodified Allowance              $17,728    —             $8,864     n/a
//   Return of Remaining Contributions $17,670    —             $8,864     n/a
//   100% Beneficiary                  $16,922    $8,058        $8,864     $16,922
//   100% Beneficiary w/Increase       $16,865    $8,002        $8,864     $17,728
//   50% Beneficiary                   $17,305    $4,221        $8,864     $17,305
//   50% Beneficiary w/Increase        $17,275    $4,205        $8,864     $17,728
//
// Two mechanics fall straight out of those numbers. They are facts now, not guesses:
//
// 1. SURVIVOR CONTINUANCE is half the unmodified allowance, it is employer-paid, and it is
//    IDENTICAL under every option — $8,864 in all six rows. CalPERS: it is "paid to an eligible
//    survivor in addition to and regardless of which retirement payment option you elect."
//    It costs the member nothing and is not an election. The old version of this file told
//    members the Unmodified Allowance left a spouse nothing. That was wrong.
//
// 2. THE OPTION REDUCTION APPLIES ONLY TO THE OPTION PORTION — the part of the allowance above
//    the survivor continuance. Proof: 17,728 − 8,864 = 8,864 option portion. The 100% Beneficiary
//    reduction is 17,728 − 16,922 = 806, and 8,864 − 806 = 8,058 — exactly the beneficiary figure
//    CalPERS printed. The 50% row proves it again: 17,728 − 17,305 = 423; 8,864 − 423 = 8,441;
//    half of 8,441 = 4,221, again exact. Reproduces all six rows to the dollar.
//
// THE FACTORS BELOW ARE ONE MEMBER'S, AT ONE PAIR OF AGES. CalPERS option factors move with both
// the member's age and the beneficiary's age, and CalPERS publishes no table. A younger beneficiary
// is expected to collect longer, so their reduction is larger; an older beneficiary's is smaller.
// We do not model that curve — one data point cannot produce one, and inventing a curve is exactly
// what this file used to do. Every screen says these are calibrated from a single verified estimate
// and points the member at their own. A myCalPERS figure typed in overrides them everywhere.
//
// Survivor continuance also requires (a) an eligible survivor and (b) that the employer contracted
// for the benefit. Eligible spouse: "married to the member at least one year prior to the retirement
// date and continuously to the date of death" (CalPERS PUB 60). The member answers (a) on screen.
const SURVIVOR_CONTINUANCE_PCT = 0.50;
const OPTION_FACTOR_ANCHOR = "verified myCalPERS estimate · member 50, beneficiary 49";
// Reduction as a fraction of the OPTION PORTION (not of the whole allowance).
const OPTION_PORTION_REDUCTION = {
  unmod:   0,
  ben100:  806 / 8864,   //  9.09%
  ben100w: 863 / 8864,   //  9.74%
  ben50:   423 / 8864,   //  4.77%
  ben50w:  453 / 8864,   //  5.11%
};
// Return of Remaining Contributions is not a joint-and-survivor factor — it is priced off the
// contribution balance, so it reduces the FULL allowance, not the option portion.
const ROC_FULL_REDUCTION = 58 / 17728;   // 0.33%
const OPTION_ESTIMATE_BAND = 0.35;       // ± band shown, since the member's ages will differ
// Old saved elections, before the options were renamed to match myCalPERS.
const LEGACY_OPTION_KEYS = { opt1: "unmod", opt2: "ben100", opt2w: "ben100w", opt3: "ben50", opt3w: "ben50w" };
function calcBracketTax(taxable, brackets) {
  if (taxable <= 0) return 0;
  let tax = 0, lower = 0;
  for (const [upTo, rate] of brackets) {
    if (taxable > upTo) { tax += (upTo - lower) * rate; lower = upTo; }
    else { tax += (taxable - lower) * rate; break; }
  }
  return tax;
}
function future457Value(currentBalance, annualContrib, cityMatchAnnual, years, rate) {
  const monthlyRate = rate / 12;
  const months = years * 12;
  const monthlyContrib = (annualContrib + cityMatchAnnual) / 12;
  return currentBalance * Math.pow(1 + monthlyRate, months) +
    monthlyContrib * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}
// ─── COLOR PALETTE ─────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0b0b0d", surface: "#151518", card: "#17171b", border: "#2e2e34",
  accent: "#d21f33", accentLight: "#ea3b4e", gold: "#f59e0b", blue: "#3b82f6",
  green: "#10b981", text: "#f4f6f8", textMuted: "#9aa1ad", textDim: "#5d646f",
  danger: "#ef4444",
};
// ─── STYLES ────────────────────────────────────────────────────────────────
const styles = {
  app: { minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", padding: "0", position: "relative" },
  header: { background: `linear-gradient(135deg, #151517 0%, #0b0b0d 55%, #151517 100%)`,
    borderBottom: `2px solid ${COLORS.accent}`, padding: "24px 32px",
    display: "flex", alignItems: "center", gap: "20px" },
  logo: { height: "64px", width: "auto",
    filter: "drop-shadow(0 0 14px rgba(210, 31, 51, 0.35))" },
  headerTitle: { margin: 0, fontSize: "22px", fontWeight: "800",
    letterSpacing: "-0.5px", color: COLORS.text },
  headerSub: { margin: 0, fontSize: "12px", color: COLORS.accent,
    letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600" },
  container: { maxWidth: "1100px", margin: "0 auto", padding: "32px 20px" },
  grid: { display: "grid", gridTemplateColumns: "380px 1fr", gap: "24px", alignItems: "start" },
  card: { background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: "12px", padding: "24px", marginBottom: "20px" },
  cardTitle: { margin: "0 0 16px 0", fontSize: "15px", fontWeight: "600",
    letterSpacing: "0", textTransform: "none", color: COLORS.text,
    borderBottom: `1px solid ${COLORS.border}`, paddingBottom: "10px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600",
    color: COLORS.textMuted, marginBottom: "6px",
    letterSpacing: "0", textTransform: "none" },
  input: { width: "100%", background: "#121214", border: `1px solid ${COLORS.border}`,
    borderRadius: "8px", padding: "10px 14px", color: COLORS.text,
    fontSize: "14px", outline: "none", boxSizing: "border-box" },
  select: { width: "100%", background: "#121214", border: `1px solid ${COLORS.border}`,
    borderRadius: "8px", padding: "10px 14px", color: COLORS.text,
    fontSize: "14px", outline: "none", boxSizing: "border-box",
    appearance: "none", cursor: "pointer" },
  fieldGroup: { marginBottom: "16px" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  checkRow: { display: "flex", alignItems: "center", gap: "10px",
    marginBottom: "10px", cursor: "pointer" },
  checkbox: { width: "18px", height: "18px", accentColor: COLORS.accent, cursor: "pointer" },
  checkLabel: { fontSize: "13px", color: COLORS.text, cursor: "pointer" },
  certNote: { fontSize: "11px", color: COLORS.textMuted, marginLeft: "28px",
    marginTop: "-6px", marginBottom: "8px", fontStyle: "italic" },
  bigNumber: { fontSize: "36px", fontWeight: "800", color: COLORS.accent,
    letterSpacing: "-1px", lineHeight: 1 },
  bigNumberGreen: { fontSize: "36px", fontWeight: "800", color: COLORS.green,
    letterSpacing: "-1px", lineHeight: 1 },
  metricLabel: { fontSize: "11px", color: COLORS.textMuted,
    textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" },
  divider: { borderColor: COLORS.border, margin: "16px 0" },
  tableRow: { display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 0", fontSize: "13px" },
  tableRowLast: { display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0 0 0", fontSize: "14px", fontWeight: "700" },
  tableKey: { color: COLORS.textMuted },
  tableVal: { color: COLORS.text, fontWeight: "600" },
  tableValGreen: { color: COLORS.green, fontWeight: "700" },
  tableValGold: { color: COLORS.gold, fontWeight: "700" },
  tableValAccent: { color: COLORS.accent, fontWeight: "700" },
  tableValDim: { color: COLORS.textDim, fontWeight: "500", fontStyle: "italic" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: "4px",
    fontSize: "10px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" },
  badgeGreen: { background: "rgba(255, 255, 255, 0.15)", color: COLORS.green,
    border: `1px solid rgba(255, 255, 255, 0.3)` },
  tabRow: { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  tab: (active) => ({
    padding: "11px 10px", borderRadius: "12px",
    border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
    background: active ? "rgba(210,31,51,0.16)" : "#141416",
    color: active ? "#ffffff" : COLORS.textMuted,
    fontSize: "14px", fontWeight: active ? "600" : "500", letterSpacing: "0",
    textTransform: "none", cursor: "pointer",
    boxShadow: active ? "0 0 14px rgba(210,31,51,0.45)" : "none",
    transition: "background 0.15s, box-shadow 0.15s, border-color 0.15s",
  }),
  summaryBar: { display: "grid", gap: "12px", marginBottom: "20px" },
  summaryCard: { background: "#121214", border: `1px solid ${COLORS.border}`,
    borderRadius: "10px", padding: "14px 16px" },
  summaryLabel: { fontSize: "11px", color: COLORS.textMuted, textTransform: "uppercase",
    letterSpacing: "1px", marginBottom: "4px" },
  summaryValue: { fontSize: "26px", fontWeight: "700", letterSpacing: "-0.5px", lineHeight: 1.1 },
  sectionToggle: { width: "100%", display: "flex", justifyContent: "space-between",
    alignItems: "center", background: "#121214", border: `1px solid ${COLORS.border}`,
    borderRadius: "10px", padding: "12px 14px", color: COLORS.text, fontSize: "14px",
    fontWeight: "600", cursor: "pointer", marginBottom: "12px" },
  compareBox: { background: "rgba(255, 255, 255, 0.05)",
    border: `1px solid rgba(255, 255, 255, 0.2)`, borderRadius: "8px",
    padding: "16px", marginTop: "12px" },
  warningBox: { background: "rgba(210, 31, 51, 0.05)",
    border: `1px solid rgba(210, 31, 51, 0.2)`, borderRadius: "8px",
    padding: "12px 16px", marginBottom: "12px", fontSize: "12px",
    color: COLORS.gold, lineHeight: "1.6" },
  colaTable: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  footer: { textAlign: "center", padding: "24px", color: COLORS.textDim,
    fontSize: "11px", borderTop: `1px solid ${COLORS.border}`,
    marginTop: "40px", lineHeight: "1.8" },
};
// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) || "$0";
const fmtHr = (n) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${(n * 100).toFixed(1)}%`;
// A bargained figure has to print exactly as bargained: 1.75% is not 1.8%. Shows up to two
// decimals and trims what is not needed, so 0 reads "0%", 0.025 reads "2.5%", 0.0175 reads "1.75%".
const pctExact = (n) => {
  const v = n * 100;
  const near = (x) => Math.abs(x - Math.round(x)) < 1e-9;
  return (near(v) ? String(Math.round(v)) : near(v * 10) ? v.toFixed(1) : v.toFixed(2)) + "%";
};
// ─── LOCAL STORAGE PERSISTENCE ───────────────────────────────────────────
// Saves user inputs to browser localStorage. Data NEVER leaves the device — no
// server, no analytics, no tracking. Stored under a single key as JSON.
// Bump STORAGE_VERSION if the data shape ever changes incompatibly.
const STORAGE_KEY = "rff-calc-v1";
function loadSavedState() {
  try {
    if (typeof window === "undefined") return {};
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}
function saveState(state) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
function clearSavedState() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
const SAVED = loadSavedState();
// v48 migration. Sick leave used to be two boxes (hours to cash / hours to convert) applied to
// a projected balance. It is now one figure — hours you expect AT RETIREMENT — and one choice.
// A saved profile from the two-box era carries its total and its leaning across.
const LEGACY_SICK_CASH = parseFloat(SAVED.sickCashHours) || 0;
const LEGACY_SICK_CREDIT = parseFloat(SAVED.sickCreditHours) || 0;
const LEGACY_SICK_TOTAL = LEGACY_SICK_CASH + LEGACY_SICK_CREDIT;
// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function RFFRetirementCalculator() {
  // Deep link: ?tab=sickleave opens straight to a screen, so a link in a newsletter or a
  // text message can point at the part that matters. Also what the render test drives.
  const VALID_TABS = ["member", "comp", "pension", "survivor", "health", "stayorgo", "income", "help", "updates"];
  // Links sent out before each rebuild still have to land somewhere sensible.
  const LEGACY_TABS = { start: "member", pay: "member", now: "member", retired: "pension",
                        wait: "stayorgo", medical: "health", deductions: "survivor", advanced: "income",
                        sickleave: "member", inputs: "member",
                        pensiondetail: "pension", timeline: "stayorgo" };
  const initialTab = (() => {
    try {
      const q = typeof window !== "undefined" && window.location
        ? new URLSearchParams(window.location.search).get("tab") : null;
      if (LEGACY_TABS[q]) return LEGACY_TABS[q];
      return VALID_TABS.includes(q) ? q : "member";
    } catch { return "member"; }
  })();
  const [tab, setTab] = useState(initialTab);
  // The tool used to open on a brand-new hire's numbers. It now shows nothing until the
  // member has answered the five questions that make the answer theirs.
  const [setupDone, setSetupDone] = useState(SAVED.setupDone ?? (SAVED.hireDate ? true : false));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  // Collapsible input sections — tap a title to open/close (choice persists on device)
  const [openSections, setOpenSections] = useState(SAVED.openSections ?? { profile: true, prior: true, hiredate: true, rank: true, paystep: true, raises: false, incentives: false, sickleave: false, yourprofile: false, breakdown: false, cola: false, survivor: false,
      startpay: false, startincent: false, starthourly: false, startraises: false, startpayout: false,
      startprior: false, startextras: false, startcalpers: false });
  const toggleSection = (k) => setOpenSections(s => ({ ...s, [k]: s[k] === false }));
  // toggleSection treats "unset" as open, which is right for the big collapsible cards.
  // A disclosure that starts CLOSED needs the plain flip, or the first click does nothing
  // visible (unset -> false is still closed) and it takes two clicks to open.
  const toggleClosed = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
  // Condensed explainer. Every label already says what to enter; this holds the reasoning
  // behind it, shut, so the form reads as a form rather than a wall of grey text.
  const moreInfo = (key, label, body) => (
    <div style={{ marginTop: "2px", marginBottom: "14px" }}>
      <span onClick={() => toggleClosed(key)}
        style={{ cursor: "pointer", userSelect: "none", fontSize: "11px", color: COLORS.textDim }}>
        {openSections[key] ? "\u25be" : "\u25b8"} {label}
      </span>
      {openSections[key] && (
        <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px", lineHeight: 1.7 }}>{body}</div>
      )}
    </div>
  );
  const sectionHeader = (key, title) => (
    <p
      style={{ ...styles.cardTitle, cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center", ...(openSections[key] !== false ? {} : { marginBottom: 0, borderBottom: "none", paddingBottom: 0 }) }}
      onClick={() => toggleSection(key)}>
      <span>{title}</span>
      <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections[key] !== false ? "▾" : "▸ tap to open"}</span>
    </p>
  );
  // Same collapsible header, but the current value stays visible when it's closed — so
  // collapsing a section hides the controls, never the number.
  const sectionHeaderValue = (key, title, value) => (
    <p
      style={{ ...styles.cardTitle, cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", ...(openSections[key] !== false ? {} : { marginBottom: 0, borderBottom: "none", paddingBottom: 0 }) }}
      onClick={() => toggleSection(key)}>
      <span>{title}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <span style={{ fontSize: "13px", color: COLORS.gold, fontWeight: 700 }}>{value}</span>
        <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections[key] !== false ? "▾" : "▸"}</span>
      </span>
    </p>
  );
  // Mobile detection — stacks layout, shrinks header, wraps tabs below 768px
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // Profile (all defaults pull from saved localStorage state when present)
  const [classification, setClassification] = useState(SAVED.classification ?? "Firefighter Paramedic I");
  const [salaryStep, setSalaryStep] = useState(SAVED.salaryStep ?? "A");
  const [dob, setDob] = useState(SAVED.dob ?? (SAVED.currentAge ? `${new Date().getFullYear() - SAVED.currentAge}-01-01` : "1990-01-01"));
  const [retirementAge, setRetirementAge] = useState(SAVED.retirementAge ?? 57);
  // Exact retirement date override ("YYYY-MM-DD"). Empty = derive Jan 1 of the age-based year.
  const [retirementDateOverride, setRetirementDateOverride] = useState(SAVED.retirementDateOverride ?? "");
  const [hireDate, setHireDate] = useState(SAVED.hireDate ?? "2026-01-01");
  // Pension type — auto-derived from hire date unless override is on
  const [memberType, setMemberType] = useState(SAVED.memberType ?? "pepra");
  const [overridePensionType, setOverridePensionType] = useState(SAVED.overridePensionType ?? false);
  const [medicalTier, setMedicalTier] = useState(SAVED.medicalTier ?? "4");
  // Member-chosen medical plan + coverage tier (drives the cost breakdown on the Medical tab).
  const [selectedMedicalPlan, setSelectedMedicalPlan] = useState(
    RETIRED_PLANS_2027[SAVED.selectedMedicalPlan] || SAVED.selectedMedicalPlan || "Kaiser Permanente");
  const [medicalCoverage, setMedicalCoverage] = useState(SAVED.medicalCoverage ?? "ee");
  const [retireeMedicalPlan, setRetireeMedicalPlan] = useState(
    RETIRED_PLANS_2027[SAVED.retireeMedicalPlan] || SAVED.retireeMedicalPlan || "Kaiser Permanente");
  const [retireeCoverage, setRetireeCoverage] = useState(SAVED.retireeCoverage ?? "ee");
  const [healthRateYear, setHealthRateYear] = useState(SAVED.healthRateYear ?? HEALTH_RATE_CURRENT);
  const [dentalPlan, setDentalPlan] = useState(SAVED.dentalPlan ?? "Delta Dental High PPO");
  const [hasVision, setHasVision] = useState(SAVED.hasVision ?? true);
  const [filingStatus, setFilingStatus] = useState(SAVED.filingStatus ?? "single");
  const [retirementState, setRetirementState] = useState(SAVED.retirementState ?? "CA");
  const [otherStateRate, setOtherStateRate] = useState(SAVED.otherStateRate ?? 5);
  const [dependents, setDependents] = useState(SAVED.dependents ?? 0);
  const [otherIncome, setOtherIncome] = useState(SAVED.otherIncome ?? 0);
  const [filingStatusRet, setFilingStatusRet] = useState(SAVED.filingStatusRet ?? "single");
  const [dependentsRet, setDependentsRet] = useState(SAVED.dependentsRet ?? 0);
  const [otherIncomeRet, setOtherIncomeRet] = useState(SAVED.otherIncomeRet ?? 0);
  // Additional retirement income sources (annual gross). Off page-one decision by default.
  const [retIra, setRetIra] = useState(SAVED.retIra ?? 0);
  const [retRental, setRetRental] = useState(SAVED.retRental ?? 0);
  const [retBusiness, setRetBusiness] = useState(SAVED.retBusiness ?? 0);
  // When true, extra retirement income folds into the page-one take-home & decision.
  const [foldExtraIncome, setFoldExtraIncome] = useState(SAVED.foldExtraIncome ?? false);
  const [include457InTakeHome, setInclude457InTakeHome] = useState(SAVED.include457InTakeHome ?? false);
  // Prior-agency service rows (reciprocity) — each prior system pays its own check.
  const [priorService, setPriorService] = useState(Array.isArray(SAVED.priorService) ? SAVED.priorService : []);
  const addPriorRow = () => setPriorService(rows => [...rows, { id: Date.now(), agencyName: "", formula: "3@50", manualFactor: "", years: "", useRosevilleComp: true, customComp: "" }]);
  const updatePriorRow = (id, patch) => setPriorService(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
  const removePriorRow = (id) => setPriorService(rows => rows.filter(r => r.id !== id));
  // Incentive pays (checkboxes)
  const [hasParamedic, setHasParamedic] = useState(SAVED.hasParamedic ?? false);
  const [hasRescue, setHasRescue] = useState(SAVED.hasRescue ?? false);
  const [rescueLevel, setRescueLevel] = useState(SAVED.rescueLevel ?? "team");
  const [hasHazmat, setHasHazmat] = useState(SAVED.hasHazmat ?? false);
  const [hazmatLevel, setHazmatLevel] = useState(SAVED.hazmatLevel ?? "team");
  const [hasInvestigation, setHasInvestigation] = useState(SAVED.hasInvestigation ?? false);
  const [investigationLevel, setInvestigationLevel] = useState(SAVED.investigationLevel ?? "team");
  const [hasBachelor, setHasBachelor] = useState(SAVED.hasBachelor ?? false);
  const [hasAssociate, setHasAssociate] = useState(SAVED.hasAssociate ?? false);
  // CSFM Certificates per classification
  const [hasEngineerCert, setHasEngineerCert] = useState(SAVED.hasEngineerCert ?? false);
  const [hasCompanyOfficer, setHasCompanyOfficer] = useState(SAVED.hasCompanyOfficer ?? false);
  const [hasChiefFireOfficer, setHasChiefFireOfficer] = useState(SAVED.hasChiefFireOfficer ?? false);
  const [hasEngineBoss, setHasEngineBoss] = useState(SAVED.hasEngineBoss ?? false);
  const [hasFFII, setHasFFII] = useState(SAVED.hasFFII ?? false);
  // 457
  // 457(b) special three-year pre-retirement catch-up: a one-time election available in the
  // three years before normal retirement age. Cannot be combined with the age-based catch-up.
  const [useSpecial457Catchup, setUseSpecial457Catchup] = useState(SAVED.useSpecial457Catchup ?? false);
  const [current457, setCurrent457] = useState(SAVED.current457 ?? 0);
  const [annual457Contrib, setAnnual457Contrib] = useState(SAVED.annual457Contrib ?? 6000);
  const [hasEmployerMatch, setHasEmployerMatch] = useState(SAVED.hasEmployerMatch ?? false);
  const [returnRate, setReturnRate] = useState(SAVED.returnRate ?? 8);
  const [retireDrawRate, setRetireDrawRate] = useState(SAVED.retireDrawRate ?? 4);
  const [retireReturnRate, setRetireReturnRate] = useState(SAVED.retireReturnRate ?? 3);
  // 457 "delay your draw": age you start drawing (0 = draw immediately at retirement) and the return
  // earned while retired but NOT yet drawing (balance keeps growing until the later draw age).
  const [drawStartAge, setDrawStartAge] = useState(SAVED.drawStartAge ?? 0);
  const [retireWaitReturnRate, setRetireWaitReturnRate] = useState(SAVED.retireWaitReturnRate ?? 5);
  // Current overtime worked, hours per month — for the "salary with OT" comparison.
  const [currentOTHours, setCurrentOTHours] = useState(SAVED.currentOTHours ?? 0);
  // Sick leave — user enters CURRENT hours; we project forward to retirement
  // Hours the member expects to have on the books ON THEIR LAST DAY. Not today's balance and
  // not projected from it — members use sick leave, and adding 144 hrs/yr of accrual to today's
  // number overstated it for everyone who ever called in sick.
  const [currentSickLeaveHours, setCurrentSickLeaveHours] = useState(
    SAVED.currentSickLeaveHours || LEGACY_SICK_TOTAL || 0);
  // Which calendar year the hourly-rate card is showing.
  // The compensation year picker. Until the member moves it themselves it follows their
  // retirement year, so this screen agrees with the headline numbers instead of showing
  // today's pay under a header built from retirement-year rates. rateYearPicked is what
  // separates "they chose this year" from "this is just where it landed" — a saved profile
  // from before this change has no flag, so it follows the retirement year too.
  const [rateYear, setRateYear] = useState(SAVED.rateYear ?? null);
  const [rateYearPicked, setRateYearPicked] = useState(SAVED.rateYearPicked === true);
  const pickRateYear = (y) => { setRateYear(y); setRateYearPicked(true); };
  const [airtime, setAirtime] = useState(SAVED.airtime ?? 0); // CalPERS ARSC "airtime" purchased pre-2013 (max 5 yrs)
  // Service credit exactly as myCalPERS reports it, which is the authoritative number.
  // CalPERS service credit is earned on reported hours, so it does not have to equal calendar
  // years since hire. 0 means "not supplied — estimate from the hire date".
  const [calpersCreditRoseville, setCalpersCreditRoseville] = useState(SAVED.calpersCreditRoseville ?? 0);
  // myCalPERS folds purchased credit into the employer lines, so adding airtime again would
  // double-count it. Checked by default because that is how myCalPERS reports it.
  const [calpersCreditIncludesPurchased, setCalpersCreditIncludesPurchased] = useState(SAVED.calpersCreditIncludesPurchased ?? true);
  // myCalPERS stamps its figures "Last reported <date>", which can be weeks behind. Service
  // accrues from THAT date to retirement, not from today.
  const [calpersCreditAsOf, setCalpersCreditAsOf] = useState(SAVED.calpersCreditAsOf ?? "");
  // Member contributions + interest. This is a refund figure, not a retirement lump sum.
  const [calpersBalance, setCalpersBalance] = useState(SAVED.calpersBalance ?? 0);
  // Sick leave disposition: "cash" or "credit". Binary by law — the same hour cannot be both
  // cashed out under the MOU and converted to service credit under Gov. Code §20965.
  const [sickLeaveDisposition, setSickLeaveDisposition] = useState(
    SAVED.sickLeaveDisposition === "cash" ? "cash"
      : SAVED.sickLeaveDisposition === "credit" ? "credit"
      : LEGACY_SICK_CASH > LEGACY_SICK_CREDIT ? "cash" : "credit");
  // Beneficiary age for CalPERS survivor benefit options (0 = same as member at retirement)
  const [beneficiaryAge, setBeneficiaryAge] = useState(SAVED.beneficiaryAge ?? 0);
  // Which CalPERS allowance option the member intends to elect. Most members take a reduced
  // allowance to leave a continuance to a spouse, so this has to drive every figure in the tool,
  // not sit in a table nobody reads.
  const [survivorOption, setSurvivorOption] = useState(
    LEGACY_OPTION_KEYS[SAVED.survivorOption] || SAVED.survivorOption || "unmod");
  const [hasEligibleSurvivor, setHasEligibleSurvivor] = useState(SAVED.hasEligibleSurvivor ?? true);
  // The member's REAL reduction, off their myCalPERS estimate, as a percent. Blank = use the
  // estimate above and label it as such.
  const [survivorActualPct, setSurvivorActualPct] = useState(SAVED.survivorActualPct ?? "");
  // Promotion modeling
  // Planned retirement year (works alongside age; 0 = derive from age inputs)
  const [plannedRetirementYear, setPlannedRetirementYear] = useState(SAVED.plannedRetirementYear ?? 0);
  // Projected raises — % values. The MOU (1/1/26–12/31/29) sets 2027=0% and 2029=1.75%; 2028 defaults to 3% (Treasurer est.).
  // What Local 1592 wins at the table, as an annual percentage. Covers the 2028 compensation
  // study (no figure agreed yet) and every year after the MOU expires 12/31/2029. Defaults to
  // 0 so nothing is credited that has not been bargained.
  const [unionRaisePct, setUnionRaisePct] = useState(SAVED.unionRaisePct ?? 0);
  // Contract ends 12/31/2029. Every year from 2030 on uses this assumed annual raise (compounds to retirement). ~3% historically steady.
  // Tier 4 RHS account assumed annual investment return (member-adjustable). Default 5% —
  // moderate-conservative for a health/VEBA account that de-risks toward retirement.
  const [rhsReturn, setRhsReturn] = useState(SAVED.rhsReturn ?? 5);
  // Inflation assumption for the "today's dollars" view of retirement income.
  // CPI. Drives the conversion to today's dollars and caps the retiree COLA (CalPERS pays the
  // lesser of your contracted cap and actual CPI). Defaults to 0 so the tool starts with no
  // assumptions at all — at 0 and 0, only service credit moves the numbers.
  const [inflationRate, setInflationRate] = useState(SAVED.inflationRate ?? 0);
  // MOU Ch.2 Art.I.A.3 — Labor Market Adjustment, first full pay period January 2028. The 2027
  // Total Compensation Study (survey data effective 9/1/2027) sets it, so the figure does not
  // exist yet. Floor-only: the City raises classifications that fall BELOW the 55th percentile
  // up to it, so this can never be negative.
  const [lmaPct, setLmaPct] = useState(SAVED.lmaPct ?? 0);
  // ── DERIVED VALUES ────────────────────────────────────────────────────────
  const hireYear = parseInt(hireDate.slice(0, 4), 10) || new Date().getFullYear();
  const hireMonth = parseInt(hireDate.slice(5, 7), 10) || 1;
  const hireDay = parseInt(hireDate.slice(8, 10), 10) || 1;
  // Schedule A = hired before 1/7/2017 (8 steps A-H); Schedule B = on/after (9 steps A-I)
  const activeSchedule = scheduleForHire(new Date(hireYear, hireMonth - 1, hireDay));
  const scheduleLetter = activeSchedule === SALARY_SCHEDULE_A ? "A" : "B";
  const baseSalary = activeSchedule[classification]?.steps[salaryStep] || 0;
  const NOW = new Date();
  const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
  // Date of birth drives exact age (to the quarter-year) for CalPERS benefit factors.
  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(dob || "");
  const dobDate = dobValid ? new Date(parseInt(dob.slice(0, 4), 10), parseInt(dob.slice(5, 7), 10) - 1, parseInt(dob.slice(8, 10), 10)) : null;
  // Exact age on a date, by the calendar — NOT (ms / 365.25), which drifts by a day or more
  // over 50+ years and can read 52.9993 for someone who is exactly 53. That drift reaches the
  // PEPRA benefit factor, which steps by quarter-year, so it changed real money.
  const exactAgeOn = (birth, on) => {
    if (!birth) return null;
    const annivThisYear = new Date(on.getFullYear(), birth.getMonth(), birth.getDate());
    const before = on < annivThisYear;
    const whole = on.getFullYear() - birth.getFullYear() - (before ? 1 : 0);
    const last = new Date(on.getFullYear() - (before ? 1 : 0), birth.getMonth(), birth.getDate());
    const next = new Date(last.getFullYear() + 1, birth.getMonth(), birth.getDate());
    return whole + (on - last) / (next - last);
  };
  const currentAge = dobDate ? Math.max(0, Math.floor(exactAgeOn(dobDate, NOW))) : 40;
  const integerYearsToRetirement = Math.max(0, retirementAge - currentAge);
  const derivedRetirementYear = NOW.getFullYear() + integerYearsToRetirement;
  // Retirement timing: default to the date the member reaches the chosen retirement age
  // (their birthday that year). The member can override the exact date in the date field.
  const defaultRetDateStr = dobDate
    ? `${dobDate.getFullYear() + retirementAge}-${String(dobDate.getMonth() + 1).padStart(2, "0")}-${String(dobDate.getDate()).padStart(2, "0")}`
    : `${derivedRetirementYear}-01-01`;
  const effectiveRetDateStr = /^\d{4}-\d{2}-\d{2}$/.test(retirementDateOverride || "")
    ? retirementDateOverride : defaultRetDateStr;
  const retirementYear = parseInt(effectiveRetDateStr.slice(0, 4), 10) || derivedRetirementYear;
  const retMonthNum = parseInt(effectiveRetDateStr.slice(5, 7), 10) || 1;
  const retDayNum = parseInt(effectiveRetDateStr.slice(8, 10), 10) || 1;
  const retirementDate = new Date(retirementYear, retMonthNum - 1, retDayNum);
  const hireDateObj = new Date(hireYear, hireMonth - 1, hireDay);
  // Exact age at retirement, snapped down to the completed quarter-year (CalPERS method).
  const exactRetireAge = dobDate ? exactAgeOn(dobDate, retirementDate) : retirementAge;
  const retireAgeQ = dobDate ? Math.max(0, Math.floor(exactRetireAge * 4) / 4) : retirementAge;
  // "Normal retirement age" as Roseville's CalPERS contract defines it (para 1):
  // age 50 for classic local safety, age 57 for new (PEPRA) local safety.
  // Drives Tier 3 retiree medical (MOU Ch.4 Art.II.D) and the 457 three-year catch-up window.
  const normalRetirementAge = memberType === "classic" ? 50 : 57;
  const atNormalRetirementAge = retireAgeQ >= normalRetirementAge;
  // Invalid combo (retirement on/before hire) — surfaced as an inline error, not a fake result.
  const datesInvalid = retirementDate <= hireDateObj;
  // Fractional years of service from actual hire date to the actual retirement month.
  const yearsOfService = Math.max(0, (retirementDate - hireDateObj) / MS_PER_YEAR);
  // Service completed as of today — drives the 457 match vesting point.
  const currentServiceYears = Math.max(0, (NOW - hireDateObj) / MS_PER_YEAR);
  // Fractional time from today to retirement — drives sick-leave accrual and 457 growth.
  const yearsToRetirement = Math.max(0, (retirementDate - NOW) / MS_PER_YEAR);
  // Whole completed City service years for retiree-medical vesting (vests by full year).
  const cityYOS = Math.floor(yearsOfService);
  // PEPRA pensionable-comp cap, escalated to the retirement year (Classic is not capped this way).
  const peraCapMonthly = (PEPRA_COMP_CAP_2026 * Math.pow(1 + PEPRA_CAP_COLA, Math.max(0, retirementYear - 2026))) / 12;
  // ── PROJECTED SALARY AT RETIREMENT ──────────────────────────────────────
  // Applies compounding raises for each year up to and including retirement year.
  // For Engineer and Captain retiring 2027+: salary is restructured relative to
  // FF Para II per MOU rank separation (2027: Eng=FF×1.075, Capt=Eng×1.10;
  // 2028+: Eng=FF×1.10, Capt=Eng×1.10).
  // FF Para II at the same step — anchor for rank separation math
  const ffParaIIAtStep = activeSchedule["Firefighter Paramedic II"]?.steps[salaryStep]
    || activeSchedule["Firefighter Paramedic II"]?.steps[Object.keys(activeSchedule["Firefighter Paramedic II"]?.steps || {}).slice(-1)[0]] || 0;
  // These are functions of a plan YEAR, not just the retirement year, because PEPRA final
  // compensation is a 36-month average and needs the two years before retirement too.
  const raiseFactorForYear = (y) => {
    if (y < 2027) return 1.0;
    let f = 1.0;
    // 2027 and 2029 are set by the MOU and differ by class, so they are not user inputs.
    if (y >= 2027) f *= (1 + mouGwiFor(2027, classification));
    // MOU Ch.2 Art.I.A.3 — Labor Market Adjustment, first full pay period January 2028. Set by the
    // 2027 Total Compensation Study, which has not been run, so the member supplies the figure.
    // It lifts base hourly rate, so the 2029 GWI compounds on top of it.
    if (y >= 2028) f *= (1 + Math.max(0, parseFloat(lmaPct) || 0) / 100);
    if (y >= 2029) f *= (1 + mouGwiFor(2029, classification));
    // 2028 has no agreed GWI (Total Compensation Study) and the contract runs through 12/31/2029,
    // so the bargaining dial is barred from touching any year the MOU already covers. It applies
    // to 2030 and later only, and compounds from there.
    const bargained = (parseFloat(unionRaisePct) || 0) / 100;
    if (y >= 2030) f *= Math.pow(1 + bargained, y - 2029);
    return f;
  };
  // Rank separation per MOU Ch.2 Art.I.A (Engineer and Captain only, 2027+)
  const rankMultiplierForYear = (y) => {
    if (y < 2027) return 1.0;
    if (classification === "Fire Engineer") return y >= 2028 ? 1.10 : 1.075;
    if (classification === "Fire Captain")  return y >= 2028 ? 1.10 * 1.10 : 1.075 * 1.10;
    return 1.0;
  };
  const projectedBaseForYear = (y) => ((y >= 2027 &&
    (classification === "Fire Engineer" || classification === "Fire Captain") && ffParaIIAtStep > 0)
    ? ffParaIIAtStep * raiseFactorForYear(y) * rankMultiplierForYear(y)
    : baseSalary * raiseFactorForYear(y));
  const cumulativeRaiseFactor = raiseFactorForYear(retirementYear);
  const rankMultiplier = rankMultiplierForYear(retirementYear);
  const projectedBaseSalary = projectedBaseForYear(retirementYear);
  // Hire-date driven flags
  const showLongevity = hireYear < LONGEVITY_CUTOFF_YEAR;          // Article VIII
  const showServiceTermBonus = hireYear >= LONGEVITY_CUTOFF_YEAR;  // Article IX
  const captainIncentivesActive = retirementDate < CAPTAIN_INCENTIVE_CEASE_DATE;
  const engineerCertActive = retirementDate < ENGINEER_CERT_CEASE_DATE;
  // Auto-set member type from hire year (unless override)
  useEffect(() => {
    if (!overridePensionType) {
      setMemberType(hireYear < CLASSIC_PEPRA_CUTOFF_YEAR ? "classic" : "pepra");
    }
  }, [hireYear, overridePensionType]);
  // Auto medical tier from hire year
  useEffect(() => {
    if (hireYear < 2004) setMedicalTier("1");
    else if (hireYear < 2012) setMedicalTier("2");
    else if (new Date(hireYear, hireMonth - 1, hireDay) < new Date(2015, 7, 15)) setMedicalTier("3"); // Tier 4 begins Aug 15, 2015
    else setMedicalTier("4");
  }, [hireYear, hireMonth, hireDay]);
  // Clamp any stale salary step (e.g. a removed "I") to the top valid step.
  useEffect(() => {
    const steps = Object.keys(activeSchedule[classification]?.steps || {});
    if (steps.length && !steps.includes(salaryStep)) setSalaryStep(steps[steps.length - 1]);
  }, [classification, salaryStep, activeSchedule]);
  // ── PERSIST INPUTS TO LOCAL STORAGE ─────────────────────────────────────
  // Auto-save every state change. Nothing leaves the browser.
  useEffect(() => {
    saveState({
      setupDone, classification, salaryStep, dob, retirementAge, retirementDateOverride, hireDate,
      memberType, overridePensionType, medicalTier, selectedMedicalPlan, medicalCoverage, retireeMedicalPlan, retireeCoverage, healthRateYear, dentalPlan, hasVision, filingStatus, retirementState, otherStateRate, dependents, otherIncome, filingStatusRet, dependentsRet, otherIncomeRet, retIra, retRental, retBusiness, foldExtraIncome, include457InTakeHome, priorService,
      hasParamedic, hasRescue, rescueLevel, hasHazmat, hazmatLevel,
      hasInvestigation, investigationLevel, hasBachelor, hasAssociate,
      hasEngineerCert, hasCompanyOfficer, hasChiefFireOfficer, hasEngineBoss, hasFFII,
      useSpecial457Catchup, current457, annual457Contrib, hasEmployerMatch, returnRate, retireDrawRate, retireReturnRate, drawStartAge, retireWaitReturnRate, currentOTHours,
      currentSickLeaveHours, rateYear, rateYearPicked, airtime,
      calpersCreditRoseville, calpersCreditIncludesPurchased, calpersCreditAsOf, calpersBalance,
      sickLeaveDisposition,
      beneficiaryAge,
      plannedRetirementYear,
      unionRaisePct, lmaPct, rhsReturn, inflationRate, openSections, survivorOption, survivorActualPct,
      hasEligibleSurvivor,
    });
  }, [
    setupDone, classification, salaryStep, currentAge, retirementAge, retirementDateOverride, hireDate,
    memberType, overridePensionType, medicalTier, selectedMedicalPlan, medicalCoverage, retireeMedicalPlan, retireeCoverage, healthRateYear, dentalPlan, hasVision, filingStatus, retirementState, otherStateRate, dependents, otherIncome, filingStatusRet, dependentsRet, otherIncomeRet, retIra, retRental, retBusiness, foldExtraIncome, include457InTakeHome, priorService,
    hasParamedic, hasRescue, rescueLevel, hasHazmat, hazmatLevel,
    hasInvestigation, investigationLevel, hasBachelor, hasAssociate,
    hasEngineerCert, hasCompanyOfficer, hasChiefFireOfficer, hasEngineBoss, hasFFII,
    useSpecial457Catchup, current457, annual457Contrib, hasEmployerMatch, returnRate, retireDrawRate, retireReturnRate, drawStartAge, retireWaitReturnRate, currentOTHours,
    currentSickLeaveHours, rateYear, rateYearPicked, calpersCreditRoseville,
    calpersCreditIncludesPurchased, calpersCreditAsOf, calpersBalance, sickLeaveDisposition,
    beneficiaryAge,
    plannedRetirementYear,
    unionRaisePct, lmaPct, rhsReturn, inflationRate, openSections, survivorOption, survivorActualPct,
    hasEligibleSurvivor,
  ]);
  // Reset handler — clears localStorage and reloads page to defaults
  const resetAll = () => {
    if (window.confirm("Clear all your saved inputs and reset the calculator to defaults? This only affects this device.")) {
      clearSavedState();
      if (typeof window !== "undefined") window.location.reload();
    }
  };
  // ── INCENTIVE CALCULATION ────────────────────────────────────────────────
  // Returns: { pensionablePct, nonPensionablePct, pensionableAmt, nonPensionableAmt, breakdown }
  const calcIncentives = useCallback((base, cls, mType, yos, retDate, hireYr) => {
    let pensionablePct = 0;
    let nonPensionablePct = 0;
    const breakdown = [];
    const retD = retDate || retirementDate;
    // LONGEVITY (Article VIII) — pre-2017 hires
    if (hireYr < LONGEVITY_CUTOFF_YEAR) {
      const lonPct = LONGEVITY(yos);
      if (lonPct > 0) {
        const tierLabel = yos >= 20 ? "20+" : yos >= 15 ? "15-19" : "10-14";
        const isClassic = mType === "classic";
        if (isClassic) {
          pensionablePct += lonPct;
          breakdown.push({ label: `Longevity (${tierLabel} yrs)`, pct: lonPct, pensionable: true });
        } else {
          nonPensionablePct += lonPct;
          breakdown.push({ label: `Longevity (${tierLabel} yrs) — non-pensionable`, pct: lonPct, pensionable: false });
        }
      }
    }
    // SERVICE TERM BONUS (Article IX) — 2017+ hires, NOT pensionable
    if (hireYr >= LONGEVITY_CUTOFF_YEAR) {
      const stbPct = SERVICE_TERM_BONUS(yos);
      if (stbPct > 0) {
        const tierLabel = yos >= 15 ? "15+" : "10-14";
        nonPensionablePct += stbPct;
        breakdown.push({ label: `Service Term Bonus (${tierLabel} yrs) — non-pensionable`, pct: stbPct, pensionable: false });
      }
    }
    // EDUCATION (Article VI.B) — combines with CSFM up to 15% cap
    let educationPct = 0;
    if (hasBachelor) educationPct = 0.10;
    else if (hasAssociate) educationPct = 0.05;
    // CSFM CERTIFICATES
    let certPct = 0;
    const certEntries = [];
    if (cls === "Fire Engineer") {
      if (hasEngineerCert && retD < ENGINEER_CERT_CEASE_DATE) {
        certPct += 0.05;
        certEntries.push({ label: "Engineer Cert / FA Driver-Op", pct: 0.05 });
      }
    }
    if (cls === "Fire Captain") {
      if (hasChiefFireOfficer) {
        certPct += 0.10;
        certEntries.push({ label: "Chief Fire Officer Cert", pct: 0.10 });
      } else if (hasCompanyOfficer) {
        certPct += 0.05;
        certEntries.push({ label: "Company Officer Cert", pct: 0.05 });
      }
    }
    if (cls === "Firefighter Paramedic I" || cls === "Firefighter Paramedic II") {
      if (hasFFII) {
        certPct += 0.05;
        certEntries.push({ label: "Fire Fighter II Cert", pct: 0.05 });
      }
    }
    // Apply 15% cap on Education + CSFM combined
    const educCertRaw = educationPct + certPct;
    const educCertCapped = Math.min(educCertRaw, 0.15);
    if (educationPct > 0) {
      breakdown.push({ label: hasBachelor ? "Bachelor's Degree" : "Associate's Degree", pct: educationPct, pensionable: true });
    }
    certEntries.forEach(e => breakdown.push({ label: e.label, pct: e.pct, pensionable: true }));
    if (educCertRaw > 0.15) {
      breakdown.push({ label: `⚠ 15% Education + Cert Cap Applied (raw: ${pct(educCertRaw)})`, pct: 0, note: true });
    }
    pensionablePct += educCertCapped;
    // PARAMEDIC INCENTIVE (Article X) — pensionable
    if (hasParamedic) {
      if (cls === "Fire Engineer") {
        pensionablePct += 0.05;
        breakdown.push({ label: "Paramedic Incentive (FE)", pct: 0.05, pensionable: true });
      } else if (cls === "Fire Captain" && !hasEngineBoss) {
        // Captain Paramedic — ceases 1/9/2027, exclusive with Engine Boss
        if (retD < CAPTAIN_INCENTIVE_CEASE_DATE) {
          pensionablePct += 0.05;
          breakdown.push({ label: "Paramedic Incentive (Capt, ceases 1/9/2027)", pct: 0.05, pensionable: true });
        }
      }
    }
    // ENGINE BOSS (Article X.B.2.a) — Captain only, exclusive with Paramedic, ceases 1/9/2027
    if (hasEngineBoss && cls === "Fire Captain" && !hasParamedic) {
      if (retD < CAPTAIN_INCENTIVE_CEASE_DATE) {
        pensionablePct += 0.05;
        breakdown.push({ label: "Engine Boss NWCG (ceases 1/9/2027)", pct: 0.05, pensionable: true });
      }
    }
    // HAZMAT (Article VI.E)
    if (hasHazmat) {
      const hPct = hazmatLevel === "taskforce" ? 0.05 : 0.025;
      pensionablePct += hPct;
      breakdown.push({ label: `Hazmat (${hazmatLevel === "taskforce" ? "Task Force" : "Team"})`, pct: hPct, pensionable: true });
    }
    // RESCUE (Article VI.F)
    if (hasRescue) {
      const rPct = rescueLevel === "taskforce" ? 0.05 : 0.025;
      pensionablePct += rPct;
      breakdown.push({ label: `Rescue (${rescueLevel === "taskforce" ? "Task Force" : "Team"})`, pct: rPct, pensionable: true });
    }
    // FIRE INVESTIGATION (Article VI.G)
    if (hasInvestigation) {
      const iPct = investigationLevel === "lead" ? 0.05 : 0.025;
      pensionablePct += iPct;
      breakdown.push({ label: `Fire Investigation (${investigationLevel === "lead" ? "Lead" : "Team"})`, pct: iPct, pensionable: true });
    }
    return {
      pensionablePct, nonPensionablePct,
      pensionableAmt: base * pensionablePct,
      nonPensionableAmt: base * nonPensionablePct,
      totalIncentivePct: pensionablePct + nonPensionablePct,
      totalIncentiveAmt: base * (pensionablePct + nonPensionablePct),
      breakdown,
    };
  }, [hasBachelor, hasAssociate, hasEngineerCert, hasCompanyOfficer, hasChiefFireOfficer,
    hasEngineBoss, hasFFII, hasParamedic, hasRescue, rescueLevel,
    hasHazmat, hazmatLevel, hasInvestigation, investigationLevel, retirementDate]);
  // Incentives and pension base use PROJECTED salary at retirement (captures future raises + rank sep)
  const incentives = calcIncentives(projectedBaseSalary, classification, memberType, yearsOfService, retirementDate, hireYear);
  const currentIncentives = calcIncentives(baseSalary, classification, memberType, currentServiceYears, NOW, hireYear);
  // Incentives being paid today that will not be in the final compensation period.
  const ceasingIncentives = currentIncentives.breakdown.filter(c =>
    !c.note && !incentives.breakdown.some(r => r.label === c.label));
  // Retirement-time pensionable compensation
  const cashPensionable = projectedBaseSalary + incentives.pensionableAmt;
  const cashNonPensionable = incentives.nonPensionableAmt;
  const cashComp = cashPensionable + cashNonPensionable;
  // Sick-leave cash-out hourly rate — per MOU/Treasurer: BASE hourly + longevity ONLY
  // (no incentives), on the 56-hr shift basis (÷242.67, matching the official schedule's
  // hourly column). Gross = hours × this rate, then the tier % (e.g. 60%) is applied.
  const sickLeaveHourlyRate = (projectedBaseSalary * (1 + (showLongevity ? LONGEVITY(yearsOfService) : 0))) / FLSA_56HR_MONTHLY_HOURS;
  const sickLeaveHourlyRateToday = (baseSalary * (1 + (showLongevity ? LONGEVITY(currentServiceYears) : 0))) / FLSA_56HR_MONTHLY_HOURS;
  // Every hourly rate for a given calendar year: the year's base (MOU raises + rank
  // separation), the incentives in force that year (Captain Paramedic and Engine Boss end
  // 1/9/2027), and the longevity tier reached by then.
  const ratesForYear = (y) => {
    const base = projectedBaseForYear(y);
    const yosThen = Math.max(0, yearsOfService - (retirementYear - y));
    const midYear = new Date(y, 6, 1);
    const inc = calcIncentives(base, classification, memberType, yosThen, midYear, hireYear);
    const lon = showLongevity ? LONGEVITY(yosThen) : 0;
    const baseHourly = base / FLSA_56HR_MONTHLY_HOURS;
    const regular = (base * (1 + inc.totalIncentivePct)) / FLSA_56HR_MONTHLY_HOURS;
    const baseLonHourly = (base * (1 + lon)) / FLSA_56HR_MONTHLY_HOURS;
    return { year: y, base, baseHourly, regular, flsaOT: regular * 1.5,
      contractOT: baseLonHourly * 1.5, cashOut: baseLonHourly, inc, yosThen,
      incentivePct: inc.totalIncentivePct, longevityPct: lon,
      rankSepApplied: y >= 2027 && (classification === "Fire Engineer" || classification === "Fire Captain"),
      studyAssumed: y >= 2028 && (parseFloat(lmaPct) || 0) > 0 };
  };
  const rateYearOptions = (() => {
    const out = [];
    const last = Math.max(NOW.getFullYear(), retirementYear, MOU_TERM_END_YEAR);
    for (let y = NOW.getFullYear(); y <= last; y++) out.push(y);
    return out;
  })();
  const compDefaultYear = rateYearOptions.indexOf(retirementYear) !== -1 ? retirementYear : NOW.getFullYear();
  const shownRateYear = (rateYearPicked && rateYearOptions.indexOf(rateYear) !== -1)
    ? rateYear : compDefaultYear;
  const shownRates = ratesForYear(shownRateYear);
  // Holiday pay (Classic only, pensionable) — based on projected salary
  const holidayPayMonthly = memberType === "classic"
    ? (projectedBaseSalary / FLSA_56HR_MONTHLY_HOURS * (1 + (showLongevity ? LONGEVITY(yearsOfService) : 0))) * HOLIDAY_HOURS / 12
    : 0;
  // Same figure on TODAY'S base, for the Current compensation page. MOU Ch.3 Art.II.C:
  // holiday pay = (base hourly rate + longevity hourly rate) × holiday hours, straight time.
  const holidayPayMonthlyNow = memberType === "classic"
    ? (baseSalary / FLSA_56HR_MONTHLY_HOURS * (1 + (showLongevity ? LONGEVITY(yearsOfService) : 0))) * HOLIDAY_HOURS / 12
    : 0;
  // Uniform allowance (Classic only, pensionable)
  const uniformMonthly = memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0;
  // FLSA OT — special comp, pensionable for Classic only (~2% of base), NOT PEPRA
  const flsaOTPensionableMonthly = memberType === "classic" ? projectedBaseSalary * FLSA_OT_PENSIONABLE_PCT : 0;
  const totalPensionableMonthly = cashPensionable + holidayPayMonthly + uniformMonthly + flsaOTPensionableMonthly;
  // ── FINAL COMPENSATION ───────────────────────────────────────────────────
  // Classic: ONE-YEAR final compensation. Roseville's CalPERS contract para 11.h elects
  //   Gov Code Sec 20042 (One-Year Final Compensation) "for classic members only".
  // PEPRA: Gov Code Sec 7522.32 — "the highest average annual pensionable compensation
  //   earned by the member during a period of at least 36 consecutive months". Not electable.
  // The three-year average matters most right now: the MOU stacks large increases in
  // 3/2026, 1/2027 and 1/2028, so a PEPRA member's last year sits well above their average.
  const pensionableForYear = (y) => {
    const b = projectedBaseForYear(y);
    const yrsAtThatPoint = Math.max(0, yearsOfService - (retirementYear - y));
    const dateThatYear = new Date(y, retMonthNum - 1, retDayNum);
    const inc = calcIncentives(b, classification, memberType, yrsAtThatPoint, dateThatYear, hireYear);
    const lon = (memberType === "classic" && showLongevity) ? LONGEVITY(yrsAtThatPoint) : 0;
    const hol = memberType === "classic" ? (b / FLSA_56HR_MONTHLY_HOURS * (1 + lon)) * HOLIDAY_HOURS / 12 : 0;
    const uni = memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0;
    const flsa = memberType === "classic" ? b * FLSA_OT_PENSIONABLE_PCT : 0;
    return b + inc.pensionableAmt + hol + uni + flsa;
  };
  const FINAL_COMP_MONTHS_PEPRA = 36;
  const finalCompMonthly = memberType === "classic"
    ? totalPensionableMonthly
    : (pensionableForYear(retirementYear) + pensionableForYear(retirementYear - 1) + pensionableForYear(retirementYear - 2)) / 3;
  // How much the 36-month rule costs a PEPRA member versus using the final year alone.
  const finalCompAveragingDrag = Math.max(0, totalPensionableMonthly - finalCompMonthly);
  // ── SICK LEAVE AT RETIREMENT ────────────────────────────────────
  // One member-supplied figure. Nothing is projected from today's balance: accruing 144 hrs/yr and
  // using none is a ceiling, not a forecast, and the tool used to present it as fact.
  const sickLeaveHours = Math.max(0, parseFloat(currentSickLeaveHours) || 0);
  const sickHoursToday = sickLeaveHours;   // kept for the summary rows that read it
  // ── SICK LEAVE CONVERSION (CalPERS Gov Code 20862.8 + MOU Ch3 Art III) ─────
  const sickLeaveMaxCreditYears = sickLeaveHours / SICK_LEAVE_HOURS_PER_YEAR_CREDIT;
  // Cash or credit, never both with the same hour.
  const sickLeaveCreditYears = sickLeaveDisposition === "credit" ? sickLeaveMaxCreditYears : 0;
  const sickLeaveHoursToCredit = sickLeaveCreditYears * SICK_LEAVE_HOURS_PER_YEAR_CREDIT;
  const sickLeaveHoursToCash = Math.max(0, sickLeaveHours - sickLeaveHoursToCredit);
  // Effective YOS used for pension % (base + credit). Other things (longevity, etc.) use base only.
  const airtimeYears = Math.min(5, Math.max(0, parseFloat(airtime) || 0)); // purchased service credit, capped at CalPERS max 5 yrs
  // CALENDAR service (yearsOfService) still drives longevity, the Service Term Bonus and
  // retiree-medical vesting — the MOU writes those in years of City employment.
  // CalPERS SERVICE CREDIT drives the pension. They are different numbers and the tool now
  // keeps them apart. If the member supplies their myCalPERS figure we use it and add the
  // time they have left to work; otherwise we fall back to estimating from the hire date.
  const usingCalpersCredit = (parseFloat(calpersCreditRoseville) || 0) > 0;
  // Service still to be earned runs from the myCalPERS "Last reported" date to retirement.
  const calpersAsOfDate = /^\d{4}-\d{2}-\d{2}$/.test(calpersCreditAsOf || "")
    ? new Date(parseInt(calpersCreditAsOf.slice(0, 4), 10), parseInt(calpersCreditAsOf.slice(5, 7), 10) - 1, parseInt(calpersCreditAsOf.slice(8, 10), 10))
    : NOW;
  const serviceStillToEarn = Math.max(0, (retirementDate - calpersAsOfDate) / MS_PER_YEAR);
  const rosevilleServiceForPension = usingCalpersCredit
    ? (parseFloat(calpersCreditRoseville) || 0) + serviceStillToEarn
    : yearsOfService;
  // myCalPERS already folds purchased credit into the employer lines, so only add airtime
  // separately when the member is NOT working from that figure.
  const airtimeCountedSeparately = usingCalpersCredit && calpersCreditIncludesPurchased ? 0 : airtimeYears;
  const yearsOfServiceForPension = rosevilleServiceForPension + sickLeaveCreditYears + airtimeCountedSeparately;
  // Roseville per-year factor (Classic multiplier or PEPRA age factor).
  const rosevilleFactor = memberType === "classic"
    ? CLASSIC_MULTIPLIER
    : Math.min(retireAgeQ >= 57 ? 0.027 : 0.020 + (retireAgeQ - 50) * (0.007 / 7), 0.027);
  // CalPERS service is grouped BY FORMULA. Service under the SAME formula as Roseville consolidates
  // into one bucket under a single 90% cap. Service under a DIFFERENT CalPERS formula (e.g., CalFire
  // 3%@55) is its own bucket with its own cap, on the SAME final comp, and STACKS on top — so the
  // combined CalPERS allowance can exceed 90% (matches member CalPERS estimates).
  const rosevilleFormulaKey = memberType === "classic" ? "3@50" : "2.7@57";
  const sameFormulaPriorPct = priorService.reduce((s, r) =>
    (isCalpersFormula(r.formula) && r.formula === rosevilleFormulaKey)
      ? s + Math.max(0, parseFloat(r.years) || 0) * priorYearFactor(r.formula, r.manualFactor, retireAgeQ) : s, 0);
  // Roseville bucket %, capped only if this FORMULA has a cap (Classic 90%; PEPRA none).
  const benefitMaxPct = formulaMaxPct(rosevilleFormulaKey);
  const benefitIsCapped = Number.isFinite(benefitMaxPct);
  const pensionPct = Math.min(yearsOfServiceForPension * rosevilleFactor + sameFormulaPriorPct, benefitMaxPct);
  // Other-CalPERS-formula buckets — each capped at 90% on its own, then summed (rarely binds).
  const otherCalpersFormulaPct = priorService.reduce((s, r) =>
    (isCalpersFormula(r.formula) && r.formula !== rosevilleFormulaKey)
      ? s + Math.min(Math.max(0, parseFloat(r.years) || 0) * priorYearFactor(r.formula, r.manualFactor, retireAgeQ), formulaMaxPct(r.formula)) : s, 0);
  // Total CalPERS % paid as ONE allowance (Roseville bucket + other-formula buckets stacked).
  const calpersTotalPct = pensionPct + otherCalpersFormulaPct;
  // Itemized CalPERS service components contributing toward the 90% cap (for display).
  const calpersComponents = [
    { label: "Roseville Fire", yrs: rosevilleServiceForPension, factor: rosevilleFactor },
    ...(airtimeCountedSeparately > 0 ? [{ label: "Purchased service credit (airtime)", yrs: airtimeCountedSeparately, factor: rosevilleFactor }] : []),
    ...(sickLeaveCreditYears > 0 ? [{ label: "Sick-leave service credit", yrs: sickLeaveCreditYears, factor: rosevilleFactor }] : []),
    ...priorService.filter(r => isCalpersFormula(r.formula) && r.formula === rosevilleFormulaKey).map(r => ({
      label: (r.agencyName && r.agencyName.trim()) ? r.agencyName.trim() : ((PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "CalPERS service"),
      formulaLabel: (PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label,
      yrs: Math.max(0, parseFloat(r.years) || 0),
      factor: priorYearFactor(r.formula, r.manualFactor, retireAgeQ),
    })),
  ].map(c => ({ ...c, pct: c.yrs * c.factor }));
  const calpersRawPct = calpersComponents.reduce((s, c) => s + c.pct, 0);
  const calpersOverCap = benefitIsCapped && calpersRawPct > benefitMaxPct + 1e-9;
  const surplusYearsOverCap = calpersOverCap && rosevilleFactor > 0
    ? (calpersRawPct - benefitMaxPct) / rosevilleFactor : 0;
  // PEPRA caps the pensionable compensation the pension is figured on; Classic is not capped this way.
  const pensionableForPension = memberType === "pepra" ? Math.min(finalCompMonthly, peraCapMonthly) : finalCompMonthly;
  const peraCapApplies = memberType === "pepra" && finalCompMonthly > peraCapMonthly;
  const pension50Monthly = pensionableForPension * pensionPct;     // Roseville-formula bucket (capped at 90%)
  // Option 1 / Unmodified — the maximum CalPERS will pay, and the figure myCalPERS quotes first.
  const monthlyPensionUnmodified = pensionableForPension * calpersTotalPct;
  // ── SURVIVOR CONTINUANCE AND THE OPTION ELECTION ─────────────────────────
  // Two different things that members constantly conflate. Survivor continuance is a STATUS —
  // employer-paid, half the unmodified allowance, the same under every option, costing nothing.
  // The option election is a PURCHASE — you take a smaller check to leave a continuing allowance.
  // A spouse who is both gets both, and they add. See the verified table at the top of this file.
  const effectiveBeneficiaryAge = beneficiaryAge > 0 ? beneficiaryAge : retirementAge;
  const survivorContinuance = hasEligibleSurvivor ? monthlyPensionUnmodified * SURVIVOR_CONTINUANCE_PCT : 0;
  const optionPortion = monthlyPensionUnmodified - survivorContinuance;
  const mkOption = (key, label, short, benPct, popUp, note) => {
    const red = OPTION_PORTION_REDUCTION[key] || 0;
    const reducedPortion = optionPortion * (1 - red);
    const memberMonthly = key === "roc"
      ? monthlyPensionUnmodified * (1 - ROC_FULL_REDUCTION)
      : survivorContinuance + reducedPortion;
    const beneficiaryMonthly = benPct > 0 ? reducedPortion * benPct : 0;
    return {
      key, label, short, benPct, note, reduction: red,
      memberMonthly,
      beneficiaryMonthly,
      survivorMonthly: survivorContinuance,
      spouseTotal: survivorContinuance + beneficiaryMonthly,
      popUpMonthly: popUp === "unmod" ? monthlyPensionUnmodified : popUp === "same" ? memberMonthly : null,
      costMonthly: monthlyPensionUnmodified - memberMonthly,
    };
  };
  const survivorOptions = [
    mkOption("unmod", "Unmodified Allowance", "Unmodified", 0, null,
      "The largest check you can draw. Nothing continues to a named beneficiary — but your eligible survivor still receives the survivor continuance, because that is not part of this election."),
    mkOption("roc", "Return of Remaining Contributions", "Return of contributions", 0, null,
      "Your own contributions, minus what you have already drawn, paid to your beneficiary as a lump sum. It is not a monthly benefit, and the balance runs down every month you collect — once it hits zero it pays nothing."),
    mkOption("ben100", "100% Beneficiary", "100% Beneficiary", 1.00, "same",
      "Your beneficiary keeps the whole option portion for life. Paired with the survivor continuance, that means your spouse continues to receive exactly what you were receiving. If they die before you, your check stays where it is."),
    mkOption("ben100w", "100% Beneficiary w/Allowance Increase", "100% + pop-up", 1.00, "unmod",
      "Same as 100% Beneficiary, plus a hedge: if your beneficiary dies before you, your allowance jumps back up to the full Unmodified amount instead of staying reduced for the rest of your life."),
    mkOption("ben50", "50% Beneficiary", "50% Beneficiary", 0.50, "same",
      "Half the option portion continues to your beneficiary for life. Cheaper than the 100% election, and your spouse still has the survivor continuance underneath it."),
    mkOption("ben50w", "50% Beneficiary w/Allowance Increase", "50% + pop-up", 0.50, "unmod",
      "Same as 50% Beneficiary, plus the pop-up: your allowance returns to the full Unmodified amount if your beneficiary dies before you."),
  ];
  const survivorChosen = survivorOptions.find(o => o.key === survivorOption) || survivorOptions[0];
  const survivorActualNum = survivorActualPct === "" || survivorActualPct === null
    ? null : Math.max(0, Math.min(50, parseFloat(survivorActualPct) || 0));
  const usingActualOptionPct = survivorActualNum !== null && survivorOption !== "unmod";
  // The member's own allowance. A myCalPERS figure, when given, is a reduction off the UNMODIFIED
  // allowance — that is the number a member can read straight off their own estimate.
  const monthlyPension = usingActualOptionPct
    ? monthlyPensionUnmodified * (1 - survivorActualNum / 100)
    : survivorChosen.memberMonthly;
  const appliedOptionFactor = monthlyPensionUnmodified > 0 ? monthlyPension / monthlyPensionUnmodified : 1;
  const optionReductionPct = 1 - appliedOptionFactor;
  const optionCostMonthly = monthlyPensionUnmodified - monthlyPension;
  // Band, because the member's ages will differ from the estimate these factors came from.
  const optionBandLow = Math.max(0, optionReductionPct * (1 - OPTION_ESTIMATE_BAND));
  const optionBandHigh = optionReductionPct * (1 + OPTION_ESTIMATE_BAND);
  const annualPension = monthlyPension * 12;
  // What the survivor continuance pays, regardless of the election above.
  const survivorContinuanceMonthly = survivorContinuance;
  // What a named beneficiary keeps: a share of whatever option portion is left after the reduction.
  const electedOptionPortion = Math.max(0, monthlyPension - survivorContinuance);
  const beneficiaryMonthly = survivorChosen.benPct > 0 ? electedOptionPortion * survivorChosen.benPct : 0;
  // A spouse who is both the eligible survivor and the named beneficiary collects both.
  const spouseTotalMonthly = survivorContinuance + beneficiaryMonthly;
  const popUpMonthly = survivorChosen.popUpMonthly;
  // Retiree medical
  const tier4RHS = calcTier4RHS({
    hireYear, retirementYear,
    currentYear: NOW.getFullYear(),
    baseAnnualNow: baseSalary * 12,
    salaryGrowth: (parseFloat(unionRaisePct) || 0) / 100,
    annualReturn: (parseFloat(rhsReturn) || 0) / 100,
  });
  // Total CalPERS-credited service for retiree-medical vesting: Roseville + same-system CalPERS
  // prior service (e.g., CalFire). Counts once the member has ≥5 Roseville years (MOU Art II.C).
  const sameCalpersPriorYears = priorService.reduce((s, r) => isCalpersFormula(r.formula) ? s + Math.max(0, parseFloat(r.years) || 0) : s, 0);
  const totalCalpersYears = cityYOS + sameCalpersPriorYears;
  const medical = medicalTier === "4"
    ? { monthly: 0, vested: 1.0, ...tier4RHS }
    : calcRetireeMedical(medicalTier, hireYear, retirementYear, cityYOS, totalCalpersYears, atNormalRetirementAge);
  // Member-chosen plan cost breakdown (Medical tab)
  // Which rate sheet the Health care tab is showing. A year CalPERS has not published yet
  // falls back to the newest one that exists and flags itself, rather than inventing numbers.
  const healthRates = healthRatesFor(healthRateYear, MEDICAL_PLANS_BY_YEAR, HEALTH_RATE_CURRENT);
  const medicareRates = healthRatesFor(healthRateYear, MEDICARE_PLANS_BY_YEAR, HEALTH_RATE_CURRENT);
  const MEDICAL_PLANS = healthRates.plans;
  const MEDICARE_PLANS = medicareRates.plans;
  // A plan can exist in one year and not another (UnitedHealthcare left after 2026; Sutter and
  // Blue Shield EPO arrived for 2027), so say so instead of silently pricing a different plan.
  const selectedPlanMissing = !MEDICAL_PLANS.some(p => p.name === selectedMedicalPlan);
  const retireePlanMissing = !MEDICAL_PLANS.some(p => p.name === retireeMedicalPlan);
  const selectedPlanObj = MEDICAL_PLANS.find(p => p.name === selectedMedicalPlan) || MEDICAL_PLANS[0];
  const selectedPremium = selectedPlanObj[medicalCoverage] || selectedPlanObj.ee;
  const retireePlanObj = MEDICAL_PLANS.find(p => p.name === retireeMedicalPlan) || MEDICAL_PLANS[0];
  const retireePremium = retireePlanObj[retireeCoverage] || retireePlanObj.ee;
  // Roseville split-payment: City pays the PEMHCA minimum straight to CalPERS, so CalPERS deducts only
  // the remaining premium from the pension check (City reimburses the rest separately).
  const PEMHCA_MIN_MONTHLY = pemhcaMinFor(retirementYear); // CalPERS sets this annually; see PEMHCA_MIN_BY_YEAR
  const calpersMedicalDeduction = Math.max(0, retireePremium - PEMHCA_MIN_MONTHLY);
  // City medical share per MOU Ch.4 Art.I §C: up to a % of the Kaiser premium for the tier, plus
  // $180 toward dental/vision. Unused amounts are NOT paid out (§C.5) — the member pays only the overage.
  const dentalObj = DENTAL_PLANS_2026.find(p => p.name === dentalPlan) || DENTAL_PLANS_2026[0];
  const dentalPremium = dentalObj[DENTAL_TIER_FROM_MED[medicalCoverage]] || 0;
  const visionPremium = hasVision ? (VISION_2026[medicalCoverage] || 0) : 0;
  const KAISER_PLAN = MEDICAL_PLANS.find(p => p.name === "Kaiser Permanente") || {};
  const CITY_MED_PCT = { ee: 1.0, ee1: 0.85, fam: 0.80 };
  const cityMedicalMax = (CITY_MED_PCT[medicalCoverage] || 1) * (KAISER_PLAN[medicalCoverage] || 0);
  const cityMedicalPaid = Math.min(selectedPremium, cityMedicalMax);
  const medicalOOP = Math.max(0, selectedPremium - cityMedicalMax);
  const DV_CREDIT = 180;
  const dvCost = dentalPremium + visionPremium;
  const dvCityPaid = Math.min(dvCost, DV_CREDIT);
  const dvOOP = Math.max(0, dvCost - DV_CREDIT);
  const medicalTotalOOP = medicalOOP + dvOOP; // member's monthly cost from paycheck (never below $0)
  const cityBenefitTotal = cityMedicalPaid + dvCityPaid;
  // 457
  // City 3% match grows with pay: base it on the AVERAGE base over the career (today → projected
  // base at retirement), so the match isn't frozen at today's salary.
  const avgMatchBase = (baseSalary + projectedBaseSalary) / 2;
  // City 3% match starts only after 5 years of service. Apply it only over the FUTURE years the
  // member will actually be vested — not the whole projection (prior bug counted it from day one
  // whenever they'd hit 5 years by retirement).
  const yearsUntilMatchVesting = Math.max(0, CITY_MATCH_MIN_YEARS - currentServiceYears);
  const matchedYears = Math.max(0, yearsToRetirement - yearsUntilMatchVesting);
  const cityMatchAnnual = avgMatchBase * 12 * CITY_MATCH_PCT; // City 3% — automatic once vested (5+ yrs of service)
  const cityMatchCurrentAnnual = currentServiceYears >= CITY_MATCH_MIN_YEARS ? baseSalary * 12 * CITY_MATCH_PCT : 0;
  // 457(b) COMBINED-LIMIT GUARD: in a 457(b) the City's 3% counts toward the SAME IRS annual limit
  // (NOT on top, unlike a 401k). So the member's own room = limit − City match. Cap the projection.
  // Ceiling for THIS member this year, including catch-ups. Age is taken at retirement,
  // which is the year a member near the end is actually planning for.
  const limit457ThisYear = max457For(Math.floor(retireAgeQ), normalRetirementAge, useSpecial457Catchup);
  const memberMax457 = Math.max(0, limit457ThisYear - cityMatchAnnual);
  const catchup457Available = limit457ThisYear - MAX_457_ANNUAL;
  const effectiveMember457 = Math.min(annual457Contrib, memberMax457);
  const member457OverLimit = annual457Contrib > memberMax457;
  const rate457 = returnRate / 100;
  // Member contributions + starting balance grow over the full horizon; the City match annuity
  // runs only over the vested (matched) years.
  const value457 = future457Value(current457, effectiveMember457, 0, yearsToRetirement, rate457)
    + future457Value(0, 0, cityMatchAnnual, matchedYears, rate457);
  // 457 "delay your draw": if the member starts drawing AFTER retirement, the balance keeps growing
  // at the "wait" return rate during the gap, so the eventual draw is larger and starts later.
  // Default drawStartAge=0 → effectiveDrawStartAge=retirementAge, waitYears=0 → identical to before.
  const effectiveDrawStartAge = (drawStartAge && drawStartAge > retirementAge) ? drawStartAge : retirementAge;
  const waitYears = Math.max(0, effectiveDrawStartAge - retirementAge);
  const value457AtDraw = value457 * Math.pow(1 + (Math.max(0, parseFloat(retireWaitReturnRate) || 0) / 100), waitYears);
  const monthly457 = value457AtDraw * (Math.max(0, parseFloat(retireDrawRate) || 0) / 100) / 12;
  // How long the 457 balance lasts at the chosen monthly draw and retirement-return rate.
  const retRetMonthlyRate = Math.max(0, parseFloat(retireReturnRate) || 0) / 100 / 12;
  const years457Lasts = (() => {
    const B = value457AtDraw, d = monthly457;
    if (d <= 0) return Infinity;
    if (retRetMonthlyRate <= 0) return B / (d * 12);
    if (d <= B * retRetMonthlyRate + 1e-9) return Infinity; // draw covered by growth — never depletes
    return (-Math.log(1 - (B * retRetMonthlyRate) / d) / Math.log(1 + retRetMonthlyRate)) / 12;
  })();
  // Age the 457 runs out (draws start at effectiveDrawStartAge, not retirement, when delayed).
  const depletionAge = effectiveDrawStartAge + years457Lasts;
  // Sick leave cash payout (uses hours NOT converted to credit)
  const sickLeavePayoff = calcSickLeavePayoff(sickLeaveHoursToCash, sickLeaveHourlyRate);
  // Hours the member holds that the MOU payoff table does not reach (above 2400).
  const sickLeaveHoursAbovePayCap = Math.max(0, sickLeaveHoursToCash - SICK_LEAVE_PAYOFF_MAX_HOURS);
  // Pension boost from sick leave credit (monthly)
  const sickLeaveCreditMultiplier = memberType === "classic" ? CLASSIC_MULTIPLIER :
    Math.min(retireAgeQ >= 57 ? 0.027 : 0.020 + (retireAgeQ - 50) * (0.007 / 7), 0.027);
  // Marginal value of the sick-leave credit, respecting the 90% cap (zero once already capped).
  const pensionPctNoCredit = Math.min(
    (rosevilleServiceForPension + airtimeCountedSeparately) * sickLeaveCreditMultiplier + sameFormulaPriorPct,
    benefitMaxPct);
  const sickLeavePensionBoostMonthly = pensionableForPension * Math.max(0, pensionPct - pensionPctNoCredit);
  // Alternate values shown side-by-side for member comparison
  const altCashIfAllCash = calcSickLeavePayoff(sickLeaveHours, sickLeaveHourlyRate);
  // "All credit" comparison — marginal pension % gain over base service, respecting the 90% cap.
  const altPctAllCredit = Math.min(
    (rosevilleServiceForPension + airtimeCountedSeparately + sickLeaveMaxCreditYears) * sickLeaveCreditMultiplier + sameFormulaPriorPct,
    benefitMaxPct);
  const altCreditIfAllCredit = Math.max(0, altPctAllCredit - pensionPctNoCredit);
  const altCreditMonthlyIfAllCredit = pensionableForPension * altCreditIfAllCredit;
  // Prior agency pension(s) from reciprocity — each prior system pays its own check.
  // Per row: (final comp monthly) × (years there) × (that formula's age factor), capped at 90%.
  // Reciprocity "highest-comp" rule: default the comp base to the Roseville pensionable pay.
  // Three buckets:
  //  • Same-formula CalPERS (matches Roseville) — inside the shared 90% bucket; shown for breakdown only (monthly:0).
  //  • Other-formula CalPERS (e.g., CalFire 3%@55) — its OWN 90% cap, SAME final comp, STACKS on top
  //    of the 90% as part of the single CalPERS allowance.
  //  • True reciprocity (LACERA/'37 Act, CalSTRS, FERS) — a SEPARATE system paying its OWN check.
  const priorServiceCalc = priorService.map(r => {
    const calpers = isCalpersFormula(r.formula);
    const sameFormula = calpers && r.formula === rosevilleFormulaKey;
    const otherCalpers = calpers && !sameFormula;
    const yrs = Math.max(0, parseFloat(r.years) || 0);
    const factor = priorYearFactor(r.formula, r.manualFactor, retireAgeQ);
    const compMonthly = calpers ? pensionableForPension
      : (r.useRosevilleComp !== false ? totalPensionableMonthly : (parseFloat(r.customComp) || 0));
    const pct = sameFormula ? yrs * factor : Math.min(yrs * factor, formulaMaxPct(r.formula));
    const monthly = sameFormula ? 0 : compMonthly * pct;
    return { ...r, calpers, sameFormula, otherCalpers, compMonthly, yrs, factor, pct, monthly };
  });
  // Separate reciprocal checks only (CalPERS rows — same- and other-formula — are inside monthlyPension).
  const priorPensionMonthly = priorServiceCalc.filter(r => !r.calpers).reduce((s, r) => s + r.monthly, 0);
  // Headline = full CalPERS allowance (90% bucket + stacked other-formula) + reciprocal checks.
  // Prior-agency checks come from their own systems with their own option elections, so the
  // CalPERS option factor is not applied to them.
  const combinedPensionUnmodified = monthlyPensionUnmodified + priorPensionMonthly;
  const combinedPensionMonthly = monthlyPension + priorPensionMonthly;
  const priorTotalYears = priorServiceCalc.reduce((s, r) => s + r.yrs, 0);
  // What myCalPERS would show today: Roseville credit + every CalPERS prior-agency line.
  const calpersTotalToday = (usingCalpersCredit ? (parseFloat(calpersCreditRoseville) || 0) : Math.max(0, currentServiceYears))
    + priorService.reduce((a, r) => isCalpersFormula(r.formula) ? a + (Math.max(0, parseFloat(r.years) || 0)) : a, 0);
  // Unified % view: reciprocal rows on Roseville comp stack on top of the full CalPERS %.
  const priorPctOnRoseComp = priorServiceCalc.filter(r => !r.calpers && r.useRosevilleComp !== false).reduce((s, r) => s + r.pct, 0);
  const combinedPensionPct = calpersTotalPct + priorPctOnRoseComp;
  const combinedPctLabel = priorPctOnRoseComp > 0
    ? `${pct(calpersTotalPct)} CalPERS + ${pct(priorPctOnRoseComp)} reciprocal = ${pct(combinedPensionPct)}`
    : pct(calpersTotalPct);
  // Total retirement income
  // Total retirement income. The City's retiree-medical contribution is NOT income: it only exists if you
  // enroll in CalPERS medical and it is paid straight to the premium. It appears as an out-of-pocket cost below.
  const totalMonthly = monthlyPension + monthly457 + priorPensionMonthly;
  const totalAnnual = totalMonthly * 12;
  // vs current — use today's base salary (not projected) for the take-home comparison
  const currentMonthlySalary = baseSalary * (1 + currentIncentives.totalIncentivePct);
  // CalPERS member contribution is on TODAY'S pensionable comp (so the take-home comparison is today-vs-today, not today-minus-projected).
  const currentLongevityPct = (memberType === "classic" && showLongevity) ? LONGEVITY(currentServiceYears) : 0;
  const currentPensionableMonthly =
    baseSalary * (1 + currentIncentives.pensionablePct)
    + (memberType === "classic" ? (baseSalary / FLSA_56HR_MONTHLY_HOURS) * (1 + currentLongevityPct) * HOLIDAY_HOURS / 12 : 0)
    + (memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0)
    + (memberType === "classic" ? baseSalary * FLSA_OT_PENSIONABLE_PCT : 0);
  const employeeCalPERSContrib = currentPensionableMonthly * (memberType === "classic" ? 0.09 : 0.115);
  // Holiday pay, the uniform allowance and FLSA scheduled overtime are real cash, paid every year
  // and reported to CalPERS — but "salary" here only ever meant base + incentives, so all three were
  // missing from every working figure in the tool. That made working pay read about $1,200/mo light
  // against a pension figured on compensation that DID include them.
  const workingExtrasMonthly = holidayPayMonthlyNow + uniformMonthly
    + (memberType === "classic" ? baseSalary * FLSA_OT_PENSIONABLE_PCT : 0);
  // Everything Roseville pays you in a month before overtime — the same total the Current
  // compensation table adds up, minus the overtime row.
  const workingGrossNoOT = currentMonthlySalary + workingExtrasMonthly;
  const currentTakeHome = workingGrossNoOT - employeeCalPERSContrib - (effectiveMember457 / 12) - UNION_DUES_MONTHLY - medicalTotalOOP;
  const retirementVsWorking = totalMonthly / workingGrossNoOT;
  // Retirement income deflated to TODAY'S purchasing power (projection is in retirement-year dollars).
  const totalMonthlyTodayDollars = totalMonthly / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement);
  // ── OVERTIME (FLSA regular-rate method) ─────────────────────────────────
  const otHoursMonthly = Math.max(0, parseFloat(currentOTHours) || 0);
  const flsaRegularHourly = currentMonthlySalary / FLSA_56HR_MONTHLY_HOURS;     // base + incentives
  const otHourlyRate = flsaRegularHourly * 1.5;                                 // time-and-a-half
  const otMonthly = otHoursMonthly * otHourlyRate;
  const salaryWithOT = workingGrossNoOT + otMonthly;
  // ── WORKING PAY FOR ANY YEAR — ONE SOURCE ────────────────────────────────
  // The Current compensation table and the sticky header both read this. They used to build
  // the same total two different ways and disagreed by $1,192/mo. Never again: if this is
  // wrong, it is wrong in both places at once, and a test catches it.
  const workingPayForYear = (y) => {
    const R = ratesForYear(y);
    const H = FLSA_56HR_MONTHLY_HOURS;
    // calcIncentives folds longevity INTO totalIncentivePct, so pull it back out before
    // giving longevity its own line — otherwise it is counted twice.
    const lonPct = R.inc.breakdown.filter(b => !b.note && /^Longevity/.test(b.label))
      .reduce((t, b) => t + (b.pct || 0), 0);
    const specialtyPct = Math.max(0, R.incentivePct - lonPct);
    const holiday = memberType === "classic" ? (R.base / H) * (1 + lonPct) * HOLIDAY_HOURS / 12 : 0;
    const uniform = memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0;
    const flsa = memberType === "classic" ? R.base * FLSA_OT_PENSIONABLE_PCT : 0;
    const ot = otHoursMonthly * R.flsaOT;
    const pensionable = R.base * (1 + R.incentivePct) + holiday + uniform + flsa;
    return { R, H, lonPct, specialtyPct, holiday, uniform, flsa, ot, pensionable, gross: pensionable + ot };
  };
  const longevityMonthlyNow = (memberType === "classic" && showLongevity) ? baseSalary * LONGEVITY(yearsOfService) : 0;
  const contractOTHourly = ((baseSalary + longevityMonthlyNow) / FLSA_56HR_MONTHLY_HOURS) * 1.5;
  // ── INCOME TAX (estimate) — separate household for working vs. retirement ──
  const fedBrW = FED_BRACKETS_2026[filingStatus], caBrW = CA_BRACKETS_2025[filingStatus];
  const fedStdW = FED_STD_2026[filingStatus], caStdW = CA_STD_2025[filingStatus];
  const fedBrR = FED_BRACKETS_2026[filingStatusRet], caBrR = CA_BRACKETS_2025[filingStatusRet];
  const fedStdR = FED_STD_2026[filingStatusRet], caStdR = CA_STD_2025[filingStatusRet];
  const otherIncomeW = Math.max(0, parseFloat(otherIncome) || 0);
  const otherIncomeR = Math.max(0, parseFloat(otherIncomeRet) || 0);
  const depCreditW = (parseInt(dependents, 10) || 0) * 2200;
  const depCreditR = (parseInt(dependentsRet, 10) || 0) * 2200;
  const fedTaxAmt = (gross, preTax, br, std, dep) => Math.max(0, calcBracketTax(Math.max(0, gross - preTax - std), br) - dep);
  const stateName = (STATES_LIST.find(s => s.code === retirementState) || {}).name || retirementState;
  // Working scenarios: California, working household, + 1.45% Medicare on wages.
  const taxScenario = (wages, preTax, payroll) => {
    const gross = wages + otherIncomeW;
    const tax = fedTaxAmt(gross, preTax, fedBrW, fedStdW, depCreditW) + calcBracketTax(Math.max(0, gross - preTax - caStdW), caBrW) + (payroll ? wages * 0.0145 : 0);
    return { gross, tax, net: gross - tax };
  };
  const workPreTax = effectiveMember457 + employeeCalPERSContrib * 12;
  const taxSalary = taxScenario(currentMonthlySalary * 12, workPreTax, true);
  const taxSalaryOT = taxScenario(salaryWithOT * 12, workPreTax, true);
  // Additional retirement income (annual gross) — IRA/investment, rental, business, and spouse/other.
  // By default this does NOT affect the page-one decision; it only folds in when foldExtraIncome is on.
  const extraIncomeAnnual = (parseFloat(retIra) || 0) + (parseFloat(retRental) || 0) + (parseFloat(retBusiness) || 0) + (parseFloat(otherIncomeRet) || 0);
  // Retirement scenario: retirement household + chosen state. CA/SC/MT/HI use real brackets/exemptions.
  // PAGE-ONE base = pension + 457 only by default; extra income counts only when folded in.
  // Tax what we actually count. The 457 draw is only income here when the member has opted to
  // fold it in — otherwise taxing it would raise the rate on a pension standing alone, which is
  // how the headline take-home quietly moved when someone changed their 457 contribution.
  const retGrossTax = (combinedPensionMonthly + (include457InTakeHome ? monthly457 : 0)) * 12
    + (foldExtraIncome ? extraIncomeAnnual : 0);
  const ret457AndOther = monthly457 * 12 + (foldExtraIncome ? extraIncomeAnnual : 0);
  const age65 = retirementAge >= 65;
  // HELPS Act (IRC §402(l)): a retired public-safety officer may exclude up to $3,000/yr of pension used
  // for health premiums — but it is claimed at TAX FILING, not withheld by CalPERS. So it does NOT reduce
  // the monthly withholding/take-home; it's shown separately as an estimated year-end benefit only.
  const helpsExclusion = Math.min(3000, calpersMedicalDeduction * 12);
  const retFedTax = fedTaxAmt(retGrossTax, 0, fedBrR, fedStdR, depCreditR);
  const helpsFedSavings = retGrossTax > 0 ? helpsExclusion * (retFedTax / retGrossTax) : 0;
  const retStateTax =
    retirementState === "CA" ? calcBracketTax(Math.max(0, retGrossTax - caStdR), caBrR) :
      retirementState === "SC" ? calcBracketTax(Math.max(0, retGrossTax - (age65 ? 10000 : 3000)), SC_BRACKETS) :
        retirementState === "MT" ? calcBracketTax(Math.max(0, retGrossTax - 5500), MT_BRACKETS) :
          retirementState === "HI" ? calcBracketTax(Math.max(0, ret457AndOther - 4400), HI_BRACKETS) :
            retGrossTax * (Math.max(0, parseFloat(otherStateRate) || 0) / 100);
  const retTaxAnnual = retFedTax + retStateTax;
  const caRetStateTax = calcBracketTax(Math.max(0, retGrossTax - caStdR), caBrR); // what CA would tax
  const stateVsCa = caRetStateTax - retStateTax; // + = annual savings vs. California
  const taxRetire = { gross: retGrossTax, tax: retTaxAnnual, net: retGrossTax - retTaxAnnual };
  const workTaxAnnual = taxSalary.tax;
  const workEffRate = taxSalary.gross > 0 ? taxSalary.tax / taxSalary.gross : 0;
  const retEffRate = taxRetire.gross > 0 ? taxRetire.tax / taxRetire.gross : 0;
  // ── ALWAYS-FULL household income & tax (All Income & Tax tab) ──────────────
  // Independent of foldExtraIncome — always counts every source. Does NOT feed page one.
  const retGrossTaxAll = (combinedPensionMonthly + monthly457) * 12 + extraIncomeAnnual;
  const ret457AndOtherAll = monthly457 * 12 + extraIncomeAnnual;
  const retFedTaxAll = fedTaxAmt(retGrossTaxAll, 0, fedBrR, fedStdR, depCreditR);
  const retStateTaxAll =
    retirementState === "CA" ? calcBracketTax(Math.max(0, retGrossTaxAll - caStdR), caBrR) :
      retirementState === "SC" ? calcBracketTax(Math.max(0, retGrossTaxAll - (age65 ? 10000 : 3000)), SC_BRACKETS) :
        retirementState === "MT" ? calcBracketTax(Math.max(0, retGrossTaxAll - 5500), MT_BRACKETS) :
          retirementState === "HI" ? calcBracketTax(Math.max(0, ret457AndOtherAll - 4400), HI_BRACKETS) :
            retGrossTaxAll * (Math.max(0, parseFloat(otherStateRate) || 0) / 100);
  const retTaxAnnualAll = retFedTaxAll + retStateTaxAll;
  const retNetAll = retGrossTaxAll - retTaxAnnualAll;
  // Extra income net per month, folded into page one only when the opt-in box is on.
  const extraNetMonthly = foldExtraIncome ? extraIncomeAnnual * (1 - retEffRate) / 12 : 0;
  const cityAllowance = medical.monthly; // City retiree-medical allowance from the existing hire-date tier model
  const pensionTakeHome = Math.max(0, monthlyPension * (1 - retEffRate) - calpersMedicalDeduction);
  // Separate City reimbursement check = the City's allowance (up to the premium) minus the $162 it already sent CalPERS.
  const cityMedicalCheck = Math.max(0, Math.min(cityAllowance, retireePremium) - PEMHCA_MIN_MONTHLY);
  // City's TOTAL toward the premium = the PEMHCA minimum it pays CalPERS directly + the separate check.
  // For Tier 4 (no allowance) or any tier whose allowance is under the $162 minimum, this is still $162 —
  // which is why out-of-pocket must net against this, not against the raw tier allowance.
  const cityMedicalContribution = PEMHCA_MIN_MONTHLY + cityMedicalCheck;
  // Retiree out-of-pocket medical — the member pays only what the City's contribution doesn't cover.
  const retireeMedicalOOP = Math.max(0, retireePremium - cityMedicalContribution);
  // Total cash actually deposited each month = PERS direct deposit + the separate City medical reimbursement
  // check + (only when folded in) the net of any extra household income.
  // The headline retirement figure is the PENSION, full stop. A 457 draw is money you choose to
  // start when you choose to start it — folding it in makes the pension look bigger than it is.
  // The 457 has its own projections under More › Other income & tax.
  const totalMonthlyTakeHome = pensionTakeHome + cityMedicalCheck + extraNetMonthly;
  // ── Balancing ledger (Retirement summary): total money in resolves into money kept + money paid out, nets to $0.
  const ledgerExtraIncome = foldExtraIncome ? extraIncomeAnnual / 12 : 0;
  const ledgerTotalIncome = monthlyPension + monthly457 + ledgerExtraIncome;
  const ledger457TakeHome = monthly457 * (1 - retEffRate);
  const ledgerTax = (monthlyPension + monthly457 + ledgerExtraIncome) * retEffRate;
  // One deposit line = PERS check + the separate City medical reimbursement, already net of what CalPERS withholds
  // for the premium. Paired with retireeMedicalOOP on the outflow side, the ledger still nets to $0.
  const ledgerPensionDeposit = pensionTakeHome + cityMedicalCheck;
  const ledgerBalance = ledgerTotalIncome - ledgerPensionDeposit - ledger457TakeHome - extraNetMonthly - ledgerTax - retireeMedicalOOP;
  // True working take-home: base + incentives + your overtime, net of income tax (on salary+OT) and the
  // deductions already in currentTakeHome (PERS, 457, dues, medical). Overtime ends at retirement.
  const workingTakeHome = Math.max(0, currentTakeHome + otMonthly - taxSalaryOT.tax / 12);
  // ── THE HEADER'S "WHILE WORKING" PAIR ────────────────────────────────────
  // Follows the Current compensation year picker, so the biggest number on the screen moves
  // when a member clicks 2027 or 2028. Clamped at the retirement year: past that they are not
  // working, and the retired half of the header is pinned there, so the two would be comparing
  // different years. Deductions scale the way they really do — the CalPERS member rate is a
  // percentage of that year's pensionable pay; dues, 457 and medical are flat.
  const headerWorkYear = retirementYear ? Math.min(shownRateYear, retirementYear) : shownRateYear;
  const headerWorkClamped = retirementYear > 0 && shownRateYear > retirementYear;
  const headerPay = workingPayForYear(headerWorkYear);
  const headerCalPERSContrib = headerPay.pensionable * (memberType === "classic" ? 0.09 : 0.115);
  const headerPreTax = effectiveMember457 + headerCalPERSContrib * 12;
  const headerWorkTakeHome = Math.max(0, headerPay.gross - headerCalPERSContrib
    - (effectiveMember457 / 12) - UNION_DUES_MONTHLY - medicalTotalOOP
    - taxScenario(headerPay.gross * 12, headerPreTax, true).tax / 12);
  // ── WHAT YOU WALK AWAY FROM ──────────────────────────────────────────────
  // The paycheck you give up is the one you will be drawing in YOUR LAST YEAR, not the one you
  // draw today. Comparing a 2028 pension against 2026 wages flattered retirement by every raise
  // in between. Built the same way as the header's working pair: that year's pensionable pay and
  // overtime, less that year's CalPERS contribution, 457, dues and medical, less income tax.
  // Simplification, same as the header: dues, 457 and medical are held flat in today's dollars.
  // Monthly take-home from WORKING in any given year: that year's pensionable pay and overtime,
  // less that year's CalPERS contribution, 457, dues and medical, less income tax. Dues, 457 and
  // medical are held flat in today's dollars — the same simplification the header makes.
  const workingTakeHomeForYear = (y) => {
    const P = workingPayForYear(y);
    const contrib = P.pensionable * (memberType === "classic" ? 0.09 : 0.115);
    const preTax = effectiveMember457 + contrib * 12;
    return Math.max(0, P.gross - contrib - (effectiveMember457 / 12) - UNION_DUES_MONTHLY - medicalTotalOOP
      - taxScenario(P.gross * 12, preTax, true).tax / 12);
  };
  // Same figure with inflation taken back out, so it can be set against a pension figure that
  // has already been deflated to today's dollars.
  const workingTakeHomeTodayFor = (y) => workingTakeHomeForYear(y)
    / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, Math.max(0, y - NOW.getFullYear()));
  const finalWorkYear = retirementYear || NOW.getFullYear();
  const finalYearPay = workingPayForYear(finalWorkYear);
  const finalYearTakeHome = workingTakeHomeForYear(finalWorkYear);
  const finalYearOTMonthly = finalYearPay.ot;
  // Decision-maker: gain/loss in monthly take-home from retiring (nominal, and in today's dollars).
  const retireTakeHomeToday = totalMonthlyTakeHome / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement);
  const takeHomeDiff = totalMonthlyTakeHome - workingTakeHome;
  const takeHomeDiffToday = retireTakeHomeToday - workingTakeHome;
  // 401k equivalents
  const equiv401k_4pct = annualPension / 0.04;
  const equivFull_4pct = totalAnnual / 0.04;
  const equiv401k_3pct = annualPension / 0.03;
  // COLA
  // 3% for anyone who entered CalPERS membership before 12/16/2016, and for Classic members
  // hired on/after. 2% only for PEPRA members hired on/after. See COLA_TIER_DATE above.
  const colaRate = (hireDateObj < COLA_TIER_DATE || memberType === "classic") ? 0.03 : 0.02;
  // Realized COLA = the LESSER of the contracted cap and actual CPI. CalPERS pays up to your cap but never
  // more than inflation (a 3% cap only delivers 3% if CPI ≥ 3%); a 2% cap is limited to 2%. Stay or go
  // uses this realistic rate. (Banking of unused CPI in high-inflation years is not modeled.)
  const cpiRate = Math.max(0, parseFloat(inflationRate) || 0) / 100;
  const effectiveColaRate = Math.min(colaRate, cpiRate);
  const colaYears = [5, 10, 15, 20, 25, 30];
  // CalPERS: "COLA begins the second calendar year after retirement," effective in the May 1
  // warrant (calpers.ca.gov/retirees/cost-of-living/cola). A December 2028 retiree therefore gets
  // nothing until May 1, 2030. Counting a COLA at year one overstates the pension for life,
  // because the error compounds. colasBy() returns how many COLAs have actually landed.
  const firstColaYear = retirementYear + 2;
  const retiredOnOrAfterMay = retirementDate.getMonth() >= 4; // 0-based; 4 = May
  const colasBy = (yrsSinceRetire) => Math.max(
    0,
    (retirementYear + yrsSinceRetire) - firstColaYear + (retiredOnOrAfterMay ? 1 : 0)
  );
  // True only when the member has assumed nothing: no LMA, no bargained raises, no CPI.
  const noAssumptions = (parseFloat(unionRaisePct) || 0) === 0
    && (parseFloat(inflationRate) || 0) === 0
    && (parseFloat(lmaPct) || 0) === 0;
  // ── "WHAT IF I WAIT" ─────────────────────────────────────────────────────
  // Re-runs the pension chain for any candidate retirement year, reusing the same
  // projections, factors, caps and final-comp rules as the headline number. Tax uses the
  // effective rate computed for the selected year — close enough to rank the years, and
  // labelled as an estimate wherever it is shown.
  const projectForYear = (y) => {
    const retDate = new Date(y, retMonthNum - 1, retDayNum);
    const yos = (retDate - hireDateObj) / MS_PER_YEAR;
    if (yos <= 0) return null;
    const ageExact = dobDate ? exactAgeOn(dobDate, retDate) : retirementAge + (y - retirementYear);
    const ageQ = Math.max(0, Math.floor(ageExact * 4) / 4);
    if (ageQ < 50) return null;                 // CalPERS safety minimum retirement age
    const yrsToRet = Math.max(0, (retDate - NOW) / MS_PER_YEAR);
    // Sick leave is the member's own estimate of the balance at retirement, so it does not
    // move with the candidate year. Projecting it here would reintroduce the accrual guess.
    const slHours = sickLeaveHours;
    const slCreditYrs = sickLeaveDisposition === "credit" ? slHours / SICK_LEAVE_HOURS_PER_YEAR_CREDIT : 0;
    const slHoursCash = Math.max(0, slHours - slCreditYrs * SICK_LEAVE_HOURS_PER_YEAR_CREDIT);
    const factor = memberType === "classic" ? CLASSIC_MULTIPLIER
      : Math.min(ageQ >= 57 ? 0.027 : 0.020 + (ageQ - 50) * (0.007 / 7), 0.027);
    const priorSame = priorService.reduce((acc, r) =>
      (isCalpersFormula(r.formula) && r.formula === rosevilleFormulaKey)
        ? acc + Math.max(0, parseFloat(r.years) || 0) * priorYearFactor(r.formula, r.manualFactor, ageQ) : acc, 0);
    const priorOther = priorService.reduce((acc, r) =>
      (isCalpersFormula(r.formula) && r.formula !== rosevilleFormulaKey)
        ? acc + Math.min(Math.max(0, parseFloat(r.years) || 0) * priorYearFactor(r.formula, r.manualFactor, ageQ), formulaMaxPct(r.formula)) : acc, 0);
    const rosevilleSvc = usingCalpersCredit
      ? (parseFloat(calpersCreditRoseville) || 0) + Math.max(0, (retDate - calpersAsOfDate) / MS_PER_YEAR)
      : yos;
    const pPct = Math.min((rosevilleSvc + slCreditYrs + airtimeCountedSeparately) * factor + priorSame, benefitMaxPct);
    const fcRaw = memberType === "classic" ? pensionableForYear(y)
      : (pensionableForYear(y) + pensionableForYear(y - 1) + pensionableForYear(y - 2)) / 3;
    const capM = (PEPRA_COMP_CAP_2026 * Math.pow(1 + PEPRA_CAP_COLA, Math.max(0, y - 2026))) / 12;
    const fc = memberType === "pepra" ? Math.min(fcRaw, capM) : fcRaw;
    const pension = fc * (pPct + priorOther) * appliedOptionFactor;
    const slRate = (projectedBaseForYear(y) * (1 + (showLongevity ? LONGEVITY(yos) : 0))) / FLSA_56HR_MONTHLY_HOURS;
    const sickCash = calcSickLeavePayoff(slHoursCash, slRate);
    const med = medicalTier === "4"
      ? { monthly: 0 }
      : calcRetireeMedical(medicalTier, hireYear, y, Math.floor(yos), Math.floor(yos) + sameCalpersPriorYears, ageQ >= normalRetirementAge);
    const pemhca = pemhcaMinFor(y);
    const cityContrib = pemhca + Math.max(0, Math.min(med.monthly, retireePremium) - pemhca);
    const medOOP = Math.max(0, retireePremium - cityContrib);
    const tax = pension * retEffRate;
    const takeHome = Math.max(0, pension - tax - medOOP);
    // Same figure with inflation taken back out, so later years are comparable with today.
    const yearsOut = Math.max(0, y - NOW.getFullYear());
    const takeHomeToday = takeHome / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsOut);
    // The headline figure is the GROSS CalPERS allowance — the number myCalPERS shows — with
    // inflation taken back out so later years stay comparable with today. Tax and medical are
    // deductions from the warrant; CalPERS does not net them out and neither do we.
    const pensionToday = pension / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsOut);
    return { year: y, age: ageQ, yos, pensionPct: pPct + priorOther, finalComp: fc,
      pension, pensionToday, tax, medOOP, takeHome, takeHomeToday, sickCash, slCreditYrs, slHours,
      atCap: benefitIsCapped && pPct >= benefitMaxPct - 1e-9 };
  };
  const retireYearOptions = (() => {
    // Start at the first year the member can actually draw a benefit (safety minimum age 50),
    // not at today — otherwise anyone more than 12 years from eligibility saw an empty table.
    // Always run far enough to include their chosen retirement year.
    const firstEligible = dobDate ? dobDate.getFullYear() + 50 : NOW.getFullYear();
    const from = Math.max(NOW.getFullYear(), firstEligible);
    const to = Math.max(from + 10, retirementYear + 2);
    const out = [];
    for (let y = from; y <= to && out.length < 15; y++) {
      const p = projectForYear(y);
      if (p) out.push(p);
    }
    return out;
  })();
  const selectedYearRow = retireYearOptions.find(r => r.year === retirementYear) || null;
  const earliestRow = retireYearOptions[0] || null;
  // The year the Classic 90% cap first binds — after this, more service adds nothing.
  const capYearRow = benefitIsCapped ? retireYearOptions.find(r => r.atCap) : null;
  // Prior-agency service, pension-type override and purchased service credit. Defined once
  // and rendered on both Working now and the advanced inputs tab, so the two never drift.
  // Condensed prior-service editor. One tight row per agency; the rare controls
  // (non-CalPERS benefit factor, other-system final comp) only appear when they apply.
  const priorServiceEditor = (<>
                    {priorService.map((r, i) => {
                      const calc = priorServiceCalc[i] || {};
                      return (
                        <div key={r.id} style={{ background: "#121214", border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "10px", marginBottom: "8px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1.4fr 0.7fr auto", gap: "8px", alignItems: "end" }}>
                            <div>
                              <label style={{ ...styles.label, fontSize: "10px", marginBottom: "3px" }}>Agency</label>
                              <input style={{ ...styles.input, margin: 0 }} type="text" value={r.agencyName || ""} placeholder="CDF, Lake Tahoe…"
                                onChange={e => updatePriorRow(r.id, { agencyName: e.target.value })} />
                            </div>
                            <div>
                              <label style={{ ...styles.label, fontSize: "10px", marginBottom: "3px" }}>Formula</label>
                              <select style={{ ...styles.select, margin: 0 }} value={r.formula}
                                onChange={e => updatePriorRow(r.id, { formula: e.target.value, ...(e.target.value === "manual" ? { useRosevilleComp: false } : {}) })}>
                                {PRIOR_FORMULAS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ ...styles.label, fontSize: "10px", marginBottom: "3px" }}>Years</label>
                              <input style={{ ...styles.input, margin: 0 }} type="number" step="0.001" value={r.years} placeholder="0"
                                onChange={e => updatePriorRow(r.id, { years: e.target.value })} />
                            </div>
                            <button onClick={() => removePriorRow(r.id)} title="Remove"
                              style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: "14px", padding: "8px 4px" }}>✕</button>
                          </div>
                          <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "6px" }}>
                            {calc.calpers
                              ? <>Same CalPERS allowance — adds to your percentage.</>
                              : <>Paid separately by that system · <strong style={{ color: COLORS.green }}>{fmt(calc.monthly || 0)}/mo</strong></>}
                          </div>
                          {r.formula === "manual" && (
                            <div style={{ marginTop: "8px" }}>
                              <label style={{ ...styles.label, fontSize: "10px", marginBottom: "3px" }}>Benefit factor per year (%) <span style={{ color: COLORS.textDim }}>· off your statement from that system</span></label>
                              <input style={{ ...styles.input, margin: 0 }} type="number" step="0.001" value={r.manualFactor} placeholder="e.g. 2.0"
                                onChange={e => updatePriorRow(r.id, { manualFactor: e.target.value })} />
                            </div>
                          )}
                          {!calc.calpers && (
                            <label style={{ ...styles.checkRow, marginTop: "8px", marginBottom: 0 }}>
                              <input style={styles.checkbox} type="checkbox" checked={r.useRosevilleComp !== false}
                                onChange={e => updatePriorRow(r.id, { useRosevilleComp: e.target.checked })} />
                              <span style={{ ...styles.checkLabel, fontSize: "11px", color: COLORS.textMuted }}>Figure it on my Roseville final pay</span>
                            </label>
                          )}
                          {r.useRosevilleComp === false && (
                            <input style={{ ...styles.input, marginTop: "6px" }} type="number" value={r.customComp} placeholder="That system's final monthly comp"
                              onChange={e => updatePriorRow(r.id, { customComp: e.target.value })} />
                          )}
                        </div>
                      );
                    })}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", alignItems: "end" }}>
                      <button onClick={addPriorRow} style={{ background: "rgba(255,255,255,0.12)", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, borderRadius: "8px", padding: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>+ Add agency</button>
                      <div>
                        <label style={{ ...styles.label, fontSize: "10px", marginBottom: "3px" }}>Air Time purchased <span style={{ color: COLORS.textDim }}>· years, max 5</span></label>
                        <input style={{ ...styles.input, margin: 0 }} type="number" step="0.5" min={0} max={5} value={airtime || ""} placeholder="0"
                          onChange={e => setAirtime(Math.min(5, Math.max(0, +e.target.value || 0)))} />
                      </div>
                    </div>
                    {(priorTotalYears > 0 || airtimeYears > 0) && (
                      <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px", color: COLORS.text, lineHeight: 1.6 }}>
                        {yearsOfService.toFixed(1)} yrs Roseville + {priorTotalYears} prior{airtimeYears > 0 ? ` + ${airtimeYears} Air Time` : ""} = <strong>{(yearsOfService + priorTotalYears + airtimeYears).toFixed(1)} years</strong>
                        {priorPensionMonthly > 0 && <> · other systems pay <strong style={{ color: COLORS.green }}>{fmt(priorPensionMonthly)}/mo</strong> separately</>}
                      </div>
                    )}
  </>);
  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      <div className="no-print" style={{ position: "absolute", top: "12px", right: "12px", zIndex: 40 }}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: "8px", padding: "4px 12px", fontSize: "20px", lineHeight: 1.1, cursor: "pointer" }}>⋯</button>
        {menuOpen && (
          <div style={{ position: "absolute", top: "42px", right: 0, background: "#17171b", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "6px", minWidth: "190px", boxShadow: "0 10px 30px rgba(0,0,0,0.55)" }}>
            <button onClick={() => { setMenuOpen(false); window.print(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: COLORS.text, padding: "10px 12px", fontSize: "13px", cursor: "pointer", borderRadius: "6px" }}>Print / Save PDF</button>
            <a href={`mailto:?subject=${encodeURIComponent("My RFF Retirement Estimate")}&body=${encodeURIComponent(`Estimated total monthly income: ${fmt(totalMonthly)}\nMonthly pension: ${fmt(combinedPensionMonthly)}\n457 at retirement: ${fmt(value457)}\nReplacement: ${(retirementVsWorking * 100).toFixed(0)}% of current pay\n\nFrom the RFF Retirement Calculator — https://neitling78.github.io/Roseville-Fire-Retirement-Calculator/ (estimates only)`)}`} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", color: COLORS.text, padding: "10px 12px", fontSize: "13px", textDecoration: "none", borderRadius: "6px" }}>Email me this</a>
          </div>
        )}
      </div>
      <div className="no-print" style={{
        ...styles.header,
        position: "sticky", top: 0, zIndex: 30, overflow: "hidden",
        flexDirection: "column", textAlign: "center", justifyContent: "center",
        padding: isMobile ? "22px 14px" : "36px 20px",
        gap: isMobile ? "6px" : "8px",
      }}>
        <img src={logoUrl} alt="" aria-hidden="true"
          style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", height: isMobile ? "210px" : "320px", opacity: 0.1, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ ...styles.headerSub, fontSize: isMobile ? "10px" : "12px", marginBottom: "4px" }}>Roseville Firefighters · IAFF Local 1592</p>
          <h1 style={{ ...styles.headerTitle, fontSize: isMobile ? "30px" : "46px", margin: "0 0 6px", textShadow: "0 0 14px rgba(210,31,51,0.8), 0 0 34px rgba(210,31,51,0.5)" }}>Roseville Fire Fighters Retirement Calculator</h1>
          <p style={{ margin: 0, fontSize: isMobile ? "12px" : "14px", color: COLORS.textMuted }}>Your CalPERS pension, mapped to the day you hang up the helmet.</p>
        </div>
      </div>
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: COLORS.surface, borderBottom: `2px solid ${COLORS.green}`, boxShadow: "0 2px 12px rgba(0,0,0,0.45)" }}>
        {/* The four numbers a member actually came for: what they make now, gross and net,
            against what they will get retired, gross and net. Everything else is the working. */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "8px 12px" : "10px 20px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? "8px" : "16px" }}>
          {[
            { label: `While working \u00b7 ${headerWorkYear}`,
              sub: headerWorkClamped ? `your last year \u2014 you retire in ${retirementYear}`
                : headerWorkYear === NOW.getFullYear() ? "today, with your overtime"
                : "at that year's pay, with your overtime",
              gross: headerPay.gross, net: headerWorkTakeHome, tone: COLORS.text },
            { label: `While retired${retirementYear ? " · " + retirementYear : ""}`,
              sub: survivorOption === "unmod" ? "unmodified allowance" : `${survivorChosen.short} elected`,
              gross: combinedPensionMonthly, net: totalMonthlyTakeHome, tone: COLORS.green },
          ].map(c => (
            <div key={c.label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? "9px" : "11px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted, fontWeight: 700 }}>{c.label}</div>
              <div style={{ display: "flex", gap: isMobile ? "10px" : "22px", marginTop: "2px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: isMobile ? "8px" : "10px", color: COLORS.textDim }}>Gross</div>
                  <div style={{ fontSize: isMobile ? "15px" : "22px", fontWeight: 800, color: c.tone, lineHeight: 1.1 }}>{fmt(c.gross)}</div>
                </div>
                <div>
                  <div style={{ fontSize: isMobile ? "8px" : "10px", color: COLORS.textDim }}>Take home</div>
                  <div style={{ fontSize: isMobile ? "15px" : "22px", fontWeight: 800, color: COLORS.green, lineHeight: 1.1 }}>{fmt(c.net)}</div>
                </div>
              </div>
              <div style={{ fontSize: isMobile ? "8px" : "10px", color: COLORS.textDim, marginTop: "1px" }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="no-print" style={{ ...styles.container, padding: isMobile ? "16px 12px" : "32px 20px" }}>
        {datesInvalid && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#fca5a5" }}>
            ⚠ Your retirement date is on or before your hire date. Fix the hire date or retirement age on Member details — the numbers above aren't valid until then.
          </div>
        )}
        <div style={{ ...styles.tabRow, flexWrap: "wrap", gap: isMobile ? "6px" : "8px" }}>
          {/* One row, no parent tab. "Into the weeds" held exactly two screens and cost a click
              to reach either of them. Old ?tab=advanced links land on Other income & tax. */}
          {["member", "comp", "pension", "survivor", "health", "stayorgo", "income", "help"].map(t => (
            <button key={t} style={{ ...styles.tab(tab === t), flex: isMobile ? "1 1 30%" : 1, textAlign: "center", fontSize: isMobile ? "11px" : "13px", padding: isMobile ? "10px 2px" : "12px 8px", whiteSpace: "nowrap" }}
              onClick={() => setTab(t)}>
              {{ member: isMobile ? "Member" : "Member details", comp: "Compensation",
                 pension: "Pension",
                 survivor: isMobile ? "Survivor" : "Survivor / beneficiary",
                 health: isMobile ? "Health" : "Health care",
                 stayorgo: isMobile ? "Stay/go" : "Stay or go?",
                 income: isMobile ? "Tax" : "Other income & tax",
                 help: "Guide" }[t]}
            </button>
          ))}
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: "1fr" }}>
          {/* LEFT PANEL */}
          <div>
            {/* ═══════════════ WORKING NOW · inputs ═══════════════ */}
            {tab === "member" && (
              <>
                <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                  {sectionHeaderValue("startprior", "1 · Prior service",
                    (priorTotalYears + airtimeYears) > 0 ? `+${(priorTotalYears + airtimeYears).toFixed(1)} yrs` : "none")}
                  {openSections.startprior !== false && (<>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "10px", lineHeight: 1.5 }}>
                      Agencies before Roseville, oldest first. Years and formula are on your myCalPERS
                      Service Credit History. Skip it if Roseville is all you have.
                    </div>
                    {priorServiceEditor}
                  </>)}
                </div>
                <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                  <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>2 · Roseville</p>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px", lineHeight: 1.6 }}>
                    When Roseville hired you, and where you sit today. Your retirement date lives on
                    <strong style={{ color: COLORS.textMuted }}> Pension</strong> — that is the one you get to change your mind about.
                  </div>

                  <label style={styles.label}>Roseville hire date</label>
                  <input type="date" style={{ ...styles.input, marginBottom: "6px" }} value={hireDate}
                    onChange={e => { setHireDate(e.target.value); setSetupDone(true); }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                    <span style={{ ...styles.badge, ...styles.badgeGreen }}>{memberType === "classic" ? "Classic · 3% @ 50" : "PEPRA · 2.7% @ 57"}</span>
                    <span style={{ ...styles.badge, ...styles.badgeGreen }}>Schedule {scheduleLetter}</span>
                    <span style={{ ...styles.badge, ...styles.badgeGreen }}>Medical Tier {medicalTier}</span>
                    <span style={{ ...styles.badge, ...styles.badgeGreen }}>{pct(colaRate)} COLA</span>
                    <span style={{ ...styles.badge, ...styles.badgeGreen }}>{showLongevity ? "Longevity pay" : "Service term bonus"}</span>
                  </div>

                  {/* The hire date already answers both of these. Service credit is estimated from it and the
                      formula is set by it — so state the estimate in one line and ask the one question the hire
                      date can get wrong: a member who is Classic through reciprocity from a prior agency. */}
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "10px", lineHeight: 1.6 }}>
                    Service credit: {usingCalpersCredit
                      ? <><strong style={{ color: COLORS.green }}>{(parseFloat(calpersCreditRoseville) || 0).toFixed(3)} yrs</strong> from myCalPERS.</>
                      : <><strong style={{ color: COLORS.text }}>{yearsOfService.toFixed(1)} yrs</strong> at retirement, estimated from your hire date.</>}
                    <span style={{ color: COLORS.textDim, cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleClosed("startcalpers")}>
                      {" "}{openSections.startcalpers ? "▾" : "▸"} {usingCalpersCredit ? "edit" : "have the exact figure?"}
                    </span>
                  </div>
                  {openSections.startcalpers && (<>
                    <label style={styles.label}>Roseville service credit today
                      <span style={{ fontSize: "10px", color: COLORS.textDim }}> · my.calpers.ca.gov › Service Credit</span>
                    </label>
                    <input type="number" step="0.001" min={0} style={styles.input}
                      value={calpersCreditRoseville || ""} placeholder="leave blank to keep the estimate"
                      onChange={e => { setCalpersCreditRoseville(Math.max(0, +e.target.value || 0)); setSetupDone(true); }} />
                    {moreInfo("whycalpers", "why the exact figure is worth pulling", <>
                      CalPERS credits the hours your employer reports, which is not the same as calendar years since you
                      started — unpaid leave and reporting gaps earn none. At 3% a year every tenth of a year is real
                      money for life, so the real figure turns your pension percentage from an estimate into a number.
                    </>)}
                            {usingCalpersCredit && (<>
                              <label style={{ ...styles.label, marginTop: "10px" }}>"Last reported" date on myCalPERS</label>
                              <input type="date" style={styles.input} value={calpersCreditAsOf}
                                onChange={e => setCalpersCreditAsOf(e.target.value)} />
                              <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", marginBottom: "6px", lineHeight: 1.6 }}>
                                Printed at the top of your Account Summary. Your employer reports on a lag, so the figure
                                can be weeks old. Service still to be earned is counted from this date, not from today.
                                Leave blank to count from today.
                              </div>
                              <label style={{ ...styles.checkRow, marginTop: "10px" }}>
                                <input style={styles.checkbox} type="checkbox" checked={calpersCreditIncludesPurchased}
                                  onChange={e => setCalpersCreditIncludesPurchased(e.target.checked)} />
                                <span style={{ ...styles.checkLabel, fontSize: "12px" }}>
                                  This figure already includes service credit I purchased
                                </span>
                              </label>
                              <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "2px", marginBottom: "10px", lineHeight: 1.6 }}>
                                myCalPERS folds purchased credit into the employer lines and says so under the Total.
                                Leave this ticked unless you know otherwise — unticking it adds your airtime entry on
                                top, which would count it twice.
                                {calpersCreditIncludesPurchased && airtimeYears > 0 && (
                                  <div style={{ marginTop: "6px", color: COLORS.gold }}>
                                    Your purchased-service entry of {airtimeYears} yr{airtimeYears === 1 ? "" : "s"} is
                                    <strong> not</strong> being added separately — it is already inside the figure above.
                                  </div>
                                )}
                                <div style={{ marginTop: "6px" }}>
                                  Quick check: if the employer rows on myCalPERS add up to the Total, the purchase is
                                  already in them. If the Total is higher than the rows, it is not.
                                </div>
                              </div>
                              <div style={{ padding: "12px", background: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.25)`, borderRadius: "8px" }}>
                                <div style={styles.tableRow}>
                                  <span style={styles.tableKey}>On file today</span>
                                  <span style={styles.tableVal}>{(parseFloat(calpersCreditRoseville) || 0).toFixed(3)} yrs</span>
                                </div>
                                <div style={styles.tableRow}>
                                  <span style={styles.tableKey}>Still to earn, to {effectiveRetDateStr}</span>
                                  <span style={styles.tableVal}>+{serviceStillToEarn.toFixed(3)} yrs</span>
                                </div>
                                <div style={styles.tableRowLast}>
                                  <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text }}>Roseville credit at retirement</span>
                                  <span style={{ ...styles.tableValGold, fontWeight: 800 }}>{rosevilleServiceForPension.toFixed(3)} yrs</span>
                                </div>
                              </div>
                              {Math.abs(rosevilleServiceForPension - yearsOfService) > 0.5 && (
                                <div style={{ fontSize: "11px", color: COLORS.gold, marginTop: "8px", padding: "10px 12px", background: "rgba(180,83,9,0.10)", border: `1px solid rgba(180,83,9,0.30)`, borderRadius: "8px", lineHeight: 1.7 }}>
                                  Your hire date implies {yearsOfService.toFixed(1)} calendar years, but CalPERS will credit
                                  {" "}{rosevilleServiceForPension.toFixed(3)} — a gap of {Math.abs(rosevilleServiceForPension - yearsOfService).toFixed(2)} years.
                                  The CalPERS figure is the one your pension is paid on. Calendar years still drive your
                                  longevity pay and retiree-medical vesting, which the MOU writes in years of City employment.
                                </div>
                              )}
                              {calpersTotalToday > 0 && (
                                <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "10px", lineHeight: 1.7 }}>
                                  <strong style={{ color: COLORS.text }}>Check yourself:</strong> Roseville plus every CalPERS
                                  agency you have entered below comes to <strong style={{ color: COLORS.gold }}>{calpersTotalToday.toFixed(3)} years</strong>.
                                  That should match the Total Service Credit on myCalPERS. If it does not, a prior agency is
                                  missing from the list below.
                                </div>
                              )}
                            </>)}
                  </>)}
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={memberType === "classic"}
                      onChange={e => { setOverridePensionType(true); setMemberType(e.target.checked ? "classic" : "pepra"); }} />
                    <span style={{ ...styles.checkLabel, fontWeight: 700 }}>Are you Classic, 3% @ 50?</span>
                  </label>
                  {moreInfo("whyclassic", "when you would tick this yourself", <>
                    Ticked from your hire date — Roseville hires before 1/1/2013 are Classic, after are PEPRA
                    (2.7% @ 57). Tick it yourself only if you are <strong style={{ color: COLORS.textMuted }}>Classic through
                    CalPERS reciprocity</strong> from an agency before Roseville. It is worth checking: Classic is a bigger
                    benefit and a different cap, and nothing else in this tool is right if it is wrong.
                  </>)}

                  <label style={styles.label}>Date of birth</label>
                  <input type="date" style={{ ...styles.input, marginBottom: "14px" }} value={dob}
                    onChange={e => { setDob(e.target.value); setSetupDone(true); }} />

                  <label style={styles.label}>Rank and pay step</label>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: "8px", marginBottom: "14px" }}>
                    <select style={styles.select} value={classification} onChange={e => { setClassification(e.target.value); setSetupDone(true); }}>
                      {Object.keys(activeSchedule).map(c => <option key={c}>{c}</option>)}
                    </select>
                    <select style={styles.select} value={salaryStep} onChange={e => { setSalaryStep(e.target.value); setSetupDone(true); }}>
                      {Object.keys(activeSchedule[classification]?.steps || {}).map(st =>
                        <option key={st} value={st}>Step {st}</option>)}
                    </select>
                  </div>

                  <label style={styles.label}>How many sick leave hours will you have on the books at retirement?</label>
                  <input type="number" min={0} style={{ ...styles.input, marginBottom: "4px" }}
                    value={currentSickLeaveHours === 0 ? "" : currentSickLeaveHours} placeholder="0"
                    onChange={e => { setCurrentSickLeaveHours(Math.max(0, +e.target.value || 0)); setSetupDone(true); }} />
                  {moreInfo("whysickhours", "why the tool will not fill this in", <>
                    Your own estimate for your last day — not today’s balance. Most members use sick leave along the
                    way, so projecting today’s number forward overstates it. For reference only: at
                    {" "}{SICK_LEAVE_ANNUAL_ACCRUAL_HOURS} hrs/yr accrued and none used, {yearsToRetirement.toFixed(1)} yrs
                    of accrual is <strong style={{ color: COLORS.textMuted }}>{(SICK_LEAVE_ANNUAL_ACCRUAL_HOURS * yearsToRetirement).toFixed(0)} hrs</strong> on
                    top of whatever you have now. That is a ceiling, not a forecast.
                  </>)}

                  <label style={styles.label}>What will you do with them?</label>
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={sickLeaveDisposition === "credit"}
                      onChange={() => { setSickLeaveDisposition("credit"); setSetupDone(true); }} />
                    <span style={styles.checkLabel}>
                      Add to service time
                      {sickLeaveHours > 0 && <> — <strong style={{ color: COLORS.green }}>+{sickLeaveMaxCreditYears.toFixed(2)} yrs</strong> of service credit</>}
                    </span>
                  </label>
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={sickLeaveDisposition === "cash"}
                      onChange={() => { setSickLeaveDisposition("cash"); setSetupDone(true); }} />
                    <span style={styles.checkLabel}>
                      Cash out
                      {sickLeaveHours > 0 && <> — <strong style={{ color: COLORS.gold }}>{fmt(altCashIfAllCash)}</strong> at separation</>}
                    </span>
                  </label>
                  {moreInfo("whysickchoice", "one or the other, never both — why", <>
                    The same hour cannot be cashed and converted. 2,000 hours = 1 year of service credit
                    (Gov. Code §20965); cashed hours pay at your base rate on a sliding scale (MOU Ch.3 Art.III),
                    which is why the cash figure is well under hours × your hourly rate — the table below breaks it down.
                    {sickLeaveDisposition === "cash" && <> Your cash figure also shows up under <strong style={{ color: COLORS.textMuted }}>Pension → Also waiting for you at retirement</strong>.</>}
                  </>)}
                  {/* Everything below is the reasoning, not the decision. The two checkboxes above
                      already carry both figures, so a member breezing through never has to open this. */}
                  <div onClick={() => toggleClosed("sickdetail")}
                    style={{ cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "10px 12px", borderRadius: "8px",
                      background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                      fontSize: "12px", color: COLORS.textMuted, marginBottom: openSections.sickdetail ? "14px" : "0" }}>
                    <span><strong style={{ color: COLORS.text }}>Cash or credit?</strong> Want more details?</span>
                    <span style={{ color: COLORS.textDim }}>{openSections.sickdetail ? "▾" : "▸"}</span>
                  </div>
                  {openSections.sickdetail && (<>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px", lineHeight: 1.6 }}>
                    This is the one retirement decision you cannot undo, and for most members it is worth
                    five figures. Your CalPERS contract (¶11.e, Gov. Code §20965) lets unused sick leave
                    become service credit at <strong>2,000 hours = 1 year</strong>. The MOU lets you cash it
                    out instead, on a sliding scale. You cannot do both with the same hours.
                  </div>
                  <div style={{ padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", marginBottom: "14px" }}>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Hours at retirement <span style={{ fontSize: "10px", color: COLORS.textDim }}>· your estimate</span></span>
                      <span style={styles.tableVal}>{sickLeaveHours.toFixed(0)} hrs</span>
                    </div>
                    <div style={styles.tableRowLast}>
                      <span style={styles.tableKey}>{sickLeaveDisposition === "credit" ? "→ added to service time" : "→ cashed out"}</span>
                      {sickLeaveDisposition === "credit"
                        ? <span style={styles.tableValGreen}>+{sickLeaveCreditYears.toFixed(2)} yrs</span>
                        : <span style={styles.tableValGold}>{sickLeaveHoursToCash.toFixed(0)} hrs · {fmt(sickLeavePayoff)}</span>}
                    </div>
                  </div>
                  {/* The comparison that decides it — kept, minus the controls. */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div style={{ padding: "12px", borderRadius: "8px", background: altCreditMonthlyIfAllCredit > 0 ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.10)",
                      border: `1px solid ${altCreditMonthlyIfAllCredit > 0 ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.35)"}` }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted }}>As service credit</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: altCreditMonthlyIfAllCredit > 0 ? COLORS.green : COLORS.gold, lineHeight: 1.2 }}>
                        {altCreditMonthlyIfAllCredit > 0 ? fmt(altCreditMonthlyIfAllCredit) + "/mo" : "Worth $0 to you"}
                      </div>
                      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", lineHeight: 1.6 }}>
                        {altCreditMonthlyIfAllCredit > 0
                          ? <>+{sickLeaveMaxCreditYears.toFixed(2)} yrs of credit, for life, growing with your COLA.</>
                          : <>You are already at the {pct(benefitMaxPct)} cap, so converting hours adds nothing to the pension.
                            Taking it as cash is worth <strong style={{ color: COLORS.gold }}>{fmt(altCashIfAllCash)}</strong> instead.</>}
                      </div>
                    </div>
                    <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted }}>As cash</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: COLORS.gold, lineHeight: 1.2 }}>{fmt(altCashIfAllCash)}</div>
                      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", lineHeight: 1.6 }}>
                        One payment at separation, taxed as wages in that year. Paid at base hourly plus longevity only —
                        no education, certificate or specialty pay.
                      </div>
                    </div>
                  </div>
                  {sickLeaveHoursAbovePayCap > 0 && (
                    <div style={{ ...styles.certNote, marginLeft: 0, marginBottom: "12px" }}>
                      ⚠ Only the first {SICK_LEAVE_PAYOFF_MAX_HOURS.toLocaleString()} hours are payable under the MOU table as I read it,
                      so about {sickLeaveHoursAbovePayCap.toFixed(0)} of your hours would be cashed at nothing. This ceiling is my
                      reading of the table and is <strong>not confirmed City practice</strong> — check it with the Treasurer.
                    </div>
                  )}
                  <div style={{ marginTop: "14px", padding: "12px", background: "rgba(210,31,51,0.08)", borderRadius: "8px", fontSize: "12px", lineHeight: 1.7 }}>
                    <strong style={{ color: COLORS.text }}>Your choice, as it stands:</strong>
                    {sickLeaveCreditYears > 0 && <> +{sickLeaveCreditYears.toFixed(2)} yrs of service ({fmt(sickLeavePensionBoostMonthly)}/mo for life)</>}
                    {sickLeaveCreditYears > 0 && sickLeavePayoff > 0 && " and"}
                    {sickLeavePayoff > 0 && <> {fmt(sickLeavePayoff)} cash</>}
                    {sickLeaveCreditYears === 0 && sickLeavePayoff === 0 && " nothing yet — enter your hours at the top of this section."}
                  </div>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "10px", lineHeight: 1.7 }}>
                    The cash figure uses <strong style={{ color: COLORS.text }}>{fmtHr(ratesForYear(retirementYear).cashOut)}/hr</strong>, your
                    projected rate in {retirementYear} — <strong style={{ color: COLORS.text }}>not today&rsquo;s</strong>
                    {" "}{fmtHr(ratesForYear(NOW.getFullYear()).cashOut)}/hr. You are paid out at your rate on your last day. It lands in one tax
                    year, is taxed as wages, and is not pensionable.
                  </div>
                  <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(37,99,235,0.08)", border: `1px solid rgba(37,99,235,0.28)`, borderRadius: "8px", fontSize: "11px", color: COLORS.textMuted, lineHeight: 1.7 }}>
                      <strong style={{ color: COLORS.text }}>Holiday hours are not a separate cash-out.</strong> Your
                      {" "}{HOLIDAY_HOURS} hours of holiday pay are already reported to CalPERS as special compensation
                      (MOU Ch.3 Art.II.C, CCR §571) — they are in your pensionable compensation on the pension screen.
                      They cannot be both reported to CalPERS and paid out again at separation.
                    </div>

                  {/* Members reliably expect hours × hourly rate and get roughly half of it. The MOU pays a
                      percentage set by the size of the balance, so show the table and the arithmetic rather
                      than leaving them to wonder where the money went. */}
                  <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: COLORS.text, marginBottom: "6px" }}>
                      Why the cash figure is not hours × your hourly rate
                    </p>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "10px", lineHeight: 1.7 }}>
                      The City does not buy your sick leave at 100%. The MOU pays a percentage of it, and the
                      percentage is set by how many hours you have accumulated (Ch. 3, Art. III — the 24-hour-shift
                      column). The rate applies to the whole balance, not just the hours above each step, so
                      crossing into the next band is worth real money.
                    </div>
                    {[...SICK_LEAVE_TIERS].sort((a, b) => a.min - b.min).map(t => {
                      const mine = sickLeaveHours >= t.min && sickLeaveHours <= t.max;
                      return (
                        <div key={t.min} style={{ display: "flex", justifyContent: "space-between",
                          padding: "4px 8px", borderRadius: "5px", fontSize: "11px", lineHeight: 1.7,
                          background: mine ? "rgba(245,158,11,0.14)" : "transparent",
                          color: mine ? COLORS.text : COLORS.textDim, fontWeight: mine ? 700 : 400 }}>
                          <span>
                            {t.max === Infinity
                              ? <>{t.min.toLocaleString()} hrs and up</>
                              : <>{t.min.toLocaleString()}&ndash;{Math.floor(t.max).toLocaleString()} hrs</>}
                            {mine && " ← you"}
                          </span>
                          <span style={{ color: mine ? COLORS.gold : COLORS.textDim }}>
                            {t.pct > 0 ? pct(t.pct) + " of base pay" : "not payable"}
                          </span>
                        </div>
                      );
                    })}
                    {sickLeaveHours > 0 && altCashIfAllCash > 0 && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${COLORS.border}`,
                        fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.8 }}>
                        Your figure: <strong style={{ color: COLORS.text }}>{Math.min(sickLeaveHours, SICK_LEAVE_PAYOFF_MAX_HOURS).toLocaleString()} hrs</strong>
                        {" × "}<strong style={{ color: COLORS.text }}>{fmtHr(sickLeaveHourlyRate)}/hr</strong>
                        {" × "}<strong style={{ color: COLORS.gold }}>{pct(SICK_LEAVE_TIERS.find(t => sickLeaveHours >= t.min && sickLeaveHours <= t.max)?.pct || 0)}</strong>
                        {" = "}<strong style={{ color: COLORS.gold }}>{fmt(altCashIfAllCash)}</strong>.
                        {" "}At 100% those hours would be {fmt(Math.min(sickLeaveHours, SICK_LEAVE_PAYOFF_MAX_HOURS) * sickLeaveHourlyRate)} —
                        the gap is the MOU percentage, not an error in the math.
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "10px", lineHeight: 1.7 }}>
                      The hourly rate above is base pay plus longevity only. Two things here are my reading of the
                      MOU table rather than confirmed City practice: that the percentage applies to the whole balance,
                      and that hours above {SICK_LEAVE_PAYOFF_MAX_HOURS.toLocaleString()} fall outside the table
                      entirely. Confirm both, and your own balance, with the Treasurer before you commit.
                    </div>
                  </div>
                  </>)}
                </div>




                {/* ── Pay detail: collapsed, but every header shows its own total ── */}
                <div style={styles.card}>
                  {sectionHeaderValue("startincent", "3 · Specialty pay and certificates", `${pct(incentives.totalIncentivePct)} total`)}
                  {openSections.startincent !== false && (<>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginBottom: "10px", lineHeight: 1.6 }}>
                      Tick everything you hold. Education and CSFM certificates are capped at 15% combined (MOU Ch.2 Art.VI.B).
                    </div>
                    <label style={styles.checkRow}>
                      <input style={styles.checkbox} type="checkbox" checked={hasBachelor}
                        onChange={e => { setHasBachelor(e.target.checked); if (e.target.checked) setHasAssociate(false); setSetupDone(true); }} />
                      <span style={styles.checkLabel}>Bachelor's degree (10%)</span>
                    </label>
                    <label style={styles.checkRow}>
                      <input style={styles.checkbox} type="checkbox" checked={hasAssociate}
                        onChange={e => { setHasAssociate(e.target.checked); if (e.target.checked) setHasBachelor(false); setSetupDone(true); }} />
                      <span style={styles.checkLabel}>Associate's degree (5%)</span>
                    </label>
                    {classification === "Fire Engineer" && (
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasEngineerCert}
                          onChange={e => { setHasEngineerCert(e.target.checked); setSetupDone(true); }} />
                        <span style={styles.checkLabel}>Engineer cert / FA Driver-Op (5%){!engineerCertActive && " — ends 1/9/2027"}</span>
                      </label>
                    )}
                    {classification === "Fire Captain" && (<>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasChiefFireOfficer}
                          onChange={e => { setHasChiefFireOfficer(e.target.checked); if (e.target.checked) setHasCompanyOfficer(false); setSetupDone(true); }} />
                        <span style={styles.checkLabel}>Chief Fire Officer cert (10%)</span>
                      </label>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasCompanyOfficer}
                          onChange={e => { setHasCompanyOfficer(e.target.checked); if (e.target.checked) setHasChiefFireOfficer(false); setSetupDone(true); }} />
                        <span style={styles.checkLabel}>Company Officer cert (5%)</span>
                      </label>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasEngineBoss}
                          onChange={e => { setHasEngineBoss(e.target.checked); setSetupDone(true); }} />
                        <span style={styles.checkLabel}>Engine Boss NWCG (5%){!captainIncentivesActive && " — ends 1/9/2027"}</span>
                      </label>
                    </>)}
                    {(classification === "Firefighter Paramedic I" || classification === "Firefighter Paramedic II") && (
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasFFII}
                          onChange={e => { setHasFFII(e.target.checked); setSetupDone(true); }} />
                        <span style={styles.checkLabel}>Firefighter II cert (5%)</span>
                      </label>
                    )}
                    {(classification === "Fire Engineer" || classification === "Fire Captain") && (
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasParamedic}
                          onChange={e => { setHasParamedic(e.target.checked); setSetupDone(true); }} />
                        <span style={styles.checkLabel}>Paramedic incentive (5%){classification === "Fire Captain" && !captainIncentivesActive && " — ends 1/9/2027"}</span>
                      </label>
                    )}
                    <label style={styles.checkRow}>
                      <input style={styles.checkbox} type="checkbox" checked={hasHazmat}
                        onChange={e => { setHasHazmat(e.target.checked); setSetupDone(true); }} />
                      <span style={styles.checkLabel}>Hazmat</span>
                    </label>
                    {hasHazmat && (
                      <select style={{ ...styles.select, padding: "6px 10px", fontSize: "12px", marginBottom: "8px" }}
                        value={hazmatLevel} onChange={e => setHazmatLevel(e.target.value)}>
                        <option value="team">Team (2.5%)</option>
                        <option value="taskforce">Task Force (5%)</option>
                      </select>
                    )}
                    <label style={styles.checkRow}>
                      <input style={styles.checkbox} type="checkbox" checked={hasRescue}
                        onChange={e => { setHasRescue(e.target.checked); setSetupDone(true); }} />
                      <span style={styles.checkLabel}>Rescue</span>
                    </label>
                    {hasRescue && (
                      <select style={{ ...styles.select, padding: "6px 10px", fontSize: "12px", marginBottom: "8px" }}
                        value={rescueLevel} onChange={e => setRescueLevel(e.target.value)}>
                        <option value="team">Team (2.5%)</option>
                        <option value="taskforce">Task Force (5%)</option>
                      </select>
                    )}
                    <label style={styles.checkRow}>
                      <input style={styles.checkbox} type="checkbox" checked={hasInvestigation}
                        onChange={e => { setHasInvestigation(e.target.checked); setSetupDone(true); }} />
                      <span style={styles.checkLabel}>Fire investigation</span>
                    </label>
                    {hasInvestigation && (
                      <select style={{ ...styles.select, padding: "6px 10px", fontSize: "12px", marginBottom: "8px" }}
                        value={investigationLevel} onChange={e => setInvestigationLevel(e.target.value)}>
                        <option value="team">Team (2.5%)</option>
                        <option value="lead">Team Lead (5%)</option>
                      </select>
                    )}
                    {!captainIncentivesActive && classification === "Fire Captain" && (hasParamedic || hasEngineBoss) && (
                      <div style={styles.warningBox}>
                        ⚠ Captain Paramedic and Engine Boss pay both cease 1/9/2027 in exchange for rank
                        separation (MOU Ch.2 Art.X.B.2.c). Your retirement is after that date, so they are
                        not counted — the rank separation is in your projected salary instead.
                      </div>
                    )}
                  </>)}
                </div>

                
                {!setupDone && (
                  <div style={{ ...styles.card, textAlign: "center", padding: "28px 20px" }}>
                    <div style={{ fontSize: "13px", color: COLORS.textMuted, lineHeight: 1.7, maxWidth: "420px", margin: "0 auto" }}>
                      Answer the questions above. Your pension and your pay each get their own tab.
                      <br /><br />
                      <span style={{ fontSize: "12px", color: COLORS.textDim }}>
                        Nothing you type leaves your browser. There is no account and no server.
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════ PENSION ═══════════════ */}
            {tab === "pension" && (
              <>
                {!setupDone && (
                  <div style={{ ...styles.card, textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: "14px", color: COLORS.textMuted, lineHeight: 1.7, maxWidth: "420px", margin: "0 auto" }}>
                      Answer the questions on <strong style={{ color: COLORS.text }}>Member details</strong> first.
                      <br /><br />
                      <span style={{ fontSize: "12px", color: COLORS.textDim }}>
                        Nothing you type leaves your browser. There is no account and no server.
                      </span>
                    </div>
                  </div>
                )}
                {setupDone && !datesInvalid && (
                  <>
                    <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                      <p style={{ ...styles.cardTitle, marginBottom: "2px" }}>Your number</p>
                      <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px" }}>
                        Retiring {effectiveRetDateStr} at age {Math.floor(retireAgeQ)} with {yearsOfService.toFixed(1)} years.
                      </div>

                      <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted, marginBottom: "6px" }}>What the pension is figured on</div>
                        <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "8px", lineHeight: 1.6 }}>
                          Your pensionable pay in {retirementYear} — base, specialty pay, longevity, holiday pay,
                          uniform allowance and FLSA scheduled overtime. The line-by-line build-up is on
                          <strong style={{ color: COLORS.textMuted }}> Compensation</strong>, set to {retirementYear}.
                          Overtime you volunteer for is not in it and never counts toward a pension.
                        </div>
                        <div style={{ ...styles.tableRowLast, borderTop: `1px solid ${COLORS.border}`, marginTop: "4px", paddingTop: "6px" }}>
                          <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text }}>
                            Final compensation <span style={{ fontSize: "10px", color: COLORS.textDim, fontWeight: 400 }}>· {memberType === "classic" ? "highest 12 months" : "36-month average"}</span>
                          </span>
                          <span style={{ ...styles.tableValAccent, fontWeight: 800 }}>{fmt(finalCompMonthly)}/mo</span>
                        </div>
                      </div>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>Gross CalPERS pension <span style={{ fontSize: "10px", color: COLORS.textDim }}>· {pct(combinedPensionPct)} of final comp</span></span>
                        <span style={{ ...styles.tableValAccent, fontSize: "16px" }}>{fmt(combinedPensionMonthly)}</span>
                      </div>
                      {monthly457 > 0 && include457InTakeHome && (
                        <div style={styles.tableRow}>
                          <span style={styles.tableKey}>457 draw <span style={{ fontSize: "10px", color: COLORS.textDim }}>· {retireDrawRate}%/yr</span></span>
                          <span style={styles.tableValAccent}>{fmt(monthly457)}</span>
                        </div>
                      )}
                      {(() => {
                        // Split the blended rate back into federal and state so a member can see both,
                        // in the same proportion the two taxes actually fall.
                        const taxM = combinedPensionMonthly * retEffRate;
                        const fedShare = retTaxAnnual > 0 ? retFedTax / retTaxAnnual : 1;
                        const fedM = taxM * fedShare;
                        const stM = taxM - fedM;
                        return (<>
                          <div style={styles.tableRow}>
                            <span style={styles.tableKey}>Federal income tax <span style={{ fontSize: "10px", color: COLORS.textDim }}>· {filingStatusRet === "single" ? "Single" : "Married filing jointly"}, standard deduction</span></span>
                            <span style={styles.tableVal}>−{fmt(fedM)}</span>
                          </div>
                          <div style={styles.tableRow}>
                            <span style={styles.tableKey}>{stateName} income tax <span style={{ fontSize: "10px", color: COLORS.textDim }}>· a CalPERS pension is fully taxable by California</span></span>
                            <span style={styles.tableVal}>−{fmt(stM)}</span>
                          </div>
                        </>);
                      })()}
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>Retiree health premium <span style={{ fontSize: "10px", color: COLORS.textDim }}>· {retireeMedicalPlan}, Tier {medicalTier}</span></span>
                        <span style={styles.tableVal}>−{fmt(retireePremium)}</span>
                      </div>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>City pays toward it <span style={{ fontSize: "10px", color: COLORS.textDim }}>· PEMHCA minimum {fmt(PEMHCA_MIN_MONTHLY)} + {fmt(cityMedicalCheck)} tier allowance</span></span>
                        <span style={{ ...styles.tableVal, color: COLORS.green }}>+{fmt(cityMedicalContribution)}</span>
                      </div>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}><strong>Health insurance, your share</strong></span>
                        <span style={{ ...styles.tableVal, color: retireeMedicalOOP > 0 ? COLORS.gold : COLORS.green, fontWeight: 700 }}>
                          {retireeMedicalOOP > 0 ? "−" + fmt(retireeMedicalOOP) : "$0"}
                        </span>
                      </div>
                      <div style={{ ...styles.tableRowLast, borderTop: `2px solid ${COLORS.accent}`, marginTop: "10px", paddingTop: "12px" }}>
                        <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text, fontSize: "14px" }}>Lands in your bank</span>
                        <span style={{ fontWeight: 800, color: COLORS.green, fontSize: "22px" }}>{fmt(totalMonthlyTakeHome)}/mo</span>
                      </div>
                      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "10px", lineHeight: 1.7 }}>
                        <strong style={{ color: COLORS.textMuted }}>What stops the day you retire:</strong> the
                        {memberType === "classic" ? " 9%" : " 11.5%"} CalPERS member contribution, union dues
                        ({fmt(UNION_DUES_MONTHLY)}/mo), your 457 deferral, the active medical premium, and Medicare tax —
                        a pension is not wages, so no Medicare or Social Security comes out of it.
                        <div style={{ marginTop: "6px", color: COLORS.gold }}>
                          The tax figures are an estimate off the {new Date().getFullYear()} brackets and the standard deduction.
                          They do not know your deductions, your spouse&rsquo;s income or anything else on your return. Treat
                          them as a guide, not a number to budget against.
                        </div>
                      </div>

                      <div style={{ marginTop: "16px", padding: "14px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                        <div style={styles.tableRow}>
                          <span style={styles.tableKey}>Working today, after everything</span>
                          <span style={styles.tableVal}>{fmt(workingTakeHome)}/mo</span>
                        </div>
                        <div style={styles.tableRowLast}>
                          <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text }}>Difference</span>
                          <span style={{ fontWeight: 800, fontSize: "17px", color: takeHomeDiff >= 0 ? COLORS.green : COLORS.gold }}>
                            {takeHomeDiff >= 0 ? "+" : "−"}{fmt(Math.abs(takeHomeDiff))}/mo
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: 1.6 }}>
                          Both figures are take-home, not gross. In retirement you stop paying the
                          {memberType === "classic" ? " 9% " : " 11.5% "} CalPERS member contribution,
                          union dues, and the active medical premium — which is why the gap is smaller than
                          the raw salary difference makes it look.
                        </div>
                      </div>
                    </div>

                    <div style={styles.card}>
                      <p style={{ ...styles.cardTitle, marginBottom: "10px" }}>Also waiting for you at retirement</p>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>Sick leave — {sickLeaveDisposition === "cash" ? "cashed out" : "converted to service credit"}</span>
                        <span style={styles.tableValGreen}>
                          {sickLeaveCreditYears > 0 && <>+{sickLeaveCreditYears.toFixed(2)} yrs</>}
                          {sickLeaveCreditYears > 0 && sickLeavePayoff > 0 && " · "}
                          {sickLeavePayoff > 0 && fmt(sickLeavePayoff)}
                          {sickLeaveCreditYears === 0 && sickLeavePayoff === 0 && "—"}
                        </span>
                      </div>
                      {value457 > 0 && (
                        <div style={styles.tableRow}>
                          <span style={styles.tableKey}>457 balance</span>
                          <span style={styles.tableValGreen}>{fmt(value457)}</span>
                        </div>
                      )}
                      {medicalTier === "4" && medical.rhsBalance > 0 && (
                        <div style={styles.tableRow}>
                          <span style={styles.tableKey}>RHS account (Tier 4)</span>
                          <span style={styles.tableValGreen}>{fmt(medical.rhsBalance)}</span>
                        </div>
                      )}
                      <div style={styles.tableRowLast}>
                        <span style={styles.tableKey}>Annual COLA on the pension</span>
                        <span style={styles.tableValGreen}>up to {pct(colaRate)}</span>
                      </div>
                      <label style={{ ...styles.label, marginTop: "16px" }}>CalPERS account balance <span style={{ fontSize: "10px", color: COLORS.textDim }}>· optional</span></label>
                      <input type="number" step="0.01" min={0} style={styles.input} value={calpersBalance || ""}
                      placeholder="contributions + interest, from your Account Summary"
                      onChange={e => setCalpersBalance(Math.max(0, +e.target.value || 0))} />
                      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", lineHeight: 1.7 }}>
                      This does not change your pension by a cent. It is what you would be refunded if you
                      quit and cashed out — which would forfeit the pension entirely. It is here only because
                      the two get confused, and the comparison is worth seeing once.
                      </div>

                      {calpersBalance > 0 && combinedPensionMonthly > 0 && (
                        <div style={{ marginTop: "14px", padding: "12px", background: "rgba(37,99,235,0.08)", border: `1px solid rgba(37,99,235,0.28)`, borderRadius: "8px", fontSize: "12px", lineHeight: 1.7, color: COLORS.textMuted }}>
                          <strong style={{ color: COLORS.text }}>Your account balance is not your pension.</strong>
                          <div style={styles.tableRow}>
                            <span style={styles.tableKey}>CalPERS balance (refund value)</span>
                            <span style={styles.tableVal}>{fmt(calpersBalance)}</span>
                          </div>
                          <div style={styles.tableRowLast}>
                            <span style={styles.tableKey}>What a private saver would need for this pension <span style={{ fontSize: "10px", color: COLORS.textDim }}>· at 4%/yr</span></span>
                            <span style={{ ...styles.tableValGold, fontWeight: 700 }}>{fmt(combinedPensionMonthly * 12 / 0.04)}</span>
                          </div>
                          <div style={{ marginTop: "6px" }}>
                            The balance is what you would be handed if you quit and took a refund, giving up the
                            pension. The second figure is roughly what someone with no pension would have to have
                            saved to draw the same income — and theirs would carry market risk and no COLA.
                            The balance is about {Math.round((calpersBalance / (combinedPensionMonthly * 12 / 0.04)) * 100)}% of it.
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ ...styles.card, background: "rgba(210,31,51,0.06)" }}>
                      <p style={{ ...styles.cardTitle, marginBottom: "8px" }}>Two things worth knowing</p>
                      <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.7 }}>
                        {calpersOverCap && (
                          <div style={{ marginBottom: "10px", padding: "10px 12px", background: "rgba(180,83,9,0.12)", border: `1px solid rgba(180,83,9,0.35)`, borderRadius: "8px", color: COLORS.gold, lineHeight: 1.7 }}>
                            ⚠ <strong>You are past the cap.</strong> Your service adds up to {pct(calpersRawPct)},
                            but the benefit stops at {pct(benefitMaxPct)} — so about
                            {" "}<strong>{surplusYearsOverCap.toFixed(2)} years</strong> of credit pays you nothing.
                            {sickLeaveCreditYears > 0 && <> That includes the {sickLeaveCreditYears.toFixed(2)} years
                            you are converting from sick leave, which in this position is worth
                            {" "}<strong>$0</strong> as credit — take it as cash instead.</>}
                            {airtimeCountedSeparately > 0 && <> It also includes purchased service credit.</>}
                            <div style={{ marginTop: "6px", color: COLORS.textMuted, fontSize: "11px" }}>
                              Working longer still raises the pension, but only through pay increases and any
                              service under a different CalPERS formula — not through more years in this bucket.
                            </div>
                          </div>
                        )}
                        {benefitIsCapped ? (
                          <div style={{ marginBottom: "8px" }}>
                            ▸ Your formula caps at <strong style={{ color: COLORS.text }}>90% of final compensation</strong>, reached at 30 years.
                            {capYearRow
                              ? <> You hit it in <strong style={{ color: COLORS.gold }}>{capYearRow.year}</strong> — service past that point adds nothing to the pension.</>
                              : <> You are at {pct(pensionPct)} and not there yet.</>}
                          </div>
                        ) : (
                          <div style={{ marginBottom: "8px" }}>
                            ▸ <strong style={{ color: COLORS.text }}>2.7% @ 57 has no cap.</strong> Every extra year is worth another
                            {" "}{pct(rosevilleFactor)} of final compensation, for life. Older versions of this tool stopped you at 90% — that was wrong.
                          </div>
                        )}
                        <div>
                          ▸ {memberType === "classic"
                            ? <>Your pension is figured on your <strong style={{ color: COLORS.text }}>highest 12 months</strong> of pensionable pay.</>
                            : <>Your pension is figured on a <strong style={{ color: COLORS.text }}>36-month average</strong>, not your last year — so the MOU raises in 2026–2028 reach you slower than your paycheck suggests.</>}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "pension" && setupDone && (
              <div style={styles.card}>
                  <p style={{ ...styles.cardTitle, borderBottom: "none", marginBottom: "12px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onClick={() => toggleSection("cola")}>
                    <span>Pension growth · up to {pct(colaRate)} COLA</span>
                    <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections.cola ? "▾" : "▸ tap to open"}</span>
                  </p>
                  {openSections.cola && (<>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "10px", lineHeight: "1.6" }}>
                    Best case — assumes the full {pct(colaRate)} cap every year. The CalPERS COLA tracks inflation and isn't guaranteed; some years are less.
                    CalPERS starts COLAs in the second calendar year after retirement, so your first one is effective
                    <strong>May 1, {firstColaYear}</strong> and your allowance is flat until then.
                  </div>
                  {(() => {
                    const pts = colaYears.map(yr => monthlyPension * Math.pow(1 + colaRate, colasBy(yr)));
                    const mx = Math.max(...pts), mn = Math.min(...pts), W = 300, H = 60, P = 6;
                    const coords = pts.map((v, i) => `${(P + i * (W - 2 * P) / (pts.length - 1)).toFixed(1)},${(H - P - ((v - mn) / ((mx - mn) || 1)) * (H - 2 * P)).toFixed(1)}`).join(" ");
                    return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="60" style={{ marginBottom: "10px" }} aria-hidden="true"><polyline points={coords} fill="none" stroke={COLORS.green} strokeWidth="2" /></svg>;
                  })()}
                  <table style={styles.colaTable}>
                    <thead>
                      <tr style={{ color: COLORS.textMuted, fontSize: "11px", textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", padding: "6px 0", fontWeight: "600" }}>Age</th>
                        <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>Monthly</th>
                        <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaYears.map(yr => {
                        const grown = monthlyPension * Math.pow(1 + colaRate, colasBy(yr));
                        return (
                          <tr key={yr} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <td style={{ padding: "8px 0", color: COLORS.textMuted, fontSize: "13px" }}>Age {retirementAge + yr}</td>
                            <td style={{ textAlign: "right", color: COLORS.green, fontWeight: "600", fontSize: "13px" }}>{fmt(grown)}</td>
                            <td style={{ textAlign: "right", color: COLORS.textMuted, fontSize: "13px" }}>{fmt(grown * 12)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </>)}
              </div>
            )}

            {/* ═══════════════ WORKING NOW · what you actually take home ═══════════════ */}
            {tab === "member" && (
              <>
                {!setupDone && (
                  <div style={{ ...styles.card, textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: "14px", color: COLORS.textMuted, lineHeight: 1.7, maxWidth: "420px", margin: "0 auto" }}>
                      Answer the questions on <strong style={{ color: COLORS.text }}>Member details</strong> first.
                      <br /><br />
                      <span style={{ fontSize: "12px", color: COLORS.textDim }}>
                        Nothing you type leaves your browser. There is no account and no server.
                      </span>
                    </div>
                  </div>
                )}
                {/* ── THE PAGE-ONE ANSWER: gross and take-home, with overtime in it ──
                    Overtime is the whole reason this page exists. It is real money today and it is
                    NOT pensionable, so it vanishes the day you retire. Burying the input made the
                    tool tell members retiring was a raise. It is not, for anyone who works OT. */}
                {setupDone && (
                <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                  <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>4 · Overtime</p>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "14px", lineHeight: 1.6 }}>
                    The average you actually work in a month. One number — the full breakdown is on
                    <strong style={{ color: COLORS.textMuted }}> Compensation</strong>.
                  </div>
                  <div>
                    <label style={{ ...styles.label, marginBottom: "6px" }}>Overtime you actually work</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <input type="number" step="1" min={0} max={400} value={currentOTHours || ""} placeholder="0"
                        onChange={e => setCurrentOTHours(Math.max(0, parseFloat(e.target.value) || 0))}
                        style={{ ...styles.input, margin: 0, width: "110px" }} />
                      <span style={{ fontSize: "12px", color: COLORS.textMuted }}>hours a month</span>
                      <span style={{ fontSize: "12px", color: COLORS.textDim }}>
                        × {fmtHr(otHourlyRate)} = <strong style={{ color: COLORS.gold }}>{fmt(otMonthly)}/mo</strong>
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px", lineHeight: 1.6 }}>
                      {otMonthly > 0
                        ? <>That is <strong style={{ color: COLORS.gold }}>{fmt(otMonthly * 12)}</strong> a year that stops the day you retire.
                          Overtime is not reported to CalPERS, so none of it is in your pension.</>
                        : <>Put your real number in. Overtime is not pensionable — it stops at retirement and
                          none of it counts toward your pension, so leaving this at zero makes retiring look far better than it is.</>}
                    </div>
                  </div>

                </div>
                )}

              </>
            )}

            {tab === "member" && setupDone && (
              <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>5 · When do you plan to go?</p>
                <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "14px", lineHeight: 1.6 }}>
                  The one date you can still change your mind about. Everything in this tool — your pay,
                  your pension, your medical — moves with it.
                </div>
                <input type="date" style={{ ...styles.input, marginBottom: "6px" }} value={effectiveRetDateStr}
                  onChange={e => { setRetirementDateOverride(e.target.value); setSetupDone(true); }} />
                <div style={{ fontSize: "11px", color: COLORS.textDim }}>
                  Age {retireAgeQ.toFixed(2)} with {yearsOfService.toFixed(1)} years of service.
                  {retireAgeQ < 50 && <strong style={{ color: COLORS.accent }}> Safety members cannot draw a pension before age 50.</strong>}
                </div>
              </div>
            )}


            {/* ═══════════════ CURRENT COMPENSATION ═══════════════
                One table. Hourly, monthly and annual, every component of what Roseville pays you,
                ending at the gross figure your W-2 is built from. Nothing is collapsed and nothing
                is split across cards — this is the page people print and hand to their spouse. */}
            {tab === "comp" && !setupDone && (
              <div style={{ ...styles.card, textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: "14px", color: COLORS.textMuted, lineHeight: 1.7 }}>
                  Fill in <strong style={{ color: COLORS.text }}>Member details</strong> first.
                </div>
              </div>
            )}
            {tab === "comp" && setupDone && (() => {
              // Same builder the sticky header uses, so the two can never drift apart.
              // Every figure follows the year picker: MOU general wage increases, the 2028 Labor
              // Market Adjustment you set, and the rank separation are all inside projectedBaseForYear.
              const P = workingPayForYear(shownRateYear);
              const { H, R, lonPct, specialtyPct, holiday: yHoliday, ot: yOT } = P;
              const yBase = R.base;
              const rows = [
                { k: "Base salary", sub: `${classification}, Step ${salaryStep}, Schedule ${scheduleLetter}`,
                  m: yBase, hourly: true, pens: true },
                specialtyPct > 0.00005 && { k: "Specialty and certificate pay", sub: pct(specialtyPct) + " of base",
                  m: yBase * specialtyPct, hourly: true, pens: true },
                lonPct > 0.00005 && { k: "Longevity", sub: `${pct(lonPct)} at ${R.yosThen.toFixed(0)} yrs`,
                  m: yBase * lonPct, hourly: true, pens: true },
                memberType === "classic" && { k: "Holiday pay",
                  sub: `${HOLIDAY_HOURS} hrs at base + ${pct(lonPct)} longevity`,
                  m: yHoliday, hourly: false, pens: true },
                memberType === "classic" && { k: "Uniform allowance", sub: `$${UNIFORM_ALLOWANCE_ANNUAL.toLocaleString()}/yr`,
                  m: uniformMonthly, hourly: false, pens: true },
                memberType === "classic" && { k: "FLSA scheduled overtime", sub: `${pct(FLSA_OT_PENSIONABLE_PCT)} of base, built into 48/96`,
                  m: yBase * FLSA_OT_PENSIONABLE_PCT, hourly: false, pens: true },
                { k: "Overtime you work", sub: otHoursMonthly > 0 ? `${otHoursMonthly} hrs at ${fmtHr(R.flsaOT)}` : "none entered",
                  m: yOT, hourly: false, pens: false },
              ].filter(Boolean);
              const grossM = rows.reduce((t, r) => t + r.m, 0);
              const pensM = rows.filter(r => r.pens).reduce((t, r) => t + r.m, 0);
              return (
                <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <p style={{ ...styles.cardTitle, margin: 0 }}>
                      Compensation in {shownRateYear}{shownRateYear === retirementYear ? " · your last year" : shownRateYear === NOW.getFullYear() ? " · today" : ""}
                    </p>
                    <select value={shownRateYear} onChange={e => pickRateYear(+e.target.value)}
                      style={{ ...styles.select, margin: 0, width: "auto", minWidth: "96px", fontWeight: 700 }}>
                      {rateYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "12px", lineHeight: 1.6 }}>
                    Everything Roseville pays you, by the hour, the month and the year. Scheduled hours
                    are {H}/mo (56 × 52 ÷ 12).
                  </div>
                  {shownRateYear > NOW.getFullYear() && (
                    <div style={{ fontSize: "11px", lineHeight: 1.7, marginBottom: "12px", padding: "10px 12px", borderRadius: "8px",
                      background: shownRateYear === 2028 && (parseFloat(lmaPct) || 0) === 0 ? "rgba(245,158,11,0.08)" : "rgba(37,99,235,0.08)",
                      border: `1px solid ${shownRateYear === 2028 && (parseFloat(lmaPct) || 0) === 0 ? "rgba(245,158,11,0.35)" : "rgba(37,99,235,0.28)"}`,
                      color: COLORS.textMuted }}>
                      <strong style={{ color: COLORS.text }}>What is in {shownRateYear}:</strong>
                      {shownRateYear >= 2027 && <> Jan 2027 — {isPreventionClass(classification) ? `prevention +${pctExact(mouGwiFor(2027, classification))}` : "no general wage increase for suppression"}{R.rankSepApplied ? `; rank separation (${shownRateYear >= 2028 ? "Engineer 10% above Paramedic, Captain 10% above Engineer" : "Engineer 7.5% above Paramedic, Captain 10% above Engineer"})` : ""}.</>}
                      {shownRateYear >= 2028 && <> Jan 2028 — Labor Market Adjustment, shown at <strong style={{ color: (parseFloat(lmaPct) || 0) > 0 ? COLORS.gold : COLORS.textMuted }}>{lmaPct || 0}%</strong>.</>}
                      {shownRateYear >= 2029 && <> Jan 2029 — {isPreventionClass(classification) ? "prevention " : ""}+{pctExact(mouGwiFor(2029, classification))}.</>}
                      {shownRateYear >= 2028 && (parseFloat(lmaPct) || 0) === 0 && (
                        <div style={{ marginTop: "6px", color: COLORS.gold }}>
                          ⚠ 2028 is the year nobody can price yet. The Labor Market Adjustment is set by the 2027
                          Total Compensation Study and it is at zero here — so this is the floor, not a forecast.
                          Put a number in under Future raises just below and every figure moves.
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "13px" }}>
                      <thead>
                        <tr style={{ color: COLORS.textMuted, textAlign: "right" }}>
                          <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 600 }}>What</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>Hourly</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>Monthly</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>Annual</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>PERS?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} style={{ textAlign: "right", borderTop: `1px solid ${COLORS.border}` }}>
                            <td style={{ textAlign: "left", padding: "8px 4px" }}>
                              <div style={{ color: COLORS.text, fontWeight: 600 }}>{r.k}</div>
                              <div style={{ fontSize: "10px", color: COLORS.textDim }}>{r.sub}</div>
                            </td>
                            <td style={{ padding: "8px 4px", color: COLORS.textMuted }}>{r.hourly ? fmtHr(r.m / H) : "—"}</td>
                            <td style={{ padding: "8px 4px", color: COLORS.text }}>{fmt(r.m)}</td>
                            <td style={{ padding: "8px 4px", color: COLORS.text }}>{fmt(r.m * 12)}</td>
                            <td style={{ padding: "8px 4px", color: r.pens ? COLORS.green : COLORS.textDim, fontSize: "11px" }}>{r.pens ? "yes" : "no"}</td>
                          </tr>
                        ))}
                        <tr style={{ textAlign: "right", borderTop: `2px solid ${COLORS.accent}` }}>
                          <td style={{ textAlign: "left", padding: "10px 4px", fontWeight: 800, color: COLORS.text, fontSize: "14px" }}>Gross pay</td>
                          <td style={{ padding: "10px 4px", color: COLORS.textMuted }}>{fmtHr(grossM / H)}</td>
                          <td style={{ padding: "10px 4px", fontWeight: 800, color: COLORS.green, fontSize: "15px" }}>{fmt(grossM)}</td>
                          <td style={{ padding: "10px 4px", fontWeight: 800, color: COLORS.green, fontSize: "15px" }}>{fmt(grossM * 12)}</td>
                          <td />
                        </tr>
                        <tr style={{ textAlign: "right" }}>
                          <td style={{ textAlign: "left", padding: "8px 4px", color: COLORS.textMuted }}>
                            Of that, reported to CalPERS
                            <div style={{ fontSize: "10px", color: COLORS.textDim }}>what your pension is figured on</div>
                          </td>
                          <td />
                          <td style={{ padding: "8px 4px", color: COLORS.gold, fontWeight: 700 }}>{fmt(pensM)}</td>
                          <td style={{ padding: "8px 4px", color: COLORS.gold, fontWeight: 700 }}>{fmt(pensM * 12)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {currentIncentives.breakdown.filter(b => b.note).map((b, i) => (
                    <div key={i} style={{ fontSize: "11px", color: COLORS.gold, marginTop: "10px", lineHeight: 1.6 }}>{b.label}</div>
                  ))}
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "14px", lineHeight: 1.7 }}>
                    <strong style={{ color: COLORS.textMuted }}>Against your W-2:</strong> the annual gross above is what
                    Medicare wages (Box 5) are built from. Box 1 will read lower, because your 457 deferral and your
                    medical, dental and vision premiums come out before it. Overtime you volunteer for is real pay and
                    is in this total — it is just not reported to CalPERS, so it is the one line that does nothing for
                    your pension.
                  </div>
                </div>
              );
            })()}
            {tab === "comp" && setupDone && (
                <div style={styles.card}>
                  {sectionHeaderValue("startraises", "Future raises", retirementYear >= 2027 ? `${fmt(projectedBaseSalary)}/mo at retirement` : "none before 2027")}
                  {openSections.startraises !== false && (<>
                    {/* Year by year, in the order the contract lays them out. */}
                    {(() => {
                      const sep2027 = classification === "Fire Captain" ? "Capt = Eng ×1.10, Eng = FFP2 ×1.075"
                        : classification === "Fire Engineer" ? "Eng = FFP2 ×1.075" : null;
                      const sep2028 = classification === "Fire Captain" ? "Capt = Eng ×1.10, Eng = FFP ×1.10"
                        : classification === "Fire Engineer" ? "Eng = FFP ×1.10" : null;
                      const Row = ({ year, children }) => (
                        <div style={{ display: "grid", gridTemplateColumns: "54px 1fr", gap: "10px",
                          padding: "8px 0", borderTop: `1px solid ${COLORS.border}`, alignItems: "start" }}>
                          <div style={{ fontWeight: 800, color: COLORS.text, fontSize: "13px" }}>{year}</div>
                          <div style={{ fontSize: "11px", color: COLORS.textMuted, lineHeight: 1.6 }}>{children}</div>
                        </div>
                      );
                      return (<>
                        <Row year="2027">
                          <strong style={{ color: COLORS.text }}>{pctExact(mouGwiFor(2027, classification))}</strong> general wage increase
                          {isPreventionClass(classification) ? " (prevention)" : " for suppression"}
                          {sep2027 && <> · rank separation <strong style={{ color: COLORS.gold }}>{sep2027}</strong></>}
                          <div style={{ color: COLORS.textDim }}>MOU Ch.2 Art.I.A(2) · first full pay period in January</div>
                        </Row>
                        <Row year="2028">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                            <span>Labor Market Adjustment</span>
                            <input type="number" step="0.25" min={0} max={30} value={lmaPct || ""} placeholder="0"
                              onChange={e => setLmaPct(Math.max(0, +e.target.value || 0))}
                              style={{ ...styles.input, margin: 0, width: "84px", padding: "6px 8px" }} />
                            <span style={{ color: COLORS.textMuted }}>%</span>
                            {(parseFloat(lmaPct) || 0) === 0 && <span style={{ color: COLORS.gold, fontSize: "10px" }}>⚠ nobody knows this one yet</span>}
                          </div>
                          {sep2028 && <>Alignment tightens to <strong style={{ color: COLORS.gold }}>{sep2028}</strong><br /></>}
                          <span style={{ color: COLORS.textDim }}>
                            Art.I.A.3 · the City lifts any class below the market 55th percentile up to it, set by the
                            2027 Total Compensation Study. It raises base hourly rate, so 2029 compounds on top of it.
                          </span>
                        </Row>
                        <Row year="2029">
                          <strong style={{ color: COLORS.text }}>{pctExact(mouGwiFor(2029, classification))}</strong> general wage increase
                          {isPreventionClass(classification) ? " (prevention)" : " for suppression"}
                          <div style={{ color: COLORS.textDim }}>MOU Ch.2 Art.I.A(4) · alignment maintained · contract ends 12/31/2029</div>
                        </Row>
                        <Row year="2030+">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                            <span>Raises Local 1592 bargains</span>
                            <input type="number" step="0.25" min={0} max={20} value={unionRaisePct || ""} placeholder="0"
                              onChange={e => setUnionRaisePct(Math.max(0, +e.target.value || 0))}
                              style={{ ...styles.input, margin: 0, width: "84px", padding: "6px 8px" }} />
                            <span style={{ color: COLORS.textMuted }}>%/yr</span>
                          </div>
                          <span style={{ color: COLORS.textDim }}>
                            No contract past 12/31/2029. At 0 you are credited with nothing beyond what is signed.
                            Same dial as on Stay or go?
                          </span>
                        </Row>
                      </>);
                    })()}
                    <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "8px" }}>
                      Year-by-year effect on your pay: <strong style={{ color: COLORS.textMuted }}>Compensation</strong>, using the year picker.
                    </div>
                  </>)}
                </div>
            )}
            {tab === "comp" && setupDone && (
                <div style={styles.card}>
                  {sectionHeaderValue("starthourly", "Your hourly rates", `${fmtHr(shownRates.regular)}/hr`)}
                  {openSections.starthourly !== false && (<>
                    <label style={styles.label}>Show rates for</label>
                    <select style={{ ...styles.select, marginBottom: "12px" }} value={shownRateYear}
                      onChange={e => pickRateYear(+e.target.value)}>
                      {rateYearOptions.map(y => (
                        <option key={y} value={y}>
                          {y}{y === NOW.getFullYear() ? " (today)" : ""}{y === retirementYear ? " · retirement" : ""}
                        </option>
                      ))}
                    </select>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Monthly base <span style={{ fontSize: "10px", color: COLORS.textDim }}>· {classification}, Step {salaryStep}</span></span>
                      <span style={styles.tableVal}>{fmt(shownRates.base)}/mo</span>
                    </div>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Base hourly <span style={{ fontSize: "10px", color: COLORS.textDim }}>· base ÷ 242.67</span></span>
                      <span style={styles.tableVal}>{fmtHr(shownRates.baseHourly)}/hr</span>
                    </div>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>FLSA regular rate <span style={{ fontSize: "10px", color: COLORS.textDim }}>· base + {pct(shownRates.incentivePct)} incentives</span></span>
                      <span style={styles.tableValGold}>{fmtHr(shownRates.regular)}/hr</span>
                    </div>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>FLSA overtime <span style={{ fontSize: "10px", color: COLORS.textDim }}>· 1.5×</span></span>
                      <span style={styles.tableValGold}>{fmtHr(shownRates.flsaOT)}/hr</span>
                    </div>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Contract overtime <span style={{ fontSize: "10px", color: COLORS.textDim }}>· 1.5 × (base + {pct(shownRates.longevityPct)} longevity)</span></span>
                      <span style={styles.tableVal}>{fmtHr(shownRates.contractOT)}/hr</span>
                    </div>
                    <div style={styles.tableRowLast}>
                      <span style={styles.tableKey}>Sick leave / holiday cash-out <span style={{ fontSize: "10px", color: COLORS.textDim }}>· base + longevity, no incentives</span></span>
                      <span style={styles.tableValGreen}>{fmtHr(shownRates.cashOut)}/hr</span>
                    </div>
                    {shownRateYear !== NOW.getFullYear() && (
                      <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "10px", padding: "10px 12px", background: "rgba(37,99,235,0.08)", border: `1px solid rgba(37,99,235,0.28)`, borderRadius: "8px", lineHeight: 1.7 }}>
                        <strong style={{ color: COLORS.text }}>What moved between {NOW.getFullYear()} and {shownRateYear}:</strong>
                        <div style={{ marginTop: "4px" }}>
                          {shownRateYear >= 2027 && (
                            <>▸ <strong>Jan 2027</strong> — {isPreventionClass(classification)
                              ? "prevention classes +2.5%"
                              : "no general wage increase for suppression"}
                              {shownRates.rankSepApplied && <>; rank separation sets {classification === "Fire Captain" ? "Captain 10% above Engineer, Engineer" : "Engineer"} 7.5% above Firefighter Paramedic II</>}
                              {(classification === "Fire Captain" || classification === "Fire Engineer") && <>; Captain Paramedic, Engine Boss and Engineer cert pay all end 1/9/2027</>}
                              <br /></>
                          )}
                          {shownRateYear >= 2028 && (
                            <>▸ <strong>Jan 2028</strong> — Labor Market Adjustment, shown here at your assumption of {lmaPct || 0}%
                              (the 2027 Total Compensation Study sets the real figure); alignment tightens to Engineer 10% above Paramedic, Captain 10% above Engineer<br /></>
                          )}
                          {shownRateYear >= 2029 && (
                            <>▸ <strong>Jan 2029</strong> — {isPreventionClass(classification) ? "prevention +3.0%" : "Firefighter Paramedic I/II and EMT I +1.75%"}<br /></>
                          )}
                          {shownRateYear >= 2030 && (
                            <>▸ <strong>2030 onward</strong> — contract expired 12/31/2029; {unionRaisePct || 0}%/yr assumed<br /></>
                          )}
                          {shownRates.longevityPct > 0 && <>▸ Longevity at {pct(shownRates.longevityPct)} by {shownRateYear}<br /></>}
                        </div>
                        {shownRates.studyAssumed && (
                          <div style={{ marginTop: "6px", color: COLORS.gold }}>
                            ⚠ 2028 and later include your assumed {lmaPct}% Labor Market Adjustment. Change it on Pension › Future raises.
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: 1.6 }}>
                      The City pays the greater of FLSA or contract overtime. Education pay counts in the
                      FLSA regular rate but not in contract overtime (MOU Ch.2 Art.VI.D).
                    </div>
                  </>)}
                </div>
            )}

            {/* ═══════════════ STAY OR GO ═══════════════ */}
            {/* The headline answer: what the paycheck-to-pension change actually is, in one line.
                Overtime drives most of it for most members and is called out by name. */}
            {tab === "stayorgo" && setupDone && (() => {
              // Month one, in the dollars you would actually be handed — the same figures as the
              // banner above. The tables further down compare ACROSS years and so are in today's
              // dollars; mixing the two bases on one screen is what made this tab disagree with itself.
              const cut = finalYearTakeHome - totalMonthlyTakeHome;   // + = retiring is a pay cut
              const otShare = cut > 0 && finalYearOTMonthly > 0 ? Math.min(1, finalYearOTMonthly / cut) : 0;
              return (
                <div style={{ ...styles.card, border: `1px solid ${cut > 0 ? COLORS.gold : COLORS.green}` }}>
                  <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>The day you hang it up</p>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "14px", lineHeight: 1.6 }}>
                    Take-home against take-home, both in {finalWorkYear} dollars — the paycheck you will
                    actually be drawing in your last year against the pension that replaces it. This is the
                    change to the money that reaches your account in month one.
                    {(parseFloat(inflationRate) || 0) > 0 && (
                      <> The two tables below compare <em>across</em> years, so those are in today&rsquo;s dollars
                      at your {inflationRate}% CPI — they will not match these.</>
                    )}
                  </div>
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Working in {finalWorkYear} <span style={{ fontSize: "10px", color: COLORS.textDim }}>· your last year{finalYearOTMonthly > 0 ? `, includes ${fmt(finalYearOTMonthly)} of overtime` : ", no overtime entered"}</span></span>
                    <span style={styles.tableVal}>{fmt(finalYearTakeHome)}/mo</span>
                  </div>
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Retired in {retirementYear} <span style={{ fontSize: "10px", color: COLORS.textDim }}>· pension after tax and medical</span></span>
                    <span style={styles.tableVal}>{fmt(totalMonthlyTakeHome)}/mo</span>
                  </div>
                  <div style={{ ...styles.tableRowLast, borderTop: `2px solid ${cut > 0 ? COLORS.gold : COLORS.green}`, marginTop: "10px", paddingTop: "12px" }}>
                    <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text, fontSize: "14px" }}>
                      {cut > 0 ? "The cut" : "You come out ahead"}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: "22px", color: cut > 0 ? COLORS.gold : COLORS.green }}>
                      {cut > 0 ? "−" : "+"}{fmt(Math.abs(cut))}/mo
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "10px", lineHeight: 1.7 }}>
                    That is <strong style={{ color: cut > 0 ? COLORS.gold : COLORS.green }}>{fmt(Math.abs(cut) * 12)}</strong> a year
                    {cut > 0 ? " less" : " more"} than your final year of work pays you.
                    {finalWorkYear !== NOW.getFullYear() && (
                      <> Your paycheck grows between now and then, so this gap is wider than the one against
                      today’s pay — today’s is the comparison that flatters retirement.</>
                    )}
                    {otShare > 0.5 && (
                      <> Most of it is overtime: <strong style={{ color: COLORS.gold }}>{fmt(finalYearOTMonthly)}/mo</strong> of what you
                      would earn that year is not pensionable, so it does not follow you out the door.</>
                    )}
                    {cut > 0 && finalYearOTMonthly === 0 && (
                      <> You have no overtime entered. If you work any, put it in on <strong style={{ color: COLORS.textMuted }}>Working now</strong> — it will widen this gap.</>
                    )}
                    {cut <= 0 && (
                      <> You stop paying the {memberType === "classic" ? "9%" : "11.5%"} CalPERS contribution, union dues and the
                      active medical premium, and that more than covers the drop from salary to pension
                      {finalYearOTMonthly === 0 ? " — though you have no overtime entered, which would change this." : "."}</>
                    )}
                  </div>
                </div>
              );
            })()}
            {tab === "stayorgo" && (
              <div style={{ ...styles.card, marginTop: setupDone ? "18px" : 0 }}>
                <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>Every year you could go</p>
                <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px", lineHeight: 1.6 }}>
                  The same calculation run for every year you could go. Your selected year is highlighted.
                  Tap any year to make it your plan.
                </div>
                {!setupDone && (
                  <div style={{ fontSize: "13px", color: COLORS.textMuted, padding: "24px", textAlign: "center" }}>
                    Fill in <strong>Member details</strong> first.
                  </div>
                )}
                {setupDone && retireYearOptions.length === 0 && (
                  <div style={{ fontSize: "13px", color: COLORS.textMuted, padding: "24px", textAlign: "center" }}>
                    No eligible years in the next 12 — safety members cannot draw a pension before age 50.
                  </div>
                )}
                {setupDone && retireYearOptions.length > 0 && (
                  <>
                    <div style={{ marginBottom: "14px", padding: "14px", background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`, borderRadius: "10px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted, marginBottom: "10px" }}>
                        Three assumptions, yours to set
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={styles.label}>Labor Market Adjustment <span style={{ fontWeight: 400, color: COLORS.textDim }}>· Jan 2028</span></label>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input type="number" step="0.25" min={0} max={30} value={lmaPct || ""} placeholder="0"
                              onChange={e => setLmaPct(Math.max(0, +e.target.value || 0))}
                              style={{ ...styles.input, margin: 0 }} />
                            <span style={{ fontSize: "12px", color: COLORS.textMuted }}>%</span>
                          </div>
                          <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", lineHeight: 1.6 }}>
                            A one-time increase to base hourly rate, first full pay period January 2028
                            (MOU Ch.2 Art.I.A.3). Nobody knows the number yet — the 2027 Total Compensation
                            Study sets it, using survey data effective 9/1/2027.
                          </div>
                        </div>
                        <div>
                          <label style={styles.label}>Raises Local 1592 bargains</label>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input type="number" step="0.25" min={0} max={20} value={unionRaisePct || ""} placeholder="0"
                              onChange={e => setUnionRaisePct(Math.max(0, +e.target.value || 0))}
                              style={{ ...styles.input, margin: 0 }} />
                            <span style={{ fontSize: "12px", color: COLORS.textMuted }}>%/yr</span>
                          </div>
                          <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", lineHeight: 1.6 }}>
                            Applies to 2030 and later only. The MOU sets 2027 and 2029 and runs through
                            12/31/2029, so this dial cannot touch a year the contract already covers.
                          </div>
                        </div>
                        <div>
                          <label style={styles.label}>CPI / inflation</label>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input type="number" step="0.1" min={0} max={15} value={inflationRate || ""} placeholder="0"
                              onChange={e => setInflationRate(Math.max(0, +e.target.value || 0))}
                              style={{ ...styles.input, margin: 0 }} />
                            <span style={{ fontSize: "12px", color: COLORS.textMuted }}>%/yr</span>
                          </div>
                          <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px", lineHeight: 1.6 }}>
                            Converts future pay into today's dollars, and caps your retiree COLA — CalPERS pays
                            the lesser of your {pct(colaRate)} cap and actual CPI. Your first COLA lands
                            May 1, {firstColaYear} — the second calendar year after you retire.
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", marginTop: "12px", padding: "10px 12px", borderRadius: "8px", lineHeight: 1.7,
                        background: noAssumptions ? "rgba(16,185,129,0.08)" : "rgba(37,99,235,0.08)",
                        border: `1px solid ${noAssumptions ? "rgba(16,185,129,0.3)" : "rgba(37,99,235,0.28)"}`,
                        color: COLORS.textMuted }}>
                        {noAssumptions ? (
                          <><strong style={{ color: COLORS.green }}>All three at zero.</strong> Nothing is assumed. The only
                          thing moving these rows is the service credit you earn and, for PEPRA, your age factor.
                          The signed MOU increases for 2027 and 2029 are still in, because those are in the contract.
                          The 2028 Labor Market Adjustment is <em>not</em> in, because its number does not exist yet.</>
                        ) : (
                          <><strong style={{ color: COLORS.text }}>What you are assuming:</strong>{" "}
                          {(lmaPct || 0) > 0 && <>a {lmaPct}% Labor Market Adjustment in January 2028</>}
                          {(lmaPct || 0) > 0 && ((unionRaisePct || 0) > 0 || (inflationRate || 0) > 0) && ", "}
                          {(unionRaisePct || 0) > 0 && <>{unionRaisePct}%/yr bargained from 2030</>}
                          {(unionRaisePct || 0) > 0 && (inflationRate || 0) > 0 && " and "}
                          {(inflationRate || 0) > 0 && <>{inflationRate}%/yr CPI</>}.
                          {(lmaPct || 0) > 0 && <> The LMA lifts base hourly rate, so the 2029 increase and everything after compound on top of it.</>}
                          {(unionRaisePct || 0) > 0 && (inflationRate || 0) > 0 && (
                            Math.abs((unionRaisePct || 0) - (inflationRate || 0)) < 0.01
                              ? <> Pay keeps pace with inflation exactly, so what is left in these rows is the
                                effect of service and formula alone.</>
                              : ((unionRaisePct || 0) > (inflationRate || 0)
                                ? <> You are assuming pay beats inflation by {((unionRaisePct || 0) - (inflationRate || 0)).toFixed(2)} points a year.</>
                                : <> You are assuming pay falls behind inflation by {((inflationRate || 0) - (unionRaisePct || 0)).toFixed(2)} points a year.</>)
                          )}
                          {(unionRaisePct || 0) > 0 && (inflationRate || 0) === 0 && <> With CPI at zero, every dollar here is already a today's dollar.</>}
                          {(unionRaisePct || 0) === 0 && (inflationRate || 0) > 0 && <> No raises but positive CPI means real pay falls every year — a floor, not a forecast.</>}
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "13px" }}>
                        <thead>
                          <tr style={{ color: COLORS.textMuted, textAlign: "right" }}>
                            <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 600 }}>Go in</th>
                            <th style={{ padding: "6px 4px", fontWeight: 600 }}>Age</th>
                            <th style={{ padding: "6px 4px", fontWeight: 600 }}>Yrs</th>
                            <th style={{ padding: "6px 4px", fontWeight: 600 }}>%</th>
                            <th style={{ padding: "6px 4px", fontWeight: 600 }}>Pension / mo <span style={{ fontWeight: 400, fontSize: "10px" }}>· gross, today's $</span></th>
                            <th style={{ padding: "6px 4px", fontWeight: 600 }}>vs. earliest<br /><span style={{ fontWeight: 400, fontSize: "10px" }}>gross</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {retireYearOptions.map(r => {
                            const isSel = r.year === retirementYear;
                            // Compare like with like: gross allowance, in today's dollars.
                            const deltaToday = earliestRow ? r.pensionToday - earliestRow.pensionToday : 0;
                            return (
                              <tr key={r.year}
                                onClick={() => { setRetirementDateOverride(`${r.year}-${String(retMonthNum).padStart(2, "0")}-${String(retDayNum).padStart(2, "0")}`); setSetupDone(true); }}
                                style={{ cursor: "pointer", textAlign: "right",
                                  background: isSel ? "rgba(210,31,51,0.16)" : "transparent",
                                  borderTop: `1px solid ${COLORS.border}` }}>
                                <td style={{ textAlign: "left", padding: "9px 4px", fontWeight: isSel ? 800 : 600, color: isSel ? COLORS.accent : COLORS.text }}>
                                  {r.year}{r.atCap ? " ▪" : ""}
                                </td>
                                <td style={{ padding: "9px 4px", color: COLORS.textMuted }}>{Math.floor(r.age)}</td>
                                <td style={{ padding: "9px 4px", color: COLORS.textMuted }}>{r.yos.toFixed(1)}</td>
                                <td style={{ padding: "9px 4px", color: COLORS.textMuted }}>{pct(r.pensionPct)}</td>
                                <td style={{ padding: "9px 4px", fontWeight: 700, color: COLORS.green }}>{fmt(r.pensionToday)}</td>
                                <td style={{ padding: "9px 4px", color: deltaToday > 0 ? COLORS.green : (deltaToday < -1 ? COLORS.gold : COLORS.textDim) }}>
                                  {deltaToday > 0 ? "+" : ""}{Math.abs(deltaToday) < 1 ? "—" : fmt(deltaToday)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "12px", lineHeight: 1.7 }}>
                      {benefitIsCapped && capYearRow && <>▪ marks the year you reach the {pct(benefitMaxPct)} cap. From {capYearRow.year} on, the percentage stops moving — what still raises the number is your pay growing, and any service under a different CalPERS formula. Extra years in the capped bucket add nothing.<br /></>}
                      {!benefitIsCapped && <>Your formula has no cap, so every row keeps climbing.<br /></>}
                      This is your <strong style={{ color: COLORS.text }}>gross monthly allowance</strong> — the
                      same figure myCalPERS shows you. The section below works in <strong style={{ color: COLORS.text }}>take-home</strong>,
                      so its gains are smaller than the gross ones here by roughly your tax rate. Income tax and your retiree medical premium come off
                      the warrant afterward; CalPERS does not net them out of an estimate, and neither does this.
                      <div style={{ marginTop: "8px", color: COLORS.textMuted }}>
                        Every figure here is in <strong style={{ color: COLORS.text }}>today's dollars</strong> at the CPI
                        you set above, so the rows are comparable. A pension paid in 2035 arrives in 2035 dollars,
                        which buy less — showing those raw numbers would make waiting look better than it is.
                      </div>
                    </div>

                    {/* ── WHAT WAITING COSTS ─────────────────────────────────────────
                        Every year worked past the earliest date trades a year of pension
                        checks for a permanently larger pension. This is that trade, on a
                        take-home basis, because the 9% CalPERS member contribution, union
                        dues and the active medical premium only come out while working. */}
                    {earliestRow && retireYearOptions.length > 1 && (() => {
                      const E = earliestRow;
                      // Net cost of one year spent working instead of drawing the earliest pension,
                      // in today's dollars. Positive => the pension out-earns the paycheck.
                      // Positive => the pension out-earns the paycheck, so a year spent working costs you
                      // that much. NEGATIVE => the paycheck out-earns the pension and a year spent working
                      // PAYS you. Clamping that to zero threw away the strongest argument for waiting.
                      // What ONE named year of work costs, in today's dollars: the pension checks you
                      // forgo that year, less what that year's paycheck nets you. Every year used to be
                      // priced at TODAY'S paycheck, which understated the cost of waiting by every raise
                      // the member has not been paid yet.
                      const costOfWorkingYear = (y) => 12 * (E.takeHomeToday - workingTakeHomeTodayFor(y));
                      const firstExtraYear = E.year + 1;
                      const perYearForgone = costOfWorkingYear(firstExtraYear);
                      const earnsMoreWorking = perYearForgone < 0;
                      // With no raises and no CPI every year costs the same and the column IS linear;
                      // do not claim otherwise.
                      const lastYearInWindow = retireYearOptions[retireYearOptions.length - 1].year;
                      const costVaries = Math.abs(costOfWorkingYear(lastYearInWindow) - perYearForgone) > 1;
                      const rows = retireYearOptions.slice(1).map(r => {
                        const extraYears = r.year - E.year;
                        // Retiring in year r means working r as well, so the years given up run
                        // from the first year past the earliest through r itself.
                        let givenUp = 0;
                        for (let y = firstExtraYear; y <= r.year; y++) givenUp += costOfWorkingYear(y);
                        const gainPerYear = 12 * (r.takeHomeToday - E.takeHomeToday);
                        // Four real cases, and the tab used to collapse them into two:
                        //   cost to wait + bigger pension  -> it repays after N years
                        //   cost to wait + no bigger pension -> never repays
                        //   paid to wait + bigger pension  -> ahead from day one, forever
                        //   paid to wait + SMALLER pension -> ahead now, behind after N years
                        const crossover = gainPerYear > 0
                          ? (givenUp > 0 ? givenUp / gainPerYear : 0)
                          : (givenUp < 0 && gainPerYear < 0 ? Math.abs(givenUp) / Math.abs(gainPerYear) : null);
                        const verdict = gainPerYear > 0
                          ? (givenUp > 0 ? "repays" : "always")
                          : (givenUp < 0 ? "fades" : "never");
                        const breakEven = crossover;
                        const net20 = gainPerYear * 20 - givenUp;
                        return { ...r, extraYears, givenUp, gainPerYear, breakEven, net20, verdict,
                                 breakEvenAge: breakEven === null ? null : r.age + breakEven };
                      });
                      const freeToWait = perYearForgone <= 0;
                      const anyFades = rows.some(r => r.verdict === "fades");
                      return (
                        <div style={{ ...styles.card, marginTop: "18px" }}>
                          <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>What waiting actually costs</p>
                          <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "14px", lineHeight: 1.7 }}>
                            You can go in <strong style={{ color: COLORS.text }}>{E.year}</strong>. Every year you work past
                            that, you give up a year of pension checks to buy a permanently larger pension. This is that trade.
                            {freeToWait ? (
                              <> In {firstExtraYear} your paycheck out-earns that pension by <strong style={{ color: COLORS.green }}>{fmt(Math.abs(perYearForgone))}</strong>,
                              so working longer does not cost you anything in the meantime — it pays you.{costVaries && <> Each later
                              year is priced at its own paycheck, which grows.</>}
                              {anyFades
                                ? <> But at {inflationRate}% CPI the pension you end up with is <em>smaller</em> in today&rsquo;s
                                  dollars, so that head start runs out. The table says how long it lasts.</>
                                : <> And the pension is bigger at the end of it, so you are ahead from day one.</>}</>
                            ) : (
                              <> Working {firstExtraYear} nets you <strong style={{ color: COLORS.text }}>{fmt(workingTakeHomeTodayFor(firstExtraYear))}</strong>/mo
                              take-home; your {E.year} pension would pay <strong style={{ color: COLORS.text }}>{fmt(E.takeHomeToday)}</strong>/mo.
                              So that year costs you <strong style={{ color: COLORS.gold }}>{fmt(perYearForgone)}</strong> you
                              would otherwise have banked.{costVaries && <> Each later year is priced at <em>its own</em> paycheck,
                              which grows — so the column below is not this figure simply multiplied out.</>}</>
                            )}
                          </div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "13px" }}>
                              <thead>
                                <tr style={{ color: COLORS.textMuted, textAlign: "right" }}>
                                  <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 600 }}>Go in</th>
                                  <th style={{ padding: "6px 4px", fontWeight: 600 }}>Extra yrs<br />worked</th>
                                  <th style={{ padding: "6px 4px", fontWeight: 600 }}>Cash you gain or give<br />up getting there</th>
                                  <th style={{ padding: "6px 4px", fontWeight: 600 }}>Take-home gain<br />per year, for life</th>
                                  <th style={{ padding: "6px 4px", fontWeight: 600 }}>Breaks even</th>
                                  <th style={{ padding: "6px 4px", fontWeight: 600 }}>Net after<br />20 yrs retired</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map(r => (
                                  <tr key={r.year} style={{ textAlign: "right", borderTop: `1px solid ${COLORS.border}`,
                                    background: r.year === retirementYear ? "rgba(210,31,51,0.16)" : "transparent" }}>
                                    <td style={{ textAlign: "left", padding: "9px 4px", fontWeight: r.year === retirementYear ? 800 : 600,
                                      color: r.year === retirementYear ? COLORS.accent : COLORS.text }}>{r.year}</td>
                                    <td style={{ padding: "9px 4px", color: COLORS.textMuted }}>{r.extraYears}</td>
                                    <td style={{ padding: "9px 4px", color: r.givenUp > 0 ? COLORS.gold : COLORS.green }}>
                                      {r.givenUp > 0 ? "−" + fmt(r.givenUp) : "+" + fmt(Math.abs(r.givenUp))}
                                    </td>
                                    <td style={{ padding: "9px 4px", color: r.gainPerYear > 0 ? COLORS.green : COLORS.gold }}>
                                      {r.gainPerYear > 0 ? "+" : ""}{Math.abs(r.gainPerYear) < 1 ? "—" : fmt(r.gainPerYear)}
                                    </td>
                                    <td style={{ padding: "9px 4px", color: COLORS.textMuted }}>
                                      {r.verdict === "always" ? "ahead from day one"
                                        : r.verdict === "never" ? "never"
                                        : r.verdict === "fades" ? `ahead ${r.breakEven.toFixed(1)} yrs, then behind`
                                        : `${r.breakEven.toFixed(1)} yrs · age ${Math.round(r.breakEvenAge)}`}
                                    </td>
                                    <td style={{ padding: "9px 4px", fontWeight: 700, color: r.net20 >= 0 ? COLORS.green : COLORS.gold }}>
                                      {r.net20 >= 0 ? "+" : "−"}{fmt(Math.abs(r.net20))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "12px", lineHeight: 1.7 }}>
                            <strong style={{ color: COLORS.textMuted }}>Read it like this:</strong> &ldquo;Breaks even&rdquo; is how many
                            years into retirement the bigger pension finally repays the checks you skipped to get it — and how old you
                            are when it does. <strong style={{ color: COLORS.textMuted }}>Ahead from day one</strong> means your
                            paycheck already beats your pension <em>and</em> the later pension is bigger — waiting wins on both counts.
                            <strong style={{ color: COLORS.textMuted }}> Ahead N yrs, then behind</strong> means you gain now but the
                            later pension is smaller in today&rsquo;s dollars, so the early gain runs out.
                            <strong style={{ color: COLORS.textMuted }}> Never</strong> means the later pension is no larger and
                            nothing repays the checks you skipped.
                            <div style={{ marginTop: "8px" }}>
                              Take-home, not gross, because the 9% CalPERS member contribution, union dues and the active medical
                              premium stop when you retire — comparing a paycheck to a pension on gross would flatter working.
                              Everything is in today&rsquo;s dollars at the CPI you set above.
                            </div>
                            <div style={{ marginTop: "8px" }}>
                              What this does <em>not</em> count: your 457 growing while you keep contributing, sick leave and vacation
                              accruing, health coverage between now and Medicare, and the plain fact that your years are worth
                              something on their own. It is one number in a decision that is not only about numbers.
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ═══════════════ SICK LEAVE ═══════════════ */}

          </div>
          {/* RIGHT PANEL */}
          <div>
            {tab === "survivor" && setupDone && (
              <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                <p style={{ ...styles.cardTitle, marginBottom: "4px" }}>Who gets it after you</p>
                <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px", lineHeight: 1.6 }}>
                  Two different things decide what your spouse receives, and almost everyone confuses them.
                  Work through them in order. Whatever you pick here drives every figure in this tool.
                </div>

                {/* ── 1 · SURVIVOR CONTINUANCE — the part you do not pay for ── */}
                <div style={{ padding: "14px", background: "rgba(16,185,129,0.07)", border: `1px solid ${COLORS.green}`, borderRadius: "10px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: COLORS.green, marginBottom: "8px" }}>
                    1 &middot; Survivor continuance &mdash; free, and not an election
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.7, marginBottom: "10px" }}>
                    CalPERS pays an eligible survivor <strong style={{ color: COLORS.text }}>half your unmodified allowance</strong>, for
                    life. The City funds it. It costs you nothing, it is the same under every option below, and you
                    cannot trade it away. An eligible spouse is one you were
                    <strong style={{ color: COLORS.text }}> married to at least one year before your retirement date</strong> and
                    stay married to until your death.
                  </div>
                  <label style={styles.label}>Do you have an eligible survivor?</label>
                  <select style={{ ...styles.select, marginBottom: "10px" }} value={hasEligibleSurvivor ? "yes" : "no"}
                    onChange={e => setHasEligibleSurvivor(e.target.value === "yes")}>
                    <option value="yes">Yes &mdash; spouse, or eligible child</option>
                    <option value="no">No</option>
                  </select>
                  {hasEligibleSurvivor ? (
                    <div style={{ ...styles.tableRowLast, borderBottom: "none", paddingBottom: 0 }}>
                      <span style={styles.tableKey}>Your survivor receives, for life</span>
                      <span style={{ ...styles.tableVal, color: COLORS.green, fontWeight: 700, fontSize: "15px" }}>{fmt(survivorContinuance)}/mo</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: COLORS.gold, lineHeight: 1.7 }}>
                      With no eligible survivor there is no continuance, and the option election below is the only
                      thing that leaves anyone a monthly benefit &mdash; so the reduction is figured on your whole allowance
                      rather than on half of it.
                    </div>
                  )}
                </div>

                {/* ── 2 · THE ELECTION — the part you buy ── */}
                <div style={{ fontSize: "12px", fontWeight: 700, color: COLORS.accent, marginBottom: "8px" }}>
                  2 &middot; Your option election &mdash; this one you pay for
                </div>
                <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "12px", lineHeight: 1.7 }}>
                  Naming a beneficiary buys a continuing allowance out of the
                  {" "}<strong style={{ color: COLORS.text }}>option portion</strong> &mdash; the {fmt(optionPortion)}/mo
                  that sits above the survivor continuance. The reduction comes out of that portion only, never out of
                  the continuance. If your beneficiary is the same spouse who is your survivor, they collect both.
                </div>
                <label style={styles.label}>Your beneficiary&rsquo;s age at your retirement</label>
                <input type="number" style={{ ...styles.input, marginBottom: "14px" }} value={beneficiaryAge || ""}
                  min={18} max={100} placeholder={`${retirementAge}`}
                  onChange={e => setBeneficiaryAge(+e.target.value || 0)} />

                <div style={{ overflowX: "auto", marginBottom: "6px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "12px" }}>
                    <thead>
                      <tr style={{ color: COLORS.textMuted, textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.5px" }}>
                        <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 600 }}>Option</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 600 }}>You</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 600 }}>{hasEligibleSurvivor ? "Spouse" : "Beneficiary"}</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 600 }}>Costs you</th>
                      </tr>
                    </thead>
                    <tbody>
                      {survivorOptions.map(o => {
                        const on = o.key === survivorOption;
                        return (
                          <tr key={o.key} onClick={() => setSurvivorOption(o.key)}
                            style={{ cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`,
                              background: on ? "rgba(210,31,51,0.10)" : "transparent" }}>
                            <td style={{ padding: "9px 4px", color: on ? COLORS.text : COLORS.textMuted, fontWeight: on ? 700 : 400 }}>
                              {on ? "● " : "○ "}{o.short}
                            </td>
                            <td style={{ padding: "9px 4px", textAlign: "right", color: COLORS.text, fontWeight: on ? 700 : 400 }}>{fmt(o.memberMonthly)}</td>
                            <td style={{ padding: "9px 4px", textAlign: "right", color: o.spouseTotal > 0 ? COLORS.green : COLORS.textDim, fontWeight: on ? 700 : 400 }}>
                              {o.key === "roc" ? (hasEligibleSurvivor ? fmt(o.survivorMonthly) + " + cash" : "cash only")
                                : o.spouseTotal > 0 ? fmt(o.spouseTotal) : "nothing"}
                            </td>
                            <td style={{ padding: "9px 4px", textAlign: "right", color: o.costMonthly > 0 ? COLORS.gold : COLORS.textDim }}>
                              {o.costMonthly > 0 ? "−" + fmt(o.costMonthly) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: "10px", color: COLORS.textDim, marginBottom: "14px" }}>
                  Tap a row to elect it. Gross monthly, before tax and medical.
                  {hasEligibleSurvivor && " The spouse column assumes your beneficiary is the same person as your survivor — the usual case — so it adds the continuance and the beneficiary allowance together."}
                </div>

                {/* ── 3 · WHAT YOU JUST PICKED ── */}
                <div style={{ padding: "14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}`, borderRadius: "10px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: COLORS.text, marginBottom: "8px" }}>{survivorChosen.label}</div>
                  <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.75, marginBottom: "12px" }}>{survivorChosen.note}</div>

                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Unmodified allowance <span style={{ fontSize: "10px", color: COLORS.textDim }}>&middot; the maximum</span></span>
                    <span style={styles.tableVal}>{fmt(monthlyPensionUnmodified)}/mo</span>
                  </div>
                  {optionCostMonthly > 0 && (
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>
                        What this election costs you
                        <span style={{ fontSize: "10px", color: COLORS.textDim }}> &middot; {pctExact(optionReductionPct)} of the allowance{usingActualOptionPct ? ", your figure" : ""}</span>
                      </span>
                      <span style={{ ...styles.tableVal, color: COLORS.gold }}>&minus;{fmt(optionCostMonthly)}/mo</span>
                    </div>
                  )}
                  <div style={{ ...styles.tableRow, borderTop: `1px solid ${COLORS.border}` }}>
                    <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text }}>Your check</span>
                    <span style={{ ...styles.tableValAccent, fontSize: "16px" }}>{fmt(monthlyPension)}/mo</span>
                  </div>
                  {hasEligibleSurvivor && (
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Survivor continuance <span style={{ fontSize: "10px", color: COLORS.textDim }}>&middot; free, every option</span></span>
                      <span style={{ ...styles.tableVal, color: COLORS.green }}>{fmt(survivorContinuance)}/mo</span>
                    </div>
                  )}
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>
                      Beneficiary allowance
                      {survivorChosen.benPct > 0 && <span style={{ fontSize: "10px", color: COLORS.textDim }}> &middot; {pct(survivorChosen.benPct)} of the option portion</span>}
                    </span>
                    <span style={{ ...styles.tableVal, color: beneficiaryMonthly > 0 ? COLORS.green : COLORS.textDim }}>
                      {beneficiaryMonthly > 0 ? fmt(beneficiaryMonthly) + "/mo" : survivorChosen.key === "roc" ? "lump sum instead" : "none"}
                    </span>
                  </div>
                  <div style={{ ...styles.tableRowLast, borderTop: `1px solid ${COLORS.border}` }}>
                    <span style={{ ...styles.tableKey, fontWeight: 700, color: COLORS.text }}>
                      {hasEligibleSurvivor ? "Your spouse ends up with" : "Your beneficiary ends up with"}
                      <span style={{ fontSize: "10px", color: COLORS.textDim, display: "block", fontWeight: 400 }}>
                        if they are both your survivor and your named beneficiary
                      </span>
                    </span>
                    <span style={{ ...styles.tableVal, color: spouseTotalMonthly > 0 ? COLORS.green : COLORS.textDim, fontWeight: 700, fontSize: "16px" }}>
                      {spouseTotalMonthly > 0 ? fmt(spouseTotalMonthly) + "/mo" : "nothing monthly"}
                    </span>
                  </div>

                  {spouseTotalMonthly > 0 && monthlyPension > 0 && (
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "10px", lineHeight: 1.7 }}>
                      That is <strong style={{ color: COLORS.green }}>{pct(Math.min(1, spouseTotalMonthly / monthlyPension))}</strong> of
                      the check you were drawing.
                      {optionCostMonthly > 0 && beneficiaryMonthly > 0 && <>
                        {" "}You give up {fmt(optionCostMonthly)}/mo to buy them {fmt(beneficiaryMonthly)}/mo &mdash;
                        about <strong style={{ color: COLORS.text }}>{(beneficiaryMonthly / optionCostMonthly).toFixed(1)}&times;</strong> what
                        it costs you.
                      </>}
                    </div>
                  )}
                  {popUpMonthly !== null && survivorChosen.benPct > 0 && (
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: 1.7 }}>
                      <strong style={{ color: COLORS.textMuted }}>If your beneficiary dies before you:</strong> your check
                      {popUpMonthly > monthlyPension
                        ? <> goes back up to <strong style={{ color: COLORS.green }}>{fmt(popUpMonthly)}/mo</strong>.</>
                        : <> stays at <strong style={{ color: COLORS.gold }}>{fmt(popUpMonthly)}/mo</strong> for the rest of your life &mdash; you keep paying for a benefit nobody collects.</>}
                    </div>
                  )}
                  {survivorChosen.key === "roc" && (
                    <div style={{ fontSize: "11px", color: COLORS.gold, marginTop: "8px", lineHeight: 1.7 }}>
                      Watch the clock on this one. The lump sum is your remaining contributions, and it shrinks every
                      month you collect. Ask myCalPERS what your balance is and how long it lasts &mdash; if you outlive it,
                      this election pays your beneficiary nothing at all.
                    </div>
                  )}
                  {survivorChosen.key === "unmod" && hasEligibleSurvivor && (
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: 1.7 }}>
                      Taking the maximum does <strong style={{ color: COLORS.text }}>not</strong> leave your spouse with nothing.
                      The survivor continuance is still there. What it does not do is add anything on top.
                    </div>
                  )}
                  {survivorChosen.key === "unmod" && !hasEligibleSurvivor && (
                    <div style={{ fontSize: "11px", color: COLORS.gold, marginTop: "8px", lineHeight: 1.7 }}>
                      With no eligible survivor and no beneficiary election, nothing continues to anyone after you die.
                    </div>
                  )}
                </div>

                {/* ── 4 · HONESTY ABOUT THE FACTORS ── */}
                {survivorOption !== "unmod" && (
                  <div style={{ padding: "12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: COLORS.gold, marginBottom: "6px" }}>
                      &#9888; The reduction is calibrated, not yours
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, lineHeight: 1.7, marginBottom: "10px" }}>
                      The structure above is verified &mdash; it reproduces a real myCalPERS estimate to the dollar. The
                      reduction percentage is not yours: it comes from {OPTION_FACTOR_ANCHOR}. CalPERS sets it from your
                      age and your beneficiary&rsquo;s age and publishes no table, so expect somewhere around
                      {" "}<strong style={{ color: COLORS.gold }}>{pctExact(optionBandLow)} to {pctExact(optionBandHigh)}</strong>.
                      A beneficiary younger than that estimate&rsquo;s costs more; an older one costs less.
                      {" "}<strong style={{ color: COLORS.gold }}>Run your own estimate and put the real number here.</strong>
                    </div>
                    <label style={styles.label}>Your reduction from myCalPERS <span style={{ fontSize: "10px", color: COLORS.textDim }}>&middot; optional</span></label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <input type="number" step="0.01" min={0} max={50} value={survivorActualPct}
                        placeholder={(optionReductionPct * 100).toFixed(2)}
                        onChange={e => setSurvivorActualPct(e.target.value)}
                        style={{ ...styles.input, margin: 0, width: "120px" }} />
                      <span style={{ fontSize: "12px", color: COLORS.textMuted }}>% off the unmodified allowance</span>
                    </div>
                    <div style={{ fontSize: "11px", color: usingActualOptionPct ? COLORS.green : COLORS.textDim, marginTop: "6px", lineHeight: 1.6 }}>
                      {usingActualOptionPct
                        ? `✓ Using your figure — ${survivorActualNum}%. The calibrated number is ignored everywhere.`
                        : "From your myCalPERS options table: (Unmodified − this option) ÷ Unmodified. In the verified example, (17,728 − 16,922) ÷ 17,728 = 4.55%."}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "12px", lineHeight: 1.7 }}>
                  Survivor continuance requires that your employer contracted for it and that your survivor qualifies.
                  It shows on every row of a myCalPERS estimate when it applies to you. The election generally
                  <strong style={{ color: COLORS.textMuted }}> locks at retirement</strong>. Confirm both with CalPERS at
                  888-225-7377 before you file &mdash; this tool is an estimate, not a benefit statement.
                </div>
              </div>
            )}
            {tab === "health" && (
              <div style={styles.card}>
                {sectionHeader("medplan", `Medical, dental & vision \u00b7 while working \u00b7 ${healthRates.year} rates`)}
                {openSections.medplan !== false && (<>
                {/* ── RATE YEAR PICKER ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <label style={{ ...styles.label, marginBottom: 0, flex: "none" }}>Rate year</label>
                  <select style={{ ...styles.select, margin: 0, width: "auto", minWidth: "170px" }}
                    value={healthRateYear} onChange={e => setHealthRateYear(Number(e.target.value))}>
                    {HEALTH_RATE_YEARS.map(y => (
                      <option key={y} value={y}>
                        {y}{!MEDICAL_PLANS_BY_YEAR[y] ? " · pending" : y === HEALTH_RATE_CURRENT ? " · current" : ""}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "11px", color: COLORS.textDim }}>CalPERS Region 1 &middot; Placer County</span>
                </div>
                {healthRates.pending && (
                  <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: "8px", marginBottom: "12px", fontSize: "11px", color: COLORS.textDim, lineHeight: 1.7 }}>
                    <strong style={{ color: COLORS.gold }}>{healthRates.askedFor} rates are not published yet.</strong> CalPERS
                    sets the following year&rsquo;s premiums around June and they take effect the next January 1. Rather than
                    guess, every figure below is the <strong style={{ color: COLORS.text }}>{healthRates.year}</strong> rate.
                    Expect the real {healthRates.askedFor} numbers to land higher &mdash; CalPERS held 2027 to a 4.97% increase.
                  </div>
                )}
                {(selectedPlanMissing || retireePlanMissing) && (
                  <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: "8px", marginBottom: "12px", fontSize: "11px", color: COLORS.textDim, lineHeight: 1.7 }}>
                    <strong style={{ color: COLORS.gold }}>Your plan did not exist in {healthRates.year}.</strong> Showing
                    {" "}{selectedPlanObj.name} instead so the figures below are real. UnitedHealthcare Alliance and Harmony
                    left CalPERS after 2026; Sutter Health Plan and Blue Shield EPO arrived for 2027.
                  </div>
                )}
                <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "12px" }}>
                  Your tier: <strong style={{ color: COLORS.gold }}>Tier {medicalTier}</strong> (hired {hireYear}). Pick a plan and coverage to see your cost.
                </div>
                <div style={styles.row}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Medical Plan</label>
                    <select style={styles.select} value={selectedMedicalPlan} onChange={e => setSelectedMedicalPlan(e.target.value)}>
                      {MEDICAL_PLANS.map(p => <option key={p.name} value={p.name}>{p.name}{p.isNew ? " \u00b7 new" : ""}</option>)}
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Coverage</label>
                    <select style={styles.select} value={medicalCoverage} onChange={e => setMedicalCoverage(e.target.value)}>
                      <option value="ee">Employee only</option>
                      <option value="ee1">Employee + 1 dependent</option>
                      <option value="fam">Employee + family</option>
                    </select>
                  </div>
                </div>
                <div style={styles.row}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Dental Plan</label>
                    <select style={styles.select} value={dentalPlan} onChange={e => setDentalPlan(e.target.value)}>
                      {DENTAL_PLANS_2026.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Vision (VSP)</label>
                    <select style={styles.select} value={hasVision ? "yes" : "no"} onChange={e => setHasVision(e.target.value === "yes")}>
                      <option value="yes">Enrolled</option>
                      <option value="no">None</option>
                    </select>
                  </div>
                </div>
                <div style={{ textAlign: "center", padding: "20px", background: "rgba(210,31,51,0.10)", borderRadius: "10px", margin: "12px 0 16px" }}>
                  <div style={styles.metricLabel}>Your cost from your paycheck</div>
                  <div style={styles.bigNumber}>{fmt(medicalTotalOOP)}/mo</div>
                  <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "6px" }}>medical + dental + vision, after the City's share</div>
                </div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Medical premium ({selectedMedicalPlan})</span><span style={styles.tableVal}>{fmt(selectedPremium)}/mo</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>− City pays (up to {Math.round((CITY_MED_PCT[medicalCoverage] || 1) * 100)}% of Kaiser {MEDICAL_COVERAGE_LABELS[medicalCoverage].toLowerCase()})</span><span style={styles.tableValGreen}>−{fmt(cityMedicalPaid)}/mo</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}><strong>Your medical cost</strong></span><span style={styles.tableValAccent}>{fmt(medicalOOP)}/mo</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Dental + vision ({dentalPlan}{hasVision ? " + VSP" : ""})</span><span style={styles.tableVal}>{fmt(dvCost)}/mo</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>− City pays (up to $180)</span><span style={styles.tableValGreen}>−{fmt(dvCityPaid)}/mo</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}><strong>Your dental/vision cost</strong></span><span style={styles.tableValAccent}>{fmt(dvOOP)}/mo</span></div>
                <div style={styles.tableRowLast}><span style={styles.tableKey}><strong>Total from your paycheck</strong></span><span style={styles.tableValAccent}>{fmt(medicalTotalOOP)}/mo</span></div>
                <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: "1.6" }}>
                  Per the MOU, the City pays up to {Math.round((CITY_MED_PCT[medicalCoverage] || 1) * 100)}% of the Kaiser premium for your tier, plus $180 toward dental/vision. If your plan costs less than the City's share, the difference is <strong>not</strong> paid to you. Opting out of all coverage (with proof of other insurance) pays $150/mo instead.
                </div>
                <p style={{ ...styles.cardTitle, marginTop: "18px" }}>
                  In retirement &mdash; your medical &middot; {healthRates.year} rates
                  <span style={{ fontSize: "11px", color: COLORS.textDim, fontWeight: 400 }}> &middot; Tier {medicalTier}</span>
                </p>
                <div style={{ fontSize: "12px", color: COLORS.gold, marginBottom: "8px", lineHeight: "1.6" }}>
                  ⚠ You only get the City's retiree contribution if you enroll in a CalPERS (PEMHCA) medical plan in retirement — no CalPERS plan, no City money.
                </div>
                {medicalTier === "4" ? (
                  <>
                    <div style={styles.tableRow}><span style={styles.tableKey}>Your contributions (currently {medical.empCurrentPct}% of base · {fmt(medical.empCurrentMonthly)}/mo)</span><span style={styles.tableVal}>{fmt(medical.empContribTotal)}</span></div>
                    <div style={styles.tableRow}><span style={styles.tableKey}>City contributions ($100/mo, year 6+)</span><span style={styles.tableVal}>{fmt(medical.cityContribTotal)}</span></div>
                    <div style={styles.tableRow}><span style={styles.tableKey}>Investment growth ({rhsReturn}%/yr)</span><span style={styles.tableValGreen}>{fmt(medical.growthTotal)}</span></div>
                    <div style={styles.tableRow}><span style={styles.tableKey}><strong>RHS balance at retirement</strong></span><span style={styles.tableValAccent}>{fmt(medical.rhsBalance)}</span></div>
                    <div style={styles.tableRowLast}><span style={styles.tableKey}>In today's dollars ({inflationRate}% inflation)</span><span style={styles.tableVal}>{fmt(medical.rhsBalance / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement))}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                      <label style={{ ...styles.label, marginBottom: 0 }}>Assumed return</label>
                      <input style={{ ...styles.input, width: "90px" }} type="number" step="0.5" min={0} max={15} value={rhsReturn} onChange={e => setRhsReturn(parseFloat(e.target.value) || 0)} />
                      <span style={{ color: COLORS.textDim, fontSize: "12px" }}>%/yr</span>
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: "1.6" }}>
                      Tier 4 has no lifetime monthly subsidy. Per the MOU you contribute 1% of base pay at hire, rising 1%/yr to a 5% max; the City adds $100/mo from your 6th year. The account can be used only for qualified medical expenses (IRS §213) — premiums, copays, dental, vision — including non-City plans. It can't be cashed out for non-medical use. Growth is an estimate, not guaranteed.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.tableRow}><span style={styles.tableKey}>City contribution toward premium ({pct(medical.vested)} vested, Tier {medicalTier})</span><span style={styles.tableValGreen}>{fmt(medical.monthly)}/mo</span></div>
                    {medical.eligible === false && (
                      <div style={{ fontSize: "11px", color: COLORS.gold, marginTop: "4px", lineHeight: "1.6" }}>⚠ Not yet eligible — retiree medical needs at least 5 years at Roseville and 10 years of total CalPERS-credited service.</div>
                    )}
                    <div style={styles.row}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Retiree plan</label>
                        <select style={styles.select} value={retireeMedicalPlan} onChange={e => setRetireeMedicalPlan(e.target.value)}>
                          {MEDICAL_PLANS.map(p => <option key={p.name} value={p.name}>{p.name}{p.isNew ? " \u00b7 new" : ""}</option>)}
                        </select>
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Coverage</label>
                        <select style={styles.select} value={retireeCoverage} onChange={e => setRetireeCoverage(e.target.value)}>
                          <option value="ee">Employee only</option>
                          <option value="ee1">Employee + 1</option>
                          <option value="fam">Employee + family</option>
                        </select>
                      </div>
                    </div>
                    <div style={styles.tableRow}><span style={styles.tableKey}>{retireeMedicalPlan} premium</span><span style={styles.tableVal}>{fmt(retireePremium)}/mo</span></div>
                    <div style={styles.tableRowLast}><span style={styles.tableKey}><strong>Your net retiree premium</strong> <span style={{ fontSize: "10px", color: COLORS.textDim }}>&middot; the out-of-pocket line on the Overview tab</span></span><span style={styles.tableValAccent}>{fmt(retireeMedicalOOP)}/mo</span></div>
                    {/* ── WHAT IT COSTS ONCE MEDICARE STARTS ── */}
                    <div style={{ marginTop: "18px", padding: "14px", background: "rgba(16,185,129,0.06)", border: `1px solid ${COLORS.green}`, borderRadius: "10px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: COLORS.green, marginBottom: "6px" }}>
                        At 65 the premium drops &mdash; a lot
                      </div>
                      <div style={{ fontSize: "12px", color: COLORS.textMuted, lineHeight: 1.7, marginBottom: "10px" }}>
                        The rates above are the <strong style={{ color: COLORS.text }}>Basic</strong> premiums, and they are what you pay
                        from the day you retire until you turn 65 &mdash; about
                        {" "}<strong style={{ color: COLORS.text }}>{Math.max(0, 65 - retirementAge)} years</strong> for you.
                        At 65 you move to a Medicare plan and the premium falls by roughly two thirds. Your City contribution
                        ({fmt(cityMedicalContribution)}/mo) is unchanged, so most members go to <strong style={{ color: COLORS.green }}>$0 out of pocket</strong> at that point.
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "12px" }}>
                        <thead>
                          <tr style={{ color: COLORS.textMuted, textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.5px" }}>
                            <th style={{ textAlign: "left", padding: "5px 4px", fontWeight: 600 }}>Medicare plan &middot; {medicareRates.year}</th>
                            <th style={{ textAlign: "right", padding: "5px 4px", fontWeight: 600 }}>Premium</th>
                            <th style={{ textAlign: "right", padding: "5px 4px", fontWeight: 600 }}>Your cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MEDICARE_PLANS.map(p => {
                            const prem = p[MEDICARE_TIER_FROM_COVERAGE[retireeCoverage] || "single"] || p.single;
                            const oop = Math.max(0, prem - cityMedicalContribution);
                            return (
                              <tr key={p.name} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                                <td style={{ padding: "7px 4px", color: COLORS.textMuted }}>
                                  {p.name}
                                  <span style={{ fontSize: "10px", color: COLORS.textDim }}> &middot; {p.kind}</span>
                                </td>
                                <td style={{ padding: "7px 4px", textAlign: "right", color: COLORS.text }}>{fmt(prem)}</td>
                                <td style={{ padding: "7px 4px", textAlign: "right", color: oop > 0 ? COLORS.gold : COLORS.green, fontWeight: 600 }}>
                                  {oop > 0 ? fmt(oop) : "$0"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "8px", lineHeight: 1.7 }}>
                        You must enroll in Medicare Part A and Part B at 65 to keep a CalPERS plan. The Part B premium is paid
                        to Medicare separately and is <strong style={{ color: COLORS.textMuted }}>not</strong> in these figures.
                        Rates are CalPERS {medicareRates.year}, Region 1, for your coverage tier.
                        {medicareRates.year !== healthRates.year && (
                          <> <strong style={{ color: COLORS.gold }}>Note:</strong> the Basic rates above are
                          {" "}{healthRates.year}, but we only hold Medicare figures for {medicareRates.year} — so this
                          table is {medicareRates.year} money while the rest of the page is {healthRates.year}.</>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <p style={{ ...styles.cardTitle, marginTop: "18px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => toggleSection("allPlans")}>
                  <span>All {healthRates.year} plans{healthRates.pending ? ` \u00b7 ${healthRates.askedFor} pending` : ""}</span>
                  <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections.allPlans ? "▾" : "▸ tap to open"}</span>
                </p>
                {openSections.allPlans && (
                  <table style={styles.colaTable}>
                    <thead>
                      <tr style={{ color: COLORS.textMuted, fontSize: "11px", textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", padding: "6px 0", fontWeight: "600" }}>Plan</th>
                        <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>You</th>
                        <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>+1</th>
                        <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>+2 or more</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MEDICAL_PLANS.map(p => (
                        <tr key={p.name} style={{ borderBottom: `1px solid ${COLORS.border}`, background: p.name === selectedMedicalPlan ? "rgba(210,31,51,0.08)" : "transparent", cursor: "pointer" }} onClick={() => setSelectedMedicalPlan(p.name)}>
                          <td style={{ padding: "8px 0", color: COLORS.text, fontSize: "13px" }}>{p.name}</td>
                          <td style={{ textAlign: "right", color: COLORS.textMuted, fontSize: "13px" }}>{fmt(p.ee)}</td>
                          <td style={{ textAlign: "right", color: COLORS.textMuted, fontSize: "13px" }}>{fmt(p.ee1)}</td>
                          <td style={{ textAlign: "right", color: COLORS.textMuted, fontSize: "13px" }}>{fmt(p.fam)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: "16px", padding: "10px 12px", background: "rgba(210,31,51,0.06)", borderRadius: "6px", fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.6" }}>
                  ⚠ <strong>Approximation.</strong> Per the MOU (Ch.4 Art.I §C), the City pays up to 100% / 85% / 80% of the Kaiser premium (employee / +1 / family) plus $180 toward dental and vision. You pay only the amount above the City's share — if your plan costs less, the difference is <strong>not</strong> paid out to you. Declining all coverage (with proof of other insurance) pays $150/mo instead. Dental and vision use your medical coverage tier and are <strong>2026</strong> rates in every year above — the rate-year picker moves the CalPERS medical premiums only, because dental and vision are City/Delta Dental figures we do not have for other years. The retiree-medical figure below is separate (set by your hire-date tier). Confirm exact figures with the City.
                </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("otsurv", "Overtime")}
                {openSections.otsurv !== false && (<>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Overtime worked <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· hrs/mo</span></label>
                    <input style={styles.input} type="number" step="1" min={0} value={currentOTHours || ""} placeholder="0" onChange={e => setCurrentOTHours(parseFloat(e.target.value) || 0)} />
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px", lineHeight: 1.5 }}>Adds to your working take-home — not pensionable, and gone in retirement.</div>
                    {otMonthly > 0 && (
                      <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "8px", padding: "8px 10px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", lineHeight: 1.6 }}>
                        <strong style={{ color: COLORS.gold }}>{fmt(otMonthly)}/mo</strong> gross OT → <strong style={{ color: COLORS.green }}>{fmt(otMonthly - (taxSalaryOT.tax - workTaxAnnual) / 12)}/mo</strong> after tax, added to your working take-home.
                      </div>
                    )}
                  </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("sav457", "457 deferred compensation")}
                {openSections.sav457 !== false && (<>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Current 457 balance</label>
                    <input style={styles.input} type="number" value={current457 || ""} onChange={e => setCurrent457(+e.target.value || 0)} placeholder="0" />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Your annual contribution: {fmt(effectiveMember457)}</label>
                    <input type="range" min={0} max={memberMax457 || MAX_457_ANNUAL} step={500} value={Math.min(annual457Contrib, memberMax457 || MAX_457_ANNUAL)} onChange={e => setAnnual457Contrib(+e.target.value || 0)} style={{ width: "100%", accentColor: COLORS.accent }} />
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "6px", lineHeight: 1.6 }}>
                      2026 ceiling at age {Math.floor(retireAgeQ)}: <strong style={{ color: COLORS.gold }}>{fmt(limit457ThisYear)}</strong>
                      {catchup457Available > 0 && <span> — base {fmt(MAX_457_ANNUAL)} + {fmt(catchup457Available)} catch-up</span>}
                      {cityMatchAnnual > 0 && <span> · less the City's {fmt(cityMatchAnnual)} match leaves you {fmt(memberMax457)}</span>}
                    </div>
                    {Math.floor(retireAgeQ) >= normalRetirementAge - 3 && Math.floor(retireAgeQ) < normalRetirementAge && (
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "10px", fontSize: "12px", color: COLORS.text, cursor: "pointer" }}>
                        <input type="checkbox" checked={useSpecial457Catchup} onChange={e => setUseSpecial457Catchup(e.target.checked)} style={{ marginTop: "3px", accentColor: COLORS.accent }} />
                        <span>
                          Use the <strong>457(b) three-year pre-retirement catch-up</strong> — up to {fmt(MAX_457_SPECIAL_3YR)} this year.
                          <span style={{ display: "block", color: COLORS.textDim, fontSize: "11px", marginTop: "2px" }}>
                            A one-time election available only in the three years before normal retirement age
                            (age {normalRetirementAge} for you). It cannot be combined with the age-based catch-up —
                            you take the greater. Limited to what you under-contributed in earlier years, so confirm
                            your own figure with the plan administrator.
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Your contribution</span>
                      <span style={styles.tableVal}>{fmt(effectiveMember457)}/yr</span>
                    </div>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>City 3% match {currentServiceYears >= CITY_MATCH_MIN_YEARS ? "(vested)" : `(starts in ${Math.max(0, CITY_MATCH_MIN_YEARS - currentServiceYears).toFixed(1)} yrs)`}</span>
                      <span style={styles.tableValGreen}>{fmt(cityMatchCurrentAnnual)}/yr</span>
                    </div>
                    <div style={styles.tableRowLast}>
                      <span style={{ ...styles.tableKey, color: COLORS.text, fontWeight: "700" }}>Total going in each year</span>
                      <span style={{ ...styles.tableValGreen, fontWeight: "700" }}>{fmt(effectiveMember457 + cityMatchCurrentAnnual)}/yr</span>
                    </div>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Return while working: {returnRate}%</label>
                    <input type="range" min={4} max={12} step={0.5} value={returnRate} onChange={e => setReturnRate(+e.target.value)} style={{ width: "100%", accentColor: COLORS.accent }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: COLORS.textDim }}>
                      <span>4% conservative</span><span>8% moderate</span><span>12% aggressive</span>
                    </div>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Annual draw in retirement: {retireDrawRate}%</label>
                    <input type="range" min={2} max={10} step={0.5} value={retireDrawRate} onChange={e => setRetireDrawRate(+e.target.value)} style={{ width: "100%", accentColor: COLORS.accent }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: COLORS.textDim }}>
                      <span>2%</span><span>4% rule of thumb</span><span>10%</span>
                    </div>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Return during retirement: {retireReturnRate}%</label>
                    <input type="range" min={0} max={8} step={0.5} value={retireReturnRate} onChange={e => setRetireReturnRate(+e.target.value)} style={{ width: "100%", accentColor: COLORS.accent }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: COLORS.textDim }}>
                      <span>0%</span><span>3% conservative</span><span>8%</span>
                    </div>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Start drawing at age</label>
                    <input style={styles.input} type="number" min={retirementAge} value={drawStartAge || ""} onChange={e => setDrawStartAge(+e.target.value || 0)} placeholder={String(retirementAge)} />
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px" }}>Leave blank to draw at retirement. Delay it to let the balance keep growing first.</div>
                  </div>
                  {effectiveDrawStartAge > retirementAge && (
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Return while waiting to draw: {retireWaitReturnRate}%</label>
                      <input type="range" min={0} max={10} step={0.5} value={retireWaitReturnRate} onChange={e => setRetireWaitReturnRate(+e.target.value)} style={{ width: "100%", accentColor: COLORS.accent }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: COLORS.textDim }}>
                        <span>0%</span><span>5% moderate</span><span>10%</span>
                      </div>
                    </div>
                  )}
                  <div style={{ textAlign: "center", padding: "16px", background: "rgba(16,185,129,0.06)", borderRadius: "10px" }}>
                    <div style={styles.metricLabel}>Projected 457 balance at {retirementAge}</div>
                    <div style={styles.bigNumberGreen}>{fmt(value457)}</div>
                    {effectiveDrawStartAge > retirementAge && (
                      <div style={{ color: COLORS.gold, fontSize: "13px", fontWeight: "700", marginTop: "6px" }}>
                        Balance when you start drawing at {effectiveDrawStartAge}: {fmt(value457AtDraw)}
                      </div>
                    )}
                    <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "6px" }}>
                      ≈ {fmt(monthly457)}/mo income at {retireDrawRate}% draw · {yearsToRetirement.toFixed(1)} yrs growth at {returnRate}%
                    </div>
                    <div style={{ fontSize: "14px", color: COLORS.gold, fontWeight: "700", marginTop: "10px" }}>
                      {years457Lasts === Infinity ? "Lasts indefinitely — your draw is covered by growth" : `At ${fmt(monthly457)}/mo and ${retireReturnRate}% return, lasts about ${years457Lasts.toFixed(0)} years`}
                    </div>
                  </div>
                  <label style={{ ...styles.checkRow, marginTop: "14px" }}>
                    <input style={styles.checkbox} type="checkbox" checked={include457InTakeHome} onChange={e => setInclude457InTakeHome(e.target.checked)} />
                    <span style={styles.checkLabel}>Include 457 income in my Monthly Take-Home (top bar &amp; decision)</span>
                  </label>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginLeft: "28px", marginTop: "-2px", lineHeight: 1.5 }}>
                    Off by default so the top number stays your pension take-home. On adds your after-tax 457 draw (~{fmt(monthly457 * (1 - retEffRate))}/mo) to the headline.
                  </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("otherincome", "Other retirement income")}
                {openSections.otherincome !== false && (<>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "12px", lineHeight: "1.6" }}>
                    Enter gross (before tax). These don't change the page-one decision unless you check the box below.
                  </div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>IRA / investment income <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· $/yr</span></label>
                      <input style={styles.input} type="number" min={0} value={retIra || ""} placeholder="0" onChange={e => setRetIra(+e.target.value || 0)} />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Rental income <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· $/yr</span></label>
                      <input style={styles.input} type="number" min={0} value={retRental || ""} placeholder="0" onChange={e => setRetRental(+e.target.value || 0)} />
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Business income <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· $/yr</span></label>
                      <input style={styles.input} type="number" min={0} value={retBusiness || ""} placeholder="0" onChange={e => setRetBusiness(+e.target.value || 0)} />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Other / spouse income <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· $/yr</span></label>
                      <input style={styles.input} type="number" min={0} value={otherIncomeRet || ""} placeholder="0" onChange={e => setOtherIncomeRet(+e.target.value || 0)} />
                    </div>
                  </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("taxinputs", "Taxes")}
                {openSections.taxinputs !== false && (<>
                  <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: "6px" }}>While working</div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Filing status</label>
                      <select style={styles.select} value={filingStatus} onChange={e => setFilingStatus(e.target.value)}>
                        <option value="single">Single</option>
                        <option value="mfj">Married filing jointly</option>
                        <option value="hoh">Head of household</option>
                      </select>
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Dependents</label>
                      <input style={styles.input} type="number" min={0} max={10} value={dependents || ""} placeholder="0" onChange={e => setDependents(+e.target.value || 0)} />
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: COLORS.textMuted, margin: "12px 0 6px" }}>In retirement</div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Filing status</label>
                      <select style={styles.select} value={filingStatusRet} onChange={e => setFilingStatusRet(e.target.value)}>
                        <option value="single">Single</option>
                        <option value="mfj">Married filing jointly</option>
                        <option value="hoh">Head of household</option>
                      </select>
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Dependents</label>
                      <input style={styles.input} type="number" min={0} max={10} value={dependentsRet || ""} placeholder="0" onChange={e => setDependentsRet(+e.target.value || 0)} />
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, margin: "0 0 12px", lineHeight: "1.6" }}>
                    Other / spouse and additional income are entered in the "Other retirement income" card above.
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Retirement state <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· compare any state</span></label>
                    <select style={styles.select} value={retirementState} onChange={e => { const code = e.target.value; setRetirementState(code); const st = STATES_LIST.find(s => s.code === code); if (code !== "CA") setOtherStateRate(st && st.rate != null ? st.rate : 0); }}>
                      {STATES_LIST.map(s => <option key={s.code} value={s.code}>{s.name}{s.rate === 0 ? " — no retirement tax" : ""}</option>)}
                    </select>
                  </div>
                  {!["CA", "SC", "MT", "HI"].includes(retirementState) && (
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>{stateName} tax rate: {otherStateRate}% <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· approx — adjust if needed</span></label>
                      <input type="range" min={0} max={13} step={0.1} value={otherStateRate} onChange={e => setOtherStateRate(+e.target.value)} style={{ width: "100%", accentColor: COLORS.accent }} />
                    </div>
                  )}
                  {["SC", "MT", "HI"].includes(retirementState) && (
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "2px" }}>
                      {stateName} computed with its actual brackets — {retirementState === "HI" ? "pension is exempt; only your 457 is taxed" : retirementState === "SC" ? "retirement-income deduction applied" : "$5,500 retirement deduction applied"}.
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "2px", lineHeight: "1.6" }}>
                    You work in California; pick where you'll retire to compare. Breakdown is below. Estimate only — not tax advice.
                  </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("income", "Retirement income")}
                {openSections.income !== false && (<>
                <div style={{ ...styles.certNote, marginLeft: "0", marginBottom: "14px" }}>
                  Overtime ({otHoursMonthly} hrs/mo, set above) is paid at the FLSA regular rate — 1.5 × (base + incentives) ÷ 242.67 hrs = <strong style={{ color: COLORS.gold }}>{fmt(otHourlyRate)}/hr</strong>. ⚠ Estimate only — the City pays the greater of FLSA or contract OT, and All-Call OT is 2×.
                </div>
                {(() => {
                  const parts = [
                    { v: monthlyPension, c: COLORS.accent, label: "Pension" },
                    { v: monthly457, c: COLORS.blue, label: "457 (4% draw)" },
                    { v: priorPensionMonthly, c: COLORS.gold, label: "Prior service" },
                  ].filter(p => p.v > 0);
                  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
                  const C = 2 * Math.PI * 42; let off = 0;
                  return (
                    <div style={{ display: "flex", gap: "18px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" }}>
                      <svg viewBox="0 0 110 110" width="120" height="120" aria-hidden="true">
                        <circle cx="55" cy="55" r="42" fill="none" stroke={COLORS.surface} strokeWidth="14" />
                        {parts.map((p, i) => { const len = C * (p.v / tot); const seg = <circle key={i} cx="55" cy="55" r="42" fill="none" stroke={p.c} strokeWidth="14" strokeDasharray={`${len.toFixed(1)} ${(C - len).toFixed(1)}`} strokeDashoffset={(-off).toFixed(1)} transform="rotate(-90 55 55)" />; off += len; return seg; })}
                        <text x="55" y="51" textAnchor="middle" fontSize="8.5" fill={COLORS.textMuted}>total/mo</text>
                        <text x="55" y="65" textAnchor="middle" fontSize="15" fontWeight="700" fill={COLORS.text}>{fmt(totalMonthly)}</text>
                      </svg>
                      <div style={{ fontSize: "13px", lineHeight: "1.9" }}>
                        {parts.map((p, i) => (<div key={i}><span style={{ display: "inline-block", width: "10px", height: "10px", background: p.c, borderRadius: "2px", marginRight: "6px" }} />{p.label} <strong>{fmt(p.v)}</strong>/mo</div>))}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "-8px", marginBottom: "16px", lineHeight: "1.6" }}>
                  Medical is not counted as income. The City's retiree-medical contribution only exists if you enroll in CalPERS medical, and it is paid straight to the premium — so it shows up as an out-of-pocket cost, not as a monthly benefit. {medicalTier === "4" ? `Tier 4 is a one-time RHS account (${fmt(medical.rhsBalance)}), not a monthly benefit.` : `Your Tier ${medicalTier} contribution and net premium are on the Medical tab.`}
                </div>
                {(() => {
                  const ratio = Math.max(0, Math.min(1, retirementVsWorking));
                  const filled = (mounted ? ratio * 276.46 : 0).toFixed(1);
                  const needleDeg = mounted ? (-90 + ratio * 180) : -90;
                  return (
                    <div style={{ background: "#131316", border: `1px solid ${COLORS.border}`, borderRadius: "14px", padding: "16px", textAlign: "center", marginBottom: "16px" }}>
                      <div style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: "6px" }}>Replacement ratio</div>
                      <svg viewBox="0 0 220 150" width="100%" height="150" style={{ maxWidth: "320px" }} role="img" aria-label={`${(retirementVsWorking * 100).toFixed(0)} percent of current pay`}>
                        <path d="M22,112 A88,88 0 0 1 198,112" fill="none" stroke="#222228" strokeWidth="18" strokeLinecap="round" />
                        <g stroke="#41414a" strokeWidth="2"><line x1="22" y1="112" x2="34" y2="112" /><line x1="47.8" y1="49.8" x2="56.6" y2="58.6" /><line x1="110" y1="24" x2="110" y2="36" /><line x1="172.2" y1="49.8" x2="163.4" y2="58.6" /><line x1="198" y1="112" x2="186" y2="112" /></g>
                        <path className="rff-pulse" d="M22,112 A88,88 0 0 1 198,112" fill="none" stroke={COLORS.accent} strokeWidth="18" strokeLinecap="round" strokeDasharray={`${filled} 277`} style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 5px rgba(210,31,51,0.85))" }} />
                        <g style={{ transformOrigin: "110px 112px", transform: `rotate(${needleDeg}deg)`, transition: "transform 1.4s cubic-bezier(.2,.8,.2,1)" }}><line x1="110" y1="112" x2="190" y2="112" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" /></g>
                        <circle cx="110" cy="112" r="9" fill="#131316" stroke={COLORS.accent} strokeWidth="3" />
                        <text x="110" y="99" textAnchor="middle" fontSize="40" fontWeight="700" fill="#ffffff">{(retirementVsWorking * 100).toFixed(0)}%</text>
                        <text x="22" y="134" textAnchor="middle" fontSize="10" fill={COLORS.textDim}>0</text>
                        <text x="198" y="134" textAnchor="middle" fontSize="10" fill={COLORS.textDim}>100</text>
                      </svg>
                      <div style={{ fontSize: "12px", color: COLORS.textMuted }}>of current pay</div>
                    </div>
                  );
                })()}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "8px", padding: "16px", border: `1px solid rgba(255,255,255,0.2)` }}>
                    <div style={styles.metricLabel}>Working Today</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: COLORS.blue }}>{fmt(currentMonthlySalary)}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>gross/month · no OT</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>Take-home ~{fmt(currentTakeHome)}/mo</div>
                  </div>
                  <div style={{ background: "rgba(210,31,51,0.08)", borderRadius: "8px", padding: "16px", border: `1px solid rgba(210,31,51,0.25)` }}>
                    <div style={styles.metricLabel}>Working + OT</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: COLORS.gold }}>{fmt(salaryWithOT)}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>{otHoursMonthly > 0 ? `+${fmt(otMonthly)} OT · ${otHoursMonthly} hrs/mo` : "add OT hours above"}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>{fmt(salaryWithOT * 12)}/yr</div>
                  </div>
                  <div style={{ background: "rgba(210,31,51,0.08)", borderRadius: "8px", padding: "16px", border: `1px solid rgba(210,31,51,0.2)` }}>
                    <div style={styles.metricLabel}>Retired at {retirementAge}</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: COLORS.accent }}>{fmt(totalMonthly)}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>total/month gross</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>Take-home ~{fmt(totalMonthly - retTaxAnnual / 12 - retireeMedicalOOP)}/mo <span style={{ fontSize: "10px" }}>· after tax &amp; medical</span> · <span style={{ color: COLORS.green }}>+{fmt(totalMonthly - currentMonthlySalary)} vs working</span></div>
                  </div>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <p style={{ ...styles.cardTitle, marginBottom: "10px" }}>Gross vs. net after taxes</p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    {[
                      { label: "Salary", s: taxSalary, c: COLORS.blue },
                      { label: "Salary + OT", s: taxSalaryOT, c: COLORS.gold },
                      { label: "Retirement", s: taxRetire, c: COLORS.accent },
                    ].map(col => (
                      <div key={col.label} style={{ background: "#121214", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "12px" }}>
                        <div style={styles.metricLabel}>{col.label}</div>
                        <div style={{ fontSize: "11px", color: COLORS.textDim }}>Gross {fmt(col.s.gross / 12)}/mo</div>
                        <div style={{ fontSize: "18px", fontWeight: "800", color: col.c }}>{fmt(col.s.net / 12)}/mo</div>
                        <div style={{ fontSize: "10px", color: COLORS.textMuted }}>net · −{fmt(col.s.tax / 12)}/mo tax</div>
                      </div>
                    ))}
                  </div>
                  <div style={styles.tableRow}><span style={styles.tableKey}>Retirement federal tax</span><span style={styles.tableVal}>{fmt(retFedTax / 12)}/mo</span></div>
                  <div style={styles.tableRow}><span style={styles.tableKey}>Retirement state tax ({stateName}{!["CA", "SC", "MT", "HI"].includes(retirementState) ? ` · ${otherStateRate}%` : ""})</span><span style={styles.tableVal}>{fmt(retStateTax / 12)}/mo</span></div>
                  {retirementState !== "CA" && (
                    <div style={styles.tableRow}><span style={styles.tableKey}>{stateName} vs. California</span><span style={{ ...styles.tableVal, color: stateVsCa >= 0 ? COLORS.green : COLORS.accent }}>{stateVsCa >= 0 ? `saves ${fmt(stateVsCa)}/yr` : `${fmt(Math.abs(stateVsCa))}/yr more`}</span></div>
                  )}
                  <div style={styles.tableRow}><span style={styles.tableKey}>After-tax retirement income</span><span style={styles.tableVal}>{fmt(totalMonthly - retTaxAnnual / 12)}/mo</span></div>
                  <div style={styles.tableRow}><span style={styles.tableKey}>Retiree medical — your out-of-pocket <span style={{ fontSize: "10px", color: COLORS.textDim }}>· detail on Medical tab</span></span><span style={styles.tableVal}>−{fmt(retireeMedicalOOP)}/mo</span></div>
                  <div style={styles.tableRowLast}><span style={styles.tableKey}><strong>Take-home after tax &amp; medical</strong></span><span style={styles.tableValGreen}>{fmt(totalMonthly - retTaxAnnual / 12 - retireeMedicalOOP)}/mo</span></div>
                  {helpsExclusion > 0 && (
                    <div style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.2)`, borderRadius: "8px", fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.6" }}>
                      💡 <strong style={{ color: COLORS.green }}>HELPS Act — year-end benefit (not in the figures above):</strong> as a retired safety officer you can exclude up to {fmt(helpsExclusion)}/yr of pension used for health premiums on your federal return (write "PSO" on Form 1040). Estimated federal savings ≈ <strong>{fmt(helpsFedSavings)}/yr</strong>, realized as a lower tax bill at filing — CalPERS still withholds monthly on the full pension, so it is not included in the monthly take-home.
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "8px", lineHeight: "1.6" }}>
                    ⚠ Rough estimate — 2026 federal &amp; 2025 CA brackets, standard deduction, {(parseInt(dependents, 10) || 0)} dependent credit, plus your other/spouse income. Tax shown is what's withheld monthly (no HELPS reduction); each person's situation differs. "Net" = gross − income tax (working columns also subtract 1.45% Medicare). Pension &amp; 457 are taxable; medical subsidy isn't. Not tax advice — confirm with a professional.
                  </div>
                </div>
                <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "12px", color: COLORS.textMuted, lineHeight: "1.8" }}>
                  <strong style={{ color: COLORS.blue }}>What stops at retirement:</strong><br />
                  CalPERS contribution ({fmt(employeeCalPERSContrib)}/mo) · 457 contributions ({fmt(effectiveMember457 / 12)}/mo) · Union dues (~$222/mo) · Active health premium
                </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("hhincome", "Total household income & tax (retirement)")}
                {openSections.hhincome !== false && (<>
                <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "12px", lineHeight: "1.6" }}>
                  Your whole retirement picture — every gross source, total tax, and net. Estimate only — not tax advice.
                </div>
                <div style={styles.tableRow}><span style={styles.tableKey}>CalPERS pension</span><span style={styles.tableVal}>{fmt(combinedPensionMonthly * 12)}/yr</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>457 draw (4%)</span><span style={styles.tableVal}>{fmt(monthly457 * 12)}/yr</span></div>
                {(parseFloat(retIra) || 0) > 0 && (<div style={styles.tableRow}><span style={styles.tableKey}>IRA / investment</span><span style={styles.tableVal}>{fmt(parseFloat(retIra) || 0)}/yr</span></div>)}
                {(parseFloat(retRental) || 0) > 0 && (<div style={styles.tableRow}><span style={styles.tableKey}>Rental</span><span style={styles.tableVal}>{fmt(parseFloat(retRental) || 0)}/yr</span></div>)}
                {(parseFloat(retBusiness) || 0) > 0 && (<div style={styles.tableRow}><span style={styles.tableKey}>Business</span><span style={styles.tableVal}>{fmt(parseFloat(retBusiness) || 0)}/yr</span></div>)}
                {(parseFloat(otherIncomeRet) || 0) > 0 && (<div style={styles.tableRow}><span style={styles.tableKey}>Other / spouse</span><span style={styles.tableVal}>{fmt(parseFloat(otherIncomeRet) || 0)}/yr</span></div>)}
                <div style={{ ...styles.tableRow, borderTop: `1px solid ${COLORS.border}`, marginTop: "4px", paddingTop: "8px" }}>
                  <span style={{ ...styles.tableKey, color: COLORS.text, fontWeight: "700" }}>Total gross</span>
                  <span style={styles.tableValAccent}>{fmt(retGrossTaxAll)}/yr</span>
                </div>
                <div style={styles.tableRow}>
                  <span style={styles.tableKey}>Estimated total tax <span style={{ fontSize: "10px", color: COLORS.textDim }}>· ~{retGrossTaxAll > 0 ? pct(retTaxAnnualAll / retGrossTaxAll) : "0%"}</span></span>
                  <span style={styles.tableVal}>−{fmt(retTaxAnnualAll)}/yr</span>
                </div>
                <div style={styles.tableRowLast}>
                  <span style={{ ...styles.tableKey, color: COLORS.text, fontWeight: "700" }}>Total net</span>
                  <span style={styles.tableValGreen}>{fmt(retNetAll)}/yr</span>
                </div>
                <div style={{ ...styles.tableRow, marginTop: "4px" }}>
                  <span style={styles.tableKey}>Monthly net</span>
                  <span style={styles.tableValGreen}>{fmt(retNetAll / 12)}/mo</span>
                </div>
                <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "10px", lineHeight: "1.6" }}>
                  ⚠ Estimate only — uses your chosen filing status, dependents, and retirement state. Not tax advice.
                </div>
                </>)}
              </div>
            )}
            {tab === "income" && (
              <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                <label style={{ ...styles.checkRow, marginBottom: "8px" }}>
                  <input style={styles.checkbox} type="checkbox" checked={foldExtraIncome} onChange={e => setFoldExtraIncome(e.target.checked)} />
                  <span style={styles.checkLabel}>Include this extra income in the page-one take-home &amp; decision</span>
                </label>
                <div style={{ fontSize: "11px", color: COLORS.textDim, marginLeft: "28px", lineHeight: "1.6" }}>
                  Off by default so the retire-from-the-fire-department decision stays pension-vs-working. Turn on to see your whole household picture on page one.
                </div>
              </div>
            )}
            {tab === "income" && (
              <div style={styles.card}>
                {sectionHeader("eq401k", "Private-sector 401(k) equivalent")}
                {openSections.eq401k !== false && (<>
                <div style={{ marginBottom: "16px", padding: "16px", background: "rgba(210,31,51,0.06)", borderRadius: "8px", fontSize: "13px", color: COLORS.textMuted, lineHeight: "1.8" }}>
                  How large a 401(k) would a private-sector worker need to generate the same retirement income — with no pension to fall back on?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ textAlign: "center", padding: "20px", background: "rgba(210,31,51,0.08)", borderRadius: "10px" }}>
                    <div style={styles.metricLabel}>Replace pension only</div>
                    <div style={{ fontSize: "26px", fontWeight: "800", color: COLORS.accent }}>{fmt(equiv401k_4pct)}</div>
                    <div style={{ color: COLORS.textMuted, fontSize: "12px", marginTop: "6px" }}>{fmt(annualPension)}/yr at 4% withdrawal</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "20px", background: "rgba(210,31,51,0.08)", borderRadius: "10px" }}>
                    <div style={styles.metricLabel}>Replace full package</div>
                    <div style={{ fontSize: "26px", fontWeight: "800", color: COLORS.gold }}>{fmt(equivFull_4pct)}</div>
                    <div style={{ color: COLORS.textMuted, fontSize: "12px", marginTop: "6px" }}>incl. medical + 457 at 4%</div>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: COLORS.textDim, marginBottom: "4px", lineHeight: "1.7" }}>
                  At a more conservative 3% withdrawal rate: pension only <strong style={{ color: COLORS.text }}>{fmt(equiv401k_3pct)}</strong>, full package <strong style={{ color: COLORS.text }}>{fmt(totalAnnual / 0.03)}</strong>.
                </div>
                <div style={{ ...styles.compareBox, marginTop: "20px" }}>
                  <div style={styles.metricLabel}>The Bottom Line</div>
                  <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.8", marginTop: "8px" }}>
                    To replicate your full retirement package privately at 4% withdrawal, a worker would need <strong style={{ color: COLORS.gold }}>{fmt(equivFull_4pct)}</strong> in a 401(k) — with no COLA guarantee and full market risk.
                  </div>
                  <div style={{ marginTop: "12px", fontSize: "12px", color: COLORS.green }}>
                    Your {pct(memberType === "classic" ? 0.09 : 0.115)} CalPERS contribution is the best investment you'll ever make.
                  </div>
                </div>
                </>)}
              </div>
            )}
            {tab === "updates" && (
              <div style={styles.card}>
                {sectionHeader("whatsnew", "What's new")}
                {openSections.whatsnew !== false && (<>
                <div style={{ marginBottom: "16px", fontSize: "12px", color: COLORS.textMuted, lineHeight: "1.7" }}>
                  Recent updates to the calculator, newest first. Numbers are approximations — see the disclosures in each section.
                </div>
                {CHANGELOG.map((entry, i) => (
                  <div key={i} style={{ marginBottom: "18px" }}>
                    <div style={{ fontWeight: "700", color: COLORS.gold, fontSize: "13px", marginBottom: "6px" }}>{entry.date}</div>
                    <ul style={{ margin: 0, paddingLeft: "18px" }}>
                      {entry.items.map((it, j) => (
                        <li key={j} style={{ color: COLORS.text, fontSize: "13px", lineHeight: "1.65", marginBottom: "5px" }}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                </>)}
              </div>
            )}
            {tab === "help" && (
              <div style={styles.card}>
                <div style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: 800, color: COLORS.text, marginBottom: "4px" }}>How to use this calculator</div>
                <div style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "18px" }}>A plain-language guide from your Local — what this tool does, how to fill it in, and answers to the questions members ask most.</div>

                <div style={{ background: "rgba(210,31,51,0.10)", border: `1px solid ${COLORS.accent}`, borderRadius: "10px", padding: "14px 16px", marginBottom: "22px" }}>
                  <div style={{ fontWeight: 700, color: COLORS.accent, fontSize: "13px", marginBottom: "6px" }}>⚠ This is an estimate — not an official benefit statement</div>
                  <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.65" }}>
                    These numbers are projections built from Roseville's current MOU and the CalPERS formulas. The official figures come from <strong>CalPERS</strong> and the <strong>City</strong>. Don't make an irreversible decision — retiring, buying airtime, or dropping coverage — based on this tool alone. Always confirm with CalPERS and HR first.
                  </div>
                </div>

                {sectionHeader("helpSteps", "Step by step")}
                {openSections.helpSteps !== false && (
                  <div style={{ marginBottom: "8px" }}>
                    {[
                      ["1 · Start", "Type in your hire date, current age, and the age you plan to retire. The tool figures out Classic vs. PEPRA automatically from your hire date (on/after Jan 1, 2013 = PEPRA). Add your usual overtime, beneficiary age, dependents, and any other or spouse income. If you bought airtime (CalPERS service credit), enter the years (5 max). If you worked another agency before Roseville, add it under prior service."],
                      ["2 · Pension", "Shows your projected monthly pension, the breakdown by department, the \"What counts toward your 90%\" list, and how close you are to the 90% cap."],
                      ["3 · Medical", "Pick your medical plan, coverage level, dental, and vision. You'll see what the City pays and what comes out of your check — both now and in retirement. Note: you must be enrolled in a CalPERS/PEMHCA plan to keep the City's contribution in retirement."],
                      ["4 · 457", "Enter your current 457 balance and contributions to project growth, including the City match (which counts after your 5-year vesting)."],
                      ["5 · Total", "Combines pension + retiree medical + 457 into your total monthly retirement income, and compares your taxes now vs. in retirement — including a different state if you plan to move."],
                    ].map(([t, d], i) => (
                      <div key={i} style={{ marginBottom: "14px" }}>
                        <div style={{ fontWeight: 700, color: COLORS.gold, fontSize: "13px", marginBottom: "3px" }}>{t}</div>
                        <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.65" }}>{d}</div>
                      </div>
                    ))}
                  </div>
                )}

                {sectionHeader("helpNumbers", "What the numbers mean")}
                {openSections.helpNumbers !== false && (
                  <div style={{ marginBottom: "8px" }}>
                    {[
                      ["The pension formula", "Classic members earn 3% of final pay per year of service at age 50. PEPRA members earn up to 2.7% at age 57 (the factor grows the longer you wait). Pension = years of service × factor × final compensation."],
                      ["The 90% cap", "CalPERS caps a safety pension at 90% of your final pay. At 3% per year that's 30 years of service. Anything past the cap adds nothing to your pension — which is why overbuying airtime can be wasted money."],
                      ["Same-CalPERS vs. reciprocity", "CalFire and other CalPERS employers are the SAME system — that service combines into one pension under one 90% cap. A different system (LACERA / '37 Act counties, CalSTRS, FERS) pays a SEPARATE check with its own 90% cap, using your highest final pay across systems (your Roseville pay)."],
                      ["Airtime", "Purchased CalPERS service credit, up to 5 years. It counts toward your 90% — great if you're short of the cap, wasted if you're already there."],
                      ["Retiree medical", "The City pays up to 100% / 85% / 80% of the Kaiser premium (employee / +1 / family), plus $180 toward dental and vision. The difference is NOT paid to you as cash. If your plan costs more than the City's share, the rest comes out of your check."],
                      ["457 match", "Your deferred-comp savings. The City's matching contribution only counts once you're vested (5 years of service)."],
                      ["Taxes now vs. retirement", "California taxes your pay today. In retirement you can model a different state, filing status, dependents, and spouse income — your CalPERS pension is taxed by the state you actually live in."],
                    ].map(([t, d], i) => (
                      <div key={i} style={{ marginBottom: "14px" }}>
                        <div style={{ fontWeight: 700, color: COLORS.blue, fontSize: "13px", marginBottom: "3px" }}>{t}</div>
                        <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.65" }}>{d}</div>
                      </div>
                    ))}
                  </div>
                )}

                {sectionHeader("helpTiers", "Retiree medical tiers explained")}
                {openSections.helpTiers !== false && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.65", marginBottom: "12px" }}>
                      Your retiree medical benefit depends on <strong>when you were hired</strong>. There are four tiers — and they work very differently, especially Tier 4.
                    </div>
                    <div style={{ background: "rgba(245,158,11,0.10)", border: `1px solid ${COLORS.gold}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px", color: COLORS.text }}>
                      You're <strong style={{ color: COLORS.gold }}>Tier {medicalTier}</strong> (hired {hireYear}). The section below highlights how your tier works.
                    </div>
                    {[
                      ["Tier 1 — hired before 2004", COLORS.blue, "A lifetime monthly subsidy of $1,200/mo toward your retiree medical premiums, growing 2% every year (compounding since 2013). Fully vested — no service-year reduction."],
                      ["Tier 2 — hired 2004–2011", COLORS.blue, "Same $1,200/mo base with the 2% annual growth, but subject to the vesting schedule: you reach 50% at 10 years of City service and 100% at 20 years (5% added per year in between). Retire with fewer than 10 years of City service and you get nothing."],
                      ["Tier 3 — hired 2012–2014", COLORS.blue, "A lower $720/mo base with the same 2% annual growth, subject to the same vesting schedule (50% at 10 years, 100% at 20)."],
                      ["Tier 4 — hired Aug 15, 2015 or later", COLORS.accent, "NO lifetime monthly subsidy. Instead it's a Retirement Health Savings (RHS) account. Per the MOU you are required to contribute 1% of your base pay starting at hire, rising 1% each year to a 5% cap; the City then adds a flat $100/mo from your 6th year of service. Both go into the account, which you draw down against premiums in retirement — a pot of money, not a monthly benefit for life."],
                    ].map(([t, color, d], i) => (
                      <div key={i} style={{ marginBottom: "14px" }}>
                        <div style={{ fontWeight: 700, color, fontSize: "13px", marginBottom: "3px" }}>{t}</div>
                        <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.65" }}>{d}</div>
                      </div>
                    ))}
                    <div style={{ background: "rgba(210,31,51,0.08)", border: `1px solid ${COLORS.accent}`, borderRadius: "10px", padding: "12px 14px", marginTop: "4px", marginBottom: "8px" }}>
                      <div style={{ fontWeight: 700, color: COLORS.accent, fontSize: "13px", marginBottom: "5px" }}>Why the RHS account matters (Tier 4)</div>
                      <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.65" }}>
                        For Tier 4 members the RHS account is the <strong>main</strong> retiree-medical benefit, and it builds into a real number — your own 1%→5% contributions, plus the City's $100/mo, plus investment growth over a full career can reach tens of thousands of dollars. The Medical tab projects your balance and lets you adjust the assumed investment return. Two things to remember: it's a <strong>fixed pot you spend down</strong> (not a lifetime monthly subsidy), and you still must be enrolled in a CalPERS/PEMHCA plan to use the City's money.
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: COLORS.textDim, lineHeight: "1.6" }}>
                      The Medical tab shows your own tier's number automatically — a monthly subsidy for Tiers 1–3, or your projected RHS balance for Tier 4.
                    </div>
                  </div>
                )}

                {sectionHeader("helpFaq", "Common questions")}
                {openSections.helpFaq !== false && (
                  <div style={{ marginBottom: "8px" }}>
                    {[
                      ["Is this official?", "No. It's an estimate built by your Local. CalPERS and HR provide the official numbers — always confirm with them before acting."],
                      ["Why am I capped at 90%?", "State law caps a safety pension at 90% of final pay. At 3% per year you reach it at 30 years of service."],
                      ["What is airtime?", "Purchased CalPERS service credit (up to 5 years). It raises your pension — unless you're already at the 90% cap, in which case it adds nothing."],
                      ["Why are CalFire and LACERA treated differently?", "CalFire is itself CalPERS, so it combines with your Roseville service under one 90% cap. LACERA is a separate '37 Act system: it pays its own check with its own cap, but uses your highest final pay (reciprocity)."],
                      ["If my medical is cheap, do I get cash back?", "No. The City pays toward your premiums; any leftover is not paid out to you."],
                      ["Do I keep medical in retirement?", "Only if you're enrolled in a CalPERS/PEMHCA plan. The City's retiree contribution follows that enrollment."],
                      ["My numbers look off — what do I check?", "Start with your hire date (it sets Classic vs. PEPRA), your retirement age, and your prior-service entries. Then verify against your CalPERS estimate."],
                      ["Is my information private?", "Yes. Everything you enter stays in your browser on your own device — nothing is sent or stored anywhere else."],
                    ].map(([q, a], i) => (
                      <div key={i} style={{ marginBottom: "14px" }}>
                        <div style={{ fontWeight: 700, color: COLORS.text, fontSize: "13px", marginBottom: "3px" }}>{q}</div>
                        <div style={{ fontSize: "13px", color: COLORS.textMuted, lineHeight: "1.65" }}>{a}</div>
                      </div>
                    ))}
                  </div>
                )}

                {sectionHeader("helpOfficial", "Where to get official numbers")}
                {openSections.helpOfficial !== false && (
                  <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.75" }}>
                    <div><strong>CalPERS</strong> — myCalPERS at calpers.ca.gov or 888-225-7377, for your official estimate and service-credit/airtime questions.</div>
                    <div><strong>City HR &amp; your MOU</strong> — for medical, dental, vision, and pay specifics.</div>
                    <div><strong>Your Local</strong> — questions about this tool itself? Contact the Local 1592 treasurer.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="print-report" style={{ padding: "24px", color: "#111", background: "#fff", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <div style={{ textAlign: "center", borderBottom: "3px solid #d21f33", paddingBottom: "16px", marginBottom: "18px" }}>
          <img src={logoUrl} alt="" style={{ height: "120px", marginBottom: "8px" }} />
          <div style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", color: "#888" }}>Roseville Firefighters · IAFF Local 1592</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#d21f33", margin: "2px 0" }}>Know What You've Earned</div>
          <div style={{ fontSize: "12px", color: "#555" }}>Retirement estimate · generated {new Date().toLocaleDateString()}</div>
        </div>
        <div style={{ fontSize: "13px", marginBottom: "16px", lineHeight: "1.6" }}>
          <strong>{classification}</strong>, Step {salaryStep} · Hired {hireDate} · {memberType === "classic" ? "Classic (3% @ 50)" : "PEPRA (2.7% @ 57)"} · Retiring {effectiveRetDateStr} at age {retirementAge} · ~{yearsOfService.toFixed(1)} yrs service
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
          <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", padding: "14px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#888" }}>Estimated total monthly income</div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#d21f33", lineHeight: 1.1 }}>{fmt(totalMonthly)}</div>
            <div style={{ fontSize: "11px", color: "#555", marginBottom: "10px" }}>{fmt(totalAnnual)}/yr · {(retirementVsWorking * 100).toFixed(0)}% of current pay</div>
            {(() => {
              const parts = [
                { v: monthlyPension, c: "#d21f33", label: "Pension" },
                { v: monthly457, c: "#2563eb", label: "457 draw" },
                { v: priorPensionMonthly, c: "#b45309", label: "Prior svc" },
              ].filter(p => p.v > 0);
              const tot = parts.reduce((s, p) => s + p.v, 0) || 1; const C = 2 * Math.PI * 34; let off = 0;
              return (<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <svg viewBox="0 0 86 86" width="86" height="86">
                  <circle cx="43" cy="43" r="34" fill="none" stroke="#eee" strokeWidth="12" />
                  {parts.map((p, i) => { const len = C * (p.v / tot); const s = <circle key={i} cx="43" cy="43" r="34" fill="none" stroke={p.c} strokeWidth="12" strokeDasharray={`${len.toFixed(1)} ${(C - len).toFixed(1)}`} strokeDashoffset={(-off).toFixed(1)} transform="rotate(-90 43 43)" />; off += len; return s; })}
                </svg>
                <div style={{ fontSize: "11px", lineHeight: "1.7" }}>
                  {parts.map((p, i) => (<div key={i}><span style={{ display: "inline-block", width: "9px", height: "9px", background: p.c, borderRadius: "2px", marginRight: "5px" }} />{p.label} {fmt(p.v)}</div>))}
                </div>
              </div>);
            })()}
          </div>
          <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#888" }}>Replacement ratio</div>
            {(() => { const ratio = Math.max(0, Math.min(1, retirementVsWorking)); const filled = (ratio * 219.9).toFixed(1);
              return (<svg viewBox="0 0 180 96" width="160" height="86">
                <path d="M16,86 A70,70 0 0 1 164,86" fill="none" stroke="#eee" strokeWidth="14" strokeLinecap="round" />
                <path d="M16,86 A70,70 0 0 1 164,86" fill="none" stroke="#d21f33" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${filled} 300`} />
                <text x="90" y="80" textAnchor="middle" fontSize="30" fontWeight="800" fill="#111">{(retirementVsWorking * 100).toFixed(0)}%</text>
              </svg>); })()}
            <div style={{ fontSize: "11px", color: "#555", textAlign: "left", marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Working now (net)</span><strong>{fmt(currentTakeHome)}/mo</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Retired (total)</span><strong>{fmt(totalMonthly)}/mo</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Today's dollars</span><strong>{fmt(totalMonthlyTodayDollars)}/mo</strong></div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#d21f33", borderBottom: "1px solid #e5e5e5", paddingBottom: "3px", marginBottom: "6px" }}>Pension</div>
          <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}><tbody>
            <tr><td style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>CalPERS — Roseville{priorServiceCalc.some(r => r.sameFormula) ? " + same-formula" : ""} ({pct(pensionPct)}{benefitIsCapped && pensionPct >= benefitMaxPct ? ", at cap" : ""})</td><td style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 600 }}>{fmt(pension50Monthly)}/mo</td></tr>
            {priorServiceCalc.map((r, i) => (<tr key={i}><td style={{ padding: "3px 0 3px 14px", color: "#777", fontSize: "11px" }}>· {r.agencyName ? r.agencyName + " · " : ""}{(PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "Prior"} · {r.yrs} yrs × {pct(r.factor)}{r.otherCalpers ? " · stacks on top" : r.calpers ? "" : " · separate check"}</td><td style={{ padding: "3px 0", textAlign: "right", color: "#777", fontSize: "11px" }}>{r.sameFormula ? "in 90% bucket" : (r.otherCalpers ? "+" : "") + fmt(r.monthly) + "/mo"}</td></tr>))}
            <tr><td style={{ padding: "4px 0", fontWeight: 700 }}>Combined pension</td><td style={{ padding: "4px 0", textAlign: "right", fontWeight: 800, color: "#d21f33" }}>{fmt(combinedPensionMonthly)}/mo</td></tr>
          </tbody></table>
          <div style={{ fontSize: "10px", color: "#888", display: "flex", justifyContent: "space-between", marginTop: "6px" }}><span>{pct(pensionPct)} of final pay</span><span>{benefitIsCapped ? "90% cap" : "no cap (2.7% @ 57)"}</span></div>
          <div style={{ background: "#eee", borderRadius: "5px", height: "11px", overflow: "hidden" }}><div style={{ width: `${Math.min(100, (pensionPct / (benefitIsCapped ? benefitMaxPct : 1.0)) * 100).toFixed(0)}%`, height: "100%", background: "#d21f33" }} /></div>
          <div style={{ fontSize: "10px", color: "#888", marginTop: "8px" }}>Pension growth — up to {pct(colaRate)} COLA (not guaranteed)</div>
          {(() => { const pts = colaYears.map(yr => monthlyPension * Math.pow(1 + colaRate, colasBy(yr))); const mx = Math.max(...pts), mn = Math.min(...pts), W = 320, H = 40, P = 4; const co = pts.map((v, i) => `${(P + i * (W - 2 * P) / (pts.length - 1)).toFixed(1)},${(H - P - ((v - mn) / ((mx - mn) || 1)) * (H - 2 * P)).toFixed(1)}`).join(" "); return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="40"><polyline points={co} fill="none" stroke="#16a34a" strokeWidth="2" /></svg>; })()}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#d21f33", borderBottom: "1px solid #e5e5e5", paddingBottom: "3px", marginBottom: "6px" }}>Medical (while working)</div>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}><tbody>
              <tr><td style={{ padding: "3px 0" }}>Medical ({selectedMedicalPlan})</td><td style={{ padding: "3px 0", textAlign: "right" }}>{fmt(selectedPremium)}</td></tr>
              <tr><td style={{ padding: "3px 0", color: "#555" }}>− City pays ({Math.round((CITY_MED_PCT[medicalCoverage] || 1) * 100)}% of Kaiser)</td><td style={{ padding: "3px 0", textAlign: "right" }}>−{fmt(cityMedicalPaid)}</td></tr>
              <tr><td style={{ padding: "3px 0" }}>Dental + vision</td><td style={{ padding: "3px 0", textAlign: "right" }}>{fmt(dvCost)}</td></tr>
              <tr><td style={{ padding: "3px 0", color: "#555" }}>− City pays (up to $180)</td><td style={{ padding: "3px 0", textAlign: "right" }}>−{fmt(dvCityPaid)}</td></tr>
              <tr><td style={{ padding: "4px 0", fontWeight: 700, borderTop: "1px solid #eee" }}>Your cost from paycheck</td><td style={{ padding: "4px 0", textAlign: "right", fontWeight: 800, borderTop: "1px solid #eee", color: "#d21f33" }}>{fmt(medicalTotalOOP)}/mo</td></tr>
            </tbody></table>
            <div style={{ fontSize: "10px", color: "#777", marginTop: "4px" }}>Retiree medical (Tier {medicalTier}): {medicalTier === "4" ? `${fmt(medical.rhsBalance)} RHS account` : `${fmt(medical.monthly)}/mo`}</div>
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#d21f33", borderBottom: "1px solid #e5e5e5", paddingBottom: "3px", marginBottom: "6px" }}>457 savings</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#111" }}>{fmt(value457)}</div>
            <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px" }}>{fmt(monthly457)}/mo at 4% · {returnRate}% return assumed</div>
            {(() => { const yrs = Math.max(1, yearsToRetirement), N = 7; const pts = Array.from({ length: N }, (_, i) => future457Value(current457, effectiveMember457, cityMatchAnnual, yrs * i / (N - 1), rate457)); const mx = Math.max(...pts), mn = Math.min(...pts), W = 300, H = 40, P = 4; const co = pts.map((v, i) => `${(P + i * (W - 2 * P) / (N - 1)).toFixed(1)},${(H - P - ((v - mn) / ((mx - mn) || 1)) * (H - 2 * P)).toFixed(1)}`).join(" "); return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="40"><polyline points={co} fill="none" stroke="#2563eb" strokeWidth="2" /></svg>; })()}
            {sickLeavePayoff > 0 && <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>Sick leave lump sum: <strong>{fmt(sickLeavePayoff)}</strong></div>}
          </div>
        </div>

        <div style={{ marginBottom: "12px", fontSize: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#d21f33", borderBottom: "1px solid #e5e5e5", paddingBottom: "3px", marginBottom: "6px" }}>Estimated income tax</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>Working now ({filingStatus === "single" ? "Single" : filingStatus === "mfj" ? "Married filing jointly" : "Head of household"})</span><span>{fmt(workTaxAnnual / 12)}/mo · {pct(workEffRate)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>In retirement ({stateName})</span><span>{fmt(retTaxAnnual / 12)}/mo · {pct(retEffRate)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>Retiree medical — your out-of-pocket</span><span>−{fmt(retireeMedicalOOP)}/mo</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, borderTop: "1px solid #eee" }}><span>Take-home after tax &amp; medical</span><span style={{ color: "#16a34a" }}>{fmt(totalMonthly - retTaxAnnual / 12 - retireeMedicalOOP)}/mo</span></div>
        </div>
        <div style={{ fontSize: "10px", color: "#777", marginTop: "10px", lineHeight: "1.5", borderTop: "1px solid #e5e5e5", paddingTop: "8px" }}>
          Estimates only — not official CalPERS figures. Tax is a rough estimate (2026 federal / 2025 CA brackets), not tax advice. COLA shown is the contract cap and is not guaranteed every year. PEPRA pay is capped at the state pensionable-comp limit. Confirm all figures with CalPERS and the City of Roseville. Generated at neitling78.github.io/Roseville-Fire-Retirement-Calculator
        </div>
      </div>
      <div className="no-print" style={styles.footer}>
        <button onClick={() => setTab("updates")} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: tab === "updates" ? COLORS.accent : COLORS.textMuted, cursor: "pointer", fontSize: "12px", borderRadius: "8px", padding: "6px 16px", marginBottom: "14px" }}>What's new ›</button>
        <br />
        <strong>RFF Local 1592 Member Retirement Calculator</strong><br />
        Based on 2026–2029 RFF MOU · Salary Schedule effective 3/21/2026 · CalPERS health premiums effective 1/1/2027<br />
        ⚠ This tool provides estimates only. Consult CalPERS and a financial advisor for official projections.<br />
        Engineer cert pay, Captain Paramedic, and Captain Engine Boss all cease 1/9/2027 per MOU. PEPRA Service Term Bonus is NOT pensionable per Art XI. Sick leave service credit conversion: 100% per MOU Ch5 Art I + CalPERS Gov Code §20862.8 (no cap, no double-dipping). PEPRA age factor is linearly interpolated between 2.0%@50 and 2.7%@57 — actual CalPERS factors use proprietary actuarial tables (deviation typically &lt;0.2%). Survivor benefit option factors are approximations — request a Retirement Allowance Estimate from CalPERS for exact figures. Years of service are computed from your hire date to your retirement date (auto-set from your retirement age, editable to the exact day); the PEPRA age factor still uses the retirement age you enter. Medical-tab premium and flex-credit figures are 2026 active-employee rates and change annually. PEPRA pensions are figured on the state pensionable-compensation cap (non-Social-Security safety: $191,679 in 2026, escalated ~2.5%/yr) when projected pay exceeds it. The City 3% 457 match is counted only for years of service past the 5-year vesting point.
      </div>
    </div>
  );
}
