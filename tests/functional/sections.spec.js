import { test, expect } from "@playwright/test";
import fs from "node:fs";

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../src/_data/${f}`, import.meta.url), "utf8"));

test.describe("Juniors page @functional", () => {
  test("shows the team, coaches, parent FAQ and a Netlify join form @critical", async ({ page }) => {
    const j = read("juniors.json");
    await page.goto("/juniors/");
    await expect(page.locator(".photo-head .eyebrow")).toHaveText(j.eyebrow);
    await expect(page.locator(".person")).toHaveCount(j.coaches.length);
    await expect(page.locator(".faq__item")).toHaveCount(j.parents.length);
    const form = page.locator("form[name=junior-interest]");
    await expect(form).toHaveAttribute("data-netlify", "true");
    await expect(form.locator("[name=rider_age]")).toHaveAttribute("required", "");
  });

  test("results section is hidden until results are added", async ({ page }) => {
    const j = read("juniors.json");
    await page.goto("/juniors/");
    await expect(page.getByRole("heading", { name: j.results_heading })).toHaveCount(j.results.length ? 1 : 0);
  });
});

test.describe("Camps & clinics page @functional", () => {
  test("lists every program in every section", async ({ page }) => {
    const p = read("programs.json");
    await page.goto("/programs/");
    for (const s of p.sections) {
      await expect(page.locator(`#${s.id} .program`)).toHaveCount(s.items.length);
    }
  });

  test("'Tell me when it's on' preselects the program in the sign-up form", async ({ page }) => {
    await page.goto("/programs/");
    const link = page.locator("[data-program]").first();
    const name = await link.getAttribute("data-program");
    await link.click();
    await expect(page.locator("select[name=program]")).toHaveValue(name);
    await expect(page.locator("form[name=program-interest]")).toHaveAttribute("data-netlify", "true");
  });
});

test.describe("Group rides page @functional", () => {
  test("lists the weekly rides with day and time", async ({ page }) => {
    const r = read("rides.json");
    await page.goto("/rides/");
    const rides = page.locator(".ride");
    await expect(rides).toHaveCount(r.weekly.length + r.special.length);
    await expect(page.locator(".rides").last()).toContainText(r.weekly[0].day);
  });
});

test.describe("Athlete hub @functional", () => {
  test("links to TrainingPeaks, lists resources and has the intake form", async ({ page }) => {
    const a = read("athletes.json");
    await page.goto("/athletes/");
    await expect(page.getByRole("link", { name: "Open TrainingPeaks" })).toHaveAttribute("href", a.trainingpeaks_url);
    await expect(page.locator(".resources li")).toHaveCount(a.resources.length);
    await expect(page.locator("form[name=intake]")).toHaveAttribute("data-netlify", "true");
  });

  test("optional links only appear when filled in", async ({ page }) => {
    const a = read("athletes.json");
    await page.goto("/athletes/");
    await expect(page.getByRole("link", { name: "Manage subscription" })).toHaveCount(a.billing_url ? 1 : 0);
    await expect(page.getByRole("link", { name: "Leave a review" })).toHaveCount(a.review_url ? 1 : 0);
  });

  test("header 'Athlete hub' goes to the hub", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.locator("[data-nav-toggle]").click();
    await expect(page.locator(".site-nav__athletes")).toHaveText("Athlete hub");
    await page.locator(".site-nav__athletes").click();
    await expect(page).toHaveURL(/\/athletes\/$/);
  });
});

test.describe("Referral offer @functional", () => {
  test("appears on the coaching page when enabled", async ({ page }) => {
    const { referral } = read("coaching.json");
    await page.goto("/coaching/");
    await expect(page.locator(".referral")).toHaveCount(referral.enabled ? 1 : 0);
  });
});
