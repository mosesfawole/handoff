import { test, expect } from "@playwright/test";
const captures = "../../work/handoff-build/";
test("desktop and 390px evidence, completion and navigation", async ({
  page,
  request,
}) => {
  await request.post("/api/replay", {
    data: { type: "scenario", scenario: "overdue" },
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await page.getByRole("button", { name: "Add doorstep activity" }).click();
  await expect(
    page.getByText(
      "Doorstep activity was observed. Nobody has confirmed the visit yet.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Advance 15 minutes" }).click();
  await expect(
    page.getByText("Confirmation overdue", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${captures}handoff-desktop-follow-up.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Demo view").selectOption("helper");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${captures}handoff-phone-top.png` });
  await page.evaluate(() => window.scrollTo(0, 330));
  await page.screenshot({ path: `${captures}handoff-phone-helper.png` });
  await page.getByRole("button", { name: "Accept follow-up" }).click();
  await page.getByRole("button", { name: "Confirm acceptance" }).click();
  await page.getByRole("button", { name: "Record outcome" }).click();
  await page
    .getByLabel("What happened?")
    .fill("Backup check-in completed; the original visit remains unconfirmed.");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(
    page.getByText("Outcome recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Doorstep activity was observed. The human account is recorded separately.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Mobile workspace" })
    .getByRole("button", { name: "Receipt" })
    .click();
  await expect(
    page
      .getByText(
        "Backup check-in completed; the original visit remains unconfirmed.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${captures}handoff-phone-receipt.png` });
  for (const name of ["Today", "Care plan", "Receipt", "Integrations"]) {
    await page
      .getByRole("navigation", { name: "Mobile workspace" })
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${name} fits the phone`,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Connect local MCP" }).click();
  await expect(
    page.getByText("9 tools discovered", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${captures}handoff-desktop-integrations.png`,
  });
});
