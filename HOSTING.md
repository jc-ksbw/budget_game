# Hosting Balancing Hollister on your own site

The game is static. There is no server, no database, no build step on the host
and no outbound network calls — it is HTML, CSS and JavaScript that runs entirely
in the visitor's browser. Any web host that can serve a file can serve this.

## 1. Pick what you upload

Two builds, both produced by `node build.js`:

| | What it is | Use it when |
|---|---|---|
| **`dist/index.html`** | One self-contained file, ~130 KB. CSS and JS inlined. | Almost always. Drop it anywhere. |
| **repo root** (`index.html` + `assets/`) | The modular version. | You want to edit the source on the server, or serve the repo directly. |

`dist/index.html` has no relative paths at all, so it works from any folder, any
domain, renamed to anything. That is the one to upload.

> Serve it as `text/html`. Every normal host does this for `.html` automatically.

## 2. Get it onto a URL

### Option A — Your existing web server (simplest)

Upload `dist/index.html` to wherever your site's files live:

```
/public_html/budget-game/index.html
```

It is now at `https://yoursite.com/budget-game/`. Done — no configuration.

### Option B — GitHub Pages (free, updates when you push)

The repo is already laid out to serve directly:

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `claude/stoic-hypatia-5y4akj` (or merge to `main` first), folder `/ (root)`
4. Save, wait ~60 seconds

You get `https://jc-ksbw.github.io/budget_game/` serving the modular build, and
`https://jc-ksbw.github.io/budget_game/dist/` serving the single-file build.
Every push republishes.

### Option C — Netlify or Cloudflare Pages (free, drag-and-drop)

Drag the `dist` folder onto app.netlify.com/drop. You get a URL immediately, and
you can point your own subdomain at it (e.g. `budget.yoursite.com`).

## 3. Embed it

You do **not** need access to your site's stylesheet. Both options below carry
their own styling and are tested against a deliberately hostile CMS theme — one
that forces `font-family` globally, crushes every `iframe` to 120px with
`!important`, repaints links, and uses colliding class names. Both survive it.

### Option 1 — one script tag (recommended)

```html
<script src="https://jc-ksbw.github.io/budget_game/embed/embed.js"></script>
```

That is the whole thing. It renders into a **Shadow DOM**, so your theme's CSS
cannot reach inside and nothing leaks out. On desktop you get the game in a
760px frame; below 640px it switches to a launch card that opens the game full
screen.

Optional attributes:

| Attribute | Default | What it does |
|---|---|---|
| `data-mode` | `auto` | `iframe` to always frame it, `card` to always show the launch card |
| `data-height` | `760` | Desktop frame height in px |
| `data-breakpoint` | `640` | Width below which the card replaces the frame |
| `data-src` | `../dist/index.html` | Game URL, resolved against the script's own URL |

It renders where the tag sits. If your CMS moves scripts to the footer, drop an
empty div where you want it instead:

```html
<div data-balancing-hollister></div>
<script src="https://jc-ksbw.github.io/budget_game/embed/embed.js"></script>
```

### Option 2 — plain HTML, no JavaScript

If your CMS strips `<script>` tags, paste the contents of
[`embed/snippet.html`](embed/snippet.html) into an HTML block. It carries a
scoped `<style>` block and needs no stylesheet changes.

It is hardened with `!important` on the properties themes usually hijack, which
is why it holds up in the hostile test — but a theme that also uses `!important`
at higher specificity could still reach it. The script version cannot be reached
at all, so prefer it where you can.

### Option 3 — bare iframe

If you only have an iframe field and cannot paste HTML at all:

```
https://jc-ksbw.github.io/budget_game/dist/index.html
```

Set the height to **760px**. Be aware this is the weakest option on phones — see
below.

## 4. Things that will bite you

**The iframe needs an explicit height.** The game is a viewport-filling app with
a sticky header and a bottom tab bar, not a flowing document — it cannot
auto-size, and there is nothing to measure. The fixed-height wrapper with the
iframe at `height: 100%` is also the workaround for iOS Safari, which otherwise
expands an iframe to its content height and breaks the sticky header.

**On a phone, an iframe is a worse experience.** (Options 1 and 2 handle this
for you by swapping in the launch card; option 3 cannot.) A 390×664 screen with your site
header leaves the game about 540px, puts a scroll inside a scroll, and — because
`env(safe-area-inset-*)` resolves against the top document — lets the game's
bottom tab bar sit under the home indicator. That is why the stylesheet shows a
launch card instead. The game itself is excellent on a phone; it just needs the
whole screen.

**Don't add `sandbox` unless you need it.** If you do, include
`allow-scripts allow-same-origin` — without the second one the theme toggle's
`localStorage` write throws. (The game catches it and carries on, but the
viewer's theme choice stops persisting.)

**If your site sets a Content-Security-Policy**, add the game's origin to
`frame-src`. And if you serve the game from a host that applies a strict CSP to
*its own* documents, note the page uses an inline `<style>` and an inline
`<script type="module">`, so it needs `'unsafe-inline'` or a nonce. Hosting it as
a plain static file, as above, avoids this entirely.

**Analytics.** There is none, and the game sends nothing anywhere. If you want
page views, your normal site analytics will count the iframe load or the launch
card click. Anything finer means adding your own snippet to `dist/index.html`.

## 5. Updating it later

Edit `data/hollister-fy2027.json` or `data/actions.json`, then:

```bash
node build.js
```

That regenerates both builds. Re-upload `dist/index.html`, or push and let Pages
or Netlify redeploy. Nothing else changes.

To point the game at a different city, replace those two JSON files — the engine
reads departments, revenues, policy options, meters and community voices entirely
from data.
