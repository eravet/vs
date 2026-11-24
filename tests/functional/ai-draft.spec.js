import { test, expect } from "@playwright/test";
import fs from "node:fs";
import yaml from "js-yaml";
import {
  cleanDraft, buildPostFile, buildPrompt, photoCredit, toPhoto, downloadUrl, slugify, todayInAustin, CATEGORIES, DRAFT_SCHEMA, REPO,
} from "../../netlify/lib/ai-draft.mjs";
import draftHandler from "../../netlify/functions/ai-draft.mjs";
import saveHandler from "../../netlify/functions/ai-save.mjs";

// "Draft with AI" (src/admin/draft/ + netlify/functions/ai-*.mjs).
// Tested with fake GitHub, Gemini and Openverse services, so no keys or network are needed.

const root = new URL("../../", import.meta.url);
const config = yaml.load(fs.readFileSync(new URL("src/admin/config.yml", root), "utf8"));
const journal = config.collections.find((c) => c.name === "journal");

const geminiDraft = {
  title: "Ride Easy to Ride Fast",
  excerpt: "Why your easy days make your hard days count.",
  category: "Training Tips",
  tags: ["recovery rides", "zone 2"],
  body: "# Ride Easy to Ride Fast\n\n## Slow Down\n\nMost riders go too hard on easy days.",
  image_alt: "A rider on a quiet road",
  photo_searches: ["peloton", "cyclist"],
};

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
// An Openverse image record, as the API returns it.
const openverseImage = (n, extra = {}) => ({
  id: id(n),
  title: `Peloton ${n}`,
  url: `https://live.staticflickr.com/65535/${n}_b.jpg`,
  thumbnail: `https://api.openverse.org/v1/images/${id(n)}/thumb/`,
  creator: `Jane Smith ${n}`,
  creator_url: "https://www.flickr.com/photos/jane",
  foreign_landing_url: `https://www.flickr.com/photos/jane/${n}`,
  license: "by",
  license_version: "2.0",
  license_url: "https://creativecommons.org/licenses/by/2.0/",
  source: "flickr",
  width: 1024,
  mature: false,
  tags: [],
  ...extra,
});

// Fakes the services the functions call. Records every request.
function fakeServices({ push = true, files = {}, openverseStatus = 200 } = {}) {
  const calls = [];
  const blobs = {};
  let n = 0;
  const ok = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  const notFound = () => new Response("{}", { status: 404 });
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body, headers: init.headers || {} });
    const p = url.pathname;
    if (url.hostname === "api.github.com") {
      if (p === "/repos/eravet/vs") return ok({ permissions: { push } });
      const file = /^\/repos\/eravet\/vs\/contents\/(.+)$/.exec(p);
      if (file) {
        const path = decodeURIComponent(file[1]);
        return path in files ? ok({ content: Buffer.from(files[path]).toString("base64") }) : notFound();
      }
      if (p.endsWith("/git/ref/heads/main")) return ok({ object: { sha: "head1" } });
      if (p.endsWith("/git/commits/head1")) return ok({ tree: { sha: "tree1" } });
      if (p.endsWith("/git/blobs")) {
        const sha = `blob${++n}`;
        blobs[sha] = body;
        return ok({ sha });
      }
      if (p.endsWith("/git/trees")) return ok({ sha: "tree2" });
      if (p.endsWith("/git/commits")) return ok({ sha: "commit2" });
      if (p.endsWith("/git/refs/heads/main")) return ok({ ref: "refs/heads/main" });
    }
    if (url.hostname === "generativelanguage.googleapis.com") {
      return ok({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(geminiDraft) }] } }] });
    }
    if (url.hostname === "api.openverse.org") {
      if (openverseStatus !== 200) return new Response("{}", { status: openverseStatus });
      return ok(openverseImage(7, { title: "Peloton on a climb (from Openverse)" }));
    }
    if (url.hostname === "live.staticflickr.com") {
      return new Response(Buffer.from("fake jpeg bytes"), { headers: { "content-type": "image/jpeg" } });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  return { fetch, calls, blobs };
}

const settingsFile = JSON.stringify({
  instructions: "Write like Mark. Keep it short.",
  example_posts: ["2025-01-01-example", "../../etc/passwd"],
  photo_hints: "Road cycling only.",
});

const request = (path, body, token = "gh-token") =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

test.describe("Draft with AI: server @functional", () => {
  let realFetch;
  test.beforeEach(() => {
    realFetch = globalThis.fetch;
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });
  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("cleanDraft fixes up whatever the AI sends back", () => {
    const d = cleanDraft({ title: "  Big\n Title ", body: "# Big Title\n\n## Part one\n\nText", category: "Gossip", tags: Array(12).fill("x") });
    expect(d.title).toBe("Big Title");
    expect(d.body.startsWith("## Part one")).toBe(true);
    expect(d.category).toBe(CATEGORIES[0]);
    expect(d.tags).toHaveLength(8);
    expect(() => cleanDraft({ title: "", body: "x" })).toThrow();
  });

  test("Draft with AI saves to the same GitHub repo as the editor @critical", () => {
    expect(REPO).toBe(config.backend.repo);
  });

  test("the AI's reply format only allows the site's topics", () => {
    expect(DRAFT_SCHEMA.properties.category.enum).toEqual(journal.fields.find((f) => f.name === "category").options);
  });

  test("a saved draft has every field the editor needs and stays unpublished @critical", () => {
    const draft = cleanDraft({ ...geminiDraft, title: 'Quotes "and" colons: fine' });
    const file = buildPostFile(draft, {
      date: "2026-11-22", image: "/assets/images/uploads/x.jpg", imageAlt: "A rider", credit: photoCredit(toPhoto(openverseImage(1))),
    });
    const fm = yaml.load(file.split("---")[1]);
    const required = journal.fields.filter((f) => f.required !== false && f.name !== "body").map((f) => f.name);
    for (const name of required) expect(fm, `missing ${name}`).toHaveProperty(name);
    expect(fm.title).toBe('Quotes "and" colons: fine');
    expect(fm.published).toBe(false);
    expect(fm.image_credit).toBe("Photo: [Jane Smith 1](https://www.flickr.com/photos/jane/1), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)");
    expect(file).toContain("## Slow Down");
  });

  test("only photos with licences that allow use on the site are accepted", () => {
    expect(toPhoto(openverseImage(1, { license: "by-nc" }))).toBeNull();
    expect(toPhoto(openverseImage(1, { license: "by-nd" }))).toBeNull();
    expect(toPhoto(openverseImage(1, { url: "http://example.com/x.jpg" }))).toBeNull();
    expect(toPhoto(openverseImage(1, { id: "../../etc" }))).toBeNull();
    const pd = toPhoto(openverseImage(1, { license: "pdm", license_version: "1.0", creator: "" }));
    expect(photoCredit(pd)).toBe("Photo: [Flickr](https://www.flickr.com/photos/jane/1), [Public Domain Mark](https://creativecommons.org/licenses/by/2.0/)");
  });

  test("large Wikimedia photos are downloaded at 1600px", () => {
    const photo = toPhoto(openverseImage(1, { source: "wikimedia", width: 4000, url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Rider_2024.jpg" }));
    expect(downloadUrl(photo)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Rider_2024.jpg/1600px-Rider_2024.jpg");
    expect(downloadUrl(toPhoto(openverseImage(1)))).toBe("https://live.staticflickr.com/65535/1_b.jpg");
  });

  test("the prompt includes Mark's instructions, photo hints and example posts", () => {
    const { system, user } = buildPrompt({
      settings: { instructions: "Write like Mark.", photoHints: "Road cycling only.", examples: ["---\ntitle: Old post\n---\nHello"] },
      notes: "Easy rides matter.",
      category: "Recovery",
      today: "2026-11-22",
    });
    expect(system).toContain("Write like Mark.");
    expect(system).toContain("Road cycling only.");
    expect(system).toContain("<example>");
    expect(system).toContain('Mark chose "Recovery"');
    expect(system).toContain("⚠️ check");
    expect(user).toContain("Easy rides matter.");
  });

  test("slugs and dates match the editor's file names", () => {
    expect(slugify("Primož Roglič: Sleep & Speed!")).toBe("primoz-roglic-sleep-speed");
    expect(todayInAustin(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-22");
  });

  test("draft: refuses people who aren't logged in or can't edit the site", async () => {
    const fake = fakeServices({ push: false });
    globalThis.fetch = fake.fetch;
    expect((await draftHandler(request("/api/ai/draft", { notes: "x".repeat(40) }, ""))).status).toBe(401);
    const res = await draftHandler(request("/api/ai/draft", { notes: "x".repeat(40) }));
    expect(res.status).toBe(403);
    expect(fake.calls.some((c) => c.url.hostname === "generativelanguage.googleapis.com")).toBe(false);
  });

  test("draft: writes with Gemini using the editable settings", async () => {
    const fake = fakeServices({ files: { "src/_data/ai_writing.json": settingsFile, "src/journal/2025-01-01-example.md": "---\ntitle: Example\n---\nExample body" } });
    globalThis.fetch = fake.fetch;
    const res = await draftHandler(request("/api/ai/draft", { notes: "Easy rides matter more than people think." }));
    expect(res.status).toBe(200);
    const { draft } = await res.json();
    expect(draft.title).toBe("Ride Easy to Ride Fast");
    expect(draft.body.startsWith("## Slow Down")).toBe(true);
    expect(draft.photo_searches).toEqual(["peloton", "cyclist"]);

    const gemini = fake.calls.find((c) => c.url.hostname === "generativelanguage.googleapis.com");
    expect(gemini.headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(gemini.url.pathname).toContain("gemini-3.6-flash:generateContent");
    const system = gemini.body.systemInstruction.parts[0].text;
    expect(system).toContain("Write like Mark. Keep it short.");
    expect(system).toContain("Example body");
    expect(gemini.body.generationConfig.responseJsonSchema).toEqual(DRAFT_SCHEMA);
    // The unsafe example path was ignored, not fetched
    expect(fake.calls.some((c) => c.url.pathname.includes("passwd"))).toBe(false);
    expect(JSON.stringify(draft)).not.toContain("test-gemini-key");
  });

  test("draft: says clearly when the Gemini key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = fakeServices().fetch;
    const res = await draftHandler(request("/api/ai/draft", { notes: "Easy rides matter more than people think." }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("GEMINI_API_KEY isn't set in Netlify");
  });

  test("save: commits the post, photo and credit in one go @critical", async () => {
    const fake = fakeServices({ files: { "src/_data/credits.json": '[\n  {\n    "file": "site/hero.jpg"\n  }\n]\n' } });
    globalThis.fetch = fake.fetch;
    // The browser's copy of the photo details is ignored when Openverse answers.
    const res = await saveHandler(request("/api/ai/save", { draft: geminiDraft, photo: openverseImage(7, { license: "by-nc", title: "Forged" }), imageAlt: "" }));
    expect(res.status).toBe(200);
    const { slug, editUrl } = await res.json();
    expect(slug).toBe(`${todayInAustin()}-ride-easy-to-ride-fast`);
    expect(editUrl).toBe(`/admin/#/collections/journal/entries/${slug}`);

    const tree = fake.calls.find((c) => c.url.pathname.endsWith("/git/trees")).body;
    expect(tree.base_tree).toBe("tree1");
    const byPath = Object.fromEntries(tree.tree.map((t) => [t.path, fake.blobs[t.sha]]));
    expect(Object.keys(byPath).sort()).toEqual(["src/_data/credits.json", `src/assets/images/uploads/${slug}.jpg`, `src/journal/${slug}.md`]);

    expect(Buffer.from(byPath[`src/assets/images/uploads/${slug}.jpg`].content, "base64").toString()).toBe("fake jpeg bytes");
    const fm = yaml.load(byPath[`src/journal/${slug}.md`].content.split("---")[1]);
    expect(fm.image).toBe(`/assets/images/uploads/${slug}.jpg`);
    expect(fm.image_alt).toBe("A rider on a quiet road");
    expect(fm.image_credit).toContain("[CC BY 2.0]");
    expect(fm.published).toBe(false);
    const credits = JSON.parse(byPath["src/_data/credits.json"].content);
    expect(credits).toHaveLength(2);
    expect(credits[1]).toMatchObject({
      file: `uploads/${slug}.jpg`, title: "Peloton on a climb (from Openverse)", author: "Jane Smith 7",
      site: "Flickr", license: "CC BY 2.0", source: "https://www.flickr.com/photos/jane/7",
    });

    expect(fake.calls.find((c) => c.method === "PATCH").body).toEqual({ sha: "commit2" });
  });

  test("save: if Openverse is busy, uses the checked details from the page", async () => {
    const fake = fakeServices({ openverseStatus: 429, files: { "src/_data/credits.json": "[]" } });
    globalThis.fetch = fake.fetch;
    const res = await saveHandler(request("/api/ai/save", { draft: geminiDraft, photo: openverseImage(3), imageAlt: "Riders" }));
    expect(res.status).toBe(200);
    const credits = JSON.parse(Object.values(fake.blobs).find((b) => b.content?.startsWith("[")).content);
    expect(credits[0]).toMatchObject({ title: "Peloton 3", alt: "Riders" });

    // ...but never a licence that isn't allowed
    const bad = await saveHandler(request("/api/ai/save", { draft: geminiDraft, photo: openverseImage(3, { license: "by-nc" }) }));
    expect(bad.status).toBe(502);
  });

  test("save: without a photo, only the post is committed, and taken names get a number", async () => {
    const date = todayInAustin();
    const fake = fakeServices({ files: { [`src/journal/${date}-ride-easy-to-ride-fast.md`]: "taken" } });
    globalThis.fetch = fake.fetch;
    const { slug } = await (await saveHandler(request("/api/ai/save", { draft: geminiDraft, photo: null }))).json();
    expect(slug).toBe(`${date}-ride-easy-to-ride-fast-2`);
    const tree = fake.calls.find((c) => c.url.pathname.endsWith("/git/trees")).body.tree;
    expect(tree.map((t) => t.path)).toEqual([`src/journal/${slug}.md`]);
    expect(fake.calls.some((c) => c.url.hostname.includes("openverse"))).toBe(false);
  });
});

test.describe("Draft with AI: editor page @functional", () => {
  const login = (page) =>
    page.addInitScript(() => localStorage.setItem("decap-cms-user", JSON.stringify({ token: "gh-token", backendName: "github" })));
  const stubOutside = async (page) => {
    await page.route("https://unpkg.com/**", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
    await page.route(/api\.openverse\.org\/v1\/images\/.+\/thumb\//, (r) => r.fulfill({ status: 404 }));
    await page.route("https://live.staticflickr.com/**", (r) => r.fulfill({ status: 404 }));
  };

  test("the editor's + Journal post button offers Draft with AI or a blank post", async ({ page }) => {
    await stubOutside(page);
    await page.goto("/admin/");
    // Stand-in for the button the editor draws (it's a link to the new-post screen)
    await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "#/collections/journal/new";
      a.textContent = "+ Journal post";
      document.body.appendChild(a);
    });
    await page.getByRole("link", { name: "+ Journal post" }).click();
    await expect(page).not.toHaveURL(/#\/collections\/journal\/new/);
    await expect(page.getByRole("menuitem", { name: /Draft with AI/ })).toHaveAttribute("href", "/admin/draft/");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    await page.getByRole("link", { name: "+ Journal post" }).click();
    await page.getByRole("menuitem", { name: /Blank post/ }).click();
    await expect(page).toHaveURL(/#\/collections\/journal\/new$/);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("asks you to log in to the editor first", async ({ page }) => {
    await page.goto("/admin/draft/");
    await expect(page.getByRole("heading", { name: "Log in first" })).toBeVisible();
    await expect(page.locator("#notes")).toBeHidden();
  });

  test("notes → draft → pick a photo → saved and opened in the editor", async ({ page }) => {
    await login(page);
    await stubOutside(page);
    await page.route("**/api/ai/draft", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer gh-token");
      expect(route.request().postDataJSON()).toMatchObject({ notes: "Easy rides matter more than people think.", category: "Recovery" });
      await route.fulfill({ json: { draft: cleanDraft(geminiDraft) } });
    });
    const searches = [];
    await page.route(/api\.openverse\.org\/v1\/images\/\?/, async (route) => {
      const url = new URL(route.request().url());
      searches.push(url.searchParams.get("q"));
      expect(url.searchParams.get("license")).toBe("cc0,pdm,by,by-sa");
      const results = url.searchParams.get("q") === "peloton"
        ? [openverseImage(1), openverseImage(2, { title: "Solstice Parade cyclists" }), openverseImage(3, { license: "by-nc" })]
        : [openverseImage(4), openverseImage(1)];
      await route.fulfill({ json: { result_count: results.length, results } });
    });
    let saved;
    await page.route("**/api/ai/save", async (route) => {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { slug: "2026-11-22-ride-easy", editUrl: "/admin/#/collections/journal/entries/2026-11-22-ride-easy" } });
    });

    await page.goto("/admin/draft/");
    await page.locator("#notes").fill("Easy rides matter more than people think.");
    await page.locator("#topic").selectOption("Recovery");
    await page.getByRole("button", { name: "Write draft" }).click();

    await expect(page.locator("#title")).toHaveValue("Ride Easy to Ride Fast");
    await expect(page.locator("#body")).toHaveValue(/^## Slow Down/);
    // "No photo" + photos 1 and 4: the parade photo, the non-commercial one and the duplicate are left out
    await expect(page.locator('input[name="photo"]')).toHaveCount(3);
    expect(searches.sort()).toEqual(["cyclist", "peloton"]);
    await expect(page.getByText("Peloton 1")).toBeVisible();
    await expect(page.getByText(/by Jane Smith 4 · CC BY 2\.0/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Openverse" })).toHaveAttribute("href", "https://openverse.org");

    await page.locator(`input[name="photo"][value="${id(4)}"]`).check();
    await page.locator("#title").fill("Ride Easy, Race Fast");
    await page.locator("#alt").fill("A bunch of riders");
    await page.getByRole("button", { name: /Save draft/ }).click();

    await expect(page).toHaveURL(/\/admin\/#\/collections\/journal\/entries\/2026-11-22-ride-easy$/);
    expect(saved).toMatchObject({ imageAlt: "A bunch of riders", photo: { id: id(4), license: "by" }, draft: { title: "Ride Easy, Race Fast" } });
  });

  test("shows the server's message when something goes wrong", async ({ page }) => {
    await login(page);
    await page.route("**/api/ai/draft", (r) => r.fulfill({ status: 429, json: { error: "Gemini's free limit is used up for now." } }));
    await page.goto("/admin/draft/");
    await page.locator("#notes").fill("Some notes about recovery rides this week.");
    await page.getByRole("button", { name: "Write draft" }).click();
    await expect(page.locator("#notes-status")).toHaveText("Gemini's free limit is used up for now.");
    await expect(page.locator("#step-draft")).toBeHidden();
  });
});
