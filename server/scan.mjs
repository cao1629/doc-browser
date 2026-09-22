import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const pagesWithMembers = new Set(["struct", "enum", "union", "trait", "traitalias", "type", "primitive"]);

const kindOfAnchor = new Map([
  ["method", "method"],
  ["tymethod", "method"],
  ["associatedconstant", "const"],
  ["associatedtype", "type"],
  ["variant", "variant"],
  ["structfield", "field"],
]);

const anchorPattern = /<(?:section|span) id="(method|tymethod|associatedconstant|associatedtype|variant|structfield)\.([^"]+)" class="([^"]*)"/g;

function scanMembers(file, parent) {
  const html = readFileSync(file, "utf8");
  const members = [];
  for (const [, prefix, id, className] of html.matchAll(anchorPattern)) {
    if (className.includes("trait-impl")) continue;
    const name = id.replace(/-\d+$/, "");
    members.push({
      kind: kindOfAnchor.get(prefix),
      name,
      path: `${parent.path}::${name}`,
      href: `${parent.href}#${prefix}.${id}`,
    });
  }
  return members;
}

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
      const entry = { kind, name: match[2], path: [...modulePath, match[2]].join("::"), href };
      entries.push(entry);
      if (pagesWithMembers.has(match[1])) entries.push(...scanMembers(full, entry));
    }
  }

  for (const name of readdirSync(rootDir)) {
    if (existsSync(join(rootDir, name, "all.html"))) walk(join(rootDir, name), [name]);
  }
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.kind} ${entry.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
