'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Append-only JSONL storage for RAGE events.
 *
 * Everything here is intentionally boring and synchronous: the hook that calls
 * it runs on the critical path of every prompt, so an fs.appendFileSync of a
 * single short line beats any cleverer scheme.
 */

function homeDir() {
  return process.env.RAGE_HOME || path.join(os.homedir(), '.claude', 'rage');
}

function eventsPath() {
  return path.join(homeDir(), 'events.jsonl');
}

function statePath() {
  return path.join(homeDir(), 'state.json');
}

function ensureDir() {
  const dir = homeDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Append one event. Never throws: a broken meter must not break your session. */
function appendEvent(event) {
  try {
    ensureDir();
    fs.appendFileSync(eventsPath(), JSON.stringify(event) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** Read all events, skipping any line that got mangled. */
function readEvents() {
  let raw;
  try {
    raw = fs.readFileSync(eventsPath(), 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // Ignore corrupt lines rather than failing the whole report.
    }
  }
  return out;
}

/**
 * Transient per-session state (last prompt + timestamp), used to detect
 * repetition and rapid-fire corrections.
 */
function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    ensureDir();
    fs.writeFileSync(statePath(), JSON.stringify(state), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep state.json from growing without bound. We only ever need the most
 * recent handful of sessions to compute rapid-fire/repetition signals.
 */
function pruneState(state, keep) {
  const limit = keep || 20;
  const ids = Object.keys(state);
  if (ids.length <= limit) return state;
  ids
    .sort((a, b) => (state[a].updatedAt || 0) - (state[b].updatedAt || 0))
    .slice(0, ids.length - limit)
    .forEach((id) => delete state[id]);
  return state;
}

module.exports = {
  homeDir,
  eventsPath,
  statePath,
  ensureDir,
  appendEvent,
  readEvents,
  readState,
  writeState,
  pruneState,
};
