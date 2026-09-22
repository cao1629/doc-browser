import { Fzf, byLengthAsc, extendedMatch, type FzfResultItem } from "fzf";
import type { Entry } from "./types";

export type Match = FzfResultItem<Entry>;

export const RESULT_LIMIT = 300;

export function createSearch(entries: Entry[]): (query: string) => Match[] {
  const fzf = new Fzf(entries, {
    selector: (entry) => entry.path,
    match: extendedMatch,
    limit: RESULT_LIMIT,
    tiebreakers: [byLengthAsc],
    casing: "smart-case",
  });
  return (query) => (query.trim() === "" ? [] : fzf.find(query));
}
