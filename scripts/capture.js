#!/usr/bin/env node
'use strict';

/**
 * UserPromptSubmit hook: score the prompt, log it, get out of the way.
 *
 * Hard rules for this file:
 *   1. Always exit 0. A crash here must never block the user's prompt.
 *   2. Never write to stdout. Anything on stdout is injected into Claude's
 *      context, and a meter that narrates itself would change the behaviour
 *      it is trying to measure.
 *   3. Be fast. UserPromptSubmit blocks the session and times out at 30s.
 */

const path = require('path');
const { scorePrompt } = require(path.join(__dirname, '..', 'lib', 'score.js'));
const store = require(path.join(__dirname, '..', 'lib', 'store.js'));

function readStdin() {
  try {
    return require('fs').readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  if (process.env.RAGE_DISABLE === '1') return;

  const raw = readStdin();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const prompt = payload.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) return;

  // Don't score the user asking for their own stats.
  if (/^\s*\/rage\b/.test(prompt)) return;

  const sessionId = payload.session_id || 'unknown';
  const now = Date.now();

  const state = store.readState();
  const prior = state[sessionId] || {};
  const secondsSincePrevious =
    typeof prior.at === 'number' ? (now - prior.at) / 1000 : undefined;

  const result = scorePrompt(prompt, {
    previousPrompt: prior.prompt,
    secondsSincePrevious,
  });

  state[sessionId] = { prompt, at: now, updatedAt: now };
  store.writeState(store.pruneState(state));

  if (!result.isRage) return;

  store.appendEvent({
    v: 1,
    ts: new Date(now).toISOString(),
    session: sessionId,
    cwd: payload.cwd || process.cwd(),
    project: path.basename(payload.cwd || process.cwd()),
    score: result.score,
    signals: result.signals.map((s) => s.name),
    detail: result.signals.map((s) => `${s.name}: ${s.detail}`),
    // Store a short, redacted excerpt only. Enough to jog your memory,
    // not enough to leak a prompt full of secrets into a log file.
    excerpt: prompt.trim().replace(/\s+/g, ' ').slice(0, 80),
  });
}

try {
  main();
} catch {
  // Swallow everything. See rule 1.
}

process.exit(0);
