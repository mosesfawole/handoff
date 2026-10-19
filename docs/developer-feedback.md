# Developer feedback

These notes distinguish observed friction from suggestions. They are a draft for the competition feedback fields, not a claim that any bonus will be awarded. No failures or time savings have been invented.

## Ring Developer Playground — active token after reload

- **Task:** Explore official APIs and simulator controls with a generated Playground token.
- **Steps:** Generate a token, configure the local server, reload the Playground page, then try Explore APIs / simulation while the token is still active.
- **Expected:** A supported way to resume API/simulator use with the active session, without exposing the token.
- **Actual:** The reloaded UI displayed an active hidden token but disabled the API/simulator controls and token generation until expiry. The already configured server token remained usable. The countdown was observed at roughly 12, 7 and 2 minutes remaining; after expiry, refreshed generation restored controls.
- **Severity/impact:** Development interruption while waiting for expiry; not an API outage or authentication failure.
- **Workaround:** Wait for expiry and generate a fresh token through the supported UI. No hidden-state token extraction was used.
- **Suggestion:** Provide a documented reattach/resume path or make session-loss behavior and recovery explicit before a reload.

## Ring API documentation and starter — history versus webhook examples

- **Task:** Normalize current event-history responses and signed webhooks consistently.
- **Steps:** Compare current [API documentation](https://developer.amazon.com/docs/ring/api-documentation.html) with the [official starter](https://github.com/AmazonAppDev/ring-api-helloworld) examples and comments.
- **Expected:** Samples clearly distinguish supported history polling, timestamp units and event type names from webhook payloads.
- **Actual:** Current history documentation uses epoch-millisecond `attributes.start/end` and types such as `motion`, `ding`, `on_demand`; webhook type names differ. A saved sample-route comment described history retrieval inconsistently with the current documentation.
- **Severity/impact:** Integration ambiguity requiring source/document cross-checking, not a confirmed API defect.
- **Workaround:** Follow the current reference, maintain separate normalizers, and preserve unknown types without inventing a motion classification.
- **Suggestion:** Align sample comments with the current API, and add adjacent history/webhook examples with explicit timestamp units and unknown-type behavior.

## npm 11.17 — allow-scripts notice during clean installation

- **Task/steps:** Run a clean `npm ci`, then `npm run build` from the source package.
- **Expected:** A reproducible install/build and clear indication whether dependency install scripts require action.
- **Actual:** npm warned that `esbuild@0.28.2` had an uncovered postinstall script. Installation still completed, and the production build passed without changing approvals or npm configuration.
- **Severity/impact:** Informational review requirement; no observed build blocker in this environment.
- **Workaround used:** None required for the verified build. The project scripts do not automatically grant script approval.
- **Suggestion:** Make the distinction between a warning and a blocked required build step explicit in the notice.

## Other tools used

| Tool/API/SDK | Observed use and feedback |
| --- | --- |
| Official MCP TypeScript SDK | Real initialization/tool discovery, authorized command and receipt round trips. No separate SDK defect established; preserve tested protocol/client examples in the project. |
| Node.js 24 built-in SQLite | Persistent local state and transactional task assignment. Experimental status is a runtime constraint, not a discovered defect; the npm commands suppress only that warning category. |
| React, TypeScript, Vite | Typed responsive UI and production build. No package defect established. Review found application-level state/UX issues; those are not attributed to framework APIs. |
| Express and Zod | Local HTTP routes and strict command validation. No specific developer-tool defect established. |
| Vitest | Domain, service, HTTP/MCP and Ring boundary verification. No specific defect established. |
| Playwright / installed Chrome | Workflow, screenshots, phone and focus checks. A previously referenced Chromium cache path was unavailable; using the documented executable override with installed Chrome worked. This was an environment path issue, not a demonstrated Playwright defect. |
| Codex | Assisted implementation, recovery, source review, documentation and verification. Human account/sign-in steps and publishing decisions remained outside automated completion. No fabricated user testing or live integration success was accepted. |

Update these entries only with additional observed evidence. Exclude secrets, account details, private receipts, and unsupported causal claims from submitted feedback.
