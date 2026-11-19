import { test, expect } from "@playwright/test";
import fs from "node:fs";
import yaml from "js-yaml";

// Guards against the editor (Decap CMS) and the site's data files drifting apart.
// If a field is renamed in one place but not the other, Mark's edits would silently stop showing.
const root = new URL("../../", import.meta.url);
const config = yaml.load(fs.readFileSync(new URL("src/admin/config.yml", root), "utf8"));

const checkFields = (fields, data, where) => {
  for (const f of fields) {
    if (f.required === false && !(f.name in data)) continue;
    expect(data, `${where}: missing "${f.name}"`).toHaveProperty(f.name);
    if (f.widget === "object" && f.fields) checkFields(f.fields, data[f.name], `${where}.${f.name}`);
    if (f.widget === "list" && f.fields) data[f.name].forEach((item, i) => checkFields(f.fields, item, `${where}.${f.name}[${i}]`));
  }
};

test.describe("Content editor configuration @functional", () => {
  test("every page in the editor points at a data file with matching fields @critical", () => {
    const files = config.collections.flatMap((c) => c.files || []);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const path = new URL(file.file, root);
      expect(fs.existsSync(path), `${file.file} exists`).toBe(true);
      checkFields(file.fields, JSON.parse(fs.readFileSync(path, "utf8")), file.file);
    }
  });

  test("journal posts have every required editor field", () => {
    const journal = config.collections.find((c) => c.name === "journal");
    const dir = new URL(journal.folder + "/", root);
    const required = journal.fields.filter((f) => f.required !== false && f.name !== "body").map((f) => f.name);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const fm = yaml.load(fs.readFileSync(new URL(file, dir), "utf8").split("---")[1]);
      for (const name of required) expect(fm, `${file} missing ${name}`).toHaveProperty(name);
    }
  });

  test("the editor page loads its config", async ({ page }) => {
    const res = await page.request.get("/admin/config.yml");
    expect(res.ok()).toBe(true);
    const html = await (await page.request.get("/admin/")).text();
    expect(html).toContain("decap-cms@");
    expect(html).toContain("netlify-identity-widget");
  });

  test("public pages don't link to the editor or load its login", async ({ page }) => {
    for (const path of ["/", "/about/", "/journal/"]) {
      await page.goto(path);
      await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
      await expect(page.locator('script[src*="netlify-identity"]')).toHaveCount(0);
    }
  });

  test("an invite link on the home page loads the login widget", async ({ page }) => {
    await page.route("https://identity.netlify.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.goto("/#invite_token=test");
    await expect(page.locator('script[src*="netlify-identity"]')).toHaveCount(1);
  });
});
