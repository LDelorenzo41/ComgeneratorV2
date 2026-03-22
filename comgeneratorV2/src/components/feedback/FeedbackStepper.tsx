import React from 'react';
import { Check } from 'lucide-react';

interface FeedbackStepperProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export function FeedbackStepper({ currentStep, totalSteps, stepLabels }: FeedbackStepperProps) {
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <div className="mb-8">
      {/* Barre de progression */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Étape {currentStep + 1} / {totalSteps}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Label de l'étape courante */}
      <p className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
        {stepLabels[currentStep]}
      </p>

      {/* Dots pour les étapes (visible uniquement desktop) */}
      <div className="hidden lg:flex items-center justify-center mt-4 gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < currentStep
                ? 'bg-blue-600'
                : i === currentStep
                ? 'bg-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
            title={stepLabels[i]}
          />
        ))}
      </div>
    </div>
  );
}
