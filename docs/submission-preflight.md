# Competition preflight — not submitted

Deadline: **23 October 2026, 19:00 UTC / 21:00 Europe/Berlin**. Use an internal 18:00 Berlin cutoff for the final review. Required evaluation access must remain available through the end of judging on **20 November 2026**. Recheck the live rules before publishing/submitting; the facts below were captured during project preparation.

| Item | Current state / final action |
| --- | --- |
| Working application | Local source/replay implemented; review corrections approved; final 29 unit tests, 13 browser tests and build/typecheck passed |
| Required Ring technology | Fresh official check succeeded 19 October at 07:30:06.555 UTC; one online Playground device returned the same historical `on_demand` event. Isolated application connection and footage/screens captured; describe the event as unknown activity, not a new motion event or visitor |
| Source access | [https://github.com/mosesfawole/handoff](https://github.com/mosesfawole/handoff) — public, MIT licensed, default branch `handoff-build`; source/assets/run instructions included |
| Public video | [Published on YouTube](https://youtu.be/LxP-aSjzIEY), 2:40, with publication confirmed on 19 October 2026. YouTube's copyright check reported "No issues found". Anonymous metadata access and watch-page playback start are verified; the player reported 160.021 seconds. The local SHA-256 is recorded in [demo-script.md](demo-script.md) |
| Evaluation access | Local evaluation from public source: follow [README setup](../README.md#run-locally) and run fictional replay without a judge-supplied token. No hosted public application yet; maintain source access through judging |
| Description and stack | Saved in [submitted Devpost entry **1246362**](https://devpost.com/software/handoff-5f1j8d), with source, gallery, cover, video URL and required answers. The rendered page displays the story, source and correct video embed |
| Tracks/challenges | Ring selected; AWS Builder and Open Source mini-challenges are not entered |
| Feedback fields | Technical additional-information fields are saved. Check their observed tool/API/SDK feedback against developer-feedback.md before submitting |
| License and assets | MIT file included; verify all submitted source/assets and dependency notices are appropriate |
| Sanitization | Inspect source archive entries: no populated `.env`, tokens, databases, node_modules, `.git`, logs, private media or personal receipts |
| Final functional check | Clean install/build and four production/receipt/MCP/restart smoke checks passed; final full application verification passed. Match the distributed source ZIP to its accompanying manifest |
| Final submission | **Confirmed 19 October 2026**. The entrant accepted the final agreement. Devpost displayed “Project submitted!” and the project page lists the hackathon under “Submitted to” |

The four equally weighted criteria are technical implementation, design, potential impact and idea quality; technical implementation is the first tiebreaker. Specific developer friction may qualify for a bonus up to 10%, but no score is promised. One track prize and one mini-challenge prize may be awarded to an entry under the rules. Main-project licensing alone is not the additional Open Source contribution, and AWS credits/services are not assumed.

## Official references

- [Rules](https://amazonappdev2026.devpost.com/rules)
- [Resources and credit update](https://amazonappdev2026.devpost.com/resources)
- [Organizer clarification on replay and simulator presentation](https://amazonappdev2026.devpost.com/forum_topics/45541-ring-playground-replay-mode-for-judging-ring-media-in-public-videos-and-simulated-alexa-wording)
- [Strong submission tips](https://amazonappdev2026.devpost.com/updates/46538-strong-submission-tips)
- [Ring API documentation](https://developer.amazon.com/docs/ring/api-documentation.html)

Source and YouTube publication are complete; anonymous video metadata access and watch-page playback start are verified. The Devpost submission is confirmed, including its video URL and uploaded source ZIP. No hosted application is claimed; source and video support evaluation. Keep both accessible through judging.
