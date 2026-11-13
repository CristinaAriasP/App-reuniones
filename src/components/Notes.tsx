import type { ReactNode } from 'react';
import { highlight } from '../utils';

/**
 * Renderizado ligero de notas, estilo Markdown básico:
 *  # Título   ## Subtítulo   - viñeta   1. numerada   [ ] / [x] casillas   **negrita**
 */
export function Notes({ text, terms = [] }: { text: string; terms?: string[] }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;

  const flush = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(<Tag key={blocks.length}>{list.items}</Tag>);
      list = null;
    }
  };

  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <strong key={i}>{highlight(part.slice(2, -2), terms)}</strong>
        : <span key={i}>{highlight(part, terms)}</span>,
    );

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s*[-*•]\s+\[( |x|X)\]\s+(.*)$/)) || (m = line.match(/^\s*\[( |x|X)\]\s+(.*)$/))) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; }
      const done = m[1].toLowerCase() === 'x';
      list.items.push(<li key={i} className={'check' + (done ? ' done' : '')}><span className="box">{done ? '☑' : '☐'}</span>{inline(m[2])}</li>);
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; }
      list.items.push(<li key={i}>{inline(m[1])}</li>);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; }
      list.items.push(<li key={i}>{inline(m[1])}</li>);
    } else {
      flush();
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        const level = m[1].length;
        const Tag = (level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5') as 'h3';
        blocks.push(<Tag key={i}>{inline(m[2])}</Tag>);
      } else if (line.trim() === '') {
        blocks.push(<div key={i} className="gap" />);
      } else {
        blocks.push(<p key={i}>{inline(line)}</p>);
      }
    }
  });
  flush();
  return <div className="notes">{blocks}</div>;
}
