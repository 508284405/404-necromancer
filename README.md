# 404 Necromancer

404 Necromancer is a local laboratory for broken links in a static website. It scans HTML anchor `href` values, explains a deterministic repair, and changes a link only after you confirm it. The repaired tree can be downloaded as a ZIP plus a JSON report. Nothing in an imported page is executed, rendered as HTML, or fetched.

This repository is a private draft prepared for the Kiroween 2026 Costume Contest. It has not been submitted, published, or deployed.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:41773`. During development, `npm run dev` serves the same port.

1. Choose **Load Fixture**.
2. Read the two issues. `docs/start.htm` is missing; the file on disk is `docs/start.html`. `../guide.html#install` points at a page whose id is `setup`. The logo link `../assets/logo.svg?v=1` is valid, and the query is kept.
3. Select an issue. The preview shows the current href and the confirmed replacement.
4. Choose **Apply confirmed repair**. The other issue stays.
5. Choose **Undo last repair** to restore the previous bytes.
6. Choose **Export repaired ZIP and report**. The browser downloads `necromancer-repaired.zip` and `necromancer-report.json`. The report lists paths, warnings, selected repairs, and unresolved issues. It does not include file bodies.

You can also choose a local directory. The scan stops before analysis if the directory has more than 200 files or more than 10 MiB of content.

## Static hosting

`npm run build` writes a self-contained site to `dist/`. The Vite `base` is `./`, so the folder works on a project URL such as GitHub Pages. `dist/` is not committed; generate it with the command above.

Suggested GitHub Pages steps, after you decide to publish:

1. Create a public GitHub repository and push this source, including `LICENSE` and `.kiro/`. Do not add `.kiro` to `.gitignore`.
2. Run `npm run build`.
3. Publish the contents of `dist/` as the Pages site (for example, upload `dist/` to a `gh-pages` branch, or point Pages at a build that publishes `dist/`).
4. Open the Pages URL and load the fixture. The fixture files are copied into `dist/fixtures/`.

No public URL is included here. Publishing the repository, Pages, YouTube, and the Devpost form still require your approval.

## What the analysis will and will not do

- It reads only `a[href]` attributes and HTML `id` values.
- Relative links resolve from the source file's directory. A leading `/` is the imported root, not the computer's filesystem.
- `..` that stays inside that root is allowed. Traversal past the root, drive letters, UNC paths, and `file:` URLs are rejected.
- `https:`, `mailto:`, `tel:`, `data:`, `javascript:`, and protocol-relative URLs are labeled unsupported and are not requested.
- A `<base>` element produces a warning. Resolution is not treated as browser-equivalent.
- Suggestions are not applied until you confirm one. Ambiguous matches are not chosen automatically.
- Imported markup is shown as text. The page does not use remote fonts, analytics, or model calls.
- ZIP import is not supported. The ZIP writer only creates an archive.

## Tests

```bash
npm test
npx tsc -p tsconfig.json --noEmit
```

The suite covers caps, traversal rejection, Unicode byte offsets, fragment-only repairs, undo after a length-changing href, and ZIP/report export. The latest log is `evidence/vitest-submit-ready.txt`.

## Kiro files

`.kiro/` is part of the project and must stay in git. It contains the local-link-repair spec, the offline-safety steering note, and the test hook. See `SUBMISSION.md` for which parts Kiro CLI wrote and which parts were completed outside Kiro.

## License

MIT. See `LICENSE`.
