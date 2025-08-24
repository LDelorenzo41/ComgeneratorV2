// src/components/legal/LegalLayout.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, Scale, Users } from 'lucide-react';

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  lastUpdated: string;
}

export function LegalLayout({ children, title, lastUpdated }: LegalLayoutProps) {
  const location = useLocation();
  
  const legalPages = [
    {
      path: '/legal/mentions-legales',
      title: 'Mentions légales',
      icon: FileText
    },
    {
      path: '/legal/politique-confidentialite',
      title: 'Politique de confidentialité',
      icon: Shield
    },
    {
      path: '/legal/cgu',
      title: 'Conditions générales d\'utilisation',
      icon: Users
    },
    {
      path: '/legal/cgv',
      title: 'Conditions générales de vente',
      icon: Scale
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation retour */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Informations légales
              </h3>
              
              <nav className="space-y-3">
                {legalPages.map(({ path, title, icon: Icon }) => {
                  const isActive = location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`
                        flex items-center p-3 rounded-xl transition-all duration-200
                        ${isActive 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      <span className="text-sm font-medium">{title}</span>
                    </Link>
                  );
                })}
              </nav>
              
              {/* Contact info */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Une question ?
                </h4>
                <a
                  href="mailto:contact-profassist@teachtech.fr"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  contact-profassist@teachtech.fr
                </a>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                <h1 className="text-2xl font-bold text-white mb-2">
                  {title}
                </h1>
                <p className="text-blue-100 text-sm">
                  Dernière mise à jour : {lastUpdated}
                </p>
              </div>

              {/* Contenu */}
              <div className="px-8 py-8">
                <div className="prose prose-lg max-w-none">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}