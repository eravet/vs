// /deploy-info.json: which commit the live site was built from. The editor's "Go live" button
// compares it with the latest commit on GitHub to show how many saved changes aren't live yet.
// COMMIT_REF is set by Netlify during builds; it's empty for local builds.
export const data = {
  permalink: "/deploy-info.json",
  eleventyExcludeFromCollections: true,
};

export function render() {
  return JSON.stringify({ commit: process.env.COMMIT_REF || "", built_at: new Date().toISOString() });
}
