// Shared code for the editor's "Draft with AI" page (src/admin/draft/).
// Used by netlify/functions/ai-draft.mjs, ai-photos.mjs and ai-save.mjs.
//
// - Only people who can push to the site's GitHub repo can use it: the page sends the
//   GitHub token from the editor login, and every request checks it against the repo.
// - Gemini writes the draft (GEMINI_API_KEY). Pexels supplies photos (PEXELS_API_KEY).
//   Both keys live in Netlify's environment variables and never reach the browser.
// - Mark's editable instructions live in src/_data/ai_writing.json ("AI writing settings"
//   in the editor) and are read from GitHub on every request, so edits apply right away.

export const REPO = process.env.CONTENT_REPO || "eravet/vs3";
export const BRANCH = "main";
export const SETTINGS_PATH = "src/_data/ai_writing.json";
export const DEFAULT_MODEL = "gemini-3.6-flash";
export const CATEGORIES = ["Training Tips", "Nutrition", "Recovery", "Mindset", "Race Strategy", "Equipment"];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Wraps a function handler: POST only, JSON in and out, friendly error messages.
export function handle(fn) {
  return async (req, context) => {
    if (req.method !== "POST") return json(405, { error: "Use POST." });
    try {
      return json(200, await fn(req, context));
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error(err);
      return json(500, { error: "Something went wrong on the server. Try again in a minute." });
    }
  };
}

export async function readBody(req) {
  try {
    return (await req.json()) || {};
  } catch {
    throw new HttpError(400, "The request wasn't valid JSON.");
  }
}

export function env(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(500, `${name} isn't set in Netlify (Project configuration → Environment variables).`);
  return value;
}

const isTimeout = (err) => err?.name === "TimeoutError" || err?.name === "AbortError";

// ---------- GitHub ----------

export function github(token) {
  const call = async (method, path, body) => {
    const res = await fetch("https://api.github.com" + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "velo-savvy-editor",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) throw new HttpError(401, "Your editor login has expired. Log in to the editor again.");
    if (method === "GET" && res.status === 404) return null;
    if (!res.ok) {
      const err = new HttpError(502, `GitHub said ${res.status} to ${method} ${path.split("?")[0]}.`);
      err.githubStatus = res.status;
      throw err;
    }
    return res.json();
  };
  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body),
    patch: (path, body) => call("PATCH", path, body),
  };
}

// Checks the editor's GitHub token can push to the site's repo. Returns a GitHub client.
export async function requireEditor(req) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!match) throw new HttpError(401, "Log in to the editor first.");
  const gh = github(match[1]);
  const repo = await gh.get(`/repos/${REPO}`);
  if (!repo?.permissions?.push) throw new HttpError(403, "Your GitHub account can't edit this site. Ask for an invite to the repo.");
  return gh;
}

const contentsPath = (path) => `/repos/${REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${BRANCH}`;

export async function readFile(gh, path) {
  const file = await gh.get(contentsPath(path));
  if (!file || typeof file.content !== "string") return null;
  return Buffer.from(file.content, "base64").toString("utf8");
}

export const fileExists = async (gh, path) => Boolean(await gh.get(contentsPath(path)));

// Writes several files in one commit (one rebuild). Files: { path, text } or { path, base64 }.
export async function commitFiles(gh, files, message) {
  const base = `/repos/${REPO}`;
  for (let attempt = 1; ; attempt++) {
    const ref = await gh.get(`${base}/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const parent = await gh.get(`${base}/git/commits/${head}`);
    const tree = [];
    for (const f of files) {
      const blob = await gh.post(
        `${base}/git/blobs`,
        f.base64 != null ? { content: f.base64, encoding: "base64" } : { content: f.text, encoding: "utf-8" }
      );
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const newTree = await gh.post(`${base}/git/trees`, { base_tree: parent.tree.sha, tree });
    const commit = await gh.post(`${base}/git/commits`, { message, tree: newTree.sha, parents: [head] });
    try {
      await gh.patch(`${base}/git/refs/heads/${BRANCH}`, { sha: commit.sha });
      return commit.sha;
    } catch (err) {
      // Someone saved in the editor at the same moment: rebuild the commit on top of theirs.
      if (err.githubStatus === 422 && attempt < 3) continue;
      throw err;
    }
  }
}

// ---------- Settings ----------

const text = (v, max) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const oneLine = (v, max) => text(v, max).replace(/\s+/g, " ");

export async function loadWritingSettings(gh) {
  let s = {};
  try {
    s = JSON.parse((await readFile(gh, SETTINGS_PATH)) || "{}");
  } catch {
    s = {};
  }
  const slugs = (Array.isArray(s.example_posts) ? s.example_posts : [])
    .filter((slug) => typeof slug === "string" && /^[\w-]+$/.test(slug))
    .slice(0, 3);
  const examples = (await Promise.all(slugs.map((slug) => readFile(gh, `src/journal/${slug}.md`))))
    .filter(Boolean)
    .map((post) => post.slice(0, 15_000));
  return { instructions: text(s.instructions, 20_000), photoHints: text(s.photo_hints, 4_000), examples };
}

// ---------- Gemini ----------

export const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Headline, under 90 characters." },
    excerpt: { type: "string", description: "One or two sentences, under 220 characters." },
    category: { type: "string", enum: CATEGORIES },
    tags: { type: "array", items: { type: "string" }, description: "3 to 6 short keywords." },
    body: { type: "string", description: "The post in Markdown, starting with a ## heading." },
    image_alt: { type: "string", description: "Alt text describing a photo that would suit the post." },
    photo_searches: { type: "array", items: { type: "string" }, description: "2 or 3 Pexels searches, best first." },
  },
  required: ["title", "excerpt", "category", "tags", "body", "image_alt", "photo_searches"],
};

export function buildPrompt({ settings, notes, category, today }) {
  const system = [
    "You write first drafts of Journal posts for Velo-Savvy, a cycling coaching website.",
    "Mark Duroy, the coach, reviews and edits every draft before it is published.",
    "",
    "## Mark's instructions",
    settings.instructions || "Write in a warm, practical coaching voice for amateur road cyclists.",
    "",
    "## Rules (always follow these)",
    "- Reply with only the JSON object the schema describes.",
    "- title: a headline under 90 characters.",
    "- excerpt: one or two sentences, under 220 characters. It shows on the Journal page and in Google.",
    category
      ? `- category: Mark chose "${category}". Use it.`
      : `- category: the single best fit from: ${CATEGORIES.join(", ")}.`,
    "- tags: 3 to 6 short keywords.",
    "- body: the post in Markdown. Start with a ## heading. Never use a single # heading and don't repeat the title. No HTML, images or tables.",
    "- Facts: build the post on Mark's notes. Don't invent quotes, race results, numbers or studies. If you add a statistic, a study, or a fact about a real rider that isn't in the notes, put \"(⚠️ check)\" right after it so Mark verifies it before publishing.",
    "- image_alt: alt text for the kind of photo that would suit the post, e.g. \"Riders climbing a quiet country road\".",
    "- photo_searches: 2 or 3 short searches (2 to 4 words) for the Pexels stock photo library, best first, for a wide photo that suits the post. Describe what is visible in the photo, not abstract ideas.",
    "",
    "## Photo hints from Mark",
    settings.photoHints || "Prefer road cycling photos.",
  ];
  if (settings.examples.length) {
    system.push("", "## Example posts by Mark", "Match their voice and formatting. Don't reuse their content.");
    for (const post of settings.examples) system.push("<example>", post.trim(), "</example>");
  }
  const user = `Today is ${today}.\n\nMark's notes for this post:\n\n${notes}`;
  return { system: system.join("\n"), user };
}

export async function callGemini({ system, user, apiKey, model }) {
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: DRAFT_SCHEMA,
          maxOutputTokens: 16_384,
        },
      }),
      signal: AbortSignal.timeout(50_000),
    });
  } catch (err) {
    if (isTimeout(err)) throw new HttpError(504, "Gemini took too long to write the draft. Try again, or shorten your notes.");
    throw err;
  }
  if (res.status === 429) {
    throw new HttpError(429, "Gemini's free limit is used up for now. Wait a minute and try again. Daily limits reset at midnight Pacific time.");
  }
  if (!res.ok) {
    console.error("Gemini error", res.status, (await res.text()).slice(0, 2000));
    throw new HttpError(502, `Gemini returned an error (${res.status}). Try again in a minute.`);
  }
  const data = await res.json();
  if (data.promptFeedback?.blockReason) {
    throw new HttpError(422, `Gemini wouldn't write from these notes (${data.promptFeedback.blockReason}). Try rewording them.`);
  }
  const candidate = data.candidates?.[0];
  const reply = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new HttpError(502, "The draft came out too long and was cut off. Try again, or ask for a shorter post in your notes.");
  }
  if (!reply) throw new HttpError(502, `Gemini didn't return a draft (${candidate?.finishReason || "no reason given"}). Try again.`);
  try {
    return cleanDraft(JSON.parse(reply));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, "Gemini's reply wasn't in the expected format. Try again.");
  }
}

// Normalises a draft from Gemini, or from the page after Mark edited it.
export function cleanDraft(d = {}) {
  const title = oneLine(d.title, 150);
  const body = text(d.body, 60_000).replace(/^#[^#\n].*\n+/, "");
  if (!title || !body) throw new HttpError(422, "The draft needs a title and a post.");
  const list = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => oneLine(x, max)).filter(Boolean).slice(0, n);
  return {
    title,
    excerpt: oneLine(d.excerpt, 400),
    category: CATEGORIES.includes(d.category) ? d.category : CATEGORIES[0],
    tags: list(d.tags, 8, 40),
    body,
    image_alt: oneLine(d.image_alt, 200),
    photo_searches: list(d.photo_searches, 3, 60),
  };
}

// ---------- Pexels ----------

const toPhoto = (p) => ({
  id: p.id,
  thumb: p.src?.medium,
  preview: p.src?.large,
  download: p.src?.large2x,
  alt: p.alt || "",
  photographer: p.photographer || "Pexels photographer",
  photographer_url: p.photographer_url || "",
  url: p.url || "https://www.pexels.com",
  width: p.width,
  height: p.height,
});

async function pexels(path, apiKey) {
  let res;
  try {
    res = await fetch("https://api.pexels.com/v1" + path, { headers: { authorization: apiKey }, signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    if (isTimeout(err)) throw new HttpError(504, "Pexels didn't answer in time. Try again.");
    throw err;
  }
  if (res.status === 429) throw new HttpError(429, "The Pexels photo limit for this hour is used up. Try again later.");
  if (res.status === 404) throw new HttpError(404, "That photo is no longer on Pexels. Pick another one.");
  if (!res.ok) throw new HttpError(502, `Pexels returned an error (${res.status}).`);
  return res.json();
}

export async function searchPexels(query, { apiKey, perPage = 9, page = 1 }) {
  const params = new URLSearchParams({ query, orientation: "landscape", per_page: String(perPage), page: String(page) });
  const data = await pexels(`/search?${params}`, apiKey);
  return (data.photos || []).map(toPhoto);
}

// Runs each search and interleaves the results (best of each first), without duplicates.
export async function photosFor(queries, { apiKey, limit = 9 }) {
  const lists = await Promise.all(
    queries.map((q) =>
      searchPexels(q, { apiKey, perPage: 6 }).catch((err) => {
        if (err.status === 429) throw err;
        return [];
      })
    )
  );
  const seen = new Set();
  const out = [];
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const p = list[i];
      if (p && !seen.has(p.id) && out.length < limit) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}

export const getPexelsPhoto = async (id, apiKey) => toPhoto(await pexels(`/photos/${id}`, apiKey));

// ---------- Post file ----------

// A JSON string is also a valid YAML double-quoted string, which is the style the posts use.
const yamlString = (v) => JSON.stringify(String(v));

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
}

export const todayInAustin = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export function buildPostFile(draft, { date, image = "", imageAlt = "", credit = "" }) {
  const lines = [
    "---",
    `title: ${yamlString(draft.title)}`,
    `date: ${date}`,
    `excerpt: ${yamlString(draft.excerpt)}`,
    `category: ${yamlString(draft.category)}`,
    `tags: ${JSON.stringify(draft.tags)}`,
  ];
  if (image) lines.push(`image: ${yamlString(image)}`, `image_alt: ${yamlString(imageAlt)}`, `image_credit: ${yamlString(credit)}`);
  lines.push("published: false", "---", "", draft.body.trim(), "");
  return lines.join("\n");
}

// "Photo: [Name](profile) on [Pexels](photo page)", in the style of the other posts' credits.
export function pexelsCredit(photo) {
  const name = photo.photographer.replace(/[[\]]/g, "");
  const who = photo.photographer_url.startsWith("https://www.pexels.com/") ? `[${name}](${photo.photographer_url})` : name;
  const where = photo.url.startsWith("https://www.pexels.com/") ? `[Pexels](${photo.url})` : "Pexels";
  return `Photo: ${who} on ${where}`;
}
