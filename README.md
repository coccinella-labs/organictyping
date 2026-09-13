<p align="center">
  <img src="https://raw.githubusercontent.com/Coccinella-Labs/organictyping/main/.github/assets/thumbnail.png" alt="organictyping" width="100%">
</p>

# Organic Typing

Captures anonymized keystroke timing to build organic typing signatures for research on human writing rhythm.

Pauses, bursts, corrections, and pacing variations form a stable behavioral trace. This repo collects timing metadata (not text content), normalizes it to rhythm vectors, and exposes encode / verify / generate helpers via CLI and GitHub App.

Status: maintenance mode (see [releases](https://github.com/coccinella-labs/organictyping/releases) for current version). No active feature development; maintenance and dependency fixes only.

## What is here

* `core/collector/`: terminal (`keylogger.ts`), Linux evdev (`linux-keylogger.ts`), macOS (`mac-keylogger.ts`)
* `core/processor/`: `normalize.ts` (intervals), `stats.ts` (avg/std/pauses/rhythm bins)
* `core/`: `anonymize.ts`, `sanitizer.ts`, `logger.ts` (privacy layer)
* `core/model/`: `organic-encoder.py`, `verifier.py`, `generator.py` (minimal / heuristic baseline)
* `go/collector/`: Go Linux keylogger sketch
* `ux/cli/organic-cli.ts`: `generate`, `verify`, `collect`
* `ux/github-app/server.ts`: PR analysis + `/api/consent`, `/api/export`, `/api/delete/:user`
* `docs/`: `overview.md`, `architecture.md`, `organic-signature.md`, `event-schema.json`
* `examples/`: `typing-samples.json`, `pr-example.txt`

## Quick start

```bash
npm install
npm run build
npm run lint
npm run test
npm run check  # lint + build + test + audit
```

CLI:

```bash
npm run dev -- generate "hello"
npm run dev -- verify examples/typing-samples.json
# collect writes keystroke JSON (10s window, platform keylogger required)
npm run dev -- collect out.json
```

Server (local):

```bash
GITHUB_APP_ID=... GITHUB_PRIVATE_KEY=... WEBHOOK_SECRET=... \
ENCRYPTION_KEY=... ENCRYPTION_SALT=... API_SECRET=... \
npm run server
```

## Privacy and Security

Timing metadata only, explicit opt-in. Aggregated rhythm vectors retained 12 months; raw logs purged after 7 days. Export/delete via authenticated `/api/export`, `/api/delete/:user`. No raw passwords / text stored. See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## Example

A single keypress carries timing with it:

```ts
const event = {
  key: 't',
  down: 1052,
  up: 1120,
  pauseBefore: 320,
};
```

A more subtle pattern appears when short pauses combine with minor backspaces. This sequence reflects hesitation and rephrasing, shaping a richer organic signature:

```ts
[
  { key: 'h', pauseBefore: 210 },
  { key: 'e', pauseBefore: 95 },
  { key: 'l', pauseBefore: 82 },
  { key: 'l', pauseBefore: 400 },
  { key: 'Backspace' },
  { key: 'l', pauseBefore: 180 },
  { key: 'o', pauseBefore: 70 },
];
```

These timing signals become inputs to an encoder, which embeds them into a latent representation. The vector lets a verifier score human rhythm against generated text, and it lets a generator reconstruct the writer cadence. The current `verifier.py` is a heuristic baseline until trained on larger datasets.

A similar process occurs with long form text. Extended pauses between sentences, shifts in pacing during complex thoughts, and recurring phrasing habits all contribute to a stable organic profile that evolves over time.

In code, normalized intervals feed `calculateStats` to `organic-encoder.py` to `verifier.py` (`Human` or `AI` when untrained).

## References

* `docs/overview.md`, `docs/architecture.md`, `docs/organic-signature.md`
* Keystroke dynamics / behavioral biometrics literature
