// POST /api/ai/draft  { notes, category? }  ->  { draft, photos, photoError }
// Writes a Journal draft with Gemini from Mark's notes, then finds matching Pexels photos.
// Nothing is saved here; ai-save.mjs does that once Mark picks a photo.
import {
  handle, readBody, env, requireEditor, loadWritingSettings, buildPrompt, callGemini, photosFor,
  todayInAustin, HttpError, CATEGORIES, DEFAULT_MODEL,
} from "../lib/ai-draft.mjs";

export default handle(async (req) => {
  const gh = await requireEditor(req);
  const body = await readBody(req);
  const notes = String(body.notes ?? "").trim().slice(0, 20_000);
  if (notes.length < 20) throw new HttpError(400, "Write a few sentences of notes first.");
  const category = CATEGORIES.includes(body.category) ? body.category : "";

  const apiKey = env("GEMINI_API_KEY");
  const settings = await loadWritingSettings(gh);
  const prompt = buildPrompt({ settings, notes, category, today: todayInAustin() });
  const draft = await callGemini({ ...prompt, apiKey, model: process.env.GEMINI_MODEL || DEFAULT_MODEL });
  if (category) draft.category = category;

  let photos = [];
  let photoError = "";
  if (!process.env.PEXELS_API_KEY) {
    photoError = "PEXELS_API_KEY isn't set in Netlify, so no photos were searched.";
  } else {
    const queries = draft.photo_searches.length ? draft.photo_searches : ["road cycling"];
    try {
      photos = await photosFor(queries, { apiKey: process.env.PEXELS_API_KEY });
    } catch (err) {
      photoError = err.message;
    }
    if (!photos.length && !photoError) photoError = "No photos matched. Try your own search below.";
  }
  return { draft, photos, photoError };
});

export const config = { path: "/api/ai/draft" };
