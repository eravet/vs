import { test, expect } from "@playwright/test";
import fs from "node:fs";
import yaml from "js-yaml";
import publishHandler from "../../netlify/functions/publish.mjs";

// "Go live": editor saves don't deploy by themselves (netlify.toml `ignore`), and the editor's
// Go live button starts a deploy through a Netlify build hook (netlify/functions/publish.mjs).

const root = new URL("../../", import.meta.url);
const toml = fs.readFileSync(new URL("netlify.toml", root), "utf8");
const config = yaml.load(fs.readFileSync(new URL("src/admin/config.yml", root), "utf8"));
const HOOK = "https://api.netlify.com/build_hooks/abc123";

// The pattern inside the ignore command, e.g. ^(Add|Update|Delete|Upload) .*“
const ignoreCommand = /^\s*ignore = "(.*)"\s*$/m.exec(toml)[1];
const skips = (message) => new RegExp(/grep -qE '(.*)'/.exec(ignoreCommand)[1]).test(message);

test.describe("Go live: deploy rules @functional", () => {
  test("editor saves are skipped, code changes still deploy @critical", () => {
    expect(ignoreCommand).toContain("git log -1 --pretty=%s");
    for (const m of ["Update journal “2026-11-22-x”", "Add journal “x” (AI draft)", "Update Pages “home”", "Upload “a.jpg”", "Delete settings “ai_writing”"]) {
      expect(skips(m), m).toBe(true);
    }
    for (const m of ["feat(admin): add Go live", "Update README", "fix: typo", "chore: bump deps"]) {
      expect(skips(m), m).toBe(false);
    }
  });

  test("every commit message the editor writes is recognised as an editor save", () => {
    const samples = Object.values(config.backend.commit_messages).map((t) =>
      t.replace("{{collection}}", "journal").replace("{{slug}}", "2026-11-22-x").replace("{{path}}", "src/a.jpg")
    );
    expect(samples).toHaveLength(5);
    for (const m of samples) expect(skips(m), m).toBe(true);
    // Draft with AI's saves too
    const aiSave = fs.readFileSync(new URL("netlify/functions/ai-save.mjs", root), "utf8");
    expect(aiSave).toContain("`Add journal “${slug}” (AI draft)`");
  });
});

test.describe("Go live: server @functional", () => {
  let realFetch;
  let calls;
  const fake = ({ push = true, hookStatus = 200 } = {}) => async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, method: init.method || "GET" });
    const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (url.hostname === "api.github.com" && url.pathname === "/repos/eravet/vs") return ok({ permissions: { push } });
    if (url.hostname === "api.github.com" && url.pathname === "/user") return ok({ login: "markduroy01" });
    if (url.href.startsWith(HOOK)) return ok({}, hookStatus);
    throw new Error(`Unexpected request: ${url}`);
  };
  const request = (token = "gh-token") =>
    new Request("http://localhost/api/publish", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });

  test.beforeEach(() => {
    realFetch = globalThis.fetch;
    calls = [];
    process.env.BUILD_HOOK_URL = HOOK;
  });
  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("starts a deploy through the build hook, named after who clicked @critical", async () => {
    globalThis.fetch = fake();
    const res = await publishHandler(request());
    expect(res.status).toBe(200);
    const hook = calls.find((c) => c.url.href.startsWith(HOOK));
    expect(hook.method).toBe("POST");
    expect(hook.url.searchParams.get("trigger_title")).toBe("Go live from the editor (markduroy01)");
  });

  test("only people who can edit the site can start a deploy", async () => {
    globalThis.fetch = fake({ push: false });
    expect((await publishHandler(request(""))).status).toBe(401);
    expect((await publishHandler(request())).status).toBe(403);
    expect(calls.some((c) => c.url.href.startsWith(HOOK))).toBe(false);
  });

  test("says clearly when the build hook is missing, wrong or refused", async () => {
    globalThis.fetch = fake();
    delete process.env.BUILD_HOOK_URL;
    expect((await (await publishHandler(request())).json()).error).toContain("BUILD_HOOK_URL isn't set in Netlify");
    process.env.BUILD_HOOK_URL = "https://example.com/hook";
    expect((await (await publishHandler(request())).json()).error).toContain("doesn't look like a Netlify build hook");
    process.env.BUILD_HOOK_URL = HOOK;
    globalThis.fetch = fake({ hookStatus: 404 });
    expect((await (await publishHandler(request())).json()).error).toContain("Netlify didn't start the update (404)");
  });
});

test.describe("Go live: editor button @functional", () => {
  test("shows waiting saves, starts the update, and says when it's live", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("decap-cms-user", JSON.stringify({ token: "gh-token", backendName: "github" })));
    await page.route("https://unpkg.com/**", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
    let live = "aaa111";
    await page.route("**/deploy-info.json*", (r) => r.fulfill({ json: { commit: live } }));
    await page.route("https://api.github.com/repos/eravet/vs/commits/main", (r) => {
      expect(r.request().headers().authorization).toBe("Bearer gh-token");
      return r.fulfill({ json: { sha: "ccc333" } });
    });
    await page.route("https://api.github.com/repos/eravet/vs/compare/aaa111...ccc333", (r) =>
      r.fulfill({ json: { ahead_by: 2, commits: [{ commit: { message: "Update Pages “home”" } }, { commit: { message: "Add journal “x” (AI draft)" } }] } })
    );
    let published = 0;
    await page.route("**/api/publish", (r) => {
      published++;
      expect(r.request().headers().authorization).toBe("Bearer gh-token");
      return r.fulfill({ json: { ok: true } });
    });

    await page.goto("/admin/");
    const box = page.locator("#vs-live");
    await expect(box).toContainText("2 saved changes aren't live yet");
    await expect(box).toHaveAttribute("title", /Update Pages “home”[\s\S]*Add journal “x”/);

    await page.getByRole("button", { name: "Go live" }).click();
    await expect(box).toContainText("Updating the site");
    await expect(page.getByRole("button", { name: "Go live" })).toBeHidden();
    expect(published).toBe(1);

    live = "ccc333"; // the deploy finished
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(box).toContainText("Your changes are live");
  });

  test("says the site is up to date when nothing is waiting", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("decap-cms-user", JSON.stringify({ token: "gh-token" })));
    await page.route("https://unpkg.com/**", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
    await page.route("**/deploy-info.json*", (r) => r.fulfill({ json: { commit: "ccc333" } }));
    await page.route("https://api.github.com/repos/eravet/vs/commits/main", (r) => r.fulfill({ json: { sha: "ccc333" } }));
    await page.goto("/admin/");
    await expect(page.locator("#vs-live")).toContainText("Site is up to date");
    await expect(page.getByRole("button", { name: "Go live" })).toBeHidden();
  });

  test("stays hidden until you're logged in", async ({ page }) => {
    await page.route("https://unpkg.com/**", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
    await page.goto("/admin/");
    await page.waitForTimeout(500);
    await expect(page.locator("#vs-live")).toBeHidden();
  });
});
