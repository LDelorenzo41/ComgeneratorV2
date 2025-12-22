import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  Shield, 
  Zap,
  BookOpen,
  MessageSquare,
  FileText,
  Award,
  Clock,
  Users,
  Target,
  CheckCircle,
  Star,
  TrendingUp,
  Brain,
  PenTool,
  Database,
  Eye,
  ChevronDown,
  Play,
  Gift,
  Bot  // ✅ AJOUT pour le chatbot
} from 'lucide-react';

export function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isVisible, setIsVisible] = useState({});
  const [showSpecialOffer, setShowSpecialOffer] = useState(false);

  const features = [
    {
      title: "Appréciations intelligentes",
      description: "Génération personnalisée basée sur vos critères",
      icon: PenTool,
      color: "bg-blue-500"
    },
    {
      title: "Synthèses de bulletins",
      description: "Upload PDF et résumé automatique par IA",
      icon: FileText,
      color: "bg-green-500"
    },
    {
      title: "Communications",
      description: "Messages et réponses professionnelles",
      icon: MessageSquare,
      color: "bg-purple-500"
    },
    {
      title: "Séances pédagogiques",
      description: "Création et archivage de cours structurés",
      icon: BookOpen,
      color: "bg-orange-500"
    },
    {
      title: "Banques de données",
      description: "Stockage et recherche de vos contenus",
      icon: Database,
      color: "bg-teal-500"
    },
    {
      title: "Ressources éducatives",
      description: "Actualités éducatives",
      icon: TrendingUp,
      color: "bg-red-500"
    },
    // ✅ AJOUT : Nouveau module Chatbot
    {
      title: "Chatbot personnel",
      description: "Interrogez vos documents avec l'IA",
      icon: Bot,
      color: "bg-indigo-500"
    }
  ];

  const stats = [
    { number: "7", label: "Outils intégrés", icon: Target },  // ✅ MODIFIÉ : 6 → 7
    { number: "100%", label: "Personnalisable", icon: Star },
    { number: "75%*", label: "Temps économisé", sublabel: "* Estimation", icon: Clock },
    { number: "∞", label: "Possibilités créatives", icon: Brain }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentDate = new Date();
    const deadlineDate = new Date('2025-12-10T23:59:59');
    
    if (currentDate <= deadlineDate) {
      setShowSpecialOffer(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Post-it offre spéciale */}
      {showSpecialOffer && (
        <div className="fixed bottom-6 left-6 z-50 animate-bounce-slow">
          <div className="relative group">
            <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-600 dark:to-yellow-700 rounded-2xl shadow-lg p-6 max-w-xs border-2 border-yellow-300 dark:border-yellow-500 transform hover:scale-105 transition-all duration-300">
              <div className="text-4xl mb-3 text-center animate-pulse">
                🎁
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  Offre spéciale bulletins
                </h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                  <strong>30 000 tokens</strong> offerts pour tester ProfAssist !
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  (Jusqu'au 10 décembre 2025)
                </p>
              </div>

              <a
                href="/register"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <Gift className="w-4 h-4" />
                Profitez-en maintenant
              </a>
            </div>

            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-3 bg-yellow-300 dark:bg-yellow-600 rounded-t-sm opacity-60"></div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 mix-blend-multiply"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center">
            <div className="mb-8">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-4">
                <Sparkles className="w-4 h-4 mr-2" />
                Propulsé par ChatGPT
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-normal" style={{lineHeight: '1.3'}}>
              <span className="block mb-3">ProfAssist</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-3">
                L'IA au service
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                des enseignants
              </span>
            </h1>
            
            <p className="mt-6 max-w-3xl mx-auto text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              Une suite complète d'outils intelligents pour automatiser vos tâches administratives : 
              appréciations personnalisées, synthèses de bulletins, communications professionnelles, 
              création de séances pédagogiques et chatbot personnel pour interroger vos documents.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/register"
                className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                Commencer gratuitement
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              
              <a
                href="https://youtu.be/whV_svG5S3g"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <Play className="mr-2 w-5 h-5" />
                Voir la démo
              </a>
            </div>
            
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Aucune carte de crédit requise • 
              <a href="/register" className="text-blue-600 hover:text-blue-500 font-medium">
                Créez votre compte
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mb-4">
                  <stat.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{stat.number}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
                {stat.sublabel && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{stat.sublabel}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Features Section */}
      <div className="py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              7 outils puissants en un seul endroit
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Découvrez comment ProfAssist transforme votre quotidien d'enseignant
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Feature Navigation */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                    activeFeature === index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg scale-105'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 hover:shadow-md'
                  }`}
                  onClick={() => setActiveFeature(index)}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl ${feature.color}`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      activeFeature === index ? 'rotate-180' : ''
                    }`} />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Feature Preview */}
            <div className="relative">
              <div className="bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-2xl p-8 min-h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <div className={`inline-flex p-6 rounded-2xl ${features[activeFeature].color} mb-6`}>
                    {React.createElement(features[activeFeature].icon, { className: "w-12 h-12 text-white" })}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {features[activeFeature].title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-lg">
                    {features[activeFeature].description}
                  </p>
                  
                  {/* Feature-specific content */}
                  <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    {activeFeature === 0 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Critères personnalisables</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Versions détaillées & synthétiques</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Sauvegarde avec tags</span>
                        </div>
                      </div>
                    )}
                    {activeFeature === 1 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Upload PDF automatique</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">OCR intégré</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Résumé intelligent par IA</span>
                        </div>
                      </div>
                    )}
                    {activeFeature === 2 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Génération de messages professionnels</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Réponses automatiques aux parents</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Ton et style personnalisables</span>
                        </div>
                      </div>
                    )}
                    {activeFeature === 3 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Export PDF intégré</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Rendu Markdown</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Archivage automatique</span>
                        </div>
                      </div>
                    )}
                    {activeFeature === 4 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Stockage illimité de vos contenus</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Recherche par tags et mots-clés</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Organisation par catégories</span>
                        </div>
                      </div>
                    )}
                    {activeFeature === 5 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Actualités éducatives en temps réel</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Sources officielles (Éduscol, etc.)</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Veille pédagogique automatisée</span>
                        </div>
                      </div>
                    )}
                    {/* ✅ AJOUT : Contenu spécifique pour le Chatbot */}
                    {activeFeature === 6 && (
                      <div className="text-left">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Upload de vos documents (PDF, DOCX, TXT)</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Technologie RAG pour des réponses précises</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">2 modes : Corpus seul ou Corpus + IA</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm">Documents privés et sécurisés</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ AJOUT : Section mise en avant du Chatbot */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white/20 text-white mb-6">
                <Bot className="w-4 h-4 mr-2" />
                Nouveau • Version Bêta
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Votre chatbot personnel pour interroger vos documents
              </h2>
              <p className="text-lg text-blue-100 mb-8 max-w-2xl">
                Uploadez vos cours, programmes, fiches pédagogiques... et posez vos questions ! 
                Grâce à la technologie RAG (Retrieval-Augmented Generation), le chatbot trouve 
                les informations pertinentes dans VOS documents.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <div className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-300" />
                  <span>Documents privés</span>
                </div>
                <div className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-300" />
                  <span>Réponses sourcées</span>
                </div>
                <div className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-300" />
                  <span>Upload gratuit</span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <div className="w-32 h-32 bg-gradient-to-br from-white/30 to-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-16 h-16 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold mb-2">Exemple de question :</p>
                  <p className="text-blue-100 text-sm italic">
                    "Quels sont les objectifs du cycle 3 en EPS ?"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Benefits */}
      <div className="bg-white dark:bg-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Pourquoi choisir ProfAssist ?
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-100 dark:border-blue-800 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Intelligence artificielle avancée</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Propulsé par GPT, ProfAssist comprend le contexte éducatif et génère des contenus pertinents et personnalisés.
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                <Eye className="w-4 h-4 mr-2" />
                Gestion intelligente des tokens
              </div>
            </div>

            <div className="group p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-100 dark:border-green-800 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Gain de temps considérable</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Automatisez vos tâches répétitives et concentrez-vous sur l'essentiel : l'enseignement et l'accompagnement de vos élèves.
              </p>
              <div className="flex items-center text-green-600 dark:text-green-400 font-medium">
                <Clock className="w-4 h-4 mr-2" />
                Jusqu'à 75% de temps économisé
              </div>
            </div>

            <div className="group p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-100 dark:border-purple-800 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sécurité et confidentialité</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Vos données sont protégées avec Supabase. Authentification sécurisée et stockage chiffré de vos informations.
              </p>
              <div className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
                <Users className="w-4 h-4 mr-2" />
                Données personnelles protégées
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshot Section */}
      <div className="py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Découvrez l'interface intuitive
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Une expérience utilisateur pensée pour les enseignants
            </p>
          </div>
          
          <div className="rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 p-2">
            <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
              <img
                src="https://res.cloudinary.com/dhva6v5n8/image/upload/f_auto,q_auto,dpr_auto,w_1200/landing_mhnrfm.webp"
                alt="Interface ProfAssist - Dashboard complet"
                className="w-full h-auto"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à révolutionner votre quotidien ?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Rejoignez les enseignants qui ont déjà adopté ProfAssist pour gagner du temps 
            et améliorer la qualité de leurs productions.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/register"
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl shadow-lg hover:bg-gray-50 transform hover:-translate-y-1 transition-all duration-300"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
            
            <a
              href="/login"
              className="inline-flex items-center px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-xl hover:bg-white hover:text-blue-600 transition-all duration-300"
            >
              J'ai déjà un compte
            </a>
          </div>
          
          <p className="mt-6 text-blue-100 text-sm">
            Gratuit pour commencer • Aucun engagement • 
            <a href="/register" className="text-white hover:underline font-medium">
              Créez votre compte en 30 secondes
            </a>
          </p>
        </div>
      </div>

      {/* Animation CSS pour le post-it */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
