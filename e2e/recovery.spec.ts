import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  await request.post("/api/replay", { data: { type: "scenario", scenario: "overdue" } });
  await page.goto("/");
  await expect(page.getByText("Updates connected", { exact: true })).toBeVisible();
});

for (const outcome of ["backup_completed", "follow_up_recorded"] as const) {
  test(`a disputed ${outcome} outcome does not confirm the original visit`, async ({ page, request }) => {
    await request.post("/api/replay", { data: { type: "scenario", scenario: "disputed" } });
    await expect(page.getByText("Statements differ", { exact: true })).toBeVisible();
    await page.getByLabel("Demo view").selectOption("coordinator");
    await page.getByRole("button", { name: "Resolve disagreement" }).click();
    await page.getByLabel("Outcome").selectOption(outcome);
    await page.getByLabel("What happened?").fill("Recorded follow-up without confirming the original visit.");
    await page.getByRole("button", { name: "Save outcome" }).click();
    await expect(page.getByText("Outcome recorded", { exact: true })).toBeVisible();
    const confirmation = page.getByLabel("Visit progression").locator("div").filter({ has: page.getByText("Confirmation", { exact: true }) });
    await expect(confirmation).not.toHaveClass(/done/);
    await request.post("/api/commands", { data: { type: "confirm_visit", actorId: "resident", visitId: "morning-visit", note: "I can now confirm the original visit happened." } });
    await expect(confirmation).toHaveClass(/done/);
  });
}

test("a reset from another client closes the reviewed task without crashing or rebinding it", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.getByRole("button", { name: "Advance 15 minutes" }).click();
  await page.getByLabel("Demo view").selectOption("helper");
  await page.getByRole("button", { name: "Accept follow-up" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await request.post("/api/replay", { data: { type: "scenario", scenario: "overdue" } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Awaiting confirmation", { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
  await request.post("/api/replay", { data: { type: "advance", minutes: 15 } });
  await expect(page.getByRole("button", { name: "Accept follow-up" })).toBeVisible();
  const state = await (await request.get("/api/state")).json();
  expect(state.visits[0].task.ownerId).toBeNull();
});

test("a delayed replay response cannot undo a newer live-mode update", async ({ page, request }) => {
  let releaseResponse!: () => void;
  let markCaptured!: () => void;
  const held = new Promise<void>(resolve => { releaseResponse = resolve; });
  const captured = new Promise<void>(resolve => { markCaptured = resolve; });
  await page.route("**/api/replay", async route => {
    const response = await route.fetch();
    markCaptured();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "Reset replay" }).click();
    await page.getByRole("button", { name: "Start fictional replay" }).click();
    await captured;
    await request.post("/e2e/live");
    await expect(page.getByText("Live records", { exact: true })).toBeVisible();
    const responseArrived = page.waitForResponse(response => response.url().endsWith("/api/replay"));
    releaseResponse();
    await responseArrived;
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Live records", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Advance 15 minutes" })).toHaveCount(0);
  } finally {
    releaseResponse();
  }
});

test("an older command response cannot replace a newer SSE dispute", async ({ page, request }) => {
  let releaseResponse!: () => void;
  let markCaptured!: () => void;
  const held = new Promise<void>(resolve => { releaseResponse = resolve; });
  const captured = new Promise<void>(resolve => { markCaptured = resolve; });
  await page.route("**/api/commands", async route => {
    const response = await route.fetch();
    markCaptured();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.getByLabel("Demo view").selectOption("resident");
    await page.getByRole("button", { name: "The visit happened", exact: true }).click();
    await page.getByLabel("Your note").fill("I initially thought the visit happened.");
    await page.getByRole("button", { name: "Record statement" }).click();
    await captured;
    await request.post("/api/commands", { data: { type: "report_not_happened", actorId: "family", visitId: "morning-visit", note: "The provider reports the original visit did not happen." } });
    await expect(page.getByText("Statements differ", { exact: true })).toBeVisible();
    const responseArrived = page.waitForResponse(response => response.url().endsWith("/api/commands"));
    releaseResponse();
    await responseArrived;
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Statements differ", { exact: true })).toBeVisible();
    await expect(page.getByText("Outcome recorded", { exact: true })).toHaveCount(0);
  } finally {
    releaseResponse();
  }
});
