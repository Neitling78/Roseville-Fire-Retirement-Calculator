// ─── PAYSTUB READER ───────────────────────────────────────────────────────────
// Reads City of Roseville "Statement of Earnings, Deductions and City Contributions"
// PDFs (Oracle Fusion payslips) entirely inside the browser. No file, figure or name
// ever leaves the member's device: pdf.js is bundled with the site and runs locally.
//
// What the City reports to CalPERS is printed on every stub, as the member's own
// contribution on two pre-tax deduction lines:
//   "PERS Normal Wages <plan>"  = member rate × base pay reported that period
//   "PERS Special Comp <plan>"  = member rate × special compensation reported that period
// (plus "... Retro" lines when a retro check carries reportable pay).
// Dividing those deductions by the member rate gives the pensionable pay the City
// actually reported — no guessing which earnings lines count.
//
// The line lists below were checked against 52 consecutive real Classic stubs
// (12/2024–11/2026): base lines + special lines reproduce both PERS deductions to the
// penny on every stub at the 9% Classic member rate. They are used for the line-by-line
// breakdown and as a cross-check; the pension figure itself comes from the deductions.

// Earnings lines reported as NORMAL (base) pay — straight-time hours at the base rate.
export const BASE_LINES = [
  "Regular 24 Hour Fire",
  "Comp Time Used",
  "Sick Leave Used",
  "Time Bank Used",
  "Vacation Used",
  "Holiday Used",
];
// Earnings lines reported as SPECIAL compensation (pensionable).
export const SPECIAL_LINES = [
  "Education Pay BA or BS",
  "Engine Boss 5 Perc",
  "Fire Captain 5 Per Cert",
  "Haz Mat Response Team Cert",
  "Rescue Task Force Cert",
  "Longevity",
  "Holiday Buy Up",
  "Uniform Allowance Payment",
  "Uniform Allowance",
  "Uniform Allowance Retro",
  "Overtime FLSA Over 64 Hours",
];
// The one FLSA line the City reports to CalPERS. "FLSA Overtime" (the other FLSA line)
// is NOT reported.
export const FLSA_REPORTED_LINE = "Overtime FLSA Over 64 Hours";
// Holiday Buy Up counts for CalPERS at 168 hours a year at most (MOU Ch.3 Art.II.C:
// (base hourly + longevity hourly) × holiday hours). Each regular check carries 168 ÷ 26
// hours; hours carried over from a prior year and cashed out later can't add to it.
export const HOLIDAY_LINE = "Holiday Buy Up";
export const HOLIDAY_HOURS_PER_YEAR = 168;
// Earnings lines seen on stubs that the City does NOT report to CalPERS.
export const NOT_REPORTED_LINES = [
  "Overtime 1.5",
  "Overtime 1.5 Retro",
  "FLSA Overtime",
  "FLSA Overtime Retro",
  "Longevity NP",
  "Longevity NP Retro",
  "Holiday Payoff",
  "Cafeteria Plan + Flex Credit",
  "Life Insurance over 50K",
  "Medicare Employer Wages",
  "Miscellaneous Pay",
];

// Pays that stop on 1/9/2027 under the MOU (rank separation, Ch.2 Art.I.A; Art.X).
// Same rules the calculator already uses: Captain Paramedic and Engine Boss (Captains),
// Engineer cert / FA Driver-Op (Engineers). A Firefighter's or Engineer's paramedic
// incentive does NOT stop. When the projection runs past the date these lines come out
// of the special-pay ratio.
export const CEASE_DATE_2027 = "2027-01-09";
export function ceasingPatterns(classification) {
  if (classification === "Fire Captain") return [/engine boss/i, /paramedic/i];
  if (classification === "Fire Engineer") return [/engineer.*cert|driver.?op/i];
  return [];
}

export const MIN_MONTHS = 12;   // at least the most recent 12 months of stubs
export const MAX_MONTHS = 36;   // never more than the most recent 36 months (PEPRA average)

const SECTIONS = [
  "Leave Balances",
  "Gross Earnings and Imputed Earnings",
  "Pretax Deductions",
  "Employee Tax Deductions",
  "Involuntary and Voluntary Deductions",
  "Miscellaneous Information",
  "City Contributions",
];
const EARNINGS = "Gross Earnings and Imputed Earnings";
const PRETAX = "Pretax Deductions";

const DAY = 86400000;
const money = (s) => {
  const m = String(s).replace(/[$,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(m) ? parseFloat(m) : null;
};
// "11/20/2026" -> "2026-11-20"
const isoDate = (s) => {
  const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};
// All date math in UTC: local time would make "add one day" return the same date on the
// night the clocks fall back, and a loop over days would never finish.
const toDate = (iso) => new Date(iso + "T00:00:00Z");
const addDays = (iso, n) => new Date(toDate(iso).getTime() + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
const r2 = (n) => Math.round(n * 100) / 100;

// ── 1. PDF → positioned text ────────────────────────────────────────────────
// Returns one array per page of { x, y, s }. pdf.js is loaded only when a member
// actually drops files, so the calculator itself stays as fast as it is today.
let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export async function readPdfText(arrayBuffer) {
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(arrayBuffer), isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), s: i.str.trim() })));
  }
  await doc.destroy();
  return pages;
}

// ── 2. Positioned text → one stub ───────────────────────────────────────────
// Layout (Oracle payslip, both pages): section headings and line labels sit on the
// left (x < 200); the "Current" amount is the first number at x ≥ 380 on the same row
// (±2pt), "Year to Date" the second. Header fields put the value one row under the label.
export function parseStub(pages) {
  const items = [];
  pages.forEach((page, p) => page.forEach((i) => items.push({ p, ...i })));
  items.sort((a, b) => a.p - b.p || b.y - a.y || a.x - b.x);

  const headerValue = (label) => {
    const L = items.find((i) => i.s === label);
    if (!L) return null;
    return items
      .filter((i) => i.p === L.p && i.y < L.y && i.y >= L.y - 14 && Math.abs(i.x - L.x) < 25)
      .map((i) => i.s).join(" ");
  };

  const sections = {};
  let sec = null;
  for (const L of items.filter((i) => i.x < 200)) {
    if (SECTIONS.includes(L.s)) { sec = L.s; continue; }
    if (!sec) continue;
    const nums = items
      .filter((i) => i.p === L.p && i.x >= 380 && Math.abs(i.y - L.y) <= 2 && money(i.s) !== null)
      .sort((a, b) => a.x - b.x);
    if (!nums.length) continue;
    (sections[sec] = sections[sec] || {})[L.s] = { cur: money(nums[0].s), ytd: nums[1] ? money(nums[1].s) : null };
  }

  const earnings = sections[EARNINGS] || {};
  const pretax = sections[PRETAX] || {};
  const persKey = (re) => Object.keys(pretax).find((k) => re.test(k));
  const normalKey = persKey(/^PERS Normal Wages(?! .*Retro)/i);
  const specialKey = persKey(/^PERS Special Comp(?!.*Retro)/i);
  const retroKeys = Object.keys(pretax).filter((k) => /^PERS (Normal Wages|Special Comp).*Retro/i.test(k));
  const plan = normalKey ? normalKey.replace(/^PERS Normal Wages\s*/i, "").trim() : null;

  const checkDate = isoDate(headerValue("Check Date"));
  const periodStart = isoDate(headerValue("Period Start Date"));
  const periodEnd = isoDate(headerValue("Period End Date"));
  const rate = money(String(headerValue("Hourly Rate") || "").replace("$", ""));

  return {
    ok: !!(checkDate && periodStart && periodEnd && Object.keys(earnings).length),
    checkDate, periodStart, periodEnd,
    hourlyRate: rate,
    plan,                                   // "Classic" / "PEPRA" as printed
    earnings,                               // { label: { cur, ytd } }
    persNormal: normalKey ? pretax[normalKey].cur : 0,
    persSpecial: specialKey ? pretax[specialKey].cur : 0,
    persRetro: retroKeys.reduce((a, k) => a + (pretax[k].cur || 0), 0),
    hasPersLines: !!normalKey,
  };
}

// ── 3. A set of stubs → checked, summarized pay history ─────────────────────
// opts.today: ISO date (defaults to now). Returns { ok, errors[], warnings[], ... }.
export function analyzeStubs(rawStubs, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const errors = [], warnings = [], notes = [];
  const unread = rawStubs.filter((s) => !s.ok).map((s) => s.fileName || "a file");
  if (unread.length) warnings.push(`${unread.length} file${unread.length > 1 ? "s" : ""} could not be read as a Roseville paystub and ${unread.length > 1 ? "were" : "was"} skipped: ${unread.join(", ")}.`);

  // De-duplicate (the same stub dropped twice).
  const seen = new Set();
  let stubs = rawStubs.filter((s) => s.ok).filter((s) => {
    const gross = Object.values(s.earnings).reduce((a, e) => a + (e.cur || 0), 0);
    const key = `${s.checkDate}|${s.periodStart}|${s.periodEnd}|${gross.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => a.checkDate.localeCompare(b.checkDate) || a.periodEnd.localeCompare(b.periodEnd));

  if (!stubs.length) return { ok: false, errors: ["No Roseville paystubs were found in the files you added."], warnings, notes };

  const newest = stubs[stubs.length - 1];
  // Keep only the most recent 36 months, by pay date.
  const cutoff = addDays(newest.checkDate, -Math.round(MAX_MONTHS * 365.25 / 12));
  const tooOld = stubs.filter((s) => s.checkDate <= cutoff);
  stubs = stubs.filter((s) => s.checkDate > cutoff);
  if (tooOld.length) notes.push(`${tooOld.length} stub${tooOld.length > 1 ? "s" : ""} older than 36 months (before ${cutoff}) ${tooOld.length > 1 ? "were" : "was"} left out. Only the most recent 36 months count.`);

  const staleDays = daysBetween(newest.checkDate, today);
  if (staleDays > 45) warnings.push(`Your newest stub is dated ${newest.checkDate}, ${staleDays} days ago. Add your most recent stubs so the figures reflect your current pay.`);

  // Gap check on the regular pay periods: each period should start the day after the
  // previous one ends. Off-cycle checks share a period and are kept, not counted twice.
  const periods = [];
  for (const s of stubs) {
    const last = periods[periods.length - 1];
    if (last && last.start === s.periodStart && last.end === s.periodEnd) continue;
    periods.push({ start: s.periodStart, end: s.periodEnd, checkDate: s.checkDate });
  }
  periods.sort((a, b) => a.start.localeCompare(b.start));
  // Walk back from the newest period while periods are consecutive.
  let runStartIdx = periods.length - 1;
  const gaps = [];
  for (let i = periods.length - 1; i > 0; i--) {
    const prev = periods[i - 1], cur = periods[i];
    if (prev.end >= cur.start) { runStartIdx = i - 1; continue; }      // overlap/adjacent duplicate
    if (addDays(prev.end, 1) === cur.start) { runStartIdx = i - 1; continue; }
    gaps.push({ after: prev.checkDate, missingFrom: addDays(prev.end, 1), missingTo: addDays(cur.start, -1) });
    break;
  }
  const runStart = periods[runStartIdx].start;
  const runEnd = newest.periodEnd;
  const runDays = daysBetween(runStart, runEnd) + 1;
  const runMonths = runDays / (365.25 / 12);

  if (gaps.length) {
    const g = gaps[0];
    const dropped = stubs.filter((s) => s.periodEnd < runStart).length;
    const msg = `A pay period is missing: ${g.missingFrom} to ${g.missingTo} (the stub after your ${g.after} paycheck).`;
    if (runMonths < MIN_MONTHS) errors.push(`${msg} The stubs must be in a row. Add the missing stub.`);
    else notes.push(`${msg} Only the ${runMonths.toFixed(1)} months in a row after it are used${dropped ? ` (${dropped} older stub${dropped > 1 ? "s" : ""} left out)` : ""}. Add the missing stub to use them.`);
  }
  if (runMonths < MIN_MONTHS - 0.25 && !errors.length) {
    const need = Math.ceil((MIN_MONTHS - runMonths) * 26 / 12);
    errors.push(`You need at least ${MIN_MONTHS} months of paystubs in a row. These cover ${runMonths.toFixed(1)} months, so add about ${need} more (older) stub${need > 1 ? "s" : ""}.`);
  }
  const used = stubs.filter((s) => s.periodEnd >= runStart);

  // Member rate: PERS normal deduction ÷ base lines, per stub. It should be the same on
  // every stub (9% Classic). If it is not, the stubs do not reconcile and we say so.
  const baseSum = (s) => BASE_LINES.reduce((a, k) => a + (s.earnings[k]?.cur || 0), 0);
  const rates = used.filter((s) => s.hasPersLines && baseSum(s) > 100).map((s) => s.persNormal / baseSum(s));
  if (!rates.length) {
    errors.push("These stubs do not show a PERS contribution line, so the pensionable pay reported to CalPERS can't be read from them.");
  }
  const counts = {};
  rates.forEach((r) => { const k = r.toFixed(4); counts[k] = (counts[k] || 0) + 1; });
  const memberRate = rates.length ? parseFloat(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) : null;
  const offRate = rates.filter((r) => Math.abs(r - memberRate) > 0.0006).length;
  if (offRate) warnings.push(`On ${offRate} stub${offRate > 1 ? "s" : ""} the PERS contribution doesn't match ${(memberRate * 100).toFixed(2)}% of base pay. Those periods may include a correction; the totals still use what CalPERS was charged.`);

  const plans = [...new Set(used.map((s) => s.plan).filter(Boolean))];

  // Per stub: what was reported to CalPERS, from the deductions.
  const cents = (n) => Math.round(n * 100) / 100;
  const rows = used.map((s) => {
    const specialLines = SPECIAL_LINES.reduce((a, k) => a + (s.earnings[k]?.cur || 0), 0);
    const specialNow = SPECIAL_LINES.filter((k) => !/Retro$/.test(k)).reduce((a, k) => a + (s.earnings[k]?.cur || 0), 0);
    const specialRetro = specialLines - specialNow;
    const baseLines = baseSum(s);
    // To the penny: the member rate × the pay lines must equal the PERS deduction the City
    // took. The City rounds the total on most stubs and line by line on some (seen on a
    // stub carrying a large Holiday Buy Up), so either rounding is accepted — the pay
    // lines themselves are exact.
    const linesOf = (keys) => keys.map((k) => s.earnings[k]?.cur || 0).filter((v) => v);
    const tie = (amounts, ded) => {
      if (!memberRate) return null;
      const whole = cents(cents(amounts.reduce((a, b) => a + b, 0) * memberRate) - ded);
      const byLine = cents(cents(amounts.reduce((a, v) => a + cents(v * memberRate), 0)) - ded);
      return Math.abs(whole) < 0.005 ? 0 : Math.abs(byLine) < 0.005 ? 0 : whole;
    };
    const baseTie = tie(linesOf(BASE_LINES), s.persNormal);
    const specialTie = tie(linesOf(SPECIAL_LINES.filter((k) => !/Retro$/.test(k))), s.persSpecial)
      + tie(linesOf(SPECIAL_LINES.filter((k) => /Retro$/.test(k))), s.persRetro);
    const tied = memberRate ? baseTie === 0 && specialTie === 0 : false;
    // Tied: use the pay lines, exact to the cent. Not tied: use what CalPERS was charged.
    const base = tied ? baseLines : memberRate ? s.persNormal / memberRate : 0;
    const special = tied ? specialLines : memberRate ? (s.persSpecial + s.persRetro) / memberRate : 0;
    const unknown = Object.entries(s.earnings)
      .filter(([k, v]) => v.cur && !BASE_LINES.includes(k) && !SPECIAL_LINES.includes(k) && !NOT_REPORTED_LINES.includes(k))
      .map(([k, v]) => ({ label: k, amount: v.cur }));
    return {
      checkDate: s.checkDate, periodStart: s.periodStart, periodEnd: s.periodEnd,
      hourlyRate: s.hourlyRate,
      base: r2(base), special: r2(special),
      ceasing: Object.entries(s.earnings)
        .filter(([k]) => (opts.ceasing || []).some((re) => re.test(k)) && !NOT_REPORTED_LINES.includes(k))
        .reduce((a, [, v]) => a + (v.cur || 0), 0),
      reconciles: tied,
      baseTie, specialTie,
      baseLines: cents(baseLines), specialLines: cents(specialLines),
      persNormal: s.persNormal, persSpecial: cents(s.persSpecial + s.persRetro),
      flsa: cents(s.earnings[FLSA_REPORTED_LINE]?.cur || 0),
      holiday: tied ? cents(s.earnings[HOLIDAY_LINE]?.cur || 0) : 0,
      unknown,
    };
  });
  const notReconciled = rows.filter((r) => !r.reconciles);
  if (notReconciled.length) warnings.push(`${notReconciled.length} stub${notReconciled.length > 1 ? "s don't" : " doesn't"} tie out to the penny (${notReconciled.map((r) => r.checkDate).join(", ")}): the pay lines × your PERS rate don't equal the PERS deduction taken. The figures use the deduction — what CalPERS was actually charged.`);
  const unknownLabels = [...new Set(rows.flatMap((r) => r.unknown.map((u) => u.label)))];
  if (unknownLabels.length) notes.push(`Pay lines this tool hasn't seen before: ${unknownLabels.join(", ")}. They are counted only if the City reported them to CalPERS (read from your PERS deduction).`);

  // The most recent 12 months = the 26 biweekly periods ending with the newest stub
  // (plus any off-cycle checks inside them). A period counts if it starts within the year.
  const last12Start = addDays(runEnd, -364);
  const inYear = (s) => s.periodStart >= addDays(last12Start, -3);
  const in12 = used.filter(inYear);
  const lineTotals = {};
  in12.forEach((s) => Object.entries(s.earnings).forEach(([k, v]) => {
    if (!v.cur) return;
    lineTotals[k] = (lineTotals[k] || 0) + v.cur;
  }));
  const breakdown = Object.entries(lineTotals).map(([label, amount]) => ({
    label, amount: r2(amount),
    kind: BASE_LINES.includes(label) ? "base" : SPECIAL_LINES.includes(label) ? "special"
      : NOT_REPORTED_LINES.includes(label) ? "not" : "unknown",
  })).sort((a, b) => ({ base: 0, special: 1, unknown: 2, not: 3 }[a.kind] - { base: 0, special: 1, unknown: 2, not: 3 }[b.kind]) || b.amount - a.amount);

  const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
  const rows12 = rows.filter(inYear);
  const base12 = sum(rows12, "base"), special12 = sum(rows12, "special"), ceasing12 = sum(rows12, "ceasing");
  const holiday12 = sum(rows12, "holiday");
  // Each reported special-pay line over the 12 months (tied stubs only), for the
  // line-by-line comparison with the calculator's own estimate.
  const items12 = {};
  in12.forEach((s) => SPECIAL_LINES.forEach((k) => {
    if (s.earnings[k]?.cur) items12[k] = r2((items12[k] || 0) + s.earnings[k].cur);
  }));
  const days12 = daysBetween(rows12.length ? rows12[0].periodStart : last12Start, runEnd) + 1;
  // FLSA reported to CalPERS, from the stubs: the Over-64 line ÷ base reported.
  const flsa12 = rows12.reduce((a, r) => a + r.flsa, 0);
  const flsa = base12 > 0 ? {
    line: FLSA_REPORTED_LINE,
    amount: r2(flsa12), base: r2(base12),
    pct: flsa12 / base12,
    stubsWithIt: rows12.filter((r) => r.flsa).length, stubs: rows12.length,
  } : null;

  // Daily segments of actual reported pay, for the final-compensation window.
  const segments = rows.map((r) => {
    const d = Math.max(1, daysBetween(r.periodStart, r.periodEnd) + 1);
    return { start: r.periodStart, end: r.periodEnd, perDay: (r.base + r.special) / d,
      holidayPerDay: r.holiday / d, rate: r.hourlyRate || 0 };
  });

  const latest = used[used.length - 1];
  return {
    ok: errors.length === 0,
    errors, warnings, notes,
    stubCount: used.length,
    firstPayDate: used[0]?.checkDate, lastPayDate: latest?.checkDate,
    coverageStart: runStart, coverageEnd: runEnd,
    coverageMonths: Math.round(runMonths * 10) / 10,
    plan: plans.join(" / ") || null,
    memberRate,
    hourlyRate: latest?.hourlyRate || null,
    // Base monthly pay at today's rate: 56-hour schedule = 2,912 hours a year.
    baseMonthlyNow: latest?.hourlyRate ? r2(latest.hourlyRate * 2912 / 12) : null,
    last12: {
      start: rows12[0]?.periodStart || last12Start, end: runEnd, days: days12,
      base: r2(base12), special: r2(special12), total: r2(base12 + special12),
      ceasing: r2(ceasing12),
      holiday: r2(holiday12),
      items: items12,
      // Special pay as a share of base — the rate it is carried forward at. Holiday Buy Up
      // is left out of these and projected on its own at 168 hours a year.
      specialRatio: base12 > 0 ? (special12 - holiday12) / base12 : 0,
      specialRatioAfterCease: base12 > 0 ? (special12 - holiday12 - ceasing12) / base12 : 0,
      monthly: r2((base12 + special12) / days12 * 365.25 / 12),
    },
    reconciledStubs: rows.length - notReconciled.length,
    flsa,
    // Stub-by-stub tie-out, for the member to check against their own stubs.
    tieOut: rows.map((r) => ({ checkDate: r.checkDate, baseLines: r.baseLines, persNormal: r.persNormal,
      specialLines: r.specialLines, persSpecial: r.persSpecial, flsa: r.flsa, ok: r.reconciles })),
    breakdown,
    segments,
    detected: Object.keys(latest?.earnings || {}).filter((k) => SPECIAL_LINES.includes(k) && latest.earnings[k].cur),
  };
}

// ── 4. Final compensation from stubs + projection ───────────────────────────
// Window: the 12 months (Classic) or 36 months (PEPRA) ending on the retirement date.
// Days already covered by stubs use the pay actually reported to CalPERS. Days after
// the newest stub are projected: today's stub base pay grown by the calculator's own
// raise/step/rank factor for that year, plus special pay at the stub ratio (less the
// pays that stop on 1/9/2027 once that date has passed).
// Holiday Buy Up, both actual and projected, counts at no more than 168 hours a year at
// (hourly rate + longevity). Hours carried over and cashed out later are not counted.
//   growthForYear(y): calculator's projected base for year y ÷ its base today.
//   longevityPct: the member's longevity rate (Classic, hired before 2017), else 0.
export function paystubFinalComp(summary, { retirementDate, months, growthForYear, longevityPct = 0 }) {
  if (!summary?.ok || !summary.baseMonthlyNow) return null;
  const end = retirementDate;                      // ISO, exclusive end
  const start = addDays(end, -Math.round(months * 365.25 / 12));
  const hourlyNow = summary.baseMonthlyNow / (2912 / 12);
  const holidayReported = (summary.last12?.holiday || 0) > 0;
  const holidayPerDayAt = (hourly) => holidayReported ? HOLIDAY_HOURS_PER_YEAR * hourly * (1 + longevityPct) / 365.25 : 0;
  const daily = new Map();
  for (const seg of summary.segments) {
    for (let d = seg.start; d <= seg.end; d = addDays(d, 1)) {
      const cur = daily.get(d) || { pay: 0, hol: 0, rate: 0 };
      cur.pay += seg.perDay - (seg.holidayPerDay || 0);
      cur.hol += seg.holidayPerDay || 0;
      cur.rate = Math.max(cur.rate, seg.rate || 0);
      daily.set(d, cur);
    }
  }
  const lastActual = summary.coverageEnd;
  const firstActual = summary.coverageStart;
  let actualDays = 0, actualPay = 0, holActual = 0, holCap = 0, projDays = 0, projSum = 0, projHoliday = 0;
  for (let d = start; d < end; d = addDays(d, 1)) {
    if (d >= firstActual && d <= lastActual && daily.has(d)) {
      const x = daily.get(d);
      actualDays++; actualPay += x.pay; holActual += x.hol;
      // Cap on the pay calendar: 168 hours across 26 checks = 364 days.
      holCap += holidayPerDayAt(x.rate || hourlyNow) * 365.25 / 364;
    } else if (d > lastActual) {
      const y = parseInt(d.slice(0, 4), 10);
      const growth = growthForYear(y);
      const ratio = d >= CEASE_DATE_2027 ? summary.last12.specialRatioAfterCease : summary.last12.specialRatio;
      const hol = holidayPerDayAt(hourlyNow * growth);
      projDays++;
      projSum += summary.baseMonthlyNow * growth * (1 + ratio) * 12 / 365.25 + hol;
      projHoliday += hol;
    } else {
      // Before the stubs begin (a window reaching further back than the stubs supplied):
      // the stubs' own 12-month average, with holiday held to 168 hours a year.
      const L = summary.last12;
      const hol = Math.min(L.holiday / L.days, holidayPerDayAt(hourlyNow));
      projDays++;
      projSum += (L.total - L.holiday) / L.days + hol;
      projHoliday += hol;
    }
  }
  const holCounted = Math.min(holActual, holCap);
  const totalDays = actualDays + projDays;
  if (!totalDays) return null;
  const perMonth = (v) => v / totalDays * 365.25 / 12;
  return {
    monthly: perMonth(actualPay + holCounted + projSum),
    windowStart: start, windowEnd: addDays(end, -1),
    actualDays, projectedDays: projDays,
    actualShare: actualDays / totalDays,
    holidayMonthly: perMonth(holCounted + projHoliday),
    holidayExcluded: perMonth(holActual - holCounted),
  };
}

// ── 5. One year's pensionable pay from the stubs, by category ──────────────
// The same projection the final-comp window uses, laid out line by line at one year's
// rates, so it can be set beside the calculator's estimate and any gap traced to its item.
//   baseMonthly: stub base projected to that year. afterCease: date is on/after 1/9/2027.
export function stubPayForYear(summary, { baseMonthly, longevityPct = 0, afterCease = false, ceasing = [] }) {
  if (!summary?.ok || !summary.last12) return null;
  const L = summary.last12;
  const share = (amt) => (L.base > 0 ? baseMonthly * amt / L.base : 0);
  const cat = { base: baseMonthly, longevity: 0, incentives: 0, holiday: 0, uniform: 0, flsa: 0 };
  const incentiveItems = [];
  for (const [label, amt] of Object.entries(L.items || {})) {
    if (label === HOLIDAY_LINE) continue;
    if (afterCease && ceasing.some((re) => re.test(label))) continue;
    const m = share(amt);
    if (label === FLSA_REPORTED_LINE) cat.flsa += m;
    else if (/^Uniform Allowance/.test(label)) cat.uniform += m;
    else if (/^Longevity$/.test(label)) cat.longevity += m;
    else { cat.incentives += m; incentiveItems.push({ label, monthly: m }); }
  }
  if (L.holiday > 0) cat.holiday = HOLIDAY_HOURS_PER_YEAR * (baseMonthly / (2912 / 12)) * (1 + longevityPct) / 12;
  const total = Object.values(cat).reduce((a, b) => a + b, 0);
  return { ...cat, total, incentiveItems };
}
