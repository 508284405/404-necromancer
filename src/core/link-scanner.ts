/**
 * LinkScanner - Orchestrates HTML parsing and href resolution
 */

import { resolveHref } from './href-resolver';
import { parseHtmlAnchors, parseHtmlIds, hasBaseElement } from './html-parser';

export interface LinkIssue {
  filePath: string;
  hrefValue: string;
  hrefStart: number;
  hrefEnd: number;
  issueType: 'missing-file' | 'missing-fragment' | 'unsupported-scheme' | 'malformed-url' | 'path-escape' | 'base-unsupported';
  suggestion?: string;
  details?: string;
  existingIds?: string[];
}

export interface ScannedLink {
  filePath: string;
  hrefValue: string;
  status: 'ok' | LinkIssue['issueType'];
  target?: string;
}

export interface FileAnalysis {
  filePath: string;
  issues: LinkIssue[];
  links: ScannedLink[];
  originalContent: string;
  warnings?: string[];
}

export interface ScannerOptions {
  virtualRoot: string;
  fileExists: (path: string) => boolean;
  getFileContent: (path: string) => string;
}

/**
 * Scan a single HTML file for link issues
 */
export function scanFile(filePath: string, content: string, options: ScannerOptions): FileAnalysis {
  const issues: LinkIssue[] = [];
  const links: ScannedLink[] = [];
  const warnings: string[] = [];
  
  if (hasBaseElement(content)) {
    warnings.push('A <base> element is unsupported. Relative resolution is provisional and is not browser-equivalent.');
  }
  
  // Parse anchors
  const anchors = parseHtmlAnchors(content);
  
  for (const anchor of anchors) {
    const result = resolveHref(
      anchor.hrefValue,
      filePath,
      options.virtualRoot,
      options.fileExists,
      (path) => {
        try {
          const content = options.getFileContent(path);
          return parseHtmlIds(content);
        } catch {
          return [];
        }
      }
    );
    
    if (!result.success && result.issueType) {
      issues.push({
        filePath,
        hrefValue: anchor.hrefValue,
        hrefStart: anchor.hrefStart,
        hrefEnd: anchor.hrefEnd,
        issueType: result.issueType,
        suggestion: result.suggestion,
        details: result.details,
        existingIds: result.existingIds,
      });
    }
    links.push({
      filePath,
      hrefValue: anchor.hrefValue,
      status: result.success ? 'ok' : (result.issueType ?? 'malformed-url'),
      target: result.resolvedPath,
    });
  }
  
  return {
    filePath,
    issues,
    links,
    originalContent: content,
    warnings,
  };
}

/**
 * Scan multiple files for link issues
 */
export function scanFiles(
  files: Array<{ path: string; content: string }>,
  options: ScannerOptions
): FileAnalysis[] {
  const results: FileAnalysis[] = [];
  
  for (const file of files) {
    // Only scan HTML files
    if (file.path.match(/\.html?$/i)) {
      const analysis = scanFile(file.path, file.content, options);
      results.push(analysis);
    }
  }
  
  return results;
}

/**
 * Get all issues from multiple file analyses
 */
export function getAllIssues(analyses: FileAnalysis[]): LinkIssue[] {
  return analyses.flatMap(a => a.issues);
}