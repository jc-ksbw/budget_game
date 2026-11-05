# Monterey County election tracker

A phone-first, iframe-ready results page for **local** Monterey County contests:
how each race stands, and — for any race still undecided — how many of the
outstanding ballots the trailing candidate would still need.

Three files matter:

| file | what it is |
|---|---|
| `index.html` | the built page. One self-contained file, no dependencies, no network calls. Upload it anywhere. |
| `template.html` | the page's markup, CSS and JavaScript, with a `/*__DATA__*/` placeholder where results get injected. Edit design here. |
| `build.py` | scrapes a saved copy of the county results page and writes `index.html`. |

---

## Updating the numbers on election night

The county has no JSON feed — results are rendered straight into the HTML of
[the Registrar's results page][src]. So:

1. Open that page in a browser.
2. **File → Save Page As…** → save over `election/source/results.html`
   ("Web Page, HTML Only" is enough and much smaller).
3. Run the build:

```bash
python3 election/build.py
```

It prints the report number it found, how many contests it kept and how many it
dropped, then rewrites `election/index.html`. Commit and deploy that file.

To build from a file somewhere else, or to a different output path:

```bash
python3 election/build.py ~/Downloads/results.html -o /tmp/index.html
```

`build.py` needs only the Python standard library.

[src]: https://www.countyofmonterey.gov/government/departments-a-h/elections/election-results

---

## Embedding

`index.html` is designed to sit in an iframe on a story page. It has no fixed
heights, no sticky positioning and no internal scroll area, so it can be sized
to its content and the reader never gets a scrollbar inside a scrollbar.

Paste this where the embed should appear:

```html
<iframe id="ksbw-monterey-election"
        src="https://YOUR-HOST/election/index.html"
        title="Monterey County local election results"
        scrolling="no" loading="lazy"
        style="width:100%;border:0;height:1400px"></iframe>
<script>
(function(){
  var frame = document.getElementById('ksbw-monterey-election');
  window.addEventListener('message', function(e){
    if (!e.data || e.data.type !== 'ksbw:embed:height') return;
    if (e.source !== frame.contentWindow) return;
    frame.style.height = e.data.height + 'px';
  });
  frame.addEventListener('load', function(){
    frame.contentWindow.postMessage('ksbw:embed:ping', '*');
  });
})();
</script>
```

The page posts `{type:'ksbw:embed:height', slug:'monterey-election', height:N}`
to its parent whenever its height changes, and re-posts on request when it
receives `'ksbw:embed:ping'`. If the CMS strips the script, drop it and give the
iframe a fixed height plus `scrolling="yes"` — the page still works.

`embed.html` in this folder is a working demo of the snippet above.

### URL options

Append these to the iframe `src` to pre-set the page — handy when the same
tracker is embedded in several stories:

| parameter | effect |
|---|---|
| `?compact=1` | hides the headline and standfirst (use when the story already carries them) |
| `?group=cities` | opens on one filter: `cities`, `schools`, `measures`, `special`, `federal`, `live`, `all` |
| `?q=salinas` | pre-fills the search box |
| `?sort=az` | `close` (default), `az`, `size` |
| `?left=20000` | sets the outstanding-ballot estimate |

Example: `index.html?compact=1&group=cities&q=seaside`

---

## Editorial rules the page applies

**Local races only.** Statewide offices, statewide judicial retention and
statewide propositions are dropped. Everything else is kept: county, city,
school, community college and special-district contests, local measures, and
the congressional and Assembly districts that sit inside the county. The rules
live in the `STATEWIDE` list at the top of `build.py` — delete a line there to
put a contest back.

**Uncontested races are called.** If a contest has no more candidates than
seats, every candidate is marked elected and no catch-up maths is shown. One
candidate for one seat and four candidates for four seats are both handled.

**One scenario per contested race.** Where there are more candidates than seats,
the page shows the maths for exactly one candidate: the highest-ranked one *not*
currently winning a seat. In a three-seat race that is the fourth-place
candidate, and the person they have to pass is third place — not the leader.

**Statuses** are assigned from that one calculation:

| status | meaning |
|---|---|
| Elected | unopposed |
| Too close to call | the trailing candidate needs ≤ 60% of the ballots left |
| Leading | they need more than 60%, but under 100% |
| Safe lead | they would need more than every ballot left |

---

## How the estimate is calculated

Each contest publishes its own registration and turnout, so:

```
ballots counted here      = registration × reported turnout
ballots still out here    = countywide ballots still out × (ballots counted here ÷ ballots counted countywide)
votes needed to pass      = (last candidate in) − (first candidate out) + 1
share of the ballots left = (ballots still out + votes needed) ÷ (2 × ballots still out)
```

That last line is the head-to-head share: to make up a gap of *g* out of *r*
remaining ballots, a candidate has to win those ballots by *g*, which means
taking *(r+g)/2* of them.

The one number a journalist sets is **ballots still to be counted countywide**,
in the "Scenario" panel. It defaults to 15,000, which would put Monterey County
at about 43% final turnout. On election night, replace it with the figure the
Registrar reports as unprocessed — vote-by-mail, provisionals and conditional
registrations — and every race on the page recalculates. The panel shows the
final countywide turnout each setting implies, as a sanity check.

Caveats stated on the page itself: results are unofficial until certified,
outstanding ballots are not spread evenly across jurisdictions, not every ballot
carries a vote in every contest, and some measures need a 55% or two-thirds
majority that this page does not attempt to judge.
