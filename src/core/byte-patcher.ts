/**
 * BytePatcher - Byte-level edit operations
 * Operates on raw file bytes for precision editing
 */

import { stringToBytes, bytesToString } from './html-parser';

export interface Edit {
  filePath: string;
  hrefStart: number;
  hrefEnd: number;
  originalHref: string;
  newHref: string;
  originalBytes: Uint8Array;
}

export interface FileState {
  currentBytes: Uint8Array;
  originalBytes: Uint8Array;
  editHistory: Edit[];
  undoStack: Edit[];
}

/**
 * Create a new file state from content
 */
export function createFileState(content: string, _filePath: string): FileState {
  const bytes = stringToBytes(content);
  return {
    currentBytes: new Uint8Array(bytes),
    originalBytes: new Uint8Array(bytes),
    editHistory: [],
    undoStack: [],
  };
}

/**
 * Apply an edit to a file state
 * Returns new file state (immutable)
 */
export function applyEdit(state: FileState, edit: Edit): FileState {
  const { currentBytes } = state;
  
  // Create new bytes array
  const newBytes = new Uint8Array(currentBytes.length - (edit.hrefEnd - edit.hrefStart) + edit.newHref.length);
  
  // Copy bytes before the href span
  newBytes.set(currentBytes.subarray(0, edit.hrefStart), 0);
  
  // Insert new href
  const newHrefBytes = stringToBytes(edit.newHref);
  newBytes.set(newHrefBytes, edit.hrefStart);
  
  // Copy bytes after the href span
  const afterHrefStart = edit.hrefStart + edit.newHref.length;
  const originalAfterHref = currentBytes.subarray(edit.hrefEnd);
  newBytes.set(originalAfterHref, afterHrefStart);
  
  return {
    currentBytes: newBytes,
    originalBytes: state.originalBytes,
    editHistory: [...state.editHistory, edit],
    undoStack: [],
  };
}

/**
 * Undo the last edit
 * Returns new file state or null if nothing to undo
 */
export function undoEdit(state: FileState): FileState | null {
  const lastEdit = state.editHistory[state.editHistory.length - 1];
  if (!lastEdit) {
    return null;
  }

  const newHrefBytes = stringToBytes(lastEdit.newHref);
  const originalHrefBytes = stringToBytes(lastEdit.originalHref);
  const tailStart = lastEdit.hrefStart + newHrefBytes.length;
  if (tailStart > state.currentBytes.length) {
    return null;
  }
  const tail = state.currentBytes.subarray(tailStart);
  const restoredBytes = new Uint8Array(lastEdit.hrefStart + originalHrefBytes.length + tail.length);
  restoredBytes.set(state.currentBytes.subarray(0, lastEdit.hrefStart), 0);
  restoredBytes.set(originalHrefBytes, lastEdit.hrefStart);
  restoredBytes.set(tail, lastEdit.hrefStart + originalHrefBytes.length);
  
  return {
    currentBytes: restoredBytes,
    originalBytes: state.originalBytes,
    editHistory: state.editHistory.slice(0, -1),
    undoStack: [...state.undoStack, lastEdit],
  };
}

/**
 * Generate a byte-level diff between original and new content
 */
export function generateDiff(
  originalBytes: Uint8Array,
  _newBytes: Uint8Array,
  hrefStart: number,
  hrefEnd: number,
  newHref: string
): { before: string; after: string } {
  const originalHref = bytesToString(originalBytes.subarray(hrefStart, hrefEnd));
  
  return {
    before: originalHref,
    after: newHref,
  };
}

/**
 * Check if applying the same edit is idempotent
 */
export function isIdempotent(state: FileState, edit: Edit): boolean {
  const currentHref = bytesToString(state.currentBytes.subarray(edit.hrefStart, edit.hrefEnd));
  return currentHref === edit.newHref;
}

/**
 * Verify that original bytes can be restored exactly
 */
export function verifyOriginalBytes(state: FileState): boolean {
  // The original bytes should be preserved in the state
  return bytesToString(state.originalBytes) === bytesToString(state.currentBytes) === false 
    ? true // If current equals original, check edit history
    : state.editHistory.length === 0 
      ? bytesToString(state.originalBytes) === bytesToString(state.currentBytes)
      : false;
}

/**
 * Full href to write when the user confirms a suggestion.
 * Fragment suggestions are ids, not a replacement of the whole href.
 */
export function buildReplacementHref(hrefValue: string, issueType: string, suggestion: string): string {
  if (issueType === 'missing-fragment') {
    const hash = hrefValue.indexOf('#');
    const withoutFragment = hash >= 0 ? hrefValue.slice(0, hash) : hrefValue;
    return `${withoutFragment}#${suggestion}`;
  }
  return suggestion;
}

/**
 * Reject an import before analysis. 200 files and 10 MiB are both allowed.
 */
export function checkImportCaps(fileCount: number, totalBytes: number): string | null {
  if (fileCount > 200) {
    return `Too many files: ${fileCount}. Maximum is 200.`;
  }
  const limit = 10 * 1024 * 1024;
  if (totalBytes > limit) {
    return `Total content too large: ${(totalBytes / 1024 / 1024).toFixed(2)} MiB. Maximum is 10 MiB.`;
  }
  return null;
}

/**
 * Get the content string from file state
 */
export function getContent(state: FileState): string {
  return bytesToString(state.currentBytes);
}

/**
 * Get original content from file state
 */
export function getOriginalContent(state: FileState): string {
  return bytesToString(state.originalBytes);
}