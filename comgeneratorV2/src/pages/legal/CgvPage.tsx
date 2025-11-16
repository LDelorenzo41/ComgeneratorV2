// src/pages/legal/CgvPage.tsx
import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { ShoppingCart, CreditCard, RefreshCw, Shield, AlertCircle, Euro } from 'lucide-react';

export function CgvPage() {
  return (
    <LegalLayout 
      title="Conditions générales de vente" 
      lastUpdated="24 août 2025"
    >
      <div className="space-y-8">
        
        {/* Introduction */}
        <section>
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <ShoppingCart className="w-8 h-8 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                Achat de tokens ProfAssist
              </h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Les présentes conditions générales de vente (CGV) s'appliquent à tous les achats de tokens 
              sur la plateforme ProfAssist. Elles complètent nos conditions générales d'utilisation et 
              définissent les modalités de vente de nos crédits d'intelligence artificielle.
            </p>
          </div>
        </section>

        {/* Vendeur */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            1. Identification du vendeur
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🏢 Raison sociale</h3>
                <p className="text-gray-700">Lionel Delorenzo - ProfAssist</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📍 Adresse</h3>
                <p className="text-gray-700">Busloup, France</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📧 Contact commercial</h3>
                <p className="text-gray-700">
                  <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700">
                    contact-profassist@teachtech.fr
                  </a>
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">💼 Forme juridique</h3>
                <p className="text-gray-700">Entreprise individuelle</p>
              </div>
            </div>
          </div>
        </section>

        {/* Produits et services */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
            <Euro className="w-5 h-5 mr-2 text-green-600" />
            2. Produits et tarifs
          </h2>
          
          <div className="space-y-6">
            {/* Description des tokens */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🪙 Qu'est-ce qu'un token ?</h3>
              <p className="text-gray-700 mb-4">
                Les tokens sont des crédits numériques qui permettent d'utiliser nos services d'intelligence artificielle. 
                Un token correspond approximativement à 4 caractères de texte généré par l'IA.
              </p>
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">📊 Consommation moyenne</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 font-bold">A</span>
                    </div>
                    <p className="text-sm text-gray-700">Appréciation</p>
                    <p className="text-lg font-semibold text-gray-900">~3000</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 font-bold">S</span>
                    </div>
                    <p className="text-sm text-gray-700">Synthèse</p>
                    <p className="text-lg font-semibold text-gray-900">~1800</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <span className="text-purple-600 font-bold">C</span>
                    </div>
                    <p className="text-sm text-gray-700">Communication</p>
                    <p className="text-lg font-semibold text-gray-900">~1000</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-orange-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <span className="text-orange-600 font-bold">P</span>
                    </div>
                    <p className="text-sm text-gray-700">Séance</p>
                    <p className="text-lg font-semibold text-gray-900">~3500</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Offres commerciales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan Professeur */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-bold text-sm">P</span>
                  </div>
                  Plan Professeur
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-gray-900 mb-1">300 000 tokens</p>
                    <p className="text-lg font-semibold text-green-600">3,50 €</p>
                    <p className="text-sm text-gray-600 mt-2">Soit ~0,0117 € / 1000 tokens</p>
                  </div>
                  
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">+ Option Banque (+1,00 €)</h4>
                    <p className="text-sm text-gray-700">
                      Accès aux contenus de la banque pédagogique premium
                    </p>
                    <p className="text-lg font-semibold text-blue-600 mt-2">Total : 4,50 €</p>
                  </div>
                </div>
              </div>
              
              {/* Plan Professeur Principal */}
              <div className="bg-white border border-indigo-200 rounded-lg p-6 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Recommandé
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-indigo-600 font-bold text-sm">PP</span>
                  </div>
                  Plan Professeur Principal
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-gray-900 mb-1">600 000 tokens</p>
                    <p className="text-lg font-semibold text-green-600">6,00 €</p>
                    <p className="text-sm text-gray-600 mt-2">Soit ~0,01 € / 1000 tokens</p>
                  </div>
                  
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">+ Option Banque (+1,00 €)</h4>
                    <p className="text-sm text-gray-700">
                      Accès aux contenus de la banque pédagogique premium
                    </p>
                    <p className="text-lg font-semibold text-blue-600 mt-2">Total : 7,00 €</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Garanties produit */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-3">
                ✅ Garanties ProfAssist
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center text-green-700">
                  <Shield className="w-5 h-5 mr-2" />
                  <span className="text-sm">Paiement sécurisé Stripe</span>
                </div>
                <div className="flex items-center text-green-700">
                  <RefreshCw className="w-5 h-5 mr-2" />
                  <span className="text-sm">Crédits instantanés</span>
                </div>
                <div className="flex items-center text-green-700">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span className="text-sm">Sans date d'expiration</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Commandes et paiement */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
            3. Commande et paiement
          </h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🛒 Processus de commande</h3>
              <ol className="text-gray-700 space-y-2">
                <li><strong>1.</strong> Sélection du plan de tokens depuis votre dashboard</li>
                <li><strong>2.</strong> Choix optionnel de l'accès à la banque pédagogique</li>
                <li><strong>3.</strong> Vérification du récapitulatif de commande</li>
                <li><strong>4.</strong> Redirection vers le paiement sécurisé Stripe</li>
                <li><strong>5.</strong> Confirmation et crédit automatique des tokens</li>
              </ol>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-green-600" />
                  Moyens de paiement
                </h3>
                <ul className="text-gray-700 space-y-2">
                  <li>• Cartes bancaires (Visa, Mastercard, American Express)</li>
                  <li>• Cartes de débit européennes</li>
                  <li>• Apple Pay et Google Pay</li>
                  <li>• Virements SEPA (selon disponibilité)</li>
                </ul>
                <p className="text-sm text-gray-600 mt-3 bg-green-50 p-2 rounded">
                  🔒 <strong>Sécurité :</strong> Paiements traités par Stripe (certifié PCI DSS Level 1)
                </p>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Euro className="w-5 h-5 mr-2 text-blue-600" />
                  Facturation
                </h3>
                <ul className="text-gray-700 space-y-2">
                  <li>• Paiement immédiat par carte bancaire</li>
                  <li>• Facture envoyée par email automatiquement</li>
                  <li>• TVA non applicable (seuil non atteint)</li>
                  <li>• Historique disponible dans votre dashboard</li>
                </ul>
                <p className="text-sm text-gray-600 mt-3 bg-blue-50 p-2 rounded">
                  📧 <strong>Facture :</strong> Émise immédiatement après paiement
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Livraison */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            4. Livraison des tokens
          </h2>
          
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="font-semibold text-green-800 mb-4">⚡ Livraison instantanée</h3>
            <p className="text-green-700 mb-4">
              Les tokens sont automatiquement crédités sur votre compte ProfAssist dès validation du paiement par Stripe.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">&lt; 30s</div>
                <p className="text-sm text-gray-700">Crédit automatique</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-2">24/7</div>
                <p className="text-sm text-gray-700">Disponible en permanence</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 mb-2">0€</div>
                <p className="text-sm text-gray-700">Frais de livraison</p>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mt-4">
            <h3 className="font-semibold text-amber-800 mb-3">
              ⚠️ Que faire en cas de problème ?
            </h3>
            <p className="text-amber-700 mb-3">
              Si vos tokens ne sont pas crédités dans les 5 minutes suivant le paiement :
            </p>
            <ul className="text-amber-700 space-y-1">
              <li>• Vérifiez votre email de confirmation de paiement Stripe</li>
              <li>• Actualisez votre dashboard ProfAssist</li>
              <li>• Contactez notre support avec votre référence de transaction</li>
            </ul>
          </div>
        </section>

        {/* Droit de rétractation et remboursements */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            5. Droit de rétractation et remboursements
          </h2>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="font-semibold text-red-800 mb-3">
                ❌ Exclusion du droit de rétractation
              </h3>
              <p className="text-red-700 mb-4">
                Conformément à l'article L221-28 du Code de la consommation, les tokens ProfAssist sont exclus 
                du droit de rétractation car ils constituent :
              </p>
              <ul className="text-red-700 space-y-2">
                <li>• Un contenu numérique non fourni sur support matériel</li>
                <li>• Un service totalement exécuté avant la fin du délai de rétractation</li>
                <li>• Une prestation de service dont l'exécution a commencé avec votre accord</li>
              </ul>
              <p className="text-red-600 text-sm mt-4 bg-white p-3 rounded">
                <strong>Important :</strong> Aucun remboursement n'est possible une fois les tokens crédités sur votre compte.
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🔄 Exceptions et gestes commerciaux</h3>
              <p className="text-gray-700 mb-4">
                Dans certains cas exceptionnels, nous pourrons étudier des demandes de remboursement :
              </p>
              <ul className="text-gray-700 space-y-2">
                <li>• Erreur technique de notre système</li>
                <li>• Double paiement accidentel</li>
                <li>• Dysfonctionnement majeur du service dans les 48h suivant l'achat</li>
                <li>• Erreur manifeste de notre part</li>
              </ul>
              <p className="text-gray-600 text-sm mt-3">
                💡 Ces demandes sont étudiées au cas par cas et ne constituent pas un droit.
              </p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">✅ Garantie qualité</h3>
              <p className="text-gray-700 mb-4">
                Nous nous engageons à fournir un service de qualité :
              </p>
              <ul className="text-gray-700 space-y-2">
                <li>• Tokens utilisables immédiatement après achat</li>
                <li>• Fonctionnement des services d'IA selon nos spécifications</li>
                <li>• Support technique gratuit</li>
                <li>• Mise à jour continue des algorithmes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Propriété et usage des tokens */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            6. Propriété et usage des tokens
          </h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🪙 Nature des tokens</h3>
              <p className="text-gray-700 mb-4">
                Les tokens constituent un droit d'usage personnel et non cessible des services d'intelligence 
                artificielle de ProfAssist.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">✅ Autorisé</h4>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>• Usage personnel professionnel</li>
                    <li>• Génération de contenu pour vos classes</li>
                    <li>• Conservation illimitée des tokens</li>
                    <li>• Utilisation progressive selon vos besoins</li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">❌ Interdit</h4>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>• Revente ou transfert des tokens</li>
                    <li>• Partage de compte avec des collègues</li>
                    <li>• Usage commercial en dehors du cadre éducatif</li>
                    <li>• Tentatives de contournement du système</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">♾️ Validité des tokens</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-2">∞</div>
                  <p className="text-sm text-gray-700">Pas d'expiration</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-2">✓</div>
                  <p className="text-sm text-gray-700">Utilisables immédiatement</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">+</div>
                  <p className="text-sm text-gray-700">Cumulables entre achats</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Responsabilité et garanties */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            7. Responsabilité et garanties
          </h2>
          
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-3">✅ Nos engagements</h3>
              <ul className="text-green-700 space-y-2">
                <li>• Délivrance immédiate des tokens après paiement validé</li>
                <li>• Fonctionnement des services d'IA selon nos spécifications techniques</li>
                <li>• Protection des données personnelles selon notre politique</li>
                <li>• Support technique durant toute la durée de vie des tokens</li>
                <li>• Amélioration continue de nos algorithmes</li>
              </ul>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="font-semibold text-amber-800 mb-3">⚠️ Limitations de responsabilité</h3>
              <p className="text-amber-700 mb-4">
                Notre responsabilité est limitée dans les cas suivants :
              </p>
              <ul className="text-amber-700 space-y-2">
                <li>• Contenu généré par l'intelligence artificielle (vérification requise par l'utilisateur)</li>
                <li>• Interruptions techniques dues à des tiers (OpenAI, hébergeurs)</li>
                <li>• Usage des tokens contraire à nos CGU</li>
                <li>• Dommages indirects ou perte d'exploitation</li>
              </ul>
              <p className="text-amber-600 text-sm mt-4 bg-white p-3 rounded">
                <strong>Plafond de responsabilité :</strong> Notre responsabilité est limitée au montant des tokens consommés ou non utilisés.
              </p>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="font-semibold text-red-800 mb-3">🚫 Exclusions</h3>
              <p className="text-red-700 mb-3">
                Nous ne saurions être tenus responsables en cas de :
              </p>
              <ul className="text-red-700 space-y-1">
                <li>• Force majeure ou cas fortuit</li>
                <li>• Défaillance d'OpenAI ou des services tiers</li>
                <li>• Mauvaise utilisation par l'utilisateur</li>
                <li>• Décisions pédagogiques prises sur la base du contenu généré</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Protection des données */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            8. Protection des données personnelles
          </h2>
          
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Données de facturation
            </h3>
            <p className="text-gray-700 mb-4">
              Dans le cadre des achats de tokens, nous collectons et traitons :
            </p>
            <ul className="text-gray-700 space-y-2 mb-4">
              <li>• Votre adresse email (pour la facturation)</li>
              <li>• Historique de vos achats</li>
              <li>• Données de transaction Stripe (ID, montant, date)</li>
              <li>• Consommation de tokens (pour le support)</li>
            </ul>
            <p className="text-gray-600 text-sm">
              <strong>Base légale :</strong> Exécution du contrat de vente et obligations comptables.<br />
              <strong>Durée de conservation :</strong> 10 ans pour les données comptables, selon la législation française.
            </p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-6 mt-4">
            <p className="text-gray-700">
              Pour plus d'informations, consultez notre 
              <a href="/legal/politique-confidentialite" className="text-blue-600 hover:text-blue-700 font-medium"> politique de confidentialité</a>.
            </p>
          </div>
        </section>

        {/* Service client */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            9. Service client et réclamations
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📞 Support technique</h3>
              <p className="text-gray-700 mb-3">
                Pour toute question sur vos tokens ou problème technique :
              </p>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-gray-700">
                  📧 <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700 font-medium">
                    contact-profassist@teachtech.fr
                  </a>
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  Réponse sous 48h ouvrées<br />
                  Support gratuit durant toute la durée de vie de vos tokens
                </p>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">⚖️ Réclamations</h3>
              <p className="text-gray-700 mb-3">
                En cas de litige commercial :
              </p>
              <ol className="text-gray-700 space-y-2 text-sm">
                <li><strong>1.</strong> Contact préalable avec notre service client</li>
                <li><strong>2.</strong> Recherche d'une solution amiable (60 jours)</li>
                <li><strong>3.</strong> Médiation de consommation si nécessaire</li>
                <li><strong>4.</strong> Tribunaux compétents en dernier recours</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Droit applicable */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            10. Droit applicable et juridiction
          </h2>
          
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🇫🇷 Législation française</h3>
              <p className="text-gray-700 mb-4">
                Les présentes conditions de vente sont soumises au droit français, notamment :
              </p>
              <ul className="text-gray-700 space-y-1">
                <li>• Code de la consommation</li>
                <li>• Code civil</li>
                <li>• Code de commerce</li>
                <li>• Règlement général sur la protection des données (RGPD)</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">⚖️ Juridiction compétente</h3>
              <p className="text-gray-700">
                En cas de litige, après recherche d'une solution amiable, les tribunaux français seront 
                seuls compétents. La juridiction compétente sera celle du lieu du siège social de 
                ProfAssist ou du domicile du défendeur.
              </p>
            </div>
          </div>
        </section>

        {/* Évolution des CGV */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            11. Évolution des conditions
          </h2>
          
          <div className="bg-amber-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">📝 Modifications des CGV</h3>
            <p className="text-gray-700 mb-4">
              Ces conditions générales de vente peuvent être modifiées à tout moment. 
              Les conditions applicables sont celles en vigueur au moment de votre commande.
            </p>
            <p className="text-gray-700 mb-4">
              Les modifications substantielles (tarifs, modalités de paiement) vous seront notifiées 
              par email au moins 30 jours avant leur entrée en vigueur.
            </p>
            <p className="text-gray-600 text-sm">
              💡 <strong>Conseil :</strong> Consultez régulièrement cette page pour prendre connaissance des éventuelles évolutions.
            </p>
          </div>
        </section>

        {/* Contact commercial */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            12. Contact et informations commerciales
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🏢 Informations légales</h3>
              <div className="text-gray-700 space-y-2">
                <p><strong>Vendeur :</strong> Lionel Delorenzo</p>
                <p><strong>Adresse :</strong> Busloup, France</p>
                <p><strong>Email :</strong> 
                  <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700 ml-1">
                    contact-profassist@teachtech.fr
                  </a>
                </p>
                <p><strong>Forme juridique :</strong> Entreprise individuelle</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">💬 Questions fréquentes</h3>
              <ul className="text-gray-700 space-y-1 text-sm">
                <li>• <strong>Problème de paiement :</strong> Vérifiez vos emails Stripe</li>
                <li>• <strong>Tokens non crédités :</strong> Patientez 5 min ou contactez-nous</li>
                <li>• <strong>Facture :</strong> Automatique par email après paiement</li>
                <li>• <strong>Consommation :</strong> Visible dans votre dashboard</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-white rounded-lg p-4">
            <p className="text-gray-700 text-center">
              <strong>🎯 Notre mission :</strong> Simplifier le quotidien des enseignants grâce à l'intelligence artificielle, 
              avec transparence et respect de vos données.
            </p>
          </div>
        </section>

        {/* Acceptation */}
        <section className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">
            ✅ Acceptation des conditions de vente
          </h2>
          <p className="text-green-700 leading-relaxed mb-4">
            En procédant au paiement de tokens ProfAssist, vous reconnaissez avoir lu, compris et accepté 
            l'intégralité de ces conditions générales de vente.
          </p>
          <div className="bg-white rounded-lg p-4">
            <p className="text-gray-700 text-sm">
              <strong>Validation :</strong> Votre clic sur le bouton de paiement constitue votre signature électronique 
              et emporte acceptation pleine et entière des présentes CGV.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}