// src/pages/AdminNewsletterPage.tsx
// Page d'administration pour créer et envoyer des newsletters

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Send, 
  Eye, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  TestTube,
  X
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { checkIsAdmin } from '../lib/ragApi';

// Types
type AudienceType = 'ALL' | 'LOW_TOKENS' | 'HIGH_TOKENS';

interface NewsletterFormData {
  subject: string;
  html: string;
  audienceType: AudienceType;
  tokenThreshold: number;
}

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; needsThreshold: boolean }[] = [
  { value: 'ALL', label: 'Tous les abonnés', needsThreshold: false },
  { value: 'LOW_TOKENS', label: 'Abonnés avec moins de X tokens', needsThreshold: true },
  { value: 'HIGH_TOKENS', label: 'Abonnés avec plus de X tokens', needsThreshold: true },
];

export function AdminNewsletterPage() {
  const { user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState<NewsletterFormData>({
    subject: '',
    html: '',
    audienceType: 'ALL',
    tokenThreshold: 1000,
  });
  
  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [isCountingAudience, setIsCountingAudience] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);
      setIsLoading(false);
    };
    checkAdminStatus();
  }, []);

  // Compter l'audience quand les critères changent
  useEffect(() => {
    const countAudience = async () => {
      if (!isAdmin) return;
      
      setIsCountingAudience(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newsletter-audience`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audienceType: formData.audienceType,
              tokenThreshold: formData.tokenThreshold,
            }),
          }
        );

        const data = await response.json();
        if (response.ok) {
          setAudienceCount(data.count);
        }
      } catch (error) {
        console.error('Error counting audience:', error);
      } finally {
        setIsCountingAudience(false);
      }
    };

    const debounceTimer = setTimeout(countAudience, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData.audienceType, formData.tokenThreshold, isAdmin]);

  // Mettre à jour l'aperçu iframe
  useEffect(() => {
    if (showPreview && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(formData.html || '<p style="color: #999; text-align: center;">Aucun contenu à afficher</p>');
        doc.close();
      }
    }
  }, [showPreview, formData.html]);

  const handleSendNewsletter = async (mode: 'test' | 'real') => {
    if (!formData.subject.trim() || !formData.html.trim()) {
      setMessage({ type: 'error', text: 'Veuillez remplir le sujet et le contenu HTML' });
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-newsletter`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: formData.subject,
            html: formData.html,
            audienceType: formData.audienceType,
            tokenThreshold: formData.tokenThreshold,
            mode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }

      setMessage({ 
        type: 'success', 
        text: data.message || `Newsletter envoyée à ${data.recipientCount} destinataires` 
      });

      if (mode === 'real') {
        setShowConfirmModal(false);
      }

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSending(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Accès refusé
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Accès refusé</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Cette page est réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  const selectedAudienceOption = AUDIENCE_OPTIONS.find(opt => opt.value === formData.audienceType);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center mr-4">
              <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des newsletters</h1>
              <p className="text-gray-600 dark:text-gray-300">
                Créez et envoyez des newsletters aux utilisateurs ayant donné leur consentement
              </p>
            </div>
          </div>
          
          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-300 text-sm">
              Cette page est réservée à l'administrateur. Elle permet de créer et d'envoyer des newsletters 
              aux utilisateurs ayant accepté de recevoir des informations.
            </p>
          </div>
        </div>

        {/* Message de feedback */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            {message.type === 'success' 
              ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
              : <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
            }
            <span className={message.type === 'success' 
              ? 'text-green-800 dark:text-green-300' 
              : 'text-red-800 dark:text-red-300'
            }>
              {message.text}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Colonne gauche: Formulaire */}
          <div className="space-y-6">
            
            {/* Sujet */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sujet de l'email *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ex: Nouveautés ProfAssist - Janvier 2025"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Contenu HTML */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contenu HTML *
              </label>
              <textarea
                value={formData.html}
                onChange={(e) => setFormData({ ...formData, html: e.target.value })}
                placeholder="<html>&#10;<body>&#10;  <h1>Titre de la newsletter</h1>&#10;  <p>Contenu...</p>&#10;</body>&#10;</html>"
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Le HTML sera envoyé tel quel. Utilisez des styles inline pour la compatibilité email.
                Un footer de désabonnement sera ajouté automatiquement.
              </p>
            </div>

            {/* Ciblage */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Ciblage des destinataires
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type d'audience
                  </label>
                  <select
                    value={formData.audienceType}
                    onChange={(e) => setFormData({ ...formData, audienceType: e.target.value as AudienceType })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {AUDIENCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAudienceOption?.needsThreshold && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Seuil de tokens (X)
                    </label>
                    <input
                      type="number"
                      value={formData.tokenThreshold}
                      onChange={(e) => setFormData({ ...formData, tokenThreshold: parseInt(e.target.value) || 0 })}
                      min={0}
                      step={100}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Compteur d'audience */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Destinataires estimés :</span>
                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {isCountingAudience ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        audienceCount !== null ? audienceCount.toLocaleString() : '—'
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Seuls les utilisateurs ayant accepté la newsletter seront contactés.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite: Aperçu et actions */}
          <div className="space-y-6">
            
            {/* Aperçu */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Aperçu
                </h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {showPreview ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              
              {showPreview && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  <iframe
                    ref={iframeRef}
                    title="Aperçu newsletter"
                    className="w-full h-96 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Actions
              </h3>
              
              <div className="space-y-4">
                {/* Bouton Test */}
                <button
                  onClick={() => handleSendNewsletter('test')}
                  disabled={isSending || !formData.subject || !formData.html}
                  className="w-full flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-5 h-5 mr-2" />
                  )}
                  Envoyer un test (à mon email)
                </button>

                {/* Bouton Envoi réel */}
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSending || !formData.subject || !formData.html || audienceCount === 0}
                  className="w-full flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Envoyer la newsletter
                </button>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  L'envoi test n'affecte que votre email ({user?.email})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de confirmation */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-4">
                    <Send className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmer l'envoi</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">Action irréversible</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
                <p className="text-purple-800 dark:text-purple-300 text-center">
                  Cette newsletter sera envoyée à{' '}
                  <span className="font-bold text-xl">{audienceCount?.toLocaleString()}</span>{' '}
                  utilisateur{audienceCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Sujet :</strong> {formData.subject}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  <strong>Audience :</strong> {selectedAudienceOption?.label}
                  {selectedAudienceOption?.needsThreshold && ` (${formData.tokenThreshold} tokens)`}
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  disabled={isSending}
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleSendNewsletter('real')}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Confirmer l'envoi
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
