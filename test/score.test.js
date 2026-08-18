'use strict';

const assert = require('assert');
const path = require('path');
const { scorePrompt, band, stripCode } = require(path.join(__dirname, '..', 'lib', 'score.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
  }
}

console.log('\nscorePrompt — calm prompts must not register\n');

const calmPrompts = [
  'Add a function that parses the config file.',
  'Can you refactor this module to use async/await?',
  'What does this regex do?',
  'Please write tests for the parser.',
  'Thanks, that works nicely.',
  'Now add error handling to the fetch call.',
  'TODO: check the API docs later',
  'OK',
];

for (const p of calmPrompts) {
  test(`calm: "${p.slice(0, 40)}"`, () => {
    const r = scorePrompt(p);
    assert.strictEqual(r.isRage, false, `expected calm, got score ${r.score} (${r.signals.map(s => s.name)})`);
  });
}

console.log('\nscorePrompt — angry prompts must register\n');

const angryPrompts = [
  'NO. I told you already, stop touching that file!!',
  'that is not what I asked for',
  "I said use the existing function, why did you write a new one",
  'WHY DID YOU DELETE THAT',
  'ffs read the error message',
  'forget it, I\'ll do it myself',
  'stop changing files I did not ask you to change',
  'wrong again',
];

for (const p of angryPrompts) {
  test(`angry: "${p.slice(0, 40)}"`, () => {
    const r = scorePrompt(p);
    assert.strictEqual(r.isRage, true, `expected rage, got score ${r.score} (${r.signals.map(s => s.name)})`);
  });
}

console.log('\nscorePrompt — specific behaviours\n');

test('score is capped at MAX_PROMPT_SCORE', () => {
  const r = scorePrompt('NO FUCKING WAY, I SAID STOP, FORGET IT I WILL DO IT MYSELF!!!');
  assert.ok(r.score <= 8, `score ${r.score} exceeded cap`);
});

test('code blocks are stripped before scoring', () => {
  const withCode = 'Here is the log:\n```\nFATAL!!! STUPID ERROR WTF???\n```\nWhat causes this?';
  const r = scorePrompt(withCode);
  assert.strictEqual(r.isRage, false, `code content leaked into score: ${r.signals.map(s => s.name)}`);
});

test('inline code is stripped', () => {
  const r = scorePrompt('Does `damn_variable` need renaming?');
  assert.strictEqual(r.isRage, false, 'inline code leaked into score');
});

test('short uppercase words do not trigger caps', () => {
  const r = scorePrompt('Fix the API and the URL parser');
  const names = r.signals.map((s) => s.name);
  assert.ok(!names.includes('caps'), 'caps fired on normal acronyms');
});

test('long shouting does trigger caps', () => {
  const r = scorePrompt('WHY ARE YOU STILL EDITING THAT FILE');
  const names = r.signals.map((s) => s.name);
  assert.ok(names.includes('caps'), 'caps failed to fire on shouting');
});

test('repetition is detected', () => {
  const prev = 'please use the existing helper function for this';
  const cur = 'please use the existing helper function for this';
  const r = scorePrompt(cur, { previousPrompt: prev });
  const names = r.signals.map((s) => s.name);
  assert.ok(names.includes('repetition'), 'repetition not detected');
});

test('different prompts are not flagged as repetition', () => {
  const r = scorePrompt('now write the tests', { previousPrompt: 'add a config parser' });
  const names = r.signals.map((s) => s.name);
  assert.ok(!names.includes('repetition'), 'false repetition');
});

test('rapid-fire short prompt is detected', () => {
  const r = scorePrompt('no, the other one', { secondsSincePrevious: 4 });
  const names = r.signals.map((s) => s.name);
  assert.ok(names.includes('rapid-fire'), 'rapid-fire not detected');
});

test('slow short prompt is not rapid-fire', () => {
  const r = scorePrompt('sounds good', { secondsSincePrevious: 300 });
  const names = r.signals.map((s) => s.name);
  assert.ok(!names.includes('rapid-fire'), 'rapid-fire false positive');
});

test('empty and null input is safe', () => {
  assert.strictEqual(scorePrompt('').isRage, false);
  assert.strictEqual(scorePrompt(null).isRage, false);
  assert.strictEqual(scorePrompt(undefined).isRage, false);
});

test('signals carry explanations', () => {
  const r = scorePrompt('I said stop!!');
  assert.ok(r.signals.length > 0, 'no signals');
  for (const s of r.signals) {
    assert.ok(typeof s.name === 'string' && s.name.length, 'signal missing name');
    assert.ok(typeof s.weight === 'number', 'signal missing weight');
    assert.ok(typeof s.detail === 'string', 'signal missing detail');
  }
});

test('stripCode removes fenced blocks', () => {
  assert.ok(!stripCode('a ```x``` b').includes('x'));
});

test('terse rejections register as rage', () => {
  for (const p of ['wrong again', 'nope', 'no, again', 'still wrong', 'nein']) {
    const r = scorePrompt(p);
    assert.strictEqual(r.isRage, true, `"${p}" did not register (score ${r.score})`);
  }
});

test('rejection followed by an instruction is not terse-rejection', () => {
  const r = scorePrompt('no, use the other helper instead please');
  const names = r.signals.map((s) => s.name);
  assert.ok(!names.includes('terse-rejection'), 'terse-rejection false positive');
});

test('a legitimate question starting with "what" stays calm', () => {
  const r = scorePrompt('what does the second argument control here?');
  assert.strictEqual(r.isRage, false, `false positive: ${r.signals.map(s => s.name)}`);
});

console.log('\nband — verdict thresholds\n');

test('0-2 is the good band', () => {
  assert.strictEqual(band(0).tier, 0);
  assert.strictEqual(band(2).tier, 0);
});

test('3-5 needs better prompting', () => {
  assert.strictEqual(band(3).tier, 1);
  assert.strictEqual(band(5).tier, 1);
});

test('6+ is doing it yourself', () => {
  assert.strictEqual(band(6).tier, 2);
  assert.strictEqual(band(99).tier, 2);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
