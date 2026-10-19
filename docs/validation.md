# Validation record

This record separates observed software checks from official account evidence and unverified claims. The final recovery verification completed on 19 October 2026 at 08:55 Europe/Berlin, after the three review corrections. The scoped independent re-review approved those corrections with no new Critical or Important finding in the fix diff.

## Final application verification

| Command/check | Observed result, 19 October 2026 |
| --- | --- |
| `npm.cmd test -- --run` | 4 files, 29 tests passed |
| `npm.cmd run build` | TypeScript check and Vite production build passed; 36 modules |
| `npm.cmd run test:e2e` with installed Chrome executable override | 13 browser tests passed, including the five new recovery regressions, 390px action placement, keyboard focus, receipt download, dispute/outage flows, SSE and MCP |
| `scripts/verify.ps1` from an unrelated working directory | Exit 0; all 29 unit tests, build/typecheck and 13 browser tests passed through the actual wrapper |

## Clean package baseline — `faa749c`

These separate checks used a clean source copy before the UI-only review corrections. The corrections did not change the backend, persistence or protocol contracts.

| Command/check | Observed result, 19 October 2026 |
| --- | --- |
| Clean source installation | `npm ci` completed; 217 packages installed. npm allow-scripts notice for esbuild did not block the build; no approval/configuration changes were made |
| Clean production build | TypeScript/Vite build passed |
| Clean package smoke check | 4 checks passed: built HTML/JavaScript served; replay overdue/claim without premature completion; task identity/owner/deadline survived restart; SDK MCP discovery/authorized outcome/JSON receipt with separate original-visit evidence |

The final application results are from the recovered original checkout; the clean checks used a separate source copy and isolated data. Fresh desktop and phone captures were visually inspected. Selected main text/button/status palette contrast ratios ranged from 4.61:1 to 13.01:1. This is not a complete accessibility conformance audit.

## Review corrections — verified and approved

Focused review subsequently reproduced three cases absent from the original eight browser tests:

1. A superseded disputed confirmation marked the confirmation step complete after a backup outcome.
2. An SSE replay reset while a claim dialog was open caused a null-task render crash.
3. A delayed command response replaced a newer SSE dispute with a stale resolved display.

All three were corrected. The confirmation indicator now follows the effective substantive account; recording dialogs are invalidated when their reviewed context changes; command/refresh results respect newer stream state and per-mode revisions. Five focused browser regressions passed, covering both backup/follow-up outcomes, reset-driven dialog invalidation, a stale same-mode confirmation and a stale cross-mode replay response. Those five tests are included in the final 13-test browser result, not additional to it. Independent scoped source/review-evidence inspection approved the fixes. The full verification then passed as recorded above.

## Official Ring evidence

The package includes the [sanitized recovered integration trace](evidence/recovered-ring-evidence.json), with event type, observation/receive times, and explicit limits. It contains no token or account/device identifier.

It also includes the [fresh official API trace](evidence/fresh-ring-evidence.json) from 19 October at 07:30:06.555 UTC. The fresh check returned one online Playground device and the same historical `on_demand` event. The application connection succeeded using an isolated database, retained the unknown classification, and footage/screens were captured for the demonstration. A 160-second narrated screen walkthrough is being assembled locally; no finished public video or submission is claimed.

| Evidence | What it establishes |
| --- | --- |
| 18 October 2026, 16:49:02.694 UTC | Actual authenticated official discovery/status/history; one online Playground simulator device, empty history |
| 19 October 2026, event at 05:47:14.040 UTC; saved app sync at 05:48:18.871 UTC | Official history `on_demand` event entered the separate live household as `source: ring`, `type: unknown`, preserving observation and receive times |
| Saved official inspection at 05:51:24.186 UTC; recovery inspection at 06:05:28.869 UTC | Recovery cross-checked the sanitized official evidence and saved local live snapshot without making another Ring request |
| Fresh official check at 07:30:06.555 UTC on 19 October 2026 | Successful discovery/status/history, one online Playground device, same `on_demand` event at 05:47:14.040 UTC; no claim of a newly generated motion event |

This is authenticated event ingestion. It is **not** proof of motion, a visitor, completed care, physical-device use, clinical effectiveness, or a public webhook delivery. Unknown classification is deliberate. Webhook HMAC verification and malformed/expired-token boundaries also have local fixture tests; fixtures do not establish live delivery.

## Reproducibility and test boundaries

- Node.js 24, the lockfile, and README commands define the tested runtime/setup. Browser tests need installed Playwright Chromium or a supported executable override.
- Default saved data is `data/handoff.sqlite`; test data and clean-install smoke databases are separate. Do not delete or reset saved connected data to run tests.
- SDK MCP round trips are real local protocol traffic. No Alexa session or public remote-client deployment is claimed.
- Consult the accompanying distribution manifest for the source archive's exact commit and entry checks. The archive is generated with `git archive`; distribution checks must confirm exclusion of populated credentials, SQLite data, node_modules, `.git`, and logs. Packaging verification is separate from the application results above.
- [Public source access](https://github.com/mosesfawole/handoff) is available for local evaluation. No external notifications, emergency dispatch, user interviews, pilot outcomes, market traction, production authentication, durable hosting, public video or competition submission are established.
