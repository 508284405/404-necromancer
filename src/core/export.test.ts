import { describe, expect, it } from 'vitest';
import {
  buildReport,
  createZip,
  encodeReport,
  readZip,
  toZipEntryName,
} from './export';

describe('ZIP export', () => {
  it('stores repaired text, unchanged assets, and a report without file bodies', () => {
    const report = buildReport({
      warnings: ['A <base> element is unsupported.'],
      issueCount: 1,
      selectedRepairs: [{ path: 'index.html', originalHref: 'docs/start.htm', newHref: 'docs/start.html' }],
      unresolved: [{ path: 'docs/start.html', href: '../guide.html#install', issueType: 'missing-fragment' }],
      paths: ['index.html', 'docs/start.html', 'assets/logo.svg', 'report.json'],
    });
    const index = new TextEncoder().encode('<p>这是测试链接</p><a href="docs/start.html">Go</a>');
    const logo = new TextEncoder().encode('<svg id="logo"></svg>');
    const zip = createZip([
      { name: toZipEntryName('/fixtures/abandoned-site/index.html', '/fixtures/abandoned-site'), data: index },
      { name: toZipEntryName('/fixtures/abandoned-site/assets/logo.svg', '/fixtures/abandoned-site'), data: logo },
      { name: 'report.json', data: encodeReport(report) },
    ]);
    const entries = readZip(zip);
    expect(entries.map((entry) => entry.name)).toEqual(['index.html', 'assets/logo.svg', 'report.json']);
    expect(Array.from(entries[0].data)).toEqual(Array.from(index));
    expect(Array.from(entries[1].data)).toEqual(Array.from(logo));
    const parsed = JSON.parse(new TextDecoder().decode(entries[2].data));
    expect(parsed.issueCount).toBe(1);
    expect(parsed.selectedRepairs[0].newHref).toBe('docs/start.html');
    expect(parsed.unresolved[0].issueType).toBe('missing-fragment');
    expect(JSON.stringify(parsed)).not.toContain('这是测试链接');
    expect(JSON.stringify(parsed)).not.toContain('<svg');
  });

  it('rejects traversal, absolute names, and duplicate entries', () => {
    expect(() => toZipEntryName('/site/../etc/passwd', '/site')).toThrow(/Unsafe ZIP/);
    expect(() => toZipEntryName('/site//hidden', '/site')).toThrow(/Unsafe ZIP/);
    expect(() => toZipEntryName('C:/windows/a.html', '/site')).toThrow(/Unsafe ZIP/);
    const data = new Uint8Array([1]);
    expect(() => createZip([{ name: 'a.html', data }, { name: 'a.html', data }])).toThrow(/Duplicate ZIP/);
  });
});
