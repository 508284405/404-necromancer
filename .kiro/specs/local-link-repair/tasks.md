# 404 Necromancer - Tasks

## Phase 1: Project Setup (Priority: Critical)
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure vite.config.ts: port 41773, host 0.0.0.0, strictPort
- [ ] Install Vitest and configure
- [ ] Verify empty shell runs with `npm run dev`

## Phase 2: Core TypeScript Modules (Priority: Critical)
- [ ] Implement href-resolver.ts - URL parsing, path resolution, validation
- [ ] Implement html-parser.ts - Extract a[href] with byte positions
- [ ] Implement link-scanner.ts - Orchestrate parsing and resolution
- [ ] Implement byte-patcher.ts - Byte-level edit operations

## Phase 3: Fixture Creation (Priority: Critical)
- [ ] Create fixtures/abandoned-site/index.html with href to docs/start.htm
- [ ] Create fixtures/abandoned-site/docs/start.html with hrefs to ../guide.html#install and ../assets/logo.svg?v=1
- [ ] Create fixtures/abandoned-site/guide.html with id="setup" (not "install")
- [ ] Create fixtures/abandoned-site/assets/logo.svg placeholder

## Phase 4: React UI (Priority: Critical)
- [ ] Create main App component
- [ ] Implement file loading (fixture and directory input)
- [ ] Implement issues list display
- [ ] Implement diff preview component
- [ ] Implement apply/undo functionality
- [ ] Add keyboard navigation support

## Phase 5: Tests (Priority: Critical)
- [ ] Test: Missing docs/start.htm suggests docs/start.html
- [ ] Test: Missing fragment install suggests setup
- [ ] Test: Query v=1 survives
- [ ] Test: Traversal beyond root rejected (including encoded)
- [ ] Test: Fragment-only link valid
- [ ] Test: Empty fragment valid
- [ ] Test: Missing id produces issue
- [ ] Test: Present id passes
- [ ] Test: Unicode bytes preserved around href span
- [ ] Test: Undo restores exact original bytes
- [ ] Test: Reject 201 files
- [ ] Test: Reject content over 10 MiB
- [ ] Test: Unsupported schemes classified

## Phase 6: Edge Cases & Polish (Priority: High)
- [ ] Handle malformed percent-escapes gracefully
- [ ] Handle duplicate ids in target HTML
- [ ] Handle base element (warn, don't resolve)
- [ ] Verify contrast and accessibility

## Phase 7: Integration Verification (Priority: Critical)
- [ ] Run npm test and ensure all tests pass
- [ ] Verify fixture loads correctly
- [ ] Verify two issues displayed
- [ ] Verify apply works correctly
- [ ] Verify undo restores bytes

## Later completion outside Kiro
- Implemented ZIP export of repaired tree
- Implemented JSON report with file bodies omitted
- Implemented local link graph with text list
- Added export control UI
- Configured relative Vite base for static hosting
- Fixed UTF-8 byte offset handling
- Fixed undo for different-length href replacements
- Fixed fragment suggestions to replace only fragment portion
- Added rejection of file: URLs