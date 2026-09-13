#!/usr/bin/env python3
# SPDX-License-Identifier: BSD-3-Clause
"""Train synthetic-data baseline: scaler + verifier. Deterministic.

Reads core/model/data/train.json and heldout.json (independently generated
seeds). Fits StandardScaler on train only, trains RandomForest, evaluates on
heldout, persists artifacts + synthetic-data baseline metrics.

Usage:
    python3 core/model/train.py
"""

import json
import os

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score
from sklearn.preprocessing import StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
ART = os.path.join(HERE, "artifacts")


def to_vector(stats: dict) -> np.ndarray:
    return np.array(
        [stats["averageInterval"], stats["stdInterval"], stats["pauseCount"]]
        + stats["rhythmVector"],
        dtype=float,
    )


def load_split(name: str) -> tuple:
    with open(os.path.join(DATA, name)) as f:
        records = json.load(f)
    X = np.vstack([to_vector(r["stats"]) for r in records])
    y = np.array([1 if r["label"] == "human-like-synthetic" else 0 for r in records])
    return X, y


def main() -> None:
    os.makedirs(ART, exist_ok=True)
    X_train, y_train = load_split("train.json")
    X_held, y_held = load_split("heldout.json")

    scaler = StandardScaler()
    Xtr = scaler.fit_transform(X_train)
    Xh = scaler.transform(X_held)

    clf = RandomForestClassifier(n_estimators=10, random_state=42)
    clf.fit(Xtr, y_train)
    pred = clf.predict(Xh)

    metrics = {
        "scope": "synthetic-data baseline metrics (not validated against real human typing)",
        "train_n": int(len(y_train)),
        "heldout_n": int(len(y_held)),
        "accuracy": round(float(accuracy_score(y_held, pred)), 4),
        "precision": round(float(precision_score(y_held, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_held, pred, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_held, pred).tolist(),
        "random_state": 42,
        "train_seed": 42,
        "heldout_seed": 999,
    }

    with open(os.path.join(ART, "scaler.json"), "w") as f:
        json.dump(
            {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
            f,
            indent=2,
        )
    joblib.dump(clf, os.path.join(ART, "verifier.joblib"))
    with open(os.path.join(ART, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
