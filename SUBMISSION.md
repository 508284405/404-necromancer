# 404 Necromancer — submission notes

These notes are prepared for the Kiroween 2026 Costume Contest. They are not a submission. Devpost registration, contest terms, a public GitHub repository, a public demo URL, and a public YouTube video have not been created or accepted.

## Category

Costume Contest. The interface uses a dark haunted laboratory theme. The repair actions, issue text, link graph, and keyboard path stay available without relying on animation.

## What it does

404 Necromancer inspects a local static site for broken HTML links and repairs only the links you confirm.

- Load the bundled abandoned-site fixture, or choose a directory of up to 200 files and 10 MiB.
- Scan `a[href]` only. Do not execute scripts, render imported HTML, or request imported URLs.
- Show missing files and missing fragment ids, with a deterministic suggestion and a before/after href preview.
- Apply one confirmed edit to the original href bytes. Undo restores the previous bytes, including when the new href is longer or shorter.
- Show a local link graph and a text list of the same edges.
- Download a ZIP of the current tree, including unchanged assets, and a JSON report. The report has assumptions, warnings, issue counts, selected repairs, unresolved issues, and paths. It does not contain file bodies.

The fixture has two confirmed problems: `index.html` links to `docs/start.htm` while the file is `docs/start.html`, and `docs/start.html` links to `../guide.html#install` while the page id is `setup`. `../assets/logo.svg?v=1` resolves, and the query stays.

## How to test

```bash
npm install
npm test
npx tsc -p tsconfig.json --noEmit
npm run build
npm run preview
```

Open `http://127.0.0.1:41773`, load the fixture, confirm one repair, undo it, and export the ZIP. `evidence/vitest-submit-ready.txt` is the saved test log.

## How Kiro was used

Kiro CLI 3.1.0 was used on this machine through the native free device login (Builder ID). The selected model was `minimax-m2.5`. Its configured fallback was `none`, and the vendor refusal fallback was `none`. Auto and Claude were not selected.

What that model actually produced:

- `.kiro/specs/local-link-repair/requirements.md`
- `.kiro/specs/local-link-repair/design.md`
- `.kiro/specs/local-link-repair/tasks.md`
- `.kiro/steering/offline-safety.md`
- `.kiro/hooks/tests.json`, which runs `npm test` after TypeScript saves
- The first application source, fixture, and Vitest files

The first implementation session reached the process time limit while resolver tests were still failing. A second `minimax-m2.5` session fixed path normalization and those tests passed. A later `minimax-m2.5` session appended a “Later completion outside Kiro” section to the spec, design, tasks, and steering files, and removed a steering sentence that would have allowed `file://` fetches. The hook file was already correct and was not rewritten.

Estimated Free usage after that spec update was 19.13 of 50 credits, resetting on 2026-12-01. The hackathon credit pool was not requested. No paid plan, overage, or API key was used.

Codex CLI was not installed on this machine (`codex` was not on `PATH`). The remaining product work was done in this workspace without Codex: ZIP export and the JSON report, the link graph, the export control, the relative production base, UTF-8 byte offsets, undo for a different-length href, fragment-only replacement, the MIT license, this write-up, and the README. Those edits are the “outside Kiro” work named in `.kiro/`.

## Still needs your approval

- Create a public GitHub repository (GitHub, not GitLab or Bitbucket), push this source, and keep `.kiro/` tracked.
- Publish the `dist/` build at a URL judges can open.
- Upload `evidence/404-necromancer-demo.mp4` to public YouTube. The file is under three minutes and has not been uploaded.
- Register on Devpost, accept the contest rules, and submit. Do that only after you review the rules, including IP, publicity, tax forms, arbitration, liability, and indemnification.

No prize is claimed or expected from this draft.
