import React from 'react';
import { FolderOpen, Check } from 'lucide-react';
import type { RagFolder } from '../../lib/rag.types';

interface FolderSelectorProps {
  folders: RagFolder[];
  selectedFolderIds: string[];
  onChange: (folderIds: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  folders,
  selectedFolderIds,
  onChange,
  disabled = false,
  compact = false,
}) => {
  if (folders.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        Aucun dossier créé. Créez des dossiers dans l'onglet Documents du chatbot.
      </p>
    );
  }

  const toggleFolder = (folderId: string) => {
    if (disabled) return;
    if (selectedFolderIds.includes(folderId)) {
      onChange(selectedFolderIds.filter(id => id !== folderId));
    } else {
      onChange([...selectedFolderIds, folderId]);
    }
  };

  return (
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
      {compact ? (
        <>
          {folders.map(folder => {
            const isSelected = selectedFolderIds.includes(folder.id);
            return (
              <button
                key={folder.id}
                onClick={() => toggleFolder(folder.id)}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {folder.name}
                {isSelected && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </>
      ) : (
        folders.map(folder => {
          const isSelected = selectedFolderIds.includes(folder.id);
          return (
            <label
              key={folder.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleFolder(folder.id)}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{folder.name}</span>
            </label>
          );
        })
      )}
      {selectedFolderIds.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Aucun dossier sélectionné — tous vos documents seront interrogés.
        </p>
      )}
    </div>
  );
};

export default FolderSelector;
