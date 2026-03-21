import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea';
  data: {
    labels: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      [key: string]: unknown;
    }>;
  };
  options?: Record<string, unknown>;
}

const ChartBlock: React.FC<{ config: string }> = ({ config }) => {
  const parsed = useMemo<ChartConfig | null>(() => {
    try {
      const obj = JSON.parse(config);
      if (!obj.type || !obj.data) return null;
      return obj as ChartConfig;
    } catch {
      return null;
    }
  }, [config]);

  if (!parsed) {
    return (
      <pre className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-700 dark:text-yellow-300 overflow-x-auto my-4">
        <div className="text-xs font-semibold mb-2 text-yellow-500">Configuration graphique invalide</div>
        {config}
      </pre>
    );
  }

  return (
    <div
      data-chart
      className="my-4 flex justify-center"
      style={{ maxWidth: 500, margin: '1rem auto' }}
    >
      <div style={{ width: '100%', height: 300, position: 'relative' }}>
        <Chart
          type={parsed.type}
          data={parsed.data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            ...parsed.options,
          }}
        />
      </div>
    </div>
  );
};

export default ChartBlock;