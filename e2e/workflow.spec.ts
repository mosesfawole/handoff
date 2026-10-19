import { test, expect } from "@playwright/test";
test.beforeEach(async ({ request, page }) => {
  await request.post("/api/replay", {
    data: { type: "scenario", scenario: "overdue" },
  });
  await page.goto("/");
});
test("overdue visit → helper ownership → separate outcome → persistent receipt", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Advance 15 minutes" }).click();
  await expect(
    page.getByText("Confirmation overdue", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Demo view").selectOption("helper");
  await page.getByRole("button", { name: "Accept follow-up" }).click();
  await page.getByRole("button", { name: "Confirm acceptance" }).click();
  await expect(
    page.getByText("Outcome still open", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record outcome" }).click();
  await page.getByLabel("Outcome").selectOption("backup_completed");
  await page
    .getByLabel("What happened?")
    .fill(
      "I completed a backup check-in with Jo. Original visit not confirmed.",
    );
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(
    page.getByText("Outcome recorded", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Receipt", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByText(
        "I completed a backup check-in with Jo. Original visit not confirmed.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt" }).click();
  expect((await download).suggestedFilename()).toMatch(/handoff.*\.json/);
});
test("outage asks for a person and disagreement requires explicit coordinator resolution", async ({
  page,
}) => {
  await page.getByLabel("Replay scenario").selectOption("outage");
  await page.getByRole("button", { name: "Reset replay" }).click();
  await page.getByRole("button", { name: "Start fictional replay" }).click();
  await expect(
    page.getByText("The camera is offline. We need a person's confirmation.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Replay scenario").selectOption("disputed");
  await page.getByRole("button", { name: "Reset replay" }).click();
  await page.getByRole("button", { name: "Start fictional replay" }).click();
  await expect(
    page.getByText("Statements differ", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Demo view").selectOption("coordinator");
  await page.getByRole("button", { name: "Resolve disagreement" }).click();
  await page.getByLabel("Outcome").selectOption("follow_up_recorded");
  await page
    .getByLabel("What happened?")
    .fill("Spoke with both participants and arranged another check-in.");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(
    page.getByText("Outcome recorded", { exact: true }),
  ).toBeVisible();
});
test("resident statements are reviewed; plan evidence limitation surfaces the real error", async ({
  page,
}) => {
  await page.getByLabel("Demo view").selectOption("resident");
  await page
    .getByRole("button", { name: "The visit happened", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Your note").fill("I met the helper this morning.");
  await page.getByRole("button", { name: "Record statement" }).click();
  await expect(
    page.getByText("Outcome recorded", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Demo view").selectOption("coordinator");
  await page
    .getByRole("button", { name: "Care plan", exact: true })
    .first()
    .click();
  await page.getByLabel("Visit title").fill("Morning check-in");
  await page.getByRole("button", { name: "Review plan" }).click();
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByText("Plan saved", { exact: true })).toBeVisible();
  await page.getByLabel("Window ends").fill("09:20");
  await page.getByRole("button", { name: "Review plan" }).click();
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("alert")).toContainText(
    /evidence|confirmation|window/i,
  );
});
test("actual MCP initialization and tool reads, mutation authorization and Ring error", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Integrations", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Connect local MCP" }).click();
  await expect(
    page.getByText("9 tools discovered", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("MCP tool").selectOption("read_receipt");
  await page.getByRole("button", { name: "Run read tool" }).click();
  await expect(page.getByLabel("Protocol response")).toContainText(
    "fictional-household",
  );
  await page.getByLabel("MCP tool").selectOption("confirm_visit");
  await expect(
    page.getByText("Bearer authorization required", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check Ring connection" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Ring token is not configured",
  );
});
test("phone helper workflow and keyboard dialog focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Advance 15 minutes" }).click();
  await page.getByLabel("Demo view").selectOption("helper");
  await page.evaluate(() => window.scrollTo(0, 0));
  const actionBounds = await page.getByRole("button", { name: "Accept follow-up" }).boundingBox();
  expect(actionBounds!.y + actionBounds!.height).toBeLessThan(770);
  await page.getByRole("button", { name: "Accept follow-up" }).click();
  await expect(page.getByLabel("Arrival time")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Confirm acceptance" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Accept follow-up" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("SSE receives another participant’s update", async ({ page, request }) => {
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const state = await (await request.get("/api/state")).json();
  await request.post("/api/commands", {
    data: {
      type: "report_not_happened",
      actorId: state.actors.find((a: { role: string }) => a.role === "resident")
        .id,
      visitId: state.activeVisitId,
      note: "Nobody arrived this morning.",
    },
  });
  await expect(
    page
      .getByRole("region", { name: "What we know" })
      .getByText("Nobody arrived this morning.", { exact: true }),
  ).toBeVisible();
});
test("live records guard anonymous MCP and visibly return to separate replay", async ({
  page,
  request,
}) => {
  await request.post("/e2e/live");
  await page.reload();
  await expect(page.getByText("Live records", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Advance 15 minutes" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Integrations", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Connect local MCP" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Bearer authentication is required for connected records",
  );
  await page
    .getByRole("button", { name: "Return to fictional replay", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Start fictional replay" }).click();
  await expect(
    page.getByText("Fictional replay", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Advance 15 minutes" }),
  ).toBeVisible();
});
