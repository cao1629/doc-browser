import express from "express";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { listedCrates } from "./crates.mjs";
import { docsetRoots, scanDocset } from "./docsets.mjs";
import { scanRoot } from "./scan.mjs";

const port = Number(process.env.PORT) || 3000;
const here = dirname(fileURLToPath(import.meta.url));
const cratesDir = join(here, "..", "crates");
const cratesDocDir = join(cratesDir, "target", "doc");
const rustDocsLink = /https:\/\/doc\.rust-lang\.org\/(?:(?:\d+\.\d+\.\d+|stable|beta|nightly)\/)?([^"'#?\s\\]+)/g;

function stdDocsDir() {
  const sysroot = execSync("rustc --print sysroot", { encoding: "utf8" }).trim();
  return join(sysroot, "share/doc/rust/html");
}

function labelFor(dir) {
  if (basename(dir) === "doc" && basename(dirname(dir)) === "target") return basename(dirname(dirname(dir)));
  return basename(dir);
}

function crateRoots() {
  if (!existsSync(cratesDocDir)) {
    console.log("The crates in crates/Cargo.toml have no docs yet. Run npm run docs to build them.");
    return [];
  }
  let crates;
  try {
    crates = listedCrates(join(cratesDir, "Cargo.toml"));
  } catch (error) {
    console.log(`Couldn't read crates/Cargo.toml. Run npm run docs to rebuild the crate docs.\n${error.stderr || error.message}`);
    return [];
  }
  return crates.flatMap((crate) => {
    if (existsSync(join(cratesDocDir, crate, "all.html"))) return [{ label: crate, dir: cratesDocDir, crates: [crate] }];
    console.log(`${crate} has no docs yet. Run npm run docs to build them.`);
    return [];
  });
}

function localLinkRewriter(stdDir) {
  const existing = new Map();
  return (text) =>
    text.replace(rustDocsLink, (url, path) => {
      if (!existing.has(path)) existing.set(path, existsSync(join(stdDir, path)));
      return existing.get(path) ? `/docs/0/${path}` : url;
    });
}

function serveWithLocalLinks(dir, rewrite) {
  return async (req, res, next) => {
    const ext = extname(req.path);
    if (ext !== ".html" && ext !== ".js") return next();
    let text;
    try {
      const file = resolve(dir, `.${decodeURIComponent(req.path)}`);
      if (!file.startsWith(dir + sep)) return next();
      text = await readFile(file, "utf8");
    } catch {
      return next();
    }
    res.type(ext).send(rewrite(text));
  };
}

const roots = [
  { label: "Rust std", dir: stdDocsDir() },
  ...crateRoots(),
  ...docsetRoots(join(here, "..")),
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
const entries = roots.flatMap((root, i) =>
  (root.docsetIndex ? scanDocset(root.docsetIndex) : scanRoot(root.dir, root.crates)).map((entry) => ({ ...entry, root: i })),
);
console.log(`indexed ${entries.length} items from ${roots.length} root(s) in ${Date.now() - started} ms`);
const indexJson = JSON.stringify({ roots, entries });

const app = express();
app.get("/api/index", (_req, res) => {
  res.type("application/json").send(indexJson);
});
const rewriteLinks = localLinkRewriter(roots[0].dir);
roots.forEach((root, i) => {
  if (i > 0 && !root.docsetIndex) app.use(`/docs/${i}`, serveWithLocalLinks(root.dir, rewriteLinks));
  app.use(`/docs/${i}`, express.static(root.dir));
});

const dist = join(here, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(join(dist, "index.html")));
}

app.listen(port, () => {
  for (const root of roots) console.log(`${root.label}: ${root.dir}`);
  console.log(`http://localhost:${port}`);
});
