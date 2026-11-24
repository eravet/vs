// POST /api/publish  ->  { ok }
// The editor's "Go live" button. Saves from the editor don't deploy by themselves (see the
// `ignore` rule in netlify.toml), so this starts a deploy through a Netlify build hook.
// Needs BUILD_HOOK_URL (Project configuration > Developer settings > Continuous deployment >
// Build hooks), kept in Netlify's environment variables because anyone with it can start builds.
import { handle, env, requireEditor, HttpError } from "../lib/ai-draft.mjs";

export default handle(async (req) => {
  const gh = await requireEditor(req);
  const hook = env("BUILD_HOOK_URL");
  if (!/^https:\/\/api\.netlify\.com\/build_hooks\/[\w-]+$/.test(hook)) {
    throw new HttpError(500, "BUILD_HOOK_URL in Netlify doesn't look like a Netlify build hook address.");
  }
  const user = await gh.get("/user").catch(() => null);
  const title = `Go live from the editor${user?.login ? ` (${user.login})` : ""}`;
  let res;
  try {
    res = await fetch(`${hook}?trigger_title=${encodeURIComponent(title)}`, {
      method: "POST",
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Netlify to start the update. Try again in a minute.");
  }
  if (!res.ok) throw new HttpError(502, `Netlify didn't start the update (${res.status}). Check the build hook in Netlify.`);
  return { ok: true };
});

export const config = { path: "/api/publish" };
