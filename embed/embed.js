/* ============================================================
   Balancing Hollister — one-tag embed.

   Paste ONE line into any HTML / embed block:

     <script src="https://jc-ksbw.github.io/budget_game/embed/embed.js"></script>

   Everything renders inside a Shadow DOM, so this needs no changes
   to your site's stylesheet and cannot collide with it — your CSS
   can't reach in, and nothing here leaks out.

   Optional attributes on the script tag:
     data-mode="auto|iframe|card"   default auto: iframe on desktop,
                                    launch card on phones
     data-height="760"              desktop iframe height in px
     data-src="https://..."         game URL (defaults to ../dist/
                                    relative to this script)
     data-breakpoint="640"          px below which the card is used

   To control placement, put an empty div anywhere and the script
   will render into it instead of where the tag sits:

     <div data-balancing-hollister></div>
   ============================================================ */

(function () {
  'use strict';

  // Must be read synchronously, before any await/timeout.
  var me = document.currentScript ||
    (function () {
      var all = document.querySelectorAll('script[src*="embed.js"]');
      return all[all.length - 1] || null;
    })();

  var cfg = {
    mode: (me && me.getAttribute('data-mode')) || 'auto',
    height: parseInt((me && me.getAttribute('data-height')) || '760', 10),
    breakpoint: parseInt((me && me.getAttribute('data-breakpoint')) || '640', 10),
    src: (me && me.getAttribute('data-src')) || null,
  };

  if (!cfg.src) {
    try {
      cfg.src = new URL('../dist/index.html', me.src).href;
    } catch (e) {
      cfg.src = 'https://jc-ksbw.github.io/budget_game/dist/index.html';
    }
  }

  function mount() {
    var host = document.querySelector('[data-balancing-hollister]:not([data-bh-done])');
    if (host) {
      host.setAttribute('data-bh-done', '');
    } else {
      host = document.createElement('div');
      if (me && me.parentNode) me.parentNode.insertBefore(host, me);
      else document.body.appendChild(host);
    }
    // The host element lives in the page's light DOM, so a theme can still
    // style it. Inline styles outrank a theme's ordinary rules.
    host.style.cssText =
      'display:block;width:100%;max-width:none;margin:0;padding:0;' +
      'border:0;background:none;box-shadow:none;float:none;' +
      'transform:none;position:static;overflow:visible;';

    // No Shadow DOM (very old browser): a plain link still works.
    if (!host.attachShadow) {
      var a = document.createElement('a');
      a.href = cfg.src;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Play Balancing Hollister →';
      host.appendChild(a);
      return;
    }

    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS_TEXT
      .replace(/__H__/g, cfg.height)
      .replace(/__BP__/g, cfg.breakpoint);
    root.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'bh bh-mode-' + cfg.mode;
    wrap.innerHTML = HTML_TEXT;
    root.appendChild(wrap);

    // Point both the iframe and the card at the game.
    var frame = root.querySelector('iframe');
    frame.setAttribute('src', cfg.src);
    Array.prototype.forEach.call(root.querySelectorAll('a.card, a.note-link'), function (el) {
      el.setAttribute('href', cfg.src);
    });
  }

  var CSS_TEXT = [
    ':host, * { box-sizing: border-box; }',
    '.bh {',
    '  font: 400 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
    '  color: #0b0b0b;',
    '  --surface: #fcfcfb; --line: rgba(11,11,11,.12);',
    '  --ink2: #52514e; --accent: #2a78d6; --alarm: #d03b3b;',
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  .bh { color: #f0efec; --surface: #1a1a19; --line: rgba(255,255,255,.12);',
    '        --ink2: #c3c2b7; --accent: #3987e5; }',
    '}',

    /* ---- iframe ---- */
    '.frame {',
    '  position: relative; width: 100%; max-width: 900px; margin-inline: auto;',
    '  height: __H__px; border: 1px solid var(--line); border-radius: 14px;',
    '  overflow: hidden; background: var(--surface);',
    '}',
    '.frame > iframe { display: block; width: 100%; height: 100%; border: 0; }',
    '.note {',
    '  max-width: 900px; margin: 10px auto 0; text-align: center;',
    '  font-size: 13.5px; color: var(--ink2);',
    '}',
    '.note a { color: inherit; }',

    /* ---- launch card ---- */
    '.card {',
    '  display: none; text-decoration: none; color: inherit;',
    '  max-width: 900px; margin-inline: auto;',
    '  border: 1px solid var(--line); border-radius: 14px;',
    '  overflow: hidden; background: var(--surface);',
    '}',
    '.bar { display: flex; height: 8px; }',
    '.bar i { display: block; }',
    '.bar i:nth-child(1) { background:#2a78d6; flex:30 }',
    '.bar i:nth-child(2) { background:#eb6834; flex:30 }',
    '.bar i:nth-child(3) { background:#1baf7a; flex:12 }',
    '.bar i:nth-child(4) { background:#eda100; flex:11 }',
    '.bar i:nth-child(5) { background:#e87ba4; flex:17 }',
    '.body { padding: 16px; }',
    '.kicker {',
    '  font-size: 11px; font-weight: 700; letter-spacing: .14em;',
    '  text-transform: uppercase; color: var(--alarm);',
    '}',
    '.title { font-size: 21px; font-weight: 650; letter-spacing: -.02em; margin: 6px 0 4px; }',
    '.sub { font-size: 14px; color: var(--ink2); }',
    '.cta {',
    '  display: inline-flex; align-items: center; gap: 7px; margin-top: 14px;',
    '  min-height: 48px; padding: 0 20px; border-radius: 999px;',
    '  background: var(--accent); color: #fff; font-size: 16px; font-weight: 650;',
    '  text-decoration: none;',
    '}',

    /* ---- which one shows ---- */
    '@media (max-width: __BP__px) {',
    '  .bh-mode-auto .frame, .bh-mode-auto .note { display: none; }',
    '  .bh-mode-auto .card { display: block; }',
    '}',
    '.bh-mode-card .frame, .bh-mode-card .note { display: none; }',
    '.bh-mode-card .card { display: block; }',
    '.bh-mode-iframe .card { display: none; }',
  ].join('\n');

  var HTML_TEXT = [
    '<div class="frame">',
    '  <iframe title="Balancing Hollister — a city budget game" loading="lazy"></iframe>',
    '</div>',
    '<p class="note">Prefer it full screen? <a class="note-link" target="_blank" rel="noopener">Open in a new tab</a>.</p>',
    '<a class="card" target="_blank" rel="noopener">',
    '  <span class="bar"><i></i><i></i><i></i><i></i><i></i></span>',
    '  <span class="body">',
    '    <span class="kicker">Fiscal emergency declared</span>',
    '    <span class="title" style="display:block">Balancing Hollister</span>',
    '    <span class="sub" style="display:block">Close a $6.36&nbsp;million deficit and get three of five council votes. Built on the city\'s published FY&nbsp;2026&#8209;27 budget.</span>',
    '    <span class="cta">Play the game &rarr;</span>',
    '  </span>',
    '</a>',
  ].join('\n');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
