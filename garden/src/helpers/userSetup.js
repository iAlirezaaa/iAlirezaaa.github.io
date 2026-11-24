function userMarkdownSetup(md) {
  // The md parameter stands for the markdown-it instance used throughout the site generator.
  // Feel free to add any plugin you want here instead of /.eleventy.js
}
function userEleventySetup(eleventyConfig) {
  // The eleventyConfig parameter stands for the the config instantiated in /.eleventy.js.
  // Keep the template interoperable with the main Persian publication routes.
  eleventyConfig.addFilter("hadesUrl", value => {
    if (!value) return "/fa/garden/";
    const text = String(value);
    if (!text.startsWith("/") || text.startsWith("//") || /^\/(?:fa|hades)(?:\/|$)/.test(text)) return text;
    return "/fa/garden/" + text.slice(1);
  });
  eleventyConfig.addFilter("hadesDate", value => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fa-IR-u-ca-persian", {timeZone:"Asia/Tehran",dateStyle:"long"}).format(date);
  });
  eleventyConfig.addFilter("hadesNumber", value => new Intl.NumberFormat("fa-IR").format(value));
  eleventyConfig.addFilter("hadesISODate", value => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  });
  eleventyConfig.addPassthroughCopy("src/site/fonts");
  eleventyConfig.ignores.add("src/site/fonts/**/*.md");
}
exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;
