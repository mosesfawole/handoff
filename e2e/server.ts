import { createServer } from "vite";
import { resolve } from "node:path";
import { createApp } from "../server/app";
import { HandoffService } from "../server/service";

// A separate database and no environment credentials: never reset saved connected data.
const service = new HandoffService({
  dbPath: resolve(
    process.env.HANDOFF_TEST_DB ??
      "../../work/handoff-build/browser-replay.sqlite",
  ),
  mode: "replay",
});
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const app = createApp(service, { clientPath: resolve(".no-test-dist") });
// Test-only transition to exercise the live read authorization and replay return UI.
// No external Ring call, real credential or saved household is involved.
app.post("/e2e/live", (_req, res) => {
  service.enterLive();
  res.json(service.state());
});
app.use(vite.middlewares);
const server = app.listen(3101, "127.0.0.1");
process.once("SIGTERM", async () => {
  server.closeAllConnections();
  server.close();
  await vite.close();
  service.close();
});
