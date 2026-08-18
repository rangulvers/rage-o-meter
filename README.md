# RAGE-o-meter

> **RAGE** — **R**eprimands **A**t **G**enerative **E**ntities per session.

Software engineering used to have one true code quality metric: **WTFs per minute.**

In the age of agentic development, we need an update.

> *"How many times did I yell at my agents before the task was done?"*

| RAGE/session | Verdict |
|---|---|
| **0–2** | 😌 Great agentic workflow |
| **3–5** | 😐 Needs better prompting |
| **6+**  | 🔥 I'm doing the task myself |

Finally, an AI benchmark you can trust.

**[→ rangulvers.github.io/rage-o-meter](https://rangulvers.github.io/rage-o-meter/)**

---

## What it actually does

It's a Claude Code plugin. A `UserPromptSubmit` hook scores every prompt you
send for signs of frustration, logs the ones that qualify, and `/rage` reads it
back to you.

```
  RAGE — this session
  ──────────────────────────────────────────────

  Reprimands : 3
  Rage score : 14
  Verdict    : 😐 Needs better prompting

  What set you off:
    correction        2  ████████████████████████
    negation-start    2  ████████████████████████
    rapid-fire        2  ████████████████████████
    punctuation       1  ████████████
    profanity         1  ████████████

  Peak rage (6):
    "ffs read the error message"

  RAGE — all time
  ──────────────────────────────────────────────

  Sessions with rage : 2
  Total reprimands   : 4
  RAGE/session       : 2.0  😌 Great agentic workflow

  Most infuriating projects:
    proj-alpha               3  ████████████████████████
    proj-beta                1  ████████
```

## Install

```bash
/plugin marketplace add rangulvers/rage-o-meter
/plugin install rage-o-meter@rage-o-meter
```

Then just work as normal. Type `/rage` whenever you want the damage report.

## How the scoring works

Every prompt is scored locally against a handful of signals. A prompt scoring
**2 or more** counts as one reprimand.

| Signal | Weight | Fires when |
|---|---|---|
| `despair` | 4 | "forget it", "I'll do it myself" |
| `profanity` | 3 | The classics, in English and German |
| `correction` | 2 | "I said…", "that's not what I asked", "stop changing…" |
| `terse-rejection` | 2 | A bare "wrong again" / "nope" with no instruction |
| `repetition` | 2 | This prompt is ~the same as your last one |
| `caps` | 2 | >60% uppercase (ignores short acronyms) |
| `negation-start` | 1 | Prompt opens with "no", "stop", "why", "ugh" |
| `punctuation` | 1 | `!!`, `???`, `?!` |
| `rapid-fire` | 1 | A short prompt fired <25s after the previous one |

A single prompt is capped at **8 points**, so one spectacular meltdown can't
dominate the whole session.

### Things it deliberately does *not* count

- **Code blocks and inline code are stripped before scoring.** Pasting a stack
  trace full of `FATAL` and `!!!` is not the same as being angry.
- **Short acronyms don't trigger the caps check.** `API`, `URL`, and `TODO` are
  not shouting.
- **`/rage` itself is never scored.** Checking your rage is not a rage event.

## Privacy

Everything is local. There are no model calls, no network requests, and no
telemetry of any kind.

- Data lives in `~/.claude/rage/events.jsonl`
- Only an **80-character excerpt** of a flagged prompt is stored — enough to jog
  your memory, not enough to dump a prompt full of secrets into a log file
- Calm prompts are never written to disk at all

```bash
# See everything it has on you
cat ~/.claude/rage/events.jsonl

# Wipe it
node scripts/report.js --reset --yes
```

## Usage

```bash
/rage                    # this session + all-time
```

Or directly, without Claude Code:

```bash
node scripts/report.js              # this session + all time
node scripts/report.js --all        # all time only
node scripts/report.js --json       # machine-readable
node scripts/report.js --reset --yes
```

### Turning it off

Set `RAGE_DISABLE=1` in your environment to make the hook a no-op, or disable
the plugin with `/plugin`.

To store data somewhere other than `~/.claude/rage`, set `RAGE_HOME`.

## Development

```bash
npm test
```

34 tests covering the scoring engine: false-positive guards for calm prompts,
true-positive coverage for angry ones, code-stripping, and the verdict bands.

## Caveats, honestly

This is a joke that happens to work. The scorer is a pile of heuristics, not a
sentiment model. It will miss dry, polite fury ("I see you've ignored the
instruction again") and it may occasionally flag an innocent "no, use the other
one". That's the tradeoff for it being fully offline and instant.

If it mis-scores something, the signal list in `/rage` tells you exactly which
rule fired, and the word lists live in [`lib/score.js`](lib/score.js).

## License

MIT

---

*Inspired by [the original WTFs/minute cartoon](https://www.osnews.com/story/19266/wtfsm/) by Thom Holwerda.*
