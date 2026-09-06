<p align="center">
  <img src="https://raw.githubusercontent.com/Coccinella-Labs/organictyping/main/.github/assets/thumbnail.png" alt="organictyping" width="100%">
</p>

Organic typing signals make written text feel human and alive. Pauses, hesitations, and rhythmic bursts of keystrokes form patterns that reflect individual thinking styles, and without them, text can appear flat or artificially generated.

Similarly, phrasing variations, natural backtracking, and the flow formed by small timing irregularities help distinguish authentic human writing. They may even expose how someone organically structures ideas, pauses to reconsider, or lets thoughts unfold over time.

Recommendation

Capture fine-grained typing signals and preserve them as part of the writing profile.

## Privacy and Security

This project collects anonymized keystroke timing data for research purposes. See [PRIVACY.md](PRIVACY.md) for details on data handling, consent, and deletion rights. We prioritize user privacy by not storing raw keystroke sequences and providing opt-out mechanisms.

Example

In this example, the collector records each keypress with timing information. The raw data includes pauses, bursts of rapid typing, and small corrections. Normalizing these signals produces a rhythm vector that reflects the writer’s natural flow.

```ts
const event = {
  key: 't',
  down: 1052,
  up: 1120,
  pauseBefore: 320,
};
```

A more subtle pattern appears when multiple short pauses combine with minor backspaces. This sequence reflects hesitation and re-phrasing, shaping a richer organic signature:

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

These timing signals become inputs to an encoder, which embeds them into a latent representation. The vector allows a verifier to distinguish human typing from AI-generated text, and it enables a generator to reconstruct the writer’s natural cadence.

A similar process occurs when capturing long-form text. Extended pauses between sentences, shifts in pacing during complex thoughts, and recurring phrasing habits all contribute to a stable organic profile that evolves over time.

References

Organic Typing: Capturing Human Rhythm.
Keystroke Dynamics Research.
Timing-Based Behavioral Biometrics.

# Test comment
