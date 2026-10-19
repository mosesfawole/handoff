# Handoff — 2:40 recording script

This is a recording plan, not evidence that a video has been produced. Use fictional participants throughout and record the English narration with a public YouTube/Vimeo cut shorter than three minutes. Hide credentials and account details before recording.

Fresh official API verification succeeded on 19 October at 07:30:06.555 UTC, and actual integration footage/screens have been captured. The check returned one online Playground device and the same `on_demand` history event observed at 05:47:14.040 UTC; the isolated application retained its `unknown` classification. Do not label that event new motion or a visitor, or substitute the homemade replay for the official simulator/API. The 160-second narrated walkthrough is being assembled locally; final public video delivery remains pending. See the [sanitized fresh trace](evidence/fresh-ring-evidence.json).

| Time | Screen action | Suggested narration |
| --- | --- | --- |
| 0:00–0:18 | Today, Family view, Missing confirmation replay at 09:12. | “A morning care visit is unconfirmed. The family needs to know who will follow up if confirmation does not arrive. Handoff turns that uncertainty into one accountable task, and keeps camera evidence separate from what people confirm.” |
| 0:18–0:43 | Integrations → Check Ring connection, with an authorized official token already configured server-side. Show discovered device, verification time, and the actual observed event if available. | “This connection uses the official Ring API. Our verified history returned an on-demand event, stored conservatively as unknown activity. That is event ingestion, not proof that a visitor arrived or care happened.” |
| 0:43–1:05 | Return to fictional replay → Start fictional replay. Today → Add doorstep activity → Advance 15 minutes. | “For a repeatable demonstration, these people, events and the paused clock are fictional. Doorstep activity does not complete the visit. At the confirmation deadline, a follow-up opens.” |
| 1:05–1:42 | Demo view → Helper. Accept follow-up → Confirm acceptance. Record outcome → Backup check-in completed; enter a short specific note → Save outcome. | “Sam accepts responsibility with an arrival time. Acceptance does not close the task. After checking in, Sam records the outcome. A backup check-in is kept separate from whether the original provider visited.” |
| 1:42–2:00 | Replay scenario → Camera outage → Reset replay → Start fictional replay. | “If the camera goes offline, Handoff asks for a person's confirmation. Missing camera evidence does not become a claim that a visit was missed or that somebody is safe.” |
| 2:00–2:23 | Replay scenario → Differing statements → Reset replay → Start fictional replay. Coordinator → Resolve disagreement; show outcome options and a brief note, then Save outcome. | “When accounts differ, the record stays disputed until the owner or coordinator records an explicit outcome. Handoff preserves the earlier statements rather than choosing an AI winner.” |
| 2:23–2:40 | Receipt → Download receipt; show saved receipt briefly. End on Today or Receipt. | “The receipt shows what was expected, what was observed, who took responsibility, and the outcome they recorded. The local replay is reproducible, and the same service is available through real MCP tools.” |

## Recording preparation

- Build and start the application; use the exact control names above. Keep one known replay reset before each take.
- Prepare the two short outcome notes in advance. Use cuts between scenes instead of speaking faster to fit loading or typing time.
- Capture the official integration separately from replay. If demonstrating a supported motion/doorbell event, confirm that exact type in the actual evidence before describing it.
- Do not show a populated `.env`, bearer header, account identifiers, or private household receipt. The browser integration status is redacted.
- Keep titles/captions in English, verify the finished duration is below three minutes, and ensure the public video URL works signed out. Final video URL: **pending**.

Optional: replace a few seconds of receipt footage with Integrations → Connect local MCP → `read_receipt` → Run read tool. Label it “Local MCP demonstration”; do not claim an Alexa session. Keep the total duration at 2:40.
