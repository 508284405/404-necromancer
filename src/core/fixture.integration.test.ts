import { describe, expect, it } from 'vitest';
import guideHtml from '../../public/fixtures/abandoned-site/guide.html?raw';
import indexHtml from '../../public/fixtures/abandoned-site/index.html?raw';
import logoSvg from '../../public/fixtures/abandoned-site/assets/logo.svg?raw';
import startHtml from '../../public/fixtures/abandoned-site/docs/start.html?raw';
import { applyEdit, buildReplacementHref, createFileState, getContent, undoEdit } from './byte-patcher';
import { scanFiles } from './link-scanner';

const root = '/fixtures/abandoned-site';

function loadFixture() {
  return [
    { path: `${root}/index.html`, content: indexHtml },
    { path: `${root}/docs/start.html`, content: startHtml },
    { path: `${root}/guide.html`, content: guideHtml },
    { path: `${root}/assets/logo.svg`, content: logoSvg },
  ];
}

describe('abandoned-site fixture', () => {
  it('reports the two baseline issues and keeps the queried asset', () => {
    const files = loadFixture();
    const map = new Map(files.map((file) => [file.path, file.content]));
    const analyses = scanFiles(files, {
      virtualRoot: root,
      fileExists: (path) => map.has(path),
      getFileContent: (path) => map.get(path) || '',
    });
    const issues = analyses.flatMap((analysis) => analysis.issues);
    expect(issues.map((issue) => issue.hrefValue).sort()).toEqual([
      '../guide.html#install',
      'docs/start.htm',
    ]);
    expect(issues.find((issue) => issue.hrefValue === 'docs/start.htm')?.suggestion).toBe('docs/start.html');
    expect(issues.find((issue) => issue.hrefValue === '../guide.html#install')?.suggestion).toBe('setup');
    const links = analyses.flatMap((analysis) => analysis.links);
    expect(links.some((link) => link.hrefValue === '../assets/logo.svg?v=1' && link.status === 'ok')).toBe(true);
  });

  it('confirms one repair, leaves the other issue, and undo restores every byte', () => {
    const files = loadFixture();
    const index = files.find((file) => file.path.endsWith('index.html'))!;
    const original = index.content;
    const map = new Map(files.map((file) => [file.path, file.content]));
    const issue = scanFiles(files, {
      virtualRoot: root,
      fileExists: (path) => map.has(path),
      getFileContent: (path) => map.get(path) || '',
    }).flatMap((analysis) => analysis.issues).find((item) => item.hrefValue === 'docs/start.htm')!;

    const replacement = buildReplacementHref(issue.hrefValue, issue.issueType, issue.suggestion!);
    const state = createFileState(original, index.path);
    const edited = applyEdit(state, {
      filePath: index.path,
      hrefStart: issue.hrefStart,
      hrefEnd: issue.hrefEnd,
      originalHref: issue.hrefValue,
      newHref: replacement,
      originalBytes: state.originalBytes,
    });
    expect(getContent(edited)).toBe(original.replace('docs/start.htm', 'docs/start.html'));
    expect(getContent(edited)).toContain('这是测试链接');

    map.set(index.path, getContent(edited));
    const remaining = scanFiles(
      files.map((file) => ({ path: file.path, content: map.get(file.path)! })),
      {
        virtualRoot: root,
        fileExists: (path) => map.has(path),
        getFileContent: (path) => map.get(path) || '',
      },
    ).flatMap((analysis) => analysis.issues);
    expect(remaining.map((item) => item.hrefValue)).toEqual(['../guide.html#install']);

    const restored = undoEdit(edited);
    expect(getContent(restored!)).toBe(original);
    expect(Array.from(restored!.currentBytes)).toEqual(Array.from(state.originalBytes));
  });
});
