import * as M from "./prelude.mjs";
let pass=0, fail=0;
const eq=(label,got,want,tol=0.005)=>{
  let ok;
  if (typeof want==="number" && Number.isFinite(want)) ok = Math.abs(got-want)<=tol;
  else ok = Object.is(got,want);
  console.log((ok?"  PASS  ":"! FAIL  ")+label+"   got="+got+"  want="+want);
  ok?pass++:fail++;
};

console.log("\n-- Salary schedules --");
eq("hired 2005 -> Schedule A (8 steps)", Object.keys(M.scheduleForHire(new Date(2005,5,1))["Fire Captain"].steps).length, 8);
eq("hired 2020 -> Schedule B (9 steps)", Object.keys(M.scheduleForHire(new Date(2020,5,1))["Fire Captain"].steps).length, 9);
eq("1/6/2017 -> Schedule A", Object.keys(M.scheduleForHire(new Date(2017,0,6))["Fire Captain"].steps).length, 8);
eq("1/7/2017 -> Schedule B", Object.keys(M.scheduleForHire(new Date(2017,0,7))["Fire Captain"].steps).length, 9);
eq("A top step = B top step (Captain)", M.SALARY_SCHEDULE_A["Fire Captain"].steps.H, M.SALARY_SCHEDULE_B["Fire Captain"].steps.I);
eq("Firefighter EMT I now exists", M.SALARY_SCHEDULE_A["Firefighter EMT I"].steps.A, 6770.76);
eq("all 9 classes on A", Object.keys(M.SALARY_SCHEDULE_A).length, 9);
eq("all 9 classes on B", Object.keys(M.SALARY_SCHEDULE_B).length, 9);

console.log("\n-- Benefit maximum by formula --");
eq("3@50 capped at 90%", M.formulaMaxPct("3@50"), 0.90);
eq("3@55 capped at 90%", M.formulaMaxPct("3@55"), 0.90);
eq("2.7@57 has NO cap", M.formulaMaxPct("2.7@57"), Infinity);
eq("PEPRA 40yrs x 2.7% not clipped", Math.min(40*0.027, M.formulaMaxPct("2.7@57")), 1.08);
eq("Classic 35yrs x 3% clipped to 90%", Math.min(35*0.03, M.formulaMaxPct("3@50")), 0.90);

console.log("\n-- PEMHCA minimum by year --");
eq("2026", M.pemhcaMinFor(2026), 162);
eq("2027", M.pemhcaMinFor(2027), 167);
eq("2028 escalated 2.9%", M.pemhcaMinFor(2028), 172);
eq("2025 floors to 2026", M.pemhcaMinFor(2025), 162);

console.log("\n-- 457 limits --");
eq("age 45, no catch-up", M.max457For(45,57,false), 24500);
eq("age 52, 50+ catch-up", M.max457For(52,57,false), 32500);
eq("age 61, super catch-up", M.max457For(61,57,false), 35750);
eq("age 55 PEPRA, 3yr window, elected", M.max457For(55,57,true), 49000);
eq("age 55 PEPRA, 3yr window, NOT elected", M.max457For(55,57,false), 32500);
eq("age 48 classic IS inside the 47-49 window", M.max457For(48,50,true), 49000);
eq("age 62, 3yr elected but super is close", M.max457For(62,65,true), 49000);

console.log("\n-- Sick leave payoff cap --");
const rate = 54.47; // Captain top step + 7.5% longevity, per hour
eq("2000 hrs pays on 2000", M.calcSickLeavePayoff(2000, rate), 2000*rate*0.70, 1);
eq("2400 hrs pays on 2400", M.calcSickLeavePayoff(2400, rate), 2400*rate*0.70, 1);
eq("4000 hrs pays on 2400 only", M.calcSickLeavePayoff(4000, rate), 2400*rate*0.70, 1);
eq("cap is 2400", M.SICK_LEAVE_PAYOFF_MAX_HOURS, 2400);
eq("200 hrs pays 0 (below table)", M.calcSickLeavePayoff(200, rate), 0);

console.log("\n-- Retiree medical eligibility --");
// calcRetireeMedical(tier, hireYear, retirementYear, cityYOS, totalCalpersYears, atNormalRetAge)
eq("Tier 1 fully vested, no service test", M.calcRetireeMedical("1",1998,2028,28,28,true).vested, 1.0);
eq("Tier 2, 5 Rose + 12 total -> 60%", M.calcRetireeMedical("2",2006,2028,5,12,true).vested, 0.60);
eq("Tier 2, 4 Rose -> not eligible", M.calcRetireeMedical("2",2006,2028,4,20,true).vested, 0);
eq("Tier 3, 12 Rose yrs AT normal age -> 60%", M.calcRetireeMedical("3",2013,2030,12,12,true).vested, 0.60);
eq("Tier 3, 12 Rose yrs BEFORE normal age -> 0", M.calcRetireeMedical("3",2013,2030,12,12,false).vested, 0);
eq("Tier 3, 9 Rose yrs at normal age -> 0", M.calcRetireeMedical("3",2013,2030,9,20,true).vested, 0);
eq("Tier 3 base is 720 + 2%/yr from 2013", M.calcRetireeMedical("3",2013,2030,20,20,true).monthly, 720*Math.pow(1.02,17), 0.5);

console.log("\n-- Prior-agency factors vs CalPERS charts --");
eq("3@50 at 50", M.priorYearFactor("3@50",null,50), 0.030);
eq("3@55 at 50", M.priorYearFactor("3@55",null,50), 0.0240);
eq("3@55 at 55", M.priorYearFactor("3@55",null,55), 0.030);
eq("2.7@57 at 50", M.priorYearFactor("2.7@57",null,50), 0.020);
eq("2.7@57 at 57", M.priorYearFactor("2.7@57",null,57), 0.027);
eq("under 50 = 0", M.priorYearFactor("3@50",null,49), 0);

console.log("\n-- Sick leave service credit --");
eq("2000 hrs = 1 year", M.SICK_LEAVE_HOURS_PER_YEAR_CREDIT, 2000);

console.log("\n-- COLA tier date --");
eq("COLA_TIER_DATE is 12/16/2016", M.COLA_TIER_DATE.toISOString().slice(0,10), "2016-12-16");
const cola=(hire,type)=> (hire < M.COLA_TIER_DATE || type==="classic") ? 0.03 : 0.02;
eq("PEPRA hired 2014 -> 3%", cola(new Date(2014,5,1),"pepra"), 0.03);
eq("PEPRA hired 2015 -> 3%", cola(new Date(2015,0,1),"pepra"), 0.03);
eq("PEPRA hired 12/15/2016 -> 3%", cola(new Date(2016,11,15),"pepra"), 0.03);
eq("PEPRA hired 12/17/2016 -> 2%", cola(new Date(2016,11,17),"pepra"), 0.02);
eq("Classic hired 2020 (recip) -> 3%", cola(new Date(2020,0,1),"classic"), 0.03);
eq("Classic hired 1998 -> 3%", cola(new Date(1998,0,1),"classic"), 0.03);

console.log("\n-- Benefit maximum (corrected comparison) --");
eq("2.7@57 has NO cap", M.formulaMaxPct("2.7@57"), Infinity);
eq("unknown formula defaults to 90%", M.formulaMaxPct("nonsense"), 0.90);

console.log("\n-- 457 three-year window (corrected expectations) --");
eq("Classic NRA 50: age 46 outside window", M.max457For(46,50,true), 24500);
eq("Classic NRA 50: age 47 inside window", M.max457For(47,50,true), 49000);
eq("Classic NRA 50: age 49 inside window", M.max457For(49,50,true), 49000);
eq("Classic NRA 50: age 50 past window -> age-based", M.max457For(50,50,true), 32500);
eq("PEPRA NRA 57: age 53 outside", M.max457For(53,57,true), 32500);
eq("PEPRA NRA 57: age 54 inside", M.max457For(54,57,true), 49000);
eq("PEPRA NRA 57: age 57 past window", M.max457For(57,57,true), 32500);

console.log("\n-- PEPRA 36-month final comp (replicating the component) --");
// Component logic: finalComp = classic ? finalYear : mean(Y, Y-1, Y-2)
const finalComp=(type,byYear,Y)=> type==="classic" ? byYear(Y) : (byYear(Y)+byYear(Y-1)+byYear(Y-2))/3;
// A Captain on Schedule A, top step, riding the MOU raises into a 2029 retirement.
const base = M.SALARY_SCHEDULE_A["Fire Captain"].steps.H;
const raise=(y)=>{ if(y<2027) return 1; let f=1;
  if(y>=2027) f*=1.00; if(y>=2028) f*=1.03; if(y>=2029) f*=1.0175;
  if(y>=2030) f*=Math.pow(1.03,y-2029); return f; };
const byYear=(y)=> base*raise(y);
const fcPepra = finalComp("pepra",byYear,2029);
const fcClassic = finalComp("classic",byYear,2029);
eq("Classic final comp = final year", fcClassic, byYear(2029), 0.01);
eq("PEPRA final comp is BELOW the final year", fcPepra < byYear(2029), true);
eq("PEPRA final comp = mean of 2027/2028/2029", fcPepra, (byYear(2029)+byYear(2028)+byYear(2027))/3, 0.01);
const drag = byYear(2029)-fcPepra;
console.log("         (averaging drag for this profile: $"+drag.toFixed(0)+"/mo of pensionable comp)");
eq("drag is material (>$150/mo)", drag>150, true);
// Flat-salary member: averaging must be a no-op
const flat=()=>10000;
eq("no raises -> 36-mo average == final year", finalComp("pepra",flat,2029), 10000, 0.01);

console.log("\n-- Pension % with the corrected cap --");
const pctFor=(yrs,factor,key)=>Math.min(yrs*factor, M.formulaMaxPct(key));
eq("Classic 30 yrs -> 90%", pctFor(30,0.03,"3@50"), 0.90);
eq("Classic 34 yrs -> still 90%", pctFor(34,0.03,"3@50"), 0.90);
eq("PEPRA 34 yrs @57 -> 91.8% (was clipped to 90%)", pctFor(34,0.027,"2.7@57"), 0.918);
eq("PEPRA 38 yrs @57 -> 102.6%", pctFor(38,0.027,"2.7@57"), 1.026);
// what the old code cost a long-service PEPRA member
const fc = 11000;
const lost = (pctFor(36,0.027,"2.7@57") - 0.90) * fc;
console.log("         (a 36-yr PEPRA member on $11,000 final comp was losing $"+lost.toFixed(0)+"/mo)");
eq("PEPRA 36 yrs recovers >$500/mo", lost>500, true);

console.log("\n-- Sick leave: cash vs credit at the cap --");
const hrs=4000, slRate=54.47;
const cash = M.calcSickLeavePayoff(hrs, slRate);
const creditYrs = hrs / M.SICK_LEAVE_HOURS_PER_YEAR_CREDIT;
eq("4000 hrs = 2.0 yrs of service credit", creditYrs, 2.0);
console.log("         (cash capped at $"+cash.toFixed(0)+"; credit = "+creditYrs+" yrs)");
eq("cash no longer counts unpayable hours", cash, 2400*slRate*0.70, 1);


console.log("\n-- MOU general wage increases (Ch.2 Art.I.A) --");
eq("2027 suppression = 0%", M.mouGwiFor(2027, "Fire Captain"), 0);
eq("2027 prevention = 2.5%", M.mouGwiFor(2027, "Fire & Environmental Safety Inspector II"), 0.025);
eq("2029 suppression = 1.75%", M.mouGwiFor(2029, "Firefighter Paramedic II"), 0.0175);
eq("2029 prevention = 3.0%", M.mouGwiFor(2029, "Fire Plans Examiner"), 0.030);
eq("2028 has no set GWI (comp study)", M.mouGwiFor(2028, "Fire Captain"), 0);
eq("2026 already in the schedules", M.mouGwiFor(2026, "Fire Captain"), 0);
eq("Captain is not prevention", M.isPreventionClass("Fire Captain"), false);
eq("Inspection Supervisor is prevention", M.isPreventionClass("Fire & Environmental Inspection Supervisor"), true);
eq("all four prevention classes listed", M.PREVENTION_CLASSES.length, 4);

console.log("\n-- rank separation produces the MOU's alignment --");
const DIV = 242.67, STUDY = 0.03;
const captH = M.SALARY_SCHEDULE_A["Fire Captain"].steps.H;
const ffp2H = M.SALARY_SCHEDULE_A["Firefighter Paramedic II"].steps.H;
const raiseF = (y, cls) => { if (y < 2027) return 1; let f = 1;
  if (y>=2027) f *= 1+M.mouGwiFor(2027,cls); if (y>=2028) f *= 1+STUDY;
  if (y>=2029) f *= 1+M.mouGwiFor(2029,cls); return f; };
const rank = (y, cls) => { if (y<2027) return 1;
  if (cls==="Fire Engineer") return y>=2028 ? 1.10 : 1.075;
  if (cls==="Fire Captain")  return y>=2028 ? 1.21 : 1.075*1.10; return 1; };
const baseFor = (y, cls) => (y>=2027 && (cls==="Fire Engineer"||cls==="Fire Captain"))
  ? ffp2H*raiseF(y,cls)*rank(y,cls) : (cls==="Fire Captain"?captH:ffp2H)*raiseF(y,cls);
eq("2026 Captain = published schedule", baseFor(2026,"Fire Captain"), captH, 0.01);
eq("2027 Captain = FFP2 x 1.075 x 1.10", baseFor(2027,"Fire Captain"), ffp2H*1.075*1.10, 0.01);
eq("2027 Engineer = FFP2 x 1.075", baseFor(2027,"Fire Engineer"), ffp2H*1.075, 0.01);
eq("2029 Captain = (FFP2 +1.75%, +study) x 1.21", baseFor(2029,"Fire Captain"), ffp2H*1.03*1.0175*1.21, 0.01);
eq("FFP2 gets 0% in 2027", baseFor(2027,"Firefighter Paramedic II"), ffp2H, 0.01);
eq("Captain base still rises in 2027 despite 0% GWI", baseFor(2027,"Fire Captain") > captH, true);
// prevention class tracks its own GWI, not suppression's
const prevH = M.SALARY_SCHEDULE_A["Fire & Environmental Safety Inspector II"].steps.H;
eq("prevention 2027 = +2.5%", prevH*raiseF(2027,"Fire & Environmental Safety Inspector II"), prevH*1.025, 0.01);
eq("prevention 2029 = +2.5%, study, +3.0%", prevH*raiseF(2029,"Fire & Environmental Safety Inspector II"),
   prevH*1.025*1.03*1.03, 0.01);
eq("prevention gets no rank separation", rank(2028,"Fire & Environmental Safety Inspector II"), 1);

console.log("\n"+(fail?"!! ":"")+pass+" passed, "+fail+" failed\n");
process.exit(fail?1:0);
