# Implementation decisions

| Decision | Purpose | Cost or limit |
| --- | --- | --- |
| Complete the approved visit-recovery scope | Deliver one coherent flow: expectation, uncertainty, ownership, outcome, receipt | No agency scheduling replacement, medical judgment or external dispatch |
| Dedicated local `handoff-build` repository | Isolate the new application where there was no parent repository | No existing upstream or deployed environment is assumed |
| Node.js 24 and built-in SQLite | Persist event history, deadlines and atomic assignment without an extra database service | SQLite's Node API remains experimental; local single-process prototype, not a scale claim |
| One shared service for UI and MCP | Keep command validation and state projection consistent | Demo UI roles are not production identity; MCP uses a separate bearer boundary |
| Deterministic fictional replay plus separate live household | Give evaluators a resettable credential-free workflow while preserving genuine provenance | Replay is not the official Ring simulator and cannot replace required official integration evidence |
| Ring via server-side documented HTTP | Use supported discovery, status/history and signed webhook normalization | No automatic OAuth refresh or public webhook host; short-lived token lifecycle needs manual setup |
| Keep observations separate from human claims | Avoid certifying care from camera activity; retain contradictory statements | A person must record the outcome; uncertainty is a visible product state |
| Restrict schedule changes after evidence | Keep confirmations attached to their original visit window | Single active visit; use replay reset for a different scenario, not silent rescheduling |
| First discovered device supplies headline coverage | Provide one understandable coverage status while retaining all device IDs | No camera-selection UI; other cameras cannot overwrite the selected device's coverage |
| Local MCP alternative | Expose real tools and an inspectable browser demonstration | No shipped Alexa integration; browser mutation schemas are shown without disclosing a bearer token |
| Local system fonts and custom SVG icons | Keep the interface self-contained and readable | No external asset CDN, stock photography or generated-person dependency |
| Source and scratch evidence kept separate | Keep tokens, databases, captures and logs out of the source archive | Verification evidence must be summarized honestly in the package; archive entries need a final check |
| Ordinary Node setup, no Docker/public deployment yet | Make local installation reproducible with the tested runtime | Durable judging access and deployment/authentication need an explicit final solution |

Review corrections preserve these decisions: only the effective confirmation can complete the confirmation step, stale server responses must not replace newer state, and dialogs must remain tied to the context the user reviewed. Their final verification status is recorded in [validation.md](validation.md).
