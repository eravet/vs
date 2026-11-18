import { test, expect } from "@playwright/test";
import fs from "node:fs";

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../src/_data/${f}`, import.meta.url), "utf8"));

test.describe("Content from the editor appears on the site @functional", () => {
  test("home shows the hero text and every highlight from home.json", async ({ page }) => {
    const home = read("home.json");
    await page.goto("/");
    await expect(page.locator(".hero__title")).toHaveText(home.hero.headline);
    for (const p of home.proof) await expect(page.locator(".proof")).toContainText(p.number);
  });

  test("coaching page lists each plan with its price @critical", async ({ page }) => {
    const { plans, addons, faq } = read("coaching.json");
    await page.goto("/coaching/");
    const cards = page.locator(".plan");
    await expect(cards).toHaveCount(plans.length);
    for (const [i, plan] of plans.entries()) {
      await expect(cards.nth(i).locator(".plan__name")).toHaveText(plan.name);
      await expect(cards.nth(i).locator(".plan__price")).toContainText(String(plan.price));
    }
    await expect(page.locator(".addon")).toHaveCount(addons.length);
    await expect(page.locator(".faq__item")).toHaveCount(faq.length);
  });

  test("FAQ answers open when clicked", async ({ page }) => {
    await page.goto("/coaching/");
    const first = page.locator(".faq__item").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
  });

  test("about page shows the full timeline", async ({ page }) => {
    const about = read("about.json");
    await page.goto("/about/");
    await expect(page.locator(".timeline__item")).toHaveCount(about.timeline.length);
    await expect(page.locator(".prose--story")).toContainText("Team Lada");
  });

  test("only testimonials marked 'show' are displayed", async ({ page }) => {
    const { items } = read("testimonials.json");
    await page.goto("/");
    await expect(page.locator(".quote")).toHaveCount(items.filter((t) => t.show).length);
  });
});

test.describe("Journal @functional", () => {
  test("lists every published post, newest first @critical", async ({ page }) => {
    const files = fs.readdirSync(new URL("../../src/journal/", import.meta.url)).filter((f) => f.endsWith(".md"));
    await page.goto("/journal/");
    const count = (await page.locator(".feature").count()) + (await page.locator(".post-grid .post-card").count());
    expect(count).toBe(files.length);
    const dates = await page.locator("[data-category] time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")));
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test("topic filters hide posts from other topics", async ({ page }) => {
    await page.goto("/journal/");
    await page.getByRole("button", { name: "Nutrition" }).click();
    const visible = page.locator(".post-card:visible, .feature:visible");
    const n = await visible.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await expect(visible.nth(i)).toHaveAttribute("data-category", "nutrition");
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.locator(".post-card:visible").first()).toBeVisible();
  });

  test("a post shows title, photo credit, rider photo and related posts", async ({ page }) => {
    await page.goto("/journal/nutrition-endurance-alberto-bettiol/");
    await expect(page.locator("h1")).toContainText("Nutrition for Endurance");
    await expect(page.locator(".post__hero figcaption")).toContainText("Unsplash");
    await expect(page.locator(".prose--article img[alt*='Bettiol']")).toHaveCount(1);
    await expect(page.locator(".post-grid .post-card")).toHaveCount(3);
  });
});

test.describe("Contact @functional", () => {
  test("form is set up for Netlify and has required fields @critical", async ({ page }) => {
    await page.goto("/contact/");
    const form = page.locator("form[name=contact]");
    await expect(form).toHaveAttribute("data-netlify", "true");
    for (const name of ["name", "email", "message"]) await expect(form.locator(`[name=${name}]`)).toHaveAttribute("required", "");
  });

  test("plan chosen on the coaching page is preselected", async ({ page }) => {
    await page.goto("/coaching/");
    await page.locator(".plan").nth(1).getByRole("link").click();
    await expect(page).toHaveURL(/\/contact\/\?plan=Advanced(%20|\+)Performance/);
    await expect(page.locator("select[name=plan]")).toHaveValue("Advanced Performance");
  });
});

test.describe("Navigation @functional", () => {
  test("mobile menu opens, closes with Escape, and links work @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/");
    const toggle = page.locator("[data-nav-toggle]");
    await toggle.click();
    await expect(page.locator("#site-nav")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await page.locator("#site-nav").getByRole("link", { name: "Journal" }).click();
    await expect(page).toHaveURL(/\/journal\/$/);
  });

  test("current page is marked in the header", async ({ page }) => {
    await page.goto("/about/");
    await expect(page.locator(".site-nav a[aria-current=page]")).toHaveText("About");
  });
});

test.describe("SEO basics @functional", () => {
  test("every page has a unique title, description and social image", async ({ page }) => {
    const seen = new Set();
    for (const path of ["/", "/coaching/", "/about/", "/journal/", "/contact/", "/journal/sleep-performance-primoz-roglic/"]) {
      await page.goto(path);
      const title = await page.title();
      expect(seen.has(title), `duplicate title ${title}`).toBe(false);
      seen.add(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\//);
    }
  });

  test("sitemap lists the journal posts", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain("/journal/sleep-performance-primoz-roglic/");
  });
});
