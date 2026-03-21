import React, { useEffect, useRef, useState } from 'react';

let mermaidInitialized = false;

const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const renderChart = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        if (!mermaidInitialized) {
          const isDark = document.documentElement.classList.contains('dark');
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'strict',
          });
          mermaidInitialized = true;
        }

        const id = `mermaid-${crypto.randomUUID().replace(/-/g, '')}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);

        if (!cancelled) {
          setSvg(renderedSvg);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de rendu du diagramme');
          setLoading(false);
        }
      }
    };

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Chargement du diagramme…
      </div>
    );
  }

  if (error) {
    return (
      <pre className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300 overflow-x-auto my-4">
        <div className="text-xs font-semibold mb-2 text-red-500">Diagramme invalide</div>
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      data-mermaid
      className="my-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidBlock;