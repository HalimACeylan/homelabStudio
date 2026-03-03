import { defineConfig } from "vite";

export default defineConfig({
  // Base path is injected by the deploy workflow as BASE_URL=/<repo-name>/
  // This auto-adapts to repo renames without needing to change this file.
  // For local dev (npm run dev) and CI checks, no BASE_URL is set → defaults to "/"
  base: process.env.BASE_URL || "/",
});
