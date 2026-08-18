#!/usr/bin/env node
'use strict';

/**
 * Renders the RAGE report.
 *
 *   report.js            → current session + all-time summary
 *   report.js --all      → all-time only
 *   report.js --session <id>
 *   report.js --json     → machine-readable
 *   report.js --share    → gallery card JSON (stats only, no prompt text)
 *   report.js --reset    → wipe history (asks for --yes to actually do it)
 */

const path = require('path');
const fs = require('fs');
const { band } = require(path.join(__dirname, '..', 'lib', 'score.js'));
const store = require(path.join(__dirname, '..', 'lib', 'store.js'));

const BAR_WIDTH = 24;

function parseArgs(argv) {
  const args = {
    mode: 'default',
    json: false,
    session: null,
    yes: false,
    handle: null,
    caption: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.mode = 'all';
    else if (a === '--json') args.json = true;
    else if (a === '--reset') args.mode = 'reset';
    else if (a === '--share') args.mode = 'share';
    else if (a === '--yes') args.yes = true;
    else if (a === '--session') args.session = argv[++i] || null;
    else if (a === '--handle') args.handle = argv[++i] || null;
    else if (a === '--caption') args.caption = argv[++i] || null;
  }
  return args;
}

function groupBy(events, keyFn) {
  const map = new Map();
  for (const e of events) {
    const k = keyFn(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

function bar(value, max) {
  if (max <= 0) return '';
  const filled = Math.max(1, Math.round((value / max) * BAR_WIDTH));
  return '█'.repeat(Math.min(filled, BAR_WIDTH));
}

function signalTally(events) {
  const counts = {};
  for (const e of events) {
    for (const s of e.signals || []) counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function summarize(events) {
  const sessions = groupBy(events, (e) => e.session);
  const totalRage = events.length;
  const sessionCount = sessions.size;
  const perSession = sessionCount ? totalRage / sessionCount : 0;
  return { totalRage, sessionCount, perSession, sessions };
}

function renderSession(events, label) {
  const lines = [];
  const count = events.length;
  const b = band(count);

  lines.push('');
  lines.push(`  RAGE — ${label}`);
  lines.push('  ' + '─'.repeat(46));

  if (!count) {
    lines.push('');
    lines.push('  0 reprimands. 😌 Great agentic workflow.');
    lines.push('  Either the agent behaved, or you have given up entirely.');
    lines.push('');
    return lines.join('\n');
  }

  const score = events.reduce((s, e) => s + (e.score || 0), 0);
  lines.push('');
  lines.push(`  Reprimands : ${count}`);
  lines.push(`  Rage score : ${score}`);
  lines.push(`  Verdict    : ${b.emoji} ${b.label}`);
  lines.push('');

  const tally = signalTally(events);
  if (tally.length) {
    lines.push('  What set you off:');
    const max = tally[0][1];
    for (const [name, n] of tally.slice(0, 6)) {
      lines.push(`    ${name.padEnd(15)} ${String(n).padStart(3)}  ${bar(n, max)}`);
    }
    lines.push('');
  }

  const worst = events.slice().sort((a, b2) => (b2.score || 0) - (a.score || 0))[0];
  if (worst && worst.excerpt) {
    lines.push(`  Peak rage (${worst.score}):`);
    lines.push(`    "${worst.excerpt}"`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderAllTime(events) {
  const lines = [];
  const { totalRage, sessionCount, perSession } = summarize(events);
  const b = band(perSession);

  lines.push('  RAGE — all time');
  lines.push('  ' + '─'.repeat(46));
  lines.push('');

  if (!totalRage) {
    lines.push('  No rage recorded yet. Suspicious.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`  Sessions with rage : ${sessionCount}`);
  lines.push(`  Total reprimands   : ${totalRage}`);
  lines.push(`  RAGE/session       : ${perSession.toFixed(1)}  ${b.emoji} ${b.label}`);
  lines.push('');

  const byProject = groupBy(events, (e) => e.project || 'unknown');
  const ranked = [...byProject.entries()].sort((a, b2) => b2[1].length - a[1].length);
  if (ranked.length > 1) {
    lines.push('  Most infuriating projects:');
    const max = ranked[0][1].length;
    for (const [project, evs] of ranked.slice(0, 5)) {
      const name = project.length > 22 ? project.slice(0, 21) + '…' : project;
      lines.push(
        `    ${name.padEnd(22)} ${String(evs.length).padStart(3)}  ${bar(evs.length, max)}`
      );
    }
    lines.push('');
  }

  const tally = signalTally(events);
  if (tally.length) {
    lines.push('  Signature move:');
    lines.push(`    ${tally[0][0]} (${tally[0][1]}×)`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build a gallery card payload.
 *
 * Deliberately contains NO prompt text. Only counts, the verdict band, and
 * signal *names*. The caption is written by hand, so nothing you typed at an
 * agent can end up in a public pull request by accident.
 */
function buildShareCard(events, handle, caption) {
  const { totalRage, sessionCount, perSession } = summarize(events);
  const tally = signalTally(events);
  const worst = events.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const card = {
    handle: handle || 'your-github-handle',
    reprimands: totalRage,
    sessions: sessionCount,
    ragePerSession: Number(perSession.toFixed(1)),
    rageScore: events.reduce((s, e) => s + (e.score || 0), 0),
    band: band(perSession).label,
    topSignals: tally.slice(0, 4).map(([name, n]) => [name, n]),
    caption: caption || 'what did it do this time?',
  };

  // Your angriest prompt, pre-filled so the card is honest. Review it — this
  // is the one field that contains text you actually typed. Delete the line
  // if you would rather not publish it.
  if (worst && worst.excerpt) card.peakRage = worst.excerpt.slice(0, 80);
  if (tally.length) card.signatureMove = tally[0][0];

  return card;
}

function renderShare(events, args) {
  const card = buildShareCard(events, args.handle, args.caption);
  const slug = (card.handle || 'entry').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

  const lines = [];
  lines.push('');
  lines.push('  Your gallery card');
  lines.push('  ' + '─'.repeat(46));
  lines.push('');
  lines.push(JSON.stringify(card, null, 2).split('\n').map((l) => '  ' + l).join('\n'));
  lines.push('');
  lines.push('  ' + '─'.repeat(46));
  if (card.peakRage) {
    lines.push('  ⚠  "peakRage" is text you actually typed. Check it before');
    lines.push('     you publish it — delete the line if you would rather not.');
  } else {
    lines.push('  Contains no prompt text — only counts and signal names.');
  }
  lines.push('');
  lines.push('  To submit:');
  lines.push(`    1. Save the JSON above as  gallery/entries/${slug}.json`);
  lines.push('    2. Edit "handle" and "caption" to taste');
  lines.push('    3. Open a PR against rangulvers/rage-o-meter');
  lines.push('');
  lines.push('  Full guide: https://github.com/rangulvers/rage-o-meter/blob/main/gallery/README.md');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'reset') {
    if (!args.yes) {
      process.stdout.write(
        '\n  This deletes your entire RAGE history.\n' +
          '  Re-run with:  --reset --yes\n\n'
      );
      return;
    }
    try {
      fs.rmSync(store.eventsPath(), { force: true });
      fs.rmSync(store.statePath(), { force: true });
      process.stdout.write('\n  RAGE history wiped. A clean slate. 😌\n\n');
    } catch (err) {
      process.stdout.write(`\n  Could not reset: ${err.message}\n\n`);
    }
    return;
  }

  const events = store.readEvents();

  if (args.mode === 'share') {
    if (args.json) {
      process.stdout.write(
        JSON.stringify(buildShareCard(events, args.handle, args.caption), null, 2) + '\n'
      );
      return;
    }
    process.stdout.write(renderShare(events, args));
    return;
  }

  if (args.json) {
    const { totalRage, sessionCount, perSession } = summarize(events);
    process.stdout.write(
      JSON.stringify(
        {
          totalRage,
          sessionCount,
          ragePerSession: Number(perSession.toFixed(2)),
          band: band(perSession).label,
          events,
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  const out = [];
  const sessionId = args.session || process.env.CLAUDE_SESSION_ID;

  if (args.mode !== 'all' && sessionId) {
    const mine = events.filter((e) => e.session === sessionId);
    out.push(renderSession(mine, 'this session'));
  }

  out.push(renderAllTime(events));
  process.stdout.write(out.join('\n'));
}

main();
