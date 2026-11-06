import { describe, it, expect } from 'vitest';
import { 
  parseHtmlAnchors, 
  parseHtmlIds, 
  hasBaseElement,
  escapeHtml,
  stringToBytes,
  bytesToString
} from './html-parser';

describe('parseHtmlAnchors', () => {
  it('should extract single anchor', () => {
    const html = '<a href="page.html">Link</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(1);
    expect(anchors[0].hrefValue).toBe('page.html');
  });

  it('should extract multiple anchors', () => {
    const html = '<a href="page1.html">Link1</a><a href="page2.html">Link2</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(2);
    expect(anchors[0].hrefValue).toBe('page1.html');
    expect(anchors[1].hrefValue).toBe('page2.html');
  });

  it('should handle single quotes', () => {
    const html = "<a href='page.html'>Link</a>";
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(1);
    expect(anchors[0].hrefValue).toBe('page.html');
  });

  it('should handle anchors with other attributes', () => {
    const html = '<a class="nav" href="page.html" id="link">Link</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(1);
    expect(anchors[0].hrefValue).toBe('page.html');
  });

  it('should handle fragment-only links', () => {
    const html = '<a href="#section">Section</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(1);
    expect(anchors[0].hrefValue).toBe('#section');
  });

  it('should handle empty href', () => {
    const html = '<a href="">Empty</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(1);
    expect(anchors[0].hrefValue).toBe('');
  });

  it('should provide byte positions', () => {
    const html = '<a href="test.html">Link</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors[0].hrefStart).toBe(9);
    expect(anchors[0].hrefEnd).toBe(18);
  });

  it('should handle unicode in href', () => {
    const html = '<a href="页面.html">链接</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(1);
    expect(anchors[0].hrefValue).toBe('页面.html');
  });

  it('should not match anchors without href', () => {
    const html = '<a name="section">Section</a>';
    const anchors = parseHtmlAnchors(html);
    
    expect(anchors).toHaveLength(0);
  });
});

describe('parseHtmlIds', () => {
  it('should extract single id', () => {
    const html = '<div id="main">Content</div>';
    const ids = parseHtmlIds(html);
    
    expect(ids).toContain('main');
  });

  it('should extract multiple ids', () => {
    const html = '<div id="a"></div><span id="b"></span>';
    const ids = parseHtmlIds(html);
    
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('should handle single quotes', () => {
    const html = "<div id='main'>Content</div>";
    const ids = parseHtmlIds(html);
    
    expect(ids).toContain('main');
  });

  it('should handle duplicate ids', () => {
    const html = '<div id="dup"></div><span id="dup"></span>';
    const ids = parseHtmlIds(html);
    
    expect(ids).toEqual(['dup', 'dup']);
  });
});

describe('hasBaseElement', () => {
  it('should detect base element', () => {
    const html = '<html><head><base href="/"></head></html>';
    expect(hasBaseElement(html)).toBe(true);
  });

  it('should return false when no base element', () => {
    const html = '<html><head></head></html>';
    expect(hasBaseElement(html)).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('should escape special characters', () => {
    expect(escapeHtml('<>&"\'test')).toBe('&lt;&gt;&amp;&quot;&#39;test');
  });

  it('should not change already escaped content', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('stringToBytes and bytesToString', () => {
  it('should round-trip simple ASCII', () => {
    const original = 'Hello World';
    const bytes = stringToBytes(original);
    const restored = bytesToString(bytes);
    
    expect(restored).toBe(original);
  });

  it('should handle unicode', () => {
    const original = '测试链接';
    const bytes = stringToBytes(original);
    const restored = bytesToString(bytes);
    
    expect(restored).toBe(original);
  });

  it('should preserve bytes around href', () => {
    // Test that unicode text before/after href is preserved
    const content = '<p>这是测试</p><a href="old.html">链接</a>';
    const bytes = stringToBytes(content);
    const restored = bytesToString(bytes);
    
    expect(restored).toBe(content);
  });
});