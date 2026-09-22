# rust-doc-browser

A local, offline browser for Rust documentation in the spirit of Dash: a fuzzy search box on the left, the rustdoc page on the right.

## Requirements

- Node 20 or newer
- A Rust toolchain with the `rust-docs` component (`rustup component add rust-docs`)

## Run

```sh
npm install
npm run build
npm start
```

Then open http://localhost:3000. Set `PORT` to use another port.

To search a project's dependencies as well, generate their docs and pass the output directory:

```sh
cargo doc --manifest-path path/to/project/Cargo.toml
npm start -- path/to/project/target/doc
```

Each directory shows up as a toggle above the results.

## Searching

The query uses fzf syntax. Plain text is a fuzzy match against the full path, so `Result`, `io::Result` and `std::io::Result` all work. `'Vec` matches exactly, `^std` pins the start, `Result$` pins the end, `!arch` leaves something out, and a space means both terms must match.

Arrow keys move through the results and open the page, Enter opens the selected one, Escape clears the query, and Cmd+K or Ctrl+K focuses the search box. The query and the open page are kept in the URL, so a reload or a bookmark brings them back.

## How it works

The server walks each documentation directory once at startup and indexes every `kind.Name.html` page by its module path; a module's `index.html` is indexed as `mod`. Pages are served untouched from the original directory, so what you read is the rustdoc output itself, including its own theme setting.

## Development

```sh
npm run dev
```

This runs the index server on port 3000 and Vite on port 5173 with `/api` and `/docs` proxied to the server.
