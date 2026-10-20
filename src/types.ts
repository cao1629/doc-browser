export type Kind =
  | "struct"
  | "enum"
  | "union"
  | "trait"
  | "fn"
  | "macro"
  | "type"
  | "const"
  | "static"
  | "keyword"
  | "mod"
  | "method"
  | "variant"
  | "field"
  | "class"
  | "function"
  | "operator"
  | "header"
  | "guide"
  | "tag"
  | "attribute"
  | "directive"
  | "variable"
  | "property";

export interface Entry {
  id: number;
  kind: Kind;
  name: string;
  path: string;
  href: string;
  root: number;
}

export interface DocRoot {
  label: string;
  dir: string;
}

export interface DocIndex {
  roots: DocRoot[];
  entries: Entry[];
}

export interface IndexResponse {
  roots: DocRoot[];
  entries: Omit<Entry, "id">[];
}

export function docUrl(entry: Entry): string {
  return `/docs/${entry.root}/${entry.href}`;
}
