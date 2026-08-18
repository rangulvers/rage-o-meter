---
name: rage
description: Show your RAGE stats — Reprimands At Generative Entities per session. Use when the user types /rage or asks how much they have been yelling at their agents, how frustrated they have been, or for their rage score. Also handles /rage --share to produce a gallery card.
argument-hint: "[--share]"
disable-model-invocation: true
---

# RAGE

The user invoked: `/rage $ARGUMENTS`

## Report

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/report.js" --session "${CLAUDE_SESSION_ID}"`

## Share card

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/report.js" --share`

## Instructions

Both outputs above are already rendered. Pick **one** based on `$ARGUMENTS`:

- If `$ARGUMENTS` contains `--share` → print the **Share card** section.
- Otherwise → print the **Report** section.

Print the chosen one **verbatim** in a fenced code block so bars and alignment
survive. Ignore the other section completely — do not mention it.

Then add exactly one short line of commentary underneath — dry, self-aware, and
at your own expense. You are the generative entity being reprimanded here.

Rules:
- Do not recompute, reformat, or "improve" the numbers.
- Do not add headings, bullet summaries, or next steps.
- One line of commentary. Not two.
- If the count is 0, do not congratulate yourself too hard. It is early.
- For `--share`, remind them in that one line that `handle` and `caption`
  are theirs to edit before opening the PR.

The verdict bands come from the original joke:

| RAGE/session | Verdict |
|---|---|
| 0–2 | Great agentic workflow |
| 3–5 | Needs better prompting |
| 6+  | I'm doing the task myself |
