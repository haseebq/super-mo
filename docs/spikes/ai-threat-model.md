# Threat Model: AI-Driven Runtime Editing

Goal: identify abuse cases and required mitigations for AI-proposed runtime
changes in a browser-hosted game.

## Threats

- **Code injection**: malicious patches attempt to execute arbitrary JS.
- **XSS via assets**: SVG or HTML payloads with scripts or external refs.
- **Data exfiltration**: AI tries to leak player data or tokens.
- **Resource abuse**: infinite loops, runaway memory, or asset floods.
- **Supply chain**: poisoned templates or asset bundles.
- **Privilege escalation**: AI requests capabilities beyond its scope.

## Mitigations

- **Capability bounds**: strict allowlist of ops per capability.
- **Network egress rules**: no direct fetch from sandbox; CSP block.
- **Asset sanitation**: strip scripts, disallow external refs, validate tags.
- **Size/CPU limits**: max asset size, timeouts, and op rate limits.
- **Schema validation**: JSON schema + bounds for all diffs.
- **User approval**: human gate on every patch or asset replace.

## Monitoring + Kill Switch

- Per-request correlation IDs and patch logs.
- Detect spikes in failed validations or rate-limit hits.
- Toggle to disable AI features without redeploy.

## Open Questions

- Formal sandbox for script diffs (if ever allowed).
- Automated static analysis for SVG + script diffs.
