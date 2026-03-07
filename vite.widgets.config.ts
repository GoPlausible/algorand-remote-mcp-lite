import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

export default defineConfig({
  root: "web/",
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "web", INPUT),
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
