// POST /api/ai/save  { draft, photoId?, imageAlt? }  ->  { slug, editUrl }
// Saves the draft as an unpublished Journal post, in one commit with its Pexels photo and a
// /credits/ entry. Mark then reviews it in the editor and publishes it himself.
import {
  handle, readBody, env, requireEditor, cleanDraft, getPexelsPhoto, readFile, fileExists, commitFiles,
  buildPostFile, pexelsCredit, slugify, todayInAustin, HttpError,
} from "../lib/ai-draft.mjs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default handle(async (req) => {
  const gh = await requireEditor(req);
  const body = await readBody(req);
  const draft = cleanDraft(body.draft);
  const date = todayInAustin();
  const files = [];
  let image = "";
  let imageAlt = "";
  let credit = "";

  if (body.photoId != null && body.photoId !== "") {
    const id = String(body.photoId);
    if (!/^\d{1,12}$/.test(id)) throw new HttpError(400, "That photo ID isn't valid.");
    // Look the photo up again rather than trusting details sent by the browser.
    const photo = await getPexelsPhoto(id, env("PEXELS_API_KEY"));
    const name = `pexels-${id}.jpg`;
    const path = `src/assets/images/uploads/${name}`;
    image = `/assets/images/uploads/${name}`;
    imageAlt = String(body.imageAlt ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || photo.alt || draft.image_alt;
    credit = pexelsCredit(photo);

    if (!(await fileExists(gh, path))) {
      const url = new URL(photo.download || "");
      if (url.protocol !== "https:" || url.hostname !== "images.pexels.com") throw new HttpError(502, "Pexels sent an unexpected photo address.");
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) throw new HttpError(502, "Couldn't download that photo from Pexels. Try another.");
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(502, "That photo is too large. Try another.");
      files.push({ path, base64: bytes.toString("base64") });

      const credits = JSON.parse((await readFile(gh, "src/_data/credits.json")) || "[]");
      credits.push({
        file: `uploads/${name}`,
        used_for: `Journal: ${draft.title}`,
        alt: imageAlt,
        title: imageAlt,
        author: photo.photographer,
        site: "Pexels",
        source: photo.url,
        license: "Pexels License",
        license_url: "https://www.pexels.com/license/",
      });
      files.push({ path: "src/_data/credits.json", text: JSON.stringify(credits, null, 2) + "\n" });
    }
  }

  const base = `${date}-${slugify(draft.title) || "draft"}`;
  let slug = base;
  for (let n = 2; await fileExists(gh, `src/journal/${slug}.md`); n++) {
    if (n > 20) throw new HttpError(409, "A post with this title already exists. Change the title and try again.");
    slug = `${base}-${n}`;
  }
  files.push({ path: `src/journal/${slug}.md`, text: buildPostFile(draft, { date, image, imageAlt, credit }) });

  await commitFiles(gh, files, `Add journal “${slug}” (AI draft)`);
  return { slug, editUrl: `/admin/#/collections/journal/entries/${slug}` };
});

export const config = { path: "/api/ai/save" };
