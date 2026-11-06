# 404 Necromancer - Requirements

## Project Overview
- **Project Name**: 404 Necromancer
- **Type**: Local static-site broken-link lab
- **Core Functionality**: Scan HTML files for broken links, provide deterministic suggestions, and apply byte-level fixes
- **Target Users**: Web developers and site maintainers working with static HTML sites

## Functional Requirements

### Core Features
1. **File Loading**
   - Load bundled abandoned-site fixture on startup
   - Accept user-chosen directory through file input (`webkitdirectory`)
   - Reject >200 files or >10 MiB of file content with clear message

2. **Link Scanning**
   - Scan only HTML `a[href]` links (not img/script/css URLs)
   - Resolve relative hrefs against source file's directory
   - Leading `/` is virtual root, never host filesystem

3. **Issue Detection**
   - Identify missing files
   - Identify missing fragment/ids in HTML targets
   - Support queries (preserve them exactly)
   - Classify unsupported schemes (https:, mailto:, tel:, data:, javascript:, protocol-relative)

4. **Suggestion System**
   - Provide deterministic suggestions separate from confirmed edits
   - Never auto-pick among equal candidates
   - Handle ambiguous cases (duplicate ids, case-colliding paths) as diagnostics

5. **Edit Application**
   - Preview byte-level diff of selected href span before apply
   - Apply only the confirmed href value span
   - Preserve quoting, other attributes, whitespace, unrelated bytes, query strings
   - Keep immutable original bytes

6. **Undo/Redo**
   - Undo restores exact prior bytes and selection state
   - Reapplying same confirmed edit is idempotent

### Resolution Rules
- Split path, query, and fragment before normalization
- Empty path means current file
- Empty href and fragment-only links are valid
- Non-empty fragment checked against ids in target HTML
- Reject `..` escaping virtual root, absolute paths, drive letters, UNC, `file:`
- Malformed percent-escapes produce diagnostic (not throw)
- Decoded `%2e%2e` must not escape root
- `<base>` element unsupported: warn and don't pretend browser-equivalent
- HTML ids are fragment targets; non-HTML targets don't produce "missing id"

### Baseline Issues (Fixture)
1. `fixtures/abandoned-site/index.html` - href `docs/start.htm` missing (real file: `docs/start.html`)
2. `fixtures/abandoned-site/docs/start.html` - href `../guide.html#install` has missing id `install` (nearby id: `setup`)
3. `fixtures/abandoned-site/docs/start.html` - href `../assets/logo.svg?v=1` resolves correctly (not an issue)

### Edge Cases to Handle
- Fragment-only links (e.g., `#section`)
- Empty fragment (e.g., `page.html#`)
- Missing id in target
- Present id in target
- Unicode/multibyte text around href spans
- Encoded traversal (`%2e%2e`)
- Duplicate ids in target HTML

## Acceptance Criteria
1. App runs with `npm run dev` on port 41773, host 0.0.0.0, strictPort
2. Two issues displayed for baseline fixture
3. Selecting an issue shows byte-level diff
4. Applying suggestion changes only href span, preserves everything else
5. Undo restores exact original bytes
6. File count >200 rejected with message
7. Content >10 MiB rejected with message
8. Unsupported schemes classified, not requested
9. Tests pass: `npm test` exits 0

## UI Requirements
- Single screen layout
- Keyboard reachable controls
- Visible labels, readable contrast
- Haunted heading acceptable
- Information visible with reduced motion

## Technical Constraints
- React + TypeScript + Vite UI
- Pure TypeScript core
- Vitest for tests
- No paid APIs, no model calls
- No external fetching

## Later completion outside Kiro
- ZIP export of the repaired tree
- JSON report that omits file bodies
- Local link graph with a text list
- Export control in the UI
- Relative Vite base for static hosting
- Fixed UTF-8 byte offsets
- Undo when the replacement href has a different length
- Fragment suggestions replace only the fragment (not the full href)
- file: URLs are rejected and must not be fetched