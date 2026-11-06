# Offline Safety Steering

## Security Principles

This project processes local HTML files for broken link detection. The following safety rules apply:

1. **Never render imported HTML**: Do not use innerHTML, insertAdjacentHTML, document.write, or iframes to display scanned content
2. **Escape all output**: Paths, issues, and diffs must be shown as escaped text
3. **No external requests**: Do not follow, fetch, or request any URLs found in HTML
4. **No script execution**: Scanned files may contain malicious scripts - never execute them
5. **Immutable operations**: Keep original file bytes unchanged until explicit user confirmation
6. **Path validation**: Reject paths that escape the virtual root or reference absolute filesystem paths

## Allowed Operations
- Read local files via Vite's dev server
- Parse HTML to extract anchor hrefs
- Check file existence on local filesystem
- Parse HTML for id attributes (fragment validation only)
- Byte-level editing of href spans

## Forbidden Operations
- External HTTP/HTTPS requests
- Executing any scripts from scanned files
- Rendering HTML content
- Following non-file URLs
- Accessing ~/.kiro, ~/.local/share/kiro-cli, or credentials

## Later completion outside Kiro
- Keep the hook that runs npm test after TypeScript saves
- Keep caps of 200 files and 10 MiB, explicit confirmation, inert HTML, and no remote crawling