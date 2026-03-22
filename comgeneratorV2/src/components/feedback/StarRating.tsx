import React from 'react';
import { Star } from 'lucide-react';
import { STAR_LABELS } from '../../types/feedback';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

export function StarRating({ value, onChange, label }: StarRatingProps) {
  const [hovered, setHovered] = React.useState(0);

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
            aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hovered || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
          </button>
        ))}
        {(hovered || value) > 0 && (
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {STAR_LABELS[hovered || value]}
          </span>
        )}
      </div>
    </div>
  );
}
