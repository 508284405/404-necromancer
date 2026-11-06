# 404 Necromancer - Design

## Architecture Overview

### Layer Structure
```
┌─────────────────────────────────────┐
│         React + TypeScript UI        │
├─────────────────────────────────────┤
│        Link Scanner Service          │
├─────────────────────────────────────┤
│    File System Abstraction Layer     │
├─────────────────────────────────────┤
│       Node.js fs (via Vite)          │
└─────────────────────────────────────┘
```

### Core Modules

#### 1. LinkScanner (link-scanner.ts)
- Parses HTML files to extract `a[href]` attributes
- Resolves relative hrefs against source directory
- Categorizes links: valid, missing-file, missing-fragment, unsupported-scheme
- Returns structured LinkIssue[]

#### 2. HrefResolver (href-resolver.ts)
- Splits href into path, query, fragment
- Resolves path against base directory
- Validates against virtual root (rejects `..` escaping root)
- Checks file existence
- Checks fragment against target HTML ids
- Handles percent-encoding edge cases

#### 3. BytePatcher (byte-patcher.ts)
- Operates on raw file bytes (Uint8Array)
- Locates href span in original bytes
- Applies targeted replacement
- Maintains immutable original bytes
- Supports undo by storing original bytes

#### 4. HtmlParser (html-parser.ts)
- Extracts all anchor tags with href attributes
- Uses simple regex-based parsing (no full HTML parser for security)
- Returns position info (start/end byte offsets)

### Data Structures

```typescript
interface LinkIssue {
  filePath: string;
  hrefValue: string;
  hrefStart: number;
  hrefEnd: number;
  issueType: 'missing-file' | 'missing-fragment' | 'unsupported-scheme' | 'malformed-url';
  suggestion?: string;
  details?: string;
}

interface FileAnalysis {
  filePath: string;
  issues: LinkIssue[];
  originalBytes: Uint8Array;
}

interface Edit {
  filePath: string;
  hrefStart: number;
  hrefEnd: number;
  originalHref: string;
  newHref: string;
  originalBytes: Uint8Array;
}
```

### UI Components

```
┌─────────────────────────────────────────────────────┐
│  404 Necromancer - Broken Link Laboratory           │
├─────────────────────────────────────────────────────┤
│  [Load Fixture] [Choose Directory...]               │
├─────────────────────────────────────────────────────┤
│  Issues Found: 2                                    │
│  ┌─────────────────────────────────────────────────┐│
│  │ ● index.html → docs/start.htm (missing)         ││
│  │   Suggestion: docs/start.html                   ││
│  ├─────────────────────────────────────────────────┤│
│  │ ● docs/start.html → ../guide.html#install      ││
│  │   Missing id "install", nearby: setup           ││
│  └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│  Selected: index.html → docs/start.htm              │
│  ┌─────────────────────────────────────────────────┐│
│  │ - docs/start.htm                                ││
│  │ + docs/start.html                               ││
│  └─────────────────────────────────────────────────┘│
│  [Apply Fix] [Undo]                                  │
└─────────────────────────────────────────────────────┘
```

### Resolution Algorithm

```
1. Parse href into (path, query, fragment)
2. If scheme present:
   - If scheme in unsupported list → classify as unsupported
   - Otherwise → classify as unsupported
3. If path starts with / → reject (virtual root)
4. If path contains ..:
   - Decode percent-escapes
   - Check if resolves outside virtual root → reject
5. Resolve path against source file directory
6. If file doesn't exist → missing-file issue
7. If fragment present:
   - If target is HTML → parse for ids
   - If id not found → missing-fragment issue (list nearby ids)
   - If target not HTML → no id check needed
8. If all valid → link is OK
```

### Byte-Level Diff Algorithm

1. Read file as Uint8Array
2. Find href attribute value span using HTML position info
3. Construct new bytes for replacement
4. Show diff: original substring → new substring
5. On apply: create new Uint8Array with only href span replaced

### Undo System

- Store Edit objects in stack
- Each Edit contains: filePath, hrefStart, hrefEnd, originalBytes
- Undo: re-apply original bytes to same span
- Edit history persists in memory during session

## Technical Choices

### Why Pure TypeScript Core
- Testable without React rendering
- Can run in browser via Vite's dev server
- No Node.js-only dependencies

### Why Byte-Level Operations
- Precision: only change what's needed
- Safety: preserve encoding, special characters
- Verifiability: exact byte comparison

### Why Regex-Based HTML Parsing
- Avoids security risks of parsing arbitrary HTML
- Sufficient for extracting anchor hrefs
- No script execution risk

### Security Considerations
- Never render imported HTML as HTML
- No iframe, innerHTML, insertAdjacentHTML, document.write
- Show paths/issues/diffs as escaped text
- Don't request imported resources
- No script execution from scanned files

## Later completion outside Kiro
- Added ZIP export of repaired tree plus JSON report that omits file bodies
- Added local link graph with a text list
- Added export control in the UI
- Used relative Vite base for static hosting
- Fixed UTF-8 byte offsets in byte-patcher
- Undo now works when the replacement href has a different length
- Fragment suggestions now replace only the fragment portion, not the full href
- file: URLs are rejected and must not be fetched