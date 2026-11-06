/**
 * HrefResolver - URL parsing, path resolution, and validation
 * Handles resolution of relative hrefs against source file directory
 */

export interface ParsedHref {
  path: string;
  query: string;
  fragment: string;
  raw: string;
}

export interface ResolutionResult {
  success: boolean;
  resolvedPath?: string;
  isFile?: boolean;
  isHtml?: boolean;
  issueType?: 'missing-file' | 'missing-fragment' | 'unsupported-scheme' | 'malformed-url' | 'path-escape' | 'base-unsupported';
  suggestion?: string;
  details?: string;
  existingIds?: string[];
}

const UNSUPPORTED_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:', 'data:', 'javascript:', 'ftp:'];

/**
 * Parse href into path, query, and fragment components
 */
export function parseHref(href: string): ParsedHref {
  const result: ParsedHref = {
    path: '',
    query: '',
    fragment: '',
    raw: href,
  };

  if (!href) {
    return result;
  }

  // Check for scheme
  const schemeMatch = href.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    result.path = href;
    return result;
  }

  // Split off query and fragment from path
  let pathPart = href;

  // Find query start (?) and fragment start (#)
  const queryIndex = href.indexOf('?');
  const fragmentIndex = href.indexOf('#');

  // Determine which comes first (query or fragment)
  let queryStart = -1;
  let fragmentStart = -1;

  if (queryIndex !== -1 && (fragmentIndex === -1 || queryIndex < fragmentIndex)) {
    queryStart = queryIndex;
  }
  if (fragmentIndex !== -1) {
    fragmentStart = fragmentIndex;
  }

  // Handle fragment
  if (fragmentStart !== -1) {
    result.fragment = href.substring(fragmentStart + 1);
    pathPart = href.substring(0, fragmentStart);
  }

  // Handle query
  if (queryStart !== -1) {
    result.query = pathPart.substring(queryStart + 1);
    pathPart = pathPart.substring(0, queryStart);
  }

  result.path = pathPart;

  return result;
}

/**
 * Check if a relative path would escape when resolved against a base
 * Returns true if the resolved path goes above the base
 */
function wouldEscape(resolvedPath: string, virtualRoot: string): boolean {
  // Get the normalized virtual root
  const rootNormalized = virtualRoot.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  
  // Get the resolved path without leading/trailing slashes
  const resolvedNormalized = resolvedPath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  
  // If the resolved path is empty or just the root, it's fine
  if (!resolvedNormalized || resolvedNormalized === rootNormalized) {
    return false;
  }
  
  // Check if resolved path starts with virtual root (with trailing slash to avoid prefix match)
  const rootWithSlash = rootNormalized + '/';
  if (!resolvedNormalized.startsWith(rootWithSlash) && resolvedNormalized !== rootNormalized) {
    return true;
  }
  
  return false;
}

/**
 * Validate a path for dangerous constructs
 * For raw path validation only - checks for schemes, UNC, drive letters, malformed escapes
 * Does NOT decide on relative ../.. escapes - that happens after normalization in resolveHref
 */
export function decodeAndValidatePath(path: string): { decoded: string; isValid: boolean; reason?: string } {
  try {
    if (!path) {
      return { decoded: '', isValid: true };
    }

    // Decode percent-escapes
    let decoded = path;
    let prev = '';
    let hadMalformedEscape = false;
    while (decoded !== prev) {
      prev = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // Malformed escape - continue with partial decode
        hadMalformedEscape = true;
        break;
      }
    }

    if (hadMalformedEscape) {
      return { decoded: path, isValid: false, reason: 'malformed-escape' };
    }

    // Check for drive letters
    if (decoded.match(/^[A-Za-z]:/)) {
      return { decoded, isValid: false, reason: 'absolute-path' };
    }
    
    // Check for UNC paths (// or \\)
    if (decoded.match(/^\/\//) || decoded.match(/^\\\\/)) {
      return { decoded, isValid: false, reason: 'unc-path' };
    }

    // Check for virtual root (leading / in original path)
    if (path.startsWith('/')) {
      return { decoded, isValid: false, reason: 'virtual-root' };
    }

    // Check for encoded .. - reject clearly dangerous encoded patterns per rule 7
    // %2e%2e = .. 
    // %2e. = . or ..
    // ../etc/passwd - escape attempt (raw)
    if (/\.\.[/\\]/i.test(path) || /\%2e\%2e/i.test(path) || /\%2e\./i.test(path)) {
      return { decoded, isValid: false, reason: 'escape-attempt' };
    }

    // We allow relative paths like ../foo - they are valid
    // The escape check happens AFTER resolution in resolveHref

    return { decoded, isValid: true };
  } catch {
    return { decoded: path, isValid: false, reason: 'malformed-escape' };
  }
}

/**
 * Normalize a path by resolving . and .. segments
 */
function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  const normalized: string[] = [];
  
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    } else if (part === '..') {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }
  
  return normalized.join('/');
}

/**
 * Resolve a relative href against a source file path
 */
export function resolveHref(
  href: string,
  sourceFilePath: string,
  virtualRoot: string,
  fileExists: (path: string) => boolean,
  getHtmlIds: (path: string) => string[]
): ResolutionResult {
  // Handle empty href or just "#"
  if (!href || href === '#') {
    return { success: true, resolvedPath: sourceFilePath, isFile: true, isHtml: true };
  }

  const parsed = parseHref(href);

  // Check for unsupported schemes
  if (parsed.path.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
    const scheme = parsed.path.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1];
    if (scheme && UNSUPPORTED_SCHEMES.includes(scheme.toLowerCase() + ':')) {
      return { success: false, issueType: 'unsupported-scheme', details: `${scheme}: URLs are not supported` };
    }
    return { success: false, issueType: 'unsupported-scheme', details: `Scheme not supported` };
  }

  // Handle empty path (fragment-only or query-only links)
  if (!parsed.path) {
    // Empty path with fragment - check if fragment exists in current file
    if (parsed.fragment) {
      const existingIds = getHtmlIds(sourceFilePath);
      if (!existingIds.includes(parsed.fragment)) {
        const nearby = findNearbyIds(existingIds, parsed.fragment);
        return {
          success: false,
          resolvedPath: sourceFilePath,
          isFile: true,
          isHtml: true,
          issueType: 'missing-fragment',
          details: `id "${parsed.fragment}" not found in current file`,
          suggestion: nearby.length > 0 ? nearby[0] : undefined,
          existingIds,
        };
      }
    }
    // Empty fragment is always valid (just stays on page)
    return { success: true, resolvedPath: sourceFilePath, isFile: true, isHtml: true };
  }

  // Check for virtual root (leading /)
  if (parsed.path.startsWith('/')) {
    return { success: false, issueType: 'path-escape', details: 'Leading / is virtual root, not supported' };
  }

  // Validate the path doesn't have dangerous constructs (schemes, UNC, drive letters, malformed escapes)
  // We do NOT reject ../.. here - that happens after normalization in resolveHref
  const validation = decodeAndValidatePath(parsed.path);
  
  // For paths with escape-attempt, we check if it's a relative path that might normalize inside root
  // If it normalizes outside, we reject with path-escape
  let skipValidation = false;
  if (!validation.isValid) {
    // Check if it's a relative path (not scheme, not absolute, not UNC)
    const isRelativePath = !parsed.path.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/) && 
                          !parsed.path.startsWith('/') && 
                          !parsed.path.match(/^[A-Za-z]:/) &&
                          !parsed.path.match(/^\/\//) &&
                          !parsed.path.match(/^\\\\/);
    
    if (validation.reason === 'escape-attempt' && isRelativePath) {
      // Let it through to normalization - if it normalizes inside root, it's valid
      skipValidation = true;
    } else if (validation.reason === 'malformed-escape') {
      return { success: false, issueType: 'malformed-url', details: 'Malformed percent-escape in URL' };
    } else {
      return { success: false, issueType: 'path-escape', details: `Path ${validation.reason}` };
    }
  }

  // Get source directory (from virtual root)
  const sourceDir = sourceFilePath.replace(/[/\\][^/\\]*$/, '');
  
  // Use decoded path if we skipped validation (escape-attempt on relative path)
  // Otherwise use the original parsed path
  const pathForResolution = skipValidation ? validation.decoded : parsed.path;
  
  // Resolve the path against source directory
  let resolvedPath = pathForResolution;
  if (sourceDir) {
    resolvedPath = sourceDir + '/' + resolvedPath;
  }

  // Normalize the resolved path (collapse .. and . and extra slashes)
  const normalizedResolvedPath = normalizePath(resolvedPath.replace(/\\/g, '/').replace(/\/+/g, '/'));
  
  // Check if the resolved path escapes the virtual root
  const rootNormalized = virtualRoot.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (wouldEscape(normalizedResolvedPath, rootNormalized)) {
    return { success: false, issueType: 'path-escape', details: 'Path escapes virtual root' };
  }

  // Ensure leading slash
  let fullPath = normalizedResolvedPath.startsWith('/') ? normalizedResolvedPath : '/' + normalizedResolvedPath;

  // Append query string if present (preserve it)
  if (parsed.query) {
    fullPath += '?' + parsed.query;
  }

  // Check if file exists (strip query for file existence check)
  const filePathForCheck = fullPath.replace(/\?.*$/, '');
  if (!fileExists(filePathForCheck)) {
    const ext = filePathForCheck.match(/\.[^.]+$/)?.[0] || '';
    
    // The suggestion should be relative to source file location
    const sourceDirRel = sourceDir.replace(virtualRoot, '');
    
    if (ext === '.htm' && fileExists(filePathForCheck.replace(/\.htm$/, '.html'))) {
      const suggestion = (sourceDirRel ? sourceDirRel + '/' : '') + parsed.path.replace(/\.htm$/, '.html');
      return {
        success: false,
        issueType: 'missing-file',
        suggestion: suggestion.replace(/^\//, ''),
        details: 'File not found',
      };
    }
    if (ext === '.html' && fileExists(filePathForCheck.replace(/\.html$/, '.htm'))) {
      const suggestion = (sourceDirRel ? sourceDirRel + '/' : '') + parsed.path.replace(/\.html$/, '.htm');
      return {
        success: false,
        issueType: 'missing-file',
        suggestion: suggestion.replace(/^\//, ''),
        details: 'File not found',
      };
    }

    return {
      success: false,
      issueType: 'missing-file',
      details: 'File not found',
    };
  }

  // Check for fragment (after file exists check)
  if (parsed.fragment !== undefined) {
    const isHtml = filePathForCheck.match(/\.html?$/i) !== null;
    
    if (isHtml) {
      const existingIds = getHtmlIds(filePathForCheck);
      
      // Empty fragment is always valid (stays on the page)
      if (parsed.fragment && !existingIds.includes(parsed.fragment)) {
        const nearby = findNearbyIds(existingIds, parsed.fragment);
        
        return {
          success: false,
          resolvedPath: fullPath,
          isFile: true,
          isHtml: true,
          issueType: 'missing-fragment',
          details: `id "${parsed.fragment}" not found`,
          suggestion: nearby.length > 0 ? nearby[0] : undefined,
          existingIds,
        };
      }
    }
  }

  return {
    success: true,
    resolvedPath: fullPath,
    isFile: true,
    isHtml: filePathForCheck.match(/\.html?$/i) !== null,
  };
}

/**
 * Find ids similar to the requested fragment
 */
function findNearbyIds(existingIds: string[], fragment: string): string[] {
  const suggestions: Array<{ id: string; score: number }> = [];
  
  for (const id of existingIds) {
    if (id === fragment) continue;
    
    let score = 0;
    const dist = levenshtein(id, fragment);
    score += Math.max(0, 10 - dist);
    
    if (fragment.length >= 3) {
      if (id.startsWith(fragment.substring(0, 3)) || id.endsWith(fragment.slice(-3))) {
        score += 3;
      }
    }
    
    const common = commonSubstrings(id, fragment);
    score += common * 2;
    
    if (score > 0) {
      suggestions.push({ id, score });
    }
  }
  
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.id);
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function commonSubstrings(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 2; j <= a.length; j++) {
      const sub = a.substring(i, j);
      if (b.includes(sub)) count++;
    }
  }
  return count;
}