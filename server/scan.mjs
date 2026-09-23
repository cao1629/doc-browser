import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
const allItemsLink = /<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g;
const itemFile = /^([a-z]+)\.(.+)\.html$/;

function isRedirect(file) {
  return readFileSync(file, "utf8").includes("<title>Redirection</title>");
}

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

function scanModules(rootDir, crate) {
  const modules = [];

  function walk(modulePath) {
    const dir = join(rootDir, ...modulePath);
    const index = join(dir, "index.html");
    if (existsSync(index) && !isRedirect(index)) {
      modules.push({
        kind: "mod",
        name: modulePath[modulePath.length - 1],
        path: modulePath.join("::"),
        href: [...modulePath, "index.html"].join("/"),
      });
    }
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (dirent.isDirectory()) walk([...modulePath, dirent.name]);
    }
  }

  walk([crate]);
  return modules;
}

function itemLinks(rootDir, crate) {
  const allItems = readFileSync(join(rootDir, crate, "all.html"), "utf8");
  const listed = [...allItems.matchAll(allItemsLink)].map(([, href, text]) => ({ href, path: `${crate}::${text}` }));
  const keywords = readdirSync(join(rootDir, crate))
    .filter((file) => file.startsWith("keyword."))
    .map((file) => ({ href: file, path: `${crate}::${file.slice("keyword.".length, -".html".length)}` }));
  return [...listed, ...keywords];
}

function scanCrate(rootDir, crate) {
  const entries = scanModules(rootDir, crate);
  for (const link of itemLinks(rootDir, crate)) {
    const match = itemFile.exec(link.href.slice(link.href.lastIndexOf("/") + 1));
    const kind = match && kindOfPrefix.get(match[1]);
    if (!kind) continue;
    const entry = { kind, name: match[2], path: link.path, href: `${crate}/${link.href}` };
    entries.push(entry);
    if (pagesWithMembers.has(match[1])) entries.push(...scanMembers(join(rootDir, crate, link.href), entry));
  }
  return entries;
}

export function scanRoot(rootDir, crates) {
  const names = crates ?? readdirSync(rootDir).filter((name) => existsSync(join(rootDir, name, "all.html")));
  const seen = new Set();
  return names
    .flatMap((crate) => scanCrate(rootDir, crate))
    .filter((entry) => {
      const key = `${entry.kind} ${entry.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
