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
  "reprimands": 16,
  "sessions": 13,
  "ragePerSession": 1.2,
  "rageScore": 41,
  "band": "Great agentic workflow",
  "topSignals": [["correction", 13], ["profanity", 6], ["caps", 4]],
  "peakRage": "WTF",
  "signatureMove": "correction",
  "caption": "13 corrections for something that is supposed to understand language."
}
```

> **`peakRage` is text you actually typed.** `--share` pre-fills it from your
> angriest prompt so the card is honest. Read it before you open the PR, and
> delete the line if you'd rather not publish it. It's optional.

### 3. Open a pull request

CI validates the entry automatically. Once it's merged, your card appears in the
gallery on the next Pages build.

## Rules

| Field | Required | Rule |
|---|---|---|
| `handle` | yes | Your GitHub username. Filename must match it. |
| `reprimands` | yes | Integer ≥ 0 |
| `sessions` | yes | Integer ≥ 1 |
| `ragePerSession` | yes | Number, 0–1000 |
| `band` | yes | Exactly one of the three verdict strings |
| `topSignals` | yes | Up to 5 `[name, count]` pairs, from the real signal list |
| `caption` | yes | ≤ 120 chars, no HTML, no control characters |
| `rageScore` | no | Integer ≥ 0 |
| `peakRage` | no | ≤ 80 chars, no HTML, no control characters |
| `signatureMove` | no | One signal name |

Any field not on that list is **rejected** — that's deliberate, so a stray
`cwd` or `prompt` key can never leak into a public repo.

One entry per person. Update your existing file rather than adding a second one.

## Keep it clean

Captions are public and permanent. Don't include:

- Real prompt text, file paths, or project names
- Client, employer, or colleague names
- Anything you wouldn't put on a conference slide

Be funny about the machine, not about a person. Entries that fail this get
closed rather than merged.
