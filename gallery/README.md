# The RAGE Gallery

A wall of other people's frustration. Add yours.

**[→ See the gallery](https://rangulvers.github.io/rage-o-meter/gallery.html)**

## How to submit

### 1. Generate your card

```bash
/rage --share
```

Or without Claude Code:

```bash
node scripts/report.js --share --handle YOUR_GITHUB_HANDLE --caption "what it did"
```

That prints a small JSON card. It contains **only counts, your verdict band, and
signal names** — never any text you actually typed. Write your own caption.

### 2. Add it as a file

Save it to `gallery/entries/<your-github-handle>.json`:

```json
{
  "handle": "rangulvers",
  "reprimands": 7,
  "sessions": 1,
  "ragePerSession": 7,
  "band": "I'm doing the task myself",
  "topSignals": ["correction", "caps", "despair"],
  "caption": "asked for one file. it refactored forty-seven."
}
```

### 3. Open a pull request

CI validates the entry automatically. Once it's merged, your card appears in the
gallery on the next Pages build.

## Rules

| Field | Rule |
|---|---|
| `handle` | Your GitHub username. Filename must match it. |
| `reprimands` | Integer ≥ 0 |
| `sessions` | Integer ≥ 1 |
| `ragePerSession` | Number, 0–1000 |
| `band` | Exactly one of the three verdict strings |
| `topSignals` | Up to 3, from the real signal list |
| `caption` | ≤ 120 chars, no HTML, no control characters |

Any field not on that list is **rejected** — that's deliberate, so a stray
`excerpt` or `prompt` key can never leak prompt text into a public repo.

One entry per person. Update your existing file rather than adding a second one.

## Keep it clean

Captions are public and permanent. Don't include:

- Real prompt text, file paths, or project names
- Client, employer, or colleague names
- Anything you wouldn't put on a conference slide

Be funny about the machine, not about a person. Entries that fail this get
closed rather than merged.
