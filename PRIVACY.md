# Privacy & Data Handling (Organic-Typing)

- Purpose: collect anonymized typing timing metadata only with explicit opt-in.
- What we store: aggregated rhythm vectors (means, stds, counts) and minimal metadata. We do NOT store raw typed text or password content.
- Retention: raw collection logs are purged after 7 days. Aggregated vectors retained for 12 months by default; users can request deletion earlier.
- Export & deletion: /api/export and /api/data endpoints (authenticated) allow export and full deletion.
- Contact: via GitHub issues on `coccinella-labs/organictyping` (do not include sensitive data).
