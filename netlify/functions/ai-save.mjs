// POST /api/ai/save  { draft, photo?, imageAlt? }  ->  { slug, editUrl }
// Saves the draft as an unpublished Journal post, in one commit with its Openverse photo and a
// /credits/ entry. Mark then reviews it in the editor and publishes it himself.
import {
  handle, readBody, requireEditor, cleanDraft, getOpenversePhoto, isOpenverseId, downloadUrl, readFile,
  fileExists, commitFiles, buildPostFile, photoCredit, licenseLabel, sourceName, slugify, todayInAustin, HttpError,
} from "../lib/ai-draft.mjs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export default handle(async (req) => {
  const gh = await requireEditor(req);
  const body = await readBody(req);
  const draft = cleanDraft(body.draft);
  const date = todayInAustin();

  const base = `${date}-${slugify(draft.title) || "draft"}`;
  let slug = base;
  for (let n = 2; await fileExists(gh, `src/journal/${slug}.md`); n++) {
    if (n > 20) throw new HttpError(409, "A post with this title already exists. Change the title and try again.");
    slug = `${base}-${n}`;
  }

  const files = [];
  let image = "";
  let imageAlt = "";
  let credit = "";

  const chosen = body.photo && typeof body.photo === "object" ? body.photo : null;
  if (chosen?.id) {
    if (!isOpenverseId(chosen.id)) throw new HttpError(400, "That photo ID isn't valid.");
    // Look the photo up again rather than trusting details sent by the browser.
    const photo = await getOpenversePhoto(String(chosen.id).toLowerCase(), chosen);

    let res;
    try {
      res = await fetch(downloadUrl(photo), { headers: { "user-agent": "velo-savvy-editor/1.0 (https://www.velo-savvy.com)" }, signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new HttpError(502, "Couldn't download that photo. Try another one.");
    }
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok || !EXTENSIONS[type]) throw new HttpError(502, "Couldn't download that photo. Try another one.");
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(502, "That photo is too large. Try another one.");

    const name = `${slug}.${EXTENSIONS[type]}`;
    image = `/assets/images/uploads/${name}`;
    imageAlt = String(body.imageAlt ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || draft.image_alt || photo.title;
    credit = photoCredit(photo);
    files.push({ path: `src/assets/images/uploads/${name}`, base64: bytes.toString("base64") });

    const credits = JSON.parse((await readFile(gh, "src/_data/credits.json")) || "[]");
    credits.push({
      file: `uploads/${name}`,
      used_for: `Journal: ${draft.title}`,
      alt: imageAlt,
      title: photo.title,
      author: photo.creator || sourceName(photo),
      site: sourceName(photo),
      source: photo.landing_url || photo.url,
      license: licenseLabel(photo),
      license_url: photo.license_url,
    });
    files.push({ path: "src/_data/credits.json", text: JSON.stringify(credits, null, 2) + "\n" });
  }

  files.push({ path: `src/journal/${slug}.md`, text: buildPostFile(draft, { date, image, imageAlt, credit }) });
  await commitFiles(gh, files, `Add journal “${slug}” (AI draft)`);
  return { slug, editUrl: `/admin/#/collections/journal/entries/${slug}` };
});

export const config = { path: "/api/ai/save" };
