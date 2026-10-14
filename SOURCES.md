# Sources and data provenance

**Short version: the shape of the crisis is real; the line items are not official.**

Every fund-level total, deficit, loan and date in this game is drawn from reporting
on actual City of Hollister council actions. The split of the general fund across
departments, the revenue mix by source, and every policy option's dollar value are
**modeled estimates** — realistic, internally consistent, and built to reconcile to
the verified totals, but not the city's official line-item budget.

## Why some figures are modeled

The city's own budget documents (`files.hollister.ca.gov`, the eScribe agenda
portal at `pub-hollister.escribemeetings.com`, and `hollister.ca.gov`) were not
reachable from the environment this was built in — DNS for those hosts is blocked
by the network policy. Search-engine summaries surfaced the fund-level totals
below but not the department-level tables.

If you can reach those documents, replacing the modeled values is a contained
change: edit `data/hollister-fy2027.json`, run `node build.js`, and nothing in the
game logic needs to change. Each entry carries a `confidence` field
(`verified` / `derived` / `modeled`) so it is clear what you are replacing.

## Verified figures

| Figure | Value | Where it appears in the game |
|---|---|---|
| General fund deficit, FY 2026-27 adopted | $6.4M | The gap you are asked to close |
| Water fund deficit, FY 2026-27 adopted | $10.7M | Briefing context |
| Combined general + water deficit | $17.1M | Briefing context |
| Fiscal emergency declared | October 2, 2026 | Framing of the whole game |
| Interfund loan from impact fee funds | $18M total | The `impact-fee-loan` policy card |
| — portion to the general fund | $11M | That card's dollar value |
| — portion to the water fund | $7M | Briefing context |
| Loan terms | 4% interest, repayable by June 30, 2027 | That card's consequence text |
| General fund bank balance, week of Sept 21, 2026 | $178 | The briefing's headline fact |
| Ongoing structural deficit remaining after the loan | $2M general fund, $3.4M water | Design of the structural-balance scoring |
| General fund, FY 2025-26 adopted | $46,474,571 | Baseline for the modeled FY 2026-27 total |
| Total appropriations, all funds, FY 2025-26 | $130,985,106 | Briefing context |
| General fund balance, FY 2025-26 | $7,798,926 (16.8% of expenditures) | Reserve-policy scoring |
| General fund reserve policy target | 20% | Reserve scoring and verdict text |
| Vacant positions eliminated, FY 2025-26 | 31, ≈$6M in annual savings | The `freeze-vacancies` card's framing |
| Full-time employees, FY 2025-26 | 191 | Department position counts (allocated) |
| Appropriations limit, FY 2024-25 | $26,603,506 | Reference only |
| Prop 172 public-safety sales tax | ≈$250K–$275K/yr | Reference only |
| Citywide budget shares, FY 2025-26 | Quality of life 49%, public safety 23%, administration 22%, development services 6% | Anchors the modeled department split |
| Measure W | 1% local sales tax, 20-year extension approved Nov 2016 | A revenue line in the game |
| Combined sales tax rate | 9.25% | The `sales-tax-half` card's consequence text |
| Water rates | +30% adopted Feb 2026; unchanged 2019–2026; annual increases set through FY 2030 | Briefing context |
| Water fund overspend over prior decade | ≈$26M (per the city manager) | Briefing context |
| Audited financials | None completed since FY 2021-22 | The `admin-hiring-freeze` card's consequence text |
| Capital improvement plan | 2026–2030 adopted; ≈$35M for the next fiscal year | Reference only |
| FY 2026-27 approach | Voluntary separations rather than layoffs; approved 3–2 on June 22, 2026 | The `voluntary-separation` card, flagged "Actually happened" |

## Modeled figures

These are **estimates**, not city records:

- **The department split of the general fund.** Built to total $48.5M and to sit
  against the reported 23% public-safety share of the citywide budget. Public
  safety lands at roughly 56% of the general fund, which is typical for a
  California city of this size — but the actual Hollister split may differ.
- **The revenue mix by source.** Twelve sources totalling $42.1M. The Measure W
  line is scaled from reported quarterly receipts (≈$1.78M/quarter). The rest are
  proportioned to a typical California general-law city revenue profile.
- **Every policy option's dollar value**, except the $11M interfund loan.
- **Every service-impact number** (the five meters). These are game-design values
  chosen so trade-offs are legible. They are not forecasts.
- **Growth assumptions** in the three-year outlook: revenue +2.2%/yr,
  expenditures +4.2%/yr. Directionally right for a California city facing CalPERS
  rate increases and salary steps; not a city projection.
- **The five council members.** Deliberately fictional archetypes — "The Fiscal
  Hawk," "The Labor Ally" and so on. They are **not** portrayals of any real
  Hollister council member, and no real person's name, record or position is used.

## Source documents

Reporting used:

- BenitoLink, ["Hollister council adopts 2025-26 budget"](https://benitolink.com/hollister-council-adopts-2025-26-budget/)
- BenitoLink, ["Hollister borrows from sewer fund to balance adopted budget"](https://benitolink.com/hollister-borrows-from-sewer-fund-to-balance-adopted-budget/)
- BenitoLink, ["Hollister council agrees to declare fiscal emergency"](https://benitolink.com/hollister-council-agrees-to-declare-fiscal-emergency/)
- BenitoLink, ["Hollister city officials to consider declaring fiscal emergency"](https://benitolink.com/hollister-city-officials-to-consider-declaring-fiscal-emergency/)
- BenitoLink, ["Hollister council OKs 30% water bill increase—for now"](https://benitolink.com/hollister-council-oks-30-water-bill-increasefor-now/)
- BenitoLink, ["City manager: Hollister water overspent by $26 million in past decade"](https://benitolink.com/hollister-city-manager-water-department-overspent-by-26-million-over-decade-needs-fix/)
- SanBenito.com, ["Hollister City Council declares financial emergency"](https://sanbenito.com/hollister-city-council-declares-financial-emergency/)
- CitizenPortal, ["Hollister council narrowly approves preferred FY26–27 budget approach"](https://citizenportal.ai/articles/8307620/California/San-Benito-County/Hollister-City/Hollister-council-narrowly-approves-preferred-FY2627-budget-approach-directs-staff-to-return-interfund-loan-agreement)
- CitizenPortal, ["Hollister council adopts balanced FY 2025–26 budget, creates Prop. 172 fund"](https://citizenportal.ai/articles/6515656/California/San-Benito-County/Hollister-City/Hollister-council-adopts-balanced-FY-202526-budget-creates-Prop-172-fund-no-layoffs)
- CitizenPortal, ["Council adopts 2026-2030 capital improvement plan"](https://citizenportal.ai/articles/6632976/California/San-Benito-County/Hollister-City/Council-adopts-2026-2030-capital-improvement-plan-35-million-slated-for-next-fiscal-year-projects)
- Ballotpedia, [Hollister Measure W (November 2016)](https://ballotpedia.org/Hollister,_California,_Sales_Tax_Extension,_Measure_W_(November_2016))

City documents referenced but **not directly readable** from the build environment:

- [City of Hollister — Financial Reports](https://hollister.ca.gov/government/departments/administrative_services/finance/financial_reports.php)
- [FY 2025-26 Adopted Budget by Fund (PDF)](https://files.hollister.ca.gov/Administrative%20Services/25-26%20ADOPTED%20BUDGET_BY%20FUND.pdf)
- [Staff report, City Council meeting June 16, 2025](https://pub-hollister.escribemeetings.com/filestream.ashx?DocumentId=17709)
- [FY 2024-2025 Budget Book (PDF)](https://files.hollister.ca.gov/Administrative%20Services/FY%202024-2025%20COH%20Budget%20Book_FINAL.pdf)

Where sources conflicted — for example, a $20M sewer-fund loan reported in June
2026 versus the $18M impact-fee loan approved in October 2026 — the game uses the
later, more specific figure and says so on the card.

## Keeping this honest in-game

The game does not hide any of this. The briefing has a "Where these numbers come
from" link, the Budget panel carries a source note, and the final scorecard repeats
the verified/modeled distinction. Policy cards drawn from real council actions are
tagged **"Actually happened"** with a note saying what the city really did.
