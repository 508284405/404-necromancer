import { describe, it, expect } from 'vitest';
import { parseHtmlAnchors } from './html-parser';
import { 
  createFileState, 
  applyEdit, 
  undoEdit, 
  getContent, 
  getOriginalContent,
  generateDiff,
  isIdempotent,
  buildReplacementHref,
  checkImportCaps
} from './byte-patcher';

describe('createFileState', () => {
  it('should create state with correct bytes', () => {
    const content = '<a href="test.html">Link</a>';
    const state = createFileState(content, '/test/index.html');
    
    expect(getContent(state)).toBe(content);
    expect(getOriginalContent(state)).toBe(content);
  });

  it('should handle unicode content', () => {
    const content = '<a href="test.html">测试链接</a>';
    const state = createFileState(content, '/test/index.html');
    
    const stateContent = getContent(state);
    expect(stateContent).toBe(content);
  });
});

describe('applyEdit', () => {
  it('should apply edit correctly', () => {
    const content = '<a href="old.html">Link</a>';
    const state = createFileState(content, '/test/index.html');
    
    // Find href positions
    const hrefStart = content.indexOf('"') + 1;
    const hrefEnd = content.indexOf('"', hrefStart);
    
    const edit = {
      filePath: '/test/index.html',
      hrefStart,
      hrefEnd,
      originalHref: 'old.html',
      newHref: 'new.html',
      originalBytes: state.originalBytes,
    };
    
    const newState = applyEdit(state, edit);
    expect(getContent(newState)).toBe('<a href="new.html">Link</a>');
  });

  it('should preserve query string in href', () => {
    const content = '<a href="page.html?v=1">Link</a>';
    const state = createFileState(content, '/test/index.html');
    
    const hrefStart = content.indexOf('"') + 1;
    const hrefEnd = content.lastIndexOf('"');
    
    const edit = {
      filePath: '/test/index.html',
      hrefStart,
      hrefEnd,
      originalHref: 'page.html?v=1',
      newHref: 'page.html?v=2',
      originalBytes: state.originalBytes,
    };
    
    const newState = applyEdit(state, edit);
    expect(getContent(newState)).toBe('<a href="page.html?v=2">Link</a>');
  });
});

describe('undoEdit', () => {
  it('should restore exact original bytes', () => {
    const originalContent = '<a href="old.html">Link</a>';
    const state = createFileState(originalContent, '/test/index.html');
    
    const hrefStart = originalContent.indexOf('"') + 1;
    const hrefEnd = originalContent.indexOf('"', hrefStart);
    
    const edit = {
      filePath: '/test/index.html',
      hrefStart,
      hrefEnd,
      originalHref: 'old.html',
      newHref: 'new.html',
      originalBytes: state.originalBytes,
    };
    
    const editedState = applyEdit(state, edit);
    const undoneState = undoEdit(editedState);
    
    expect(undoneState).not.toBeNull();
    expect(getContent(undoneState!)).toBe(originalContent);
  });

  it('restores a longer href and the multibyte bytes around it', () => {
    const originalContent = '<p>链接</p><a href="start.htm">x</a>';
    const anchor = parseHtmlAnchors(originalContent)[0];
    const state = createFileState(originalContent, '/virtual/index.html');
    const edit = {
      filePath: '/virtual/index.html',
      hrefStart: anchor.hrefStart,
      hrefEnd: anchor.hrefEnd,
      originalHref: 'start.htm',
      newHref: 'start.html',
      originalBytes: state.originalBytes,
    };

    const edited = applyEdit(state, edit);
    expect(getContent(edited)).toBe('<p>链接</p><a href="start.html">x</a>');
    const undone = undoEdit(edited);
    expect(getContent(undone!)).toBe(originalContent);
    expect(Array.from(undone!.currentBytes)).toEqual(Array.from(state.originalBytes));
  });

  it('returns null if nothing to undo', () => {
    const content = '<a href="test.html">Link</a>';
    const state = createFileState(content, '/test/index.html');
    
    const result = undoEdit(state);
    expect(result).toBeNull();
  });
});

describe('isIdempotent', () => {
  it('should return true if edit is already applied', () => {
    const content = '<a href="test.html">Link</a>';
    const state = createFileState(content, '/test/index.html');
    
    const hrefStart = content.indexOf('"') + 1;
    const hrefEnd = content.indexOf('"', hrefStart);
    
    const edit = {
      filePath: '/test/index.html',
      hrefStart,
      hrefEnd,
      originalHref: 'test.html',
      newHref: 'test.html',
      originalBytes: state.originalBytes,
    };
    
    expect(isIdempotent(state, edit)).toBe(true);
  });

  it('should return false if edit changes href', () => {
    const content = '<a href="old.html">Link</a>';
    const state = createFileState(content, '/test/index.html');
    
    const hrefStart = content.indexOf('"') + 1;
    const hrefEnd = content.indexOf('"', hrefStart);
    
    const edit = {
      filePath: '/test/index.html',
      hrefStart,
      hrefEnd,
      originalHref: 'old.html',
      newHref: 'new.html',
      originalBytes: state.originalBytes,
    };
    
    expect(isIdempotent(state, edit)).toBe(false);
  });
});

describe('buildReplacementHref', () => {
  it('replaces only the fragment and keeps the path', () => {
    expect(buildReplacementHref('../guide.html#install', 'missing-fragment', 'setup'))
      .toBe('../guide.html#setup');
  });

  it('uses a file suggestion as the whole href', () => {
    expect(buildReplacementHref('docs/start.htm', 'missing-file', 'docs/start.html'))
      .toBe('docs/start.html');
  });
});

describe('checkImportCaps', () => {
  it('accepts 200 files and exactly 10 MiB', () => {
    expect(checkImportCaps(200, 10 * 1024 * 1024)).toBeNull();
  });

  it('rejects 201 files and one byte over 10 MiB before analysis', () => {
    expect(checkImportCaps(201, 1)).toMatch(/200/);
    expect(checkImportCaps(1, 10 * 1024 * 1024 + 1)).toMatch(/10 MiB/);
  });
});

describe('generateDiff', () => {
  it('should show before and after', () => {
    const originalBytes = new TextEncoder().encode('<a href="old.html">Link</a>');
    const newBytes = new TextEncoder().encode('<a href="new.html">Link</a>');
    
    const hrefStart = 9; // After <a href="
    const hrefEnd = 17; // End of old.html"
    const newHref = 'new.html';
    
    const diff = generateDiff(originalBytes, newBytes, hrefStart, hrefEnd, newHref);
    
    expect(diff.before).toBe('old.html');
    expect(diff.after).toBe('new.html');
  });
});