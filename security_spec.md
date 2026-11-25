# Security Specification — TUREK Global Leaderboard (`firestore.rules`)

## 1. Data Invariants
1. **Default-Deny Catch-All:** Every path outside explicitly matched collections is denied for both read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Append-Only Leaderboard (Immutability):** Once a leaderboard document is created in `/leaderboard/{entryId}`, it can NEVER be updated or deleted from client SDKs (`allow update, delete: if false;`).
3. **Zero PII Policy:** `/leaderboard/{entryId}` stores only public arcade nicknames and numeric gameplay scores. No emails, phone numbers, addresses, or private user fields are permitted (`hasOnly(['playerName', 'score', 'level', 'ambulancesHit', 'createdAt'])`).
4. **Strict Schema & Bounds Validation:**
   - `entryId`: strictly matches `^[a-zA-Z0-9_\-]+$` with length `1..128` (Path Variable Hardening).
   - `playerName`: `string`, length `2..16`, matches `^[\p{L}\p{N}_\-\. ]{2,16}$` (trimmed, no control characters or HTML/script tags).
   - `score`: `int`, `0 <= score <= 100000`.
   - `level`: `int`, `1 <= level <= 5`.
   - `ambulancesHit`: `int`, `0 <= ambulancesHit <= 10000` and `ambulancesHit * 5 <= score`.
   - `createdAt`: Firestore `timestamp` strictly equal to `request.time` (Temporal Integrity).
5. **Bounded List Queries:** `allow list` requires `existing().score >= 0` and `request.query.limit <= 50` so clients must explicitly query bounded leaderboard pages (`where('score', '>=', 0), orderBy('score', 'desc'), limit(20)`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Shadow/Ghost Field Injection (Create):** Valid payload plus extra field `isAdmin: true`.
2. **PII Injection (Create):** Valid payload plus extra field `email: "victim@example.com"`.
3. **Oversized Player Name (Denial of Wallet):** `playerName` with 200 characters (exceeds max 16).
4. **Empty / 1-Char Player Name:** `playerName: "A"` (below min 2).
5. **Malicious XSS / Control Chars in Player Name:** `playerName: "<script>alert(1)</script>"`.
6. **Negative Score Poisoning:** `score: -50`.
7. **Unbounded Score Overflow:** `score: 999999999` (exceeds max 100000).
8. **Float Type Poisoning:** `score: 42.5` or `level: 2.5` (not `int`).
9. **Invalid Level Out of Range:** `level: 99` (exceeds max 5).
10. **Impossible Ambulance Bonus Ratio:** `score: 10, ambulancesHit: 5` (`5 * 5 = 25 > 10`).
11. **Backdated / Forged Client Timestamp:** `createdAt: "2020-01-01T00:00:00Z"` or client timestamp != `request.time`.
12. **Tampering / Deletion / Path Poisoning:** Attempting `update` or `delete` on an existing `/leaderboard/{entryId}` document, or creating a document with a 200-char/invalid `entryId` (`bad$id!`), or writing to an undeclared collection `/admins/attacker`.
