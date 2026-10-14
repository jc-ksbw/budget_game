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

Copy `embed/embed.css` into your stylesheet, then paste this where you want the
game. `embed/example.html` is a working demo page — open it to see the result.

```html
<div class="bh-embed">
  <iframe
    src="https://yoursite.com/budget-game/"
    title="Balancing Hollister — a city budget game"
    loading="lazy"></iframe>
</div>
<p class="bh-embed-note">
  Prefer it full screen?
  <a href="https://yoursite.com/budget-game/" target="_blank" rel="noopener">Open in a new tab</a>.
</p>
```

The stylesheet gives the iframe a **760px height on desktop** and, below 640px,
hides it in favour of a **launch card** that opens the game full screen. That
switch is deliberate — see the phone note below.

If you would rather keep the iframe on phones, delete the `.bh-launch` rules and
change the mobile block to a height you like. Subtract your own site header's
height from `100dvh`.

## 4. Things that will bite you

**The iframe needs an explicit height.** The game is a viewport-filling app with
a sticky header and a bottom tab bar, not a flowing document — it cannot
auto-size, and there is nothing to measure. The fixed-height wrapper with the
iframe at `height: 100%` is also the workaround for iOS Safari, which otherwise
expands an iframe to its content height and breaks the sticky header.

**On a phone, an iframe is a worse experience.** A 390×664 screen with your site
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
reads departments, revenues, policy options, meters and council members entirely
from data.
