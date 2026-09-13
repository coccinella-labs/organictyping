// SPDX-License-Identifier: BSD-3-Clause
import { execSync } from 'child_process';
import * as fs from 'fs';

const pythonCmd = 'python3';

function encode(stats: unknown): number[] {
  const result = execSync(`${pythonCmd} core/model/organic-encoder.py`, {
    input: JSON.stringify(stats),
    encoding: 'utf-8',
  })
    .toString()
    .trim();
  return JSON.parse(result);
}

function verify(vector: number[]): string {
  return execSync(`${pythonCmd} core/model/verifier.py`, {
    input: JSON.stringify(vector),
    encoding: 'utf-8',
  })
    .toString()
    .trim();
}

describe('Model Integration (synthetic-data baseline, not human-validated)', () => {
  it('should encode stats to scaled 8-dim vector deterministically', () => {
    const stats = {
      averageInterval: 100,
      stdInterval: 10,
      pauseCount: 0,
      rhythmVector: [0, 1, 0, 0, 0],
    };
    const v1 = encode(stats);
    const v2 = encode(stats);
    expect(Array.isArray(v1)).toBe(true);
    expect(v1.length).toBe(8); // 3 stats + 5 rhythm
    expect(v1).toEqual(v2); // deterministic
    // Trained scaler: output must differ from raw passthrough
    expect(v1).not.toEqual([100, 10, 0, 0, 1, 0, 0, 0]);
  });

  it('should fail closed when the scaler artifact is missing', () => {
    const code = [
      "import importlib.util",
      "spec = importlib.util.spec_from_file_location('enc', 'core/model/organic-encoder.py')",
      "mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)",
      "try:",
      "    mod.load_scaler('/nonexistent/scaler.json')",
      "    print('NO-RAISE')",
      "except RuntimeError:",
      "    print('RAISED')",
    ].join('\n');
    const out = execSync(`${pythonCmd} -c "${code}"`, { encoding: 'utf-8' })
      .toString()
      .trim();
    expect(out).toBe('RAISED');
  });

  it('should load committed artifacts', () => {
    expect(fs.existsSync('core/model/artifacts/scaler.json')).toBe(true);
    expect(fs.existsSync('core/model/artifacts/verifier.joblib')).toBe(true);
    expect(fs.existsSync('core/model/artifacts/metrics.json')).toBe(true);
    const metrics = JSON.parse(
      fs.readFileSync('core/model/artifacts/metrics.json', 'utf8')
    );
    expect(metrics.scope).toMatch(/synthetic-data baseline/);
  });

  it('should verify held-out human-like synthetic fixture as Human', () => {
    const heldout = JSON.parse(
      fs.readFileSync('core/model/data/heldout.json', 'utf8')
    );
    const rec = heldout.find(
      (r: { label: string }) => r.label === 'human-like-synthetic'
    );
    expect(rec).toBeDefined();
    expect(verify(encode(rec.stats))).toBe('Human');
  });

  it('should verify held-out robotic synthetic fixture as AI', () => {
    const heldout = JSON.parse(
      fs.readFileSync('core/model/data/heldout.json', 'utf8')
    );
    const rec = heldout.find(
      (r: { label: string }) => r.label === 'robotic-synthetic'
    );
    expect(rec).toBeDefined();
    expect(verify(encode(rec.stats))).toBe('AI');
  });
});
