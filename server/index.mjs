import express from "express";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanRoot } from "./scan.mjs";

const port = Number(process.env.PORT) || 3000;
const here = dirname(fileURLToPath(import.meta.url));

function stdDocsDir() {
  const sysroot = execSync("rustc --print sysroot", { encoding: "utf8" }).trim();
  return join(sysroot, "share/doc/rust/html");
}

function labelFor(dir) {
  if (basename(dir) === "doc" && basename(dirname(dir)) === "target") return basename(dirname(dirname(dir)));
  return basename(dir);
}

const roots = [
  { label: "std", dir: stdDocsDir() },
  ...process.argv.slice(2).map((arg) => {
    const dir = resolve(arg);
    return { label: labelFor(dir), dir };
  }),
];
for (const root of roots) {
  if (!existsSync(root.dir)) {
    console.error(`doc directory not found: ${root.dir}`);
    process.exit(1);
  }
}

const started = Date.now();
const entries = roots.flatMap((root, i) => scanRoot(root.dir).map((entry) => ({ ...entry, root: i })));
console.log(`indexed ${entries.length} items from ${roots.length} root(s) in ${Date.now() - started} ms`);
const indexJson = JSON.stringify({ roots, entries });

const app = express();
app.get("/api/index", (_req, res) => {
  res.type("application/json").send(indexJson);
});
roots.forEach((root, i) => app.use(`/docs/${i}`, express.static(root.dir)));

const dist = join(here, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(join(dist, "index.html")));
}

app.listen(port, () => {
  for (const root of roots) console.log(`${root.label}: ${root.dir}`);
  console.log(`http://localhost:${port}`);
});
