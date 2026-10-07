import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Dark-theme styling for each Markdown element, so specs read like documents, not raw text.
const components: Components = {
  h1: ({ children }) => <h1 className="mb-4 mt-2 text-xl font-bold tracking-tight text-copy-primary">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-6 border-b border-surface-border pb-1 text-[1rem] font-semibold text-copy-primary">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-copy-primary">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-copy-secondary">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-copy-secondary">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-copy-secondary">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-copy-primary">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-ai pl-3 text-sm italic text-copy-muted">{children}</blockquote>
  ),
  code: ({ children }) => <code className="rounded-xl bg-subtle px-1 py-0.5 font-mono text-xs text-brand">{children}</code>,
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl border border-surface-border bg-base p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-copy-secondary">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-surface-border bg-elevated px-2 py-1 font-semibold text-copy-primary">{children}</th>,
  td: ({ children }) => <td className="border border-surface-border px-2 py-1 text-copy-secondary">{children}</td>,
  hr: () => <hr className="my-4 border-surface-border" />,
};

const MarkdownView = ({ content }: { content: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {content}
  </ReactMarkdown>
);

export default MarkdownView;
