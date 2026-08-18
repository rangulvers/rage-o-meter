'use strict';

/**
 * RAGE scoring engine.
 *
 * Pure, dependency-free, deterministic. Given a prompt string (and a little
 * session context) it returns a score plus the signals that produced it.
 *
 * Design notes:
 *  - Everything runs locally. No network, no model calls, no telemetry.
 *  - Scores are additive and capped, so one furious prompt can't dominate.
 *  - Every signal is explainable: `/rage` shows you exactly why it fired.
 */

// Words that are basically never typed by a calm person talking to a robot.
// Kept deliberately small and boring; the multi-word phrases do the heavy lifting.
const PROFANITY = [
  'fuck', 'fucking', 'fucked', 'shit', 'crap', 'damn', 'dammit', 'goddamn',
  'bloody', 'bollocks', 'wtf', 'ffs', 'stfu', 'omfg', 'arse', 'ass',
  'idiot', 'stupid', 'moron', 'useless', 'garbage', 'trash', 'brain-dead',
  // German, because the author yells in two languages.
  'scheisse', 'scheiße', 'verdammt', 'blödsinn', 'bloedsinn', 'quatsch', 'mist',
];

// Phrases that mean "you already got this wrong once".
const CORRECTION = [
  'i said', 'i told you', 'i already said', 'as i said', 'like i said',
  'i just said', 'i asked you', 'i never asked', 'that is not what i',
  "that's not what i", 'not what i asked', 'not what i wanted',
  'you keep', 'you already', 'again you', 'once again', 'for the last time',
  'how many times', 'stop doing', 'stop changing', 'stop touching',
  'undo that', 'revert that', 'put it back', 'read the', 'did you even',
  'did you read', 'are you even', 'pay attention', 'focus',
  'ich habe gesagt', 'ich sagte', 'nicht was ich', 'schon wieder', 'hör auf',
  'hoer auf', 'lies mal', 'nochmal',
];

// Phrases that read as giving up / taking over.
const DESPAIR = [
  "i'll do it myself", 'i will do it myself', 'ill do it myself',
  'forget it', 'never mind', 'nevermind', 'give up', 'giving up',
  'you are hopeless', "you're hopeless", 'this is hopeless',
  'worse than useless', 'i give up', 'mach ich selbst', 'vergiss es',
];

// Flat rejections. Matched at the very start of the prompt only.
const NEGATION_START = [
  'no', 'nope', 'nein', 'stop', 'halt', 'wrong', 'falsch', 'wat', 'what',
  'why', 'warum', 'seriously', 'really', 'ugh', 'argh', 'aargh', 'omg',
];

// A short prompt that is *only* a rejection ("wrong again", "nope, still broken")
// is a reprimand even though it contains no correction phrase.
const REJECT_WORD = '(?:no|nope|nein|wrong|falsch|stop|halt|nah|negative|broken)';
const REJECT_QUALIFIER = '(?:again|already|still|once more|as well|too|nochmal|immer noch)';
const TERSE_REJECTION = new RegExp(
  `^\\s*(?:${REJECT_QUALIFIER}[\\s,.!?-]+${REJECT_WORD}|${REJECT_WORD}(?:[\\s,.!?-]+${REJECT_QUALIFIER})?)[\\s,.!?-]*$`,
  'i'
);

const WEIGHTS = {
  profanity: 3,
  correction: 2,
  despair: 4,
  negationStart: 1,
  terseRejection: 2,
  caps: 2,
  punctuation: 1,
  repetition: 2,
  rapidFire: 1,
};

// A single prompt can score at most this much, so one spectacular meltdown
// doesn't drown out the rest of the session.
const MAX_PROMPT_SCORE = 8;

// Below this, we don't consider the prompt a reprimand at all.
const RAGE_THRESHOLD = 2;

function normalize(text) {
  return String(text == null ? '' : text).toLowerCase();
}

/** Count how many needles appear in the (lowercased) haystack. */
function countMatches(haystack, needles, wordBoundary) {
  const hits = [];
  for (const needle of needles) {
    const found = wordBoundary
      ? new RegExp(`\\b${escapeRegex(needle)}\\b`).test(haystack)
      : haystack.includes(needle);
    if (found) hits.push(needle);
  }
  return hits;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ratio of A-Z characters among all cased letters. Ignores short prompts,
 * where "OK" or "TODO" would trip a naive check.
 */
function capsRatio(text) {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return 0;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return upper / letters.length;
}

/** Detects "!!!", "???", "?!" and friends. */
function punctuationBurst(text) {
  return /([!?])\1{1,}|\?!|!\?/.test(text);
}

/**
 * Strips code blocks and inline code before scoring. Pasting a stack trace
 * full of "FATAL" and "!!!" is not the same as being angry.
 */
function stripCode(text) {
  return String(text == null ? '' : text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

/**
 * Score a single prompt.
 *
 * @param {string} prompt Raw prompt text as submitted.
 * @param {object} [ctx]
 * @param {string} [ctx.previousPrompt] The previous prompt in this session.
 * @param {number} [ctx.secondsSincePrevious] Gap since the previous prompt.
 * @returns {{score:number, signals:Array<{name:string, weight:number, detail:string}>, isRage:boolean}}
 */
function scorePrompt(prompt, ctx) {
  const context = ctx || {};
  const raw = stripCode(prompt);
  const lower = normalize(raw);
  const signals = [];

  const profanityHits = countMatches(lower, PROFANITY, true);
  if (profanityHits.length) {
    signals.push({
      name: 'profanity',
      weight: WEIGHTS.profanity,
      detail: profanityHits.slice(0, 3).join(', '),
    });
  }

  const correctionHits = countMatches(lower, CORRECTION, false);
  if (correctionHits.length) {
    signals.push({
      name: 'correction',
      weight: WEIGHTS.correction,
      detail: `"${correctionHits[0]}"`,
    });
  }

  const despairHits = countMatches(lower, DESPAIR, false);
  if (despairHits.length) {
    signals.push({
      name: 'despair',
      weight: WEIGHTS.despair,
      detail: `"${despairHits[0]}"`,
    });
  }

  const firstWord = lower.trim().split(/[\s,.!?;:]+/)[0];
  if (firstWord && NEGATION_START.includes(firstWord)) {
    signals.push({
      name: 'negation-start',
      weight: WEIGHTS.negationStart,
      detail: `starts with "${firstWord}"`,
    });
  }

  if (TERSE_REJECTION.test(raw)) {
    signals.push({
      name: 'terse-rejection',
      weight: WEIGHTS.terseRejection,
      detail: 'rejection with no instruction',
    });
  }

  const caps = capsRatio(raw);
  if (caps > 0.6) {
    signals.push({
      name: 'caps',
      weight: WEIGHTS.caps,
      detail: `${Math.round(caps * 100)}% uppercase`,
    });
  }

  if (punctuationBurst(raw)) {
    signals.push({
      name: 'punctuation',
      weight: WEIGHTS.punctuation,
      detail: 'repeated !/?',
    });
  }

  if (context.previousPrompt) {
    const prev = normalize(stripCode(context.previousPrompt)).trim();
    const cur = lower.trim();
    if (prev && cur && prev.length > 10 && similarity(prev, cur) > 0.8) {
      signals.push({
        name: 'repetition',
        weight: WEIGHTS.repetition,
        detail: 'near-identical to previous prompt',
      });
    }
  }

  // A very short prompt fired seconds after the last one is usually a correction
  // ("no", "stop", "wrong file"), not a new request.
  const gap = context.secondsSincePrevious;
  if (typeof gap === 'number' && gap >= 0 && gap < 25 && cleanLength(raw) < 40) {
    signals.push({
      name: 'rapid-fire',
      weight: WEIGHTS.rapidFire,
      detail: `${Math.round(gap)}s after previous prompt`,
    });
  }

  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.min(total, MAX_PROMPT_SCORE);

  return { score, signals, isRage: score >= RAGE_THRESHOLD };
}

function cleanLength(text) {
  return String(text == null ? '' : text).trim().length;
}

/**
 * Cheap token-overlap similarity (Jaccard). Good enough to spot a user
 * re-sending the same instruction because it was ignored the first time.
 */
function similarity(a, b) {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared++;
  return shared / (setA.size + setB.size - shared);
}

/**
 * Map a RAGE-per-session figure onto the bands from the original post.
 */
function band(ragePerSession) {
  if (ragePerSession <= 2) {
    return { label: 'Great agentic workflow', emoji: '😌', tier: 0 };
  }
  if (ragePerSession <= 5) {
    return { label: 'Needs better prompting', emoji: '😐', tier: 1 };
  }
  return { label: "I'm doing the task myself", emoji: '🔥', tier: 2 };
}

module.exports = {
  scorePrompt,
  band,
  similarity,
  capsRatio,
  stripCode,
  RAGE_THRESHOLD,
  MAX_PROMPT_SCORE,
  WEIGHTS,
};
