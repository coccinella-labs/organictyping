#!/usr/bin/env python3
# SPDX-License-Identifier: BSD-3-Clause
"""Synthetic-data baseline verifier (not validated against real human typing).

Default path loads core/model/artifacts/verifier.joblib + scaler.json and
classifies scaled 8-dim vectors. The legacy avg/pause heuristic is available
only via --heuristic and must not be cited as model accuracy.
"""
import json
import os
import sys

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
ART_MODEL = os.path.join(HERE, "artifacts", "verifier.joblib")
ART_SCALER = os.path.join(HERE, "artifacts", "scaler.json")


def heuristic(input_vector) -> bool:
    avg_interval = input_vector[0] if len(input_vector) > 0 else 100
    pause_count = input_vector[2] if len(input_vector) > 2 else 5
    return avg_interval > 80 and pause_count < 10


class Verifier:
    def __init__(self, model=None):
        if model is not None:
            self.model = model
            self.is_trained = True
            return
        if os.path.exists(ART_MODEL):
            self.model = joblib.load(ART_MODEL)
            self.is_trained = True
        else:
            self.model = RandomForestClassifier(n_estimators=10, random_state=42)
            self.is_trained = False

    def train(self, human_vectors, ai_vectors):
        # Train on labeled data
        X = np.vstack([human_vectors, ai_vectors])
        y = np.hstack([np.ones(len(human_vectors)), np.zeros(len(ai_vectors))])
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        self.model.fit(X_train, y_train)
        self.is_trained = True
        accuracy = self.model.score(X_test, y_test)
        print(f"Model trained with accuracy: {accuracy:.2f}")

    def verify(self, input_vector):
        # Trained synthetic-data baseline; heuristic only on explicit request.
        if not self.is_trained:
            raise RuntimeError(
                "No trained artifact found. Retrain via core/model/train.py "
                "or rerun with --heuristic for the legacy baseline."
            )
        prediction = self.model.predict([input_vector])
        return prediction[0] == 1  # 1 for human-like-synthetic


if __name__ == "__main__":
    use_heuristic = "--heuristic" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--heuristic"]
    if args:
        vector = json.loads(args[0])
    elif not sys.stdin.isatty():
        vector = json.loads(sys.stdin.read())
    else:
        print("Usage: verifier.py [--heuristic] '<vector-json>' (or stdin)", file=sys.stderr)
        sys.exit(2)
    if use_heuristic:
        print("Human" if heuristic(vector) else "AI")
    else:
        v = Verifier()
        print("Human" if v.verify(vector) else "AI")
