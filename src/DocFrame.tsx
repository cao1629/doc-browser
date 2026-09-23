import { useState, type SyntheticEvent } from "react";

interface Page {
  url: string;
  title: string;
}

export function DocFrame({ src, onSearchShortcut }: { src: string | null; onSearchShortcut: () => void }) {
  const [page, setPage] = useState<Page | null>(null);

  if (src === null) {
    return (
      <div className="doc-empty">
        <p>Pick a result to read its page here.</p>
      </div>
    );
  }

  function onLoad(event: SyntheticEvent<HTMLIFrameElement>) {
    const frame = event.currentTarget.contentWindow;
    if (!frame) return;
    setPage({ url: frame.location.pathname + frame.location.hash, title: frame.document.title });
    frame.addEventListener("keydown", (keyEvent) => {
      if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key === "k") {
        keyEvent.preventDefault();
        onSearchShortcut();
      }
    });
  }

  return (
    <div className="doc-frame">
      <div className="doc-bar">
        <span className="doc-title">{page?.title ?? "Loading…"}</span>
        <a className="doc-open" href={page?.url ?? src} target="_blank" rel="noreferrer">
          Open in a new tab
        </a>
      </div>
      <iframe title={page?.title ?? "Documentation"} src={src} onLoad={onLoad} />
    </div>
  );
}
