// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Static output is the default; stated explicitly for clarity.
  output: "static",
  build: {
    // Keep styles as external files: the nginx CSP allows style-src 'self' only,
    // so nothing may be inlined into <style> tags in the built HTML.
    inlineStylesheets: "never",
  },
});
