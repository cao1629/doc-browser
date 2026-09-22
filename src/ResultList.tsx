import { useEffect, useRef } from "react";
import type { Match } from "./search";

interface Segment {
  text: string;
  hit: boolean;
}

function segments(text: string, offset: number, positions: ReadonlySet<number>): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = positions.has(offset + i);
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += text[i];
    else out.push({ text: text[i], hit });
  }
  return out;
}

function Highlighted({ text, offset, positions }: { text: string; offset: number; positions: ReadonlySet<number> }) {
  return segments(text, offset, positions).map((segment, i) =>
    segment.hit ? (
      <mark key={i}>{segment.text}</mark>
    ) : (
      <span key={i}>{segment.text}</span>
    ),
  );
}

export function ResultList({
  results,
  selected,
  onSelect,
}: {
  results: Match[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <ul ref={listRef} className="results" role="listbox" aria-label="Results">
      {results.map((result, index) => {
        const { path, name, kind, root, href } = result.item;
        const nameStart = path.length - name.length;
        return (
          <li
            key={`${root}/${href}`}
            role="option"
            aria-selected={index === selected}
            className={`row kind-${kind}${index === selected ? " selected" : ""}`}
            onClick={() => onSelect(index)}
          >
            <span className="kind">{kind}</span>
            <span className="path">
              <span className="prefix">
                <Highlighted text={path.slice(0, nameStart)} offset={0} positions={result.positions} />
              </span>
              <span className="name">
                <Highlighted text={name} offset={nameStart} positions={result.positions} />
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
