// POST /api/ai/draft  { notes, category? }  ->  { draft }
// Writes a Journal draft with Gemini from Mark's notes. The draft includes photo searches,
// which the page runs on Openverse itself. Nothing is saved here; ai-save.mjs does that.
import {
  handle, readBody, env, requireEditor, loadWritingSettings, buildPrompt, callGemini,
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
  if (!draft.photo_searches.length) draft.photo_searches = ["bicycle race", "cyclist"];
  return { draft };
});

export const config = { path: "/api/ai/draft" };
