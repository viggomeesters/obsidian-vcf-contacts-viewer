import esbuild from "esbuild";
import process from "node:process";

const prod = process.env.NODE_ENV === "production";

await esbuild.build({
  banner: {
    js: "/* VCF Contacts Viewer - MIT License */",
  },
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian"],
  format: "cjs",
  logLevel: "info",
  minify: prod,
  outfile: "main.js",
  platform: "browser",
  sourcemap: prod ? false : "inline",
  target: "es2018",
  treeShaking: true,
});
