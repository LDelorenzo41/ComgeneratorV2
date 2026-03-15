import React, { useState } from 'react';
import { FolderOpen, FolderPlus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react';
import type { RagFolder, RagDocument } from '../../lib/rag.types';
import { createFolder, renameFolder, deleteFolder } from '../../lib/ragApi';

interface FolderManagerProps {
  folders: RagFolder[];
  documents: RagDocument[];
  onRefresh: () => void;
}

export const FolderManager: React.FC<FolderManagerProps> = ({ folders, documents, onRefresh }) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userDocs = documents.filter(d => d.scope === 'user');

  const getDocCountForFolder = (folderId: string) =>
    userDocs.filter(d => d.folder_id === folderId).length;

  const getUnfiledDocCount = () =>
    userDocs.filter(d => !d.folder_id).length;

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    setError(null);
    setIsCreating(true);
    try {
      await createFolder(newFolderName);
      setNewFolderName('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (folderId: string) => {
    if (!editingName.trim()) return;
    setError(null);
    try {
      await renameFolder(folderId, editingName);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (folder: RagFolder) => {
    const docCount = getDocCountForFolder(folder.id);
    const message = docCount > 0
      ? `Supprimer le dossier "${folder.name}" ? Les ${docCount} document(s) qu'il contient seront déplacés dans "Non classés".`
      : `Supprimer le dossier "${folder.name}" ?`;
    if (!confirm(message)) return;

    setDeletingId(folder.id);
    try {
      await deleteFolder(folder.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen className="w-4 h-4 text-blue-500" />
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Mes dossiers</h4>
      </div>

      {/* Create folder */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Nouveau dossier..."
          maxLength={50}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleCreate}
          disabled={isCreating || !newFolderName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
          Créer
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
      )}

      {/* Folder list */}
      <div className="space-y-1">
        {folders.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
            Aucun dossier. Créez votre premier dossier pour organiser vos documents.
          </p>
        ) : (
          <>
            {folders.map(folder => (
              <div
                key={folder.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
              >
                <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />

                {editingId === folder.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(folder.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      maxLength={50}
                      className="flex-1 px-2 py-0.5 text-sm rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                    />
                    <button onClick={() => handleRename(folder.id)} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                      {folder.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {getDocCountForFolder(folder.id)} doc{getDocCountForFolder(folder.id) > 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}
                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Renommer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(folder)}
                        disabled={deletingId === folder.id}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === folder.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Non classés */}
            <div className="flex items-center gap-2 px-3 py-2 text-gray-400 dark:text-gray-500">
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm italic">Non classés</span>
              <span className="text-xs">{getUnfiledDocCount()} doc{getUnfiledDocCount() > 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FolderManager;