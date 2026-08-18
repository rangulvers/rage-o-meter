---
name: rage
description: Show your RAGE stats — Reprimands At Generative Entities per session. Use when the user types /rage or asks how much they have been yelling at their agents, how frustrated they have been, or for their rage score.
disable-model-invocation: true
---

# RAGE report

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/report.js" --session "${CLAUDE_SESSION_ID}"`

## Instructions

The report above is already rendered and complete. Print it back to the user
**verbatim**, inside a fenced code block so the bars and alignment survive.

Then add exactly one short line of commentary underneath — dry, self-aware, and
at your own expense. You are the generative entity being reprimanded here.

Rules:
- Do not recompute, reformat, or "improve" the numbers.
- Do not add headings, bullet summaries, or next steps.
- One line of commentary. Not two.
- If the count is 0, do not congratulate yourself too hard. It is early.

The verdict bands come from the original joke:

| RAGE/session | Verdict |
|---|---|
| 0–2 | Great agentic workflow |
| 3–5 | Needs better prompting |
| 6+  | I'm doing the task myself |
