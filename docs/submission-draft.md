# Submission draft — Handoff

**Status:** Devpost draft **1246362** exists, with story, stack tags, source and gallery fields saved; the entry has not been submitted. [Draft preview](https://devpost.com/software/handoff-5f1j8d). The [source repository is public](https://github.com/mosesfawole/handoff), with local evaluation instructions in the README. A 160-second English narrated demonstration is complete locally, but public video upload and a hosted application remain unavailable. Use the preflight before final submission.

**Tagline:** When a care visit is unconfirmed, make the next action somebody's responsibility.

## Inspiration and audience

Families coordinating scheduled help for an older relative can face a simple but consequential uncertainty: a visit was expected, but nobody has confirmed it. An alert alone does not establish who is following up. NICE's [home-care guidance on missed or late visits](https://www.nice.org.uk/guidance/qs123/chapter/Quality-statement-2-Plan-for-missed-or-late-visits) describes the need for agreed backup communication and replacement contacts. Handoff explores that workflow for consenting households using Ring evidence as supporting context.

## What it does

Handoff records one expected visit, its confirmation deadline and an agreed backup plan. Doorstep observations, camera coverage and human statements are distinct. If confirmation is overdue or statements conflict, one follow-up task opens. A helper accepts responsibility and an ETA, then separately records the outcome. A timestamped receipt retains observations, authors, earlier claims, task ownership, and what remains unknown.

The replay demonstrates missing confirmation, a camera outage and a disputed account. It is explicitly fictional and needs no judge-supplied Ring token. Connected household records remain separate from replay.

## How we built it

The prototype uses TypeScript, React and Vite, with an Express backend, Zod validation and Node.js 24 SQLite persistence. An append-only event log and deterministic projection keep deadlines and human outcomes consistent across refresh/restart. Atomic assignment prevents competing acceptances from creating two owners.

The Ring adapter calls the documented Amazon Vision API server-side, normalizes history and verifies HMAC at webhook ingress. Official account evidence confirms one discovered simulator device and a history event of type `on_demand`, retained conservatively as unknown Ring activity. This verifies event ingestion; it does not prove motion, a visitor, completed care, or deployed public webhook delivery.

The official MCP TypeScript SDK serves actual Streamable HTTP tools over the same service. Read tools expose fictional replay anonymously; mutations and connected records require bearer authorization. The browser explorer is labelled a local MCP demonstration, not a shipped Alexa integration.

## What is distinctive

Ring care summaries/alerts and agency missed-visit systems already exist. Handoff's focus is the visible handoff of responsibility: expected commitment → missing or disputed confirmation → one owner → explicitly recorded outcome. A reassuring event or a helper's acceptance cannot stand in for completed care, and a backup check-in does not establish that the original provider visited.

## Challenges and learning

The main implementation work was preserving the distinction between observations and claims, maintaining one task owner, handling delayed/duplicate inputs, and carrying evidence through camera outages and contradictory statements. Separate replay and live records make the prototype reproducible without pretending that synthetic events came from Ring. Specific observed developer friction is documented in [developer-feedback.md](developer-feedback.md).

## Validation and next steps

Unit and browser checks cover deadlines, disputes, persistence, ownership, Ring boundaries, MCP, receipt export, phone layouts and keyboard focus. Final recovery verification passed 29 unit tests, 13 browser tests and the production build/typecheck; the three review corrections also received independent scoped approval. The initial clean package passed four production/receipt/MCP/restart smoke checks. See [validation.md](validation.md) for exact evidence and limits, and the distribution manifest for the released archive's commit and exclusions.

No user interviews, pilots, clinical effects, adoption figures or willingness-to-pay results have been established. The displayed timings are labelled prototype/replay measurements. Next steps are user research, authenticated household access, consent controls, appropriately designed notifications, token lifecycle management and durable evaluation hosting.

## Entry fields to finalize

| Field | Draft value |
| --- | --- |
| Project name | Handoff |
| Main track | Ring proposed; confirm current entry requirements and final official API demonstration |
| Repository | [https://github.com/mosesfawole/handoff](https://github.com/mosesfawole/handoff) — public, MIT licensed; default branch `handoff-build` |
| Public English YouTube/Vimeo video under three minutes | **Pending public URL**; the English narrated screen walkthrough is complete and verified locally at 160 seconds. Upload remains blocked by the browser extension's file-URL access setting |
| Working evaluation access / demo URL and instructions | Clone/download the public source and follow [README setup](../README.md#run-locally). Fictional replay requires no Ring token. No hosted application URL is available |
| Tools/API/SDK feedback | Use the specific entries in developer-feedback.md |
| AWS Builder mini challenge | Not claimed; no qualifying AWS/Kiro contribution established |
| Open Source mini challenge | Not claimed; the main MIT license alone is not the additional identifiable contribution |

Install/run instructions are in the README. No submission has been made, and no prize or track eligibility is guaranteed by this draft.

Fresh official API verification succeeded on 19 October 2026 at 07:30:06.555 UTC: one online Playground device returned the same `on_demand` event observed at 05:47:14.040 UTC. The application connection succeeded with isolated data, storing the event conservatively as unknown activity, and footage/screens were captured. The [sanitized trace](evidence/fresh-ring-evidence.json) records the API result. The local narrated video is complete; public upload remains unfinished. This milestone does not establish a new motion event or a visitor.
