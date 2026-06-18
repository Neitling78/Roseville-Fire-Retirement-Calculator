import { useState, useEffect, useCallback } from "react";
import logoUrl from "./assets/logo.png";
// ─── CONSTANTS FROM 2026 RFF MOU & SALARY SCHEDULE ───────────────────────────
// Official RFF salary schedule — Appendix A, effective 3/21/2026 (City of Roseville).
// One schedule for all hires. Monthly base by classification × step. Top step is H — NO Step I.
const SALARY_SCHEDULE = {
  "Fire Captain": {
    steps: {
      A: 8737.70, B: 9174.62, C: 9633.43, D: 10115.03,
      E: 10620.86, F: 11151.87, G: 11709.44, H: 12294.95
    }
  },
  "Fire Engineer": {
    steps: {
      A: 8016.42, B: 8417.28, C: 8838.19, D: 9280.01,
      E: 9744.01, F: 10231.21, G: 10742.78, H: 11280.17
    }
  },
  "Firefighter Paramedic II": {
    steps: {
      A: 7820.73, B: 8211.79, C: 8622.41, D: 9053.48,
      E: 9506.18, F: 9981.49, G: 10480.60, H: 11004.81
    }
  },
  "Firefighter Paramedic I": {
    steps: {
      A: 7820.73, B: 8211.79, C: 8622.41, D: 9053.48,
      E: 9506.18, F: 9981.49, G: 10480.60, H: 11004.81
    }
  }
};
// One current salary schedule applies to all members (confirmed by Treasurer, 6/2026).
// Cutoff dates per MOU
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
// FLSA OT — "special compensation," pensionable for CLASSIC ONLY (~2% of base), NOT PEPRA.
// Per CalPERS-confirmed MOU holiday language + CalPERS contract #3831513094 (Treasurer-confirmed).
const FLSA_OT_PENSIONABLE_PCT = 0.02;
const CITY_MATCH_PCT = 0.03;
const CITY_MATCH_MIN_YEARS = 5;
const MAX_457_ANNUAL = 24500;  // 2026 IRS 457(b) elective-deferral limit (was $23,500 in 2025) — update annually
// CalPERS PEPRA pensionable-compensation cap, non-Social-Security (safety) members, 2026: $191,679
// (CalPERS Circular Letter 200-001-26). Indexed annually — escalated to the retirement year below.
const PEPRA_COMP_CAP_2026 = 191679;
const PEPRA_CAP_COLA = 0.025;       // assumed annual CPI indexing of the PEPRA cap
const UNION_DUES_MONTHLY = 222;     // IAFF Local 1592 dues — used in the take-home comparison
// City of Roseville 2026 Rate Sheet (archived). Monthly medical premiums by coverage tier.
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
const RFF_FLEX_2026 = { ee: 200, ee1: 688, fam: 1143 };       // RFF flex credit by coverage tier
const CAFETERIA_2026 = 1347;                                   // City cafeteria allowance (MOU Ch4 Art I §C.2)
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
function calcRetireeMedical(tier, hireYear, retirementYear, cityYOS, totalCalpersYears) {
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
  const eligible = cityYOS >= 5 && totalYears >= 10;
  const vestYears = Math.min(Math.floor(cityYOS >= 5 ? totalYears : cityYOS), 20);
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
  const tier = SICK_LEAVE_TIERS.find(t => hours >= t.min && hours <= t.max);
  if (!tier || tier.pct === 0) return 0;
  return hours * hourlyRate * tier.pct;
}
// ─── CalPERS RETIREMENT ALLOWANCE OPTIONS ────────────────────────────────
// Approximation of CalPERS Option Factor tables based on age. Real factors come
// from CalPERS actuarial tables (proprietary). These match CalPERS output to within
// ~1-2 percentage points for safety members at typical retirement ages.
//
// Pattern:
//   - Younger member at retirement → larger reduction (longer expected payout)
//   - Beneficiary younger than member → larger reduction (longer expected survivor period)
//   - Pop-up options cost slightly more than non-pop-up (the pop-up insurance)
function calcOptionFactors(memberAge, beneficiaryAge) {
  const ageDiff = memberAge - beneficiaryAge;          // + if beneficiary younger
  const youngFactor = Math.max(0, 60 - memberAge);     // how much younger than 60
  // Option 2 — 100% Joint & Survivor (member's allowance reduced; 100% to survivor)
  const opt2Reduction = Math.max(0.02, 0.07 + youngFactor * 0.008 + ageDiff * 0.003);
  const opt2 = 1 - opt2Reduction;
  // Option 2W — 100% J&S with pop-up (returns to Option 1 if beneficiary dies first)
  const opt2w = opt2 - 0.015;
  // Option 3 — 50% Joint & Survivor
  const opt3Reduction = Math.max(0.01, 0.04 + youngFactor * 0.005 + ageDiff * 0.0015);
  const opt3 = 1 - opt3Reduction;
  // Option 3W — 50% J&S with pop-up
  const opt3w = opt3 - 0.008;
  return {
    opt1: 1.000, // Unmodified
    opt2: Math.min(1, Math.max(0.65, opt2)),
    opt2w: Math.min(1, Math.max(0.65, opt2w)),
    opt3: Math.min(1, Math.max(0.80, opt3)),
    opt3w: Math.min(1, Math.max(0.80, opt3w)),
  };
}
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
const pct = (n) => `${(n * 100).toFixed(1)}%`;
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
// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function RFFRetirementCalculator() {
  const [tab, setTab] = useState("inputs");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  // Collapsible input sections — tap a title to open/close (choice persists on device)
  const [openSections, setOpenSections] = useState(SAVED.openSections ?? { profile: true, prior: true, hiredate: true, rank: true, paystep: true, raises: false, incentives: false, sickleave: false, yourprofile: false, breakdown: false, cola: false, survivor: false });
  const toggleSection = (k) => setOpenSections(s => ({ ...s, [k]: s[k] === false }));
  const sectionHeader = (key, title) => (
    <p
      style={{ ...styles.cardTitle, cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center", ...(openSections[key] !== false ? {} : { marginBottom: 0, borderBottom: "none", paddingBottom: 0 }) }}
      onClick={() => toggleSection(key)}>
      <span>{title}</span>
      <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections[key] !== false ? "▾" : "▸ tap to open"}</span>
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
  const [selectedMedicalPlan, setSelectedMedicalPlan] = useState(SAVED.selectedMedicalPlan ?? "Kaiser Permanente");
  const [medicalCoverage, setMedicalCoverage] = useState(SAVED.medicalCoverage ?? "ee");
  const [retireeMedicalPlan, setRetireeMedicalPlan] = useState(SAVED.retireeMedicalPlan ?? "Kaiser Permanente");
  const [retireeCoverage, setRetireeCoverage] = useState(SAVED.retireeCoverage ?? "ee");
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
  const [currentSickLeaveHours, setCurrentSickLeaveHours] = useState(SAVED.currentSickLeaveHours ?? 0);
  const [airtime, setAirtime] = useState(SAVED.airtime ?? 0); // CalPERS ARSC "airtime" purchased pre-2013 (max 5 yrs)
  // Sick leave disposition: "cash" | "credit" | "split"
  // "credit" = convert everything to CalPERS service credit (max possible)
  // "split"  = convert N years to credit, remainder to cash
  const [sickLeaveDisposition, setSickLeaveDisposition] = useState(SAVED.sickLeaveDisposition ?? "credit");
  const [sickLeaveCustomCreditYears, setSickLeaveCustomCreditYears] = useState(SAVED.sickLeaveCustomCreditYears ?? 1.0);
  // Beneficiary age for CalPERS survivor benefit options (0 = same as member at retirement)
  const [beneficiaryAge, setBeneficiaryAge] = useState(SAVED.beneficiaryAge ?? 0);
  // Promotion modeling
  const [modelPromotion, setModelPromotion] = useState(SAVED.modelPromotion ?? false);
  const [promotionAge, setPromotionAge] = useState(SAVED.promotionAge ?? 30);
  const [promotionClassification, setPromotionClassification] = useState(SAVED.promotionClassification ?? "Fire Engineer");
  const [promotionStep, setPromotionStep] = useState(SAVED.promotionStep ?? "H");
  // Planned retirement year (works alongside age; 0 = derive from age inputs)
  const [plannedRetirementYear, setPlannedRetirementYear] = useState(SAVED.plannedRetirementYear ?? 0);
  // Projected raises — % values. The MOU (1/1/26–12/31/29) sets 2027=0% and 2029=1.75%; 2028 defaults to 3% (Treasurer est.).
  const [raise2027, setRaise2027] = useState(SAVED.raise2027 ?? 0);
  const [raise2028, setRaise2028] = useState(SAVED.raise2028 ?? 3);
  const [raise2029, setRaise2029] = useState(SAVED.raise2029 ?? 1.75);
  // Contract ends 12/31/2029. Every year from 2030 on uses this assumed annual raise (compounds to retirement). ~3% historically steady.
  const [raiseAfterContract, setRaiseAfterContract] = useState(SAVED.raiseAfterContract ?? SAVED.raiseAfter2030 ?? 3.0);
  // Tier 4 RHS account assumed annual investment return (member-adjustable). Default 5% —
  // moderate-conservative for a health/VEBA account that de-risks toward retirement.
  const [rhsReturn, setRhsReturn] = useState(SAVED.rhsReturn ?? 5);
  // Inflation assumption for the "today's dollars" view of retirement income.
  const [inflationRate, setInflationRate] = useState(SAVED.inflationRate ?? 2.5);
  // ── DERIVED VALUES ────────────────────────────────────────────────────────
  const hireYear = parseInt(hireDate.slice(0, 4), 10) || new Date().getFullYear();
  const hireMonth = parseInt(hireDate.slice(5, 7), 10) || 1;
  const hireDay = parseInt(hireDate.slice(8, 10), 10) || 1;
  // Schedule A = hired before 2018 (8 steps A–H); Schedule B = 2018+ (9 steps A–I)
  const activeSchedule = SALARY_SCHEDULE;
  const baseSalary = activeSchedule[classification]?.steps[salaryStep] || 0;
  const NOW = new Date();
  const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
  // Date of birth drives exact age (to the quarter-year) for CalPERS benefit factors.
  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(dob || "");
  const dobDate = dobValid ? new Date(parseInt(dob.slice(0, 4), 10), parseInt(dob.slice(5, 7), 10) - 1, parseInt(dob.slice(8, 10), 10)) : null;
  const currentAge = dobDate ? Math.max(0, Math.floor((NOW - dobDate) / MS_PER_YEAR)) : 40;
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
  const exactRetireAge = dobDate ? (retirementDate - dobDate) / MS_PER_YEAR : retirementAge;
  const retireAgeQ = dobDate ? Math.max(0, Math.floor(exactRetireAge * 4) / 4) : retirementAge;
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
  const cumulativeRaiseFactor = (() => {
    if (retirementYear < 2027) return 1.0;
    let f = 1.0;
    if (retirementYear >= 2027) f *= (1 + (parseFloat(raise2027) || 0) / 100);
    if (retirementYear >= 2028) f *= (1 + (parseFloat(raise2028) || 0) / 100);
    if (retirementYear >= 2029) f *= (1 + (parseFloat(raise2029) || 0) / 100);
    // Contract ends 12/31/2029 — every year from 2030 on uses the post-contract assumption.
    if (retirementYear >= 2030) f *= Math.pow(1 + (parseFloat(raiseAfterContract) || 0) / 100, retirementYear - 2029);
    return f;
  })();
  // FF Para II at the same step — anchor for rank separation math
  const ffParaIIAtStep = activeSchedule["Firefighter Paramedic II"]?.steps[salaryStep]
    || activeSchedule["Firefighter Paramedic II"]?.steps["H"] || 0;
  // Rank separation multiplier per MOU (Engineer and Captain only, 2027+)
  const rankMultiplier = (() => {
    if (retirementYear < 2027) return 1.0;
    if (classification === "Fire Engineer") return retirementYear >= 2028 ? 1.10 : 1.075;
    if (classification === "Fire Captain")  return retirementYear >= 2028 ? 1.10 * 1.10 : 1.075 * 1.10;
    return 1.0;
  })();
  // Projected base salary: for Engineer/Captain 2027+ use FF Para II × rank multiplier;
  // for all others (or pre-2027) just apply raises to current base.
  const projectedBaseSalary = (retirementYear >= 2027 &&
    (classification === "Fire Engineer" || classification === "Fire Captain") && ffParaIIAtStep > 0)
    ? ffParaIIAtStep * cumulativeRaiseFactor * rankMultiplier
    : baseSalary * cumulativeRaiseFactor;
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
    const steps = Object.keys(SALARY_SCHEDULE[classification]?.steps || {});
    if (steps.length && !steps.includes(salaryStep)) setSalaryStep(steps[steps.length - 1]);
  }, [classification, salaryStep]);
  useEffect(() => {
    const steps = Object.keys(SALARY_SCHEDULE[promotionClassification]?.steps || {});
    if (steps.length && !steps.includes(promotionStep)) setPromotionStep(steps[steps.length - 1]);
  }, [promotionClassification, promotionStep]);
  // ── PERSIST INPUTS TO LOCAL STORAGE ─────────────────────────────────────
  // Auto-save every state change. Nothing leaves the browser.
  useEffect(() => {
    saveState({
      classification, salaryStep, dob, retirementAge, retirementDateOverride, hireDate,
      memberType, overridePensionType, medicalTier, selectedMedicalPlan, medicalCoverage, retireeMedicalPlan, retireeCoverage, dentalPlan, hasVision, filingStatus, retirementState, otherStateRate, dependents, otherIncome, filingStatusRet, dependentsRet, otherIncomeRet, retIra, retRental, retBusiness, foldExtraIncome, include457InTakeHome, priorService,
      hasParamedic, hasRescue, rescueLevel, hasHazmat, hazmatLevel,
      hasInvestigation, investigationLevel, hasBachelor, hasAssociate,
      hasEngineerCert, hasCompanyOfficer, hasChiefFireOfficer, hasEngineBoss, hasFFII,
      current457, annual457Contrib, hasEmployerMatch, returnRate, retireDrawRate, retireReturnRate, drawStartAge, retireWaitReturnRate, currentOTHours,
      currentSickLeaveHours, airtime, sickLeaveDisposition, sickLeaveCustomCreditYears,
      beneficiaryAge,
      modelPromotion, promotionAge, promotionClassification, promotionStep,
      plannedRetirementYear,
      raise2027, raise2028, raise2029, raiseAfterContract, rhsReturn, inflationRate, openSections,
    });
  }, [
    classification, salaryStep, currentAge, retirementAge, retirementDateOverride, hireDate,
    memberType, overridePensionType, medicalTier, selectedMedicalPlan, medicalCoverage, retireeMedicalPlan, retireeCoverage, dentalPlan, hasVision, filingStatus, retirementState, otherStateRate, dependents, otherIncome, filingStatusRet, dependentsRet, otherIncomeRet, retIra, retRental, retBusiness, foldExtraIncome, include457InTakeHome, priorService,
    hasParamedic, hasRescue, rescueLevel, hasHazmat, hazmatLevel,
    hasInvestigation, investigationLevel, hasBachelor, hasAssociate,
    hasEngineerCert, hasCompanyOfficer, hasChiefFireOfficer, hasEngineBoss, hasFFII,
    current457, annual457Contrib, hasEmployerMatch, returnRate, retireDrawRate, retireReturnRate, drawStartAge, retireWaitReturnRate, currentOTHours,
    currentSickLeaveHours, sickLeaveDisposition, sickLeaveCustomCreditYears,
    beneficiaryAge,
    modelPromotion, promotionAge, promotionClassification, promotionStep,
    plannedRetirementYear,
    raise2027, raise2028, raise2029, raiseAfterContract, rhsReturn, inflationRate, openSections,
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
  // Retirement-time pensionable compensation
  const cashPensionable = projectedBaseSalary + incentives.pensionableAmt;
  const cashNonPensionable = incentives.nonPensionableAmt;
  const cashComp = cashPensionable + cashNonPensionable;
  // Sick-leave cash-out hourly rate — per MOU/Treasurer: BASE hourly + longevity ONLY
  // (no incentives), on the 56-hr shift basis (÷242.67, matching the official schedule's
  // hourly column). Gross = hours × this rate, then the tier % (e.g. 60%) is applied.
  const sickLeaveHourlyRate = (projectedBaseSalary * (1 + (showLongevity ? LONGEVITY(yearsOfService) : 0))) / FLSA_56HR_MONTHLY_HOURS;
  // Holiday pay (Classic only, pensionable) — based on projected salary
  const holidayPayMonthly = memberType === "classic"
    ? (projectedBaseSalary / FLSA_56HR_MONTHLY_HOURS * (1 + (showLongevity ? LONGEVITY(yearsOfService) : 0))) * HOLIDAY_HOURS / 12
    : 0;
  // Uniform allowance (Classic only, pensionable)
  const uniformMonthly = memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0;
  // FLSA OT — special comp, pensionable for Classic only (~2% of base), NOT PEPRA
  const flsaOTPensionableMonthly = memberType === "classic" ? projectedBaseSalary * FLSA_OT_PENSIONABLE_PCT : 0;
  const totalPensionableMonthly = cashPensionable + holidayPayMonthly + uniformMonthly + flsaOTPensionableMonthly;
  // ── SICK LEAVE PROJECTION ────────────────────────────────────────────────
  // Project current hours forward at 144 hrs/yr (6 shifts × 24 hrs). No accrual cap.
  const sickLeaveHours = currentSickLeaveHours + SICK_LEAVE_ANNUAL_ACCRUAL_HOURS * yearsToRetirement;
  // ── SICK LEAVE CONVERSION (CalPERS Gov Code 20862.8 + MOU Ch3 Art III) ─────
  const sickLeaveMaxCreditYears = sickLeaveHours / SICK_LEAVE_HOURS_PER_YEAR_CREDIT;
  const sickLeaveCreditYears =
    sickLeaveDisposition === "cash" ? 0 :
    sickLeaveDisposition === "credit" ? sickLeaveMaxCreditYears :
    Math.min(Math.max(sickLeaveCustomCreditYears, 0), sickLeaveMaxCreditYears);
  const sickLeaveHoursToCredit = sickLeaveCreditYears * SICK_LEAVE_HOURS_PER_YEAR_CREDIT;
  const sickLeaveHoursToCash = Math.max(0, sickLeaveHours - sickLeaveHoursToCredit);
  // Effective YOS used for pension % (base + credit). Other things (longevity, etc.) use base only.
  const airtimeYears = Math.min(5, Math.max(0, parseFloat(airtime) || 0)); // purchased service credit, capped at CalPERS max 5 yrs
  const yearsOfServiceForPension = yearsOfService + sickLeaveCreditYears + airtimeYears;
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
  // Roseville bucket %, capped at 90% (this is what the 90% cap visuals track).
  const pensionPct = Math.min(yearsOfServiceForPension * rosevilleFactor + sameFormulaPriorPct, 0.90);
  // Other-CalPERS-formula buckets — each capped at 90% on its own, then summed (rarely binds).
  const otherCalpersFormulaPct = priorService.reduce((s, r) =>
    (isCalpersFormula(r.formula) && r.formula !== rosevilleFormulaKey)
      ? s + Math.min(Math.max(0, parseFloat(r.years) || 0) * priorYearFactor(r.formula, r.manualFactor, retireAgeQ), 0.90) : s, 0);
  // Total CalPERS % paid as ONE allowance (Roseville bucket + other-formula buckets stacked).
  const calpersTotalPct = pensionPct + otherCalpersFormulaPct;
  // Itemized CalPERS service components contributing toward the 90% cap (for display).
  const calpersComponents = [
    { label: "Roseville Fire", yrs: yearsOfService, factor: rosevilleFactor },
    ...(airtimeYears > 0 ? [{ label: "Purchased service credit (airtime)", yrs: airtimeYears, factor: rosevilleFactor }] : []),
    ...(sickLeaveCreditYears > 0 ? [{ label: "Sick-leave service credit", yrs: sickLeaveCreditYears, factor: rosevilleFactor }] : []),
    ...priorService.filter(r => isCalpersFormula(r.formula) && r.formula === rosevilleFormulaKey).map(r => ({
      label: (r.agencyName && r.agencyName.trim()) ? r.agencyName.trim() : ((PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "CalPERS service"),
      formulaLabel: (PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label,
      yrs: Math.max(0, parseFloat(r.years) || 0),
      factor: priorYearFactor(r.formula, r.manualFactor, retireAgeQ),
    })),
  ].map(c => ({ ...c, pct: c.yrs * c.factor }));
  const calpersRawPct = calpersComponents.reduce((s, c) => s + c.pct, 0);
  const calpersOverCap = calpersRawPct > 0.90 + 1e-9;
  // PEPRA caps the pensionable compensation the pension is figured on; Classic is not capped this way.
  const pensionableForPension = memberType === "pepra" ? Math.min(totalPensionableMonthly, peraCapMonthly) : totalPensionableMonthly;
  const peraCapApplies = memberType === "pepra" && totalPensionableMonthly > peraCapMonthly;
  const pension50Monthly = pensionableForPension * pensionPct;     // Roseville-formula bucket (capped at 90%)
  const monthlyPension = pensionableForPension * calpersTotalPct;   // full CalPERS allowance (other formulas stacked on top)
  const annualPension = monthlyPension * 12;
  // CalPERS allowance option factors (member age + beneficiary age determine reduction)
  const effectiveBeneficiaryAge = beneficiaryAge > 0 ? beneficiaryAge : retirementAge;
  const optionFactors = calcOptionFactors(retirementAge, effectiveBeneficiaryAge);
  const survivorOptions = [
    { key: "opt1", label: "Option 1 — Unmodified", factor: optionFactors.opt1, survivorPct: 0, note: "Max amount. No survivor benefit." },
    { key: "opt2", label: "Option 2 — 100% Joint & Survivor", factor: optionFactors.opt2, survivorPct: 1.00, note: "100% continues to beneficiary for life." },
    { key: "opt2w", label: "Option 2W — 100% J&S with pop-up", factor: optionFactors.opt2w, survivorPct: 1.00, note: "100% to beneficiary; allowance \"pops up\" to Unmodified if beneficiary dies first." },
    { key: "opt3", label: "Option 3 — 50% Joint & Survivor", factor: optionFactors.opt3, survivorPct: 0.50, note: "50% continues to beneficiary for life." },
    { key: "opt3w", label: "Option 3W — 50% J&S with pop-up", factor: optionFactors.opt3w, survivorPct: 0.50, note: "50% to beneficiary; pops up to Unmodified if beneficiary dies first." },
  ].map(opt => ({
    ...opt,
    memberMonthly: monthlyPension * opt.factor,
    survivorMonthly: monthlyPension * opt.factor * opt.survivorPct,
  }));
  // Promotion model
  let promotionPension = null;
  if (modelPromotion && promotionAge < retirementAge) {
    const promBase = activeSchedule[promotionClassification]?.steps[promotionStep] || 0;
    // Promotion changes PAY, not the retirement year — total CalPERS service is unchanged.
    const promYOS = yearsOfServiceForPension;
    // Project the promoted base to retirement the SAME way as the main path (raises + MOU rank separation),
    // so the comparison is apples-to-apples (both in retirement-year dollars).
    const ffParaIIAtPromStep = activeSchedule["Firefighter Paramedic II"]?.steps[promotionStep] || ffParaIIAtStep;
    const promRankMultiplier = retirementYear < 2027 ? 1.0
      : promotionClassification === "Fire Engineer" ? (retirementYear >= 2028 ? 1.10 : 1.075)
      : promotionClassification === "Fire Captain" ? (retirementYear >= 2028 ? 1.10 * 1.10 : 1.075 * 1.10)
      : 1.0;
    const promProjectedBase = (retirementYear >= 2027 &&
      (promotionClassification === "Fire Engineer" || promotionClassification === "Fire Captain") && ffParaIIAtPromStep > 0)
      ? ffParaIIAtPromStep * cumulativeRaiseFactor * promRankMultiplier
      : promBase * cumulativeRaiseFactor;
    const promInc = calcIncentives(promProjectedBase, promotionClassification, memberType, yearsOfService, retirementDate, hireYear);
    const promCashPensionable = promProjectedBase + promInc.pensionableAmt;
    const promHoliday = memberType === "classic"
      ? (promProjectedBase / FLSA_56HR_MONTHLY_HOURS * (1 + (showLongevity ? LONGEVITY(yearsOfService) : 0))) * HOLIDAY_HOURS / 12 : 0;
    const promUniform = memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0;
    const promFlsaOT = memberType === "classic" ? promProjectedBase * FLSA_OT_PENSIONABLE_PCT : 0;
    const promTotal = promCashPensionable + promHoliday + promUniform + promFlsaOT;
    const promPct = Math.min(promYOS * rosevilleFactor + sameFormulaPriorPct, 0.90);
    const promPensionable = memberType === "pepra" ? Math.min(promTotal, peraCapMonthly) : promTotal;
    const promMonthly = promPensionable * (promPct + otherCalpersFormulaPct);
    promotionPension = {
      monthly: promMonthly, annual: promMonthly * 12,
      diff: promMonthly - monthlyPension,
      diffAnnual: (promMonthly - monthlyPension) * 12,
      pensionPct: promPct,
    };
  }
  // Retiree medical
  const tier4RHS = calcTier4RHS({
    hireYear, retirementYear,
    currentYear: NOW.getFullYear(),
    baseAnnualNow: baseSalary * 12,
    salaryGrowth: (parseFloat(raiseAfterContract) || 0) / 100,
    annualReturn: (parseFloat(rhsReturn) || 0) / 100,
  });
  // Total CalPERS-credited service for retiree-medical vesting: Roseville + same-system CalPERS
  // prior service (e.g., CalFire). Counts once the member has ≥5 Roseville years (MOU Art II.C).
  const sameCalpersPriorYears = priorService.reduce((s, r) => isCalpersFormula(r.formula) ? s + Math.max(0, parseFloat(r.years) || 0) : s, 0);
  const totalCalpersYears = cityYOS + sameCalpersPriorYears;
  const medical = medicalTier === "4"
    ? { monthly: 0, vested: 1.0, ...tier4RHS }
    : calcRetireeMedical(medicalTier, hireYear, retirementYear, cityYOS, totalCalpersYears);
  // Member-chosen plan cost breakdown (Medical tab)
  const selectedPlanObj = MEDICAL_PLANS_2026.find(p => p.name === selectedMedicalPlan) || MEDICAL_PLANS_2026[0];
  const selectedPremium = selectedPlanObj[medicalCoverage] || selectedPlanObj.ee;
  const retireePlanObj = MEDICAL_PLANS_2026.find(p => p.name === retireeMedicalPlan) || MEDICAL_PLANS_2026[0];
  const retireePremium = retireePlanObj[retireeCoverage] || retireePlanObj.ee;
  // Roseville split-payment: City pays the PEMHCA minimum straight to CalPERS, so CalPERS deducts only
  // the remaining premium from the pension check (City reimburses the rest separately).
  const PEMHCA_MIN_MONTHLY = 162; // 2026 statutory minimum employer contribution paid to CalPERS
  const calpersMedicalDeduction = Math.max(0, retireePremium - PEMHCA_MIN_MONTHLY);
  // City medical share per MOU Ch.4 Art.I §C: up to a % of the Kaiser premium for the tier, plus
  // $180 toward dental/vision. Unused amounts are NOT paid out (§C.5) — the member pays only the overage.
  const dentalObj = DENTAL_PLANS_2026.find(p => p.name === dentalPlan) || DENTAL_PLANS_2026[0];
  const dentalPremium = dentalObj[DENTAL_TIER_FROM_MED[medicalCoverage]] || 0;
  const visionPremium = hasVision ? (VISION_2026[medicalCoverage] || 0) : 0;
  const KAISER_PLAN = MEDICAL_PLANS_2026.find(p => p.name === "Kaiser Permanente") || {};
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
  const memberMax457 = Math.max(0, MAX_457_ANNUAL - cityMatchAnnual);
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
  // Pension boost from sick leave credit (monthly)
  const sickLeaveCreditMultiplier = memberType === "classic" ? CLASSIC_MULTIPLIER :
    Math.min(retireAgeQ >= 57 ? 0.027 : 0.020 + (retireAgeQ - 50) * (0.007 / 7), 0.027);
  // Marginal value of the sick-leave credit, respecting the 90% cap (zero once already capped).
  const pensionPctNoCredit = Math.min(yearsOfService * sickLeaveCreditMultiplier, memberType === "classic" ? CLASSIC_MAX_PCT : 0.90);
  const sickLeavePensionBoostMonthly = pensionableForPension * Math.max(0, pensionPct - pensionPctNoCredit);
  // Alternate values shown side-by-side for member comparison
  const altCashIfAllCash = calcSickLeavePayoff(sickLeaveHours, sickLeaveHourlyRate);
  // "All credit" comparison — marginal pension % gain over base service, respecting the 90% cap.
  const altPctAllCredit = Math.min((yearsOfService + sickLeaveMaxCreditYears) * sickLeaveCreditMultiplier, memberType === "classic" ? CLASSIC_MAX_PCT : 0.90);
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
    const pct = sameFormula ? yrs * factor : Math.min(yrs * factor, CLASSIC_MAX_PCT);
    const monthly = sameFormula ? 0 : compMonthly * pct;
    return { ...r, calpers, sameFormula, otherCalpers, compMonthly, yrs, factor, pct, monthly };
  });
  // Separate reciprocal checks only (CalPERS rows — same- and other-formula — are inside monthlyPension).
  const priorPensionMonthly = priorServiceCalc.filter(r => !r.calpers).reduce((s, r) => s + r.monthly, 0);
  // Headline = full CalPERS allowance (90% bucket + stacked other-formula) + reciprocal checks.
  const combinedPensionMonthly = monthlyPension + priorPensionMonthly;
  const priorTotalYears = priorServiceCalc.reduce((s, r) => s + r.yrs, 0);
  // Unified % view: reciprocal rows on Roseville comp stack on top of the full CalPERS %.
  const priorPctOnRoseComp = priorServiceCalc.filter(r => !r.calpers && r.useRosevilleComp !== false).reduce((s, r) => s + r.pct, 0);
  const combinedPensionPct = calpersTotalPct + priorPctOnRoseComp;
  const combinedPctLabel = priorPctOnRoseComp > 0
    ? `${pct(calpersTotalPct)} CalPERS + ${pct(priorPctOnRoseComp)} reciprocal = ${pct(combinedPensionPct)}`
    : pct(calpersTotalPct);
  // Total retirement income
  const totalMonthly = monthlyPension + medical.monthly + monthly457 + priorPensionMonthly;
  const totalAnnual = totalMonthly * 12;
  // vs current — use today's base salary (not projected) for the take-home comparison
  const currentMonthlySalary = baseSalary * (1 + incentives.totalIncentivePct);
  // CalPERS member contribution is on TODAY'S pensionable comp (so the take-home comparison is today-vs-today, not today-minus-projected).
  const currentLongevityPct = (memberType === "classic" && showLongevity) ? LONGEVITY(yearsOfService) : 0;
  const currentPensionableMonthly =
    baseSalary * (1 + incentives.pensionablePct)
    + (memberType === "classic" ? (baseSalary / FLSA_56HR_MONTHLY_HOURS) * (1 + currentLongevityPct) * HOLIDAY_HOURS / 12 : 0)
    + (memberType === "classic" ? UNIFORM_ALLOWANCE_ANNUAL / 12 : 0)
    + (memberType === "classic" ? baseSalary * FLSA_OT_PENSIONABLE_PCT : 0);
  const employeeCalPERSContrib = currentPensionableMonthly * (memberType === "classic" ? 0.09 : 0.115);
  const currentTakeHome = currentMonthlySalary - employeeCalPERSContrib - (effectiveMember457 / 12) - UNION_DUES_MONTHLY - medicalTotalOOP;
  const retirementVsWorking = totalMonthly / currentMonthlySalary;
  // Retirement income deflated to TODAY'S purchasing power (projection is in retirement-year dollars).
  const totalMonthlyTodayDollars = totalMonthly / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement);
  // ── OVERTIME (FLSA regular-rate method) ─────────────────────────────────
  const otHoursMonthly = Math.max(0, parseFloat(currentOTHours) || 0);
  const flsaRegularHourly = currentMonthlySalary / FLSA_56HR_MONTHLY_HOURS;     // base + incentives
  const otHourlyRate = flsaRegularHourly * 1.5;                                 // time-and-a-half
  const otMonthly = otHoursMonthly * otHourlyRate;
  const salaryWithOT = currentMonthlySalary + otMonthly;
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
  const retGrossTax = (combinedPensionMonthly + monthly457) * 12 + (foldExtraIncome ? extraIncomeAnnual : 0);
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
  // Retiree out-of-pocket medical (net premium after the City allowance) — member pays only the overage.
  const cityAllowance = medical.monthly; // City retiree-medical allowance from the existing hire-date tier model
  const retireeMedicalOOP = Math.max(0, retireePremium - cityAllowance);
  const pensionTakeHome = Math.max(0, monthlyPension * (1 - retEffRate) - calpersMedicalDeduction);
  // Separate City reimbursement check = the City's allowance (up to the premium) minus the $162 it already sent CalPERS.
  const cityMedicalCheck = Math.max(0, Math.min(cityAllowance, retireePremium) - PEMHCA_MIN_MONTHLY);
  // Total cash actually deposited each month = PERS direct deposit + the separate City medical reimbursement
  // check + (only when folded in) the net of any extra household income.
  const totalMonthlyTakeHome = pensionTakeHome + cityMedicalCheck + extraNetMonthly + (include457InTakeHome ? monthly457 * (1 - retEffRate) : 0);
  // ── Balancing ledger (Retirement summary): total money in resolves into money kept + money paid out, nets to $0.
  const cityMedicalContribution = PEMHCA_MIN_MONTHLY + cityMedicalCheck; // City's total toward premium (PEMHCA min + separate check)
  const ledgerExtraIncome = foldExtraIncome ? extraIncomeAnnual / 12 : 0;
  const ledgerTotalIncome = monthlyPension + cityMedicalContribution + monthly457 + ledgerExtraIncome;
  const ledger457TakeHome = monthly457 * (1 - retEffRate);
  const ledgerTax = (monthlyPension + monthly457 + ledgerExtraIncome) * retEffRate;
  const ledgerBalance = ledgerTotalIncome - pensionTakeHome - cityMedicalCheck - ledger457TakeHome - extraNetMonthly - ledgerTax - retireePremium;
  // True working take-home: base + incentives + your overtime, net of income tax (on salary+OT) and the
  // deductions already in currentTakeHome (PERS, 457, dues, medical). Overtime ends at retirement.
  const workingTakeHome = Math.max(0, currentTakeHome + otMonthly - taxSalaryOT.tax / 12);
  // Decision-maker: gain/loss in monthly take-home from retiring (nominal, and in today's dollars).
  const retireTakeHomeToday = totalMonthlyTakeHome / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement);
  const takeHomeDiff = totalMonthlyTakeHome - workingTakeHome;
  const takeHomeDiffToday = retireTakeHomeToday - workingTakeHome;
  // 401k equivalents
  const equiv401k_4pct = annualPension / 0.04;
  const equivFull_4pct = totalAnnual / 0.04;
  const equiv401k_3pct = annualPension / 0.03;
  // COLA
  const colaRate = memberType === "classic" ? 0.03 : 0.02;
  // Realized COLA = the LESSER of the contracted cap and actual CPI. CalPERS pays up to your cap but never
  // more than inflation (a 3% cap only delivers 3% if CPI ≥ 3%); a 2% cap is limited to 2%. The timeline
  // uses this realistic rate. (Banking of unused CPI in high-inflation years is not modeled.)
  const cpiRate = Math.max(0, parseFloat(inflationRate) || 0) / 100;
  const effectiveColaRate = Math.min(colaRate, cpiRate);
  const colaYears = [5, 10, 15, 20, 25, 30];
  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      <div className="no-print" style={{ position: "absolute", top: "12px", right: "12px", zIndex: 40 }}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: "8px", padding: "4px 12px", fontSize: "20px", lineHeight: 1.1, cursor: "pointer" }}>⋯</button>
        {menuOpen && (
          <div style={{ position: "absolute", top: "42px", right: 0, background: "#17171b", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "6px", minWidth: "190px", boxShadow: "0 10px 30px rgba(0,0,0,0.55)" }}>
            <button onClick={() => { setMenuOpen(false); window.print(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: COLORS.text, padding: "10px 12px", fontSize: "13px", cursor: "pointer", borderRadius: "6px" }}>Print / Save PDF</button>
            <a href={`mailto:?subject=${encodeURIComponent("My RFF Retirement Estimate")}&body=${encodeURIComponent(`Estimated total monthly income: ${fmt(totalMonthly)}\nMonthly pension: ${fmt(combinedPensionMonthly)}\n457 at retirement: ${fmt(value457)}\nReplacement: ${(retirementVsWorking * 100).toFixed(0)}% of current pay\n\nFrom the RFF Retirement Calculator — https://1592treasurer.github.io/RFF-retirement-calculator/ (estimates only)`)}`} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", color: COLORS.text, padding: "10px 12px", fontSize: "13px", textDecoration: "none", borderRadius: "6px" }}>Email me this</a>
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
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "8px 14px" : "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: isMobile ? "9px" : "11px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted, fontWeight: "600" }}>Monthly take-home</div>
            <div style={{ fontSize: isMobile ? "20px" : "28px", fontWeight: "800", color: COLORS.green, lineHeight: 1.1 }}>{fmt(totalMonthlyTakeHome)}/mo</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: isMobile ? "9px" : "11px", textTransform: "uppercase", letterSpacing: "1px", color: COLORS.textMuted, fontWeight: "600" }}>{takeHomeDiff >= 0 ? "Gained by retiring" : "Lost by retiring"}</div>
            <div style={{ fontSize: isMobile ? "20px" : "28px", fontWeight: "800", color: takeHomeDiff >= 0 ? COLORS.green : COLORS.gold, lineHeight: 1.1 }}>{takeHomeDiff >= 0 ? "+" : "−"}{fmt(Math.abs(takeHomeDiff))}/mo</div>
          </div>
        </div>
      </div>
      <div className="no-print" style={{ ...styles.container, padding: isMobile ? "16px 12px" : "32px 20px" }}>
        {datesInvalid && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#fca5a5" }}>
            ⚠ Your retirement date is on or before your hire date. Fix the hire date or retirement age on Start here — the numbers above aren't valid until then.
          </div>
        )}
        <div style={{ ...styles.tabRow, flexWrap: "nowrap", gap: isMobile ? "8px" : "10px" }}>
          {["inputs", "pension", "medical", "income", "timeline", "help"].map(t => (
            <button key={t} style={{ ...styles.tab(tab === t), flex: 1, textAlign: "center", fontSize: isMobile ? "11px" : "14px", padding: isMobile ? "10px 2px" : "11px 10px", whiteSpace: "nowrap" }} onClick={() => setTab(t)}>
              {{ inputs: isMobile ? "Overview" : "1 · Retirement Overview", pension: isMobile ? "Pension" : "2 · Pension Details", medical: isMobile ? "Med" : "3 · Medical", income: isMobile ? "Income" : "4 · Additional Income & Tax", timeline: isMobile ? "Timeline" : "5 · Income Timeline", help: isMobile ? "Guide" : "Guide" }[t]}
            </button>
          ))}
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: "1fr" }}>
          {/* LEFT PANEL */}
          <div>
            {tab === "inputs" && (
              <>
                {/* Privacy + Reset bar */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: "12px", flexWrap: "wrap",
                  padding: "10px 14px", marginBottom: "16px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: `1px solid rgba(255, 255, 255, 0.2)`,
                  borderRadius: "8px", fontSize: "11px",
                }}>
                  <span style={{ color: COLORS.textMuted, lineHeight: "1.5" }}>
                    Your inputs are saved<strong style={{ color: COLORS.green }}>on this device only</strong> — never sent anywhere.
                  </span>
                  <button onClick={resetAll} style={{
                    background: "transparent", color: COLORS.textMuted,
                    border: `1px solid ${COLORS.border}`, borderRadius: "6px",
                    padding: "4px 10px", fontSize: "11px", cursor: "pointer",
                    fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
                  }}>
                    Reset
                  </button>
                </div>
                {/* INPUT BOXES — responsive 2-column grid */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px", alignItems: "start" }}>
                {/* Box 1 — Birthdate & retirement */}
                <div style={styles.card}>
                  {sectionHeader("profile", "1 · Hire date, birthdate & retirement")}
                  {openSections.profile !== false && (<>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Roseville Hire Date <span style={{ color: COLORS.green, fontSize: "10px" }}>· drives Classic/PEPRA, medical tier &amp; longevity</span></label>
                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 1fr", gap: "8px" }}>
                      <select style={styles.select} value={hireMonth} onChange={e => setHireDate(`${hireDate.slice(0, 4)}-${String(+e.target.value).padStart(2, "0")}-${hireDate.slice(8, 10)}`)}>
                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
                      </select>
                      <select style={styles.select} value={hireDay} onChange={e => setHireDate(`${hireDate.slice(0, 4)}-${hireDate.slice(5, 7)}-${String(+e.target.value).padStart(2, "0")}`)}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<option key={d} value={d}>{d}</option>))}
                      </select>
                      <select style={styles.select} value={hireYear} onChange={e => setHireDate(`${e.target.value}-${hireDate.slice(5, 7)}-${hireDate.slice(8, 10)}`)}>
                        {Array.from({ length: 2026 - 1980 + 1 }, (_, i) => 2026 - i).map(y => (<option key={y} value={y}>{y}</option>))}
                      </select>
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                      <span style={{ ...styles.badge, ...styles.badgeGreen }}>{yearsOfService.toFixed(1)} yrs at retirement</span>
                      <span style={{ ...styles.badge, ...styles.badgeGreen }}>Medical Tier {medicalTier}</span>
                      <span style={{ fontSize: "11px", color: COLORS.textMuted }}>
                        {medicalTier === "1" ? "Pre-2004 · $1,200 base" :
                          medicalTier === "2" ? "2004–2011 · $1,200 base + vesting" :
                            medicalTier === "3" ? "2012–2014 · $720 base + vesting" :
                              "2015+ · RHS account"}
                      </span>
                    </div>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Date of Birth <span style={{ color: COLORS.green, fontSize: "10px" }}>· sets your exact age for CalPERS factors</span></label>
                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 1fr", gap: "8px" }}>
                      <select style={styles.select} value={dobValid ? parseInt(dob.slice(5, 7), 10) : 1} onChange={e => setDob(`${dobValid ? dob.slice(0, 4) : "1990"}-${String(+e.target.value).padStart(2, "0")}-${dobValid ? dob.slice(8, 10) : "01"}`)}>
                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
                      </select>
                      <select style={styles.select} value={dobValid ? parseInt(dob.slice(8, 10), 10) : 1} onChange={e => setDob(`${dobValid ? dob.slice(0, 4) : "1990"}-${dobValid ? dob.slice(5, 7) : "01"}-${String(+e.target.value).padStart(2, "0")}`)}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<option key={d} value={d}>{d}</option>))}
                      </select>
                      <select style={styles.select} value={dobValid ? parseInt(dob.slice(0, 4), 10) : 1990} onChange={e => setDob(`${e.target.value}-${dobValid ? dob.slice(5, 7) : "01"}-${dobValid ? dob.slice(8, 10) : "01"}`)}>
                        {Array.from({ length: (NOW.getFullYear() - 17) - 1945 + 1 }, (_, i) => (NOW.getFullYear() - 17) - i).map(y => (<option key={y} value={y}>{y}</option>))}
                      </select>
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "11px", color: COLORS.textMuted }}>
                      Current age: <strong style={{ color: COLORS.gold }}>{currentAge}</strong> · At retirement: <strong style={{ color: COLORS.gold }}>{Math.floor(exactRetireAge)} yr {Math.round((exactRetireAge - Math.floor(exactRetireAge)) * 12)} mo</strong> → benefit-factor age {retireAgeQ}
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Retirement Age</label>
                      <input style={styles.input} type="number" value={retirementAge || ""}
                        onChange={e => { setRetirementAge(+e.target.value || 0); setRetirementDateOverride(""); }}
                        min={currentAge + 1} max={65} />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>
                        Retirement Date
                        <span style={{ color: COLORS.green, fontSize: "10px" }}> · auto from age — edit exact day</span>
                      </label>
                      <input style={styles.input} type="date" value={effectiveRetDateStr}
                        onChange={e => setRetirementDateOverride(e.target.value)}
                        min={`${NOW.getFullYear()}-01-01`} max="2060-12-31" />
                    </div>
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "11px", color: COLORS.textMuted }}>
                    Retiring {effectiveRetDateStr} · <strong style={{ color: COLORS.gold }}>{yearsOfService.toFixed(1)} yrs</strong> of service
                    {retirementDateOverride
                      ? <> · exact date set <button onClick={() => setRetirementDateOverride("")} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "11px", padding: 0, textDecoration: "underline" }}>reset to age</button></>
                      : <> · set from age {retirementAge}</>}
                  </div>
                  </>)}
                </div>
                {/* Box 2 — Prior agency service */}
                <div style={styles.card}>
                  {sectionHeader("prior", "2 · Prior agency service")}
                  {openSections.prior !== false && (<>
                  {/* Pension Type (auto from hire date, manual override) */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Pension Type {!overridePensionType && <span style={{ color: COLORS.green, fontSize: "10px" }}>· auto from hire date</span>}</label>
                    <select style={{ ...styles.select, opacity: overridePensionType ? 1 : 0.7 }}
                      value={memberType} disabled={!overridePensionType}
                      onChange={e => setMemberType(e.target.value)}>
                      <option value="classic">Classic (3% @ 50) — hired before 1/1/2013</option>
                      <option value="pepra">PEPRA (2.7% @ 57) — hired 1/1/2013 or later</option>
                    </select>
                    <label style={{ ...styles.checkRow, marginTop: "8px", marginBottom: "0" }}>
                      <input style={styles.checkbox} type="checkbox"
                        checked={overridePensionType}
                        onChange={e => setOverridePensionType(e.target.checked)} />
                      <span style={{ ...styles.checkLabel, fontSize: "11px", color: COLORS.textMuted }}>
                        Override (only if Classic via CalPERS reciprocity)
                      </span>
                    </label>
                  </div>
                  {/* Prior Agency Service — any prior agency (CalPERS or different system), each estimated by its own formula */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Prior Agency Service <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· reciprocity (optional)</span></label>
                    <div style={{ ...styles.certNote, marginLeft: "0", marginTop: "0", marginBottom: "10px" }}>
                      Worked at any agency before Roseville? Add one row per agency. Pick the formula it used — another CalPERS agency could be 3%@55, 3%@50, etc., or a different system entirely (LACERA, '37 Act counties, CalSTRS, FERS). We estimate each on its own formula, your years there, and (by default) your Roseville final pay (the highest-comp rule). Those years are calculated at that agency's formula — not merged into your Roseville years.
                    </div>
                    {priorService.map((r, i) => {
                      const calc = priorServiceCalc[i] || {};
                      return (
                        <div key={r.id} style={{ background: "#121214", border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: COLORS.accent }}>Prior Agency #{i + 1}</span>
                            <button onClick={() => removePriorRow(r.id)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: "12px" }}>✕ remove</button>
                          </div>
                          <label style={styles.label}>Agency name <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· e.g. CalFire, LACERA</span></label>
                          <input style={{ ...styles.input, marginBottom: "10px" }} type="text" value={r.agencyName || ""} placeholder="Agency name" onChange={e => updatePriorRow(r.id, { agencyName: e.target.value })} />
                          <label style={styles.label}>Retirement formula</label>
                          <select style={styles.select} value={r.formula} onChange={e => updatePriorRow(r.id, { formula: e.target.value, ...(e.target.value === "manual" ? { useRosevilleComp: false } : {}) })}>
                            {PRIOR_FORMULAS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                          {r.formula === "manual" && (
                            <div style={{ marginTop: "10px" }}>
                              <label style={styles.label}>Benefit factor per year of service (%)</label>
                              <input style={styles.input} type="number" step="0.001" value={r.manualFactor} placeholder="e.g. 2.0"
                                onChange={e => updatePriorRow(r.id, { manualFactor: e.target.value })} />
                              <div style={{ ...styles.certNote, marginLeft: "0" }}>
                                ⚠ For non-CalPERS systems (LACERA &amp; other '37 Act counties, CalSTRS, FERS) — read this per-year % off YOUR statement from that system.
                              </div>
                            </div>
                          )}
                          <div style={{ ...styles.row, marginTop: "10px" }}>
                            <div>
                              <label style={styles.label}>Years of service there</label>
                              <input style={styles.input} type="number" step="0.1" value={r.years} placeholder="e.g. 3"
                                onChange={e => updatePriorRow(r.id, { years: e.target.value })} />
                            </div>
                            <div>
                              <label style={styles.label}>Est. from this system</label>
                              <div style={{ ...styles.input, display: "flex", alignItems: "center", color: COLORS.green, fontWeight: "700" }}>{fmt(calc.monthly || 0)}/mo</div>
                            </div>
                          </div>
                          <label style={{ ...styles.checkRow, marginTop: "10px", marginBottom: "0" }}>
                            <input style={styles.checkbox} type="checkbox" checked={r.useRosevilleComp !== false}
                              onChange={e => updatePriorRow(r.id, { useRosevilleComp: e.target.checked })} />
                            <span style={{ ...styles.checkLabel, fontSize: "12px" }}>Use my Roseville final pay (reciprocity highest-comp rule)</span>
                          </label>
                          {r.useRosevilleComp === false && (
                            <div style={{ marginTop: "8px" }}>
                              <label style={styles.label}>That system's final monthly comp</label>
                              <input style={styles.input} type="number" value={r.customComp} placeholder="0"
                                onChange={e => updatePriorRow(r.id, { customComp: e.target.value })} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={addPriorRow} style={{ width: "100%", background: "rgba(255,255,255,0.12)", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, borderRadius: "8px", padding: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>+ Add prior agency</button>
                    {priorTotalYears > 0 && (
                      <div style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.2)`, borderRadius: "8px", fontSize: "12px", color: COLORS.text, lineHeight: "1.7" }}>
                        <strong style={{ color: COLORS.green }}>Your total time:</strong> {yearsOfService.toFixed(1)} yrs Roseville + {priorTotalYears} yrs prior = <strong>{(yearsOfService + priorTotalYears).toFixed(1)} years</strong>
                        {priorPctOnRoseComp > 0 && (
                          <> · combined ≈ <strong style={{ color: COLORS.gold }}>{pct(combinedPensionPct)}</strong> across systems (each system caps at 90% individually; reciprocal systems pay separately, so a combined total above 90% is possible)</>
                        )}
                        {" "}· prior service adds <strong style={{ color: COLORS.green }}>{fmt(priorPensionMonthly)}/mo</strong>
                      </div>
                    )}
                    {priorService.length > 0 && (
                      <div style={{ ...styles.certNote, marginLeft: "0", marginTop: "10px" }}>
                        ⚠ Estimates only. Each prior system calculates and pays your benefit independently — confirm exact amounts with that system. Reciprocity requires you established it on time and retire from all systems on the same day.
                      </div>
                    )}
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Airtime / purchased service <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· years, if you bought CalPERS service credit</span></label>
                    <input style={styles.input} type="number" step="0.5" min={0} max={5} value={airtime || ""} placeholder="0" onChange={e => setAirtime(Math.min(5, Math.max(0, +e.target.value || 0)))} />
                    {airtimeYears > 0 && (
                      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px" }}>Adds {airtimeYears} yr{airtimeYears === 1 ? "" : "s"} of service credit toward your pension % (CalPERS max 5).</div>
                    )}
                  </div>
                  </>)}
                </div>
                {/* Box 3 — Rank */}
                <div style={styles.card}>
                  {sectionHeader("rank", "3 · Rank")}
                  {openSections.rank !== false && (<>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Classification</label>
                    <select style={styles.select} value={classification} onChange={e => setClassification(e.target.value)}>
                      {Object.keys(SALARY_SCHEDULE).map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  </>)}
                </div>
                {/* Box 5 — Pay scale step */}
                <div style={styles.card}>
                  {sectionHeader("paystep", "4 · Pay scale step")}
                  {openSections.paystep !== false && (<>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Salary Step</label>
                      <select style={styles.select} value={salaryStep} onChange={e => setSalaryStep(e.target.value)}>
                        {Object.keys(SALARY_SCHEDULE[classification]?.steps || {}).map(s =>
                          <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Monthly Base</label>
                      <input style={{ ...styles.input, color: COLORS.gold }} value={fmt(baseSalary)} readOnly />
                    </div>
                  </div>
                  </>)}
                </div>
                {/* Box 6 — Incentive & certification pays */}
                <div style={styles.card}>
                  {sectionHeader("incentives", "5 · Incentive & certification pays")}
                  {openSections.incentives && (<>
                  {/* Longevity (pre-2017 hires) OR Service Term Bonus (2017+ hires) */}
                  {showLongevity && (
                    <div style={{ ...styles.tableRow, borderBottom: "none", marginBottom: "8px" }}>
                      <span style={styles.tableKey}>
                        Longevity ({yearsOfService >= 20 ? "20+ yrs" : yearsOfService >= 15 ? "15-19 yrs" : yearsOfService >= 10 ? "10-14 yrs" : "< 10 yrs"})
                        {memberType !== "classic" && <span style={{ fontSize: "10px", color: COLORS.textDim, marginLeft: "4px" }}>(non-pensionable)</span>}
                      </span>
                      <span style={memberType === "classic" ? styles.tableValGold : styles.tableValDim}>
                        {pct(LONGEVITY(yearsOfService))}
                      </span>
                    </div>
                  )}
                  {showServiceTermBonus && (
                    <div style={{ ...styles.tableRow, borderBottom: "none", marginBottom: "8px" }}>
                      <span style={styles.tableKey}>
                        Service Term Bonus ({yearsOfService >= 15 ? "15+ yrs" : yearsOfService >= 10 ? "10-14 yrs" : "< 10 yrs"})
                        <span style={{ fontSize: "10px", color: COLORS.textDim, marginLeft: "4px" }}>(non-pensionable)</span>
                      </span>
                      <span style={styles.tableValDim}>{pct(SERVICE_TERM_BONUS(yearsOfService))}</span>
                    </div>
                  )}
                  {/* Paramedic — for FE and Captain (Captain ceases 1/9/2027) */}
                  {(classification === "Fire Engineer" || classification === "Fire Captain") && (
                    <>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasParamedic} onChange={e => setHasParamedic(e.target.checked)} />
                        <span style={styles.checkLabel}>Paramedic License (5%)</span>
                      </label>
                      {hasParamedic && classification === "Fire Captain" && !captainIncentivesActive && (
                        <div style={styles.warningBox}>
                          ⚠ Captain Paramedic Incentive ceases 1/9/2027 per MOU Art X.B.2.c. Retirement year {retirementYear} → this pay is NOT included.
                        </div>
                      )}
                    </>
                  )}
                  {/* Rescue */}
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={hasRescue} onChange={e => setHasRescue(e.target.checked)} />
                    <span style={styles.checkLabel}>Rescue Certification</span>
                  </label>
                  {hasRescue && (
                    <div style={{ marginLeft: "28px", marginBottom: "10px" }}>
                      <select style={{ ...styles.select, padding: "6px 10px", fontSize: "12px" }}
                        value={rescueLevel} onChange={e => setRescueLevel(e.target.value)}>
                        <option value="team">Team (2.5%)</option>
                        <option value="taskforce">Task Force (5%)</option>
                      </select>
                    </div>
                  )}
                  {/* Hazmat */}
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={hasHazmat} onChange={e => setHasHazmat(e.target.checked)} />
                    <span style={styles.checkLabel}>Hazmat Certification</span>
                  </label>
                  {hasHazmat && (
                    <div style={{ marginLeft: "28px", marginBottom: "10px" }}>
                      <select style={{ ...styles.select, padding: "6px 10px", fontSize: "12px" }}
                        value={hazmatLevel} onChange={e => setHazmatLevel(e.target.value)}>
                        <option value="team">Team (2.5%)</option>
                        <option value="taskforce">Task Force (5%)</option>
                      </select>
                    </div>
                  )}
                  {/* Fire Investigation (NEW) */}
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={hasInvestigation} onChange={e => setHasInvestigation(e.target.checked)} />
                    <span style={styles.checkLabel}>Fire Investigation Assignment</span>
                  </label>
                  {hasInvestigation && (
                    <div style={{ marginLeft: "28px", marginBottom: "10px" }}>
                      <select style={{ ...styles.select, padding: "6px 10px", fontSize: "12px" }}
                        value={investigationLevel} onChange={e => setInvestigationLevel(e.target.value)}>
                        <option value="team">Team (2.5%) · up to 3 members</option>
                        <option value="lead">Team Lead (5%) · up to 6 leads</option>
                      </select>
                    </div>
                  )}
                  {/* Education */}
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={hasBachelor}
                      onChange={e => { setHasBachelor(e.target.checked); if (e.target.checked) setHasAssociate(false); }} />
                    <span style={styles.checkLabel}>Bachelor's Degree (10%)</span>
                  </label>
                  <label style={styles.checkRow}>
                    <input style={styles.checkbox} type="checkbox" checked={hasAssociate}
                      onChange={e => { setHasAssociate(e.target.checked); if (e.target.checked) setHasBachelor(false); }} />
                    <span style={styles.checkLabel}>Associate's Degree (5%)</span>
                  </label>
                  {/* Classification-specific CSFM certs */}
                  {classification === "Fire Engineer" && (
                    <>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasEngineerCert} onChange={e => setHasEngineerCert(e.target.checked)} />
                        <span style={styles.checkLabel}>Engineer Cert / FA Driver-Op (5%)</span>
                      </label>
                      <div style={styles.certNote}>
                        Includes grandfathered Fire Officer Cert (pre-12/31/16) at same 5%.
                      </div>
                      {hasEngineerCert && !engineerCertActive && (
                        <div style={styles.warningBox}>
                          ⚠ Engineer cert pay ceases 1/9/2027 per MOU Art VI.B. Retirement year {retirementYear} → this pay is NOT included.
                        </div>
                      )}
                    </>
                  )}
                  {classification === "Fire Captain" && (
                    <>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasChiefFireOfficer}
                          onChange={e => {
                            setHasChiefFireOfficer(e.target.checked);
                            if (e.target.checked) setHasCompanyOfficer(false);
                          }} />
                        <span style={styles.checkLabel}>Chief Fire Officer Cert (10%)</span>
                      </label>
                      <div style={styles.certNote}>
                        Requires AA degree. Includes grandfathered Chief Officer Cert (pre-12/31/18) at same 10%.
                      </div>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasCompanyOfficer}
                          onChange={e => {
                            setHasCompanyOfficer(e.target.checked);
                            if (e.target.checked) setHasChiefFireOfficer(false);
                          }} />
                        <span style={styles.checkLabel}>Company Officer Cert (5%)</span>
                      </label>
                      <div style={styles.certNote}>
                        Includes grandfathered Fire Officer Cert (pre-12/31/16) at same 5%. Choose this OR Chief Fire Officer above — not both.
                      </div>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasEngineBoss}
                          onChange={e => {
                            setHasEngineBoss(e.target.checked);
                            if (e.target.checked) setHasParamedic(false);
                          }} />
                        <span style={styles.checkLabel}>Engine Boss NWCG Cert (5%)</span>
                      </label>
                      <div style={styles.certNote}>
                        Captain-only. Mutually exclusive with Paramedic Incentive above. Both cease 1/9/2027.
                      </div>
                      {hasEngineBoss && !captainIncentivesActive && (
                        <div style={styles.warningBox}>
                          ⚠ Captain Engine Boss pay ceases 1/9/2027 per MOU Art X.B.2.c. Retirement year {retirementYear} → this pay is NOT included.
                        </div>
                      )}
                    </>
                  )}
                  {(classification === "Firefighter Paramedic I" || classification === "Firefighter Paramedic II") && (
                    <>
                      <label style={styles.checkRow}>
                        <input style={styles.checkbox} type="checkbox" checked={hasFFII} onChange={e => setHasFFII(e.target.checked)} />
                        <span style={styles.checkLabel}>Fire Fighter II Cert (5%)</span>
                      </label>
                      <div style={styles.certNote}>
                        Includes grandfathered Fire Officer Cert (pre-12/31/16) at same 5%.
                      </div>
                    </>
                  )}
                  <div style={{ marginTop: "12px", padding: "10px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", fontSize: "12px", color: COLORS.textMuted }}>
                    ⓘ Education + CSFM cert pay combined cap: <strong style={{ color: COLORS.blue }}>15% max</strong> per MOU Art VI.B
                  </div>
                  </>)}
                </div>
                {/* Box 7 — Sick leave at retirement */}
                <div style={styles.card}>
                  {sectionHeader("sickleave", "6 · Sick leave at retirement")}
                  {openSections.sickleave && (<>
                  <div style={{ ...styles.certNote, marginLeft: "0", marginTop: "0" }}>
                    ⚠ Service credit from sick leave generally applies only if you retire within ~120 days of leaving City service, and it can't be used to reach the 5-year vesting or minimum retirement age.
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Current Sick Leave Hours</label>
                    <input style={styles.input} type="number" value={currentSickLeaveHours || ""}
                      onChange={e => setCurrentSickLeaveHours(+e.target.value || 0)} min={0} max={2400}
                      placeholder="0" />
                    <div style={{ marginTop: "6px", fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.6" }}>
                      Accrual: <strong>144 hrs/yr</strong> (6 shifts × 24 hrs). Projected at retirement:
                      {" "}<strong style={{ color: COLORS.gold }}>
                        {Math.round(sickLeaveHours).toLocaleString()} hrs
                      </strong>
                      {" "}<span style={{ color: COLORS.textDim }}>(current {currentSickLeaveHours.toLocaleString()} + {yearsToRetirement.toFixed(1)} yrs × 144)</span>
                    </div>
                    {sickLeaveHours > 0 && (
                      <div style={{ marginTop: "8px", fontSize: "11px", color: COLORS.textMuted }}>
                        {Math.round(sickLeaveHours).toLocaleString()} hrs ÷ 8 = <strong>{(sickLeaveHours / 8).toFixed(0)} days</strong> →
                        max <strong style={{ color: COLORS.gold }}>{sickLeaveMaxCreditYears.toFixed(2)} yrs</strong> of CalPERS service credit
                      </div>
                    )}
                  </div>
                  {sickLeaveHours > 0 && (
                    <>
                      <label style={{ ...styles.label, marginTop: "8px" }}>Convert to:</label>
                      <label style={styles.checkRow}>
                        <input type="radio" name="sickLeaveDispo"
                          checked={sickLeaveDisposition === "cash"}
                          onChange={() => setSickLeaveDisposition("cash")} />
                        <span style={styles.checkLabel}>All Cash Payout</span>
                      </label>
                      <label style={styles.checkRow}>
                        <input type="radio" name="sickLeaveDispo"
                          checked={sickLeaveDisposition === "credit"}
                          onChange={() => setSickLeaveDisposition("credit")} />
                        <span style={styles.checkLabel}>All Service Credit (boosts pension forever)</span>
                      </label>
                      <label style={styles.checkRow}>
                        <input type="radio" name="sickLeaveDispo"
                          checked={sickLeaveDisposition === "split"}
                          onChange={() => setSickLeaveDisposition("split")} />
                        <span style={styles.checkLabel}>Split — some credit, rest as cash</span>
                      </label>
                      {sickLeaveDisposition === "split" && (
                        <div style={{ marginLeft: "28px", marginBottom: "12px" }}>
                          <label style={styles.label}>Years to convert (max {sickLeaveMaxCreditYears.toFixed(2)})</label>
                          <input style={styles.input} type="number" step="0.05"
                            min={0} max={sickLeaveMaxCreditYears}
                            value={sickLeaveCustomCreditYears || ""}
                            onChange={e => setSickLeaveCustomCreditYears(+e.target.value || 0)} />
                        </div>
                      )}
                      <div style={{ marginTop: "8px", padding: "10px 12px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.6" }}>
                        ⓘ <strong style={{ color: COLORS.blue }}>No double-dipping</strong> — per CalPERS, hours can be <em>either</em> cashed out <em>or</em> converted to service credit, not both. The Split option above lets you choose how many hours go to each bucket.
                      </div>
                      <div style={{ marginTop: "8px", padding: "12px", background: "rgba(255,255,255,0.06)", borderRadius: "8px" }}>
                        {sickLeaveCreditYears > 0 && (
                          <>
                            <div style={styles.tableRow}>
                              <span style={styles.tableKey}>→ Service Credit</span>
                              <span style={styles.tableValGreen}>+{sickLeaveCreditYears.toFixed(2)} yrs</span>
                            </div>
                            <div style={styles.tableRow}>
                              <span style={styles.tableKey}>→ Pension Boost</span>
                              <span style={styles.tableValGreen}>+{fmt(sickLeavePensionBoostMonthly)}/mo for life</span>
                            </div>
                          </>
                        )}
                        {sickLeaveHoursToCash > 0 && (
                          <>
                            <div style={styles.tableRow}>
                              <span style={styles.tableKey}>→ Cash Hours ({sickLeaveHoursToCash.toFixed(0)} hrs at {pct(SICK_LEAVE_TIERS.find(t => sickLeaveHoursToCash >= t.min && sickLeaveHoursToCash <= t.max)?.pct || 0)})</span>
                              <span style={styles.tableValGreen}>{fmt(sickLeavePayoff)}</span>
                            </div>
                          </>
                        )}
                        {sickLeaveCreditYears === 0 && sickLeaveHoursToCash === 0 && (
                          <div style={{ fontSize: "12px", color: COLORS.textMuted, textAlign: "center", padding: "8px" }}>
                            Enter accrued hours above to see options
                          </div>
                        )}
                      </div>
                      {/* Side-by-side comparison */}
                      {sickLeaveDisposition !== "credit" && (
                        <div style={{ marginTop: "8px", fontSize: "11px", color: COLORS.textDim, padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                          <strong>Compare — all credit:</strong> +{altCreditIfAllCredit.toFixed(3)} pension% → +{fmt(altCreditMonthlyIfAllCredit)}/mo for life
                          <br /><span style={{ color: COLORS.textDim }}>(at 25-year retirement: ~{fmt(altCreditMonthlyIfAllCredit * 12 * 25)} lifetime)</span>
                        </div>
                      )}
                      {sickLeaveDisposition !== "cash" && (
                        <div style={{ marginTop: "6px", fontSize: "11px", color: COLORS.textDim, padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                          <strong>Compare — all cash:</strong> {fmt(altCashIfAllCash)} lump sum
                        </div>
                      )}
                    </>
                  )}
                  </>)}
                </div>
                {/* Box 8 — Projected raises */}
                <div style={styles.card}>
                  {sectionHeader("raises", "7 · Projected raises (2027 → retirement)")}
                  {openSections.raises && (<>
                  <div style={{ marginBottom: "12px", fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.6" }}>
                    Raises compound and apply based on your planned retirement year. MOU values (through 12/31/2029) are pre-filled. Every year from 2030 on uses the "After contract" assumption below.
                  </div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>
                        2027 <span style={{ color: COLORS.green, fontSize: "10px" }}>· 0% (MOU)</span>
                      </label>
                      <input style={styles.input} type="number" step="0.01" min={0} max={20}
                        value={raise2027 || ""}
                        placeholder="0"
                        onChange={e => setRaise2027(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>
                        2028 <span style={{ color: COLORS.textDim, fontSize: "10px" }}>· 3% (est.)</span>
                      </label>
                      <input style={styles.input} type="number" step="0.01" min={0} max={20}
                        value={raise2028 || ""}
                        placeholder="0"
                        onChange={e => setRaise2028(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>
                        2029 <span style={{ color: COLORS.green, fontSize: "10px" }}>· 1.75% (MOU)</span>
                      </label>
                      <input style={styles.input} type="number" step="0.01" min={0} max={20}
                        value={raise2029 || ""}
                        onChange={e => setRaise2029(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>
                        After contract (2030+) <span style={{ color: COLORS.gold, fontSize: "10px" }}>· est.</span>
                      </label>
                      <input style={styles.input} type="number" step="0.01" min={0} max={20}
                        value={raiseAfterContract || ""}
                        placeholder="3.0"
                        onChange={e => setRaiseAfterContract(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div style={{ ...styles.certNote, marginLeft: "0" }}>
                    The MOU runs through 12/31/2029. Every year from 2030 until you retire uses the "After contract" rate — historically ~3%/yr has been steady. Set to 0 for none.
                  </div>
                  {retirementYear >= 2027 && (
                    <div style={{ marginTop: "10px", padding: "12px", background: "rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ color: COLORS.textMuted }}>Projected base at retirement ({retirementYear})</span>
                        <span style={{ color: COLORS.gold, fontWeight: "700", fontSize: "15px" }}>{fmt(projectedBaseSalary)}/mo</span>
                      </div>
                      <div style={{ color: COLORS.textDim, fontSize: "11px", marginTop: "2px" }}>
                        Today's base: {fmt(baseSalary)}/mo · Change: {projectedBaseSalary > baseSalary ? "+" : ""}{fmt(projectedBaseSalary - baseSalary)}/mo
                      </div>
                      {(classification === "Fire Engineer" || classification === "Fire Captain") && (
                        <div style={{ marginTop: "6px", color: COLORS.blue, fontSize: "11px", lineHeight: "1.5" }}>
                          ⓘ MOU rank sep applied: {retirementYear >= 2028 ? "10%" : "7.5%"} above FF Para II
                          {classification === "Fire Captain" && " + 10% Captain premium"}
                          {" "}(effective {retirementYear >= 2028 ? "2028" : "2027"})
                        </div>
                      )}
                    </div>
                  )}
                  </>)}
                </div>
                </div>
                {/* Retirement summary — full width at the bottom of the inputs tab */}
                <div style={{ ...styles.card, border: `1px solid ${COLORS.accent}` }}>
                  {sectionHeader("retsum", "Retirement summary")}
                  {openSections.retsum !== false && (<>
                  <div style={{ fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.5", marginBottom: "12px" }}>
                    Where every dollar goes each month â total income at top, minus what you keep and what's paid out, balancing to $0.
                  </div>
                  <div style={{ ...styles.tableRow, borderBottom: `1px solid ${COLORS.accent}` }}>
                    <span style={{ ...styles.tableKey, color: COLORS.text, fontWeight: "700" }}>Total monthly income</span>
                    <span style={{ ...styles.tableValAccent, fontSize: "16px" }}>{fmt(ledgerTotalIncome)}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: COLORS.textDim, margin: "4px 0 12px", lineHeight: 1.5 }}>
                    Gross PERS benefit {fmt(monthlyPension)} + City medical contribution {fmt(cityMedicalContribution)}{monthly457 > 0 ? ` + 457 income ${fmt(monthly457)}` : ""}{foldExtraIncome && extraIncomeAnnual > 0 ? ` + extra income ${fmt(extraIncomeAnnual / 12)}` : ""}
                  </div>
                  <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: COLORS.green, marginBottom: "4px" }}>Money you keep</div>
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>PERS direct deposit <span style={{ fontSize: "10px", color: COLORS.textDim }}>· after tax &amp; medical</span></span>
                    <span style={styles.tableValGreen}>−{fmt(pensionTakeHome)}</span>
                  </div>
                  {cityMedicalCheck > 0 && (
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>City medical check <span style={{ fontSize: "10px", color: COLORS.textDim }}>· separate deposit</span></span>
                      <span style={styles.tableValGreen}>−{fmt(cityMedicalCheck)}</span>
                    </div>
                  )}
                  {monthly457 > 0 && (
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>457 income <span style={{ fontSize: "10px", color: COLORS.textDim }}>· after tax</span></span>
                      <span style={styles.tableValGreen}>−{fmt(ledger457TakeHome)}</span>
                    </div>
                  )}
                  {foldExtraIncome && extraIncomeAnnual > 0 && (
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Extra income (folded in) <span style={{ fontSize: "10px", color: COLORS.textDim }}>· after tax</span></span>
                      <span style={styles.tableValGreen}>−{fmt(extraNetMonthly)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: COLORS.accent, margin: "12px 0 4px" }}>Money paid out</div>
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Income taxes <span style={{ fontSize: "10px", color: COLORS.textDim }}>· ~{pct(retEffRate)} est., withheld</span></span>
                    <span style={styles.tableVal}>−{fmt(ledgerTax)}</span>
                  </div>
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Health insurance premium <span style={{ fontSize: "10px", color: COLORS.textDim }}>· full plan cost</span></span>
                    <span style={styles.tableVal}>−{fmt(retireePremium)}</span>
                  </div>
                  <div style={{ ...styles.tableRowLast, borderTop: `2px solid ${COLORS.accent}`, marginTop: "8px", paddingTop: "10px" }}>
                    <span style={{ ...styles.tableKey, color: COLORS.text, fontWeight: "700" }}>Balance</span>
                    <span style={{ ...styles.tableValAccent, fontSize: "16px" }}>{fmt(Math.abs(ledgerBalance) < 0.5 ? 0 : ledgerBalance)}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "10px", lineHeight: "1.6" }}>
                    Every dollar is accounted for: what you keep (deposits) + what's paid out (taxes &amp; premium) = total income, so it nets to $0. Tax is estimated monthly withholding (no HELPS); your situation may differ.
                  </div>

                  {(sickLeavePayoff > 0 || value457 > 0 || priorPensionMonthly > 0) && (<>
                  <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: COLORS.textMuted, margin: "18px 0 8px" }}>Also at retirement</div>
                  {value457 > 0 && (
                    <div style={styles.tableRow}><span style={styles.tableKey}>457 balance ({returnRate}% return)</span><span style={styles.tableVal}>{fmt(value457)}</span></div>
                  )}
                  {sickLeavePayoff > 0 && (
                    <div style={styles.tableRow}><span style={styles.tableKey}>Sick leave lump sum</span><span style={styles.tableVal}>{fmt(sickLeavePayoff)}</span></div>
                  )}
                  {priorPensionMonthly > 0 && (
                    <div style={styles.tableRow}><span style={styles.tableKey}>Prior agency pension ({priorTotalYears} yrs)</span><span style={styles.tableVal}>{fmt(priorPensionMonthly)}/mo</span></div>
                  )}
                  </>)}
                  </>)}
                </div>
                <div style={{ ...styles.card, border: `2px solid ${COLORS.green}`, background: "rgba(16,185,129,0.06)", marginTop: "20px" }}>
                  <div style={{ ...styles.metricLabel, fontSize: isMobile ? "12px" : "14px", textAlign: "center", marginBottom: "16px" }}>Take-home pay — working now vs. retired</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: isMobile ? "6px" : "16px", alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ ...styles.metricLabel, fontSize: "11px" }}>Working now</div>
                      <div style={{ ...styles.bigNumber, color: COLORS.blue, fontSize: isMobile ? "26px" : "46px" }}>{fmt(workingTakeHome)}</div>
                      <div style={{ fontSize: "11px", color: COLORS.textMuted }}>/mo after taxes &amp; deductions{otMonthly > 0 ? ", incl. overtime" : ""}</div>
                    </div>
                    <div style={{ fontSize: isMobile ? "18px" : "26px", color: COLORS.textDim }}>→</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ ...styles.metricLabel, fontSize: "11px" }}>Retired</div>
                      <div style={{ ...styles.bigNumber, color: COLORS.green, fontSize: isMobile ? "26px" : "46px" }}>{fmt(totalMonthlyTakeHome)}</div>
                      <div style={{ fontSize: "11px", color: COLORS.textMuted }}>/mo take-home</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: COLORS.text, lineHeight: 1.6 }}>
                    That's <strong style={{ color: COLORS.gold }}>{workingTakeHome > 0 ? ((totalMonthlyTakeHome / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement)) / workingTakeHome * 100).toFixed(0) : "—"}%</strong> of your current take-home in today's dollars ({fmt(totalMonthlyTakeHome / Math.pow(1 + (parseFloat(inflationRate) || 0) / 100, yearsToRetirement))}/mo){monthly457 > 0 ? ` — plus ~${fmt(monthly457)}/mo if you draw your 457` : ""}.
                  </div>
                  <div style={{ fontSize: "11px", color: COLORS.textDim, textAlign: "center", marginTop: "8px", lineHeight: 1.5 }}>
                    Net-to-net: in retirement you stop paying into PERS, 457, and union dues. The retired figure is in retirement-year dollars; the percentage adjusts to today's buying power.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
                    <label style={{ ...styles.label, marginBottom: 0, flex: "none" }}>Inflation assumption (%)</label>
                    <input style={{ ...styles.input, width: "90px" }} type="number" step="0.1" min={0} max={10} value={inflationRate || ""} placeholder="2.5" onChange={e => setInflationRate(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </>
            )}
            {tab === "pension" && (
              <div style={styles.card}>
                {sectionHeader("yourprofile", "Your profile")}
                {openSections.yourprofile && (<>
                <div style={styles.tableRow}><span style={styles.tableKey}>Type</span><span style={styles.tableVal}>{memberType === "classic" ? "Classic 3%@50" : "PEPRA 2.7%@57"}</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Classification</span><span style={styles.tableVal}>{classification}</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Step {salaryStep} Base</span><span style={styles.tableValGold}>{fmt(baseSalary)}/mo</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Retire Age</span><span style={styles.tableVal}>{retirementAge} ({retirementYear})</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Years of Service</span><span style={styles.tableVal}>{priorTotalYears > 0 ? `${yearsOfService.toFixed(1)} Roseville + ${priorTotalYears} prior = ${(yearsOfService + priorTotalYears).toFixed(1)} yrs` : `${yearsOfService.toFixed(1)} yrs`}</span></div>
                <div style={styles.tableRow}><span style={styles.tableKey}>Pension %</span><span style={styles.tableValAccent}>{combinedPctLabel}</span></div>
                <div style={styles.tableRowLast}><span style={styles.tableKey}>Total Incentives</span><span style={styles.tableValGold}>{pct(incentives.totalIncentivePct)}</span></div>
                </>)}
              </div>
            )}
          </div>
          {/* RIGHT PANEL */}
          <div>
            {tab === "pension" && (
              <div style={styles.card}>
                {sectionHeader("penest", "Pension estimate")}
                {openSections.penest !== false && (<>
                <p style={{ ...styles.cardTitle, borderBottom: "none", paddingBottom: 0, marginBottom: "10px", fontSize: "12px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => toggleSection("breakdown")}>
                  <span>How your pensionable pay builds</span>
                  <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections.breakdown ? "▾" : "▸ tap to open"}</span>
                </p>
                {openSections.breakdown && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>
                      Base at Retirement ({retirementYear}, Step {salaryStep})
                      {projectedBaseSalary !== baseSalary && (
                        <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "2px" }}>
                          Today: {fmt(baseSalary)}/mo · Projected: {fmt(projectedBaseSalary)}/mo
                          {(classification === "Fire Engineer" || classification === "Fire Captain") && retirementYear >= 2027 && (
                            <span> (rank sep + raises)</span>
                          )}
                        </div>
                      )}
                    </span>
                    <span style={styles.tableVal}>{fmt(projectedBaseSalary)}/mo</span>
                  </div>
                  {incentives.breakdown.map((item, i) => (
                    !item.note && <div key={i} style={styles.tableRow}>
                      <span style={styles.tableKey}>{item.label}</span>
                      <span style={item.pensionable === false ? styles.tableValDim : styles.tableValGold}>
                        +{fmt(projectedBaseSalary * item.pct)}/mo ({pct(item.pct)})
                      </span>
                    </div>
                  ))}
                  {memberType === "classic" && (
                    <>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>Holiday Pay (168 hrs, pensionable)</span>
                        <span style={styles.tableValGold}>+{fmt(holidayPayMonthly)}/mo</span>
                      </div>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>Uniform Allowance (pensionable)</span>
                        <span style={styles.tableValGold}>+{fmt(uniformMonthly)}/mo</span>
                      </div>
                      <div style={styles.tableRow}>
                        <span style={styles.tableKey}>FLSA OT (special comp, pensionable)</span>
                        <span style={styles.tableValGold}>+{fmt(flsaOTPensionableMonthly)}/mo</span>
                      </div>
                    </>
                  )}
                  <div style={styles.tableRow}>
                    <span style={{ ...styles.tableKey, fontWeight: "700", color: COLORS.text }}>Total Pensionable Comp</span>
                    <span style={{ ...styles.tableValGold, fontSize: "15px" }}>{fmt(totalPensionableMonthly)}/mo</span>
                  </div>
                  {sickLeaveCreditYears > 0 && (
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Sick Leave → Service Credit</span>
                      <span style={styles.tableValGreen}>+{sickLeaveCreditYears.toFixed(2)} yrs (+{fmt(sickLeavePensionBoostMonthly)}/mo)</span>
                    </div>
                  )}
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>
                      Pension % ({yearsOfServiceForPension.toFixed(2)} yrs × {memberType === "classic" ? "3%" : "2.7%"})
                      {sickLeaveCreditYears > 0 && <span style={{ fontSize: "10px", color: COLORS.textDim, marginLeft: "4px" }}>incl. sick leave credit</span>}
                    </span>
                    <span style={styles.tableValAccent}>{combinedPctLabel}</span>
                  </div>
                </div>
                )}
                <div style={{ textAlign: "center", padding: "24px", background: "rgba(210,31,51,0.08)", borderRadius: "10px", marginBottom: "20px" }}>
                  <div style={styles.metricLabel}>Monthly PERS Benefit{priorPensionMonthly > 0 ? " (incl. prior service)" : ""}</div>
                  <div style={styles.bigNumber}>{fmt(combinedPensionMonthly)}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "8px" }}>
                    {fmt(combinedPensionMonthly * 12)} / year · up to {pct(colaRate)} COLA
                  </div>
                  {priorPensionMonthly > 0 && (
                    <div style={{ color: COLORS.textDim, fontSize: "12px", marginTop: "4px" }}>
                      {fmt(monthlyPension)}/mo CalPERS + {fmt(priorPensionMonthly)}/mo reciprocal
                    </div>
                  )}
                  {peraCapApplies && (
                    <div style={{ color: COLORS.gold, fontSize: "11px", marginTop: "6px", lineHeight: "1.5" }}>
                      ⚠ PEPRA pensionable pay is capped by state law (~{fmt(peraCapMonthly * 12)}/yr in {retirementYear}); your pension is figured on the cap, not your full projected pay.
                    </div>
                  )}
                </div>
                {priorService.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: "10px" }}>Pension by department</div>
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>CalPERS — Roseville{priorServiceCalc.some(r => r.sameFormula) ? " + same-formula" : ""} · {pct(pensionPct)}{pensionPct >= 0.90 ? " (at 90% cap)" : ""}</span>
                      <span style={styles.tableValAccent}>{fmt(pension50Monthly)}/mo</span>
                    </div>
                    {priorServiceCalc.filter(r => r.sameFormula).map((r, i) => (
                      <div key={r.id || i} style={{ ...styles.tableRow, paddingLeft: "14px" }}>
                        <span style={{ ...styles.tableKey, color: COLORS.textDim, fontSize: "12px" }}>↳ {r.agencyName ? r.agencyName + " · " : ""}{(PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "Prior"} · {r.yrs} yrs × {pct(r.factor)}</span>
                        <span style={{ ...styles.tableKey, color: COLORS.textDim, fontSize: "12px" }}>in 90% bucket</span>
                      </div>
                    ))}
                    {priorServiceCalc.filter(r => r.otherCalpers).map((r, i) => (
                      <div key={r.id || i} style={styles.tableRow}>
                        <span style={styles.tableKey}>{r.agencyName ? r.agencyName + " · " : ""}{(PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "Prior"} · {r.yrs} yrs × {pct(r.factor)} <span style={{ color: COLORS.gold, fontSize: "11px" }}>· stacks on top</span></span>
                        <span style={styles.tableValGreen}>+{fmt(r.monthly)}/mo</span>
                      </div>
                    ))}
                    {priorServiceCalc.filter(r => !r.calpers).map((r, i) => (
                      <div key={r.id || i} style={styles.tableRow}>
                        <span style={styles.tableKey}>{r.agencyName ? r.agencyName + " · " : ""}{(PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "Prior"} · {r.yrs} yrs × {pct(r.factor)} <span style={{ color: COLORS.textDim, fontSize: "11px" }}>· separate check</span></span>
                        <span style={styles.tableValGreen}>{fmt(r.monthly)}/mo</span>
                      </div>
                    ))}
                    <div style={styles.tableRowLast}>
                      <span style={styles.tableKey}><strong>Combined pension</strong></span>
                      <span style={styles.tableValAccent}>{fmt(combinedPensionMonthly)}/mo</span>
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px", lineHeight: "1.6" }}>
                      Same-formula CalPERS service (e.g., another 3%@50 agency) consolidates with Roseville under one 90% cap. A different CalPERS formula (e.g., CalFire 3%@55) is figured separately and stacks on top of the 90%, so your CalPERS total can exceed 90%. A non-CalPERS reciprocal system (e.g., LACERA) pays its own separate check.
                    </div>
                  </div>
                )}
                {calpersComponents.length > 1 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: "10px" }}>What counts toward your 90%</div>
                    {calpersComponents.map((c, i) => (
                      <div key={i} style={styles.tableRow}>
                        <span style={styles.tableKey}>{c.label} · {c.yrs.toFixed(2).replace(/\.00$/, "")} yrs × {pct(c.factor)}</span>
                        <span style={styles.tableVal}>{pct(c.pct)}</span>
                      </div>
                    ))}
                    <div style={styles.tableRow}>
                      <span style={styles.tableKey}>Total earned</span>
                      <span style={styles.tableVal}>{pct(calpersRawPct)}</span>
                    </div>
                    <div style={styles.tableRowLast}>
                      <span style={styles.tableKey}><strong>Counts toward pension (90% max)</strong></span>
                      <span style={styles.tableValAccent}>{pct(pensionPct)}</span>
                    </div>
                    {calpersOverCap && (
                      <div style={{ fontSize: "11px", color: COLORS.gold, marginTop: "6px", lineHeight: "1.6" }}>
                        ⚠ You've earned {pct(calpersRawPct)} but CalPERS caps the benefit at 90%. About {(((calpersRawPct - 0.90) / rosevilleFactor)).toFixed(1)} years of this service sits above the cap and adds nothing to your pension.
                      </div>
                    )}
                  </div>
                )}
                {(() => {
                  const factor = memberType === "classic" ? 0.03 : Math.min(retireAgeQ >= 57 ? 0.027 : 0.020 + (retireAgeQ - 50) * (0.007 / 7), 0.027);
                  const fillPct = Math.min(100, (pensionPct / 0.90) * 100);
                  const yearsToCap = factor > 0 ? Math.max(0, (0.90 - pensionPct) / factor) : 0;
                  return (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: "10px" }}>Pension formula vs. the 90% cap</div>
                      <div style={{ position: "relative", height: "30px" }}>
                        <div style={{ position: "absolute", inset: 0, background: "#222228", borderRadius: "9px", overflow: "hidden" }}>
                          <div className="rff-pulse" style={{ width: mounted ? `${fillPct}%` : "0%", height: "100%", background: COLORS.accent, boxShadow: "0 0 14px 1px rgba(210,31,51,0.7)", borderRadius: "9px", transition: "width 1.3s cubic-bezier(.2,.8,.2,1)" }} />
                        </div>
                        <div style={{ position: "absolute", right: 0, top: "-6px", bottom: "-6px", width: "2px", background: "#ffffff" }} />
                        <div style={{ position: "absolute", right: 0, top: "-20px", fontSize: "10px", letterSpacing: "1px", color: "#ffffff" }}>90% CAP</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: COLORS.textDim, marginTop: "8px" }}>
                        <span>{pct(pensionPct)} of final pay</span>
                        <span>{pensionPct >= 0.90 ? "at the cap — extra service adds nothing" : `~${yearsToCap.toFixed(1)} more yrs to the cap`}</span>
                      </div>
                    </div>
                  );
                })()}
                <div style={styles.tableRow}>
                  <span style={styles.tableKey}>Retiree Medical (Tier {medicalTier}{medicalTier === "4" ? "" : `, ${retirementYear}`})</span>
                  <span style={styles.tableValGreen}>{medicalTier === "4" ? `${fmt(medical.rhsBalance)} (RHS acct)` : `${fmt(medical.monthly)}/mo`}</span>
                </div>
                {(medicalTier === "2" || medicalTier === "3") && (
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Vesting ({pct(medical.vested)})</span>
                    <span style={styles.tableVal}>{medical.vested >= 1 ? "Fully Vested" : medical.vested > 0 ? `${pct(medical.vested)} vested` : "Not yet eligible"}</span>
                  </div>
                )}
                {medicalTier === "4" && (
                  <div style={styles.tableRow}>
                    <span style={styles.tableKey}>Tier 4 note</span>
                    <span style={styles.tableVal}>{medical.note}</span>
                  </div>
                )}
                {tab === "pension" && (
                  <div style={{ marginTop: "20px" }}>
                    <p style={{ ...styles.cardTitle, borderBottom: "none", marginBottom: "12px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      onClick={() => toggleSection("cola")}>
                      <span>Pension growth · up to {pct(colaRate)} COLA</span>
                      <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections.cola ? "▾" : "▸ tap to open"}</span>
                    </p>
                    {openSections.cola && (<>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginBottom: "10px", lineHeight: "1.6" }}>
                      Best case — assumes the full {pct(colaRate)} cap every year. The CalPERS COLA tracks inflation and isn't guaranteed; some years are less.
                    </div>
                    {(() => {
                      const pts = colaYears.map(yr => monthlyPension * Math.pow(1 + colaRate, yr));
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
                          const grown = monthlyPension * Math.pow(1 + colaRate, yr);
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
                {sickLeavePayoff > 0 && (
                  <div style={{ ...styles.tableRow, marginTop: "8px" }}>
                    <span style={styles.tableKey}>Sick Leave Lump Sum at Retirement</span>
                    <span style={styles.tableValGreen}>{fmt(sickLeavePayoff)}</span>
                  </div>
                )}
                {/* CalPERS Survivor Benefit Options — Pension tab only */}
                {tab === "pension" && (
                  <div style={{ marginTop: "24px" }}>
                    <p style={{ ...styles.cardTitle, borderBottom: "none", marginBottom: "12px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      onClick={() => toggleSection("survivor")}>
                      <span>CalPERS survivor benefit options <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: "11px" }}>· illustration only</span></span>
                      <span style={{ fontSize: "12px", color: COLORS.textMuted, fontWeight: "600" }}>{openSections.survivor ? "▾" : "▸ tap to open"}</span>
                    </p>
                    {openSections.survivor && (<>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Beneficiary age <span style={{ color: COLORS.textMuted, fontSize: "10px" }}>· leave 0 to use your retirement age</span></label>
                      <input style={styles.input} type="number" value={beneficiaryAge || ""} onChange={e => setBeneficiaryAge(+e.target.value || 0)} min={18} max={100} placeholder={`${retirementAge}`} />
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginBottom: "10px" }}>
                      Based on beneficiary age {effectiveBeneficiaryAge}.
                    </div>
                    <table style={styles.colaTable}>
                      <thead>
                        <tr style={{ color: COLORS.textMuted, fontSize: "11px", textTransform: "uppercase" }}>
                          <th style={{ textAlign: "left", padding: "6px 0", fontWeight: "600" }}>Option</th>
                          <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>Your Monthly</th>
                          <th style={{ textAlign: "right", padding: "6px 0", fontWeight: "600" }}>Survivor Gets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {survivorOptions.map(opt => (
                          <tr key={opt.key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <td style={{ padding: "10px 0", verticalAlign: "top" }}>
                              <div style={{ color: COLORS.text, fontSize: "13px", fontWeight: "600" }}>{opt.label}</div>
                              <div style={{ color: COLORS.textDim, fontSize: "11px", marginTop: "2px", lineHeight: "1.4" }}>{opt.note}</div>
                              <div style={{ color: COLORS.textDim, fontSize: "10px", marginTop: "2px" }}>
                                {opt.factor === 1.0 ? "100% of unmodified" : `${(opt.factor * 100).toFixed(1)}% of unmodified`}
                              </div>
                            </td>
                            <td style={{ textAlign: "right", padding: "10px 0", verticalAlign: "top" }}>
                              <span style={opt.key === "opt1" ? styles.tableValAccent : styles.tableValGold}>
                                {fmt(opt.memberMonthly)}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", padding: "10px 0", verticalAlign: "top" }}>
                              <span style={opt.survivorPct === 0 ? styles.tableValDim : styles.tableValGreen}>
                                {opt.survivorPct === 0 ? "—" : `${fmt(opt.survivorMonthly)}/mo`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(210, 31, 51, 0.06)", borderRadius: "6px", fontSize: "11px", color: COLORS.textMuted, lineHeight: "1.6" }}>
                      ⚠ Percentages above are <strong>approximations</strong> based on CalPERS Option Factor methodology (age-adjusted). Real numbers depend on CalPERS' proprietary actuarial tables. <strong style={{ color: COLORS.gold }}>Request a Retirement Allowance Estimate from CalPERS for your exact figures.</strong> Choice locks at retirement.
                    </div>
                    </>)}
                  </div>
                )}
                {tab === "pension" && (
                  <div style={{ marginTop: "20px" }}>
                    <label style={styles.checkRow}>
                      <input style={styles.checkbox} type="checkbox" checked={modelPromotion} onChange={e => setModelPromotion(e.target.checked)} />
                      <span style={{ ...styles.checkLabel, fontWeight: "700" }}>Model a Promotion Scenario</span>
                    </label>
                    {modelPromotion && (
                      <div style={{ marginLeft: "28px" }}>
                        <div style={styles.row}>
                          <div style={styles.fieldGroup}>
                            <label style={styles.label}>Promote at Age</label>
                            <input style={styles.input} type="number" value={promotionAge || ""}
                              onChange={e => setPromotionAge(+e.target.value || 0)} min={currentAge} max={retirementAge - 1} />
                          </div>
                          <div style={styles.fieldGroup}>
                            <label style={styles.label}>To Classification</label>
                            <select style={styles.select} value={promotionClassification}
                              onChange={e => setPromotionClassification(e.target.value)}>
                              {Object.keys(SALARY_SCHEDULE).map(c => <option key={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={styles.fieldGroup}>
                          <label style={styles.label}>Step at Promotion</label>
                          <select style={styles.select} value={promotionStep}
                            onChange={e => setPromotionStep(e.target.value)}>
                            {Object.keys(SALARY_SCHEDULE[promotionClassification]?.steps || {}).map(s =>
                              <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        {promotionPension && (
                          <div style={styles.compareBox}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                              <div>
                                <div style={styles.metricLabel}>Without Promotion</div>
                                <div style={{ fontSize: "18px", fontWeight: "700", color: COLORS.textMuted }}>{fmt(monthlyPension)}/mo</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={styles.metricLabel}>With Promotion</div>
                                <div style={{ fontSize: "18px", fontWeight: "700", color: COLORS.green }}>{fmt(promotionPension.monthly)}/mo</div>
                              </div>
                            </div>
                            {(() => {
                              const up = promotionPension.diff >= 0;
                              const sign = up ? "+" : "";
                              const gainColor = up ? COLORS.green : "#ef4444";
                              return (
                                <>
                                  <div style={styles.tableRow}>
                                    <span style={styles.tableKey}>Monthly {up ? "Gain" : "Change"}</span>
                                    <span style={{ ...styles.tableValGreen, color: gainColor }}>{sign}{fmt(promotionPension.diff)}/mo</span>
                                  </div>
                                  <div style={styles.tableRow}>
                                    <span style={styles.tableKey}>Annual {up ? "Gain" : "Change"}</span>
                                    <span style={{ ...styles.tableValGreen, color: gainColor }}>{sign}{fmt(promotionPension.diffAnnual)}/yr</span>
                                  </div>
                                  <div style={styles.tableRow}>
                                    <span style={styles.tableKey}>20-Year Lifetime Value</span>
                                    <span style={{ ...styles.tableValGreen, color: gainColor }}>{sign}{fmt(promotionPension.diffAnnual * 20)}</span>
                                  </div>
                                  <div style={styles.tableRowLast}>
                                    <span style={styles.tableKey}>401k Equiv. of {up ? "Gain" : "Change"} (4%)</span>
                                    <span style={styles.tableValGold}>{sign}{fmt(promotionPension.diffAnnual / 0.04)}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </>)}
              </div>
            )}
            {tab === "medical" && (
              <div style={styles.card}>
                {sectionHeader("medplan", "Medical, dental & vision (while working)")}
                {openSections.medplan !== false && (<>
                <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "12px" }}>
                  Your tier: <strong style={{ color: COLORS.gold }}>Tier {medicalTier}</strong> (hired {hireYear}). Pick a plan and coverage to see your cost.
                </div>
                <div style={styles.row}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Medical Plan</label>
                    <select style={styles.select} value={selectedMedicalPlan} onChange={e => setSelectedMedicalPlan(e.target.value)}>
                      {MEDICAL_PLANS_2026.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
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
                <p style={{ ...styles.cardTitle, marginTop: "18px" }}>In retirement — your medical (Tier {medicalTier})</p>
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
                          {MEDICAL_PLANS_2026.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
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
                    <div style={styles.tableRowLast}><span style={styles.tableKey}><strong>Your net retiree premium</strong></span><span style={styles.tableValAccent}>{fmt(Math.max(0, retireePremium - medical.monthly))}/mo</span></div>
                  </>
                )}
                <p style={{ ...styles.cardTitle, marginTop: "18px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => toggleSection("allPlans")}>
                  <span>All 2026 plans</span>
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
                      {MEDICAL_PLANS_2026.map(p => (
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
                  ⚠ <strong>Approximation.</strong> Per the MOU (Ch.4 Art.I §C), the City pays up to 100% / 85% / 80% of the Kaiser premium (employee / +1 / family) plus $180 toward dental and vision. You pay only the amount above the City's share — if your plan costs less, the difference is <strong>not</strong> paid out to you. Declining all coverage (with proof of other insurance) pays $150/mo instead. Dental and vision use your medical coverage tier; 2026 rates (archived 2024–2026) change each January. The retiree-medical figure below is separate (set by your hire-date tier). Confirm exact figures with the City.
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
                    { v: medical.monthly, c: COLORS.green, label: "Medical subsidy" },
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
                {medicalTier === "4" && (
                  <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "-8px", marginBottom: "16px", lineHeight: "1.6" }}>
                    Tier 4 medical is a one-time RHS account ({fmt(medical.rhsBalance)}), not a monthly subsidy — so it isn't shown in the donut above.
                  </div>
                )}
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
                    <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>Take-home ~{fmt(totalMonthly - retTaxAnnual / 12)}/mo · <span style={{ color: COLORS.green }}>+{fmt(totalMonthly - currentMonthlySalary)} vs working</span></div>
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
                  <div style={styles.tableRowLast}><span style={styles.tableKey}><strong>After-tax retirement income</strong></span><span style={styles.tableValGreen}>{fmt(totalMonthly - retTaxAnnual / 12)}/mo</span></div>
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
            {tab === "timeline" && (
              <div style={styles.card}>
                <div style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: 800, color: COLORS.text, marginBottom: "4px" }}>Income timeline</div>
                <div style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "16px", lineHeight: "1.6" }}>
                  Page-one-style take-home (PERS deposit after taxes &amp; medical) plus your 457 draw once it starts. Pension grows by the realized COLA — the lesser of your {pct(colaRate)} cap and CPI ({pct(cpiRate)}), so <strong>{pct(effectiveColaRate)}/yr</strong> here. Medical out-of-pocket drops to $0 at 65 (Medicare).
                </div>
                {(() => {
                  // Build the age set: retirement → 90 in 5-yr steps, plus 65 and the 457 draw-start age
                  // if they land strictly after retirement. All integers, ascending, within [retirementAge, 90].
                  const ages = new Set();
                  for (let a = retirementAge; a <= 90; a += 5) ages.add(a);
                  if (65 > retirementAge && 65 <= 90) ages.add(65);
                  if (effectiveDrawStartAge > retirementAge && effectiveDrawStartAge <= 90) ages.add(Math.round(effectiveDrawStartAge));
                  const ageList = Array.from(ages).filter(a => a >= retirementAge && a <= 90).sort((x, y) => x - y);
                  const inflRate = Math.max(0, parseFloat(inflationRate) || 0) / 100;
                  let depletedMarked = false;
                  const rows = ageList.map(A => {
                    const yrsSinceRetire = A - retirementAge;
                    const pensionNominal = monthlyPension * Math.pow(1 + effectiveColaRate, yrsSinceRetire);
                    const medOOP = (A >= 65) ? 0 : retireeMedicalOOP; // Medicare at 65 → City covers supplement
                    const pensionTakeHomeM = pensionNominal * (1 - retEffRate) - medOOP;
                    const drawing = (A >= effectiveDrawStartAge) && (A < depletionAge);
                    const draw457M = drawing ? monthly457 * (1 - retEffRate) : 0;
                    const totalNominalM = Math.max(0, pensionTakeHomeM) + draw457M;
                    const yrsFromNow = A - currentAge;
                    const totalTodayM = totalNominalM / Math.pow(1 + inflRate, Math.max(0, yrsFromNow));
                    const notes = [];
                    if (effectiveDrawStartAge > retirementAge && A === Math.round(effectiveDrawStartAge)) notes.push("457 starts");
                    if (A === 65) notes.push("Medicare — $0 medical");
                    if (!depletedMarked && depletionAge <= 90 && A >= depletionAge) { notes.push("457 depleted"); depletedMarked = true; }
                    return { A, totalNominalM, totalTodayM, notes };
                  });
                  return (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "12px" : "13px" }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <th style={{ textAlign: "left", padding: "8px 6px", color: COLORS.textMuted, fontWeight: "600" }}>Age</th>
                            <th style={{ textAlign: "right", padding: "8px 6px", color: COLORS.textMuted, fontWeight: "600" }}>Take-home / mo<br /><span style={{ fontSize: "10px", color: COLORS.textDim }}>(nominal)</span></th>
                            <th style={{ textAlign: "right", padding: "8px 6px", color: COLORS.textMuted, fontWeight: "600" }}>Take-home / mo<br /><span style={{ fontSize: "10px", color: COLORS.textDim }}>(today's $)</span></th>
                            <th style={{ textAlign: "left", padding: "8px 6px", color: COLORS.textMuted, fontWeight: "600" }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(r => (
                            <tr key={r.A} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                              <td style={{ padding: "8px 6px", color: COLORS.text, fontWeight: "600" }}>{r.A}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: COLORS.text, fontWeight: "600" }}>{fmt(r.totalNominalM)}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: COLORS.textMuted }}>{fmt(r.totalTodayM)}</td>
                              <td style={{ padding: "8px 6px", color: COLORS.gold, fontSize: "11px" }}>{r.notes.join(" · ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "16px", lineHeight: "1.6" }}>
                  Estimates only — not a benefit statement or financial advice. COLA is the lesser of your contracted cap and your CPI assumption (banking of unused inflation is not modeled), the 457 draw is steady, and returns/inflation are your assumptions. Actual results will vary. Confirm official numbers with CalPERS and your 457 provider.
                </div>
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
                { v: medical.monthly, c: "#16a34a", label: "Medical" },
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
            <tr><td style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>CalPERS — Roseville{priorServiceCalc.some(r => r.sameFormula) ? " + same-formula" : ""} ({pct(pensionPct)}{pensionPct >= 0.90 ? ", at cap" : ""})</td><td style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 600 }}>{fmt(pension50Monthly)}/mo</td></tr>
            {priorServiceCalc.map((r, i) => (<tr key={i}><td style={{ padding: "3px 0 3px 14px", color: "#777", fontSize: "11px" }}>· {r.agencyName ? r.agencyName + " · " : ""}{(PRIOR_FORMULAS.find(f => f.key === r.formula) || {}).label || "Prior"} · {r.yrs} yrs × {pct(r.factor)}{r.otherCalpers ? " · stacks on top" : r.calpers ? "" : " · separate check"}</td><td style={{ padding: "3px 0", textAlign: "right", color: "#777", fontSize: "11px" }}>{r.sameFormula ? "in 90% bucket" : (r.otherCalpers ? "+" : "") + fmt(r.monthly) + "/mo"}</td></tr>))}
            <tr><td style={{ padding: "4px 0", fontWeight: 700 }}>Combined pension</td><td style={{ padding: "4px 0", textAlign: "right", fontWeight: 800, color: "#d21f33" }}>{fmt(combinedPensionMonthly)}/mo</td></tr>
          </tbody></table>
          <div style={{ fontSize: "10px", color: "#888", display: "flex", justifyContent: "space-between", marginTop: "6px" }}><span>{pct(pensionPct)} of final pay</span><span>90% cap</span></div>
          <div style={{ background: "#eee", borderRadius: "5px", height: "11px", overflow: "hidden" }}><div style={{ width: `${Math.min(100, (pensionPct / 0.90) * 100).toFixed(0)}%`, height: "100%", background: "#d21f33" }} /></div>
          <div style={{ fontSize: "10px", color: "#888", marginTop: "8px" }}>Pension growth — up to {pct(colaRate)} COLA (not guaranteed)</div>
          {(() => { const pts = colaYears.map(yr => monthlyPension * Math.pow(1 + colaRate, yr)); const mx = Math.max(...pts), mn = Math.min(...pts), W = 320, H = 40, P = 4; const co = pts.map((v, i) => `${(P + i * (W - 2 * P) / (pts.length - 1)).toFixed(1)},${(H - P - ((v - mn) / ((mx - mn) || 1)) * (H - 2 * P)).toFixed(1)}`).join(" "); return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="40"><polyline points={co} fill="none" stroke="#16a34a" strokeWidth="2" /></svg>; })()}
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
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, borderTop: "1px solid #eee" }}><span>After-tax retirement income</span><span style={{ color: "#16a34a" }}>{fmt(totalMonthly - retTaxAnnual / 12)}/mo</span></div>
        </div>
        <div style={{ fontSize: "10px", color: "#777", marginTop: "10px", lineHeight: "1.5", borderTop: "1px solid #e5e5e5", paddingTop: "8px" }}>
          Estimates only — not official CalPERS figures. Tax is a rough estimate (2026 federal / 2025 CA brackets), not tax advice. COLA shown is the contract cap and is not guaranteed every year. PEPRA pay is capped at the state pensionable-comp limit. Confirm all figures with CalPERS and the City of Roseville. Generated at 1592treasurer.github.io/RFF-retirement-calculator
        </div>
      </div>
      <div className="no-print" style={styles.footer}>
        <button onClick={() => setTab("updates")} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: tab === "updates" ? COLORS.accent : COLORS.textMuted, cursor: "pointer", fontSize: "12px", borderRadius: "8px", padding: "6px 16px", marginBottom: "14px" }}>What's new ›</button>
        <br />
        <strong>RFF Local 1592 Member Retirement Calculator</strong><br />
        Based on 2026–2029 RFF MOU · Salary Schedule effective 3/21/2026 · CalPERS regulations<br />
        ⚠ This tool provides estimates only. Consult CalPERS and a financial advisor for official projections.<br />
        Engineer cert pay, Captain Paramedic, and Captain Engine Boss all cease 1/9/2027 per MOU. PEPRA Service Term Bonus is NOT pensionable per Art XI. Sick leave service credit conversion: 100% per MOU Ch5 Art I + CalPERS Gov Code §20862.8 (no cap, no double-dipping). PEPRA age factor is linearly interpolated between 2.0%@50 and 2.7%@57 — actual CalPERS factors use proprietary actuarial tables (deviation typically &lt;0.2%). Survivor benefit option factors are approximations — request a Retirement Allowance Estimate from CalPERS for exact figures. Years of service are computed from your hire date to your retirement date (auto-set from your retirement age, editable to the exact day); the PEPRA age factor still uses the retirement age you enter. Medical-tab premium and flex-credit figures are 2026 active-employee rates and change annually. PEPRA pensions are figured on the state pensionable-compensation cap (non-Social-Security safety: $191,679 in 2026, escalated ~2.5%/yr) when projected pay exceeds it. The City 3% 457 match is counted only for years of service past the 5-year vesting point.
      </div>
    </div>
  );
}
