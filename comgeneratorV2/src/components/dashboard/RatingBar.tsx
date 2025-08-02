import React from 'react';

interface RatingBarProps {
  value: number;
  onChange: (value: number) => void;
}

const ratingLabels = [
  { value: 0, label: 'Non évalué', shortLabel: 'NE' },
  { value: 1, label: 'Très insuffisant', shortLabel: 'TI' },
  { value: 2, label: 'Insuffisant', shortLabel: 'I' },
  { value: 3, label: 'Moyen', shortLabel: 'M' },
  { value: 4, label: 'Assez bien', shortLabel: 'AB' },
  { value: 5, label: 'Bien', shortLabel: 'B' },
  { value: 6, label: 'Très bien', shortLabel: 'TB' },
  { value: 7, label: 'Excellent', shortLabel: 'E' }
];

export function RatingBar({ value, onChange }: RatingBarProps) {
  return (
    <div className="flex w-full h-10 rounded-md overflow-hidden">
      {ratingLabels.map((rating) => (
        <button
          key={rating.value}
          onClick={() => onChange(rating.value)}
          className={`
            flex-1 transition-colors duration-200 relative group flex items-center justify-center
            ${rating.value === 0 
              ? `border-2 ${value === 0 ? 'border-blue-500' : 'border-gray-400 hover:border-blue-500'}`
              : 'border-r border-gray-300'
            }
            ${value >= rating.value && rating.value !== 0
              ? 'bg-blue-500 text-white'
              : rating.value === 0 && value === 0
              ? 'bg-white text-gray-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            }
            ${rating.value === 0 && value !== 0 ? 'bg-white text-gray-900' : ''}
          `}
        >
          <span className="text-xs font-medium">
            {rating.shortLabel}
          </span>
          <div className="absolute z-[100] bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg whitespace-nowrap min-w-max">
              {rating.label}
            </div>
            <div className="w-3 h-3 bg-gray-900 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
          </div>
        </button>
      ))}
    </div>
  );
}