/**
 * HTML Parser - Extract anchor tags with href and byte positions
 * Uses regex-based parsing for security (no full HTML parsing)
 */

export interface AnchorTag {
  startByte: number;
  endByte: number;
  hrefStart: number;
  hrefEnd: number;
  hrefValue: string;
  fullMatch: string;
}

/**
 * Extract all anchor tags with href attributes from HTML content
 * Returns position information for byte-level operations
 */
export function parseHtmlAnchors(htmlContent: string): AnchorTag[] {
  const anchors: AnchorTag[] = [];
  
  // Match anchor tags with href attribute
  // This regex captures:
  // 1. The full tag from <a to </a> or <a ... >
  // 2. The href attribute value
  const anchorRegex = /<a\s[^>]*href\s*=\s*(['"])([^'"]*)\1[^>]*>/gi;
  
  let match;
  while ((match = anchorRegex.exec(htmlContent)) !== null) {
    const fullMatch = match[0];
    const hrefValue = match[2];
    const quote = match[1];
    
    // Find the href start position within the full match
    const hrefAttrStart = fullMatch.indexOf('href');
    const equalsPos = fullMatch.indexOf('=', hrefAttrStart);
    const quotePos = fullMatch.indexOf(quote, equalsPos + 1);
    
    // Positions are UTF-8 byte offsets. String indexes diverge once
    // multibyte text appears before the attribute.
    const hrefStart = stringToBytes(htmlContent.slice(0, match.index + quotePos + 1)).length;
    const hrefEnd = hrefStart + stringToBytes(hrefValue).length;
    
    anchors.push({
      startByte: stringToBytes(htmlContent.slice(0, match.index)).length,
      endByte: stringToBytes(htmlContent.slice(0, match.index + fullMatch.length)).length,
      hrefStart,
      hrefEnd,
      hrefValue,
      fullMatch,
    });
  }
  
  return anchors;
}

/**
 * Extract all id attributes from HTML content
 */
export function parseHtmlIds(htmlContent: string): string[] {
  const ids: string[] = [];
  
  // Match id="value" or id='value'
  const idRegex = /\sid\s*=\s*(['"])([^'"]+)\1/gi;
  
  let match;
  while ((match = idRegex.exec(htmlContent)) !== null) {
    ids.push(match[2]);
  }
  
  return ids;
}

/**
 * Check if HTML contains a <base> element
 */
export function hasBaseElement(htmlContent: string): boolean {
  return /<base\s/i.test(htmlContent);
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert string to byte array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert byte array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}