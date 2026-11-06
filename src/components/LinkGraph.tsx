import { FileAnalysis } from '../core/link-scanner';

function shortPath(path: string): string {
  return path.replace(/^\/fixtures\/abandoned-site\//, '').replace(/^\/user-site\//, '');
}

export default function LinkGraph({ analyses }: { analyses: FileAnalysis[] }) {
  const edges = analyses.flatMap((analysis) => analysis.links.map((link) => ({
    key: `${link.filePath}:${link.hrefValue}`,
    source: shortPath(link.filePath),
    href: link.hrefValue,
    status: link.status,
    target: link.target ? shortPath(link.target) : 'unresolved',
  })));

  if (edges.length === 0) return null;

  return (
    <section className="graph" aria-labelledby="graph-title">
      <h2 id="graph-title">Local link graph</h2>
      <p className="issue-details">Generated from the scan. Imported markup is not drawn or followed.</p>
      <ul className="graph-text">
        {edges.map((edge) => (
          <li key={edge.key}>
            <span>{edge.source}</span>
            <span aria-hidden="true"> → </span>
            <span>{edge.target}</span>
            <span> ({edge.status})</span>
            <span className="issue-details"> href {edge.href}</span>
          </li>
        ))}
      </ul>
      <div className="graph-nodes" aria-hidden="true">
        {Array.from(new Set(edges.flatMap((edge) => [edge.source, edge.target]))).map((node) => (
          <span key={node}>{node}</span>
        ))}
      </div>
    </section>
  );
}
