// src/components/chatbot/DocumentList.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Trash2, RefreshCw, AlertCircle, CheckCircle2, 
  Clock, Loader2, Globe, User, Lock, RotateCcw, ChevronDown, ChevronRight,
  BookOpen, GraduationCap, Filter, X, Info
} from 'lucide-react';
import type { RagDocument, DocumentType } from '../../lib/rag.types';
import { formatFileSize, getStatusLabel, getStatusColor, DOCUMENT_TYPES, LEVEL_LABELS } from '../../lib/rag.types';
import { deleteDocument, checkIsAdmin, reanalyzeDocument } from '../../lib/ragApi';

interface DocumentListProps {
  documents: RagDocument[];
  onRefresh: () => void;
  isLoading?: boolean;
}

// Grouper les documents par matière
interface SubjectGroup {
  subject: string;
  documents: RagDocument[];
  byType: Record<string, RagDocument[]>;
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onRefresh, isLoading = false }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [showDocDetail, setShowDocDetail] = useState<string | null>(null);

  useEffect(() => {
    checkIsAdmin().then(setIsAdmin);
  }, []);

  const globalDocs = documents.filter(d => d.scope === 'global');
  const userDocs = documents.filter(d => d.scope === 'user');

  // Filtrer par niveau si sélectionné
  const filteredGlobalDocs = useMemo(() => {
    if (!selectedLevel) return globalDocs;
    return globalDocs.filter(doc => 
      doc.levels?.includes(selectedLevel)
    );
  }, [globalDocs, selectedLevel]);

  // Grouper les documents globaux par matière
  const subjectGroups = useMemo(() => {
    const groups: Record<string, SubjectGroup> = {};
    
    for (const doc of filteredGlobalDocs) {
      const subjects = doc.subjects?.length ? doc.subjects : ['autre'];
      const docType = doc.document_type || 'autre';
      
      for (const subject of subjects) {
        if (!groups[subject]) {
          groups[subject] = { subject, documents: [], byType: {} };
        }
        groups[subject].documents.push(doc);
        
        if (!groups[subject].byType[docType]) {
          groups[subject].byType[docType] = [];
        }
        groups[subject].byType[docType].push(doc);
      }
    }
    
    // Trier par nombre de documents décroissant
    return Object.values(groups).sort((a, b) => b.documents.length - a.documents.length);
  }, [filteredGlobalDocs]);

  // Extraire tous les niveaux disponibles
  const availableLevels = useMemo(() => {
    const levels = new Set<string>();
    globalDocs.forEach(doc => {
      doc.levels?.forEach(level => levels.add(level));
    });
    return Array.from(levels).sort();
  }, [globalDocs]);

  const toggleSubject = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  };

  const handleDelete = async (doc: RagDocument) => {
    if (doc.scope === 'global' && !isAdmin) {
      alert('Les documents PROFASSIST ne peuvent pas être supprimés.');
      return;
    }

    const confirmMessage = doc.scope === 'global'
      ? `⚠️ ATTENTION: Supprimer le document officiel "${doc.title}" ?\n\nCe document est accessible à TOUS les utilisateurs.`
      : `Supprimer "${doc.title}" ?`;

    if (!confirm(confirmMessage)) return;

    try {
      setDeletingId(doc.id);
      await deleteDocument(doc.id);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReanalyze = async (doc: RagDocument) => {
    if (!isAdmin) return;
    
    try {
      setReanalyzingId(doc.id);
      await reanalyzeDocument(doc.id);
      alert('✅ Analyse IA mise à jour');
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la ré-analyse');
    } finally {
      setReanalyzingId(null);
    }
  };

  const getStatusIcon = (status: RagDocument['status']) => {
    switch (status) {
      case 'uploaded': return <Clock className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'ready': return <CheckCircle2 className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getDocTypeInfo = (docType: string) => {
    return DOCUMENT_TYPES[docType as DocumentType] || DOCUMENT_TYPES.autre;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Chargement...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Aucun document</p>
      </div>
    );
  }

  // Composant pour un document compact
  const DocumentItemCompact: React.FC<{ doc: RagDocument; showType?: boolean }> = ({ doc, showType = false }) => {
    const isGlobal = doc.scope === 'global';
    const canDelete = isGlobal ? isAdmin : true;
    const typeInfo = getDocTypeInfo(doc.document_type || 'autre');
    const isExpanded = showDocDetail === doc.id;
    
    return (
      <div className="group">
        <div
          className={`flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer ${
            isGlobal 
              ? 'hover:bg-purple-50 dark:hover:bg-purple-900/30' 
              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
          } ${isExpanded ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}
          onClick={() => setShowDocDetail(isExpanded ? null : doc.id)}
        >
          {/* Icône type */}
          {showType && (
            <span className="text-sm flex-shrink-0" title={typeInfo.label}>
              {typeInfo.icon}
            </span>
          )}
          
          {/* Titre */}
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
            {doc.title}
          </span>
          
          {/* Badge sections */}
          {doc.chunk_count > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {doc.chunk_count}
            </span>
          )}
          
          {/* Actions (visibles au hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAdmin && doc.status === 'ready' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleReanalyze(doc); }}
                disabled={reanalyzingId === doc.id}
                className="p-1 rounded text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
                title="Ré-analyser"
              >
                {reanalyzingId === doc.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
              </button>
            )}
            
            {canDelete ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                disabled={deletingId === doc.id}
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                title="Supprimer"
              >
                {deletingId === doc.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            ) : (
              <Lock className="w-3 h-3 text-gray-300 dark:text-gray-600" />
            )}
          </div>
        </div>
        
        {/* Détails expandés */}
        {isExpanded && (
          <div className="ml-6 mt-1 p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800 text-xs space-y-2">
            {doc.summary && (
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {doc.summary}
              </p>
            )}
            
            {doc.levels && doc.levels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <GraduationCap className="w-3 h-3 text-indigo-500" />
                {doc.levels.map(level => (
                  <span key={level} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                    {LEVEL_LABELS[level] || level}
                  </span>
                ))}
              </div>
            )}
            
            {doc.keywords && doc.keywords.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {doc.keywords.slice(0, 8).map(kw => (
                  <span key={kw} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    {kw}
                  </span>
                ))}
                {doc.keywords.length > 8 && (
                  <span className="text-gray-400">+{doc.keywords.length - 8}</span>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-3 text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
              {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
              <span>{doc.chunk_count} sections</span>
              <span className={`inline-flex items-center gap-1 ${getStatusColor(doc.status)}`}>
                {getStatusIcon(doc.status)}
                {getStatusLabel(doc.status)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Composant pour un groupe par matière
  const SubjectGroupCard: React.FC<{ group: SubjectGroup }> = ({ group }) => {
    const isExpanded = expandedSubjects.has(group.subject);
    const typeEntries = Object.entries(group.byType).sort((a, b) => b[1].length - a[1].length);
    
    return (
      <div className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
        {/* Header du groupe */}
        <button
          onClick={() => toggleSubject(group.subject)}
          className="w-full flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-purple-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-purple-500" />
          )}
          <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-medium text-purple-700 dark:text-purple-300 flex-1 text-left">
            {group.subject}
          </span>
          <span className="text-xs text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">
            {group.documents.length}
          </span>
        </button>
        
        {/* Contenu du groupe */}
        {isExpanded && (
          <div className="p-2 space-y-3">
            {typeEntries.map(([docType, docs]) => {
              const typeInfo = getDocTypeInfo(docType);
              return (
                <div key={docType}>
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <span className="text-sm">{typeInfo.icon}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {typeInfo.label}
                    </span>
                    <span className="text-xs text-gray-400">({docs.length})</span>
                  </div>
                  <div className="space-y-0.5">
                    {docs.map(doc => (
                      <DocumentItemCompact key={doc.id} doc={doc} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Document utilisateur classique
  const UserDocumentItem: React.FC<{ doc: RagDocument }> = ({ doc }) => {
    const canDelete = true;
    
    return (
      <div className="flex items-center p-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {doc.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
            {doc.chunk_count > 0 && <span>• {doc.chunk_count} sections</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
            {getStatusIcon(doc.status)}
            {getStatusLabel(doc.status)}
          </span>

          <button
            onClick={() => handleDelete(doc)}
            disabled={deletingId === doc.id}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            title="Supprimer"
          >
            {deletingId === doc.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {globalDocs.length > 0 && (
            <span className="text-purple-600 dark:text-purple-400">
              {globalDocs.length} officiel{globalDocs.length > 1 ? 's' : ''}
            </span>
          )}
          {globalDocs.length > 0 && userDocs.length > 0 && ' • '}
          {userDocs.length > 0 && (
            <span>{userDocs.length} perso{userDocs.length > 1 ? 's' : ''}</span>
          )}
        </span>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {/* Mes documents - EN PREMIER */}
        {userDocs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Mes documents
              </h4>
            </div>
            <div className="space-y-2">
              {userDocs.map((doc) => (
                <UserDocumentItem key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        )}

        {/* Corpus ProfAssist - Organisé par matière */}
        {globalDocs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-purple-500" />
              <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Corpus ProfAssist
              </h4>
              {isAdmin && (
                <span className="text-xs text-purple-400">(admin)</span>
              )}
            </div>
            
            {/* Filtre par niveau */}
            {availableLevels.length > 0 && (
              <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Filtrer par niveau :</span>
                  {selectedLevel && (
                    <button
                      onClick={() => setSelectedLevel(null)}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Effacer
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableLevels.map(level => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(selectedLevel === level ? null : level)}
                      className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                        selectedLevel === level
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                      }`}
                    >
                      {LEVEL_LABELS[level] || level}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Message si filtre actif */}
            {selectedLevel && (
              <div className="mb-2 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {filteredGlobalDocs.length} document{filteredGlobalDocs.length > 1 ? 's' : ''} pour "{LEVEL_LABELS[selectedLevel] || selectedLevel}"
              </div>
            )}
            
            {/* Groupes par matière */}
            {subjectGroups.length > 0 ? (
              <div className="space-y-2">
                {subjectGroups.map(group => (
                  <SubjectGroupCard key={group.subject} group={group} />
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                Aucun document ne correspond aux filtres
              </div>
            )}
          </div>
        )}

        {globalDocs.length > 0 && userDocs.length === 0 && (
          <div className="text-center py-4 border-t border-gray-200 dark:border-gray-700">
            <User className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ajoutez vos propres documents pour personnaliser votre chatbot
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentList;



