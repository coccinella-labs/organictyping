#!/usr/bin/env python3
# SPDX-License-Identifier: BSD-3-Clause
"""Organic encoder: TypingStats (8-dim) -> scaled vector.

Trained path loads core/model/artifacts/scaler.json (fitted on synthetic
train split, seed 42). Falls back to raw passthrough only when the artifact
is absent (dev/legacy); committed deployments use the trained scaler.
"""
import json
import os

import numpy as np
from sklearn.preprocessing import StandardScaler

ART_SCALER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "scaler.json")


def load_scaler() -> StandardScaler | None:
    try:
        with open(ART_SCALER) as f:
            params = json.load(f)
        scaler = StandardScaler()
        scaler.mean_ = np.array(params["mean"])
        scaler.scale_ = np.array(params["scale"])
        scaler.var_ = scaler.scale_**2
        scaler.n_features_in_ = len(params["mean"])
        return scaler
    except FileNotFoundError:
        return None


class OrganicEncoder:
    def __init__(self, scaler: StandardScaler | None = None):
        self.scaler = scaler if scaler is not None else load_scaler() or StandardScaler()

    def fit(self, stats_list):
        # Fit scaler on training data
        vectors = [self._to_vector(stats) for stats in stats_list]
        self.scaler.fit(vectors)

    def encode(self, stats):
        # stats: dict with keys: averageInterval, stdInterval, pauseCount, rhythmVector
        vector = self._to_vector(stats)
        if hasattr(self.scaler, "mean_"):
            return self.scaler.transform([vector])[0]
        else:
            return vector

    def _to_vector(self, stats):
        return np.array(
            [stats["averageInterval"], stats["stdInterval"], stats["pauseCount"]]
            + stats["rhythmVector"]
        )


if __name__ == "__main__":
    import json
    import sys

    stats = json.loads(sys.stdin.read())
    encoder = OrganicEncoder()
    vector = encoder.encode(stats)
    print(json.dumps(vector.tolist()))
