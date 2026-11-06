import { describe, it, expect, beforeEach } from 'vitest';
import { parseHref, resolveHref, decodeAndValidatePath } from './href-resolver';

describe('parseHref', () => {
  it('should parse simple path', () => {
    const result = parseHref('docs/start.html');
    expect(result.path).toBe('docs/start.html');
    expect(result.query).toBe('');
    expect(result.fragment).toBe('');
  });

  it('should parse path with query', () => {
    const result = parseHref('docs/start.html?v=1');
    expect(result.path).toBe('docs/start.html');
    expect(result.query).toBe('v=1');
    expect(result.fragment).toBe('');
  });

  it('should parse path with fragment', () => {
    const result = parseHref('docs/start.html#section');
    expect(result.path).toBe('docs/start.html');
    expect(result.query).toBe('');
    expect(result.fragment).toBe('section');
  });

  it('should parse path with query and fragment', () => {
    const result = parseHref('docs/start.html?v=1#section');
    expect(result.path).toBe('docs/start.html');
    expect(result.query).toBe('v=1');
    expect(result.fragment).toBe('section');
  });

  it('should handle fragment-only link', () => {
    const result = parseHref('#section');
    expect(result.path).toBe('');
    expect(result.fragment).toBe('section');
  });

  it('should handle empty fragment', () => {
    const result = parseHref('page.html#');
    expect(result.path).toBe('page.html');
    expect(result.fragment).toBe('');
  });

  it('should handle empty href', () => {
    const result = parseHref('');
    expect(result.path).toBe('');
    expect(result.query).toBe('');
    expect(result.fragment).toBe('');
  });

  it('should handle scheme URLs', () => {
    const result = parseHref('https://example.com');
    expect(result.path).toBe('https://example.com');
  });

  it('should preserve query order', () => {
    const result = parseHref('page.html?a=1&b=2#section');
    expect(result.query).toBe('a=1&b=2');
    expect(result.fragment).toBe('section');
  });
});

describe('decodeAndValidatePath', () => {
  it('should accept simple paths', () => {
    const result = decodeAndValidatePath('docs/start.html');
    expect(result.isValid).toBe(true);
    expect(result.decoded).toBe('docs/start.html');
  });

  it('should reject paths starting with /', () => {
    const result = decodeAndValidatePath('/etc/passwd');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('virtual-root');
  });

  it('should reject absolute Windows paths', () => {
    const result = decodeAndValidatePath('C:/windows/system32');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('absolute-path');
  });

  it('should reject UNC paths', () => {
    const result = decodeAndValidatePath('//server/share');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('unc-path');
  });

  it('should reject traversal beyond root', () => {
    const result = decodeAndValidatePath('../etc/passwd');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('escape-attempt');
  });

  it('should reject encoded traversal %2e%2e', () => {
    const result = decodeAndValidatePath('%2e%2e/etc/passwd');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('escape-attempt');
  });

  it('should reject encoded traversal %2e.', () => {
    const result = decodeAndValidatePath('%2e./etc/passwd');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('escape-attempt');
  });

  it('should handle malformed percent-escapes', () => {
    const result = decodeAndValidatePath('page%ZZ.html');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('malformed-escape');
  });
});

describe('resolveHref', () => {
  let fileExists: (path: string) => boolean;
  let getHtmlIds: (path: string) => string[];

  beforeEach(() => {
    const fileSystem: Record<string, boolean> = {
      '/virtual/index.html': true,
      '/virtual/docs/start.html': true,
      '/virtual/guide.html': true,
      '/virtual/assets/logo.svg': true,
    };

    const htmlIds: Record<string, string[]> = {
      '/virtual/guide.html': ['setup'],
      '/virtual/index.html': ['section'],
      '/virtual/docs/start.html': [],
    };

    fileExists = (path) => fileSystem[path] || false;
    getHtmlIds = (path) => htmlIds[path] || [];
  });

  it('should suggest docs/start.html for missing docs/start.htm', () => {
    const result = resolveHref(
      'docs/start.htm',
      '/virtual/index.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(false);
    expect(result.issueType).toBe('missing-file');
    expect(result.suggestion).toBe('docs/start.html');
  });

  it('should suggest setup for missing fragment install', () => {
    const result = resolveHref(
      '../guide.html#install',
      '/virtual/docs/start.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(false);
    expect(result.issueType).toBe('missing-fragment');
    expect(result.suggestion).toBe('setup');
  });

  it('should preserve query string', () => {
    const result = resolveHref(
      '../assets/logo.svg?v=1',
      '/virtual/docs/start.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(true);
  });

  it('should handle fragment-only link', () => {
    const result = resolveHref(
      '#section',
      '/virtual/index.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(true);
  });

  it('should handle empty fragment', () => {
    const result = resolveHref(
      'index.html#',
      '/virtual/index.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(true);
  });

  it('should reject https: URLs', () => {
    const result = resolveHref(
      'https://example.com',
      '/virtual/index.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(false);
    expect(result.issueType).toBe('unsupported-scheme');
  });

  it('should reject mailto: URLs', () => {
    const result = resolveHref(
      'mailto:test@example.com',
      '/virtual/index.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(false);
    expect(result.issueType).toBe('unsupported-scheme');
  });

  it('should reject javascript: URLs', () => {
    const result = resolveHref(
      'javascript:alert(1)',
      '/virtual/index.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(false);
    expect(result.issueType).toBe('unsupported-scheme');
  });

  it('should pass when fragment exists', () => {
    const result = resolveHref(
      '../guide.html#setup',
      '/virtual/docs/start.html',
      '/virtual',
      fileExists,
      getHtmlIds
    );

    expect(result.success).toBe(true);
  });
});