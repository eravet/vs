import { test, expect } from "@playwright/test";

const pages = [
  { path: "/", heading: /train like the pros/i },
  { path: "/coaching/", heading: /coaching plans/i },
  { path: "/about/", heading: /european peloton/i },
  { path: "/journal/", heading: /training notes/i },
  { path: "/contact/", heading: /talk about your riding/i },
  { path: "/credits/", heading: /photo credits/i },
];

test.describe("Core pages @smoke", () => {
  for (const p of pages) {
    test(`${p.path} renders with its heading and no broken images @critical`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(p.path);
      expect(res.status()).toBe(200);
      await expect(page.locator("h1")).toHaveText(p.heading);

      // Scroll through so lazy images load, then check none are broken
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      });
      const broken = await page.evaluate(() =>
        Promise.all([...document.images].map((img) => img.decode().then(() => null, () => img.currentSrc || img.src)))
      );
      expect(broken.filter(Boolean)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("no horizontal scrolling on any page @mobile", async ({ page }) => {
    for (const p of pages) {
      await page.goto(p.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${p.path} overflows`).toBeLessThanOrEqual(0);
    }
  });

  test("unknown pages show the 404 page", async ({ page }) => {
    await page.goto("/404.html");
    await expect(page.locator("h1")).toHaveText(/wrong turn/i);
  });
});
