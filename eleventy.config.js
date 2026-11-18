import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import markdownIt from "markdown-it";

export default function (eleventyConfig) {
  // Static assets that need no processing
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/brand": "assets/brand" });
  // Originals stay available (the CMS previews them, and social cards link them)
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });

  eleventyConfig.addWatchTarget("src/assets/");

  // Every <img> in the output becomes responsive AVIF/WebP/JPEG with width/height set.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "auto"],
    widths: [480, 960, 1600],
    urlPath: "/img/",
    outputDir: "_site/img/",
    failOnError: false,
    transformOnRequest: false,
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
      pictureAttributes: {},
    },
  });

  // ---------- Collections ----------
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/journal/*.md")
      .filter((p) => p.data.published !== false)
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("categories", (api) => {
    const set = new Set();
    api.getFilteredByGlob("src/journal/*.md").forEach((p) => p.data.category && set.add(p.data.category));
    return [...set].sort();
  });

  // ---------- Filters ----------
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  eleventyConfig.addFilter("readableDate", (d) => {
    const date = new Date(d);
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readingTime", (content = "") => {
    const words = String(content).replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  });
  eleventyConfig.addFilter("slugify", (s = "") =>
    String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  );
  eleventyConfig.addFilter("sortByOrder", (arr = []) => [...arr].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));
  eleventyConfig.addFilter("where", (arr = [], key, val) => arr.filter((x) => x[key] === val));
  eleventyConfig.addFilter("limit", (arr = [], n) => arr.slice(0, n));
  eleventyConfig.addFilter("exclude", (arr = [], url) => arr.filter((x) => x.url !== url));
  eleventyConfig.addFilter("absoluteUrl", (path, base) => new URL(path || "/", base).href);
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  // ---------- Markdown ----------
  const md = markdownIt({ html: true, linkify: true, typographer: true });
  // Open external links in a new tab
  const defaultRender = md.renderer.rules.link_open || ((t, i, o, e, self) => self.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href") || "";
    if (/^https?:\/\//.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noopener");
    }
    return defaultRender(tokens, idx, options, env, self);
  };
  eleventyConfig.setLibrary("md", md);
  // For the CMS's longer text fields (bio, answers) and short captions
  eleventyConfig.addFilter("renderMarkdown", (s = "") => md.render(String(s)));
  eleventyConfig.addFilter("renderInline", (s = "") => md.renderInline(String(s)));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "11ty.js"],
  };
}
