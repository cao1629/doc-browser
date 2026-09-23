import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const kindOfType = new Map([
  ["cl", "class"],
  ["clm", "method"],
  ["instm", "method"],
  ["intfm", "method"],
  ["func", "function"],
  ["tdef", "type"],
  ["clconst", "const"],
  ["econst", "const"],
  ["Constant", "const"],
  ["instp", "property"],
  ["data", "variable"],
  ["Global", "variable"],
  ["File", "header"],
]);

const appleIndexQuery = `
  select t.ztokenname as name, y.ztypename as type, f.zpath || coalesce('#' || nullif(m.zanchor, ''), '') as path
  from ztoken t
  join ztokenmetainformation m on t.zmetainformation = m.z_pk
  join zfilepath f on m.zfile = f.z_pk
  join ztokentype y on t.ztokentype = y.z_pk`;

function lastSegment(title) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title[i];
    if (char === "<" || char === "(") depth++;
    else if (char === ">" || char === ")") depth = Math.max(depth - 1, 0);
    else if (depth === 0 && char === ",") return title;
    else if (depth === 0 && char === ":" && title[i + 1] === ":") start = i + 2;
  }
  return title.slice(start);
}

function readIndex(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
    const query = tables.includes("searchIndex") ? "select name, type, path from searchIndex" : appleIndexQuery;
    return db.prepare(query).all();
  } finally {
    db.close();
  }
}

export function scanDocset(indexFile) {
  return readIndex(indexFile).map((row) => ({
    kind: kindOfType.get(row.type) ?? row.type.toLowerCase(),
    name: lastSegment(row.name),
    path: row.name,
    href: row.path.replace(/<dash_[^>]*>/g, ""),
  }));
}

export function docsetRoots(projectDir) {
  const listFile = join(projectDir, "docsets.json");
  if (!existsSync(listFile)) return [];
  return JSON.parse(readFileSync(listFile, "utf8")).flatMap((name) => {
    const resources = join(projectDir, "docsets", `${name}.docset`, "Contents", "Resources");
    const index = join(resources, "docSet.dsidx");
    if (existsSync(index)) return [{ label: name, dir: join(resources, "Documents"), docsetIndex: index }];
    console.log(`${name} has no docs yet. Run npm run docs to download it.`);
    return [];
  });
}
