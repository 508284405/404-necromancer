import { describe, it, expect } from 'vitest';
import { scanFile, scanFiles, getAllIssues } from './link-scanner';

describe('scanFile', () => {
  const virtualRoot = '/test';
  
  const fileExists = (path: string): boolean => {
    const files = [
      '/test/index.html',
      '/test/docs/start.html',
      '/test/guide.html',
      '/test/assets/logo.svg',
    ];
    return files.includes(path);
  };
  
  const getFileContent = (path: string): string => {
    const files: Record<string, string> = {
      '/test/guide.html': '<html><body><h1 id="setup">Setup</h1></body></html>',
      '/test/docs/start.html': '<html><body><a href="../guide.html#install">Link</a></body></html>',
      '/test/index.html': '<html><body><h1 id="section">Section</h1></body></html>',
    };
    return files[path] || '';
  };

  it('should find missing file issue', () => {
    const html = '<a href="docs/start.htm">Missing</a>';
    const result = scanFile('/test/index.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].issueType).toBe('missing-file');
    expect(result.issues[0].suggestion).toBe('docs/start.html');
  });

  it('should find missing fragment issue', () => {
    const html = '<a href="../guide.html#install">Missing ID</a>';
    const result = scanFile('/test/docs/start.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].issueType).toBe('missing-fragment');
    expect(result.issues[0].suggestion).toBe('setup');
  });

  it('should not report valid link as issue', () => {
    const html = '<a href="../guide.html#setup">Valid</a>';
    const result = scanFile('/test/docs/start.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(0);
  });

  it('should preserve query string', () => {
    const html = '<a href="../assets/logo.svg?v=1">Logo</a>';
    const result = scanFile('/test/docs/start.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(0);
  });

  it('should handle unsupported schemes', () => {
    const html = '<a href="https://example.com">External</a>';
    const result = scanFile('/test/index.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].issueType).toBe('unsupported-scheme');
  });

  it('should handle fragment-only links', () => {
    const html = '<a href="#section">Fragment</a>';
    const result = scanFile('/test/index.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(0);
  });

  it('should handle empty fragment', () => {
    const html = '<a href="index.html#">Empty Fragment</a>';
    const result = scanFile('/test/index.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(0);
  });

  it('should handle path escape attempts', () => {
    const html = '<a href="../../../etc/passwd">Bad</a>';
    const result = scanFile('/test/index.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].issueType).toBe('path-escape');
  });

  it('should handle encoded path escape attempts', () => {
    const html = '<a href="%2e%2e%2f%2e%2e%2fpasswd">Bad</a>';
    const result = scanFile('/test/index.html', html, {
      virtualRoot,
      fileExists,
      getFileContent,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].issueType).toBe('path-escape');
  });
});

describe('scanFiles', () => {
  const virtualRoot = '/test';
  
  const fileExists = (path: string): boolean => {
    return path === '/test/index.html' || path === '/test/guide.html';
  };
  
  const getFileContent = (path: string): string => {
    if (path === '/test/guide.html') {
      return '<html><body><h1 id="setup">Setup</h1></body></html>';
    }
    return '';
  };

  it('should scan multiple HTML files', () => {
    const files = [
      { path: '/test/index.html', content: '<a href="missing.htm">Link</a>' },
      { path: '/test/guide.html', content: '<a href="#setup">Link</a>' },
    ];

    const results = scanFiles(files, { virtualRoot, fileExists, getFileContent });
    
    expect(results).toHaveLength(2);
    expect(results[0].issues).toHaveLength(1);
    expect(results[1].issues).toHaveLength(0);
  });

  it('should only scan HTML files', () => {
    const files = [
      { path: '/test/style.css', content: 'a { color: red; }' },
      { path: '/test/script.js', content: 'console.log("test")' },
    ];

    const results = scanFiles(files, { virtualRoot, fileExists, getFileContent });
    
    expect(results).toHaveLength(0);
  });
});

describe('getAllIssues', () => {
  it('should collect all issues from analyses', () => {
    const analyses = [
      { filePath: '/test/1.html', links: [], issues: [{ filePath: '/test/1.html', hrefValue: 'a', hrefStart: 0, hrefEnd: 1, issueType: 'missing-file' as const }], originalContent: '' },
      { filePath: '/test/2.html', links: [], issues: [{ filePath: '/test/2.html', hrefValue: 'b', hrefStart: 0, hrefEnd: 1, issueType: 'missing-fragment' as const }], originalContent: '' },
    ];

    const issues = getAllIssues(analyses);
    
    expect(issues).toHaveLength(2);
  });
});