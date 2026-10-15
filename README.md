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
| **Impact** | See what your budget does to services and whether it survives past June |
| **Community** | Share it and see how five residents rank it |

The deficit meter is pinned to the top of the screen and updates as you move.

### The lesson the game is built around

Borrowing and selling things balance a budget for exactly **one year**. The
scorecard separates:

- **Cash balance** — does the adopted budget show a positive number? (Required;
  a California council cannot adopt an unbalanced general fund budget.)
- **Structural balance** — does recurring revenue cover recurring cost?

You can cover the whole $6,363,284 with the $11M interfund loan the City actually
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

### Every option is one the City actually discussed

There are **18** options, and no dollar figure among them was invented for this game.
Each card carries:

- a **status** — adopted/implemented, discussed, or exploratory;
- its **sources**, with publisher and date, printed at the bottom of the card;
- either a **verified amount with its basis**, or the words
  **"Savings/revenue not published"**.

**14 of the 18 have no published figure.** They are selectable, because they are
real proposals with real service consequences — but they cannot move the deficit,
and the engine stores `null` rather than substituting `0` as though that were the
real-world estimate. The scorecard says how many you picked that moved nothing.

Two cards are special:

- **The additional 1% sales tax.** The October 2, 2026 Council action only
  authorised staff to pursue special state legislation. It imposed no tax, set no
  rate and placed nothing on a ballot, so enacted revenue is **$0**. A conditional
  scenario shows **$9,682,000/yr** for a full additional 1% — inferred by matching
  the existing 1% Measure W tax, not an official forecast — and the rate moving
  from **9.25% to 10.25%**. It is computed separately and never touches the gap.
- **The hotel tax.** Measure V already raised it **8% → 12%**, effective April 1,
  2025, with a City estimate of about $300,000/yr. It is marked already enacted and
  offers **$0** further.

Because the documented proposals do not add up to the gap, the department sliders —
real adopted appropriations — are what actually closes it. That is the situation,
not a gap in the research. See [SOURCES.md](SOURCES.md).

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
