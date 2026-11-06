/**
 * Local ZIP + JSON report export. STORE method only (no compression).
 * This writer does not import ZIP archives.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export interface RepairRecord {
  path: string;
  originalHref: string;
  newHref: string;
}

export interface UnresolvedIssue {
  path: string;
  href: string;
  issueType: string;
}

export interface AnalysisReport {
  product: '404 Necromancer';
  assumptions: string[];
  warnings: string[];
  issueCount: number;
  selectedRepairs: RepairRecord[];
  unresolved: UnresolvedIssue[];
  paths: string[];
}

const ASSUMPTIONS = [
  'Static file resolution only. Directory indexes and server rewrites are not assumed.',
  'Only HTML a[href] attributes are link sources. Image, script, and stylesheet URLs are not link failures.',
  'A leading slash is the imported virtual root, never the host filesystem.',
  'Queries do not affect file existence and are preserved unless a confirmed edit changes that href.',
  'A nonempty fragment is checked only against ids in an HTML target.',
  'Imported markup is not executed and its references are not fetched.',
];

export function reportAssumptions(): string[] {
  return [...ASSUMPTIONS];
}

export function buildReport(input: {
  warnings: string[];
  issueCount: number;
  selectedRepairs: RepairRecord[];
  unresolved: UnresolvedIssue[];
  paths: string[];
}): AnalysisReport {
  return {
    product: '404 Necromancer',
    assumptions: reportAssumptions(),
    warnings: [...input.warnings],
    issueCount: input.issueCount,
    selectedRepairs: input.selectedRepairs.map((repair) => ({ ...repair })),
    unresolved: input.unresolved.map((issue) => ({ ...issue })),
    paths: [...input.paths],
  };
}

export function toZipEntryName(virtualPath: string, virtualRoot: string): string {
  const root = virtualRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  let name = virtualPath.replace(/\\/g, '/');
  if (root && (name === root || name.startsWith(`${root}/`))) {
    name = name.slice(root.length);
    if (name.startsWith('/')) name = name.slice(1);
  } else {
    name = name.replace(/^\/+/, '');
  }
  if (!name || name.endsWith('/')) {
    throw new Error(`Unsafe ZIP entry name: ${virtualPath}`);
  }
  const segments = name.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe ZIP entry name: ${virtualPath}`);
  }
  if (/^[A-Za-z]:/.test(name) || name.startsWith('//')) {
    throw new Error(`Unsafe ZIP entry name: ${virtualPath}`);
  }
  return name;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosTime(date = new Date(2026, 9, 30, 0, 0, 0)): { time: number; day: number } {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const seen = new Set<string>();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const stamp = dosTime();

  for (const entry of entries) {
    if (seen.has(entry.name)) {
      throw new Error(`Duplicate ZIP entry: ${entry.name}`);
    }
    seen.add(entry.name);
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.data.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    const localBytes = concat([new Uint8Array(local.buffer), nameBytes, entry.data]);
    locals.push(localBytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, stamp.time, true);
    central.setUint16(14, stamp.day, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, entry.data.length, true);
    central.setUint32(24, entry.data.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, offset, true);
    centrals.push(concat([new Uint8Array(central.buffer), nameBytes]));
    offset += localBytes.length;
  }

  const centralDir = concat(centrals);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralDir.length, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);
  return concat([...locals, centralDir, new Uint8Array(eocd.buffer)]);
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) {
      throw new Error('ZIP local header missing');
    }
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 18, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    entries.push({ name, data: bytes.slice(dataStart, dataStart + size) });
    offset = dataStart + size;
  }
  return entries;
}

export function encodeReport(report: AnalysisReport): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`);
}
