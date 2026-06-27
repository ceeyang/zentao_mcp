import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  // Bundle runtime deps so colleagues only need Node.js after npm install.
  noExternal: [/@modelcontextprotocol\//, /^zod$/],
});