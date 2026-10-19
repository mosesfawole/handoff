# Handoff

**Care, carried through.** Handoff turns an overdue or disputed home-care visit into one accountable follow-up, then records the outcome separately from camera activity.

This is a locally runnable prototype with fictional replay, persistent SQLite records, family/resident/helper/coordinator demo views, a server-side Ring adapter, and a real Model Context Protocol (MCP) endpoint. A doorstep event never proves identity, completed care, or safety. Demo roles are views, not production authentication.

Public source: [mosesfawole/handoff](https://github.com/mosesfawole/handoff), default branch `handoff-build`, under the MIT license. Evaluation is available by cloning or downloading the source and running the fictional replay locally; there is no hosted public application yet. The [160-second English narrated demonstration is published on YouTube](https://youtu.be/LxP-aSjzIEY). [Devpost entry 1246362](https://devpost.com/software/handoff-5f1j8d) was submitted on 19 October 2026; Devpost displayed “Project submitted!” after the entrant accepted the final agreement.

## Run locally

Use **Node.js 24** and npm. Node's built-in SQLite is used; its experimental warning is narrowly suppressed by the supplied npm commands. Run these commands from this directory:

To obtain the source first:

```sh
git clone https://github.com/mosesfawole/handoff.git
cd handoff
```

Then install, build and start:

```sh
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001). The server binds to loopback. Stop it with Ctrl+C. The first run opens fictional replay at 09:12 Europe/Berlin on 18 October 2026. The replay clock stays paused until you advance it; live mode uses system time.

Install devDependencies as well as dependencies: the runtime uses `tsx`, currently declared as a devDependency. Do not use `npm ci --omit=dev` for this package, and ensure an environment setting such as `NODE_ENV=production` does not omit them during installation.

On Windows, `npm.cmd` avoids PowerShell execution-policy ambiguity. From any working directory, the included script also installs missing dependencies, builds, and starts the app:

```powershell
& 'C:\path\to\handoff\scripts\start-local.ps1'
```

Use `-Install` to reinstall dependencies with `npm ci`, or `-SkipBuild` to use an existing build. The script preserves `.env`, saved data, environment variables, and your original working directory. `npm run dev` starts the backend on 3001 and Vite on 5173; the development proxy expects the default backend port.

## Try the complete workflow

1. Under Fictional replay lab, choose Missing confirmation, then **Reset replay → Start fictional replay**.
2. Select **Add doorstep activity**. It remains an observation, not a visit confirmation.
3. Select **Advance 15 minutes** to pass the 09:25 confirmation deadline.
4. Change Demo view to Helper, select **Accept follow-up**, review the arrival time, then **Confirm acceptance**. The outcome remains open.
5. Select **Record outcome**, choose Backup check-in completed, describe what happened, and **Save outcome**.
6. Open **Receipt** and **Download receipt**. A backup check-in does not confirm that the original provider visited. Refresh or restart the server to inspect persisted records.

Try Camera outage and Differing statements with the same reset controls. A coordinator can **Resolve disagreement** by recording an explicit outcome. Care plan supports one visit window and its backup agreement. Once a human statement or camera observation exists, that visit's timing cannot be repurposed; resolve an open follow-up before editing the plan. Title/contact/instruction edits remain available after resolution.

Replay reset affects fictional scenario state and preserves reset boundaries in its audit history. Connected household records are stored separately. In live mode, **Return to fictional replay** remains visible. Never point automated tests at your saved household database.

## Optional server configuration

Replay requires no credentials. To configure Ring or authorized MCP clients, create `.env` only if it does not already exist, using `.env.example` as the template. Keep it private and restart the server after edits. Existing process environment variables take precedence over `.env`.

| Variable | Purpose and default |
| --- | --- |
| `PORT` | Local backend port; default `3001` |
| `HANDOFF_DB` | SQLite path; default `data/handoff.sqlite`, relative to the project when started here |
| `HANDOFF_MODE` | Startup mode, `replay` by default or `live`; both household records remain stored |
| `RING_ACCESS_TOKEN` | Official short-lived Playground/developer access token, held only by the server |
| `RING_WEBHOOK_SECRET` | Shared secret for raw-body HMAC verification of Ring webhook input |
| `HANDOFF_MCP_TOKEN` | Bearer credential required for MCP mutations and all MCP access to live records |

The data directory and populated environment files are ignored by Git. JSON receipts contain household evidence: export only fictional or otherwise appropriate records for a demonstration. The source archive must exclude populated credentials, SQLite data, dependency folders, and logs.

### Ring

Obtain access through the [official Ring developer setup](https://developer.amazon.com/docs/ring/get-started.html). Handoff calls [Amazon Vision's documented API](https://developer.amazon.com/docs/ring/api-documentation.html) server-side using ordinary HTTP; it does not use an unofficial consumer Ring API. In **Integrations**, **Check Ring connection** discovers devices, reads current status and history, and opens the separate connected household. The first discovered camera supplies headline coverage; additional device IDs remain in the evidence.

`POST /api/webhooks/ring` verifies the raw JSON request body with HMAC-SHA256 and an `X-Signature: sha256=<hex>` header before normalization. Configure the matching shared secret and connect the live household first. Public HTTPS webhook hosting and automatic OAuth token refresh are not implemented; local signature/adapter tests do not demonstrate a public webhook delivery.

Official evidence confirms discovery/status/history and ingestion of one `on_demand` history event, conservatively stored as `unknown` activity. A fresh successful API check on 19 October 2026 at 07:30:06.555 UTC returned one online Playground device and that same historical event; the application connection was also verified with isolated data, and footage/screens were captured. This does **not** prove a new motion event, a doorstep visitor, completed care, or a public webhook. See [validation](docs/validation.md), the [sanitized fresh trace](docs/evidence/fresh-ring-evidence.json), and the [recording script](docs/demo-script.md).

### MCP

Connect a client that supports **Streamable HTTP**, protocol `2025-11-25` or later, to `http://127.0.0.1:3001/mcp`. Configure `Authorization: Bearer <your HANDOFF_MCP_TOKEN>` in that client's private credential configuration when using mutations or live records. Exact client configuration syntax varies. Do not paste the secret into source, the browser explorer, a receipt, or a video.

The endpoint exposes `read_state`, `read_receipt`, `set_visit`, `confirm_visit`, `report_not_happened`, `report_delay`, `claim_task`, `resolve_task`, and `release_task`. Clients discover actual argument schemas with `tools/list`; mutation arguments include actor/visit IDs from current state, and task actions also require its current task ID. Assignment remains atomic, and accepting responsibility does not resolve a task.

The browser **Local MCP explorer → Connect local MCP → Run read tool** performs real JSON-RPC initialization, tool discovery and reads. Anonymous reads are limited to fictional replay; the browser displays mutation schemas and their authorization requirement. It is a local MCP demonstration, not a shipped Alexa integration or an authenticated Alexa session.

## Verify

```sh
npm test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
```

The build includes TypeScript checking. Install Playwright Chromium once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chrome/Chromium executable before browser tests. The committed configuration contains no machine-specific executable default. `scripts/verify.ps1` runs the unit, build and browser checks from any directory; `-SkipBrowser` deliberately skips browser coverage, and `-Install` runs `npm ci` first. Native command failures stop both scripts.

Browser tests start a separate replay server on 3101 and use `../../work/handoff-build/browser-replay.sqlite`; they do not load `.env`. The verification script requires its own server and restores the prior `CI` environment value afterward; an occupied port fails instead of reusing an unidentified service. When running `npm run test:e2e` directly, ensure 3101 is free or belongs to that test server. Unit tests use isolated fixtures/databases. See [validation](docs/validation.md) for observed results and limits.

## Package and project notes

- [2:40 demonstration script](docs/demo-script.md)
- [Submission draft](docs/submission-draft.md) and [competition preflight](docs/submission-preflight.md)
- [Developer feedback](docs/developer-feedback.md)
- [Design decisions](docs/decisions.md), [approved design](DESIGN.md), and [implementation plan](IMPLEMENTATION.md)
- [MIT license](LICENSE)

There is no external messaging, emergency dispatch, medical assessment, facial recognition, production household authentication, deployed public host, or automatic Ring token renewal. User interviews, demand validation, and clinical outcomes have not been established. The source repository and demonstration video are published; anonymous YouTube metadata access and watch-page playback start are verified. Competition submission is confirmed. A hosted application remains future work; evaluation is available from the public source and demonstration.
