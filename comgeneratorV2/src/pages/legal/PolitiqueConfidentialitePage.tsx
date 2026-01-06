// src/pages/legal/PolitiqueConfidentialitePage.tsx
import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { Shield, Eye, Lock, Database, Share2, Clock, Bot, FileText } from 'lucide-react';

export function PolitiqueConfidentialitePage() {
  return (
    <LegalLayout 
      title="Politique de confidentialité" 
      lastUpdated="6 janvier 2026"
    >
      <div className="space-y-8">
        
        {/* Introduction */}
        <section>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Shield className="w-8 h-8 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                Notre engagement pour votre vie privée
              </h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Chez ProfAssist, nous prenons la protection de vos données personnelles très au sérieux. 
              Cette politique explique quelles informations nous collectons, pourquoi nous les collectons, 
              et comment nous les protégeons conformément au RGPD.
            </p>
          </div>
        </section>

        {/* Responsable du traitement */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            1. Responsable du traitement
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 mb-2">
              <strong>Responsable du traitement :</strong> Lionel Delorenzo
            </p>
            <p className="text-gray-700 mb-2">
              <strong>Contact :</strong> <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700">contact-profassist@teachtech.fr</a>
            </p>
            <p className="text-gray-700">
              <strong>Adresse :</strong> Busloup, France
            </p>
          </div>
        </section>

        {/* Données collectées */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
            <Database className="w-5 h-5 mr-2 text-blue-600" />
            2. Données collectées
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Données d'inscription */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Eye className="w-4 h-4 mr-2 text-green-600" />
                Données d'inscription
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Adresse email (obligatoire)</li>
                <li>• Mot de passe (chiffré)</li>
                <li>• Date de création du compte</li>
                <li>• Préférences d'utilisation</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 bg-green-50 p-2 rounded">
                <strong>Base légale :</strong> Exécution du contrat
              </p>
            </div>

            {/* Données d'utilisation */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-blue-600" />
                Données d'utilisation
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Nombre de tokens utilisés</li>
                <li>• Historique des générations</li>
                <li>• Statistiques d'usage</li>
                <li>• Logs de connexion</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 bg-blue-50 p-2 rounded">
                <strong>Base légale :</strong> Intérêt légitime
              </p>
            </div>

            {/* Contenu créé */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Lock className="w-4 h-4 mr-2 text-purple-600" />
                Contenu créé
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Appréciations générées</li>
                <li>• Synthèses de bulletins</li>
                <li>• Communications créées</li>
                <li>• Séances pédagogiques</li>
                <li>• Scénarios pédagogiques</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 bg-purple-50 p-2 rounded">
                <strong>Propriété :</strong> Vous restez propriétaire
              </p>
            </div>

            {/* Données de paiement */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Share2 className="w-4 h-4 mr-2 text-orange-600" />
                Données de paiement
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Historique des achats</li>
                <li>• Montants des transactions</li>
                <li>• ID des transactions Stripe</li>
                <li>• Statut des paiements</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 bg-orange-50 p-2 rounded">
                <strong>Note :</strong> Aucune donnée bancaire stockée
              </p>
            </div>

            {/* Documents Chatbot */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-indigo-600" />
                Documents uploadés (Chatbot)
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Fichiers PDF, DOCX, TXT uploadés</li>
                <li>• Contenu textuel extrait et indexé</li>
                <li>• Métadonnées des documents (nom, taille, date)</li>
                <li>• Embeddings vectoriels pour la recherche</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 bg-indigo-50 p-2 rounded">
                <strong>Stockage :</strong> Privé et sécurisé par utilisateur
              </p>
            </div>

            {/* Conversations Chatbot */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Bot className="w-4 h-4 mr-2 text-teal-600" />
                Conversations Chatbot
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Questions posées au chatbot</li>
                <li>• Réponses générées par l'IA</li>
                <li>• Sources documentaires utilisées</li>
                <li>• Réponses sauvegardées en banque</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3 bg-teal-50 p-2 rounded">
                <strong>Finalité :</strong> Amélioration des réponses
              </p>
            </div>
          </div>
        </section>

        {/* Finalités du traitement */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            3. Finalités du traitement
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🎯 Fourniture du service</h3>
              <p className="text-gray-700">
                Permettre l'utilisation de nos outils d'IA pour la génération d'appréciations, 
                synthèses, communications, séances et scénarios pédagogiques.
              </p>
            </div>

            <div className="bg-indigo-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🤖 Chatbot personnalisé (RAG)</h3>
              <p className="text-gray-700 mb-3">
                Traitement de vos documents pour alimenter votre chatbot personnel :
              </p>
              <ul className="text-gray-700 space-y-1 text-sm">
                <li>• <strong>Indexation :</strong> Extraction du texte et création d'embeddings vectoriels</li>
                <li>• <strong>Recherche :</strong> Identification des passages pertinents pour répondre à vos questions</li>
                <li>• <strong>Génération :</strong> Création de réponses basées sur vos documents via OpenAI</li>
                <li>• <strong>Isolation :</strong> Vos documents ne sont accessibles qu'à vous seul</li>
              </ul>
            </div>

            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">💳 Gestion des paiements</h3>
              <p className="text-gray-700">
                Traitement des achats de tokens, facturation et suivi des consommations.
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📊 Amélioration du service</h3>
              <p className="text-gray-700">
                Analyse anonymisée des usages pour améliorer nos algorithmes et fonctionnalités.
              </p>
            </div>

            <div className="bg-amber-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🛡️ Sécurité et prévention</h3>
              <p className="text-gray-700">
                Détection et prévention des usages frauduleux ou abusifs de la plateforme.
              </p>
            </div>
          </div>
        </section>

        {/* Partage des données */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            4. Partage et transfert des données
          </h2>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 text-red-800">
              ❌ Ce que nous ne faisons jamais
            </h3>
            <ul className="text-red-700 space-y-1">
              <li>• Nous ne vendons pas vos données</li>
              <li>• Nous ne les partageons pas à des fins publicitaires</li>
              <li>• Nous ne créons pas de profils marketing</li>
              <li>• Vos documents chatbot ne sont jamais partagés avec d'autres utilisateurs</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🤖 OpenAI</h3>
              <p className="text-gray-700 mb-2">
                Vos demandes de génération et questions chatbot sont transmises à OpenAI pour traitement. 
              </p>
              <p className="text-gray-600 text-sm">
                <strong>Garantie :</strong> OpenAI ne stocke pas les données transmises via l'API et ne les utilise pas pour l'entraînement de ses modèles.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">💳 Stripe</h3>
              <p className="text-gray-700 mb-2">
                Les données de paiement sont traitées directement par Stripe (certifié PCI DSS).
              </p>
              <p className="text-gray-600 text-sm">
                <strong>Sécurité :</strong> Aucune donnée bancaire ne transite par nos serveurs.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🏢 Supabase</h3>
              <p className="text-gray-700 mb-2">
                Hébergement sécurisé de la base de données et des documents chatbot (serveurs en Europe).
              </p>
              <p className="text-gray-600 text-sm">
                <strong>Conformité :</strong> Certifié RGPD. Vos documents sont stockés de manière chiffrée.
              </p>
            </div>
          </div>
        </section>

        {/* Durée de conservation */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            5. Durée de conservation
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📝 Contenu créé</h3>
                <p className="text-gray-700 text-sm">
                  Conservé tant que votre compte est actif + 1 an après suppression du compte
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">💰 Données de paiement</h3>
                <p className="text-gray-700 text-sm">
                  Conservées 10 ans pour obligations comptables et fiscales
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📊 Logs techniques</h3>
                <p className="text-gray-700 text-sm">
                  Supprimés automatiquement après 12 mois
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🔐 Données d'authentification</h3>
                <p className="text-gray-700 text-sm">
                  Supprimées immédiatement lors de la suppression du compte
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📄 Documents chatbot</h3>
                <p className="text-gray-700 text-sm">
                  Conservés tant que votre compte est actif. Supprimés sous 30 jours après suppression du compte.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">💬 Historique chatbot</h3>
                <p className="text-gray-700 text-sm">
                  Conversations conservées 12 mois, puis anonymisées ou supprimées.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Droits des utilisateurs */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            6. Vos droits (RGPD)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">👁️ Droit d'accès</h3>
              <p className="text-gray-700 text-sm">
                Connaître quelles données nous avons sur vous
              </p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">✏️ Droit de rectification</h3>
              <p className="text-gray-700 text-sm">
                Corriger des informations inexactes
              </p>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🗑️ Droit à l'effacement</h3>
              <p className="text-gray-700 text-sm">
                Supprimer vos données (sous conditions)
              </p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">📦 Droit à la portabilité</h3>
              <p className="text-gray-700 text-sm">
                Récupérer vos données dans un format lisible
              </p>
            </div>
            
            <div className="bg-amber-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">⏸️ Droit de limitation</h3>
              <p className="text-gray-700 text-sm">
                Suspendre le traitement de vos données
              </p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">✋ Droit d'opposition</h3>
              <p className="text-gray-700 text-sm">
                Vous opposer au traitement pour motifs légitimes
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              🚀 Comment exercer vos droits ?
            </h3>
            <p className="text-gray-700 mb-4">
              Contactez-nous à <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700 font-medium">contact-profassist@teachtech.fr</a> 
              avec votre demande. Nous vous répondrons sous 30 jours.
            </p>
            <p className="text-gray-600 text-sm">
              💡 <strong>Astuce :</strong> Vous pouvez aussi gérer la plupart de vos données directement depuis votre dashboard ProfAssist, 
              y compris supprimer vos documents chatbot.
            </p>
          </div>
        </section>

        {/* Sécurité */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            7. Sécurité des données
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-green-50 rounded-lg p-6 text-center">
              <Lock className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">🔒 Chiffrement</h3>
              <p className="text-gray-700 text-sm">
                Toutes les données sont chiffrées en transit (HTTPS) et au repos (AES-256)
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6 text-center">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">🛡️ Authentification</h3>
              <p className="text-gray-700 text-sm">
                Mots de passe hachés avec bcrypt, sessions sécurisées
              </p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-6 text-center">
              <Database className="w-12 h-12 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">💾 Sauvegarde</h3>
              <p className="text-gray-700 text-sm">
                Sauvegardes automatiques quotidiennes et réplication
              </p>
            </div>
          </div>

          <div className="bg-indigo-50 rounded-lg p-6 mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">🔐 Sécurité des documents Chatbot</h3>
            <ul className="text-gray-700 space-y-2 text-sm">
              <li>• <strong>Isolation :</strong> Chaque utilisateur a son propre espace de stockage isolé</li>
              <li>• <strong>Accès :</strong> Vos documents ne sont accessibles qu'à vous via votre session authentifiée</li>
              <li>• <strong>Chiffrement :</strong> Documents stockés de manière chiffrée sur les serveurs Supabase</li>
              <li>• <strong>Suppression :</strong> Possibilité de supprimer vos documents à tout moment depuis l'interface</li>
            </ul>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
            <h3 className="font-semibold text-red-800 mb-3">🚨 En cas de violation de données</h3>
            <p className="text-red-700">
              Nous nous engageons à vous notifier dans les 72h en cas de violation de sécurité 
              pouvant présenter un risque pour vos droits et libertés, conformément au RGPD.
            </p>
          </div>
        </section>

        {/* Cookies */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            8. Cookies et technologies similaires
          </h2>
          
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">✅ Cookies essentiels (obligatoires)</h3>
              <ul className="text-gray-700 space-y-1 mb-3">
                <li>• Session d'authentification</li>
                <li>• Préférences de sécurité</li>
                <li>• Fonctionnement du panier (tokens)</li>
              </ul>
              <p className="text-gray-600 text-sm">
                Ces cookies sont indispensables au fonctionnement du site et ne peuvent être désactivés.
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📊 Cookies analytiques (optionnels)</h3>
              <ul className="text-gray-700 space-y-1 mb-3">
                <li>• Mesures d'audience anonymes</li>
                <li>• Statistiques d'utilisation</li>
                <li>• Amélioration de l'expérience utilisateur</li>
              </ul>
              <p className="text-gray-600 text-sm">
                Vous pouvez refuser ces cookies sans impact sur le fonctionnement du site.
              </p>
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-lg p-4 mt-4">
            <p className="text-gray-700 text-sm">
              💡 <strong>Gestion des cookies :</strong> Vous pouvez modifier vos préférences à tout moment 
              depuis les paramètres de votre navigateur ou nous contacter.
            </p>
          </div>
        </section>

        {/* Modifications */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            9. Modifications de cette politique
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 mb-4">
              Cette politique de confidentialité peut être amenée à évoluer pour s'adapter aux évolutions légales 
              ou techniques de notre service.
            </p>
            <p className="text-gray-700 mb-4">
              En cas de modification substantielle, nous vous informerons par email et/ou par une notification 
              sur votre dashboard au moins 30 jours avant l'entrée en vigueur.
            </p>
            <p className="text-gray-700">
              La version en vigueur est toujours celle disponible sur cette page, avec la date de dernière mise à jour indiquée en haut.
            </p>
          </div>
        </section>

        {/* Contact et réclamation */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            10. Contact et réclamation
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📧 Contactez-nous</h3>
              <p className="text-gray-700 mb-2">
                Pour toute question sur cette politique ou vos données :
              </p>
              <a 
                href="mailto:contact-profassist@teachtech.fr" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                contact-profassist@teachtech.fr
              </a>
              <p className="text-gray-600 text-sm mt-2">
                Réponse sous 48h ouvrées
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">⚖️ Réclamation CNIL</h3>
              <p className="text-gray-700 mb-2">
                Vous pouvez déposer une réclamation auprès de la CNIL :
              </p>
              <p className="text-gray-600 text-sm">
                <a href="https://www.cnil.fr" className="text-blue-600 hover:text-blue-700">www.cnil.fr</a><br />
                Commission Nationale de l'Informatique et des Libertés<br />
                3 Place de Fontenoy, 75007 Paris
              </p>
            </div>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
