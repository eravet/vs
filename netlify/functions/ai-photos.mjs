// POST /api/ai/photos  { query, page? }  ->  { photos }
// Lets Mark search Pexels with his own words from the "Draft with AI" page.
import { handle, readBody, env, requireEditor, searchPexels, HttpError } from "../lib/ai-draft.mjs";

export default handle(async (req) => {
  await requireEditor(req);
  const body = await readBody(req);
  const query = String(body.query ?? "").trim().slice(0, 80);
  if (!query) throw new HttpError(400, "Type what the photo should show.");
  const page = Math.min(20, Math.max(1, Number.parseInt(body.page, 10) || 1));
  return { photos: await searchPexels(query, { apiKey: env("PEXELS_API_KEY"), perPage: 9, page }) };
});

export const config = { path: "/api/ai/photos" };
