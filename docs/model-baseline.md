# Model Baseline (synthetic data only)

Baseline is a reproducible synthetic-data classifier. It is not validated
against real human typing. Do not claim human-authentication accuracy or
biometric validity.

## Pipeline

`TypingStats` (8-dim: `averageInterval`, `stdInterval`, `pauseCount`,
`rhythmVector[5]`) → `StandardScaler` → `RandomForestClassifier
(n_estimators=10, random_state=42)` → `Human` (human-like-synthetic) or
`AI` (robotic-synthetic).

## Data

- Schema: `core/model/data/schema.json`. Records carry `label`
  (`human-like-synthetic` or `robotic-synthetic`), `source`
  (`synthetic-train` or `synthetic-heldout`), `session_id`, `seed`, `stats`.
- Generator: `core/model/data/generate_dataset.py` (deterministic; no network).
  Train split: seed 42, 120 per class (240 total). Held-out split: seed 999,
  40 per class (80 total), generated independently, never used for fitting.
- Committed fixtures: `core/model/data/train.json`, `core/model/data/heldout.json`.
- Regenerate: `python3 core/model/data/generate_dataset.py`, then
  `python3 core/model/train.py`.

## Training and artifacts

- `core/model/train.py` fits the scaler on train only, trains the forest,
  evaluates on held-out, writes `core/model/artifacts/scaler.json`,
  `verifier.joblib`, `metrics.json`.
- Inference loads artifacts: `organic-encoder.py` applies the fitted scaler and
  fails closed with `RuntimeError` when `artifacts/scaler.json` is missing;
  `verifier.py` classifies scaled vectors and fails closed without its model.
  Legacy heuristic is available only
  via `verifier.py --heuristic` and must not be cited as model accuracy.

## Synthetic-data baseline metrics

From `core/model/artifacts/metrics.json` (held-out, independently generated):

- accuracy 1.0, precision 1.0, recall 1.0, confusion `[[40, 0], [0, 40]]`
- train_n 240, heldout_n 80, random_state 42

These are synthetic-data baseline metrics. The classes are well separated by
construction, so perfect scores prove the pipeline works, not that it
recognizes real human typing.

## Limitations

- No real human data; no biometric validity; no production claims.
- Generator (`generator.py`) remains a stub; out of scope for this baseline.
- Collectors, platforms, realtime API, dashboards, and open datasets are
  explicitly out of scope.

## Privacy Impact Statement

This change adds synthetic timing aggregates only. No keystrokes, text,
passwords, or PII are collected or stored. Fixtures contain generated numbers
with no user association. No logging of user payloads was added. Existing
opt-in, retention (raw 7 days, vectors 12 months), and export/delete behavior
are unchanged.
