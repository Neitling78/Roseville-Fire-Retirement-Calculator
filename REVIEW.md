# RFF Retirement Calculator — Full Review

**Date:** September 22, 2026
**Reviewed against:** RFF MOU 1/1/26–12/31/29 · CalPERS contract amendment #3831513094 (eff. 12/16/2016) · CalPERS published benefit factors and circular letters · IRS Notice 2025-67
**Code reviewed:** `src/RFF_Retirement_Calculator.jsx` @ commit e093b18 (3,131 lines), plus the medical-income change of 9/22/2026
**Audience assumed:** Roseville firefighters within a few years of retirement

---

## How to read this

Findings are ranked by how much money they move, not by how hard they are to fix.

- **CONFIRMED** — I traced it to specific language in the MOU, the CalPERS contract, or a CalPERS/IRS publication. The citation is given.
- **VERIFY** — the code and a source disagree, but the source language is ambiguous or a local practice may govern. Check before changing.

I did not change any calculation logic as part of this review. The only code change made on 9/22/2026 was removing the City medical contribution from gross income, which you approved separately.

---

> ## STATUS — updated September 22, 2026
>
> **Fixed and verified in the working copy** (71 unit tests passing, `npm test`):
> #1 PEPRA 90% cap · #3 COLA by membership date · #4 sick-leave payoff cap · #5 457 catch-ups ·
> #6 PEMHCA by year · #8 Tier 3 eligibility · #9 missing classifications *and* Salary Schedule B ·
> #2 PEPRA 36-month final compensation · Tier 3 label · dead URL.
>
> **Resolved during the fix:** the Salary Schedule A vs B question. Both schedules exist, both
> effective 3/21/2026 — A has 8 steps, B has 9, same top step. The code had only Schedule A.
>
> **Part 2 (the redesign) is now built:** opens on five questions and shows nothing until they're
> answered; new "What if I wait?" and "Sick leave" screens; the old five tabs are demoted under
> "Everything else" with nothing deleted; `?tab=` deep links. 115 tests pass (`npm test`) —
> 71 on the math, 44 that server-render every screen and assert what a member actually sees.
>
> **New open question:** the Schedule A/B cutoff. MOU Ch.2 Art.I.C says Schedule B applies to
> hires on/after **1/7/2017**, and that is what the code uses. The City's own PDF is named
> "Schedule-B Hired after to January **2018**." Someone hired in 2017 lands on a different
> schedule depending on which is right. Worth one email to HR or the Treasurer.
>
> **Still open:** #7 uniform allowance $1,300 vs $2,600 (needs a CalPERS statement) ·
> #10 the 1959 Survivor Benefit · sick-leave accrual rate (needs Personnel Rules §3.12.070) ·
> whether a CalPERS contract amendment exists after 12/16/2016 · Part 2, the redesign.

---

# PART 1 — ERRORS THAT CHANGE THE NUMBER

## 1. The 90% cap is applied to PEPRA members. It should not be. — CONFIRMED

**Where:** line 896, `const pensionPct = Math.min(... , 0.90)`; also lines 1056, 1061, 2100, 2114, 3084.

**What the code does:** caps every member's pension at 90% of final compensation, Classic and PEPRA alike. Line 2114 tells a member at the cap "at the cap — extra service adds nothing."

**What the sources say:** The 90% maximum is a feature of the *Classic* safety formulas. CalPERS publishes it for Local Safety 3% at 50 ("Retirees can receive up to 90% of final compensation," reached at 30 years) and for 3% at 55. The PEPRA formula in Roseville's contract is Government Code §7522.25(d), 2.7% at 57. **§7522.25 specifies no maximum percentage**, and CalPERS's own Local Safety 2.7% at 57 benefit-factor chart runs to **108% of final compensation at 40 years of service**.

**Why it matters:** A PEPRA firefighter is told that service past roughly 33 years is worthless. It is not — it is worth 2.7% of final comp per year, for life, with COLA. This is the one error in the tool that could cause someone to retire earlier than they should.

## 2. PEPRA final compensation is computed off the final year, not a 36-month average — CONFIRMED

**Where:** line 918. `pensionableForPension` is the projected pensionable pay in the retirement year. There is no separate "final compensation" concept anywhere in the file.

**What the sources say:** Roseville's CalPERS contract, paragraph 11.h, elects "Section 20042 (One-Year Final Compensation) **for classic members only**." For PEPRA members, Government Code §7522.32 controls and is not electable: "Final compensation shall mean the highest average annual pensionable compensation earned by the member during a period of at least 36 consecutive months."

**Why it matters:** Using the final year for a PEPRA member overstates the pension — and overstates it most right now, because the MOU stacks large increases close together (6.5–10% in March 2026, rank separation in January 2027, a market study in January 2028). A member retiring in 2028 has a final year well above their three-year average. For Classic members the code is correct.

## 3. The retiree COLA is keyed to Classic/PEPRA. It should be keyed to membership date. — CONFIRMED

**Where:** line 1218, `const colaRate = memberType === "classic" ? 0.03 : 0.02;`

**What the sources say:** Two documents agree, and neither uses Classic/PEPRA as the test.

- MOU Chapter 5, Article I.F: "For all employees hired before December 16, 2016, and for Classic employees hired on or after December 16, 2016, the City will provide a three percent (3%) annual cost of living allowance (COLA) increase to retirees. For PEPRA employees hired on or after December 16, 2016, the City will provide a two percent (2%)."
- CalPERS contract ¶11.j elects §21335 (3% COLA) for local fire members entering membership "on or before the effective date of this amendment" — December 16, 2016 — and ¶11.m applies §21329 (2% COLA) only to new local fire members entering membership *after* that date.

**Who this hurts:** every PEPRA firefighter hired between 1/1/2013 and 12/15/2016. They are entitled to the 3% COLA and the calculator gives them 2%. Over a 30-year retirement that is not a rounding error — it compounds.

There is no 12/16/2016 constant anywhere in the file. One needs to be added.

## 4. Sick leave payoff is not capped at the MOU's maximum hours — CONFIRMED

**Where:** lines 64–72. The top tier is `{ min: 1800, max: Infinity, pct: 0.70 }`, with the comment "Roseville fire has no accrual cap, so hours above 1800 stay at 70%."

**What the MOU says (Ch. 3, Art. III.A.1):** the payoff table's 24-hour-shift column reads **"1800 to 2400"** at 70%, under a column header of **"Max."** The table stops at 2400 hours.

**The reasoning error:** having no *accrual* cap is a different question from the *payoff table's* ceiling. The absence of one does not remove the other.

**Scale of it:** a Captain at top step is at about $50.67/hr base ($12,294.95 ÷ 242.67), roughly $54.47/hr with 7.5% longevity. A 28-year member who has banked 4,000 hours is shown a payoff on 1,600 hours the table does not cover — about **$61,000 of cash that may not exist.** That is the single largest dollar error in the tool, and it points the wrong way: it tells someone they can afford to retire.

I am not certain the City reads the table the way I do. But the calculator currently *silently* takes the most generous reading. At minimum this should be a visible, member-adjustable assumption.

## 5. The 457 limit ignores catch-up contributions — CONFIRMED

**Where:** line 96, `const MAX_457_ANNUAL = 24500;`

$24,500 is the correct 2026 elective-deferral limit (IRS Notice 2025-67). But this tool is for people near retirement, and that is exactly who can contribute more:

| Provision | 2026 limit |
|---|---|
| Elective deferral | $24,500 |
| Age 50+ catch-up | +$8,000 → **$32,500** |
| Ages 60–63 "super" catch-up | +$11,250 → **$35,750** |
| 457(b) special three-year pre-retirement catch-up | up to **$49,000** |

The three-year pre-retirement catch-up is a 457-specific provision available in the three years before normal retirement age, and it is the single biggest lever a member near retirement has. The calculator caps them at half of it.

Note for 2026: age-based catch-ups for employees with prior-year FICA wages over $150,000 must be Roth. The 457 three-year catch-up can still be pre-tax.

## 6. PEMHCA minimum is hardcoded at $162 and changes in 15 weeks — CONFIRMED

**Where:** line 993, `const PEMHCA_MIN_MONTHLY = 162;`

$162 is correct for calendar 2026. CalPERS Circular Letter 600-026-26 sets the 2027 contracting-agency minimum at **$167, effective January 1, 2027**. Anyone modeling a retirement in 2027 or later gets the wrong split between the City's direct payment and the reimbursement check.

This should be a small year-indexed table, not a constant — the figure changes every January and the tool is built to project years forward.

## 7. Pensionable uniform allowance may be understated by half — VERIFY

**Where:** line 92, `const UNIFORM_ALLOWANCE_ANNUAL = 1300;` added to pensionable compensation for Classic only.

**MOU Ch. 2, Art. VII.A:** "For Classic employees, the City will report special compensation earned in an amount not to exceed $1,300 per calendar year for the cost of the uniform, **in addition to** the uniform allowance of up to $1,300... This is capturing and inclusive of prior City reported special compensation **up to $2,600**, related to uniform costs, to CalPERS for Classic members."

If the total reported to CalPERS is $2,600, the code understates a Classic member's pensionable compensation by $108/month — about **$97/month of pension** at the 90% cap, for life, with COLA.

The MOU language here is genuinely tangled and I would not change the constant on my reading alone. **Check a Classic member's CalPERS annual statement**, or ask the Treasurer what the City actually reports. That settles it in one look.

## 8. Tier 3 retiree medical eligibility is more generous than the MOU — CONFIRMED

**Where:** `calcRetireeMedical`, line ~267: `const eligible = cityYOS >= 5 && totalYears >= 10;` — applied to Tiers 2 and 3 alike.

That test is correct for **Tier 2** (MOU Art. II.C says exactly that). It is wrong for **Tier 3**. MOU Art. II.D says Tier 3 members "must retire with a minimum of **ten (10) years of City of Roseville service**" — not five Roseville plus ten anywhere — and separately that they "must obtain **normal age of retirement** before they are eligible for a City contribution."

Neither Tier 3 condition is enforced. Normal retirement age is defined in the CalPERS contract ¶1: **age 50 for Classic local safety, age 57 for new (PEPRA) local safety.** A Tier 3 PEPRA member retiring at 52 with 9 years of Roseville service is currently shown a City retiree-medical contribution they would not receive.

## 9. Two classifications are missing entirely — CONFIRMED

`SALARY_SCHEDULE` (lines 5–31) contains four classes: Fire Captain, Fire Engineer, Firefighter Paramedic II, Firefighter Paramedic I.

The MOU covers more. **Firefighter EMT I** is named in the March 2026 labor-market adjustment (and got the largest increase, 10%). The prevention classes — Fire and Environmental Safety Inspector I and II, Fire Plans Examiner, Fire and Environmental Inspection Supervisor — are in the unit, appear throughout Chapter 2, and are in Appendix A. None can use the tool.

Also: **Firefighter Paramedic I and II are given identical salary steps.** The MOU treats them as separate classes with different treatment (rank separation is defined against Paramedic II specifically). Either they genuinely pay the same, in which case a note should say so, or one of them is wrong.

## 10. The 1959 Survivor Benefit is not modeled — CONFIRMED

CalPERS contract ¶11.d elects **§21573, Third Level of 1959 Survivor Benefits**, for local fire members. MOU Ch. 5, Art. I.C confirms the City provides it, employee paying $2.00/month.

This is a real monthly benefit to a survivor and it is absent from the tool. Worth noting: the MOU calls it "the highest level plan," but the contract elects the *Third* Level for fire; the Fourth Level (§21574) is elected for police only. If the union believes fire is owed the fourth level, that is a bargaining question, and the discrepancy between the two documents is worth a look on its own.

Also unmodeled: the Post-Retirement Survivor Allowance (§§21624, 21626, 21628, contract ¶11.a).

## 11. Smaller items

- **Tier 3 label is wrong.** Line 1320 displays "2012–2014." Tier 3 runs 1/1/2012 through 8/14/2015 (Tier 4 begins 8/15/2015). The *logic* at line 683 is right; only the label is wrong. Anyone hired in the first half of 2015 will think the tool has miscategorized them.
- **Two different Tier 4 RHS balances.** `calcRetireeMedical` returns City contributions only; `calcTier4RHS` returns City + employee + growth. Both are displayed. They will never agree.
- **The FLSA overtime pensionable figure is a hidden guess.** `FLSA_OT_PENSIONABLE_PCT = 0.02` — a flat 2% of base assumed to be pensionable for Classic. The MOU says "All regularly scheduled overtime, plus applicable longevity pay, shall be reported to CalPERS as special compensation," which is not a fixed percentage. The member cannot see or change this.
- **Sick leave accrual rate is unverified.** `SICK_LEAVE_ANNUAL_ACCRUAL_HOURS = 144` cites "6 shifts/yr × 24 hrs." The MOU defers to Personnel Rules §3.12.070, which I was not given. Unverified.
- **Section citation.** Code comments cite §20862.8 for sick-leave service credit (following the MOU). The CalPERS contract ¶11.e elects **§20965**. Same benefit, current section number — worth correcting so it matches what CalPERS tells a member.
- **The emailed summary carries a dead URL.** Line 1225 points at `1592treasurer.github.io/RFF-retirement-calculator/`, which returns 404. Every member who uses "Email me this" sends out a broken link.
- **Salary Schedule A vs B.** The code uses one 8-step schedule, commented "confirmed by Treasurer, 6/2026." The MOU still describes two schedules, and says Schedule B went from 10 steps to 9. If they have genuinely converged, the comment should say when and why. If not, members hired after 1/7/2017 are on the wrong schedule. **Verify.**
- **CalPERS contract currency.** The amendment on file is dated 12/16/2016. If there have been later amendments, some of what is above may have moved.

---

# PART 2 — WHY IT FEELS TOO COMPLICATED

## The measurements

- **73 `useState` hooks**, roughly 60 of them member-facing inputs
- **6 tabs**, 12 collapsible sections on the first tab alone
- **3,131 lines** in a single file
- **51 states** in the retirement-tax dropdown, 11 medical plans, 4 dental plans, 8 formula choices for prior service

## The actual problem: the defaults are built for the wrong person

```
classification: "Firefighter Paramedic I"   salaryStep: "A"
dob: 1990-01-01                             hireDate: 2026-01-01
retirementAge: 57                           memberType: "pepra"
medicalTier: "4"
```

That is a brand-new hire. You told me the audience is members near retirement. Every one of those people has to change every one of those fields before a single number on the screen is true about them — and until they do, the tool is confidently displaying someone else's retirement.

That is why it feels complicated. It is not the input count on its own. It is that the tool opens on a stranger and asks you to correct it, field by field, with no indication of which fields matter.

## What a member near retirement actually needs

They have three questions, and only three:

1. **What is my check?** Gross pension, tax, medical out of pocket, and the number that lands in the bank.
2. **What does waiting buy me?** Retire this year, next year, the year after — what changes, and where does it stop changing?
3. **What do I do with my sick leave?** Cash or service credit. This is the one irreversible decision and it is worth five figures.

Everything else is either a refinement of those or belongs somewhere else.

## Proposed structure

**Screen 1 — five questions.** Classification and step. Date of birth. Hire date. Planned retirement date. Sick leave hours. Everything else derives (Classic/PEPRA, medical tier, longevity vs service-term bonus, and vesting all follow from hire date) or gets a sane default that can be opened later.

Then show the answer: **gross → deductions → the number that lands in the bank.** One column, top to bottom, no donut.

**Screen 2 — "What if I wait?"** A table of retirement years: pension, take-home, sick-leave value, and the cumulative cost of waiting. For a Classic member, mark the year they reach 90%. For a PEPRA member, show that there is no cap and what each additional year is worth. This answers question 2 directly instead of making them re-run the tool five times.

**Screen 3 — "Sick leave: cash or credit."** Side by side. Cash now versus monthly pension for life, break-even age, and what happens at the cap. This already exists in fragments across the file — it deserves its own screen.

**Screen 4 — Medical.** All of it, which is where the 9/22 change already put it.

**Everything else → "Advanced," collapsed by default.** Prior service and reciprocity, the 51-state tax comparison, promotion modeling, 457 growth assumptions, survivor options, the income timeline.

Nothing has to be deleted. It has to stop being the first thing a member sees.

## Two smaller UI points

- **The replacement-ratio gauge compares unlike things.** Retirement income against current *gross* salary. A member's real question is take-home against take-home — they stop paying 9–11.5% to CalPERS, stop paying union dues, stop paying the active medical premium. The gauge reads low and scares people.
- **The printed one-pager is the best thing in the tool.** It is clean, it fits on a page, it says what it means. If you want to know what the web version should look like, look at the print sheet.

---

# PART 3 — WHAT I'D DO, IN ORDER

**Fix now — these are wrong and they cost money**

1. Remove the 90% cap for PEPRA (#1)
2. Fix the COLA test to hire date 12/16/2016 (#3)
3. Cap the sick-leave payoff at the MOU's 2400 hours, or expose it as an assumption (#4)
4. Make PEMHCA a year-indexed table and add 2027 = $167 (#6)
5. Fix the Tier 3 label (#11)
6. Fix the dead URL in the emailed summary (#11)

**Fix next — real, but more work**

7. 36-month final compensation for PEPRA (#2)
8. 457 catch-up contributions (#5)
9. Tier 3 eligibility: 10 years Roseville, and normal retirement age (#8)
10. Add Firefighter EMT I and the prevention classes (#9)

**Verify before touching**

11. Uniform allowance $1,300 or $2,600 (#7) — one look at a CalPERS statement
12. Salary Schedule A vs B (#11)
13. Sick leave accrual rate (#11) — needs Personnel Rules §3.12.070
14. Whether a CalPERS contract amendment exists after 12/16/2016

**Then redesign** — Part 2. Worth doing after the math is right, not before.

**Ongoing**

15. Move every dated constant into one block at the top with the year it expires: PEMHCA minimum, 457 limits, PEPRA comp cap, medical premiums, tax brackets, salary schedule. Right now they are scattered across 3,100 lines and each one is a silent time bomb every January.

---

## Sources

- RFF MOU, term 1/1/26–12/31/29 — Chapters 2, 3, 4, 5, 6
- CalPERS Amendment to Contract, City of Roseville, CalPERS ID #3831513094, effective 12/16/2016
- CalPERS, *Retirement Formulas and Benefit Factors* — Local Safety 3% at 50; 3% at 55; 2.7% at 57
- CalPERS Circular Letter 600-026-26 (2027 PEMHCA minimum employer contribution)
- CalPERS Circular Letter 200-001-26 (2026 compensation limits)
- CalPERS, *Summary of the Public Employees' Pension Reform Act*
- California Government Code §§7522.25, 7522.32
- CalPERS, "Sick Leave Can Give Your Retirement a Healthy Boost" (2,000 hours = 1 year of service credit)
- IRS Notice 2025-67 (2026 retirement plan limits)
- `src/RFF_Retirement_Calculator.jsx` @ e093b18
