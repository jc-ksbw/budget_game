# Balancing Hollister

A phone-first budget game. You are the City Manager of **Hollister, California**
in the middle of a declared fiscal emergency, and you have a **$6,363,284**
general fund deficit to close — and three of five community voices to win over.

> On October 2, 2026 the Hollister City Council declared a fiscal emergency. The
> week of September 21, the city's general fund bank account held **$178**.

That part is real, and so is the budget. Every fund total, revenue line and
department total comes from the city's published
[FY 2026-27 Approved Budget Document](https://hollister.ca.gov/City%20Managers/Documents/Hollister_FY2026-27_Approved_Budget_July4_Cover.pdf)
and reconciles to it exactly: $56,588,184 of spending against $50,224,900 of
revenue. See [SOURCES.md](SOURCES.md) for what is official and what is a
game-design estimate.

## Hosting and embedding

See **[HOSTING.md](HOSTING.md)**. `dist/index.html` is one self-contained file —
upload it anywhere. To embed it in a site whose stylesheet you can't edit, paste
one script tag:

```html
<script src="https://jc-ksbw.github.io/budget_game/embed/embed.js"></script>
```

It renders into a Shadow DOM (immune to the host theme), frames the game on
desktop, and swaps to a full-screen launch card on phones.
[`embed/snippet.html`](embed/snippet.html) is a no-JavaScript equivalent. Both
are tested against a deliberately hostile CMS theme.

## Play it

```bash
node build.js            # generates assets/js/data.gen.js and dist/index.html
python3 -m http.server 8000
# open http://localhost:8000
```

`build.js` emits two single-file builds, both self-contained — no server, no
network, no dependencies:

- `dist/index.html` — a complete standalone page. Open it directly, drop it on
  any static host, or AirDrop it to a phone.
- `dist/artifact.html` — the same app for the Claude Artifact host, which
  supplies its own document skeleton and safe-area padding.

## How it plays

Five tabs, built to be driven with a thumb:

| Tab | What you do |
|---|---|
| **Budget** | Drag each department's funding between a service floor and a ceiling |
| **Cuts** | Pick from the reductions, deferrals and borrowing the City has actually discussed |
| **Revenue** | The revenue proposals on the record, including one that is not enacted |
| **Impact** | The five-year outlook first, then what your budget does to services |
| **Community** | Share it and see how five residents rank it |

The deficit meter is pinned to the top of the screen and updates as you move.

### The lesson the game is built around

Borrowing and selling things balance a budget for exactly **one year**. The
scorecard separates:

- **Cash balance** — does the adopted budget show a positive number? (Required;
  a California council cannot adopt an unbalanced general fund budget.)
- **Structural balance** — does recurring revenue cover recurring cost?

You can cover the whole remaining gap with the $11M interfund loan the City actually
took, share it, and watch it go down well — and still be told, correctly, that the
structural hole is exactly as deep as before. The loan is modelled as a **cash
bridge** and is barred in code from touching recurring savings or the structural
gap, because that is what it is: operating cash, repayable by June 30, 2027.

### Scoring

100 points: balancing at all (30), structural balance (25), community support (20),
service levels (20), reserve against the city's 20% policy (5), minus 6 for every
service meter that collapses below 25.

Randomised play rarely lands — about **6.7%** of 20,000 random plans win over three
of five, 44% score an F, and none reach an A. A thoughtful plan reaches a B-; the
practical ceiling found by a hill-climbing search is an **A-** with all five on side.

### Every card cites a City document

There are **20** options. Every source link on every card points at a
`hollister.ca.gov` document — BenitoLink and other reporting were used as research
and are credited in [SOURCES.md](SOURCES.md), but are not cited in the game.

Each card shows three things beside its dollar figure:

| | |
|---|---|
| **Status** | **Adopted** (the City has done it), **Discussed** (the City says it is on the table), or **Common elsewhere** (a revenue tool other California cities use that Hollister has *not* proposed) |
| **Amount kind** | **City figure**, **Derived from City figure** (the card shows the arithmetic), or **Benchmark estimate** (sized from a published City line) |
| **Sources** | title, publisher and date, printed at the bottom of the card |

**13 of the 20 carry a dollar figure; 7 carry none.** Where the City has published
nothing, the card reads *"Savings/revenue not published"* and the engine stores
`null` rather than substituting `0` — it cannot move the deficit, and the scorecard
says how many you picked that moved nothing.

Derived and benchmark figures are arithmetic on published City lines — 5% of the
$34,954,900 personnel total, 10% of the $9,700,350 supplies total, the $975,000
hotel tax divided by its 12% rate. **The percentages are this game's choice, not the
City's**, and every card says so. The arithmetic is tabulated in SOURCES.md and
checked by the test suite.

Options already baked into the adopted budget are **not offered as cards** — there
is no decision left in them. That rules out Measure V (already inside the $975,000
of hotel tax) and the July 2026 fee update (already inside the $4,211,000 of
licences and permits).

Two cards carry heavy caveats:

- **The additional 1% sales tax** carries **$9,682,000/yr**, inferred by matching
  the existing 1% Measure W tax, with the rate moving **9.25% → 10.25%**. It is the
  single largest option on the board and, picked alone, closes the whole gap. The
  October 2026 action only authorised pursuing state legislation, though —
  legislation, a later Council action and an election would all have to happen
  first, roughly six months for the legislation alone — so the card is tagged
  **Needs legislation, council and voters** and the game counts a full year of
  collections that could not begin until all of that cleared.
- **The $11M interfund loan** is a **cash bridge**, barred in code from touching
  recurring savings or the structural gap. It sits on the Revenue tab and carries no
  infrastructure penalty, because no City document shows a project delayed by it.

One card is **locked on** from the first screen, because the City has already done it
and has not reversed it: the July 2026 **voluntary separations**. It has no published
figure, so the board still opens at the full adopted **$6,363,284**.

The **October 14 layoffs** are a choice, not a lock. The notices were issued, but on
October 21 the Council took up a resolution ratifying the rescission of the fiscal
emergency they rested on, and the City is now meeting and conferring with its unions
under an acting city manager. The card carries a derived **$3,617,997** — the City's
October 14 letter to SEIU Local 521 names 16 employees at a combined $2,315,518, an
average of $144,720, applied to 25 positions — and says plainly what that number is
not. See SOURCES.md.

### The community

Five residents, five sets of priorities: the Fiscal Hawk, the Public Safety
Advocate, the Neighborhood Voice, the Business Voice and the Labor Ally. They are
**fictional archetypes**, not portrayals of any real person or officeholder. Each
weighs your budget on structural health, reliance on one-time money, tax and fee
burden, reserve, and the five service meters, then lands on liked or disliked.
The scorecard ranks them best-received first.

## Built on

Nothing. No framework, no build step beyond a 40-line `build.js`, no runtime
dependencies, no network calls. Charts are hand-rolled SVG so that touch
behaviour, dark mode and label collisions are all under direct control.

```
index.html              app shell
assets/css/app.css      phone-first styles, light + dark
assets/js/charts.js     donut, bars, diverging bars, lines, waterfall, stacks
assets/js/engine.js     budget maths, service meters, community reaction, scoring
assets/js/ui.js         slider, policy card, meter, community row
assets/js/app.js        screens and wiring
data/*.json             canonical figures — edit these, not the generated file
build.js                generates data.gen.js + the single-file dist build
```

### Phone details that matter

- Pointer-event sliders with `touch-action: none`, so dragging never scrolls the
  page; `−`/`+` steppers beside each for precision
- 48px minimum tap targets; 40px stepper buttons
- Sticky deficit header and bottom tab bar, both respecting `env(safe-area-inset-*)`
- No hover-dependent information anywhere — every chart is tap-to-reveal
- Charts measure their container and redraw via `ResizeObserver`, so text never
  scales with the viewport
- Verified at 320px, 390px and 1280px wide, in light and dark, with zero
  horizontal overflow

### Accessibility

Sliders are `role="slider"` with arrow/Page/Home/End keys. Chart marks are
focusable with `aria-label`s carrying the exact figures. Every chart with two or
more series has a legend, and service meters pair colour with a number, a word
("Strained", "Failing") and an icon, so nothing is carried by colour alone.

## Changing the data

All figures live in `data/hollister-fy2027.json` and `data/actions.json`. Each
entry carries a `confidence` field — `official`, `derived` or `modeled`.
Edit, run `node build.js`, reload. `build.js` fails loudly if the flat bundle
would contain duplicate top-level declarations.

To retarget the game at another city, replace the two JSON files. The engine
reads departments, revenues, actions, meters and community voices entirely from
data.
