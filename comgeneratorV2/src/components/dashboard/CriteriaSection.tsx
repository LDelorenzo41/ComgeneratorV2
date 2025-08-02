import React from 'react';
import { CriterionInput } from './CriterionInput';
import type { Criterion } from '../../lib/types';

interface CriteriaSectionProps {
  criteria: Array<Criterion & { value: number }>;
  onCriterionChange: (index: number, value: number) => void;
}

export function CriteriaSection({ criteria, onCriterionChange }: CriteriaSectionProps) {
  if (!criteria.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Critères d'évaluation
      </h3>
      <div className="space-y-6">
        {criteria.map((criterion, index) => (
          <CriterionInput
            key={criterion.id || `temp-${index}`}
            criterion={criterion}
            onChange={(value) => onCriterionChange(index, value)}
          />
        ))}
      </div>
    </div>
  );
}