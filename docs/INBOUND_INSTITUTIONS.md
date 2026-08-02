# Institutions come to us — GTM doctrine

Zakai does **not** run an outbound sales desk calling banks, insurers, or utilities.

The product is built so that when a risk team, platform engineer, or regulator-adjacent
contact **already** has the problem ("how do we verify consumer AI agents?"), they find
Zakai through public infrastructure — not through a cold call.

## Magnets (what we ship in the open)

| Magnet | URL / artifact | Who discovers it |
|--------|----------------|------------------|
| Mandate discovery | `/.well-known/zakai-mandate.json` | Security architects, fintech eng |
| Trust registry | `/.well-known/zakai-trust-registry.json` | Anyone implementing verify |
| Integration checklist | `/integrations` | Engineer evaluating in 30 minutes |
| Readiness (no secrets) | `/api/network/readiness` | Agents + partner onboarding |
| Opportunity map | `/api/network/opportunity-map` | AI platforms routing users |
| MCP binary | `zakai-mandate-mcp` | Cursor, Claude Desktop, internal AI tools |
| `llms.txt` | `/llms.txt` | ChatGPT, Claude, Gemini browsing |
| Documented outcomes | `/companies`, `/proofs` | Compliance / "show me it works" |
| Conformance vectors | `reference/`, test-vectors APIs | Teams that won't trust slides |

## What we do when they arrive

- `/institutions` — ROI calculator, delegation apply, lead form (**inbound only**).
- `docs/BANK_OUTREACH.md` — **reply templates** when someone writes first, not cold scripts.

## What we never do

- Promise callbacks or "we will call you."
- Claim regulatory approval we do not have.
- Outbound dial lists to bank innovation labs.

Consumer loop stays the proof engine: every documented saving on `/proofs` is marketing
that institutions can verify without a sales meeting.
