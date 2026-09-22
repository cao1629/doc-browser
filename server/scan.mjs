import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const kindOfPrefix = new Map([
  ["struct", "struct"],
  ["enum", "enum"],
  ["union", "union"],
  ["trait", "trait"],
  ["traitalias", "trait"],
  ["fn", "fn"],
  ["macro", "macro"],
  ["derive", "macro"],
  ["attr", "macro"],
  ["type", "type"],
  ["primitive", "type"],
  ["constant", "const"],
  ["static", "static"],
  ["keyword", "keyword"],
]);

export function scanRoot(rootDir) {
  const entries = [];

  function walk(dir, modulePath) {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        walk(full, [...modulePath, dirent.name]);
        continue;
      }
      if (!dirent.name.endsWith(".html")) continue;
      const href = relative(rootDir, full).split(sep).join("/");
      if (dirent.name === "index.html") {
        entries.push({ kind: "mod", name: modulePath[modulePath.length - 1], path: modulePath.join("::"), href });
        continue;
      }
      const match = /^([a-z]+)\.(.+)\.html$/.exec(dirent.name);
      if (!match) continue;
      const kind = kindOfPrefix.get(match[1]);
      if (!kind) continue;
      entries.push({ kind, name: match[2], path: [...modulePath, match[2]].join("::"), href });
    }
  }

  for (const name of readdirSync(rootDir)) {
    if (existsSync(join(rootDir, name, "all.html"))) walk(join(rootDir, name), [name]);
  }
  return entries;
}
