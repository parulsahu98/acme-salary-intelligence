import { expect, test } from "@playwright/test";

test("HR signs in, searches a synthetic employee, and records a salary revision", async ({ page }) => {
  const email = process.env.E2E_HR_EMAIL;
  const password = process.env.E2E_HR_PASSWORD;
  test.skip(!email || !password, "Set E2E_HR_EMAIL and E2E_HR_PASSWORD for the authenticated local journey.");

  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Good morning" })).toBeVisible();

  await page.getByRole("link", { name: "Employees" }).click();
  await page.getByLabel("Search by name or employee ID").fill("ACME-00001");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: /ACME-00001/ }).click();
  await expect(page.getByText("EMPLOYEE · ACME-00001")).toBeVisible();

  const currentSalary = await page.getByTestId("current-salary").textContent();
  const nextSalary = (BigInt(currentSalary?.replace(/\D/g, "") || "0") + 1n).toString();
  const revisionReason = `E2E salary history verification ${Date.now()}`;
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel(/New annual salary/).fill(nextSalary);
  await page.getByLabel("Reason for change").fill(revisionReason);
  await page.getByRole("button", { name: "Save salary change" }).click();
  await expect(page.getByRole("status")).toContainText("Salary updated");
  await expect(page.getByText(revisionReason)).toBeVisible();

  await page.getByRole("link", { name: "Analytics" }).click();
  await expect(page.getByRole("heading", { name: "Salary analytics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Salary by country" })).toBeVisible();
});
