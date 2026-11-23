import { test, expect } from "@playwright/test";
import fs from "node:fs";
import yaml from "js-yaml";
import {
  cleanDraft, buildPostFile, buildPrompt, pexelsCredit, slugify, todayInAustin, CATEGORIES, DRAFT_SCHEMA,
} from "../../netlify/lib/ai-draft.mjs";
import draftHandler from "../../netlify/functions/ai-draft.mjs";
import saveHandler from "../../netlify/functions/ai-save.mjs";
import photosHandler from "../../netlify/functions/ai-photos.mjs";

// "Draft with AI" (src/admin/draft/ + netlify/functions/ai-*.mjs).
// The server code is tested with fake GitHub, Gemini and Pexels services, so no keys or network are needed.

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
  photo_searches: ["road cyclist countryside", "group ride"],
};

const pexelsPhoto = (id, alt = "Cyclist on a road") => ({
  id, alt, width: 4000, height: 2667,
  url: `https://www.pexels.com/photo/${id}/`,
  photographer: "Jane [Smith]",
  photographer_url: "https://www.pexels.com/@jane",
  src: {
    medium: `https://images.pexels.com/photos/${id}/m.jpeg`,
    large: `https://images.pexels.com/photos/${id}/l.jpeg`,
    large2x: `https://images.pexels.com/photos/${id}/l2.jpeg`,
  },
});

// Fakes the three services the functions call. Records every request.
function fakeServices({ push = true, files = {} } = {}) {
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
      if (p === "/repos/eravet/vs3") return ok({ permissions: { push } });
      const file = /^\/repos\/eravet\/vs3\/contents\/(.+)$/.exec(p);
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
    if (url.hostname === "api.pexels.com") {
      if (p === "/v1/search") {
        const q = url.searchParams.get("query");
        return ok({ photos: q === "group ride" ? [pexelsPhoto(2), pexelsPhoto(3)] : [pexelsPhoto(1), pexelsPhoto(2)] });
      }
      const photo = /^\/v1\/photos\/(\d+)$/.exec(p);
      if (photo) return ok(pexelsPhoto(Number(photo[1]), "Cyclist climbing a hill"));
    }
    if (url.hostname === "images.pexels.com") {
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
    process.env.PEXELS_API_KEY = "test-pexels-key";
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

  test("the AI's reply format only allows the site's topics", () => {
    expect(DRAFT_SCHEMA.properties.category.enum).toEqual(journal.fields.find((f) => f.name === "category").options);
  });

  test("a saved draft has every field the editor needs and stays unpublished @critical", () => {
    const draft = cleanDraft({ ...geminiDraft, title: 'Quotes "and" colons: fine' });
    const file = buildPostFile(draft, {
      date: "2026-11-22", image: "/assets/images/uploads/pexels-1.jpg", imageAlt: "A rider", credit: pexelsCredit(pexelsPhoto(1)),
    });
    const fm = yaml.load(file.split("---")[1]);
    const required = journal.fields.filter((f) => f.required !== false && f.name !== "body").map((f) => f.name);
    for (const name of required) expect(fm, `missing ${name}`).toHaveProperty(name);
    expect(fm.title).toBe('Quotes "and" colons: fine');
    expect(fm.published).toBe(false);
    expect(fm.image_credit).toBe("Photo: [Jane Smith](https://www.pexels.com/@jane) on [Pexels](https://www.pexels.com/photo/1/)");
    expect(file).toContain("## Slow Down");
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

  test("draft: writes with Gemini using the editable settings, then finds photos", async () => {
    const fake = fakeServices({ files: { "src/_data/ai_writing.json": settingsFile, "src/journal/2025-01-01-example.md": "---\ntitle: Example\n---\nExample body" } });
    globalThis.fetch = fake.fetch;
    const res = await draftHandler(request("/api/ai/draft", { notes: "Easy rides matter more than people think." }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.draft.title).toBe("Ride Easy to Ride Fast");
    expect(data.draft.body.startsWith("## Slow Down")).toBe(true);
    // Results from both searches, interleaved, without duplicates
    expect(data.photos.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(data.photoError).toBe("");

    const gemini = fake.calls.find((c) => c.url.hostname === "generativelanguage.googleapis.com");
    expect(gemini.headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(gemini.url.pathname).toContain("gemini-3.6-flash:generateContent");
    const system = gemini.body.systemInstruction.parts[0].text;
    expect(system).toContain("Write like Mark. Keep it short.");
    expect(system).toContain("Example body");
    expect(gemini.body.generationConfig.responseJsonSchema).toEqual(DRAFT_SCHEMA);
    // The unsafe example path was ignored, not fetched
    expect(fake.calls.some((c) => c.url.pathname.includes("passwd"))).toBe(false);
    // Keys never go back to the browser
    expect(JSON.stringify(data)).not.toContain("test-");
  });

  test("photos: searches Pexels with Mark's own words", async () => {
    const fake = fakeServices();
    globalThis.fetch = fake.fetch;
    const res = await photosHandler(request("/api/ai/photos", { query: "group ride", page: 2 }));
    expect((await res.json()).photos.map((p) => p.id)).toEqual([2, 3]);
    const search = fake.calls.find((c) => c.url.hostname === "api.pexels.com");
    expect(search.headers.authorization).toBe("test-pexels-key");
    expect(search.url.searchParams.get("page")).toBe("2");
  });

  test("save: commits the post, photo and credit in one go @critical", async () => {
    const fake = fakeServices({ files: { "src/_data/credits.json": '[\n  {\n    "file": "site/hero.jpg"\n  }\n]\n' } });
    globalThis.fetch = fake.fetch;
    const res = await saveHandler(request("/api/ai/save", { draft: geminiDraft, photoId: "7", imageAlt: "" }));
    expect(res.status).toBe(200);
    const { slug, editUrl } = await res.json();
    expect(slug).toBe(`${todayInAustin()}-ride-easy-to-ride-fast`);
    expect(editUrl).toBe(`/admin/#/collections/journal/entries/${slug}`);

    const tree = fake.calls.find((c) => c.url.pathname.endsWith("/git/trees")).body;
    expect(tree.base_tree).toBe("tree1");
    const byPath = Object.fromEntries(tree.tree.map((t) => [t.path, fake.blobs[t.sha]]));
    expect(Object.keys(byPath).sort()).toEqual(["src/_data/credits.json", "src/assets/images/uploads/pexels-7.jpg", `src/journal/${slug}.md`]);

    expect(Buffer.from(byPath["src/assets/images/uploads/pexels-7.jpg"].content, "base64").toString()).toBe("fake jpeg bytes");
    const fm = yaml.load(byPath[`src/journal/${slug}.md`].content.split("---")[1]);
    expect(fm.image).toBe("/assets/images/uploads/pexels-7.jpg");
    expect(fm.image_alt).toBe("Cyclist climbing a hill");
    expect(fm.published).toBe(false);
    const credits = JSON.parse(byPath["src/_data/credits.json"].content);
    expect(credits).toHaveLength(2);
    expect(credits[1]).toMatchObject({ file: "uploads/pexels-7.jpg", site: "Pexels", author: "Jane [Smith]" });

    expect(fake.calls.find((c) => c.method === "PATCH").body).toEqual({ sha: "commit2" });
  });

  test("save: without a photo, only the post is committed, and taken names get a number", async () => {
    const date = todayInAustin();
    const fake = fakeServices({ files: { [`src/journal/${date}-ride-easy-to-ride-fast.md`]: "taken" } });
    globalThis.fetch = fake.fetch;
    const { slug } = await (await saveHandler(request("/api/ai/save", { draft: geminiDraft, photoId: "" }))).json();
    expect(slug).toBe(`${date}-ride-easy-to-ride-fast-2`);
    const tree = fake.calls.find((c) => c.url.pathname.endsWith("/git/trees")).body.tree;
    expect(tree.map((t) => t.path)).toEqual([`src/journal/${slug}.md`]);
    expect(fake.calls.some((c) => c.url.hostname.includes("pexels"))).toBe(false);
  });
});

test.describe("Draft with AI: editor page @functional", () => {
  const login = (page) =>
    page.addInitScript(() => localStorage.setItem("decap-cms-user", JSON.stringify({ token: "gh-token", backendName: "github" })));

  test("the editor has a Draft with AI button", async ({ page }) => {
    await page.route("https://unpkg.com/**", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
    await page.goto("/admin/");
    await expect(page.getByRole("link", { name: /Draft with AI/ })).toHaveAttribute("href", "/admin/draft/");
  });

  test("asks you to log in to the editor first", async ({ page }) => {
    await page.goto("/admin/draft/");
    await expect(page.getByRole("heading", { name: "Log in first" })).toBeVisible();
    await expect(page.locator("#notes")).toBeHidden();
  });

  test("notes → draft → pick a photo → saved and opened in the editor", async ({ page }) => {
    await login(page);
    await page.route("https://unpkg.com/**", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
    await page.route("https://images.pexels.com/**", (r) => r.fulfill({ status: 404 }));
    await page.route("**/api/ai/draft", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer gh-token");
      expect(route.request().postDataJSON()).toMatchObject({ notes: "Easy rides matter more than people think.", category: "Recovery" });
      await route.fulfill({
        json: {
          draft: cleanDraft(geminiDraft),
          photos: [{ ...pexelsPhoto(1, "Cyclist on a road"), thumb: pexelsPhoto(1).src.medium }, { ...pexelsPhoto(2, "Group ride"), thumb: pexelsPhoto(2).src.medium }],
          photoError: "",
        },
      });
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
    await expect(page.locator('input[name="photo"]')).toHaveCount(3); // "No photo" + 2 photos
    await expect(page.locator("#alt")).toHaveValue("Cyclist on a road");
    await expect(page.getByRole("link", { name: "Pexels" }).first()).toHaveAttribute("href", "https://www.pexels.com");

    await page.locator('input[name="photo"][value="2"]').check();
    await expect(page.locator("#alt")).toHaveValue("Group ride");
    await page.locator("#title").fill("Ride Easy, Race Fast");
    await page.getByRole("button", { name: /Save draft/ }).click();

    await expect(page).toHaveURL(/\/admin\/#\/collections\/journal\/entries\/2026-11-22-ride-easy$/);
    expect(saved).toMatchObject({ photoId: "2", imageAlt: "Group ride", draft: { title: "Ride Easy, Race Fast", category: "Training Tips" } });
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
