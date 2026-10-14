# Balancing Hollister

A phone-first budget game. You are the City Manager of **Hollister, California**
in the middle of a declared fiscal emergency, and you have a **$6,363,284**
general fund deficit to close — with three of five council votes.

> On October 2, 2026 the Hollister City Council declared a fiscal emergency. The
> week of September 21, the city's general fund bank account held **$178**.

That part is real, and so is the budget. Every fund total, revenue line and
department total comes from the city's published
[FY 2026-27 Approved Budget Document](https://hollister.ca.gov/City%20Managers/Documents/Hollister_FY2026-27_Approved_Budget_July4_Cover.pdf)
and reconciles to it exactly: $56,588,184 of spending against $50,224,900 of
revenue. See [SOURCES.md](SOURCES.md) for what is official and what is a
game-design estimate.

## Hosting and embedding

See **[HOSTING.md](HOSTING.md)**. Short version: `dist/index.html` is one
self-contained file — upload it anywhere, then embed it with the stylesheet and
snippet in [`embed/`](embed/). `embed/example.html` is a working demo.

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
| **Cuts** | Pick savings measures, deferrals and borrowing |
| **Revenue** | Set fees the council controls; put taxes to the voters |
| **Impact** | See what your budget does to services and whether it survives past June |
| **Council** | Submit it and find out if three of five say aye |

The deficit meter is pinned to the top of the screen and updates as you move.

### The lesson the game is built around

Borrowing and selling things balance a budget for exactly **one year**. The
scorecard separates:

- **Cash balance** — does the adopted budget show a positive number? (Required;
  a California council cannot adopt an unbalanced general fund budget.)
- **Structural balance** — does recurring revenue cover recurring cost?

You can close the whole $6.36M with the $11M interfund loan the city actually
took, submit it, and watch the council adopt it — and still be told, correctly,
that the hole reopens in July. The three-year outlook chart makes that visible.

### Scoring

100 points: balancing at all (30), structural balance (25), council support (20),
service levels (20), reserve against the city's 20% policy (5), minus 6 for every
service meter that collapses below 25.

Randomised play almost never passes — roughly **5%** of 40,000 random plans win
three votes, and none reach an A. A well-constructed plan reaches a B; the
practical ceiling found by a hill-climbing search over ~54,000 plans is an
**A-** with a unanimous council.

### Ballot measures

Four revenue options need voter approval, with the odds printed on the card
(hotel tax 74%, cannabis tax 58%, half-cent sales tax 41%, utility users tax 33%).
Their values are derived from the real tax bases: two points on a $975,000 hotel
tax is $195K; half of Measure W's $9,682,000 is $4.8M.
They are resolved when you submit. Build your whole plan on a 33% measure and you
may watch it evaporate at the vote.

### The council

Five members, five sets of priorities: the Fiscal Hawk, the Public Safety
Advocate, the Neighborhood Voice, the Business Voice and the Labor Ally. They are
**fictional archetypes**, not portrayals of any real Hollister council member.
Each scores your budget on structural health, reliance on one-time money, tax and
fee burden, reserve, and the five service meters.

## Built on

Nothing. No framework, no build step beyond a 40-line `build.js`, no runtime
dependencies, no network calls. Charts are hand-rolled SVG so that touch
behaviour, dark mode and label collisions are all under direct control.

```
index.html              app shell
assets/css/app.css      phone-first styles, light + dark
assets/js/charts.js     donut, bars, diverging bars, lines, waterfall, stacks
assets/js/engine.js     budget maths, service meters, council, scoring
assets/js/ui.js         slider, policy card, meter, council row
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
reads departments, revenues, actions, meters and council members entirely from
data.
