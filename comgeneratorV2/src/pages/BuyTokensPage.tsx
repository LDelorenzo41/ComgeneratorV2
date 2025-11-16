import React from 'react';
import { Sparkles, Check, Star, Crown, Zap, Database, Shield, Clock, Calculator, MessageCircle, PenTool, FileText, BookOpen, TrendingUp } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuthStore } from '../lib/store';

// Initialisation de Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export function BuyTokensPage() {
  const { user } = useAuthStore();
  const [selectedOptions, setSelectedOptions] = React.useState<{
    professor: { withBank: boolean };
    principal: { withBank: boolean };
  }>({
    professor: { withBank: true },
    principal: { withBank: true }
  });

  const [loading, setLoading] = React.useState<string | null>(null);

  const baseFeatures = [
    'Génération d\'appréciations personnalisées',
    'Synthèses automatiques de bulletins', 
    'Communications professionnelles',
    'Création de séances pédagogiques',
    'Support par email',
    'Accès mobile et desktop'
  ];

  const bankFeatures = [
    'Banque d\'appréciations avec tags',
    'Banque de séances archivées',
    'Recherche dans vos contenus',
    'Réutilisation de vos modèles'
  ];

  const plans = [
    {
      id: 'professor',
      name: 'Professeur',
      icon: Star,
      color: 'blue',
      tokens: '300 000',
      basePrice: 3.50,
      description: 'Parfait pour un usage régulier',
      examples: {
        withBank: [
          '🎯 100 appréciations détaillées',
          '💬 150 communications + 50 appréciations',
          '📄 80 synthèses + 52 appréciations',
          '📚 45 séances + 47 appréciations',
          '🔄 Mix équilibré selon vos besoins'
        ],
        withoutBank: [
          '🎯 100 appréciations détaillées',
          '💬 150 communications + 50 appréciations', 
          '📄 80 synthèses + 52 appréciations',
          '📚 45 séances + 47 appréciations',
          '⚠️ Pas de sauvegarde/réutilisation'
        ]
      },
      popular: false
    },
    {
      id: 'principal',
      name: 'Professeur Principal',
      icon: Crown,
      color: 'purple',
      tokens: '600 000',
      basePrice: 6.00,
      description: 'Usage intensif avec plus de flexibilité',
      examples: {
        withBank: [
          '🎯 200 appréciations détaillées',
          '💬 300 communications + 100 appréciations',
          '📄 150 synthèses + 110 appréciations',
          '📚 85 séances + 100 appréciations',
          '🔥 Usage intensif toute l\'année'
        ],
        withoutBank: [
          '🎯 200 appréciations détaillées',
          '💬 300 communications + 100 appréciations',
          '📄 150 synthèses + 110 appréciations', 
          '📚 85 séances + 100 appréciations',
          '⚠️ Pas de sauvegarde/réutilisation'
        ]
      },
      popular: true
    }
  ];

  const toggleBankOption = (planId: 'professor' | 'principal') => {
    setSelectedOptions(prev => ({
      ...prev,
      [planId]: { withBank: !prev[planId].withBank }
    }));
  };

  const handlePlanSelect = async (planId: 'professor' | 'principal') => {
    if (!user) {
      alert('Vous devez être connecté pour acheter des tokens');
      return;
    }

    const withBank = selectedOptions[planId].withBank;
    const plan = plans.find(p => p.id === planId);
    const totalPrice = plan!.basePrice + (withBank ? 1.00 : 0);
    
    // ✅ MAPPING VERS LES PRICE ID STRIPE - UTILISATION DIRECTE DES VARIABLES D'ENVIRONNEMENT
    const priceIdMapping = {
      professor_false: import.meta.env.VITE_STRIPE_PRICE_PROFESSOR_200K,
      professor_true: import.meta.env.VITE_STRIPE_PRICE_PROFESSOR_200K_BANK,
      principal_false: import.meta.env.VITE_STRIPE_PRICE_PRINCIPAL_400K,
      principal_true: import.meta.env.VITE_STRIPE_PRICE_PRINCIPAL_400K_BANK,
    };

    const priceId = priceIdMapping[`${planId}_${withBank}` as keyof typeof priceIdMapping];

    // ✅ DÉBOGAGE : Affichage de toutes les variables d'environnement
    console.log('🔍 DÉBOGAGE VARIABLES ENV:');
    console.log('PROFESSOR_200K:', import.meta.env.VITE_STRIPE_PRICE_PROFESSOR_200K);
    console.log('PROFESSOR_200K_BANK:', import.meta.env.VITE_STRIPE_PRICE_PROFESSOR_200K_BANK);
    console.log('PRINCIPAL_400K:', import.meta.env.VITE_STRIPE_PRICE_PRINCIPAL_400K);
    console.log('PRINCIPAL_400K_BANK:', import.meta.env.VITE_STRIPE_PRICE_PRINCIPAL_400K_BANK);
    console.log('🎯 MAPPING COMPLET:', priceIdMapping);
    console.log('🎯 CLÉ RECHERCHÉE:', `${planId}_${withBank}`);
    console.log('🎯 PRICE ID TROUVÉ:', priceId);
    console.log('🔍 REAL USER ID:', user.id);

    if (!priceId) {
      console.error('❌ Price ID not found for:', planId, withBank);
      console.error('❌ Mapping disponible:', Object.keys(priceIdMapping));
      alert('Erreur de configuration du produit');
      return;
    }

    console.log('✅ Price ID sélectionné:', priceId, 'pour', planId, withBank ? 'avec banque' : 'sans banque');

    setLoading(`${planId}_${withBank}`);

    try {
      // Appel à votre Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          priceId,
          userId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création de la session');
      }

      const { sessionId, url } = await response.json();

      // Redirection vers Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        // Fallback avec Stripe.js
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId });
          if (error) {
            console.error('Erreur Stripe:', error);
            alert('Erreur lors de la redirection vers le paiement');
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'achat:', error);
      alert('Erreur lors de la création de la session de paiement. Veuillez réessayer.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Tokens ProfAssist
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Choisissez votre pack de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              tokens
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Alimentez vos outils pédagogiques IA avec nos packs de tokens. 
            Plus vous en avez, plus vous pouvez créer !
          </p>

          {/* Calculateur de consommation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-center mb-4">
              <Calculator className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-semibold text-gray-900 dark:text-white">Guide de consommation</span>
            </div>
            
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              Un token = unité de mesure pour l'IA (environ 4 caractères de texte). Les estimations incluent la consommation complète : votre demande + la réponse générée.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="flex items-center">
                <PenTool className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Appréciation: 3000 tokens</span>
              </div>
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Synthèse: 1800 tokens</span>
              </div>
              <div className="flex items-center">
                <MessageCircle className="w-4 h-4 text-purple-600 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Communication: 1000 tokens</span>
              </div>
              <div className="flex items-center">
                <BookOpen className="w-4 h-4 text-orange-600 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Séance: 3500 tokens</span>
              </div>
            </div>
            
            <p className="text-center text-xs text-gray-500 dark:text-gray-500">
              * Estimations moyennes - La consommation varie selon vos demandes et la longueur souhaitée
            </p>
          </div>
        </div>

        {/* Plans Comparison */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan) => {
            const withBank = selectedOptions[plan.id as keyof typeof selectedOptions].withBank;
            const totalPrice = plan.basePrice + (withBank ? 1.00 : 0);
            const isLoading = loading === `${plan.id}_${withBank}`;
            
            const colorClasses = {
              blue: {
                gradient: 'from-blue-500 to-indigo-500',
                bg: 'bg-blue-50 dark:bg-blue-900/30',
                border: 'border-blue-200 dark:border-blue-800',
                text: 'text-blue-600 dark:text-blue-400',
                button: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              },
              purple: {
                gradient: 'from-purple-500 to-pink-500',
                bg: 'bg-purple-50 dark:bg-purple-900/30',
                border: 'border-purple-200 dark:border-purple-800',
                text: 'text-purple-600 dark:text-purple-400',
                button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
              }
            };
            
            const colors = colorClasses[plan.color as keyof typeof colorClasses];
            
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border-2 transition-all duration-300 ${
                  plan.popular 
                    ? 'border-purple-300 dark:border-purple-700 shadow-2xl scale-105' 
                    : 'border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl hover:-translate-y-1'
                } bg-white dark:bg-gray-800 overflow-hidden`}
              >
                {/* Badge Popular */}
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-bl-2xl text-sm font-medium">
                    Populaire
                  </div>
                )}

                <div className="p-8">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.gradient} mb-4`}>
                      <plan.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{plan.description}</p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                      <Zap className={`w-5 h-5 ${colors.text} mr-2`} />
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {plan.tokens} tokens
                      </span>
                    </div>
                    
                    <div className={`p-4 rounded-2xl ${colors.bg} ${colors.border} border mb-4`}>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pack de tokens</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{plan.basePrice.toFixed(2)} €</div>
                      
                      {/* Option Banque Toggle */}
                      <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={withBank}
                            onChange={() => toggleBankOption(plan.id as 'professor' | 'principal')}
                            className="sr-only"
                            disabled={isLoading}
                          />
                          <div className={`relative w-10 h-6 rounded-full transition-colors ${
                            withBank ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}>
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              withBank ? 'translate-x-4' : ''
                            }`}></div>
                          </div>
                          <div className="ml-3">
                            <div className="flex items-center">
                              <Database className="w-4 h-4 text-blue-600 mr-1" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Option Banque (+1€)
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Sauvegarde & réutilisation
                            </div>
                          </div>
                        </label>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                          {totalPrice.toFixed(2)} €
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Examples */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Exemples d'usage possible *
                    </h4>
                    <ul className="space-y-2">
                      {(withBank ? plan.examples.withBank : plan.examples.withoutBank).map((example, index) => (
                        <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                          <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                      * Estimations moyennes - La consommation varie selon vos demandes et la longueur souhaitée
                    </p>
                  </div>

                  {/* Features */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Fonctionnalités incluses</h4>
                    <ul className="space-y-2">
                      {baseFeatures.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    {withBank && (
                      <>
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center mb-2">
                            <Database className="w-4 h-4 text-blue-600 mr-2" />
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">Option Banque</span>
                          </div>
                          <ul className="space-y-2">
                            {bankFeatures.map((feature, index) => (
                              <li key={index} className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                                <Check className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handlePlanSelect(plan.id as 'professor' | 'principal')}
                    disabled={isLoading || !user}
                    className={`w-full py-4 px-6 rounded-2xl text-white font-semibold ${colors.button} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                        Redirection en cours...
                      </div>
                    ) : !user ? (
                      'Connectez-vous pour acheter'
                    ) : (
                      `${withBank ? 'Choisir avec Banque' : 'Choisir sans Banque'} - ${totalPrice.toFixed(2)}€`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Guarantees */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Pourquoi choisir nos tokens ?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Sécurisé</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Paiement sécurisé via Stripe. Vos données sont protégées.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Instantané</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tokens disponibles immédiatement après l'achat.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Sans expiration</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vos tokens n'expirent jamais. Utilisez-les à votre rythme.
              </p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Des questions sur nos packs de tokens ?
          </p>
          <button className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
            Contactez-nous
          </button>
        </div>
      </div>
    </div>
  );
}