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
  | "field";

export interface Entry {
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

export function docUrl(entry: Entry): string {
  return `/docs/${entry.root}/${entry.href}`;
}
