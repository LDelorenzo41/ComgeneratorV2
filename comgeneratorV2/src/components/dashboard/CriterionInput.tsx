import React from 'react';
import type { Criterion } from '../../lib/types';

interface CriterionInputProps {
  criterion: Criterion & { value: number };
  onChange: (value: number) => void;
}

const ratingLabels: Record<number, string> = {
  0: 'Non évalué',
  1: 'Très insuffisant',
  2: 'Insuffisant',
  3: 'Moyen',
  4: 'Bien',
  5: 'Très bien',
  6: 'Excellent'
};

export function CriterionInput({ criterion, onChange }: CriterionInputProps) {
  const inputId = `criterion-${criterion.id}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {criterion.name}
        </label>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {ratingLabels[criterion.value]}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            id={inputId}
            type="range"
            min="0"
            max="6"
            step="1"
            value={criterion.value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mt-1 w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Non évalué</span>
            <span>Excellent</span>
          </div>
        </div>
        <div className="w-32">
          <select
            value={criterion.value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            {Object.entries(ratingLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}