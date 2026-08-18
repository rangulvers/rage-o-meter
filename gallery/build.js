#!/usr/bin/env node
'use strict';

/**
 * Renders gallery/entries/*.json into docs/gallery.html.
 *
 * Every value that reaches the page is escaped, and the entries have already
 * passed validate.js, so the output is static and safe to serve.
 */

const fs = require('fs');
const path = require('path');

const ENTRY_DIR = path.join(__dirname, 'entries');
const OUT = path.join(__dirname, '..', 'docs', 'gallery.html');

const BAND_STYLE = {
  'Great agentic workflow':   { key: 'calm',  emoji: '😌' },
  'Needs better prompting':   { key: 'meh',   emoji: '😐' },
  "I'm doing the task myself":{ key: 'fire',  emoji: '🔥' },
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadEntries() {
  if (!fs.existsSync(ENTRY_DIR)) return [];
  return fs.readdirSync(ENTRY_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ENTRY_DIR, f), 'utf8')))
    .sort((a, b) => b.ragePerSession - a.ragePerSession);
}

const BAR_WIDTH = 16;

/**
 * Signal bars, scaled against the top signal's real count — exactly how the
 * terminal report draws them.
 */
function signalRows(signals) {
  if (!Array.isArray(signals) || !signals.length) return '';
  const max = Math.max(...signals.map(([, n]) => n));
  return signals
    .map(([name, n]) => {
      const filled = Math.max(1, Math.round((n / max) * BAR_WIDTH));
      return (
        `<div class="line"><span class="k">${esc(name)}</span>` +
        `<span class="n">${esc(String(n).padStart(3))}</span>  ` +
        `<span class="bar">${'█'.repeat(filled)}</span></div>`
      );
    })
    .join('\n        ');
}

function card(e) {
  const style = BAND_STYLE[e.band] || BAND_STYLE['Needs better prompting'];
  const rps = Number(e.ragePerSession).toFixed(1);

  const scoreRow = e.rageScore !== undefined
    ? `\n        <div class="line"><span class="k">Rage score</span>${esc(e.rageScore)}</div>`
    : '';

  const peakBlock = e.peakRage
    ? `\n        <div class="line sp"></div>
        <div class="line dim">Peak rage:</div>
        <div class="line peak">"${esc(e.peakRage)}"</div>`
    : '';

  const sigBlock = e.signatureMove
    ? `\n        <div class="line sp"></div>
        <div class="line dim">Signature move:</div>
        <div class="line"><span class="bar">${esc(e.signatureMove)}</span></div>`
    : '';

  return `
    <figure class="card ${style.key}">
      <div class="card-head">
        <a class="who" href="https://github.com/${esc(e.handle)}" rel="noopener">@${esc(e.handle)}</a>
        <span class="verdict">${style.emoji} ${esc(e.band)}</span>
      </div>

      <div class="screen">
        <div class="line"><span class="p">❯</span> <span class="cmd">/rage</span></div>
        <div class="line sp"></div>
        <div class="line"><span class="k">Reprimands</span>${esc(e.reprimands)}</div>
        <div class="line"><span class="k">Sessions</span>${esc(e.sessions)}</div>${scoreRow}
        <div class="line"><span class="k">RAGE/session</span><b>${esc(rps)}</b></div>
        <div class="line sp"></div>
        <div class="line dim">What set them off:</div>
        ${signalRows(e.topSignals)}${peakBlock}${sigBlock}
      </div>

      <figcaption class="quote">“${esc(e.caption)}”</figcaption>
    </figure>`;
}

function build() {
  const entries = loadEntries();
  const total = entries.reduce((s, e) => s + e.reprimands, 0);
  const avg = entries.length
    ? (entries.reduce((s, e) => s + e.ragePerSession, 0) / entries.length).toFixed(1)
    : '0.0';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The RAGE Gallery</title>
<meta name="description" content="A wall of other people's frustration with their coding agents.">
<style>
  :root {
    --bg:#0d1117; --panel:#161b22; --border:#30363d;
    --text:#e6edf3; --muted:#8b949e; --accent:#ff6b35;
    --mono:"SF Mono","Cascadia Code","Fira Code",Consolas,monospace;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);line-height:1.6;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
  .wrap{max-width:1000px;margin:0 auto;padding:0 24px}
  header{text-align:center;padding:64px 0 32px}
  h1{font-family:var(--mono);font-size:clamp(2rem,6vw,3rem);
    background:linear-gradient(90deg,#3fb950,#d29922,#f85149);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .sub{color:var(--muted);margin-top:8px}
  .stats{display:flex;gap:28px;justify-content:center;margin-top:24px;flex-wrap:wrap}
  .stat{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 22px}
  .stat b{display:block;font-family:var(--mono);font-size:1.5rem;color:var(--accent)}
  .stat span{color:var(--muted);font-size:.8rem}
  .nav{text-align:center;margin-top:24px}
  .nav a{color:var(--accent);text-decoration:none;font-family:var(--mono);font-size:.9rem;margin:0 10px}
  .nav a:hover{text-decoration:underline}

  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));
    gap:20px;padding:40px 0 60px}

  /* the card: coloured panel, inset terminal */
  .card{border-radius:16px;padding:18px;position:relative;overflow:hidden;
    background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 2px,transparent 2px 14px)}
  .card.calm{background-color:#12602f}
  .card.meh {background-color:#8a6100}
  .card.fire{background-color:#8f2018}

  .card-head{display:flex;justify-content:space-between;align-items:center;
    gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .who{font-family:var(--mono);font-weight:700;color:#fff;text-decoration:none;font-size:.95rem}
  .who:hover{text-decoration:underline}
  .verdict{font-size:.75rem;color:rgba(255,255,255,.85);
    background:rgba(0,0,0,.25);padding:3px 10px;border-radius:20px;white-space:nowrap}

  .screen{background:rgba(0,0,0,.58);border-radius:10px;padding:16px 18px;
    font-family:var(--mono);font-size:.78rem;line-height:1.7}
  .line{white-space:pre;color:#e6edf3;overflow:hidden;text-overflow:ellipsis}
  .line.sp{height:.6em}
  .p{color:#8b949e}
  .cmd{color:#ffc857;font-weight:700}
  .k{color:rgba(255,255,255,.55);display:inline-block;min-width:15ch}
  .n{color:#fff}
  .bar{color:#ffc857;letter-spacing:-1px}
  .dim{color:rgba(255,255,255,.55)}
  .peak{color:#ff9d8a;white-space:pre-wrap;word-break:break-word}
  .screen b{color:#fff}

  .quote{margin-top:14px;color:rgba(255,255,255,.92);font-size:.9rem;
    font-style:italic;line-height:1.45}

  .empty{text-align:center;color:var(--muted);padding:60px 0}
  footer{border-top:1px solid var(--border);padding:32px 0 60px;text-align:center;
    color:var(--muted);font-size:.85rem}
  footer a{color:var(--accent);text-decoration:none}
</style>
</head>
<body>
<header class="wrap">
  <h1>The RAGE Gallery</h1>
  <p class="sub">A wall of other people's frustration. You are not alone.</p>
  <div class="stats">
    <div class="stat"><b>${entries.length}</b><span>contributors</span></div>
    <div class="stat"><b>${total}</b><span>total reprimands</span></div>
    <div class="stat"><b>${avg}</b><span>avg RAGE/session</span></div>
  </div>
  <nav class="nav">
    <a href="./">← back to the meter</a>
    <a href="https://github.com/rangulvers/rage-o-meter/blob/main/gallery/README.md">add yours →</a>
  </nav>
</header>

<main class="wrap">
${entries.length
  ? `<div class="grid">${entries.map(card).join('\n')}</div>`
  : '<p class="empty">No entries yet. Be the first to admit it.</p>'}
</main>

<footer class="wrap">
  <p>Cards are submitted by pull request and contain no prompt text —
  only counts, verdict bands, and signal names.</p>
  <p style="margin-top:10px">
    <a href="https://github.com/rangulvers/rage-o-meter">github.com/rangulvers/rage-o-meter</a>
  </p>
</footer>
</body>
</html>
`;

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Built ${OUT} from ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
}

build();
