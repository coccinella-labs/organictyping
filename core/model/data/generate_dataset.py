#!/usr/bin/env python3
# SPDX-License-Identifier: BSD-3-Clause
"""Deterministic synthetic dataset generator (no real human data).

Privacy: emits aggregated timing stats only. No keystrokes, text, or PII.

Two independently generated splits:
- train (seed 42)
- heldout (seed 999, different stream, never used for fitting)

Usage:
    python3 core/model/data/generate_dataset.py
"""

import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))

N_TRAIN_PER_CLASS = 120
N_HELDOUT_PER_CLASS = 40


def gen_human_like(rng: random.Random) -> dict:
    # Varied pacing: mean 120-220ms, meaningful spread, occasional pauses,
    # rhythm mass spread across bins.
    avg = rng.uniform(120.0, 220.0)
    std = rng.uniform(25.0, 70.0)
    pauses = rng.choice([0, 0, 1, 1, 2, 3, 4, 6])
    total = 60
    spread = [rng.random() for _ in range(5)]
    s = sum(spread)
    rhythm = [max(0, round(total * x / s)) for x in spread]
    rhythm[0] += total - sum(rhythm)
    return {
        "averageInterval": round(avg, 2),
        "stdInterval": round(std, 2),
        "pauseCount": pauses,
        "rhythmVector": rhythm,
    }


def gen_robotic(rng: random.Random) -> dict:
    # Uniform/robotic: tight mean near 100ms, tiny spread, no pauses,
    # mass concentrated in the 100-200ms bin (index 1).
    avg = rng.uniform(95.0, 110.0)
    std = rng.uniform(3.0, 10.0)
    total = 60
    rhythm = [0, total, 0, 0, 0]
    return {
        "averageInterval": round(avg, 2),
        "stdInterval": round(std, 2),
        "pauseCount": 0,
        "rhythmVector": rhythm,
    }


def build_split(source: str, seed: int, n_per_class: int) -> list:
    rng = random.Random(seed)
    records = []
    for i in range(n_per_class):
        records.append(
            {
                "label": "human-like-synthetic",
                "source": source,
                "session_id": f"{source}-human-{i:03d}",
                "seed": seed,
                "stats": gen_human_like(rng),
            }
        )
    for i in range(n_per_class):
        records.append(
            {
                "label": "robotic-synthetic",
                "source": source,
                "session_id": f"{source}-robot-{i:03d}",
                "seed": seed,
                "stats": gen_robotic(rng),
            }
        )
    return records


def main() -> None:
    train = build_split("synthetic-train", 42, N_TRAIN_PER_CLASS)
    heldout = build_split("synthetic-heldout", 999, N_HELDOUT_PER_CLASS)
    with open(os.path.join(HERE, "train.json"), "w") as f:
        json.dump(train, f, indent=2)
    with open(os.path.join(HERE, "heldout.json"), "w") as f:
        json.dump(heldout, f, indent=2)
    print(f"wrote train={len(train)} heldout={len(heldout)}")


if __name__ == "__main__":
    main()
