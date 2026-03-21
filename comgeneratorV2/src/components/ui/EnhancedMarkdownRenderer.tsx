import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { convertMarkdownTablesToHtml, normalizeLatexDelimiters } from '../../lib/phaseExtractor';
import MermaidBlock from './MermaidBlock';
import ChartBlock from './ChartBlock';

interface EnhancedMarkdownRendererProps {
  content: string;
  className?: string;
}

const EnhancedMarkdownRenderer: React.FC<EnhancedMarkdownRendererProps> = ({
  content,
  className,
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw as any, rehypeKatex as any]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-purple-200 dark:border-purple-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 mt-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 mt-3">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1 mt-2">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 mt-2">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-3 text-gray-700 dark:text-gray-300">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-3 text-gray-700 dark:text-gray-300">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800 dark:text-gray-200">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-600 dark:text-gray-400 my-4 bg-purple-50 dark:bg-purple-900/20 py-2 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <table className="w-full border-collapse my-4 text-sm border border-gray-300 dark:border-gray-600">
              {children}
            </table>
          ),
          thead: ({ children }) => (
            <thead className="bg-purple-100 dark:bg-purple-900/40">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 bg-purple-50 dark:bg-purple-900/30">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
              {children}
            </td>
          ),
          code: ({ inline, className: codeClassName, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const lang = match ? match[1] : '';
            const codeContent = String(children).replace(/\n$/, '');

            if (!inline && lang === 'mermaid') {
              return <MermaidBlock chart={codeContent} />;
            }
            if (!inline && lang === 'chart') {
              return <ChartBlock config={codeContent} />;
            }

            if (inline) {
              return (
                <code
                  className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className="block bg-gray-100 dark:bg-gray-800 p-4 rounded-xl overflow-x-auto my-4 text-sm"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => {
            // When a fenced code block is rendered, react-markdown wraps it in <pre><code>
            // For mermaid/chart blocks, we skip the <pre> wrapper since the component handles it
            const child = React.Children.toArray(children)[0];
            if (React.isValidElement(child)) {
              const childProps = child.props as any;
              const className = childProps?.className || '';
              if (
                className.includes('language-mermaid') ||
                className.includes('language-chart')
              ) {
                return <>{children}</>;
              }
            }
            return <pre className="overflow-x-auto">{children}</pre>;
          },
        }}
      >
        {normalizeLatexDelimiters(convertMarkdownTablesToHtml(content))}
      </ReactMarkdown>
    </div>
  );
};

export default EnhancedMarkdownRenderer;