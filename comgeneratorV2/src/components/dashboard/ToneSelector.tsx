import React from 'react';
import type { AppreciationTone } from '../../lib/types';
import { Heart, CircleDot, AlertCircle } from 'lucide-react';

interface ToneSelectorProps {
  value: AppreciationTone;
  onChange: (tone: AppreciationTone) => void;
}

const tones: Array<{
  value: AppreciationTone;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'bienveillant',
    label: 'Bienveillant',
    description: 'Encourageant et positif',
    icon: <Heart className="w-5 h-5" />
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Neutre et objectif',
    icon: <CircleDot className="w-5 h-5" />
  },
  {
    value: 'severe',
    label: 'Sévère',
    description: 'Strict et exigeant',
    icon: <AlertCircle className="w-5 h-5" />
  }
];

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Ton de l'appréciation
      </h4>
      <div className="space-y-2">
        {tones.map((tone) => (
          <button
            key={tone.value}
            onClick={() => onChange(tone.value)}
            className={`w-full flex items-center p-3 rounded-lg border ${
              value === tone.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className={`flex-shrink-0 ${
              value === tone.value ? 'text-blue-500' : 'text-gray-400'
            }`}>
              {tone.icon}
            </div>
            <div className="ml-3 flex-1 text-left">
              <div className={`font-medium ${
                value === tone.value ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {tone.label}
              </div>
              <div className={`text-sm ${
                value === tone.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {tone.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}