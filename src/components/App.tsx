import { useState, useCallback, useRef, useEffect } from 'react';
import { scanFiles, FileAnalysis, LinkIssue } from '../core/link-scanner';
import { createFileState, applyEdit, undoEdit, getContent, buildReplacementHref, checkImportCaps } from '../core/byte-patcher';
import { buildReport, createZip, encodeReport, RepairRecord, toZipEntryName } from '../core/export';
import LinkGraph from './LinkGraph';

const FIXTURE_PATH = '/fixtures/abandoned-site';

// File system simulation (in-memory)
interface FileData {
  content: string;
  originalContent: string;
}

const fileSystem = new Map<string, FileData>();
const fileStates = new Map<string, ReturnType<typeof createFileState>>();

export default function App() {
  const [analyses, setAnalyses] = useState<FileAnalysis[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<LinkIssue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [lastEditedPath, setLastEditedPath] = useState<string | null>(null);
  const [repairs, setRepairs] = useState<RepairRecord[]>([]);
  const virtualRootRef = useRef(FIXTURE_PATH);

  const rescan = useCallback(() => {
    const loaded = Array.from(fileSystem.entries()).map(([path, data]) => ({
      path,
      content: data.content,
    }));
    const results = scanFiles(loaded, {
      virtualRoot: virtualRootRef.current,
      fileExists: (path) => fileSystem.has(path),
      getFileContent: (path) => fileSystem.get(path)?.content || '',
    });
    setAnalyses(results);
    return results;
  }, []);

  // Load fixture files
  const loadFixture = useCallback(async () => {
    try {
      setError(null);
      setInfo('Loading fixture...');
      virtualRootRef.current = FIXTURE_PATH;
      const relativePaths = ['index.html', 'docs/start.html', 'guide.html', 'assets/logo.svg'];
      const fixtureFiles: Array<{ path: string; content: string }> = [];
      for (const relativePath of relativePaths) {
        const response = await fetch(`${import.meta.env.BASE_URL}fixtures/abandoned-site/${relativePath}`);
        if (!response.ok) {
          throw new Error(`Fixture file missing: ${relativePath}`);
        }
        fixtureFiles.push({
          path: `${FIXTURE_PATH}/${relativePath}`,
          content: await response.text(),
        });
      }

      fileSystem.clear();
      fileStates.clear();

      // Load files into file system
      for (const file of fixtureFiles) {
        fileSystem.set(file.path, {
          content: file.content,
          originalContent: file.content,
        });
      }

      // Scan files
      const results = scanFiles(fixtureFiles, {
        virtualRoot: FIXTURE_PATH,
        fileExists: (path) => fileSystem.has(path),
        getFileContent: (path) => fileSystem.get(path)?.content || '',
      });

      setAnalyses(results);
      setCanUndo(false);
      setLastEditedPath(null);
      setRepairs([]);
      setInfo(`Loaded fixture. Found ${results.reduce((sum, a) => sum + a.issues.length, 0)} issues.`);
      setSelectedIssue(null);
      setDiff(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fixture');
    }
  }, []);

  // Load user directory
  const loadDirectory = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setError(null);

      let totalSize = 0;
      for (let i = 0; i < files.length; i++) {
        totalSize += files[i].size;
      }
      const capError = checkImportCaps(files.length, totalSize);
      if (capError) {
        setError(capError);
        return;
      }
      virtualRootRef.current = '/user-site';

      // Reset file system
      fileSystem.clear();
      fileStates.clear();

      // Load files
      const loadedFiles: Array<{ path: string; content: string }> = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await file.text();
        const path = filewebkitdirectoryToPath(file);
        
        fileSystem.set(path, {
          content,
          originalContent: content,
        });
        
        loadedFiles.push({ path, content });
      }

      // Scan files
      const results = scanFiles(loadedFiles, {
        virtualRoot: '/user-site',
        fileExists: (path) => fileSystem.has(path),
        getFileContent: (path) => fileSystem.get(path)?.content || '',
      });

      setAnalyses(results);
      setCanUndo(false);
      setLastEditedPath(null);
      setRepairs([]);
      setInfo(`Loaded ${files.length} files. Found ${results.reduce((sum, a) => sum + a.issues.length, 0)} issues.`);
      setSelectedIssue(null);
      setDiff(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    }
  }, []);

  // Convert webkitdirectory file to path
  function filewebkitdirectoryToPath(file: File): string {
    // webkitdirectory provides the full path in the name property
    const fullPath = (file as any).webkitRelativePath || file.name;
    return '/user-site/' + fullPath;
  }

  // Select an issue
  const handleSelectIssue = useCallback((issue: LinkIssue) => {
    setSelectedIssue(issue);
    
    // Generate diff
    if (issue.suggestion) {
      setDiff({
        before: issue.hrefValue,
        after: buildReplacementHref(issue.hrefValue, issue.issueType, issue.suggestion),
      });
    } else {
      setDiff(null);
    }
  }, []);

  // Apply fix
  const handleApply = useCallback(() => {
    if (!selectedIssue || !selectedIssue.suggestion) return;

    const fileData = fileSystem.get(selectedIssue.filePath);
    if (!fileData) return;

    let state = fileStates.get(selectedIssue.filePath);
    if (!state) {
      state = createFileState(fileData.content, selectedIssue.filePath);
    }

    const newHref = buildReplacementHref(selectedIssue.hrefValue, selectedIssue.issueType, selectedIssue.suggestion);
    const edit = {
      filePath: selectedIssue.filePath,
      hrefStart: selectedIssue.hrefStart,
      hrefEnd: selectedIssue.hrefEnd,
      originalHref: selectedIssue.hrefValue,
      newHref,
      originalBytes: state.originalBytes,
    };

    const newState = applyEdit(state, edit);
    fileStates.set(selectedIssue.filePath, newState);
    fileSystem.set(selectedIssue.filePath, {
      content: getContent(newState),
      originalContent: fileData.originalContent,
    });

    const results = rescan();
    const remaining = results.reduce((sum, analysis) => sum + analysis.issues.length, 0);
    setLastEditedPath(selectedIssue.filePath);
    setCanUndo(true);
    setRepairs((current) => [...current, {
      path: selectedIssue.filePath,
      originalHref: selectedIssue.hrefValue,
      newHref,
    }]);
    setInfo(`Applied ${selectedIssue.hrefValue} → ${newHref}. ${remaining} issue${remaining === 1 ? '' : 's'} remain${remaining === 1 ? 's' : ''}. Original bytes are kept for undo.`);
    setSelectedIssue(null);
    setDiff(null);
  }, [selectedIssue, rescan]);

  // Undo
  const handleUndo = useCallback(() => {
    if (!lastEditedPath) return;
    const state = fileStates.get(lastEditedPath);
    const fileData = fileSystem.get(lastEditedPath);
    if (!state || !fileData || state.editHistory.length === 0) return;

    const restoredState = undoEdit(state);
    if (!restoredState) return;

    fileStates.set(lastEditedPath, restoredState);
    fileSystem.set(lastEditedPath, {
      content: getContent(restoredState),
      originalContent: fileData.originalContent,
    });
    rescan();
    const stillEdited = restoredState.editHistory.length > 0;
    setCanUndo(stillEdited);
    if (!stillEdited) setLastEditedPath(null);
    setRepairs((current) => {
      let index = -1;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        if (current[i].path === lastEditedPath) {
          index = i;
          break;
        }
      }
      if (index < 0) return current;
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    setInfo('Undone. The file bytes match the state before that edit.');
    setSelectedIssue(null);
    setDiff(null);
  }, [lastEditedPath, rescan]);

  const downloadBytes = (filename: string, bytes: Uint8Array, type: string) => {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportArchive = () => {
    try {
      const root = virtualRootRef.current;
      const fileEntries = Array.from(fileSystem.entries()).map(([path, data]) => ({
        name: toZipEntryName(path, root),
        data: new TextEncoder().encode(data.content),
      }));
      const unresolved = analyses.flatMap((analysis) => analysis.issues.map((issue) => ({
        path: toZipEntryName(issue.filePath, root),
        href: issue.hrefValue,
        issueType: issue.issueType,
      })));
      const report = buildReport({
        warnings: analyses.flatMap((analysis) => analysis.warnings ?? []),
        issueCount: unresolved.length,
        selectedRepairs: repairs.map((repair) => ({
          ...repair,
          path: toZipEntryName(repair.path, root),
        })),
        unresolved,
        paths: [...fileEntries.map((entry) => entry.name), 'report.json'],
      });
      const zip = createZip([...fileEntries, { name: 'report.json', data: encodeReport(report) }]);
      downloadBytes('necromancer-repaired.zip', zip, 'application/zip');
      downloadBytes('necromancer-report.json', encodeReport(report), 'application/json');
      setError(null);
      setInfo('Exported the repaired tree and JSON report in this browser. No files were uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const issues = analyses.flatMap(a => a.issues);
      
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const currentIndex = selectedIssue 
          ? issues.findIndex(i => i.hrefStart === selectedIssue.hrefStart && i.filePath === selectedIssue.filePath)
          : -1;
        const nextIndex = Math.min(currentIndex + 1, issues.length - 1);
        if (issues[nextIndex]) {
          handleSelectIssue(issues[nextIndex]);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const currentIndex = selectedIssue 
          ? issues.findIndex(i => i.hrefStart === selectedIssue.hrefStart && i.filePath === selectedIssue.filePath)
          : issues.length;
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (issues[prevIndex]) {
          handleSelectIssue(issues[prevIndex]);
        }
      } else if (e.key === 'Enter' && selectedIssue?.suggestion) {
        e.preventDefault();
        handleApply();
      } else if (e.key === 'u' && (e.ctrlKey || e.metaKey) && canUndo) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analyses, selectedIssue, canUndo, handleSelectIssue, handleApply, handleUndo]);

  const allIssues = analyses.flatMap(a => a.issues);

  return (
    <div>
      <a className="skip-link" href="#issues">Skip to issues</a>
      <header>
        <p className="eyebrow">Kiroween Costume Contest</p>
        <h1>404 Necromancer</h1>
        <p className="lede">A local laboratory for abandoned static sites. It finds broken anchors, shows the exact href change, and rewrites a link only after you confirm it.</p>
      </header>
      
      <div className="controls">
        <button onClick={loadFixture}>Load Fixture</button>
        <div className="file-input-wrapper">
          <span>Choose Directory...</span>
          <input
            ref={(node) => {
              if (node) node.setAttribute('webkitdirectory', '');
            }}
            type="file"
            multiple
            aria-label="Choose a local directory to scan"
            onChange={(e) => loadDirectory(e.target.files)}
          />
        </div>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {info && !error && <div className="info-message">{info}</div>}
      {analyses.flatMap((analysis) => analysis.warnings ?? []).map((warning) => (
        <div className="error-message" key={warning} role="status">{warning}</div>
      ))}

      {analyses.length > 0 && (
        <div className="controls">
          <button type="button" onClick={exportArchive} disabled={analyses.length === 0}>
            Export repaired ZIP and report
          </button>
        </div>
      )}

      <LinkGraph analyses={analyses} />

      {allIssues.length > 0 && (
        <div className="issues-count" id="issues">
          Issues Found: {allIssues.length}
        </div>
      )}

      {allIssues.length > 0 && (
        <div className="issues-list">
          {allIssues.map((issue, index) => (
            <div
              key={`${issue.filePath}-${index}`}
              className={`issue-item ${selectedIssue?.hrefStart === issue.hrefStart && selectedIssue?.filePath === issue.filePath ? 'selected' : ''}`}
              onClick={() => handleSelectIssue(issue)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectIssue(issue)}
            >
              <div className="issue-file">
                <span className="issue-type">{issue.issueType}</span>
                {issue.filePath.replace(FIXTURE_PATH + '/', '')}
              </div>
              <div className="issue-href">
                → {issue.hrefValue}
              </div>
              {issue.suggestion && (
                <div className="issue-suggestion">
                  Suggestion: {buildReplacementHref(issue.hrefValue, issue.issueType, issue.suggestion)}
                </div>
              )}
              {issue.details && (
                <div className="issue-details">
                  {issue.details}
                  {issue.existingIds && issue.existingIds.length > 0 && (
                    <> (available: {issue.existingIds.map(id => `#${id}`).join(', ')})</>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedIssue && diff && (
        <div className="diff-container">
          <div className="diff-title">Selected: {selectedIssue.filePath.replace(FIXTURE_PATH + '/', '')}</div>
          <div className="diff-line diff-remove">- {diff.before}</div>
          <div className="diff-line diff-add">+ {diff.after}</div>
        </div>
      )}

      {(selectedIssue || canUndo) && (
        <div className="action-buttons">
          <button
            onClick={handleApply}
            disabled={!selectedIssue?.suggestion}
          >
            Apply confirmed repair
          </button>
          <button onClick={handleUndo} disabled={!canUndo}>
            Undo last repair
          </button>
        </div>
      )}

      {allIssues.length === 0 && analyses.length > 0 && (
        <div className="empty-state">No issues found. All links are valid!</div>
      )}

      {analyses.length === 0 && (
        <div className="empty-state">
          Load the fixture or choose a directory to scan for broken links.
        </div>
      )}
    </div>
  );
}