# Handoff — project proposal for the Amazon Developer Hackathon

> **Historical design snapshot — 18 October 2026.** The original proposal below is preserved, including its then-current status and assumptions. Implementation and source publication have since progressed; see the [README](README.md) and [validation record](docs/validation.md) for current status. The public repository is [mosesfawole/handoff](https://github.com/mosesfawole/handoff).

Prepared 18 October 2026. Status: researched design proposal; application implementation has not started. Project name is provisional.

**Recommendation:** Build Handoff for the Ring track: a consent-based service that turns an expected home-care visit into a tracked commitment, detects when confirmation is missing, and follows an agreed backup plan until someone accepts responsibility and records the outcome.

**Pitch:** “When a care visit is overdue, who is actually making sure someone follows up?”

The product's central artifact is a visit receipt: what was expected, what was observed, what people confirmed, what remains unknown, and who owns the next action. A doorstep event is supporting evidence. It never proves identity, entry, completed care, or a person's safety.

## Why this problem

NICE's home-care quality standard explicitly calls for a plan for missed or late visits. Its rationale says an older person may be unable to alert others, and its recommended backup plan includes communication, emergency contact details, and arrangements for a family member, carer, or neighbour to visit instead. This is a documented operational need, not a problem invented to justify an AI interface. [NICE QS123, statement 2](https://www.nice.org.uk/guidance/qs123/chapter/Quality-statement-2-Plan-for-missed-or-late-visits).

Start with one audience: consenting families coordinating scheduled help for an older relative who already has a compatible Ring doorbell. The recurring question is whether an expected visit happened and, if it cannot be confirmed, whether someone is following up.

An initial family product is a more manageable prototype than replacing an agency's scheduling, billing, or electronic visit verification system. Agency integration is a later possibility. Demand for this specific product, willingness to pay, and acceptable notification frequency still require interviews.

## What is distinctive, and what already exists

Existing Ring care products already offer activity summaries, fall alerts, routine monitoring, and caregiver visibility. Beside Care advertises three daily digests and priority alerts. Remy advertises alerts, questions about the day, and caregiver visibility. Home-care software also already handles missed-visit workflows. Handoff must not claim to have invented those capabilities.

The proposed difference is the combination of an expected commitment, Ring evidence with explicit coverage limits, human confirmation, and a recorded recovery workflow. The valuable moment is the handoff of responsibility: an alert becomes an acknowledged task, an accepted task receives a deadline, and the task stays open until someone records an outcome. Even a reassuring camera event cannot close a disputed visit.

Public sources establish adjacent products, not exhaustive novelty or patent clearance. The hackathon gallery is not published yet, so competing submissions cannot currently be compared.

Sources: [Beside Care](https://www.besidecare.com/), [Remy's comparison of Ring care apps](https://www.remycamera.com/blog/ring-app-store-elder-care-apps.html) (a competitor-authored comparison), [iCare's missed-visit workflow](https://icareevv.com/resources/missed-late-visit-workflow), and [Medicaid EVV guidance](https://www.medicaid.gov/medicaid/home-community-based-services/guidance/electronic-visit-verification-evv).

## Alternatives considered

These are design judgments, not predicted judging scores or probabilities of winning.

| Approach | Real need and possible demo | Main tradeoff |
| --- | --- | --- |
| **Handoff — recommended** | Recover an overdue care visit; show evidence, a disputed confirmation, an accepted backup task, and recorded resolution. | Strong human story and meaningful Ring events; requires careful handling of uncertainty and a working official Ring demonstration. |
| **Clearway — Ring accessibility** | Check a user-marked entrance or ramp for visible obstructions before a wheelchair user approaches. Show an obstruction appearing and clearing. | Strong visual demo; reliable obstacle judgments depend on camera angle, footage, and a credible vision evaluation. Similar vision analytics already exist. |
| **Repair Relay — Alexa+** | Track a household repair promise, missed appointment, evidence, and a proposed next action across sessions. | Easy to demonstrate through an MCP server; weaker dependence on Amazon devices and substantial overlap with existing task and service tools. |

Handoff is the best balance of a specific problem, a memorable demonstration, platform fit, and a prototype that can be built in the remaining window.

## The first working product

Build one complete flow for one household and one scheduled visit. The three user surfaces are a family timeline, a simple resident confirmation screen, and a coordinator or backup helper task screen.

1. **Agree the visit.** Enter the expected time window and a backup plan approved by the resident and responsible contacts. Specify the primary contact, backup contact, grace period, and follow-up deadline. The prototype uses its own visit editor; external agency scheduling is a clearly labelled fixture unless actually integrated.
2. **Observe what Ring can provide.** Discover the selected device, check its status, receive supported doorstep events, and attach their timestamps to the visit. Device events are never treated as worker identity or completed care.
3. **Ask when confirmation is missing.** After the agreed grace period, create an overdue-confirmation task. Ask the responsible person to confirm, report a delay, dispute completion, or take the next action. Coverage gaps remain visible.
4. **Follow the backup plan.** A consented contact can accept the task and provide an ETA. If nobody accepts, or an accepted task passes its deadline, the task remains open and follows the next configured step. The prototype exercises this workflow inside its own app, with no pretend external texts, calls, or agency dispatch.
5. **Record the result.** A person explicitly confirms the visit or records another outcome. The receipt keeps claims and observations separate. Corrections append a new entry rather than rewriting history.

The optional voice extension exposes the same state through a real MCP server and a clearly labelled simulated Alexa+ experience. For example: “Has Mum's morning visit been confirmed?” or “I can check in at ten thirty.” It is added only after the Ring flow works.

## Evidence and behavior rules

Track visit status and camera coverage separately. A camera going offline must never rewrite a visit as missed or completed.

| Situation | Handoff's behavior |
| --- | --- |
| Doorbell or motion event near the expected window | Record doorstep activity; request human confirmation. |
| No visit confirmation by the agreed deadline | Show confirmation overdue; start the agreed follow-up. Absence of camera activity alone does not prove a missed visit. |
| Camera offline, revoked, or event history unavailable | Show a coverage gap and request confirmation. Do not issue a reassuring conclusion from missing evidence. |
| Resident says the visit did not happen; another person says it did | Mark the visit disputed and route it for human follow-up. Do not select a winner with an AI score. |
| A backup helper accepts | Record one responsible person and their deadline. Acceptance does not equal resolution. |
| Two people accept simultaneously | Commit one assignment atomically; tell the other who currently owns it. |
| Duplicate or delayed Ring event | Process idempotently, preserve observation time, and avoid duplicate tasks. |
| Explicit outcome confirmation | Append the confirmation with its author and time; close only the appropriate task. |

The central logic is a deterministic state machine. If AI is added, its useful roles are drafting a proposed plan from a conversation and translating an evidence receipt into plain language with references. Users review proposed plans. AI cannot invent confirmations, certify care quality, decide medical treatment, or infer that someone is safe.

## Architecture and integration

Use a TypeScript web application with a small backend and persistent storage. Keep the visit rules, Ring adapter, task assignments, and UI separate so the same event flow can be exercised with genuine Ring input and labelled replay input.

**Ring adapter:** server-side calls to the documented Amazon Vision API for discovery and device status, plus supported event ingestion or event-history retrieval. Use OAuth credentials or the documented short-lived Playground access token during development. Verify HMAC signatures for genuine webhooks and isolate replay ingress from authenticated production ingress. Ring has no official Partner SDK; standard HTTP calls are the supported path.

**Visit engine:** stores expected windows, confirmations, coverage intervals, and follow-up deadlines. It derives open actions from those records. A scheduled worker handles deadlines after app restarts; notifications are idempotent.

**Task and receipt store:** persists household-scoped records and an append-only activity log. Assignments use atomic updates. The demo uses synthetic names and explicit demo roles; production authentication and household isolation must not be represented as complete until implemented and checked.

**UI:** accessible controls, clear focus, large confirmation buttons, and text as well as color for status. Show one current action prominently and explain its source. Use an evidence timeline rather than a wall of generated paragraphs.

**Replay:** clearly labelled synthetic or captured simulator data sent through the same normalization and visit engine. Judges can reset the scenario without credentials. A replay does not substitute for demonstrating the actual required Ring technology.

**Optional MCP:** Streamable HTTP implementing MCP specification 2025-11-25 or later. Tools read receipts and make scoped, authorized updates to the same backend. A browser experience must be labelled simulated Alexa+; do not imply a shipped Alexa integration.

Sources: [Ring API reference](https://developer.amazon.com/docs/ring/api-documentation.html), [official Ring starter](https://github.com/AmazonAppDev/ring-api-helloworld), [Ring getting started](https://developer.amazon.com/docs/ring/get-started.html), and [Ring knowledge MCP](https://developer.amazon.com/docs/ring/ring-mcp.html).

## First feasibility checkpoint

The competition permits an official Ring simulator and an organizer confirms Playground simulated streams can appear in the demo. The public starter documents approximately 30-minute Playground tokens. Documentation also contains a physical-device prerequisite alongside sandbox references; the exact account and simulator access path has not been verified in this user's account.

Before spending substantial time on Ring-specific implementation, verify that a free developer account can expose a synthetic device and return a successful supported Ring API call. Save a sanitized integration trace and record simulator operation in the video. The user must complete any sign-in or identity steps personally; API secrets belong in server environment variables and never in the submitted repository.

If official Ring input is unavailable promptly, retain the visit engine and make the primary submission a real Alexa+ MCP integration with a simulated web experience. Clearly label replay evidence; do not present a homemade event generator as an official Ring simulator or claim Ring-track eligibility without the required demonstration.

No AWS account or credits are assumed. The resources page says hackathon credit codes ran out on 7 October. A locally useful prototype and replay can be built first; a public demo host is a later deployment decision.

## A demo under three minutes

Target 2 minutes 40 seconds. Use synthetic participants and a labelled simulator/replay. These scenes demonstrate product behavior, not clinical effectiveness.

| Time | What judges see |
| --- | --- |
| 0:00–0:18 | A scheduled morning visit. The opening question: “When a care visit is overdue, who is actually making sure someone follows up?” |
| 0:18–0:45 | The official Ring integration returns device data and a simulator event. Doorstep activity appears, but the visit remains unconfirmed. |
| 0:45–1:20 | Advance the labelled demo clock. The deadline passes; a confirmation is disputed or absent. An actionable follow-up appears with the evidence that triggered it. |
| 1:20–1:55 | A backup contact accepts, records an ETA, and explicitly records the outcome. The family timeline displays the handoff and resolution. |
| 1:55–2:18 | Reset to a camera-offline case. Handoff says coverage is unknown and requests confirmation instead of making a false claim. |
| 2:18–2:40 | Show the receipt, the reproducible replay, the Ring integration, and a concise explanation of who benefits. |

If the voice extension is ready, replace a click sequence with a voice interaction; do not lengthen the video beyond the limit.

## Evidence needed to make this competitive

Validate the useful outcome: time until a responsible person accepts, time until an outcome is recorded, unresolved-task rate, and unnecessary follow-ups. Measure these on labelled scenarios and report them as prototype measurements. Do not fabricate customer impact, reduced hospital admissions, fall accuracy, or market traction.

Run meaningful scenario checks for normal confirmation, overdue confirmation, disputed confirmation, camera outage, delayed/duplicate events, simultaneous task acceptance, and persistence across restarts. Check accessibility and the complete flow on phone-sized and desktop screens. Record the actual Ring round trip separately from replay-only checks.

Aim for three to five short conversations with family carers or a care coordinator. Test whether they understand “unconfirmed” versus “missed,” whether the backup action is appropriate, and whether they know who currently owns it. The user can arrange these; no outreach is sent without explicit authorization. If interviews are unavailable, state that user validation remains pending.

The rules equally weight technical implementation, design, potential impact, and idea quality. Technical implementation is the first tiebreaker. An impressive concept needs a working, inspectable workflow and an unmistakable required-technology demonstration.

## Submission and prize strategy

**Primary:** Ring, subject to the first feasibility checkpoint. Ring first prize is $12,000 cash. Fire TV and Alexa+ first prizes are each $25,000 plus $15,000 AWS credits. These amounts do not establish which track is easier to win; participant distribution and unpublished entries are unknown.

**Optional extra:** Open Source. Extract an additional reusable expected-event engine with coverage gaps, deterministic time, and replay cases into a separately identifiable licensed public contribution. Main-project licensing alone is not the extra contribution required by this mini challenge. Document its contribution URL, main repository URL, GitHub username, and usefulness to other developers. Do this only when the main demo is secure.

**AWS Builder:** optional if access is available and the integration improves the product. Document actual services or qualifying Kiro Crew usage. Do not claim eligibility because the README names AWS or because a remote documentation tool happens to use Bedrock internally.

A project may win one track prize and one mini-challenge prize. Keep the core entry focused.

Required deliverables are the working demonstration, a GitHub repository with all source/assets/run instructions and appropriate access or license, an English public YouTube/Vimeo video under three minutes, the project description, selected tracks/challenges, and specific feedback on every tool/API/SDK used. The project must remain accessible for evaluation through the end of judging on 20 November 2026.

Maintain an honest friction log as work happens. The official rules allow up to a 10% judging bonus for useful entries. A valid entry names the task, exact steps, expected and actual result, severity, workaround, and actionable suggestion. Do not invent failures for bonus points.

An organizer specifically confirmed that labelled replay by default is acceptable, but judges should not have to supply their own Playground tokens to try the project. This clarifies replay presentation; it does not eliminate the track's technology requirement.

Sources: [official rules](https://amazonappdev2026.devpost.com/rules), [resources and credit update](https://amazonappdev2026.devpost.com/resources), [organizer's replay clarification](https://amazonappdev2026.devpost.com/forum_topics/45541-ring-playground-replay-mode-for-judging-ring-media-in-public-videos-and-simulated-alexa-wording), and [strong submission tips](https://amazonappdev2026.devpost.com/updates/46538-strong-submission-tips).

## Build window

The submission deadline is Friday **23 October 2026, 19:00 UTC / 21:00 Europe/Berlin**. The rules state 12:00 Pacific Time, consistent with that conversion. This schedule assumes the design is approved promptly and required account access is available.

| Date, Berlin time | Required outcome |
| --- | --- |
| 18 October | Approve scope; verify official Ring simulator/API access; finalize the minimal implementation plan. |
| 19 October | Complete the Ring-to-visit-engine path and persistent visit receipt. |
| 20 October | Complete confirmation, backup acceptance, deadline handling, and phone UI. |
| 21 October | Finish replay, failure scenarios, accessibility checks, and any available user feedback. Add voice only if the core is stable. |
| 22 October | Freeze scope; record the demo; prepare repository, documentation, feedback, and any extra contribution. |
| 23 October | Verify the full submission and submit before an internal 18:00 Berlin cutoff, leaving three hours of buffer. |

The published office-hours session on 19 October is 18:00–19:00 Berlin time, useful for simulator access questions. [Office hours](https://amazonappdev2026.devpost.com/updates/46771-office-hours-schedule).

## Design decision for review

Approve a Ring-first Handoff prototype with expected visits, explicit human confirmation, camera-coverage status, backup-task ownership, persistent receipts, and an accessible replay demo. Keep voice and additional open-source work optional until the core is reliable. Switch the primary track to Alexa+ only if the official Ring access checkpoint fails.

This proposal is ready for a build decision. No application, live integration, customer validation, deployment, or submission has yet been completed.
