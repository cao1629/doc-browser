import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { DocFrame } from "./DocFrame";
import { ResultList } from "./ResultList";
import { RESULT_LIMIT, createSearch } from "./search";
import { docUrl, type DocIndex, type Entry, type IndexResponse } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; index: DocIndex };

function initialQuery(): string {
  return new URLSearchParams(location.search).get("q") ?? "";
}

function initialDoc(): string | null {
  return location.hash.startsWith("#/docs/") ? location.hash.slice(1) : null;
}

export default function App() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [hiddenRoots, setHiddenRoots] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState(0);
  const [docSrc, setDocSrc] = useState<string | null>(initialDoc);
  const inputRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    fetch("/api/index")
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<IndexResponse>;
      })
      .then((index) =>
        setLoad({
          status: "ready",
          index: { roots: index.roots, entries: index.entries.map((entry, id) => ({ ...entry, id })) },
        }),
      )
      .catch((error: unknown) =>
        setLoad({ status: "error", message: error instanceof Error ? error.message : String(error) }),
      );
  }, []);

  const roots = load.status === "ready" ? load.index.roots : [];
  const entries = load.status === "ready" ? load.index.entries : [];
  const search = useMemo(
    () => createSearch(entries.filter((entry) => !hiddenRoots.has(entry.root))),
    [entries, hiddenRoots],
  );
  const results = useMemo(() => search(deferredQuery), [search, deferredQuery]);

  useEffect(() => {
    setSelected(0);
  }, [results]);

  useEffect(() => {
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    url.hash = docSrc ?? "";
    history.replaceState(null, "", url);
  }, [query, docSrc]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        focusSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusSearch]);

  const open = useCallback((entry: Entry) => setDocSrc(docUrl(entry)), []);

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuery("");
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(Math.max(selected + step, 0), results.length - 1);
      setSelected(next);
      open(results[next].item);
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(results[selected].item);
    }
  }

  function toggleRoot(index: number) {
    setHiddenRoots((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    inputRef.current?.focus();
  }

  const total = entries.length.toLocaleString();
  const sources = new Intl.ListFormat("en").format(roots.map((root) => root.label));
  const status =
    load.status !== "ready"
      ? ""
      : query === ""
        ? `${total} items indexed`
        : `${results.length}${results.length >= RESULT_LIMIT ? "+" : ""} of ${total} items`;

  return (
    <div className="app">
      <aside className="side">
        <input
          ref={inputRef}
          className="search"
          type="search"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          placeholder="Search docs"
          aria-label="Search docs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
        />
        {roots.length > 1 && (
          <div className="roots" role="group" aria-label="Documentation sets">
            {roots.map((root, index) => (
              <button
                key={root.dir}
                type="button"
                className={hiddenRoots.has(index) ? "root off" : "root"}
                aria-pressed={!hiddenRoots.has(index)}
                title={root.dir}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleRoot(index)}
              >
                {root.label}
              </button>
            ))}
          </div>
        )}
        <div className="list">
          {load.status === "loading" && <p className="note">Reading the index…</p>}
          {load.status === "error" && (
            <p className="note">
              Couldn't load the index ({load.message}). Start the server with <code>npm run dev</code> and reload.
            </p>
          )}
          {load.status === "ready" && query === "" && (
            <p className="note">
              Search {total} items from {sources}. Type a name like <code>Result</code> or{" "}
              <code>unique_ptr</code>, a path like <code>std::io::Result</code>, or a method like{" "}
              <code>Vec::push</code> or <code>vector::push_back</code>. Use <code>'Vec</code> for an exact match,{" "}
              <code>^std</code> to pin the start, and <code>!arch</code> to leave something out. Arrow keys move,
              Enter opens.
            </p>
          )}
          {load.status === "ready" && query !== "" && results.length === 0 && (
            <p className="note">Nothing matches "{deferredQuery}".</p>
          )}
          {results.length > 0 && (
            <ResultList
              results={results}
              selected={selected}
              onSelect={(index) => {
                setSelected(index);
                open(results[index].item);
                inputRef.current?.focus();
              }}
            />
          )}
        </div>
        <footer className="status">{status}</footer>
      </aside>
      <main className="doc">
        <DocFrame src={docSrc} onSearchShortcut={focusSearch} />
      </main>
    </div>
  );
}
