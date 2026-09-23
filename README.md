# doc-browser

A local, offline documentation browser in the spirit of Dash: a fuzzy search box on the left, the documentation page on the right. Out of the box it searches the Rust standard library, tokio and the C++ reference from cppreference.com.

## Requirements

- Node 24.5 or newer, for `node:sqlite` and the `--use-env-proxy` flag
- A Rust toolchain with the `rust-docs` component (`rustup component add rust-docs`)

## Run

```sh
npm install
npm run docs
npm run build
npm start
```

Then open http://localhost:3000. Set `PORT` to use another port.

`npm run docs` builds the docs for the Rust crates listed in `crates/Cargo.toml` and downloads the Dash docsets listed in `docsets.json`. The C++ docset is a 173 MB download and takes about 630 MB on disk. Later runs rebuild the crate docs in a few seconds and download a docset again only when a new version is out.

## Adding Rust crates

Besides the standard library, the app searches the crates listed as dependencies in `crates/Cargo.toml`. tokio is listed by default:

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

To add another crate, list it there, then rebuild the docs and restart the server:

```sh
npm run docs
npm start
```

`npm run docs` runs `cargo doc`, which also documents the dependencies of the listed crates, so a link from tokio to `bytes::BufMut` opens locally. Only the listed crates are searched, and each one gets its own toggle above the results. Links to std, core and the Rust books open the local toolchain docs instead of doc.rust-lang.org.

To search everything a project depends on, generate its docs and pass the output directory:

```sh
cargo doc --manifest-path path/to/project/Cargo.toml
npm start -- path/to/project/target/doc
```

That directory shows up as one more toggle.

## Adding docsets

`docsets.json` lists the Dash docsets to download, by the name Dash uses for the docset's download feed. C++ is listed by default:

```json
[
  "C++"
]
```

To add another docset, such as `Go` or `NodeJS`, add its name there, then download it and restart the server:

```sh
npm run docs:docsets
npm start
```

The script reads the feed at `https://kapeli.com/feeds/<name>.xml`, downloads the archive from the mirror that answers fastest, and unpacks it into `docsets/`. Each docset gets its own toggle above the results.

## Searching

The query uses fzf syntax. Plain text is a fuzzy match against the full path, so `Result`, `io::Result` and `std::io::Result` all work, and so do members such as `Vec::push`, `Read::read` or `Option::Some`. C++ entries are matched against their cppreference titles, so `vector push_back` finds `std::vector<T, Allocator>::push_back`, and `static_cast` finds both the keyword and the conversion page. `'Vec` matches exactly, `^std` pins the start, `Result$` pins the end, `!arch` leaves something out, and a space means both terms must match.

Arrow keys move through the results and open the page, Enter opens the selected one, Escape clears the query, and Cmd+K or Ctrl+K focuses the search box. The query and the open page are kept in the URL, so a reload or a bookmark brings them back.

## How it works

The server builds the index once at startup. For each Rust crate it reads `all.html`, which lists every item at its public path, and adds the modules and keyword pages. Redirect pages that rustdoc leaves at private paths are skipped, so each item appears once. Pages of structs, enums, unions, traits, type aliases and primitives are read as well, and their own methods, associated consts and types, enum variants and struct fields are indexed by anchor (`Vec::push` points at `struct.Vec.html#method.push`). Methods that come from trait implementations are left out, since every type would otherwise contribute `clone`, `fmt` and the like.

A docset is indexed from its `docSet.dsidx` SQLite file through `node:sqlite`. Both index layouts that Dash docsets use are read: the plain `searchIndex` table, and the Core Data tables of Apple-style docsets such as C++.

What you read is the original page, including rustdoc's own theme setting. std pages and docset pages are served untouched. Pages of other Rust crates are served with each doc.rust-lang.org link pointed at the local toolchain docs whenever the linked file exists there.

## Development

```sh
npm run dev
```

This runs the index server on port 3000 and Vite on port 5173 with `/api` and `/docs` proxied to the server.
