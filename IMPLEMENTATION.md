# Handoff Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task by task. Requirements are in the approved proposal. Steps use checkbox syntax for tracking.

**Goal:** Deliver a locally runnable, polished Handoff prototype with persistent visit evidence, explicit confirmations, accountable backup tasks, a Ring adapter, reproducible replay, and a working MCP fallback.

**Architecture:** A TypeScript React/Vite client communicates with an Express backend. A pure visit projection derives status from an append-only SQLite log; transactions serialize assignment and idempotent event ingestion. The real Ring adapter and labelled replay both produce normalized observations, while MCP tools use the same service as the UI.

**Tech Stack:** Node.js 24, TypeScript, React, Vite, Express, Node SQLite, Zod, the official Model Context Protocol TypeScript SDK, Vitest, Playwright.

**Spec:** Handoff-project-proposal.md, approved by the user on 18 October 2026.

## Global Constraints

- One fictional household in replay; all synthetic data is labelled. Local prototype, no production-authentication or deployment claims.
- Keep observed doorstep activity, human claims, visit status, and camera coverage distinct. Camera evidence never proves identity, completed care, or safety.
- No external messages, medical diagnosis, emergency dispatch, or facial recognition.
- All Ring API and OAuth calls are server-side; tokens come from environment variables and never enter browser bundles, receipts, logs, or git.
- Genuine webhooks require HMAC verification. Replay has a separate endpoint and cannot claim real provenance.
- A backup task has one owner. Acceptance does not resolve it. Claims that contradict each other create a dispute requiring explicit resolution.
- Persist records and deadlines. Duplicate/delayed input must not duplicate tasks or erase original timestamps.
- A paused labelled replay clock and a real-time mode are separate. A real Ring event cannot enter the replay household.
- MCP implements specification 2025-11-25 or later over Streamable HTTP. The browser tool experience is explicitly a local MCP demonstration, not a shipped Alexa+ integration.
- Bind to loopback by default. Same-origin checks and input validation guard local writes. Do not publish or push externally in this build.
- Keep the main deliverable under outputs/handoff; scratch reports, browser captures, and logs under work/.

## File map

- outputs/handoff/package.json, tsconfig*.json, vite.config.ts, index.html: reproducible project and verification commands.
- outputs/handoff/shared/types.ts: state, command, visit, actor, receipt, and evidence contracts.
- outputs/handoff/server/domain.ts: pure status and deadline projection.
- outputs/handoff/server/store.ts: SQLite transactions and append-only log.
- outputs/handoff/server/service.ts: command validation, scoped actions, replay scenarios, deadline evaluation.
- outputs/handoff/server/ring.ts: authenticated HTTP adapter and webhook normalization.
- outputs/handoff/server/mcp.ts: Streamable HTTP tools over the same service.
- outputs/handoff/server/app.ts and index.ts: validated HTTP API, worker, local server and static client.
- outputs/handoff/tests/: meaningful domain, persistence, API, Ring-boundary, and MCP integration tests.
- outputs/handoff/src/: focused React UI, API client, formatting, icons, and CSS.
- outputs/handoff/e2e/: real browser workflow and layout verification.
- outputs/handoff/docs/: runbook, demo script, submission draft, developer feedback, and limitations.

## Task 1: Persistent workflow and integration boundaries

**Files:** Create root configuration, shared/types.ts, server/*, tests/*, .gitignore, .env.example.

**Interfaces produced:**

HTTP GET /api/state returns AppState. POST /api/commands accepts Command and returns AppState. GET /api/receipt returns a structured receipt for the active visit. GET /api/events returns SSE updates. GET /api/integrations returns only redacted configuration and connection status. POST /api/ring/sync performs device discovery/status/history via configured server-side Ring token. POST /api/webhooks/ring verifies raw-body signature. POST /api/replay resets or advances labelled scenarios. /mcp handles Streamable HTTP.

AppState must include revision, mode (replay/live), currentTime (ISO), household, actors, visits with id/title/start/end/grace/backup plan, activeVisitId, derived status (scheduled/awaiting_confirmation/overdue/disputed/resolved), coverage (online/offline/unknown) with intervals, doorstep observations, human statements with actor/time/source, current task with owner/ETA/deadline/escalation, append-only timeline, metrics, and redacted integration status. Actors: family, resident, helper, coordinator. UI commands: set_visit, confirm_visit, report_not_happened, report_delay, claim_task, resolve_task, release_task. Replay commands: scenario (overdue/outage/disputed/normal), advance minutes, add doorstep event, toggle coverage. Validate exact command schemas and export them for consumers.

- [ ] Write failing tests with literal fixtures. Catch these breaks: doorstep event automatically completes care; outage sets missed; duplicate event creates a second action; second claimant steals ownership; contradiction closes a disputed visit; deadline disappears on restart; negative or invalid input is accepted.

```ts
expect(state.visits[0].status).toBe('awaiting_confirmation'); // after doorstep activity
expect(state.visits[0].status).toBe('overdue'); // deadline, without confirmation
expect(state.visits[0].coverage.status).toBe('offline'); // independent of visit status
expect(secondClaim.status).toBe(409); // another helper owns the task
```

- [ ] Run `npm test -- --run tests/domain.test.ts tests/service.test.ts` and record expected RED evidence before implementation.
- [ ] Implement pure projection, transaction store, service, fixtures, routes, and worker. Replay starts at 09:12 Berlin on 18 October; visit 09:00–09:15, confirmation due 09:25, helper response deadline 09:35. The overdue scenario advances via controls; task ownership and timestamps must survive refresh/restart. Live mode uses system time and never fictional evidence.
- [ ] Add boundary tests for Ring HTTP request construction, JSON:API decoding, expired token, offline device, malformed response, HMAC rejection, and unknown motion subtype. Use an injected local HTTP fixture transport only for external calls, and label it as an adapter test rather than live verification.
- [ ] Add MCP client-to-server roundtrip tests using the SDK Streamable HTTP client. Require bearer authentication for mutation tools through HANDOFF_MCP_TOKEN; read tools may expose fictional replay only in local mode. Live records require authentication. Test initialized protocol, list tools, read receipt, and authenticated claim/confirmation. Do not impersonate an Alexa session.
- [ ] Run tests and `npm run typecheck`, inspect output, commit this task, self-review, and write a report in work/handoff-build/task-1-report.md with RED/GREEN evidence and limitations.

## Task 2: Complete product experience and browser workflow

**Files:** Create src/App.tsx, src/api.ts, src/components/*, src/styles.css, e2e/workflow.spec.ts, playwright.config.ts; only change shared/server contracts after coordinating a specific mismatch.

**Interfaces consumed:** AppState and Command from shared/types.ts; the HTTP API from Task 1. No business-rule duplication in the client. Use returned state after commands and SSE updates.

**Product direction:** A calm, distinctive care coordination workspace. Warm cream background, deep ink typography, a restrained burnt orange brand accent, forest green for recorded completion, and amber for uncertainty. Use local system fonts, deliberate typography, generous spacing, custom simple SVG iconography, and a visit-centered timeline. No stock photography, generated people, gradients, decorative charts, or generic chat hero. Brand is Handoff with a two-link handoff mark.

Desktop: narrow left navigation, large central visit story and evidence timeline, right-side next-action and household plan. Show demo mode and clock clearly in the top bar. Mobile: one column, primary action first, accessible bottom navigation, no horizontal scrolling. Family, resident, helper and coordinator are explicit demo views, not authentication.

- [ ] Write a browser workflow test before implementation: reset overdue, advance beyond confirmation due, claim task as helper, record outcome, verify resolved receipt after reload. Also test outage copy and disputed resolution; no asserted CSS source text.

```ts
await page.getByRole('button', {name: 'Advance 15 minutes'}).click();
await expect(page.getByText('Confirmation overdue', {exact: true})).toBeVisible();
// helper action is accepted, then a person explicitly records the outcome
await expect(page.getByText('Outcome recorded', {exact: true})).toBeVisible();
```

- [ ] Observe RED before building the interface. Implement family, resident and helper flows with confirmation dialogs for substantive statements, explicit authors, event sources, and pending-action busy states. Avoid accidentally claiming acceptance as completion.
- [ ] Add editable visit timing and backup plan, usable demo scenario controls, time advance, coverage changes and doorstep event ingestion. Offer replay reset without destructive production data behavior. Display real integration configuration as configured/unverified/connected without exposing secrets; give local environment instructions.
- [ ] Implement evidence receipt view and download, household plan, metrics labelled as replay measurements, real error messages, and a local MCP tool explorer calling the actual server protocol through a same-origin demo path if supported. Voice remains optional; do not simulate natural-language intelligence with keyword matching.
- [ ] Run the browser workflow, desktop and 390px phone checks, keyboard focus checks, and contrast review. Save screenshots under work/handoff-build/ and copy one useful preview to outputs only if it is a deliverable.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and browser checks; commit, self-review and report in work/handoff-build/task-2-report.md.

## Task 3: Reproducible judging package

**Files:** README.md, LICENSE, docs/demo-script.md, docs/submission-draft.md, docs/developer-feedback.md, docs/validation.md, Dockerfile (only if needed for a reproducible host), scripts/start-local.ps1 and scripts/verify.ps1.

**Interfaces consumed:** Actual commands, schema, observed test evidence and limitations from Tasks 1–2; approved proposal; captured official rules.

- [ ] Write concise setup instructions for Node 24, install/build/start, demo reset, Ring token environment, HMAC configuration, and MCP clients. Production authentication and long-term hosting remain explicit gaps unless completed.
- [ ] Prepare a 2:40 demo script using actual UI controls and the three failure scenarios. Clearly mark the required genuine Ring roundtrip as pending unless performed with official account input.
- [ ] Prepare a submission draft focused on the concrete problem, audience, how it works, differentiation from care summaries, actual stack, and realistic impact. Include run/testing instructions and required feedback fields. No invented users or clinical results.
- [ ] Record actual developer friction from observed evidence. Do not claim AWS Builder eligibility; do not claim Open Source mini-challenge eligibility from the main repo license alone.
- [ ] Verify a clean install/build/start, receipt export, state persistence and MCP roundtrip. Consolidate exact test counts, commands, and known limitations in validation.md. Create a source archive excluding tokens, SQLite household data, node_modules, .git, and logs; verify archive entries.
- [ ] Commit and report in work/handoff-build/task-3-report.md.

## Final review and handover

- [ ] Request read-only review of requirements and implementation. Address material findings through the implementer and re-review focused changes.
- [ ] Re-run checks only when changes or unresolved concerns justify them. Open the local working app for the user.
- [ ] Report what works, exact verification evidence, and the unresolved official Ring/account/submission dependencies. Do not call the entry submitted or Ring-verified without evidence.

## Current decisions

- User approval covers the proposed product and implementation; no second design approval is needed.
- The workspace has no parent Git repository. A dedicated repository in outputs/handoff on branch handoff-build provides isolation without creating an unnecessary linked worktree.
- Official Ring token access is pending. Build the common workflow and real MCP fallback while the account question is pending; do not manufacture Ring integration success.
