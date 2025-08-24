import React, { useState } from 'react';

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
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);

  return (
    <div className="relative">
      <div className="flex w-full h-10 rounded-md overflow-hidden">
        {ratingLabels.map((rating) => (
          <button
            key={rating.value}
            onClick={() => onChange(rating.value)}
            onMouseEnter={() => setHoveredValue(rating.value)}
            onMouseLeave={() => setHoveredValue(null)}
            className={`
              flex-1 transition-colors duration-200 relative flex items-center justify-center
              ${rating.value === 0 
                ? `border-2 ${value === 0 ? 'border-blue-500' : 'border-gray-400 hover:border-blue-500'}`
                : 'border-r border-gray-300 last:border-r-0'
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
          </button>
        ))}
      </div>
      
      {/* Tooltip externe au conteneur */}
      {hoveredValue !== null && (
        <div 
          className="absolute pointer-events-none bg-gray-900 dark:bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap transform -translate-x-1/2"
          style={{
            left: `${((hoveredValue + 0.5) / ratingLabels.length) * 100}%`,
            top: '-45px',
            zIndex: 10000
          }}
        >
          {ratingLabels.find(r => r.value === hoveredValue)?.label}
          {/* Flèche */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}